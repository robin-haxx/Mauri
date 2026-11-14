#!/usr/bin/env node
// ============================================================================
// trace_map.js: turns the journey map's raster (sprites/journey_map.png) into a vector one
// (sprites/journey_map.svg) that keeps every coastline, lake and ridge where the raster has it.
// ============================================================================
//   node tools/trace_map.js                       writes sprites/journey_map.svg
//   node tools/trace_map.js --debug <dir>         also writes the kinds it found, as PNGs
//   node tools/trace_map.js --probe x,y x,y ...   prints the raster's colour at points
//
// How it works. Each kind of ground (sea, shelf, land, alpine rock, lake, river) is a few
// colours in the raster. Every pixel is explained as a blend of two of those colours, which
// gives it a membership of each kind (1 inside a kind, 0.5 on the soft edge between two). The
// membership fields are upsampled (bicubic), blurred a touch, and their 0.5 line is traced
// with marching squares, so an outline runs between pixels where the colour changes, not on
// the pixel grid. Outlines are thinned (Ramer-Douglas-Peucker) and drawn as smooth curves
// (Catmull-Rom, written as cubic Béziers).
//
// The land's relief is traced the same way from the raster's own shading: its light and dark
// are cut into a few bands, so the vector's ridges are the raster's ridges. Every fill colour
// is the raster's own average for that kind or band, so the palette matches too.
//
// The SVG keeps the raster's size as its viewBox (205 × 156), so CAMPAIGN.MAP's measurements
// (x0, y0, pitch) hold for it unchanged.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'sprites/journey_map.png');
const OUT = path.join(ROOT, 'sprites/journey_map.svg');
const U = 4;              // upsampling before tracing: the outlines' sub-pixel precision
const SVG_SCALE = 4;      // the SVG's width/height attributes, as a multiple of the viewBox

// ---- PNG reading (8-bit RGB / RGBA / grey / palette, not interlaced) ---------------------
function readPNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0, palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; inter = data[12]; }
    else if (type === 'PLTE') palette = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || inter) throw new Error(`unsupported PNG (depth ${depth}, interlace ${inter})`);
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * chans, out = new Uint8Array(w * h * chans);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= chans ? cur[i - chans] : 0, b = prev[i], c = i >= chans ? prev[i - chans] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    out.set(cur, y * stride); prev = cur;
  }
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    let r, g, b;
    if (ctype === 2 || ctype === 6) { r = out[i * chans]; g = out[i * chans + 1]; b = out[i * chans + 2]; }
    else if (ctype === 3) { const k = out[i]; r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2]; }
    else { r = g = b = out[i * chans]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  return { w, h, rgb };
}

// ---- PNG writing (the --debug views) -------------------------------------------------------
function writePNG(file, w, h, rgb /* Uint8Array, w*h*3 */) {
  const crcT = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; }
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4), cb = Buffer.alloc(4);
    len.writeUInt32BE(data.length); cb.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, cb]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---- The kinds of ground, by the colours the raster paints them -------------------------
// Each kind lists a few of its colours (sampled from the raster). A pixel is explained as a
// blend of two of them (any two, so both the soft edge between kinds and the shading within
// one are covered); the blend's weights are its membership of each kind. A blend of two KINDS
// costs a little more than a blend within one, so a mid-shade of land stays land.
const KINDS = ['sea', 'shelf', 'land', 'alpine', 'lake', 'river'];
const PROTOS = {
  sea:    [[222, 235, 251], [212, 226, 240], [230, 238, 250], [204, 224, 240]],
  shelf:  [[91, 137, 116], [89, 138, 126], [87, 131, 111], [98, 143, 124], [80, 126, 108]],
  land:   [[226, 209, 131], [175, 173, 107], [128, 140, 82], [184, 192, 150], [249, 246, 195],
           [199, 216, 174], [210, 207, 150], [165, 149, 84], [225, 197, 119], [150, 150, 80],
           [110, 125, 70], [240, 228, 160], [96, 112, 60],
           [224, 233, 203], [214, 226, 196], [236, 240, 214]],   // the last three: the pale ring round a lake
  alpine: [[172, 174, 189], [134, 134, 138], [158, 167, 171], [186, 183, 198], [148, 145, 150]],
  lake:   [[41, 91, 145], [34, 87, 142], [52, 98, 152]],
  river:  [[100, 108, 186], [112, 124, 172]]
};
const CROSS_COST = 10;   // in RGB distance: what a blend of two kinds pays over a blend within one

