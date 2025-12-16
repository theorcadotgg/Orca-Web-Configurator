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
  ORCA_CONFIG_SETTINGS_HEADER_SIZE,
  ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
  ORCA_CONFIG_SETTINGS_VERSION_MINOR,
} from '@shared/orca_config_idl_generated';

type DeviceInfo = {
  schemaId: number;
  settingsMajor: number;
  settingsMinor: number;
  blobSize: number;
  maxChunk: number;
};

function writeU16Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function writeU32Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

function makeMockBlob(): Uint8Array {
  const blob = new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE);
  const magic = new TextEncoder().encode('ORCA CONTROLLER\0');
  blob.set(magic, ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET);
  blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MAJOR_OFFSET] = ORCA_CONFIG_SETTINGS_VERSION_MAJOR;
  blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MINOR_OFFSET] = ORCA_CONFIG_SETTINGS_VERSION_MINOR;
  writeU16Le(blob, ORCA_CONFIG_SETTINGS_HEADER_HEADER_SIZE_OFFSET, ORCA_CONFIG_SETTINGS_HEADER_SIZE);
  writeU32Le(blob, ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET, 1);
  blob[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET] = 0;
  blob[ORCA_CONFIG_SETTINGS_HEADER_FLAGS_OFFSET] = 0;
  writeU32Le(blob, blob.length - 4, 0);
  return blob;
}

export class MockOrcaTransport {
  private readonly blob = makeMockBlob();

  async close(): Promise<void> {}

  async getInfo(): Promise<DeviceInfo> {
    return {
      schemaId: ORCA_CONFIG_SCHEMA_ID,
      settingsMajor: ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
      settingsMinor: ORCA_CONFIG_SETTINGS_VERSION_MINOR,
      blobSize: ORCA_CONFIG_SETTINGS_BLOB_SIZE,
      maxChunk: 256,
    };
  }

  async readBlobChunk(offset: number, length: number): Promise<Uint8Array> {
    return this.blob.slice(offset, offset + length);
  }
}
