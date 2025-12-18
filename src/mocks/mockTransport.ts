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
import type { BeginSessionInfo, DeviceInfo, OrcaTransport, ValidateStagedResult } from '../usb/OrcaTransport';

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

export class MockOrcaTransport implements OrcaTransport {
  private flashBlobs = [makeMockBlob(), makeMockBlob()];
  private stagedBlobs: Array<Uint8Array | null> = [null, null];
  private sessionId = 1;
  private sessionActive = false;
  private writesUnlocked = false;

  private assertSlot(slot: number): asserts slot is 0 | 1 {
    if (slot !== 0 && slot !== 1) throw new Error(`Invalid slot ${slot}`);
  }

  async close(): Promise<void> {}

  async getInfo(): Promise<DeviceInfo> {
    return {
      schemaId: ORCA_CONFIG_SCHEMA_ID,
      settingsMajor: ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
      settingsMinor: ORCA_CONFIG_SETTINGS_VERSION_MINOR,
      blobSize: ORCA_CONFIG_SETTINGS_BLOB_SIZE,
      maxChunk: 256,
      slotCount: 2,
    };
  }

  async beginSession(): Promise<BeginSessionInfo> {
    this.sessionActive = true;
    this.writesUnlocked = false;
    this.sessionId += 1;
    this.stagedBlobs = [null, null];
    return { sessionId: this.sessionId, writeUnlocked: false };
  }

  async unlockWrites(): Promise<void> {
    if (!this.sessionActive) throw new Error('No active session');
    this.writesUnlocked = true;
  }

  async readBlobChunk(slot: number, offset: number, length: number): Promise<Uint8Array> {
    this.assertSlot(slot);
    return this.flashBlobs[slot].slice(offset, offset + length);
  }

  async readBlob(slot: number, options?: {
    blobSize?: number;
    maxChunk?: number;
    onProgress?: (offset: number, total: number) => void;
  }): Promise<Uint8Array> {
    this.assertSlot(slot);
    const blobSize = options?.blobSize ?? ORCA_CONFIG_SETTINGS_BLOB_SIZE;
    const maxChunk = options?.maxChunk ?? 256;
    const blob = new Uint8Array(blobSize);
    let offset = 0;
    while (offset < blobSize) {
      const len = Math.min(maxChunk, blobSize - offset);
      options?.onProgress?.(offset, blobSize);
      blob.set(await this.readBlobChunk(slot, offset, len), offset);
      offset += len;
    }
    options?.onProgress?.(blobSize, blobSize);
    return blob;
  }

  async writeBlob(
    slot: number,
    blob: Uint8Array,
    options?: { maxChunk?: number; onProgress?: (offset: number, total: number) => void },
  ): Promise<void> {
    if (!this.sessionActive) throw new Error('No active session');
    this.assertSlot(slot);
    if (blob.length !== ORCA_CONFIG_SETTINGS_BLOB_SIZE) throw new Error('Bad blob size');
    options?.onProgress?.(0, blob.length);
    this.stagedBlobs[slot] = blob.slice();
    options?.onProgress?.(blob.length, blob.length);
  }

  async validateStaged(slot: number): Promise<ValidateStagedResult> {
    if (!this.sessionActive) throw new Error('No active session');
    this.assertSlot(slot);
    if (!this.stagedBlobs[slot]) throw new Error('Nothing staged');
    return { invalidMask: 0, repaired: false };
  }

  async commitStaged(slot: number): Promise<{ generation: number }> {
    if (!this.sessionActive) throw new Error('No active session');
    this.assertSlot(slot);
    const stagedBlob = this.stagedBlobs[slot];
    if (!stagedBlob) throw new Error('Nothing staged');
    if (!this.writesUnlocked) throw new Error('Writes not unlocked');
    const next = stagedBlob.slice();
    const baseGen =
      this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET]! |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 1]! << 8) |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 2]! << 16) |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 3]! << 24);
    const generation = (baseGen + 1) >>> 0;
    writeU32Le(next, ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET, generation);
    this.flashBlobs[slot] = next;
    this.stagedBlobs[slot] = null;
    this.writesUnlocked = false;
    return { generation };
  }

  async resetDefaults(slot: number): Promise<{ generation: number }> {
    if (!this.sessionActive) throw new Error('No active session');
    this.assertSlot(slot);
    if (!this.writesUnlocked) throw new Error('Writes not unlocked');
    const baseGen =
      this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET]! |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 1]! << 8) |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 2]! << 16) |
      (this.flashBlobs[slot][ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET + 3]! << 24);
    const next = makeMockBlob();
    const generation = (baseGen + 1) >>> 0;
    writeU32Le(next, ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET, generation);
    this.flashBlobs[slot] = next;
    this.stagedBlobs[slot] = null;
    this.writesUnlocked = false;
    return { generation };
  }

  async reboot(): Promise<void> {}
}
