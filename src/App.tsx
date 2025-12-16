import { useMemo, useState } from 'react';
import {
  ORCA_CONFIG_SCHEMA_ID,
  ORCA_CONFIG_SETTINGS_BLOB_SIZE,
  ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_FLAGS_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_HEADER_SIZE_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_VERSION_MAJOR_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_VERSION_MINOR_OFFSET,
} from '@shared/orca_config_idl_generated';
import { MockOrcaTransport } from './mocks/mockTransport';
import { OrcaWebUsbTransport } from './usb/OrcaWebUsbTransport';

type DeviceInfo = {
  schemaId: number;
  settingsMajor: number;
  settingsMinor: number;
  blobSize: number;
  maxChunk: number;
};

type SettingsSummary = {
  magic: string;
  versionMajor: number;
  versionMinor: number;
  headerSize: number;
  generation: number;
  activeProfile: number;
  flags: number;
  storedCrc32: number;
};

function readU32Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function readU16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function decodeAscii(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.slice(0, end) : bytes;
  return new TextDecoder('ascii', { fatal: false }).decode(slice);
}

function summarizeSettingsBlob(blob: Uint8Array): SettingsSummary {
  const magic = decodeAscii(
    blob.slice(ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET, ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET + 16),
  );
  const versionMajor = blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MAJOR_OFFSET] ?? 0;
  const versionMinor = blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MINOR_OFFSET] ?? 0;
  const headerSize = readU16Le(blob, ORCA_CONFIG_SETTINGS_HEADER_HEADER_SIZE_OFFSET);
  const generation = readU32Le(blob, ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET);
  const activeProfile = blob[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET] ?? 0;
  const flags = blob[ORCA_CONFIG_SETTINGS_HEADER_FLAGS_OFFSET] ?? 0;
  const storedCrc32 = readU32Le(blob, blob.length - 4);
  return { magic, versionMajor, versionMinor, headerSize, generation, activeProfile, flags, storedCrc32 };
}

export default function App() {
  const [useMock, setUseMock] = useState(false);
  const [transport, setTransport] = useState<OrcaWebUsbTransport | MockOrcaTransport | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [readProgress, setReadProgress] = useState<string>('');
  const [settingsSummary, setSettingsSummary] = useState<SettingsSummary | null>(null);
  const [lastError, setLastError] = useState<string>('');

  const schemaOk = useMemo(() => {
    if (!deviceInfo) return null;
    return deviceInfo.schemaId === ORCA_CONFIG_SCHEMA_ID;
  }, [deviceInfo]);

  async function connect() {
    setLastError('');
    setReadProgress('');
    setSettingsSummary(null);

    try {
      const nextTransport = useMock ? new MockOrcaTransport() : await OrcaWebUsbTransport.requestAndOpen();
      const info = await nextTransport.getInfo();
      setTransport(nextTransport);
      setDeviceInfo(info);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }

  async function disconnect() {
    setLastError('');
    setReadProgress('');
    setSettingsSummary(null);
    try {
      await transport?.close();
    } finally {
      setTransport(null);
      setDeviceInfo(null);
    }
  }

  async function readSettings() {
    if (!transport || !deviceInfo) return;
    setLastError('');
    setSettingsSummary(null);

    const blobSize = deviceInfo.blobSize || ORCA_CONFIG_SETTINGS_BLOB_SIZE;
    const maxChunk = deviceInfo.maxChunk || 256;

    try {
      const blob = new Uint8Array(blobSize);
      let offset = 0;
      while (offset < blobSize) {
        const len = Math.min(maxChunk, blobSize - offset);
        setReadProgress(`Reading ${offset}/${blobSize}...`);
        const chunk = await transport.readBlobChunk(offset, len);
        blob.set(chunk, offset);
        offset += len;
      }
      setReadProgress(`Read ${blobSize} bytes.`);
      setSettingsSummary(summarizeSettingsBlob(blob));
    } catch (e) {
      setReadProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }

  const infoJson = deviceInfo ? JSON.stringify(deviceInfo, null, 2) : '';
  const summaryJson = settingsSummary ? JSON.stringify(settingsSummary, null, 2) : '';

  return (
    <div>
      <h1>Orca Web Configurator (Phase 2)</h1>

      <div className="row">
        <label>
          <input type="checkbox" checked={useMock} onChange={(e) => setUseMock(e.target.checked)} disabled={!!transport} />{' '}
          Mock device
        </label>
        {!transport ? (
          <button onClick={connect}>Connect</button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
        <button onClick={readSettings} disabled={!transport}>
          Read settings blob
        </button>
      </div>

      {lastError ? (
        <div className="card">
          <strong>Error</strong>
          <div>{lastError}</div>
        </div>
      ) : null}

      {deviceInfo ? (
        <div className="card">
          <div className="row">
            <strong>Device</strong>
            {schemaOk === false ? (
              <span>
                Schema mismatch: device 0x{deviceInfo.schemaId.toString(16)} vs app 0x{ORCA_CONFIG_SCHEMA_ID.toString(16)}
              </span>
            ) : schemaOk === true ? (
              <span>Schema OK (0x{deviceInfo.schemaId.toString(16)})</span>
            ) : null}
          </div>
          <pre>{infoJson}</pre>
        </div>
      ) : null}

      {readProgress ? (
        <div className="card">
          <strong>Read</strong>
          <div>{readProgress}</div>
        </div>
      ) : null}

      {settingsSummary ? (
        <div className="card">
          <strong>Settings Summary</strong>
          <pre>{summaryJson}</pre>
        </div>
      ) : null}
    </div>
  );
}