function memberships(img) {
  const { w, h, rgb } = img, P = [];
  KINDS.forEach((k, ki) => PROTOS[k].forEach(c => P.push({ c, k: ki })));
  const M = KINDS.map(() => new Float32Array(w * h));
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    let best = 1e18, bp = 0, bq = 0, bt = 1;
    for (let p = 0; p < P.length; p++) for (let q = p; q < P.length; q++) {
      const A = P[p].c, B = P[q].c;
      const dx = A[0] - B[0], dy = A[1] - B[1], dz = A[2] - B[2], dd = dx * dx + dy * dy + dz * dz;
      let t = dd ? ((r - B[0]) * dx + (g - B[1]) * dy + (b - B[2]) * dz) / dd : 1;
      t = Math.max(0, Math.min(1, t));
      const ex = r - (B[0] + t * dx), ey = g - (B[1] + t * dy), ez = b - (B[2] + t * dz);
      let e = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (P[p].k !== P[q].k) e += CROSS_COST;
      if (e < best) { best = e; bp = p; bq = q; bt = t; }
    }
    M[P[bp].k][i] += bt; M[P[bq].k][i] += 1 - bt;
  }
  return M;
}

// ---- Fields: bicubic upsampling and blurring ---------------------------------------------
function upsample(F, w, h) {
  const W = w * U, H = h * U, out = new Float32Array(W * H);
  const cr = (t) => { t = Math.abs(t); return t < 1 ? 1.5 * t * t * t - 2.5 * t * t + 1 : t < 2 ? -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2 : 0; };
  const at = (x, y) => F[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let Y = 0; Y < H; Y++) {
    const sy = (Y + 0.5) / U - 0.5, y0 = Math.floor(sy), fy = sy - y0;
    const wy = [cr(1 + fy), cr(fy), cr(1 - fy), cr(2 - fy)];
    for (let X = 0; X < W; X++) {
      const sx = (X + 0.5) / U - 0.5, x0 = Math.floor(sx), fx = sx - x0;
      const wx = [cr(1 + fx), cr(fx), cr(1 - fx), cr(2 - fx)];
      let v = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) v += wy[j] * wx[i] * at(x0 - 1 + i, y0 - 1 + j);
      out[Y * W + X] = v;
    }
  }
  return out;
}

