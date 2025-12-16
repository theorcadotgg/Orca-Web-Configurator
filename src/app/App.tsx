import { useMemo, useRef, useState } from 'react';
import {
  ORCA_CONFIG_SCHEMA_ID,
  ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
} from '@shared/orca_config_idl_generated';
import { MockOrcaTransport } from '../mocks/mockTransport';
import { buildSettingsBlob, tryParseSettingsBlob, type ParsedSettings, type SettingsDraft } from '../schema/settingsBlob';
import { decodeStagedInvalidMask, validateSettingsDraft } from '../validators/settingsValidation';
import type { DeviceInfo, OrcaTransport, ValidateStagedResult } from '../usb/OrcaTransport';
import { OrcaWebSerialTransport } from '../usb/OrcaWebSerialTransport';
import { ConnectionCard } from './components/ConnectionCard';
import { type Compatibility, DeviceInfoCard } from './components/DeviceInfoCard';
import { DpadEditorCard } from './components/DpadEditorCard';
import { MappingEditorCard } from './components/MappingEditorCard';
import { SettingsSummaryCard } from './components/SettingsSummaryCard';
import { TriggerEditorCard } from './components/TriggerEditorCard';
import { ValidationCard } from './components/ValidationCard';
import { AnalogMappingEditorCard } from './components/AnalogMappingEditorCard';

type DeviceValidationState = ValidateStagedResult & { decoded: string[] };

