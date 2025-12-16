import {
  ORCA_CONFIG_PROTO_MAGIC,
  ORCA_CONFIG_PROTO_VERSION,
  OrcaCmd,
  OrcaErr,
  OrcaMsgType,
} from '@shared/orca_config_idl_generated';
import { crc32c } from './crc32c';

export type OrcaFrame = {
  msgType: number;
  seq: number;
  payload: Uint8Array;
};

export function encodeFrame(msgType: number, seq: number, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(16);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, ORCA_CONFIG_PROTO_MAGIC, true);
  dv.setUint8(4, ORCA_CONFIG_PROTO_VERSION);
  dv.setUint8(5, msgType);
  dv.setUint16(6, payload.length, true);
  dv.setUint32(8, seq, true);
  dv.setUint32(12, 0, true);
  const crc = crc32c([header, payload]);
  dv.setUint32(12, crc, true);
  const out = new Uint8Array(header.length + payload.length);
  out.set(header, 0);
  out.set(payload, header.length);
  return out;
}

export function tryDecodeFrameFromBuffer(buffer: Uint8Array): { frame: OrcaFrame; remaining: Uint8Array } | null {
  if (buffer.length < 16) return null;
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = dv.getUint32(0, true);
  const protoVer = dv.getUint8(4);
  const msgType = dv.getUint8(5);
  const payloadLen = dv.getUint16(6, true);
  const seq = dv.getUint32(8, true);
  const crc = dv.getUint32(12, true);
  if (magic !== ORCA_CONFIG_PROTO_MAGIC) throw new Error('Bad magic');
  if (protoVer !== ORCA_CONFIG_PROTO_VERSION) throw new Error('Bad protocol version');

  const totalLen = 16 + payloadLen;
  if (buffer.length < totalLen) return null;

  const header = buffer.slice(0, 16);
  const headerDv = new DataView(header.buffer, header.byteOffset, header.byteLength);
  headerDv.setUint32(12, 0, true);
  const payload = buffer.slice(16, totalLen);
  const expected = crc32c([header, payload]);
  if (crc !== expected) throw new Error('Bad CRC32C');

  const remaining = buffer.slice(totalLen);
  return { frame: { msgType, seq, payload }, remaining };
}

export function encodeGetInfoRequest(seq: number): Uint8Array {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.GET_INFO]));
}

export function encodeReadBlobRequest(seq: number, offset: number, length: number): Uint8Array {
  const payload = new Uint8Array(12);
  payload[0] = OrcaCmd.READ_BLOB;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, offset >>> 0, true);
  dv.setUint32(8, length >>> 0, true);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload);
}

export function parseErrorPayload(payload: Uint8Array): { cmd: number; err: number } {
  return { cmd: payload[0] ?? 0, err: payload[1] ?? OrcaErr.INTERNAL_ERROR };
}

