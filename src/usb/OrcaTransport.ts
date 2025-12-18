export type DeviceInfo = {
  schemaId: number;
  settingsMajor: number;
  settingsMinor: number;
  blobSize: number;
  maxChunk: number;
  slotCount: number;
};

export type BeginSessionInfo = {
  sessionId: number;
  writeUnlocked: boolean;
};

export type ValidateStagedResult = {
  invalidMask: number;
  repaired: boolean;
};

export interface OrcaTransport {
  close(): Promise<void>;

  getInfo(): Promise<DeviceInfo>;
  beginSession(): Promise<BeginSessionInfo>;
  unlockWrites(): Promise<void>;

  readBlobChunk(slot: number, offset: number, length: number): Promise<Uint8Array>;
  readBlob(slot: number, options?: {
    blobSize?: number;
    maxChunk?: number;
    onProgress?: (offset: number, total: number) => void;
  }): Promise<Uint8Array>;

  writeBlob(
    slot: number,
    blob: Uint8Array,
    options?: {
      maxChunk?: number;
      onProgress?: (offset: number, total: number) => void;
    },
  ): Promise<void>;

  validateStaged(slot: number): Promise<ValidateStagedResult>;
  commitStaged(slot: number): Promise<{ generation: number }>;
  resetDefaults(slot: number): Promise<{ generation: number }>;
  reboot(): Promise<void>;
}