function downloadBytes(filename: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [useMock, setUseMock] = useState(false);
  const [transport, setTransport] = useState<OrcaTransport | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [allowUnsafeWrites, setAllowUnsafeWrites] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastError, setLastError] = useState('');

  const [baseBlob, setBaseBlob] = useState<Uint8Array | null>(null);
  const [parsed, setParsed] = useState<ParsedSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [dirty, setDirty] = useState(false);

  const [deviceValidation, setDeviceValidation] = useState<DeviceValidationState | null>(null);
  const [rebootAfterSave, setRebootAfterSave] = useState(true);

  const importRef = useRef<HTMLInputElement | null>(null);

  const compatibility: Compatibility = useMemo(() => {
    if (!deviceInfo) return 'unknown';
    if (deviceInfo.settingsMajor !== ORCA_CONFIG_SETTINGS_VERSION_MAJOR) return 'major_mismatch';
    if (deviceInfo.schemaId !== ORCA_CONFIG_SCHEMA_ID) return 'minor_mismatch';
    return 'ok';
  }, [deviceInfo]);

  const canWrite = useMemo(() => {
    if (!transport) return false;
    if (!deviceInfo) return false;
    if (compatibility === 'major_mismatch') return false;
    if (compatibility === 'minor_mismatch') return allowUnsafeWrites;
    return true;
  }, [allowUnsafeWrites, compatibility, deviceInfo, transport]);

  const localValidation = useMemo(() => (draft ? validateSettingsDraft(draft) : { errors: [], warnings: [] }), [draft]);

  async function connect() {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      const nextTransport = useMock ? new MockOrcaTransport() : await OrcaWebSerialTransport.requestAndOpen();
      const info = await nextTransport.getInfo();
      setTransport(nextTransport);
      setDeviceInfo(info);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      await transport?.close();
    } finally {
      setTransport(null);
      setDeviceInfo(null);
      setBaseBlob(null);
      setParsed(null);
      setDraft(null);
      setDirty(false);
      setBusy(false);
    }
  }

  async function readSettingsFromDevice() {
    if (!transport || !deviceInfo) return;
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      const blob = await transport.readBlob({
        blobSize: deviceInfo.blobSize,
        maxChunk: deviceInfo.maxChunk,
        onProgress: (offset, total) => setProgress(`Reading ${offset}/${total}...`),
      });
      setBaseBlob(blob);
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);
      setProgress(`Read ${blob.length} bytes.`);
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCurrentBlob() {
    if (!baseBlob) return;
    downloadBytes('orca-settings.bin', baseBlob);
  }

  async function exportDraftBlob() {
    if (!baseBlob || !draft) return;
    const next = buildSettingsBlob(baseBlob, draft);
    downloadBytes('orca-settings-draft.bin', next);
  }

  async function importBlobFromFile(file: File) {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      const ab = await file.arrayBuffer();
      const blob = new Uint8Array(ab);
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      setBaseBlob(blob);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(true);
      setProgress(`Imported ${blob.length} bytes from file.`);
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onDraftChange(next: SettingsDraft) {
    setDraft(next);
    setDirty(true);
    setDeviceValidation(null);
  }

  async function validateOnDevice() {
    if (!transport) return;
    if (!baseBlob || !draft) return;
    setLastError('');
    setProgress('');
    try {
      setBusy(true);
      setProgress('Beginning session...');
      await transport.beginSession();
      setProgress('Staging blob...');
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(staged, {
        maxChunk: deviceInfo?.maxChunk ?? 256,
        onProgress: (offset, total) => setProgress(`Staging ${offset}/${total}...`),
      });
      setProgress('Validating staged blob...');
      const res = await transport.validateStaged();
      setDeviceValidation({ ...res, decoded: decodeStagedInvalidMask(res.invalidMask) });
      setProgress('Validation complete.');
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveToDevice() {
    if (!transport || !deviceInfo) return;
    if (!baseBlob || !draft) return;
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);

      setProgress('Beginning session...');
      await transport.beginSession();

      setProgress('Staging blob...');
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(staged, {
        maxChunk: deviceInfo.maxChunk,
        onProgress: (offset, total) => setProgress(`Staging ${offset}/${total}...`),
      });

      setProgress('Validating staged blob...');
      const v = await transport.validateStaged();
      const decoded = decodeStagedInvalidMask(v.invalidMask);
      setDeviceValidation({ ...v, decoded });
      if (v.invalidMask !== 0) {
        throw new Error(`Device validation failed: ${decoded.join(', ')}`);
      }

      setProgress('Unlocking writes...');
      await transport.unlockWrites();

      setProgress('Committing...');
      const { generation } = await transport.commitStaged();
      setProgress(`Committed generation ${generation}. Reading back...`);

      const readBack = await transport.readBlob({
        blobSize: deviceInfo.blobSize,
        maxChunk: deviceInfo.maxChunk,
      });
      setBaseBlob(readBack);
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(`Read-back parse failed: ${res.error}`);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);

      if (rebootAfterSave) {
        setProgress('Rebooting...');
        await transport.reboot();
      }

      setProgress('Save complete.');
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaultsOnDevice() {
    if (!transport) return;
    if (!deviceInfo) return;
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      setProgress('Beginning session...');
      await transport.beginSession();
      setProgress('Unlocking writes...');
      await transport.unlockWrites();
      setProgress('Resetting defaults...');
      const { generation } = await transport.resetDefaults();
      setProgress(`Defaults committed (generation ${generation}). Reading back...`);
      const readBack = await transport.readBlob({ blobSize: deviceInfo.blobSize, maxChunk: deviceInfo.maxChunk });
      setBaseBlob(readBack);
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(res.error);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);
      setProgress('Defaults restored.');
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rebootNow() {
    if (!transport) return;
    setLastError('');
    setProgress('');
    try {
      setBusy(true);
      setProgress('Rebooting...');
      await transport.reboot();
      setProgress('Reboot command sent.');
    } catch (e) {
      setProgress('');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const deviceErrors = deviceValidation ? deviceValidation.decoded : null;
  const deviceRepaired = deviceValidation ? deviceValidation.repaired : null;

  return (
    <div>
      <h1>Orca Web Configurator (Phase 3)</h1>

      <ConnectionCard
        useMock={useMock}
        onToggleMock={setUseMock}
        connected={!!transport}
        busy={busy}
        onConnect={connect}
        onDisconnect={disconnect}
        onReadSettings={readSettingsFromDevice}
        readLabel="Read settings from device"
      />

      {lastError ? (
        <div className="card">
          <strong>Error</strong>
          <div style={{ marginTop: 6 }}>{lastError}</div>
        </div>
      ) : null}

      {progress ? (
        <div className="card">
          <strong>Status</strong>
          <div style={{ marginTop: 6 }}>{progress}</div>
        </div>
      ) : null}

      <DeviceInfoCard
        deviceInfo={deviceInfo}
        compatibility={compatibility}
        allowUnsafeWrites={allowUnsafeWrites}
        onToggleAllowUnsafeWrites={setAllowUnsafeWrites}
      />

      <SettingsSummaryCard header={parsed?.header ?? null} />

      {draft ? (
        <>
          <MappingEditorCard draft={draft} onChange={onDraftChange} disabled={busy} />
          <AnalogMappingEditorCard draft={draft} onChange={onDraftChange} disabled={busy} />
          <DpadEditorCard draft={draft} onChange={onDraftChange} disabled={busy} />
          <TriggerEditorCard draft={draft} onChange={onDraftChange} disabled={busy} />

          <ValidationCard errors={localValidation.errors} warnings={localValidation.warnings} deviceErrors={deviceErrors} deviceRepaired={deviceRepaired} />

          <div className="card">
            <div className="row">
              <strong>Actions</strong>
              {dirty ? <span className="pill pill-warn">Unsaved changes</span> : <span className="pill pill-ok">Clean</span>}
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={validateOnDevice} disabled={!canWrite || busy || !dirty}>
                Stage + validate
              </button>
              <button onClick={saveToDevice} disabled={!canWrite || busy || !dirty || localValidation.errors.length > 0}>
                Save to controller
              </button>
              <label style={{ opacity: 0.9 }}>
                <input
                  type="checkbox"
                  checked={rebootAfterSave}
                  onChange={(e) => setRebootAfterSave(e.target.checked)}
                  disabled={busy}
                />{' '}
                Reboot after save
              </label>
              <button onClick={resetDefaultsOnDevice} disabled={!canWrite || busy}>
                Reset to defaults
              </button>
              <button onClick={rebootNow} disabled={!transport || busy}>
                Reboot now
              </button>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={exportCurrentBlob} disabled={!baseBlob || busy}>
                Export current blob
              </button>
              <button onClick={exportDraftBlob} disabled={!baseBlob || !draft || busy}>
                Export draft blob
              </button>
              <button onClick={() => importRef.current?.click()} disabled={busy}>
                Import blob…
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".bin,application/octet-stream"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBlobFromFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {compatibility === 'minor_mismatch' ? (
              <div style={{ marginTop: 12, opacity: 0.85 }}>
                Writes are gated because the app’s schema differs from the device. Enable “Allow writes with schema mismatch” to proceed (best-effort).
              </div>
            ) : compatibility === 'major_mismatch' ? (
              <div style={{ marginTop: 12, opacity: 0.85 }}>
                Writes are disabled due to incompatible schema major version. Update firmware or the web app.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
