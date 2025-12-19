import {
  ORCA_CONFIG_PROTO_MAGIC,
  ORCA_CONFIG_PROTO_VERSION,
  OrcaCmd,
  OrcaErr,
  OrcaMsgType,
} from '@shared/orca_config_idl_generated';
import { crc32c } from './crc32c';

export type ByteArray = Uint8Array<ArrayBufferLike>;

export type OrcaFrame = {
  msgType: number;
  seq: number;
  payload: ByteArray;
};

export function encodeFrame(msgType: number, seq: number, payload: ByteArray): ByteArray {
  const header = new Uint8Array(16) as ByteArray;
  const dv = new DataView(header.buffer);
  dv.setUint32(0, ORCA_CONFIG_PROTO_MAGIC, true);
  dv.setUint8(4, ORCA_CONFIG_PROTO_VERSION);
  dv.setUint8(5, msgType);
  dv.setUint16(6, payload.length, true);
  dv.setUint32(8, seq, true);
  dv.setUint32(12, 0, true);
  const crc = crc32c([header, payload]);
  dv.setUint32(12, crc, true);
  const out = new Uint8Array(header.length + payload.length) as ByteArray;
  out.set(header, 0);
  out.set(payload, header.length);
  return out;
}

export function tryDecodeFrameFromBuffer(buffer: ByteArray): { frame: OrcaFrame; remaining: ByteArray } | null {
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

  const header = buffer.slice(0, 16) as ByteArray;
  const headerDv = new DataView(header.buffer, header.byteOffset, header.byteLength);
  headerDv.setUint32(12, 0, true);
  const payload = buffer.slice(16, totalLen) as ByteArray;
  const expected = crc32c([header, payload]);
  if (crc !== expected) throw new Error('Bad CRC32C');

  const remaining = buffer.slice(totalLen) as ByteArray;
  return { frame: { msgType, seq, payload }, remaining };
}

export function encodeGetInfoRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.GET_INFO]) as ByteArray);
}

export function encodeBeginSessionRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.BEGIN_SESSION]) as ByteArray);
}

export function encodeUnlockWritesRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.UNLOCK_WRITES]) as ByteArray);
}

export function encodeReadBlobRequest(seq: number, offset: number, length: number): ByteArray {
  const payload = new Uint8Array(12);
  payload[0] = OrcaCmd.READ_BLOB;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, offset >>> 0, true);
  dv.setUint32(8, length >>> 0, true);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeReadBlobSlotRequest(seq: number, slotId: number, offset: number, length: number): ByteArray {
  const payload = new Uint8Array(12);
  payload[0] = OrcaCmd.READ_BLOB_SLOT;
  payload[1] = slotId & 0xff;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, offset >>> 0, true);
  dv.setUint32(8, length >>> 0, true);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeWriteBlobBeginRequest(seq: number, totalSize: number): ByteArray {
  const payload = new Uint8Array(8);
  payload[0] = OrcaCmd.WRITE_BLOB_BEGIN;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, totalSize >>> 0, true);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeWriteBlobBeginSlotRequest(seq: number, slotId: number, totalSize: number): ByteArray {
  const payload = new Uint8Array(8);
  payload[0] = OrcaCmd.WRITE_BLOB_BEGIN_SLOT;
  payload[1] = slotId & 0xff;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, totalSize >>> 0, true);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeWriteBlobChunkRequest(seq: number, offset: number, data: Uint8Array): ByteArray {
  const payload = new Uint8Array(12 + data.length);
  payload[0] = OrcaCmd.WRITE_BLOB_CHUNK;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, offset >>> 0, true);
  dv.setUint32(8, data.length >>> 0, true);
  payload.set(data, 12);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeWriteBlobChunkSlotRequest(seq: number, slotId: number, offset: number, data: Uint8Array): ByteArray {
  const payload = new Uint8Array(12 + data.length);
  payload[0] = OrcaCmd.WRITE_BLOB_CHUNK_SLOT;
  payload[1] = slotId & 0xff;
  const dv = new DataView(payload.buffer);
  dv.setUint32(4, offset >>> 0, true);
  dv.setUint32(8, data.length >>> 0, true);
  payload.set(data, 12);
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeWriteBlobEndRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.WRITE_BLOB_END]) as ByteArray);
}

export function encodeWriteBlobEndSlotRequest(seq: number, slotId: number): ByteArray {
  const payload = new Uint8Array(4);
  payload[0] = OrcaCmd.WRITE_BLOB_END_SLOT;
  payload[1] = slotId & 0xff;
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeValidateStagedRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.VALIDATE_STAGED]) as ByteArray);
}

export function encodeValidateStagedSlotRequest(seq: number, slotId: number): ByteArray {
  const payload = new Uint8Array(4);
  payload[0] = OrcaCmd.VALIDATE_STAGED_SLOT;
  payload[1] = slotId & 0xff;
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeCommitStagedRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.COMMIT_STAGED]) as ByteArray);
}

export function encodeCommitStagedSlotRequest(seq: number, slotId: number): ByteArray {
  const payload = new Uint8Array(4);
  payload[0] = OrcaCmd.COMMIT_STAGED_SLOT;
  payload[1] = slotId & 0xff;
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeResetDefaultsRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.RESET_DEFAULTS]) as ByteArray);
}

export function encodeResetDefaultsSlotRequest(seq: number, slotId: number): ByteArray {
  const payload = new Uint8Array(4);
  payload[0] = OrcaCmd.RESET_DEFAULTS_SLOT;
  payload[1] = slotId & 0xff;
  return encodeFrame(OrcaMsgType.REQUEST, seq, payload as ByteArray);
}

export function encodeFactoryResetRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.FACTORY_RESET]) as ByteArray);
}

export function encodeRebootRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.REBOOT]) as ByteArray);
}

export function encodeGetInputStateRequest(seq: number): ByteArray {
  return encodeFrame(OrcaMsgType.REQUEST, seq, new Uint8Array([OrcaCmd.GET_INPUT_STATE]) as ByteArray);
}

export function parseErrorPayload(payload: Uint8Array): { cmd: number; err: number } {
  return { cmd: payload[0] ?? 0, err: payload[1] ?? OrcaErr.INTERNAL_ERROR };
}
