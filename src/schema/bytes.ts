export function readU16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

export function readU32Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

export function writeU16Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

export function writeU32Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

export function readF32Le(bytes: Uint8Array, offset: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getFloat32(offset, true);
}

export function writeF32Le(bytes: Uint8Array, offset: number, value: number) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  dv.setFloat32(offset, value, true);
}

export function decodeNullTerminatedAscii(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.slice(0, end) : bytes;
  return new TextDecoder('ascii', { fatal: false }).decode(slice);
}

export function encodeNullTerminatedAscii(value: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  const encoded = new TextEncoder().encode(value);
  out.set(encoded.slice(0, Math.max(0, length - 1)));
  out[Math.max(0, Math.min(length - 1, encoded.length))] = 0;
  return out;
}

