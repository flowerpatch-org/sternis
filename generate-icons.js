// One-time script to generate app icons as PNGs.
// Run with: node generate-icons.js
// Outputs: public/icons/icon-192.png and public/icons/icon-512.png

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPNG(size) {
  // Draw a dark background (#0d1117) with a gold star (⭐) approximated as a polygon

  const bg = { r: 0x0d, g: 0x11, b: 0x17 };
  const starColor = { r: 0xf0, g: 0xc0, b: 0x40 };

  // Create RGBA pixel buffer
  const pixels = new Uint8Array(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = bg.r;
    pixels[i * 4 + 1] = bg.g;
    pixels[i * 4 + 2] = bg.b;
    pixels[i * 4 + 3] = 255;
  }

  // Draw a 5-pointed star centered in the image
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = outerR * 0.4;
  const points = 5;

  // Build star polygon points
  const starPts = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    starPts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }

  // Rasterise: for each pixel, test if inside star polygon (ray casting)
  function inStar(px, py) {
    let inside = false;
    const n = starPts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = starPts[i].x, yi = starPts[i].y;
      const xj = starPts[j].x, yj = starPts[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inStar(x + 0.5, y + 0.5)) {
        const idx = (y * size + x) * 4;
        pixels[idx + 0] = starColor.r;
        pixels[idx + 1] = starColor.g;
        pixels[idx + 2] = starColor.b;
        pixels[idx + 3] = 255;
      }
    }
  }

  // Encode as PNG
  return encodePNG(pixels, size, size);
}

function encodePNG(pixels, width, height) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll write RGBA as RGBA color type 6)
  // Redo: use color type 6 (RGBA)
  ihdr[9] = 6;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter byte per scanline
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeB, data]);
    const crc = crc32(body);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, body, crcB]);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32 implementation
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const outDir = path.join(__dirname, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = createPNG(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Written ${outPath} (${png.length} bytes)`);
}
