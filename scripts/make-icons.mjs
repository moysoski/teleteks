#!/usr/bin/env node
// Generates the app icons (SVG + PNG) from one 16x16 pixel design. Run once after changing the design.
import {writeFile, mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

const OUT = new URL('../icons/', import.meta.url);
const COLORS = {'.': [0, 0, 0], Y: [255, 255, 0], R: [255, 0, 0], G: [0, 255, 0], C: [0, 255, 255], B: [0, 0, 255]};

// Content stays inside the maskable safe zone (centre 10x10)
const DESIGN = [
  '................',
  '................',
  '................',
  '...YYYYYYYYYY...',
  '...YYYYYYYYYY...',
  '.......YY.......',
  '.......YY.......',
  '.......YY.......',
  '.......YY.......',
  '.......YY.......',
  '................',
  '...RRGGYYCCBB...',
  '...RRGGYYCCBB...',
  '................',
  '................',
  '................'
];

function svg() {
  let rects = '';
  DESIGN.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${COLORS[ch]})"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#000"/>${rects}</svg>\n`;
}

const CRC = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const scale = size / 16, raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const rgb = COLORS[DESIGN[Math.floor(y / scale)][Math.floor(x / scale)]];
      rgb.forEach((v, i) => { raw[y * (size * 3 + 1) + 1 + x * 3 + i] = v; });
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

await mkdir(OUT, {recursive: true});
await writeFile(new URL('icon.svg', OUT), svg());
for (const size of [180, 192, 512]) await writeFile(new URL(`icon-${size}.png`, OUT), png(size));
console.log('icons written');
