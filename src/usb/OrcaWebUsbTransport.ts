import { ORCA_CONFIG_SETTINGS_BLOB_SIZE } from '@shared/orca_config_idl_generated';
import {
  encodeGetInfoRequest,
  encodeReadBlobRequest,
  parseErrorPayload,
  tryDecodeFrameFromBuffer,
} from '../protocol/orcaProtocol';

type DeviceInfo = {
  schemaId: number;
  settingsMajor: number;
  settingsMinor: number;
  blobSize: number;
  maxChunk: number;
};

function readU32Le(payload: Uint8Array, offset: number): number {
  return (
    payload[offset]! |
    (payload[offset + 1]! << 8) |
    (payload[offset + 2]! << 16) |
    (payload[offset + 3]! << 24)
  ) >>> 0;
}

export class OrcaWebUsbTransport {
  private constructor(
    private device: USBDevice,
    private readonly interfaceNumber: number,
    private readonly inEndpoint: number,
    private readonly outEndpoint: number,
  ) {}

  private rx = new Uint8Array(0);
  private seq = 1;

  static async requestAndOpen(): Promise<OrcaWebUsbTransport> {
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0xcafe, productId: 0x4010 }],
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
      this.rx = new Uint8Array(0);
    }
  }

  private async write(buf: Uint8Array): Promise<void> {
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
    const chunk = new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength);
    const merged = new Uint8Array(this.rx.length + chunk.length);
    merged.set(this.rx, 0);
    merged.set(chunk, this.rx.length);
    this.rx = merged;
  }

  private async readFrame(): Promise<{ msgType: number; seq: number; payload: Uint8Array }> {
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

    if (frame.msgType === 3) {
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

  async readBlobChunk(offset: number, length: number): Promise<Uint8Array> {
    const seq = this.seq++;
    await this.write(encodeReadBlobRequest(seq, offset, length));
    const frame = await this.readFrame();

    if (frame.msgType === 3) {
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
}

