import {
  ORCA_CONFIG_SETTINGS_BLOB_SIZE,
  OrcaMsgType,
} from '@shared/orca_config_idl_generated';
import {
  encodeBeginSessionRequest,
  encodeCommitStagedRequest,
  encodeGetInfoRequest,
  encodeRebootRequest,
  encodeReadBlobRequest,
  encodeResetDefaultsRequest,
  encodeUnlockWritesRequest,
  encodeValidateStagedRequest,
  encodeWriteBlobBeginRequest,
  encodeWriteBlobChunkRequest,
  encodeWriteBlobEndRequest,
  parseErrorPayload,
  tryDecodeFrameFromBuffer,
} from '../protocol/orcaProtocol';
import type { BeginSessionInfo, DeviceInfo, OrcaTransport, ValidateStagedResult } from './OrcaTransport';

function readU32Le(payload: Uint8Array<ArrayBufferLike>, offset: number): number {
  return (
    payload[offset]! |
    (payload[offset + 1]! << 8) |
    (payload[offset + 2]! << 16) |
    (payload[offset + 3]! << 24)
  ) >>> 0;
}

export class OrcaWebUsbTransport implements OrcaTransport {
  private constructor(
    private device: USBDevice,
    private readonly interfaceNumber: number,
    private readonly inEndpoint: number,
    private readonly outEndpoint: number,
  ) { }

  private rx: Uint8Array<ArrayBufferLike> = new Uint8Array(0) as Uint8Array<ArrayBufferLike>;
  private seq = 1;

