/* seed/_jpeg.js — a tiny DEPENDENCY-FREE baseline JPEG encoder.
 * The seed script needs real image bytes to upload to Supabase storage, but the
 * sandbox has no native `canvas`/`sharp`. Rather than pull a dependency, we emit a
 * valid 8x8-block baseline JPEG by hand: RGB -> YCbCr -> 8x8 DCT -> quantize ->
 * zigzag -> Huffman (the standard annex-K tables). Output is small, solid-ish
 * placeholder photos with a per-image tint + a marker shape — enough to make the
 * Impact gallery / before-after slider look alive. Not pretty, but 100% offline. */
'use strict';

const ZIG = [0,1,5,6,14,15,27,28,2,4,7,13,16,26,29,42,3,8,12,17,25,30,41,43,9,11,18,24,31,40,44,53,10,19,23,32,39,45,52,54,20,22,33,38,46,51,55,60,21,34,37,47,50,56,59,61,35,36,48,49,57,58,62,63];
const STD_DC_LUM = [0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0];
const STD_DC_CHR = [0,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0];
const STD_AC_LUM = [0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,125];
const STD_AC_CHR = [0,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,119];

function buildHuff(counts, vals) {
  const h = {}; let code = 0, k = 0;
  for (let i = 1; i <= 16; i++) for (let j = 0; j < counts[i]; j++) { h[vals[k++]] = { len: i, code }; code++; if (i < 16) code <<= 1; }
  return h;
}
const DC_LUM = buildHuff(STD_DC_LUM, [0,1,2,3,4,5,6,7,8,9,10,11]);
const DC_CHR = buildHuff(STD_DC_CHR, [0,1,2,3,4,5,6,7,8,9,10,11]);
const AC_LUM = buildHuff(STD_AC_LUM, [0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa]);
const AC_CHR = buildHuff(STD_AC_CHR, [0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa]);

const C = [16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];

function fdct(b) {
  const o = new Array(64);
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
    let s = 0;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) s += b[x * 8 + y] * Math.cos((2 * x + 1) * u * Math.PI / 16) * Math.cos((2 * y + 1) * v * Math.PI / 16);
    o[u * 8 + v] = 0.25 * (u ? 1 : 1 / Math.SQRT2) * (v ? 1 : 1 / Math.SQRT2) * s;
  }
  return o;
}
function catBits(v) { let a = v < 0 ? -v : v; let c = 0; while (a) { c++; a >>= 1; } return c; }

class BW {
  constructor() { this.b = []; this.bb = 0; this.bn = 0; }
  w(v, n) { for (let i = n - 1; i >= 0; i--) { this.bb = (this.bb << 1) | ((v >> i) & 1); this.bn++; if (this.bn === 8) { this.b.push(this.bb); if (this.bb === 0xff) this.b.push(0); this.bb = 0; this.bn = 0; } } }
  wh(v) { this.b.push((v >> 8) & 255, v & 255); }
  enc(v, t) { this.w(v.code, v.len); if (t) { let val = v < 0 ? v - 1 : v; let a = t < 0 ? -t : t; this.w(a ? (val & ((1 << t) - 1)) : 0, t); } }
  done() { if (this.bn) this.w((1 << (8 - this.bn)) - 1, 8 - this.bn); return Buffer.from(this.b); }
}

function encBlock(bw, blk, prev, dcT, acT, qt) {
  const d = fdct(blk);
  for (let i = 0; i < 64; i++) d[i] = Math.round(d[i] / qt[i]);
  const z = new Array(64); for (let i = 0; i < 64; i++) z[i] = d[ZIG[i]];
  let diff = z[0] - prev, t = catBits(diff); bw.enc(dcT[t], t);
  let run = 0;
  for (let i = 1; i < 64; i++) { if (z[i] === 0) run++; else { while (run > 15) { bw.enc(acT[0xf0], 0); run -= 16; } t = catBits(z[i]); bw.enc(acT[(run << 4) | t], t); bw.enc(z[i], t); run = 0; } }
  if (run) bw.enc(acT[0x00], 0);
  return z[0];
}

function hts(name, dc, ac) {
  const out = [4, name]; const counts = [name];
  for (let i = 1; i <= 16; i++) counts.push(dc[i]); for (let i = 0; i < 12; i++) counts.push(0);
  for (let i = 1; i <= 16; i++) counts.push(ac[i]); for (let i = 0; i < 12; i++) counts.push(0);
  const vs = []; for (let i = 0; i < dc.length; i++) vs.push(dc[i]); for (let i = 0; i < ac.length; i++) vs.push(ac[i]);
  return Buffer.from([0xff, 0xc4, 0, 3 + counts.length + vs.length, ...counts, ...vs]);
}

// rgb: Uint8Array length W*H*3. Returns a JPEG Buffer.
function encode(rgb, W, H) {
  const bw = new BW();
  const QT = C.map((q) => Math.max(1, Math.min(255, q)));
  const blocksW = Math.ceil(W / 8), blocksH = Math.ceil(H / 8);
  let dcY = 0, dcCb = 0, dcCr = 0;
  for (let by = 0; by < blocksH; by++) for (let bx = 0; bx < blocksW; bx++) {
    const yb = new Array(64), cb = new Array(64), cr = new Array(64);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const px = Math.min(W - 1, bx * 8 + i), py = Math.min(H - 1, by * 8 + j);
      const p = (py * W + px) * 3, R = rgb[p], G = rgb[p + 1], B = rgb[p + 2];
      yb[j * 8 + i] = 0.299 * R + 0.587 * G + 0.114 * B - 128;
      cb[j * 8 + i] = -0.1687 * R - 0.3313 * G + 0.5 * B;
      cr[j * 8 + i] = 0.5 * R - 0.4187 * G - 0.0813 * B;
    }
    dcY = encBlock(bw, yb, dcY, DC_LUM, AC_LUM, QT);
    dcCb = encBlock(bw, cb, dcCb, DC_CHR, AC_CHR, QT);
    dcCr = encBlock(bw, cr, dcCr, DC_CHR, AC_CHR, QT);
  }
  const scan = bw.done();
  const parts = [Buffer.from([0xff, 0xd8])]; // SOI
  // DQT
  const dqt = [0xff, 0x42, 0, 67, 0, ...QT];
  parts.push(Buffer.from(dqt));
  // SOF0
  const sof = [0xff, 0xc0, 0, 17, 8, (H >> 8) & 255, H & 255, (W >> 8) & 255, W & 255, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1];
  parts.push(Buffer.from(sof));
  parts.push(hts(0, STD_DC_LUM, STD_AC_LUM));
  parts.push(hts(1, STD_DC_CHR, STD_AC_CHR));
  // SOS
  parts.push(Buffer.from([0xff, 0xda, 0, 12, 3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]));
  parts.push(scan);
  parts.push(Buffer.from([0xff, 0xd9])); // EOI
  return Buffer.concat(parts);
}

module.exports = { encode };