function blur(F, W, H, sigma) {
  if (sigma <= 0) return F.slice();
  const R = Math.ceil(sigma * 3), k = [];
  let sum = 0;
  for (let i = -R; i <= R; i++) { const v = Math.exp(-i * i / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0; for (let i = -R; i <= R; i++) v += k[i + R] * F[y * W + Math.max(0, Math.min(W - 1, x + i))];
    tmp[y * W + x] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0; for (let i = -R; i <= R; i++) v += k[i + R] * tmp[Math.max(0, Math.min(H - 1, y + i)) * W + x];
    out[y * W + x] = v;
  }
  return out;
}

// ---- Contours: marching squares, joined into closed rings --------------------------------
// The field is padded (a ring copying its edge, then a ring of "outside"), so every contour
// closes; the closing part lies just beyond the picture's edge. Points come back in the
// raster's pixel units (the SVG's viewBox).
function contours(F, W, H, level) {
  const PW = W + 4, PH = H + 4, G = new Float32Array(PW * PH).fill(-1e9);
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    G[(y + 2) * PW + (x + 2)] = F[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] - level;
  }
  const v = (x, y) => G[y * PW + x];
  // A crossing on the edge (x,y)→(x+1,y) [key 2i] or (x,y)→(x,y+1) [key 2i+1].
  const pt = new Map(), link = new Map();
  const cross = (x, y, vert) => {
    const key = 2 * (y * PW + x) + (vert ? 1 : 0);
    if (!pt.has(key)) {
      const a = v(x, y), b = vert ? v(x, y + 1) : v(x + 1, y);
      const t = a < -1e8 ? 0.999 : b < -1e8 ? 0.001 : a / (a - b);
      pt.set(key, vert ? [x, y + t] : [x + t, y]);
    }
    return key;
  };
  const join = (a, b) => {
    if (!link.has(a)) link.set(a, []);
    if (!link.has(b)) link.set(b, []);
    link.get(a).push(b); link.get(b).push(a);
  };
  for (let y = 0; y < PH - 1; y++) for (let x = 0; x < PW - 1; x++) {
    const a = v(x, y) > 0, b = v(x + 1, y) > 0, c = v(x + 1, y + 1) > 0, d = v(x, y + 1) > 0;
    const idx = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = () => cross(x, y, false), R = () => cross(x + 1, y, true), B = () => cross(x, y + 1, false), L = () => cross(x, y, true);
    switch (idx) {
      case 1: case 14: join(L(), T()); break;
      case 2: case 13: join(T(), R()); break;
      case 3: case 12: join(L(), R()); break;
      case 4: case 11: join(R(), B()); break;
      case 6: case 9:  join(T(), B()); break;
      case 7: case 8:  join(L(), B()); break;
      case 5: case 10: {
        const centre = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 > 0;
        if ((idx === 5) === centre) { join(L(), B()); join(T(), R()); }
        else { join(L(), T()); join(R(), B()); }
        break;
      }
    }
  }
  const rings = [], seen = new Set();
  for (const start of link.keys()) {
    if (seen.has(start)) continue;
    const ring = [];
    let prev = -1, cur = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); ring.push(pt.get(cur));
      const n = link.get(cur), next = n[0] !== prev ? n[0] : n[1];
      prev = cur; cur = next;
    }
    // Grid → the raster's pixel units (an upsampled pixel's centre is (x + 0.5) / U).
    rings.push(ring.map(([x, y]) => [(x - 1.5) / U, (y - 1.5) / U]));
  }
  return rings;
}

const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyRing(r, eps) {
  // Split the ring at the point farthest from its start, so RDP has two fixed ends.
  let far = 0, fd = 0;
  for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > fd) { fd = d; far = i; } }
  const a = rdp(r.slice(0, far + 1), eps), b = rdp(r.slice(far).concat([r[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

// A closed ring as smooth curves: Catmull-Rom through its points, written as cubic Béziers.
const n2 = (x) => (Math.round(x * 100) / 100).toString();
function ringPath(r) {
  const n = r.length, P = (i) => r[(i + n) % n];
  let d = `M${n2(r[0][0])} ${n2(r[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${n2(p1[0] + (p2[0] - p0[0]) / 6)} ${n2(p1[1] + (p2[1] - p0[1]) / 6)} ${n2(p2[0] - (p3[0] - p1[0]) / 6)} ${n2(p2[1] - (p3[1] - p1[1]) / 6)} ${n2(p2[0])} ${n2(p2[1])}`;
  }
  return d + 'Z';
}
// A river as one line down its middle: the longest path through its pixels (two breadth-first
// searches), each step pulled to the blueness-weighted centre round it, then smoothed.
function riverLine(members, bness, w, h) {
  const set = new Set(members);
  const bfs = (from) => {
    const prev = new Map([[from, -1]]), q = [from]; let last = from;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % w, y = (i - x) / w; last = i;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (y + dy) * w + (x + dx);
        if ((dx || dy) && x + dx >= 0 && x + dx < w && set.has(j) && !prev.has(j)) { prev.set(j, i); q.push(j); }
      }
    }
    return { last, prev };
  };
  const a = bfs(members[0]).last, { last: b, prev } = bfs(a);
  const chain = []; for (let i = b; i !== -1; i = prev.get(i)) chain.push(i);
  if (chain.length < 4) return null;
  let pts = chain.map(i => {
    const x = i % w, y = (i - x) / w; let sx = 0, sy = 0, sw = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const v = Math.max(0, bness[Y * w + X] - 30); sx += v * (X + 0.5); sy += v * (Y + 0.5); sw += v;
    }
    return sw ? [sx / sw, sy / sw] : [x + 0.5, y + 0.5];
  });
  for (let pass = 0; pass < 1; pass++) pts = pts.map((p, i) => i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4]);
  // An end at the picture's edge runs on past it.
  for (const [e, n] of [[0, 1], [pts.length - 1, pts.length - 2]]) {
    const p = pts[e]; if (p[0] < 2 || p[1] < 2 || p[0] > w - 2 || p[1] > h - 2) { const d = [p[0] - pts[n][0], p[1] - pts[n][1]], L = Math.hypot(...d) || 1; pts[e] = [p[0] + d[0] / L * 3, p[1] + d[1] / L * 3]; }
  }
  return openPath(rdp(pts, 0.12));
}