  static async requestAndOpen(): Promise<OrcaWebUsbTransport> {
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x057E, productId: 0x0337 }],
    });
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const vendorInterface = device.configuration!.interfaces
      .flatMap((i) => i.alternates.map((a) => ({ iface: i, alt: a })))
      .find((x) => x.alt.interfaceClass === 0xff);

    if (!vendorInterface) {
      throw new Error('No vendor interface found');
    }

    const interfaceNumber = vendorInterface.iface.interfaceNumber;
    if (device.configuration!.interfaces.some((i) => i.interfaceNumber === interfaceNumber)) {
      await device.claimInterface(interfaceNumber);
    }

    const inEp = vendorInterface.alt.endpoints.find((e) => e.direction === 'in');
    const outEp = vendorInterface.alt.endpoints.find((e) => e.direction === 'out');
    if (!inEp || !outEp) {
      throw new Error('Missing bulk endpoints');
    }

    return new OrcaWebUsbTransport(device, interfaceNumber, inEp.endpointNumber, outEp.endpointNumber);
  }

  async close(): Promise<void> {
    try {
      if (this.device.opened) {
        try {
          await this.device.releaseInterface(this.interfaceNumber);
        } catch {
          // ignore
        }
        await this.device.close();
      }
    } finally {
      this.rx = new Uint8Array(0) as Uint8Array<ArrayBufferLike>;
    }
  }

  private async write(buf: Uint8Array<ArrayBufferLike>): Promise<void> {
    const res = await this.device.transferOut(this.outEndpoint, buf);
    if (res.status !== 'ok') {
      throw new Error(`USB write failed: ${res.status}`);
    }
  }

  private async readSome(maxBytes = 512): Promise<void> {
    const res = await this.device.transferIn(this.inEndpoint, maxBytes);
    if (res.status !== 'ok' || !res.data) {
      throw new Error(`USB read failed: ${res.status}`);
    }
    const chunk = new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength) as Uint8Array<ArrayBufferLike>;
    const merged = new Uint8Array(this.rx.length + chunk.length) as Uint8Array<ArrayBufferLike>;
    merged.set(this.rx, 0);
    merged.set(chunk, this.rx.length);
    this.rx = merged;
  }

  private async readFrame(): Promise<{ msgType: number; seq: number; payload: Uint8Array<ArrayBufferLike> }> {
    while (true) {
      const decoded = tryDecodeFrameFromBuffer(this.rx);
      if (decoded) {
        this.rx = decoded.remaining;
        return decoded.frame;
      }
      await this.readSome();
    }
  }

  async getInfo(): Promise<DeviceInfo> {
    const seq = this.seq++;
    await this.write(encodeGetInfoRequest(seq));
    const frame = await this.readFrame();

    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }

    const payload = frame.payload;
    if (payload.length < 16) throw new Error('Bad GET_INFO response length');
    const schemaId = readU32Le(payload, 4);
    const blobSize = readU32Le(payload, 8) || ORCA_CONFIG_SETTINGS_BLOB_SIZE;
    const maxChunk = readU32Le(payload, 12) || 256;

    return {
      schemaId,
      settingsMajor: payload[1] ?? 0,
      settingsMinor: payload[2] ?? 0,
      blobSize,
      maxChunk,
    };
  }

  async beginSession(): Promise<BeginSessionInfo> {
    const seq = this.seq++;
    await this.write(encodeBeginSessionRequest(seq));
    const frame = await this.readFrame();

    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }

    const payload = frame.payload;
    if (payload.length < 8) throw new Error('Bad BEGIN_SESSION response length');
    const sessionId = readU32Le(payload, 4);
    const writeUnlocked = (payload[1] ?? 0) !== 0;
    return { sessionId, writeUnlocked };
  }

  async unlockWrites(): Promise<void> {
    const seq = this.seq++;
    await this.write(encodeUnlockWritesRequest(seq));
    const frame = await this.readFrame();

    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }
  }

  async readBlobChunk(offset: number, length: number): Promise<Uint8Array> {
    const seq = this.seq++;
    await this.write(encodeReadBlobRequest(seq, offset, length));
    const frame = await this.readFrame();

    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }

    const payload = frame.payload;
    if (payload.length < 12) throw new Error('Bad READ_BLOB response length');
    const gotOffset = readU32Le(payload, 4);
    const gotLen = readU32Le(payload, 8);
    if (gotOffset !== (offset >>> 0) || gotLen !== (length >>> 0)) {
      throw new Error(`READ_BLOB mismatch (offset=${gotOffset}, len=${gotLen})`);
    }
    const data = payload.slice(12, 12 + gotLen);
    if (data.length !== gotLen) throw new Error('Short READ_BLOB payload');
    return data;
  }

  async readBlob(options?: {
    blobSize?: number;
    maxChunk?: number;
    onProgress?: (offset: number, total: number) => void;
  }): Promise<Uint8Array> {
    const blobSize = options?.blobSize ?? ORCA_CONFIG_SETTINGS_BLOB_SIZE;
    const maxChunk = options?.maxChunk ?? 256;
    const blob = new Uint8Array(blobSize);
    let offset = 0;
    while (offset < blobSize) {
      const len = Math.min(maxChunk, blobSize - offset);
      options?.onProgress?.(offset, blobSize);
      const chunk = await this.readBlobChunk(offset, len);
      blob.set(chunk, offset);
      offset += len;
    }
    options?.onProgress?.(blobSize, blobSize);
    return blob;
  }

  async writeBlob(
    blob: Uint8Array,
    options?: { maxChunk?: number; onProgress?: (offset: number, total: number) => void },
  ): Promise<void> {
    const maxChunk = options?.maxChunk ?? 256;

    // BEGIN
    {
      const seq = this.seq++;
      await this.write(encodeWriteBlobBeginRequest(seq, blob.length));
      const frame = await this.readFrame();
      if (frame.msgType === OrcaMsgType.ERROR) {
        const { cmd, err } = parseErrorPayload(frame.payload);
        throw new Error(`Device error (cmd=${cmd}, err=${err})`);
      }
    }

    // CHUNKS
    let offset = 0;
    while (offset < blob.length) {
      const len = Math.min(maxChunk, blob.length - offset);
      const chunk = blob.slice(offset, offset + len);
      options?.onProgress?.(offset, blob.length);

      const seq = this.seq++;
      await this.write(encodeWriteBlobChunkRequest(seq, offset, chunk));
      const frame = await this.readFrame();
      if (frame.msgType === OrcaMsgType.ERROR) {
        const { cmd, err } = parseErrorPayload(frame.payload);
        throw new Error(`Device error (cmd=${cmd}, err=${err})`);
      }

      offset += len;
    }
    options?.onProgress?.(blob.length, blob.length);

    // END
    {
      const seq = this.seq++;
      await this.write(encodeWriteBlobEndRequest(seq));
      const frame = await this.readFrame();
      if (frame.msgType === OrcaMsgType.ERROR) {
        const { cmd, err } = parseErrorPayload(frame.payload);
        throw new Error(`Device error (cmd=${cmd}, err=${err})`);
      }
    }
  }

  async validateStaged(): Promise<ValidateStagedResult> {
    const seq = this.seq++;
    await this.write(encodeValidateStagedRequest(seq));
    const frame = await this.readFrame();
    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }
    const payload = frame.payload;
    if (payload.length < 12) throw new Error('Bad VALIDATE_STAGED response length');
    const repaired = (payload[2] ?? 0) !== 0;
    const invalidMask = readU32Le(payload, 4);
    return { invalidMask, repaired };
  }

  async commitStaged(): Promise<{ generation: number }> {
    const seq = this.seq++;
    await this.write(encodeCommitStagedRequest(seq));
    const frame = await this.readFrame();
    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }
    const payload = frame.payload;
    if (payload.length < 8) throw new Error('Bad COMMIT_STAGED response length');
    const generation = readU32Le(payload, 4);
    return { generation };
  }

  async resetDefaults(): Promise<{ generation: number }> {
    const seq = this.seq++;
    await this.write(encodeResetDefaultsRequest(seq));
    const frame = await this.readFrame();
    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }
    const payload = frame.payload;
    if (payload.length < 8) throw new Error('Bad RESET_DEFAULTS response length');
    const generation = readU32Le(payload, 4);
    return { generation };
  }

  async reboot(): Promise<void> {
    const seq = this.seq++;
    await this.write(encodeRebootRequest(seq));
    const frame = await this.readFrame();
    if (frame.msgType === OrcaMsgType.ERROR) {
      const { cmd, err } = parseErrorPayload(frame.payload);
      throw new Error(`Device error (cmd=${cmd}, err=${err})`);
    }
  }
}
