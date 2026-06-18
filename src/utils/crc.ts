/**
 * CRC32 checksum for data integrity verification.
 * Uses the standard CRC-32 polynomial 0xEDB88320.
 */

const CRC32_TABLE: number[] = (() => {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
})();

export function crc32(str: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i) & 0xff;
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  return crc.toString(16).toUpperCase().padStart(8, '0');
}

export function verifyChecksum(data: string, expected: string): boolean {
  return crc32(data) === expected;
}

export function computeFileChecksum(chunks: { data: string; index: number }[]): string {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  const combined = ordered.map(c => c.data).join('');
  return crc32(combined);
}