// An open line as smooth curves (Catmull-Rom, its ends held).
function openPath(pts) {
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${n2(p1[0] + (p2[0] - p0[0]) / 6)} ${n2(p1[1] + (p2[1] - p0[1]) / 6)} ${n2(p2[0] - (p3[0] - p1[0]) / 6)} ${n2(p2[1] - (p3[1] - p1[1]) / 6)} ${n2(p2[0])} ${n2(p2[1])}`;
  }
  return d;
}

// An open line as a filled band, w0 wide at its start and wTip at its end (0: a point). The
// line is sampled along its Catmull-Rom curve and offset either side along its normals.
function taperPath(pts, w0, wTip) {
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))], S = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < 10; k++) {
      const t = k / 10, u = 1 - t;
      S.push([0, 1].map(j => u * u * u * p1[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p2[j]));
    }
  }
  S.push(pts[pts.length - 1]);
  const len = [0]; for (let i = 1; i < S.length; i++) len.push(len[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
  const L = len[len.length - 1], left = [], right = [];
  S.forEach((p, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    const t = len[i] / L, half = (wTip + (w0 - wTip) * Math.pow(1 - t, 0.75)) / 2;   // (stays full, then narrows quickly)
    left.push([p[0] - dy / n * half, p[1] + dx / n * half]); right.push([p[0] + dy / n * half, p[1] - dx / n * half]);
  });
  const ring = left.concat(right.reverse());
  return 'M' + ring.map(p => `${n2(p[0])} ${n2(p[1])}`).join('L') + 'Z';
}

// A field's region above `level`, as one path's data (fill it even-odd: lakes are holes).
function regionPath(F, W, H, level, { minArea = 0.5, eps = 0.1 } = {}) {
  return contours(F, W, H, level)
    .filter(r => r.length > 4 && Math.abs(area(r)) >= minArea)
    .map(r => simplifyRing(r, eps)).filter(r => r.length > 2)
    .map(ringPath).join('');
}

module.exports = { readPNG, writePNG, memberships, upsample, blur, contours, regionPath, KINDS };

// ============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const img = readPNG(IN), { w, h, rgb } = img;

  if (args[0] === '--probe') {
    for (const a of args.slice(1)) {
      const [x, y] = a.split(',').map(Number), i = (y * w + x) * 3;
      console.log(a, Math.round(rgb[i]), Math.round(rgb[i + 1]), Math.round(rgb[i + 2]));
    }
    process.exit(0);
  }
  const di = args.indexOf('--debug'), debugDir = di >= 0 ? args[di + 1] : null;

  const M = memberships(img);
  const W = w * U, H = h * U;
  const up = (F, sigma) => blur(upsample(F, w, h), W, H, sigma);
  const K = Object.fromEntries(KINDS.map((k, i) => [k, M[i]]));
  const sum = (...fs) => { const o = new Float32Array(w * h); for (const f of fs) for (let i = 0; i < o.length; i++) o[i] += f[i]; return o; };

  // The sea is all one body, open to the picture's edge. A pale patch closed in by land is the
  // light ring round a lake, so it becomes land.
  {
    const open = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop();
      if (open[i] || K.sea[i] < 0.5) continue;
      open[i] = 1;
      const x = i % w, y = (i - x) / w;
      if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
    }
    // Shut-in sea, and its soft edge one pixel round it.
    const shut = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (K.sea[i] >= 0.5 && !open[i]) shut[i] = 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && shut[Y * w + X] === 1) { near = true; break; }
      }
      if (near && !open[i]) { K.land[i] += K.sea[i]; K.sea[i] = 0; }
    }
  }

  const blurLo = (F, sigma) => blur(F, w, h, sigma);   // at the raster's own size
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const gate = (F, G, a, b) => F.map((v, i) => v * smooth(a, b, G[i]));

  // Cleaning up. The soft edge between the shelf and the sea passes through greys that also
  // read as alpine rock or lake, so a kind only counts where there is a lot of it nearby:
  // alpine rock in its one patch, lakes amid land (rivers are found separately, below).
  const alpineK = gate(K.alpine, blurLo(K.alpine, 3), 0.12, 0.22);
  const landNear = blurLo(sum(K.land, K.alpine, K.lake), 2.5);
  // Water: each blue body is a lake if land rings it, a river if the shelf does. (Rivers are
  // thin blue-violet lines on the shelf, ~2 px wide with pale banks.)
  const bness = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) bness[i] = rgb[i * 3 + 2] - (rgb[i * 3] + rgb[i * 3 + 1]) / 2;
  const lumOf = (j) => 0.3 * rgb[j * 3] + 0.59 * rgb[j * 3 + 1] + 0.11 * rgb[j * 3 + 2];
  const isRiver = new Uint8Array(w * h), riverBodies = [];
  {
    const comp = new Int32Array(w * h).fill(-1);
    for (let s = 0; s < w * h; s++) {
      if (comp[s] >= 0 || bness[s] < 36) continue;
      const members = [], stack = [s]; comp[s] = s;
      let landN = 0, shelfN = 0;
      while (stack.length) {
        const i = stack.pop(); members.push(i);
        const x = i % w, y = (i - x) / w;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const j = Y * w + X;
          if (bness[j] >= 36) { if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && comp[j] < 0) { comp[j] = s; stack.push(j); } }
          else if (lumOf(j) < 195) { landN += K.land[j] + K.alpine[j]; shelfN += K.shelf[j]; }   // (not the pale banks or rings)
        }
      }
      if (shelfN > 0.5 * landN) { for (const i of members) isRiver[i] = 1; riverBodies.push(members); }   // (lakes: under 0.3; rivers: over 0.8)
    }
  }
  const riverZone = blurLo(Float32Array.from(isRiver), 1.0);
  const riverK = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) riverK[i] = smooth(30, 52, bness[i]) * smooth(0.05, 0.2, riverZone[i]) * (1 - smooth(0.6, 0.9, K.sea[i]));
  // Near a river, its pale banks and the odd blue blot are the river's, not land or lake.
  const riverWide = blurLo(Float32Array.from(isRiver), 2.2);
  const offRiver = (F) => F.map((v, i) => v * (1 - smooth(0.04, 0.15, riverWide[i])));
  const lakeK = gate(offRiver(K.lake), landNear, 0.2, 0.35);
  const landK = gate(offRiver(K.land), blurLo(K.land, 2.5), 0.2, 0.35);
  // A river's pale banks read as sea; they are shelf (the river is drawn with its own banks).
  {
    const near = blurLo(riverK, 1.2);
    for (let i = 0; i < w * h; i++) if (near[i] > 0.12) { const m = K.sea[i] * smooth(0.12, 0.25, near[i]); K.shelf[i] += m; K.sea[i] -= m; }
  }

  // The layers, painted in this order; each wider one lies under the ones inside it.
  const ground = up(K.sea.map(v => 1 - v), 1.4);    // not sea
  const land   = up(sum(landK, alpineK, lakeK), 1.4);              // not sea, shelf or river
  const alpine = up(alpineK, 3.4);
  // The South Island's lakes are glacial; the North Island's (the strip at the right edge, east
  // of x = NORTH_X in the raster) keep the raster's deep blue.
  const NORTH_X = 175;
  const lakeSouth = up(lakeK.map((v, i) => (i % w) < NORTH_X ? v : 0), 1.2);
  const lakeNorth = up(lakeK.map((v, i) => (i % w) < NORTH_X ? 0 : v), 1.2);

  // The raster's average colour where a kind is (nearly) pure.
  const meanWhere = (test) => {
    const s = [0, 0, 0]; let n = 0;
    for (let i = 0; i < w * h; i++) if (test(i)) { s[0] += rgb[i * 3]; s[1] += rgb[i * 3 + 1]; s[2] += rgb[i * 3 + 2]; n++; }
    return n ? s.map(v => v / n) : null;
  };
  const hex = (c) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const pure = (k) => (i) => K[k][i] > 0.9;

  // Relief: the raster's luminance over a kind, averaged only over that kind (so the sea's
  // light does not bleed into the coast), cut into bands at the kind's own quantiles.
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.3 * rgb[i * 3] + 0.59 * rgb[i * 3 + 1] + 0.11 * rgb[i * 3 + 2];
  // A flat fill reads duller than the same average spread over shading, so averages are
  // given back a little of their colour.
  const vivid = (c, k = 1.25) => { if (!c) return c; const L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return c.map(v => L + (v - L) * k); };
  function relief(kindF, quantiles, sigma) {
    const wU = blur(upsample(kindF, w, h), W, H, sigma);
    const lw = new Float32Array(w * h); for (let i = 0; i < w * h; i++) lw[i] = lum[i] * kindF[i];
    const lU = blur(upsample(lw, w, h), W, H, sigma);
    const shade = new Float32Array(W * H); for (let i = 0; i < W * H; i++) shade[i] = lU[i] / Math.max(0.05, wU[i]);
    const vals = []; for (let i = 0; i < w * h; i++) if (kindF[i] > 0.9) vals.push(lum[i]);
    vals.sort((a, b) => a - b);
    const T = quantiles.map(q => vals[Math.floor(q * (vals.length - 1))]);
    // Band b holds luminance in [T[b-1], T[b]); band 0 is the darkest.
    const bands = [];
    for (let b = 0; b <= T.length; b++) {
      const lo = b ? T[b - 1] : -1e9, hi = b < T.length ? T[b] : 1e9;
      bands.push({ colour: vivid(meanWhere(i => kindF[i] > 0.9 && lum[i] >= lo && lum[i] < hi)), below: hi });
    }
    return { shade, bands };
  }
  // Darker-than-T regions, as paths, nested from the lightest threshold down.
  const darker = (shade, T, opts) => { const f = new Float32Array(W * H); for (let i = 0; i < W * H; i++) f[i] = T - shade[i]; return regionPath(f, W, H, 0, opts); };

  const landRelief = relief(K.land, [0.14, 0.38, 0.68], 3.6);
  const alpRelief  = relief(alpineK, [0.35, 0.7], 3.0);
  // The mountain top is glacier: blue-white ice, its shading kept from the raster's, darkest
  // band first.
  const GLACIER = [[170, 200, 222], [208, 228, 241], [242, 248, 252]];
  alpRelief.bands.forEach((b, i) => { b.colour = GLACIER[i]; });

  const C = {
    sea:   meanWhere(pure('sea')),
    shelf: meanWhere(pure('shelf')),
    lake:  meanWhere(pure('lake')),
    river: [86, 92, 178]
  };
  console.log('colours', Object.fromEntries(Object.entries(C).map(([k, c]) => [k, c && hex(c)])));
  console.log('land bands', landRelief.bands.map(b => b.colour && hex(b.colour)).join(' '));
  console.log('alpine bands', alpRelief.bands.map(b => b.colour && hex(b.colour)).join(' '));

  const P = {
    ground: regionPath(ground, W, H, 0.5, { minArea: 2.0 }),
    land:   regionPath(land, W, H, 0.5, { minArea: 3.0 }),
    alpine: regionPath(alpine, W, H, 0.5, { minArea: 6.0 }),
    lakeSouth: regionPath(lakeSouth, W, H, 0.5, { minArea: 1.2 }),
    lakeNorth: regionPath(lakeNorth, W, H, 0.5, { minArea: 1.2 }),
    river:  riverBodies.map(m => riverLine(m, bness, w, h)).filter(Boolean).join('')
  };

  // Farewell Spit: the thin pale hook off the north-west tip, a pixel wide in the raster (too
  // thin to trace as a shape). Its line runs through the lightest rows of each column between
  // the tip and its end, and it is drawn as a bar of sand on its own shoal.
  const SPIT = { x0: 88, x1: 101, y0: 13, y1: 19 };
  const spitPts = [];
  for (let x = SPIT.x0; x <= SPIT.x1; x++) {
    let sy = 0, sw = 0;
    for (let y = SPIT.y0; y <= SPIT.y1; y++) { const v = Math.max(0, lum[y * w + x] - 150); sy += v * (y + 0.5); sw += v; }
    if (sw) spitPts.push([x + 0.5, sy / sw]);
  }
  // Its root runs on a little, down into the tip of the land it grows from.
  if (spitPts.length > 2) { const [a, b] = spitPts, dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy); spitPts.unshift([a[0] + dx / L * 2, a[1] + dy / L * 2]); }
  const spitLine = spitPts.length > 2 ? rdp(spitPts.map((p, i, a) => i === 0 || i === a.length - 1 ? p : [p[0], (a[i - 1][1] + 2 * p[1] + a[i + 1][1]) / 4]), 0.05) : null;
  // Drawn as shapes that narrow from the root to a point at the tip (a stroke cannot taper).
  const spitShape = (w0, wTip) => spitLine ? taperPath(spitLine, w0, wTip) : '';

  const lb = landRelief.bands, ab = alpRelief.bands;
  const landBands = lb.slice(0, -1).map((b, i) => ({ colour: lb[i].colour, d: darker(landRelief.shade, b.below, { minArea: 0.6, eps: 0.14 }) })).reverse();
  const alpBands = ab.slice(0, -1).map((b, i) => ({ colour: ab[i].colour, d: darker(alpRelief.shade, b.below, { minArea: 0.8, eps: 0.14 }) })).reverse();

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * SVG_SCALE}" height="${h * SVG_SCALE}">`,
    `<!-- Traced from sprites/journey_map.png by tools/trace_map.js. Re-run it after changing the raster. -->`,
    `<defs>`,
    `<linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(C.sea.map(v => v + 6))}"/><stop offset="1" stop-color="${hex(C.sea.map(v => v - 8))}"/></linearGradient>`,
    `<clipPath id="landClip"><path clip-rule="evenodd" d="${P.land}"/></clipPath>`,
    `<clipPath id="alpClip"><path clip-rule="evenodd" d="${P.alpine}"/></clipPath>`,
    `</defs>`,
    // Sea, and the shallows ringing the coast.
    `<rect width="${w}" height="${h}" fill="url(#sea)"/>`,
    `<g fill="none" stroke-linejoin="round">`,
    `<path d="${P.ground}" stroke="${hex(C.sea.map(v => v - 10))}" stroke-width="9" opacity="0.35"/>`,
    `<path d="${P.ground}" stroke="${hex(C.sea.map(v => v - 18))}" stroke-width="4.5" opacity="0.45"/>`,
    `</g>`,
    // The shelf (the green lowland), with a darker coastline.
    `<path d="${P.ground}" fill-rule="evenodd" fill="${hex(C.shelf)}" stroke="${hex(C.shelf.map(v => v * 0.8))}" stroke-width="0.6" stroke-linejoin="round"/>`,
    // The land: its lightest band, the darker bands on it, and a pale rim inside its edge.
    `<path d="${P.land}" fill-rule="evenodd" fill="${hex(lb[lb.length - 1].colour)}"/>`,
    `<g clip-path="url(#landClip)">`,
    ...landBands.map(b => `<path d="${b.d}" fill-rule="evenodd" fill="${hex(b.colour)}"/>`),
    `<path d="${P.land}" fill="none" stroke="#f6f0c4" stroke-width="1.6" stroke-linejoin="round" opacity="0.85"/>`,
    `</g>`,
    `<path d="${P.land}" fill="none" stroke="${hex(C.shelf.map(v => v * 0.75))}" stroke-width="0.45" stroke-linejoin="round" opacity="0.7"/>`,
    // Farewell Spit: shoal, sand, and a bright crest, all tapering to its point.
    ...(spitLine ? [
      `<path d="${spitShape(3.8, 0.9)}" fill="#bfe0cf" opacity="0.45"/>`,
      `<path d="${spitShape(1.7, 0)}" fill="#efe0ab"/>`,
      `<path d="${spitShape(0.6, 0)}" fill="#fffbea" opacity="0.9"/>`] : []),
    // The glacier.
    `<path d="${P.alpine}" fill-rule="evenodd" fill="${hex(ab[ab.length - 1].colour)}"/>`,
    `<g clip-path="url(#alpClip)">`,
    ...alpBands.map(b => `<path d="${b.d}" fill-rule="evenodd" fill="${hex(b.colour)}"/>`),
    `</g>`,
    `<path d="${P.alpine}" fill="none" stroke="#8fb1cc" stroke-width="0.45" stroke-linejoin="round"/>`,
    // Lakes, each in its pale ring; the rivers.
    `<path d="${P.lakeSouth}" fill-rule="evenodd" fill="${hex(GLACIER[0])}" stroke="#f3f5e2" stroke-width="1.7" stroke-linejoin="round" paint-order="stroke"/>`,
    `<path d="${P.lakeSouth}" fill="none" stroke="#8fb1cc" stroke-width="0.45" stroke-linejoin="round"/>`,
    `<path d="${P.lakeNorth}" fill-rule="evenodd" fill="${hex(C.lake)}" stroke="#f3f5e2" stroke-width="1.7" stroke-linejoin="round" paint-order="stroke"/>`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${P.river}" stroke="#d2d8f1" stroke-width="2.3"/><path d="${P.river}" stroke="${hex(C.river)}" stroke-width="1.15"/></g>`,
    `</svg>`, ''
  ].join('\n');
  fs.writeFileSync(OUT, svg);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(svg.length / 1024).toFixed(0)} KB)`);

  if (debugDir) {
    fs.mkdirSync(debugDir, { recursive: true });
    const show = [[230, 238, 250], [91, 137, 116], [220, 200, 120], [160, 150, 190], [30, 80, 150], [200, 60, 200]];
    const out = new Uint8Array(W * H * 3);
    const ups = M.map(f => upsample(f, w, h));
    for (let i = 0; i < W * H; i++) {
      let b = 0; for (let k = 1; k < KINDS.length; k++) if (ups[k][i] > ups[b][i]) b = k;
      out.set(show[b], i * 3);
    }
    writePNG(path.join(debugDir, 'kinds.png'), W, H, out);
    console.log('debug: kinds.png in', debugDir);
  }
}
