export type DeviceInfo = {
  schemaId: number;
  settingsMajor: number;
  settingsMinor: number;
  blobSize: number;
  maxChunk: number;
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

  readBlobChunk(offset: number, length: number): Promise<Uint8Array>;
  readBlob(options?: {
    blobSize?: number;
    maxChunk?: number;
    onProgress?: (offset: number, total: number) => void;
  }): Promise<Uint8Array>;

  writeBlob(
    blob: Uint8Array,
    options?: {
      maxChunk?: number;
      onProgress?: (offset: number, total: number) => void;
    },
  ): Promise<void>;

  validateStaged(): Promise<ValidateStagedResult>;
  commitStaged(): Promise<{ generation: number }>;
  resetDefaults(): Promise<{ generation: number }>;
  reboot(): Promise<void>;
}

