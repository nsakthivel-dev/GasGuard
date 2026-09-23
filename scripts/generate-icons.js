import fs from 'fs';
import zlib from 'zlib';

function createPNG(size, primaryColor, accentColor) {
  // Simple PNG encoder in pure Node.js
  const width = size;
  const height = size;

  // Raw RGBA buffer
  // Each line has 1 filter byte (0) + width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded squircle background
      const isInShield = dist <= radius;
      // Flame / warning shape in center
      const inFlame = (Math.abs(dx) < (radius * 0.45) * (1 - (y - (cy - radius * 0.5)) / (radius * 1.3)) &&
                       y > cy - radius * 0.5 && y < cy + radius * 0.6);

      if (isInShield) {
        if (inFlame) {
          // Flame amber/orange
          rawData[pxOffset] = 245;     // R
          rawData[pxOffset + 1] = 158; // G
          rawData[pxOffset + 2] = 11;  // B
          rawData[pxOffset + 3] = 255; // A
        } else {
          // Dark slate background
          rawData[pxOffset] = 15;      // R
          rawData[pxOffset + 1] = 23;  // G
          rawData[pxOffset + 2] = 42;  // B
          rawData[pxOffset + 3] = 255; // A
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // Deflate image data
  const compressed = zlib.deflateSync(rawData);

  // Helper to write chunk
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = crc32(toCrc);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c >>> 0;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const p192 = createPNG(192);
fs.writeFileSync('./public/gas-icon-192.png', p192);
const p512 = createPNG(512);
fs.writeFileSync('./public/gas-icon-512.png', p512);
fs.writeFileSync('./public/apple-touch-icon.png', p192);
console.log('Icons successfully generated!');
