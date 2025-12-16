const CRC32C_POLY_REFLECTED = 0x82f63b78;

let table: Uint32Array | null = null;

function getTable(): Uint32Array {
  if (table) return table;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? CRC32C_POLY_REFLECTED : 0);
    }
    t[i] = crc >>> 0;
  }
  table = t;
  return t;
}

export function crc32c(chunks: Uint8Array[]): number {
  const t = getTable();
  let crc = 0xffffffff;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const idx = (crc ^ chunk[i]!) & 0xff;
      crc = (crc >>> 8) ^ t[idx]!;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

