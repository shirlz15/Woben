/**
 * FORENSIGHT — Icon Generator
 * Generates PNG icons for the Chrome extension.
 * Run with: node scripts/generate-icons.mjs
 */
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const tb = Buffer.from(type);
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const combined = Buffer.concat([tb, data]);
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(combined));
  return Buffer.concat([lb, combined, cb]);
}

// Simple "F" letter bitmap (relative coordinates for any size)
function isLetterF(x, y, size) {
  const s = size;
  const pad = Math.round(s * 0.22);
  const thick = Math.max(2, Math.round(s * 0.16));
  const inner = s - pad * 2;
  const rx = x - pad, ry = y - pad;
  if (rx < 0 || ry < 0 || rx >= inner || ry >= inner) return false;
  // Vertical bar (left)
  if (rx < thick && ry >= 0 && ry < inner) return true;
  // Top horizontal bar
  if (ry < thick && rx >= 0 && rx < inner) return true;
  // Middle horizontal bar
  const midY = Math.round(inner * 0.45);
  if (ry >= midY && ry < midY + thick && rx >= 0 && rx < inner * 0.75) return true;
  return false;
}

function createIcon(size) {
  const bg = [17, 21, 32];      // #111520
  const fg = [59, 130, 246];    // #3b82f6
  const border = [42, 51, 80];  // #2a3350

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9); // RGBA

  const raw = Buffer.alloc(size * (1 + size * 4));
  const rad = Math.round(size * 0.15);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const off = rowStart + 1 + x * 4;
      // Rounded corner check
      const inCorner = (
        (x < rad && y < rad && (rad - x) ** 2 + (rad - y) ** 2 > rad ** 2) ||
        (x >= size - rad && y < rad && (x - size + rad + 1) ** 2 + (rad - y) ** 2 > rad ** 2) ||
        (x < rad && y >= size - rad && (rad - x) ** 2 + (y - size + rad + 1) ** 2 > rad ** 2) ||
        (x >= size - rad && y >= size - rad && (x - size + rad + 1) ** 2 + (y - size + rad + 1) ** 2 > rad ** 2)
      );
      if (inCorner) {
        raw[off] = 0; raw[off+1] = 0; raw[off+2] = 0; raw[off+3] = 0;
      } else if (x === 0 || x === size - 1 || y === 0 || y === size - 1) {
        raw[off] = border[0]; raw[off+1] = border[1]; raw[off+2] = border[2]; raw[off+3] = 255;
      } else if (isLetterF(x, y, size)) {
        raw[off] = fg[0]; raw[off+1] = fg[1]; raw[off+2] = fg[2]; raw[off+3] = 255;
      } else {
        raw[off] = bg[0]; raw[off+1] = bg[1]; raw[off+2] = bg[2]; raw[off+3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.resolve('extension/assets');
fs.mkdirSync(outDir, { recursive: true });

[16, 32, 48, 128].forEach(size => {
  const png = createIcon(size);
  const filePath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
});

console.log('Icons generated successfully.');
