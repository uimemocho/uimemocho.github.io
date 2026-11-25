// 超居合斬り — sprite-stack pixel pseudo-3D (Canvas 2D)
(() => {
'use strict';
const $ = s => document.querySelector(s);
const view = $('#view'), vctx = view.getContext('2d');
const fx = $('#fx'), fctx = fx.getContext('2d');
const skyC = $('#skyL'), ovC = $('#ovL'), skyCtx = skyC.getContext('2d'), ovCtx = ovC.getContext('2d'), stageEl = $('#stage');
let ctx = skyCtx;
const app = $('#app');
const URL_GAME = 'https://uimemocho.github.io/apps/cho-iai-giri/';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIO = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// ---------- RNG / noise ----------
let seed = 20261124;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const hs = (a, b, c) => { let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((c | 0) + 1013, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi; xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => hs(xi + i, yi + j, zi + k);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf), x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf), x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf), x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}
function fbm3(x, y, z, o = 4) { let s = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * vn3(x * f + i * 17.1, y * f, z * f); t += a; f *= 2.03; a *= .5; } return s / t; }

// ---------- sizing ----------
let W = 0, H = 0, DPR = 1, S = 3, LW = 200, LH = 400, HW = 100, HH = 200, F = 300;
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 1.5);
  view.width = fx.width = Math.round(W * DPR); view.height = fx.height = Math.round(H * DPR);
  LW = Math.min(300, Math.round(W * DPR)); S = view.width / LW; LH = Math.round(LW * H / W);
  skyC.width = ovC.width = LW; skyC.height = ovC.height = LH; HW = LW / 2; HH = LH / 2;
  skyCtx.imageSmoothingEnabled = ovCtx.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;
  if (renderer) renderer.setSize(LW, LH, false);
  fitLogo();
}

// ---------- colors ----------
const EM = 0x1000000; // emissive flag (skip baked shading)
const NIGHT = [.5, .58, .86]; // moonlight tint for the 3D voxels (emissive voxels are compensated)
const mixI = (a, b, t) => { t = clamp(t, 0, 1); const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255; return (Math.round(ar + ((b >> 16 & 255) - ar) * t) << 16) | (Math.round(ag + ((b >> 8 & 255) - ag) * t) << 8) | Math.round(ab + ((b & 255) - ab) * t); };
const mulI = (c, k) => (Math.min(255, Math.round((c >> 16 & 255) * k)) << 16) | (Math.min(255, Math.round((c >> 8 & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k));
const pick = (arr, v) => arr[Math.min(arr.length - 1, Math.floor(v * arr.length))];

// ---------- voxel models (generated incrementally, rendered as WebGL meshes) ----------
// f(x,y,l) -> 0xRRGGBB (| EM) or -1. image x = world +x, image y = world -z (at yaw 0), layer = +y
function vox(n, sz, unit, f, o = {}) { return { n, sz, u: unit, w: sz * unit, h: n * unit, f, o, data: [], done: false }; }
function stepModel(m, end) {
  const sz = m.sz, N = sz * sz;
  while (m.data.length < m.n) {
    const l = m.data.length, a = new Int32Array(N);
    for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) { const c = m.f(x, y, l); a[y * sz + x] = (c == null || c < 0) ? -1 : c; }
    m.data.push(a);
    if (performance.now() > end) return false;
  }
  m.done = true; m.f = null; return true;
}
const box = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// light direction (world) for baked planet shading
const LX = -.85, LY = .32, LZ = -.18; const LN = Math.hypot(LX, LY, LZ);

// ---------- models ----------
const MODEL = {};
MODEL.makiwara = () => vox(44, 16, .0375, (x, y, l) => {
  const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  if (l < 2) return (Math.abs(dx) < 6 && Math.abs(dy) < 6) ? (l === 1 ? 0x8f6a42 : 0x6b4a2b) : -1;
  if (l < 8) return (Math.abs(dx) < 2.2 && Math.abs(dy) < 2.2) ? (hs(x, y, l) < .3 ? 0x4e321b : 0x60401f) : -1;
  const R = 5.1 + .3 * Math.sin(l * .45) - (l > 39 ? (l - 39) * .55 : 0);
  if (l >= 42) return d <= R - 1.8 + hs(x, y, l) * 2 ? mixI(0xeedc9e, 0xc9a85e, hs(x, y, l + 9)) : -1;
  if (d > R) return -1;
  if (d < 1.7) return l % 4 === 0 ? 0x86a85a : 0x5f8a3e;
  if (d < R - 1.1) return mixI(0xead49a, 0xc7a865, hs(x >> 1, y >> 1, l >> 1) * .7 + ((d | 0) % 2) * .2);
  if (l === 14 || l === 15 || l === 26 || l === 27 || l === 37 || l === 38) return hs(x, y, l) < .5 ? 0x5e3d1e : 0x4a2f16;
  const st = hs(Math.round((a + 3.2) * 5), 0, l >> 3) * .6 + hs(Math.round((a + 3.2) * 7), l, 1) * .4;
  return mixI(0xdcbd6c, st < .45 ? 0xb8954c : 0xecd598, Math.abs(st - .45) * 1.1);
}, { ao: .78 });
function bambooModel(v) {
  const save = seed; seed = 4100 + v * 77;
  const n = 112, sz = 32;
  const nodes = []; for (let l = 4 + (rnd() * 3 | 0); l < n - 6; l += 9 + (rnd() * 3 | 0)) nodes.push(l);
  const la = rr(0, 6.28), lean = rr(2.5, 5);
  const cxA = l => 15.5 + Math.cos(la) * lean * Math.pow(l / n, 2), cyA = l => 15.5 + Math.sin(la) * lean * Math.pow(l / n, 2);
  const br = []; // branches: from node, angle, length; each ends in a fan of leaves
  nodes.forEach((nl, k) => { if (nl < 54) return; for (let b = 0; b < 2; b++) { const a = la + (k % 2 ? 0 : Math.PI) + (b ? 1.1 : -.6) + rr(-.4, .4); br.push({ l: nl, a, len: rr(3.5, 7.5), leaves: Array.from({ length: 4 + (rnd() * 3 | 0) }, () => ({ a: rr(-1.3, 1.3), len: rr(4.5, 7.5), w: rr(.65, .95) })) }); } });
  seed = save;
  const base = [0x5cae4c, 0x6cb844, 0x4aa676][v], dark = [0x3a7a34, 0x447e2e, 0x2e6e52][v];
  return vox(n, sz, .07, (x, y, l) => {
    const cx = cxA(l), cy = cyA(l), dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    const r = 2.3 - l / n * .8;
    let node = -1; for (const nl of nodes) { if (l === nl) node = 0; else if (l === nl - 1 && node < 0) node = 1; }
    if (l < n - 4 && d <= r) {
      if (d < r - .95) return node === 0 ? 0xe9e2bc : 0x2a2614;
      if (d < r - .45 && node !== 0) return 0xf0e8c4;
      if (node === 0) return mixI(base, 0x2a4a22, .35);
      if (node === 1) return mixI(base, 0xd8f0c8, .25);
      const sh = (dx * .7 - dy * .7) / Math.max(.5, r);
      return mixI(base, sh > 0 ? 0xb8e890 : dark, Math.min(1, Math.abs(sh)) * .6);
    }
    for (const b of br) {
      const ax = Math.cos(b.a), ay = Math.sin(b.a), bx0 = cxA(b.l), by0 = cyA(b.l);
      const px = x - bx0, py = y - by0, t = px * ax + py * ay, pr = Math.abs(-px * ay + py * ax);
      if (t > 0 && t < b.len && pr < .6 && Math.abs(l - (b.l + t * .55)) < .8) return 0x4a6a32;
      const tx = bx0 + ax * b.len, ty2 = by0 + ay * b.len, tl = b.l + b.len * .55;
      for (const lf of b.leaves) {
        const aa = b.a + lf.a, lx = Math.cos(aa), ly = Math.sin(aa), qx = x - tx, qy = y - ty2;
        const s2 = qx * lx + qy * ly; if (s2 < 0 || s2 > lf.len) continue;
        const q = -qx * ly + qy * lx, wd = Math.sin(Math.min(1, s2 / lf.len * 1.15) * Math.PI) * lf.w + .2;
        if (Math.abs(q) > wd) continue;
        if (Math.abs(l - (tl + 1 - s2 * .32 - s2 * s2 * .045)) > .75) continue;
        return q > wd * .35 ? 0x3a7a3a : s2 > lf.len * .7 ? 0xa8d878 : 0x62a852;
      }
    }
    return -1;
  }, { ao: .7 });
}
MODEL.bamboo0 = () => bambooModel(0); MODEL.bamboo1 = () => bambooModel(1); MODEL.bamboo2 = () => bambooModel(2);
MODEL.lantern = () => vox(26, 18, .07, (x, y, l) => {
  const dx = Math.abs(x - 8.5), dy = Math.abs(y - 8.5), d = Math.hypot(x - 8.5, y - 8.5), q = Math.max(dx, dy);
  const st = hs(x, y, l) < .5 ? 0x6a6d72 : 0x5c5f66, moss = hs(x >> 1, y >> 1, l >> 1) > .82 ? 0x4c6a3c : st;
  if (l < 3) return q <= 7 - l ? moss : -1;
  if (l < 10) return d <= 2.6 ? st : -1;
  if (l < 12) return q <= 6.5 ? moss : -1;
  if (l < 18) { if (q <= 5.5) { if (q > 4.5) return (dx < 2.5 || dy < 2.5) && l > 12 && l < 17 ? 0xffd27a | EM : st; return 0x2a2016; } return -1; }
  if (l < 22) return q <= 8.5 - (l - 18) * 1.9 ? moss : -1;
  return d <= (l < 24 ? 2 : 1.2) ? st : -1;
}, { ao: .85 });
MODEL.dojoHall = () => vox(40, 64, .22, (x, y, l) => {
  const x0 = 6, x1 = 57, y0 = 8, y1 = 55;
  if (l < 3) return box(x, y, x0, y0, x1, y1) ? (hs(x >> 2, y >> 2, l) < .5 ? 0x8d8a82 : 0x7a7770) : -1;
  if (l === 3) { if (box(x, y, 2, y0, x1, y1)) return x < x0 ? ((y % 4) ? 0x9c7346 : 0x7d5a36) : ((y % 3) ? 0xb88b55 : 0xa07646); return -1; }
  if (l < 16) {
    if (!box(x, y, x0, y0, x1, y1)) return -1;
    const edgeX = x === x0 || x === x1, edgeY = y === y0 || y === y1;
    if (!edgeX && !edgeY) { if (l === 4 && x > x0 + 1) return (y % 3) ? 0xc2925a : 0xa77a49; return -1; }
    if (x === x0) { return (y % 8 === 0 || y === y0 || y === y1) ? 0x4a2f1c : (l > 13 ? 0x5a3a22 : -1); }
    if ((edgeY && x % 8 === 6) || (edgeX && y % 8 === 0) || (x === x1 && (y === y0 || y === y1))) return 0x4a2f1c;
    if (l === 15 || l === 4) return 0x5a3a22;
    if (x === x1 && l > 10 && l < 14 && y > 26 && y < 37) return y === 27 || y === 36 || l === 11 || l === 13 ? 0x3a2416 : 0xf2ead4;
    return ((x % 4 === 0 && edgeY) || (y % 4 === 0 && edgeX) || l % 4 === 0) ? 0x8a6a48 : 0xffe2a8 | EM;
  }
  if (l < 18) return box(x, y, 1, 4, 62, 59) ? (l === 16 ? 0x5a3a22 : 0x6b4a2e) : -1;
  const k = l - 18; const gx0 = 1 + k * 1.3, gx1 = 62 - k * 1.3, gy0 = 4 + Math.min(k, 9) * 1.1, gy1 = 59 - Math.min(k, 9) * 1.1;
  if (gx0 > gx1 - 1) return -1;
  if (!box(x, y, gx0, gy0, gx1, gy1)) return -1;
  if (k >= 20 || gx1 - gx0 < 4) return 0x2e3238;
  if (k > 9 && (y < gy0 + 1 || y > gy1 - 1)) return 0xe8e0cc;
  return ((x + (k >> 1)) % 2) ? 0x5d6673 : 0x4a525e;
}, { ao: .78, top: 1.12 });
MODEL.fence = () => vox(12, 32, .19, (x, y, l) => {
  if (l === 11) return (x >= 14 && x <= 17) ? 0x3a2618 : -1;
  if (x < 15 || x > 16) return -1;
  if (l === 2 || l === 8) return 0x4a3020;
  return (y % 3 === 0) ? 0x5e4028 : mixI(0x7a5636, 0x8c6640, hs(y, 0, l >> 2));
}, { ao: .8 });
function pineModel(v) {
  const save = seed; seed = 900 + v * 31;
  const pads = []; for (let i = 0; i < 7; i++) { const l = 16 + i * 4 + (rnd() * 3 | 0); pads.push({ l, cx: 20 + rr(-10, 10), cy: 20 + rr(-9, 9), rx: rr(5, 9.5), ry: rr(4, 7) }); }
  seed = save;
  return vox(44, 40, .17, (x, y, l) => {
    const tx = 20 + Math.sin(l * .09 + v) * 5, ty = 20 + Math.cos(l * .07 + v * 2) * 3; const tr = Math.max(.8, 2.4 - l * .04);
    for (const p of pads) {
      const k = l - p.l; if (k < -1 || k > 2) continue;
      if (k === -1) { const ax = p.cx - tx, ay = p.cy - ty, L = Math.hypot(ax, ay) || 1; const t = ((x - tx) * ax + (y - ty) * ay) / L; const pr = Math.abs((-(x - tx) * ay + (y - ty) * ax) / L); if (t > 0 && t < L && pr < 1) return 0x5b4030; continue; }
      const e = Math.pow((x - p.cx) / p.rx, 2) + Math.pow((y - p.cy) / p.ry, 2);
      if (e <= 1 - k * .28 + (hs(x, y, l) - .5) * .25) return k === 2 ? 0x6e9a55 : k === 1 ? (hs(x, y, l) < .3 ? 0x5a8848 : 0x46733b) : 0x2d4c2b;
    }
    if (l < 40 && Math.hypot(x - tx, y - ty) <= tr) return hs(x, y, l >> 1) < .4 ? 0x3e2a1e : 0x5b4030;
    return -1;
  }, { ao: .72 });
}
MODEL.pine0 = () => pineModel(0); MODEL.pine1 = () => pineModel(1);
function machiyaModel(v) {
  const noren = [0x2a3f6b, 0x6b2a2a, 0x2a5a4a][v];
  return vox(30, 32, .125, (x, y, l) => {
    const x0 = 4, x1 = 27, y0 = 7, y1 = 24;
    if (l < 2) return box(x, y, x0 - 1, y0 - 1, x1 + 1, y1 + 1) ? 0x6e6c66 : -1;
    if (l < 12) {
      if (!box(x, y, x0, y0, x1, y1)) return -1;
      const inner = x > x0 && x < x1 && y > y0 && y < y1;
      if (inner) return l === 2 ? 0xbfae6a : 0x2a1d12;
      if (x === x0) { if (l > 6 && y > 12 && y < 19) return (y === 15 ? 0x1a1208 : noren); return (y % 2 === 0) ? 0x3a2414 : (l > 3 && l < 10 && (y < 11 || y > 20) ? 0xffb050 | EM : 0x1a0f08); }
      if (y % 5 === 2) return 0x4a2f1b;
      return (l === 2 || l === 11) ? 0x4a2f1b : 0xd9cfb8;
    }
    if (l < 14) return box(x, y, 1, 5, x1 + 1, y1 + 2) ? (((x + l) % 2) ? 0x5b6675 : 0x3c4450) : -1;
    if (l < 22) {
      if (!box(x, y, x0 + 3, y0, x1, y1)) return -1;
      const inner = x > x0 + 3 && x < x1 && y > y0 && y < y1; if (inner) return 0x2a1d12;
      if (x === x0 + 3 && l > 15 && l < 20 && y > 9 && y < 22) return (y % 2) ? 0x3a2414 : 0xffc870 | EM;
      return y % 6 === 1 ? 0x4a2f1b : 0xe8e1ce;
    }
    const k = l - 22; const rx0 = 4 + k * 1.6, rx1 = 30 - k * 1.6; if (rx0 > rx1) return -1;
    if (!box(x, y, rx0, 5, rx1, 26)) return -1;
    if (rx1 - rx0 < 2.5) return 0x2c323b;
    if (y < 6 || y > 25) return 0x2c323b;
    return ((y + (k & 1)) % 2) ? 0x5b6675 : 0x434b57;
  }, { ao: .76, top: 1.12 });
}
MODEL.machiya0 = () => machiyaModel(0); MODEL.machiya1 = () => machiyaModel(1); MODEL.machiya2 = () => machiyaModel(2);
MODEL.kura = () => vox(34, 24, .13, (x, y, l) => {
  const x0 = 4, x1 = 19, y0 = 4, y1 = 19;
  if (l < 25) {
    if (!box(x, y, x0, y0, x1, y1)) return -1;
    const inner = x > x0 && x < x1 && y > y0 && y < y1; if (inner) return l < 2 ? 0x8a7a5a : 0x5a4a38;
    if (l < 5) return ((x + y + l) % 4 === 0 || (x - y + l + 40) % 4 === 0) ? 0xe8e8e2 : 0x26262a;
    if (x === x0 && l > 13 && l < 19 && y > 9 && y < 14) return l === 14 || l === 18 ? 0x1a1a1e : 0xffb050 | EM;
    return l === 24 ? 0xd8d2c4 : 0xf2eee4;
  }
  const k = l - 25; const rx0 = 1 + k * 1.4, rx1 = 22 - k * 1.4; if (rx0 > rx1) return -1;
  if (!box(x, y, rx0, 2, rx1, 21)) return -1;
  if (rx1 - rx0 < 2) return (y < 4 || y > 19) ? 0xf2eee4 : 0x23262b;
  return ((y + (k & 1)) % 2) ? 0x3a3f46 : 0x2c3036;
}, { ao: .78, top: 1.1 });
MODEL.yagura = () => vox(70, 16, .12, (x, y, l) => {
  const lo = 2 + Math.floor(l * .03), hi = 13 - Math.floor(l * .03);
  if (l < 56) {
    const legX = x === lo || x === hi, legY = y === lo || y === hi;
    if (legX && legY) return 0x4a3020;
    const fx_ = (x === lo || x === hi) && y > lo && y < hi, fy_ = (y === lo || y === hi) && x > lo && x < hi;
    if ((fx_ || fy_) && l % 12 === 0) return 0x5e4028;
    if (fx_) { const t = (y - lo) / (hi - lo); if (Math.abs(((l % 12) / 12) - t) < .1 || Math.abs(((l % 12) / 12) - (1 - t)) < .1) return 0x5a3c24; }
    if (fy_) { const t = (x - lo) / (hi - lo); if (Math.abs(((l % 12) / 12) - t) < .1 || Math.abs(((l % 12) / 12) - (1 - t)) < .1) return 0x5a3c24; }
    if (l < 50 && l % 2 === 0 && x === 8 && y === lo + 1) return 0x6b4a2e;
    return -1;
  }
  if (l < 58) return box(x, y, 1, 1, 14, 14) ? 0x6b4a2e : -1;
  if (l < 61) return (box(x, y, 1, 1, 14, 14) && (x === 1 || x === 14 || y === 1 || y === 14)) ? 0x4a3020 : (l === 60 && box(x, y, 6, 6, 9, 9) ? 0x8a6a2a : -1);
  if (l < 64) { const d = Math.hypot(x - 7.5, y - 7.5); return d < 2.4 - (l - 61) * .3 ? (l === 61 ? 0xb08a3a : 0x8a6a2a) : (box(x, y, 1, 1, 14, 14) && (x === 1 || x === 14) && (y === 1 || y === 14) ? 0x4a3020 : -1); }
  const k = l - 64; const q = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return q <= 8 - k * 1.4 ? (q > 6 - k * 1.4 ? 0x3c4450 : 0x5b6675) : -1;
}, { ao: .8 });
MODEL.castle = () => vox(96, 48, .16, (x, y, l) => {
  const dx = Math.abs(x - 23.5), dy = Math.abs(y - 23.5), q = Math.max(dx, dy);
  if (l < 24) {
    const half = 23 - l * .26; if (q > half) return -1;
    if (q < half - 1.2) return 0x6a6458;
    const bx = Math.floor((x + (l >> 2) % 2 * 2) / 4), by = Math.floor((y + (l >> 2) % 2 * 2) / 4);
    if (l % 4 === 0) return 0x5a5850;
    return mixI(0x7d7a72, 0xb5b0a4, hs(bx, by, l >> 2));
  }
  const tiers = [[24, 37, 15.5, 19], [42, 52, 12.5, 15.5], [57, 65, 9.5, 12.5], [70, 78, 7.5, 10.5]];
  for (let t = 0; t < tiers.length; t++) {
    const [w0, w1, hw, rw] = tiers[t];
    if (l >= w0 && l <= w1) {
      if (q > hw) return -1;
      if (q < hw - .8) return l === w0 ? 0x6a5236 : 0x3a2a1c;
      if (l === w0 || l === w1) return 0x2c2a2a;
      const row = (l - w0) % 5; const along = dx > dy ? y : x;
      if (row >= 2 && row <= 3 && along % 4 === 1) return hs(along, l, t) > .45 ? 0xffc060 | EM : 0x1c1c22;
      if (l - w0 < 2) return 0x2a2a30;
      return 0xf4f1e8;
    }
    const r0 = w1 + 1, r1 = (t < 3 ? tiers[t + 1][0] - 1 : 88);
    if (l >= r0 && l <= r1) {
      const k = l - r0, span = r1 - r0 + 1;
      const half = t < 3 ? lerp(rw, tiers[t + 1][2] - .5, k / Math.max(1, span - 1)) : rw - k * 1.02;
      if (half < .5) return -1;
      if (q > half) return -1;
      if (t === 3 && half < 2) return 0x2a3a38;
      if (k === 0) return q > half - 1 ? 0xe9e4d6 : 0x3a5650;
      return ((x + y + k) % 2) ? 0x3e5a55 : 0x31494a;
    }
  }
  if (l >= 89 && l <= 93) { if ((Math.abs(x - 23.5) > 3 && Math.abs(x - 23.5) < 5.5) && dy < 1.2) return l === 93 ? 0xfff0a0 : 0xd9a830; return -1; }
  return -1;
}, { ao: .8, top: 1.12 });
function officeModel(v) {
  const P = [[11, 11, 64, 0x2b3d58, 0x5b6577], [13, 9, 92, 0x24545a, 0x606a72], [9, 9, 110, 0x1e2433, 0x434a5a], [12, 12, 56, 0x6b4a3a, 0x8a7060]][v];
  const [hx, hy, n, glass, frame] = P;
  return vox(n, 32, .3, (x, y, l) => {
    const dx = x - 15.5, dy = y - 15.5;
    let ex = hx, ey = hy; if (v === 1 && l > 70) { ex -= 3; ey -= 2; } if (v === 2 && l > n - 14) { ex = 2; ey = 2; if (l > n - 4 && (Math.abs(dx) > .6 || Math.abs(dy) > .6)) return -1; }
    if (Math.abs(dx) > ex || Math.abs(dy) > ey) { if (l === n - 1 && v !== 2 && Math.abs(dx) < 4 && Math.abs(dy) < 3) return 0x8a909a; return -1; }
    const ax = Math.abs(dx) > ex - 1, ay = Math.abs(dy) > ey - 1;
    if (v === 2 && l > n - 14) return 0x9aa0a8;
    if (l >= n - 2) return (ax || ay) ? 0xa0a6ae : 0x7a8088;
    const fl = l % 4;
    if (!ax && !ay) return fl === 0 ? 0x8a909a : (hs(x >> 2, y >> 2, l >> 2) > .7 ? 0x8a7a5a : 0x3b3430);
    if (fl === 0) return v === 3 ? 0xc4b4a0 : 0x8d95a3;
    const idx = ax ? y : x; const side = ax ? (dx > 0 ? 1 : 0) : (dy > 0 ? 3 : 2);
    if (idx % 3 === 0) return frame;
    if (v === 3 && fl === 1) return 0x5a5048;
    if (hs(idx >> 1, l >> 2, side + v * 7) > .62) return (hs(idx, l, 3) > .5 ? 0xffd27a : 0xffe6aa) | EM;
    return mixI(glass, 0x9ab0d8, clamp(l / n * .5 + (hs(idx, l >> 2, side) - .5) * .2, 0, .7));
  }, { ao: .7, top: 1.08 });
}
MODEL.office0 = () => officeModel(0); MODEL.office1 = () => officeModel(1); MODEL.office2 = () => officeModel(2); MODEL.office3 = () => officeModel(3);
MODEL.store = () => vox(16, 32, .28, (x, y, l) => {
  const x0 = 3, x1 = 28, y0 = 7, y1 = 24; if (!box(x, y, x0, y0, x1, y1)) return (l === 9 && box(x, y, 1, y0, x1, y1)) ? 0xe8e8e8 : -1;
  const inner = x > x0 && x < x1 && y > y0 && y < y1;
  if (l === 15) return 0x8a8e94;
  if (inner) return l === 0 ? 0xd8d4c8 : (l < 6 && (x + y) % 5 === 0 ? 0xc85a4a : 0xe8eef0);
  if (l < 9 && x === x0) return (y % 5 === 0) ? 0x9aa0a8 : (0xd8f0f8 | EM);
  if (l === 10) return 0x2a9d6a; if (l === 11) return 0xf2f2f2; if (l === 12) return 0x2f6fb0;
  if (l < 9) return y % 6 === 0 ? 0x9aa0a8 : 0xe4e2dc;
  return 0xeeeeea;
}, { ao: .85 });
MODEL.pole = () => vox(64, 16, .14, (x, y, l) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (l < 60 && d <= 1.3 - l * .004) return l % 9 === 0 ? 0x80807a : 0x9b9b94;
  if (l === 54 || l === 55) return (Math.abs(x - 7.5) < 1 && y >= 1 && y <= 14) ? 0x55585e : -1;
  if (l === 56 || l === 57) return (Math.abs(x - 7.5) < 1 && (y === 2 || y === 8 || y === 13)) ? 0xe8e8e2 : -1;
  if (l >= 38 && l <= 46) { const d2 = Math.hypot(x - 11, y - 7.5); if (d2 < 2.1) return l === 46 ? 0x6a7a70 : 0x7a8a80; if (l === 42 && box(x, y, 8, 7, 9, 8)) return 0x55585e; }
  return -1;
}, { ao: .8 });
function carModel(v) {
  const col = [0xd23b3b, 0xf0f0ec, 0x2f5fa8][v];
  return vox(8, 24, .2, (x, y, l) => {
    if (l < 2) { const wy = y === 7 || y === 8 || y === 15 || y === 16; if (wy && ((x >= 4 && x <= 7) || (x >= 16 && x <= 19))) return 0x1a1a1e; return (l === 1 && box(x, y, 3, 9, 20, 14)) ? 0x2a2a2e : -1; }
    if (l < 5) { if (!box(x, y, 2, 7, 21, 16)) return -1; if (l === 3 && x === 21 && (y === 8 || y === 15)) return 0xfff2c0 | EM; if (l === 3 && x === 2 && (y === 8 || y === 15)) return 0xff3a3a | EM; if (l === 2 && (x === 2 || x === 21)) return 0x2a2a2e; return col; }
    if (!box(x, y, 7, 8, 16, 15)) return -1;
    if (l === 7) return col;
    const edge = x === 7 || x === 16 || y === 8 || y === 15; return edge ? ((x === 7 || x === 16) && !(y === 8 || y === 15) ? 0x3a4a5e : 0x2a3444) : 0x1a1e26;
  }, { ao: .85 });
}
MODEL.car0 = () => carModel(0); MODEL.car1 = () => carModel(1); MODEL.car2 = () => carModel(2);
MODEL.tower = () => vox(150, 40, .7, (x, y, l) => {
  const t = l / 149; const half = 2 + 16.5 * Math.pow(1 - t, 2.1);
  const dx = Math.abs(x - 19.5), dy = Math.abs(y - 19.5);
  const band = Math.floor(l / 12) % 2 ? 0xf2f2f2 : 0xd9442b;
  if (l > 128) return (dx < 1 && dy < 1) ? (l > 146 ? 0xff4040 | EM : band) : -1;
  if ((l >= 66 && l <= 73) || (l >= 104 && l <= 108)) { const hd = l < 90 ? 7.5 : 4.5; if (dx <= hd && dy <= hd) { if (dx > hd - 1 || dy > hd - 1) return (l % 3 === 1) ? 0xffe0a0 | EM : 0x8a8e94; return 0x5a5e64; } }
  if (dx > half + .5 || dy > half + .5) return -1;
  const onX = dx > half - .8, onY = dy > half - .8;
  if (!onX && !onY) return -1;
  if (onX && onY) return band;
  const along = onX ? (y - 19.5 + half) : (x - 19.5 + half); const per = Math.max(3, half * .7);
  const m = (along + l * .9) % per, m2 = (along - l * .9 + 999 * per) % per;
  if (m < 1 || m2 < 1 || l % 10 === 0) return band;
  return -1;
}, { ao: .85, edge: .6 });
function spireModel(v) {
  const glow = v ? 0xff4fd8 : 0x4ff3ff, glow2 = v ? 0x4ff3ff : 0xb07aff;
  return vox(160, 32, .4, (x, y, l) => {
    const t = l / 159; const dx = x - 15.5, dy = y - 15.5;
    const oct = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * .72);
    const half = v ? 3 + 11 * Math.pow(1 - t, 1.4) + (l > 60 && l < 70 ? 3 : 0) : 2 + 12.5 * (1 - t) * (1 - t * .3);
    if (l > 150) return (oct < 1.2) ? (l > 156 ? 0xffffff | EM : glow | EM) : -1;
    if (oct > half) return -1;
    const surf = oct > half - 1;
    if (!surf) return l % 8 === 0 ? 0x2a2f44 : 0x10131e;
    if (l % 8 === 0) return glow | EM;
    if ((Math.round(Math.atan2(dy, dx) * 4) + 32) % 4 === 0) return (l % 4 < 2 ? glow2 : 0xffffff) | EM;
    if (hs(x, y, l >> 1) > .9) return 0x9aeaff | EM;
    return mixI(0x1d2233, 0x3a4260, hs(x >> 1, y >> 1, l >> 3) * .6);
  }, { ao: .65, top: 1.1 });
}
MODEL.spire0 = () => spireModel(0); MODEL.spire1 = () => spireModel(1);
MODEL.ringT = () => vox(120, 36, .4, (x, y, l) => {
  const d = Math.hypot(x - 17.5, y - 17.5);
  for (const rl of [44, 78, 104]) if (l >= rl && l <= rl + 2) { const ri = rl === 104 ? 9 : 13; if (d >= ri && d <= ri + 3) return (l === rl + 1 ? 0x7ff8ff : 0x4ff3ff) | EM; }
  const r = l < 110 ? 6.5 - (l > 96 ? (l - 96) * .25 : 0) : 2 - (l - 110) * .2;
  if (d > r) return -1;
  if (d < r - 1) return l % 6 === 0 ? 0x3a3f58 : 0x161a28;
  if (l % 6 === 0) return 0xff4fd8 | EM;
  if (hs(Math.round(Math.atan2(y - 17.5, x - 17.5) * 5), l >> 1, 1) > .7) return 0xfff0c0 | EM;
  return mixI(0x232a40, 0x485278, hs(x, y, l >> 2) * .5);
}, { ao: .7 });
MODEL.dome = () => vox(22, 40, .6, (x, y, l) => {
  const d = Math.hypot(x - 19.5, y - 19.5), R = 19;
  const rr2 = Math.sqrt(Math.max(0, 1 - Math.pow(l / 21, 2))) * R;
  if (l === 0) return d <= R ? (d > R - 1.5 ? 0x4ff3ff | EM : (hs(x >> 1, y >> 1, 0) > .4 ? 0x2f6a4a : 0x3f8a5a)) : -1;
  if (d > rr2) return -1;
  if (d > rr2 - 1.1) return ((Math.round(Math.atan2(y - 19.5, x - 19.5) * 6) + l) % 3 === 0) ? 0xffffff | EM : (0x5fd8f0 | EM);
  const bx = Math.floor(x / 4), by = Math.floor(y / 4), bh = 3 + hs(bx, by, 9) * 13;
  if (l < bh && (x % 4) && (y % 4)) return l % 3 === 0 ? 0xffd8f8 | EM : 0x2a3048;
  return -1;
}, { ao: 1, edge: .4 });
MODEL.arco = () => vox(120, 56, .9, (x, y, l) => {
  const dx = Math.abs(x - 27.5), dy = Math.abs(y - 27.5), q = Math.max(dx, dy);
  const tier = Math.floor(l / 12), half = 26 - tier * 2.3 - (l > 108 ? (l - 108) * 1.4 : 0);
  if (l > 114) { const d = Math.hypot(x - 27.5, y - 27.5); return (d > 6 && d < 8) ? 0xff4fd8 | EM : (d < 2 ? 0xffffff | EM : -1); }
  if (q > half) return -1;
  if (q < half - 1.1) return l % 12 === 11 ? (hs(x >> 1, y >> 1, tier) > .5 ? 0x3f8a5a : 0x2f6a4a) : (l % 4 === 0 ? 0x2a2f44 : 0x121624);
  if (l % 12 === 11) return hs(x, y, l) > .5 ? 0x4fbf6a : 0x3a9a55;
  if (l % 4 === 0) return 0x4ff3ff | EM;
  const along = dx > dy ? y : x;
  if (along % 3 === 0) return 0x2a3048;
  return hs(along >> 1, l >> 1, tier) > .55 ? (0xd8f4ff | EM) : mixI(0x1d2338, 0x3a4468, hs(along, l >> 2, 2) * .6);
}, { ao: .7, top: 1.1 });
MODEL.asteroid = () => { const n = 26, sz = 30, c = 14.5; return vox(n, sz, .2, (x, y, l) => { const yy = (l - 12.5) * 1.12, d = Math.hypot(x - c, y - c, yy); const a = Math.atan2(y - c, x - c), b = Math.atan2(yy, Math.hypot(x - c, y - c)); const rad = 12.6 * (1 + .16 * Math.sin(a * 2 + 1.3 + b) + .1 * Math.sin(a * 3 + b * 2.2)) * (.86 + .28 * fbm3(x * .14, y * .14, l * .14, 3)); if (d > rad) return -1; if (d < rad * .5) return hs(x, y, l) < .35 ? 0xffc060 | EM : 0xe0742c | EM; if (d < rad * .72) return hs(x, y, l) < .5 ? 0x8a4a2a : 0x6a3a26; const cr = hs(x >> 2, y >> 2, l >> 2); return cr < .18 ? 0x4c4640 : hs(x, y, l) < .5 ? 0x77705f : 0x8e8574; }, { ao: .6 }); };
MODEL.rock = () => { const ph = [1.2, 4.1, 2.7]; const n = 14; return vox(n, 16, .3, (x, y, l) => { const r0 = 7 * Math.sqrt(1 - Math.pow(l / n, 1.6)); const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5); const rad = r0 * (1 + .2 * Math.sin(a * 2 + ph[0]) + .12 * Math.sin(a * 3 + ph[1])); return d <= rad ? (hs(x, y, l) < .5 ? 0x5a5650 : 0x6e6a62) : -1; }, { ao: .6 }); };

// planets: n = 2R layers, light baked from world light dir
function planetModel(Rp, unit, surf, core, ring, night) { return planetVox(Rp, unit, surf, core, ring, night, true); }
function planetVox(Rp, unit, surf, core, ring, night, xs) {
  const ext = ring ? Math.ceil(Rp * 2.2) : Rp + 1, sz = ext * 2, n = Rp * 2;
  const lx = LX / LN, ly = LY / LN, lz = LZ / LN;
  return vox(n, sz, unit, (x, y, l) => {
    const c = sz / 2 - .5, dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
    const yy = ((l + .5) / n) * 2 - 1;
    if (ring && Math.abs(l + .5 - n / 2) <= 1) { const q = d / Rp; if (q > 1.22 && q < 2.15) { const v = ring(q, Math.atan2(dy, dx)); if (v >= 0) return mulI(v, l + .5 > n / 2 ? 1 : .85) | EM; } }
    const rr2 = Math.sqrt(Math.max(0, 1 - yy * yy)) * Rp;
    if (d > rr2 + .35) return -1;
    const nx = dx / Rp, nz = -dy / Rp; const rn = Math.hypot(nx, yy, nz);
    const rAt = ll => { const y2 = ((ll + .5) / n) * 2 - 1; return Math.sqrt(Math.max(0, 1 - y2 * y2)) * Rp; };
    if (!xs || d > Math.min(rAt(l + 1), rAt(l - 1)) - 1.2 || rn > .95) {
      const il = 1 / Math.max(1e-6, rn), n0 = nx * il, n1 = yy * il, n2 = nz * il;
      const col = surf(n0, n1, n2);
      const lam = n0 * lx + n1 * ly + n2 * lz;
      if (night && lam < -.08) { const nc = night(n0, n1, n2); if (nc >= 0) return nc | EM; }
      const k = .16 + 1.02 * Math.max(0, lam) + .1 * Math.max(0, 1 - Math.abs(lam) * 4) * 0;
      return mulI(col, clamp(k, 0, 1.12)) | EM;
    }
    return core(rn) | EM;
  }, { flat: true, ao: 1 });
}
const coreRock = (c1, c2, c3, c4) => rn => rn < .2 ? c1 : rn < .5 ? mixI(c2, c3, (rn - .2) / .3) : rn < .92 ? mixI(c3, c4, (rn - .5) / .42) : 0x6a4a32;
const earthLand = (n0, n1, n2) => fbm3(n0 * 1.7 + 3.1, n1 * 1.7, n2 * 1.7 + 7, 5);
MODEL.earth = () => planetModel(24, 5 / 24, (n0, n1, n2) => {
  const h = earthLand(n0, n1, n2), cl = fbm3(n0 * 2.6 + 11, n1 * 4.2, n2 * 2.6, 4), lat = Math.abs(n1);
  let col;
  if (lat > .9) col = 0xf0f4fa;
  else if (h > .53) { const dz = fbm3(n0 * 5, n1 * 5 + 2, n2 * 5, 3); col = (lat < .4 && dz > .56) ? 0xc8a463 : (h > .63 ? 0x6b7b3a : (dz > .5 ? 0x3e7f3a : 0x2f6a35)); if (lat > .72) col = 0xe4ecf2; }
  else col = mixI(0x0f3576, 0x2a78c4, clamp((h - .3) * 4, 0, 1));
  if (cl > .58) col = mixI(col, 0xffffff, clamp((cl - .58) * 5, 0, .9));
  return col;
}, coreRock(0xfff4c0, 0xffc040, 0xff7a1a, 0xc83a14), null, (n0, n1, n2) => (earthLand(n0, n1, n2) > .55 && hs(Math.round(n0 * 60), Math.round(n1 * 60), Math.round(n2 * 60)) > .78) ? 0xffd27a : 0x081a3a);
MODEL.moon = () => planetModel(16, 3.2 / 16, (n0, n1, n2) => { const v = fbm3(n0 * 3 + 2, n1 * 3, n2 * 3, 4); return v < .42 ? 0x6e6e6a : mixI(0x9a9a94, 0xd0cec6, v); }, coreRock(0xffe0a0, 0xd08040, 0x8a5a3a, 0x6a5a4a));
MODEL.mercury = () => planetModel(12, 2.2 / 12, (n0, n1, n2) => { let c = mixI(0x6d6862, 0xbab3aa, fbm3(n0 * 3.5, n1 * 3.5, n2 * 3.5, 4)); if (vn3(n0 * 9 + 5, n1 * 9, n2 * 9) > .72) c = mulI(c, .72); return c; }, coreRock(0xfff0c0, 0xf0a040, 0xc06030, 0x8a6a5a));
MODEL.venus = () => planetModel(18, 4.4 / 18, (n0, n1, n2) => { const w = fbm3(n0 * 3, n1 * 3, n2 * 3, 3); return mixI(0xcf9e52, 0xf6e3b0, fbm3(n0 * 2 + w * 1.6, n1 * 6, n2 * 2 + w, 4)); }, coreRock(0xfff4c0, 0xffb040, 0xe0602a, 0xa04020));
MODEL.mars = () => planetModel(14, 2.8 / 14, (n0, n1, n2) => { if (n1 > .86 || n1 < -.9) return 0xf4efe8; let c = mixI(0x9a3a1c, 0xdc7a42, fbm3(n0 * 2.5, n1 * 2.5, n2 * 2.5, 4)); if (fbm3(n0 * 1.7 + 9, n1 * 1.7, n2 * 1.7, 3) > .58) c = mixI(c, 0x5a2614, .6); return c; }, coreRock(0xfff0b0, 0xff9a3a, 0xd05a2a, 0x8a3a1c));
const lon0 = Math.atan2(-.75, -.66);
MODEL.jupiter = () => planetModel(30, 13 / 30, (n0, n1, n2) => {
  const pal = [0xf1e6d2, 0xd9b48a, 0xb37a52, 0xe8d8bc, 0x9c6a48, 0xe9c99a];
  const t = n1 * 9 + (fbm3(n0 * 3, n1 * 6, n2 * 3, 4) - .5) * 1.4; const f = ((t % 6) + 6) % 6, i = Math.floor(f);
  let c = mixI(pal[i], pal[(i + 1) % 6], (f - i) * .5);
  const lon = Math.atan2(n0, n2); const dl = (n1 + .32) / .09; let dn = lon - lon0; dn = ((dn + Math.PI * 3) % (Math.PI * 2)) - Math.PI; dn /= .3;
  const e = dl * dl + dn * dn; if (e < 1) c = mixI(0xd06a44, 0xb84a30, e); else if (e < 1.5) c = mixI(c, 0xf3e2c8, .6);
  return c;
}, rn => rn < .2 ? 0xfff2c8 : rn < .55 ? mixI(0xffc060, 0x8aa0d0, (rn - .2) / .35) : mixI(0x6a7aa8, 0xc49a6a, (rn - .55) / .45));
MODEL.saturn = () => planetModel(22, 11 / 22, (n0, n1, n2) => { const pal = [0xeedcae, 0xd9bf86, 0xe6d3a2, 0xc9a96e]; const t = n1 * 7 + (fbm3(n0 * 2, n1 * 4, n2 * 2, 3) - .5) * .6; const f = ((t % 4) + 4) % 4, i = Math.floor(f); return mixI(pal[i], pal[(i + 1) % 4], (f - i) * .5); },
  rn => rn < .22 ? 0xfff0c0 : rn < .6 ? mixI(0xffc060, 0x9aa8c8, (rn - .22) / .38) : mixI(0x8a9ab8, 0xd8c08a, (rn - .6) / .4),
  (q, a) => { if (q > 1.62 && q < 1.7) return -1; if (q < 1.42) return mixI(0x6e5c44, 0x9a8462, (q - 1.22) / .2); const v = .5 + .5 * Math.sin(q * 46); return mixI(0xb89c6e, 0xf2e6c6, v * (q < 1.62 ? 1 : .75)); });
MODEL.uranus = () => planetModel(18, 7 / 18, (n0, n1, n2) => mixI(0x7ccfd8, 0xc0f2f2, .45 + n1 * .25 + (fbm3(n0 * 2, n1 * 5, n2 * 2, 3) - .5) * .3), rn => rn < .25 ? 0xfff0c0 : rn < .7 ? mixI(0x60c8e0, 0x3a8ab0, (rn - .25) / .45) : 0x7ad0dc);
MODEL.neptune = () => planetModel(18, 7 / 18, (n0, n1, n2) => {
  let c = mixI(0x2440b8, 0x4a70e6, .5 + (fbm3(n0 * 2, n1 * 6, n2 * 2, 4) - .5) * .9);
  const lon = Math.atan2(n0, n2); let dn = lon - lon0; dn = ((dn + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const e = Math.pow((n1 + .25) / .1, 2) + Math.pow(dn / .3, 2); if (e < 1) c = 0x18257a; else if (e < 1.7 && n1 > -.25) c = mixI(c, 0xe8f0ff, .7);
  if (vn3(n0 * 4, n1 * 22, n2 * 4) > .78) c = mixI(c, 0xdce8ff, .6);
  return c;
}, rn => rn < .25 ? 0xfff0c0 : rn < .7 ? mixI(0x3a6ad8, 0x1a3a8a, (rn - .25) / .45) : 0x3050c8);
function galaxyModel(side) {
  return vox(9, 160, 300 / 160, (x, y, l) => {
    const dx = x - 79.5, dy = y - 79.5; if (side < 0 ? dx >= 0 : dx < 0) return -1;
    const r = Math.hypot(dx, dy) / 78; if (r > 1) return -1;
    const lm = Math.abs(l - 4), thick = .7 + 4.2 * Math.exp(-r * r * 26); if (lm > thick) return -1;
    const th = Math.atan2(dy, dx), sp = th - Math.log(r * 6 + .6) * 2.7;
    const arm = Math.pow(.5 + .5 * Math.cos(2 * sp), 4), dust = Math.pow(.5 + .5 * Math.cos(2 * sp - .5), 12);
    let I = .75 * Math.exp(-r * r * 50) + (.14 + 1.1 * arm) * Math.exp(-r * 2.3) * (1 - dust * .75);
    I *= (1 - lm / (thick + .8)) * (.72 + .56 * hs(x, y, l)) / (1 + thick * .32);
    if (hs(x, y, l + 50) > .986) I += .9;
    if (I < .075) return -1;
    let col = r < .17 ? 0xffe9b8 : mixI(0x8fb0ff, 0xfff0d8, clamp(1.05 - r * 1.3 + arm * .25, 0, 1));
    if (arm > .55 && hs(x >> 1, y >> 1, l) > .94) col = 0xff6fa8;
    return mulI(col, clamp(I, 0, 1.35)) | EM;
  }, { points: true, ao: 1 });
}
MODEL.galL = () => galaxyModel(-1); MODEL.galR = () => galaxyModel(1);
const Mcache = {};
function getMs(k) { return Mcache[k] || (Mcache[k] = MODEL[k]()); }
function getM(k) { const m = getMs(k); if (!m.done) stepModel(m, Infinity); return m; }
const BUILD_Q = ['bamboo0', 'bamboo1', 'bamboo2', 'machiya0', 'machiya1', 'machiya2', 'kura', 'yagura', 'castle', 'office0', 'office1', 'office2', 'office3', 'store', 'pole', 'car0', 'car1', 'car2', 'tower', 'spire0', 'spire1', 'ringT', 'dome', 'arco', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'rock', 'asteroid', 'galL', 'galR'];
let buildI = 0;
function buildStep(budget) { if (!preDone) prebuildNext(performance.now() + budget); }

// ---------- stage data ----------
const STAGE_D = [0, 12, 400, 6e3, 8e4, 1.2e6, 3.844e8, 7.8e10, 2.5e11, 6.3e11, 1.28e12, 2.6e12, 4.35e12, 9e12, 9.4607e20];
const SCENES = ['dojo', 'bamboo', 'town', 'modern', 'future', 'space', 'galaxy'];
const SC_STAGE = [0, 1, 2, 3, 4, 5, 13];
const TRANS = ['whip', 'whip', 'leap', 'leap', 'ground', 'warp'];
const LEAP_YEARS = [['1717', '2026'], ['2026', '3026']];
const LEAP_LK = [.42, .62, .82, 1.02];
const CHIP = {
  straw: [0xead49a, 0xc9a85e, 0x86a85a], bamboo: [0xf0e8c4, 0x6fae74, 0x2f6b45], wood: [0x8a6a48, 0xd9cfb8, 0x5b6675], white: [0xf4f1e8, 0x3e5a55, 0x7d7a72],
  glass: [0xbfe4ff, 0xffffff, 0x8d95a3], metal: [0xd9442b, 0xf2f2f2, 0x9b9b94], neon: [0x4ff3ff, 0xff4fd8, 0xffffff], magma: [0xffd060, 0xff7a1a, 0x7a5236], gas: [0xf1e6d2, 0xd9b48a, 0xffc060], ice: [0xc0f2f2, 0x4a70e6, 0xffffff], stars: [0xffffff, 0x9fb8ff, 0xff6fa8]
};
function chipFor(m) {
  if (m.startsWith('pine')) return [0x46733b, 0x6e9a55, 0x5b4030]; if (m.startsWith('bamboo')) return CHIP.bamboo; if (m.startsWith('office') || m === 'store') return CHIP.glass;
  if (m.startsWith('spire') || m === 'ringT' || m === 'arco' || m === 'dome') return CHIP.neon; if (m === 'rock' || m === 'asteroid' || m === 'moon' || m === 'lantern') return [0x6a6d72, 0x9a9a94, 0x4c6a3c];
  if (m.startsWith('car')) return [0xd23b3b, 0x2a3444, 0xf2f2f2]; if (m === 'pole') return CHIP.metal; return CHIP.wood;
}
function mk(m, x, z, o = {}) {
  const st = getMs(m), sc = o.sc || 1;
  return { m, x, y: o.y || 0, z, w: st.w * sc, h: st.h * sc, n: st.n, sc, u: st.u * sc, mesh: null, top: null, yaw: o.yaw || 0, cutF: o.cutF ?? .5, kind: o.kind || 'wide', fs: o.fs || 2, chip: CHIP[o.chip || 'wood'], glow: o.glow || 0, big: !!o.big, path: !!o.path,
    stage: 0, jj: 0, cnt: 1, cut: false, piece: null, shake: 0, bx: 0, by: 0, bz: 0, comp: o.comp || null, name: o.name ?? -1, R: o.R || 0 };
}
let scene = null, sceneI = 0;
function buildScene(id) {
  const save = seed; seed = 777 + SCENES.indexOf(id) * 1013;
  const sc = { id, objs: [], deco: [], dots: [], space: false, kv: 6, startZ: 0 };
  const P = (o, stage) => { o.path = true; o.stage = stage; sc.objs.push(o); return o; };
  const place = (list, stage, z0, gap) => { let z = z0, prevW = 0; list.forEach((it, i) => { const o = mk(it[0], it[2] ?? rr(-.15, .15), 0, it[1]); z += (i ? (prevW + o.w) * .5 * .72 + gap : 0); o.z = z; prevW = o.w; P(o, stage); }); };
  if (id === 'dojo') {
    sc.kv = 12.5;
    for (let i = 0; i < 5; i++) P(mk('makiwara', rr(-.08, .08), 3 + i * 2.1, { cutF: rr(.48, .66), kind: 'tall', fs: 1.15, chip: 'straw', yaw: rr(0, 6) }), 0);
    // the dojo hall itself is the last thing cut; the bamboo grove waits behind it
    { const hall = mk('dojoHall', 0, 24, { yaw: -Math.PI / 2, cutF: .46, kind: 'wide', fs: 5.2, chip: 'wood', big: true }); hall.cutAt = hall.w * .5; hall.passThru = true; P(hall, 0); }
    for (let z = 2; z < 27; z += 5.6) sc.deco.push(mk('fence', 15.5, z));
    for (let i = 0; i < 90; i++) { const z = rr(33, 80), x = (rnd() < .5 ? -1 : 1) * rr(.5, 22) * (z < 40 ? 1 : 1); sc.deco.push(mk('bamboo' + (rnd() * 3 | 0), x, z, { yaw: rr(0, 6) })); }
    sc.deco.push(mk('pine0', -10, 17)); sc.deco.push(mk('pine1', 10.5, 17.5)); sc.deco.push(mk('pine0', 12, 6)); sc.deco.push(mk('pine1', -12, 5));
    sc.deco.push(mk('lantern', 2.4, 4.6)); sc.deco.push(mk('lantern', -3.2, 10.5)); sc.deco.push(mk('lantern', 2.6, 13));
    for (let i = 0; i < 900; i++) sc.dots.push([rr(-12, 14), rr(-6, 22), pick(['#4a4e66', '#5a5e78', '#3a3e54', '#6a6e88'], rnd()), rnd() < .12 ? 2 : 1]);
    sc.sky = { top: '#03050d', mid: '#0b1636', hor: '#2a3c70', gnd: ['#3a3e52', '#2a2e40', '#161926'], sun: [-.9, .55, '#fbf6dc', .055], moon: 1, stars: 1, clouds: 1, far: 'mount', farC: ['#0d1630', '#15214a'] };
  } else if (id === 'bamboo') {
    sc.kv = 11;
    for (let i = 0; i < 12; i++) P(mk('bamboo' + (rnd() * 3 | 0), rr(-.25, .25), 2 + i * 1.25, { cutF: rr(.11, .16), kind: 'tall', fs: 1.35, chip: 'bamboo', yaw: rr(0, 6) }), 1);
    for (let i = 0; i < 20; i++) { const side = rnd() < .62; const x = side ? rr(1.9, 9) : -rr(7, 13); sc.deco.push(mk('bamboo' + (rnd() * 3 | 0), x, rr(-4, 27), { yaw: rr(0, 6) })); }
    for (let i = 0; i < 34; i++) { const x = (rnd() < .5 ? 1 : -1) * rr(10, 24); sc.deco.push(mk('bamboo' + (rnd() * 3 | 0), x, rr(-6, 34), { yaw: rr(0, 6) })); }
    sc.deco.push(mk('lantern', 1.6, 6));
    // the grove thins out onto the castle town: its streets and the castle are already in view ahead
    for (let z = 26; z < 70; z += 4.4) { sc.deco.push(mk('machiya' + (rnd() * 3 | 0), 8.2 + rr(0, .6), z)); sc.deco.push(mk(rnd() < .2 ? 'kura' : 'machiya' + (rnd() * 3 | 0), -14.5, z + 2, { yaw: Math.PI })); }
    for (let z = 30; z < 74; z += rr(4.4, 5.5)) sc.deco.push(mk('machiya' + (rnd() * 3 | 0), 15 + rr(0, 1), z));
    sc.deco.push(mk('yagura', -21, 46)); sc.deco.push(mk('castle', 2, 92)); sc.deco.push(mk('pine0', 5.3, 30)); sc.deco.push(mk('pine1', 5.3, 44));
    for (let i = 0; i < 900; i++) sc.dots.push([rr(-10, 10), rr(-4, 28), pick(['#24362e', '#2e4436', '#1a2a22', '#3a5040', '#20281e'], rnd()), rnd() < .2 ? 2 : 1]);
    sc.sky = { top: '#03050d', mid: '#0b1430', hor: '#1d2e5a', gnd: ['#1a2622', '#111a18', '#080c0c'], sun: [-.8, .7, '#fbf6dc', .05], moon: 1, stars: 1, rays: 1, far: 'bamboo', farC: ['#0e1a2a', '#0b1422', '#081019'] };
  } else if (id === 'town') {
    sc.kv = 9;
    const list = ['machiya0', 'machiya1', 'kura', 'machiya2', 'yagura', 'machiya0', 'kura', 'machiya1', 'machiya2'].map(m => [m, { cutF: m === 'yagura' ? rr(.3, .42) : rr(.42, .56), kind: m === 'yagura' ? 'tall' : 'wide', fs: m === 'yagura' ? 5 : 4.6, chip: m === 'kura' ? 'white' : 'wood', yaw: m === 'kura' ? 0 : 0 }]);
    list.push(['castle', { cutF: .37, kind: 'wide', fs: 13, chip: 'white', big: true }, 0]);
    place(list, 2, 3, 1.6);
    const end = sc.objs[sc.objs.length - 1].z, z0 = sc.objs[0].z - 6;
    for (let i = 0; i < 60; i++) { const z = rr(z0 - 46, z0 - 2), x = (rnd() < .55 ? 1 : -1) * rr(1.8, 16); sc.deco.push(mk('bamboo' + (rnd() * 3 | 0), x, z, { yaw: rr(0, 6) })); }
    for (let z = z0; z < end + 20; z += 4.4) sc.deco.push(mk('machiya' + (rnd() * 3 | 0), 8.2 + rr(0, .6), z));
    for (let z = z0 + 2; z < end + 20; z += 4.4) sc.deco.push(mk('machiya' + (rnd() * 3 | 0), -26, z, { yaw: Math.PI }));
    for (let z = z0 + 2; z < end + 16; z += rr(4.4, 6)) sc.deco.push(mk(rnd() < .2 ? 'kura' : 'machiya' + (rnd() * 3 | 0), -14.5, z, { yaw: Math.PI }));
    for (let z = z0 + 4; z < end + 24; z += rr(4.4, 5.5)) sc.deco.push(mk(rnd() < .2 ? 'kura' : 'machiya' + (rnd() * 3 | 0), 15 + rr(0, 1), z));
    for (let z = 10; z < end + 30; z += rr(18, 26)) sc.deco.push(mk('yagura', rnd() < .5 ? 22 : -21, z));
    for (let z = 6; z < end; z += rr(9, 14)) sc.deco.push(mk('pine' + (rnd() * 2 | 0), 5.3, z));
    for (let i = 0; i < 1000; i++) sc.dots.push([rr(-14, 16), rr(-6, end + 24), pick(['#4a4458', '#5a546a', '#3a3446', '#6a6278'], rnd()), rnd() < .12 ? 2 : 1]);
    sc.sky = { top: '#04060f', mid: '#101a3c', hor: '#33406e', gnd: ['#3a3646', '#2a2734', '#16141c'], sun: [-1.2, .45, '#fff4d0', .075], moon: 1, stars: 1, clouds: 1, far: 'mount', farC: ['#0e1630', '#18234a'], roofs: '#0a0e1c', roofLit: 1 };
  } else if (id === 'modern') {
    sc.kv = 9;
    const L = [['car0', 'car', 0], ['office0', 'off', 0], ['pole', 'pole', 0], ['store', 'store', 0], ['office1', 'off', 0], ['car2', 'car', 0], ['office2', 'off', 0]].map(([m, k]) => [m, k === 'car' ? { cutF: .5, kind: 'wide', fs: 4.6, chip: 'glass', yaw: Math.PI / 2 } : k === 'pole' ? { cutF: .42, kind: 'tall', fs: 5, chip: 'metal' } : k === 'store' ? { cutF: .5, kind: 'wide', fs: 7, chip: 'glass' } : { cutF: rr(.35, .55), kind: 'wide', fs: 12, chip: 'glass' }]);
    L.push(['tower', { cutF: .3, kind: 'tall', fs: 42, chip: 'metal', big: true }, 0]);
    place(L, 3, 4, 2.4);
    { const tw = sc.objs[sc.objs.length - 1]; tw.z += 22; tw.x = 0; }
    const end = sc.objs[sc.objs.length - 1].z;
    // the street opens up toward the tower: later rows are pushed back and sparser so the cut targets read clearly
    const mid = end * .4, op = z => clamp((z - mid) / (end - mid), 0, 1);
    for (let z = -12; z < end + 40; z += rr(10, 13) * (1 + op(z) * .8)) sc.deco.push(mk('office' + (rnd() * 4 | 0), rr(19, 24) + op(z) * 16, z));
    for (let z = -12; z < end + 40; z += rr(12, 16) * (1 + op(z))) sc.deco.push(mk('office' + (rnd() * 4 | 0), -rr(42, 48) - op(z) * 14, z, { yaw: Math.PI }));
    for (let z = -6; z < end + 40; z += rr(11, 15) * (1 + op(z) * .8)) sc.deco.push(mk(rnd() < .25 ? 'store' : 'office' + (rnd() * 4 | 0), -rr(24, 28) - op(z) * 14, z, { yaw: Math.PI }));
    for (let z = -16; z < end + 60; z += rr(12, 16) * (1 + op(z) * 1.5)) if (op(z) < .6) sc.deco.push(mk('office' + (rnd() * 4 | 0), rr(34, 40), z));
    for (let z = -20; z < end + 80; z += rr(14, 20)) sc.deco.push(mk('office' + (rnd() * 4 | 0), (rnd() < .5 ? 1 : -1) * rr(62, 76), z));
    for (let z = 4; z < mid; z += 15) sc.deco.push(mk('pole', -8.5, z));
    for (let z = 0; z < mid; z += 15) sc.deco.push(mk('pole', 8.5, z));
    for (let z = 8; z < mid; z += rr(16, 26)) sc.deco.push(mk('car' + (rnd() * 3 | 0), 5.2, z, { yaw: Math.PI / 2 }));
    for (let i = 0; i < 1100; i++) sc.dots.push([rr(-30, 30), rr(-10, end + 40), pick(['#34343e', '#26262e', '#40404a', '#1e1e24'], rnd()), 1]);
    sc.sky = { top: '#04050e', mid: '#121838', mid2: '#2a2452', hor: '#5a3e6e', gnd: ['#2c2a38', '#1c1c26', '#101016'], sun: [.5, .5, '#f6f2e0', .045], moon: 1, stars: 1, far: 'sky', farC: ['#0c0e1e', '#141830'], road: 1, endZ: end };
  } else if (id === 'future') {
    sc.kv = 9.5;
    const L = ['spire0', 'dome', 'ringT', 'spire1', 'dome', 'ringT', 'spire0'].map(m => [m, m === 'dome' ? { cutF: .46, kind: 'wide', fs: 18, chip: 'neon' } : m === 'ringT' ? { cutF: .42, kind: 'tall', fs: 24, chip: 'neon' } : { cutF: rr(.24, .36), kind: 'tall', fs: 26, chip: 'neon' }]);
    L.push(['arco', { cutF: .34, kind: 'wide', fs: 62, chip: 'neon', big: true }, 0]);
    place(L, 4, 6, 6);
    const end = sc.objs[sc.objs.length - 1].z;
    for (let z = -20; z < end + 80; z += rr(24, 34)) sc.deco.push(mk(rnd() < .7 ? 'spire' + (rnd() * 2 | 0) : 'ringT', rr(34, 46), z, { yaw: rr(0, 6) }));
    for (let z = -20; z < end + 80; z += rr(30, 40)) sc.deco.push(mk(rnd() < .6 ? 'spire' + (rnd() * 2 | 0) : 'arco', -rr(80, 100), z));
    for (let z = -10; z < end + 80; z += rr(26, 36)) sc.deco.push(mk(rnd() < .65 ? 'spire' + (rnd() * 2 | 0) : 'dome', -rr(42, 52), z, { yaw: rr(0, 6) }));
    for (let z = -30; z < end + 100; z += rr(30, 44)) sc.deco.push(mk(rnd() < .7 ? 'spire' + (rnd() * 2 | 0) : 'ringT', rr(66, 80), z, { yaw: rr(0, 6) }));
    sc.traffic = []; for (let i = 0; i < 60; i++) sc.traffic.push({ x: rr(-40, 60), y: rr(14, 60), z: rr(-20, end + 60), v: rr(18, 40) * (rnd() < .5 ? 1 : -1), c: rnd() < .5 ? '#4ff3ff' : '#ff4fd8' });
    sc.sky = { top: '#04021a', mid: '#1a0a3c', mid2: '#47125e', hor: '#ff3fb0', gnd: ['#1a0a2e', '#0c0618', '#05030c'], stars: 1, far: 'neon', farC: ['#120826', '#1a0c30'], grid: 1, bigPlanet: 1, endZ: end };
  } else if (id === 'space') {
    sc.kv = 4.4; sc.space = true;
    // outward from Earth: Moon -> Mars -> asteroid belt -> gas giants (extra gaps leave room for the fly-out shot)
    const ps = [['earth', 5, 'magma', .14, 5, 0], ['moon', 3.2, 'magma', 0, 6, 62], ['mars', 2.8, 'magma', .06, 7, 32], ['asteroid', 2.4, 'magma', 0, 8, 6], ['asteroid', 3.2, 'magma', 0, 8, 0], ['asteroid', 2.7, 'magma', 0, 8, 0], ['jupiter', 13, 'gas', .08, 9, 8], ['saturn', 11, 'gas', .04, 10, 0], ['uranus', 7, 'ice', .1, 11, 0], ['neptune', 7, 'ice', .12, 12, 0]];
    let z = 0, prevR = 0;
    ps.forEach(([m, R, ch, gl, st, gx], i) => { const ext = m === 'saturn' ? R * 2.1 : R; z += i ? prevR + ext + Math.max(R, prevR) * 1.7 + 2 + gx : 10; prevR = ext; const zx = i ? (i % 2 ? 1 : -1) * Math.max(R, 4) * 1.1 : 0, zy = i ? [.8, -.6, .4, -.9][i % 4] * Math.max(R, 4) : 0; const o = mk(m, zx, z, { y: -R + zy, cutF: rr(.44, .56), kind: 'planet', fs: Math.max(R * 2.5, 5), chip: ch, glow: gl, big: true, R, sc: m === 'asteroid' ? R / 3 : 1, yaw: m === 'asteroid' ? rr(0, 6) : 0 }); if (m === 'asteroid') o.meteor = true; else o.yaw = 0; P(o, st); });
    for (let i = 0; i < 26; i++) { const m = sc.objs[2], j = sc.objs[6]; const zz = rr(m.z + 4, j.z - 14); const o = mk(rnd() < .5 ? 'rock' : 'asteroid', (rnd() < .5 ? -1 : 1) * rr(6, 40), zz, { y: rr(-10, 12), yaw: rr(0, 6), sc: rr(.15, .6) }); sc.deco.push(o); }
    sc.sky = { space: 1 };
  } else if (id === 'galaxy') {
    sc.kv = 3.2; sc.space = true;
    const o = mk('galL', 0, 40, { y: 0, kind: 'galaxy', fs: 190, chip: 'stars', big: true, comp: 'lighter' }); o.y = -o.h / 2; o.cutF = .5; o.cutAt = o.h;
    // a meteor field to slice through on the way to the galaxy (sizes ramp up toward galaxy scale)
    const ms = [3, 4.5, 6.5, 9, 12, 16, 21], list = []; let z = o.z - o.fs * 1.6;
    for (let k = ms.length - 1; k >= 0; k--) { const s2 = ms[k], Rm = 2.7 * s2, fs = Rm * 2.5; z -= fs * 2.3; const zy = [.5, -.4, .3, -.5, .4, -.3, .2][k] * Rm, zx = (k % 2 ? 1 : -1) * Rm * .5; list.unshift(mk('asteroid', zx, z, { y: -Rm + zy, sc: s2, cutF: rr(.42, .58), kind: 'planet', fs, chip: 'magma', big: true, R: Rm, yaw: rr(0, 6) })); }
    for (const m of list) { m.meteor = true; P(m, 13); }
    P(o, 13);
    for (let i = 0; i < 46; i++) { const zz = rr(list[0].z - 40, o.z - o.fs * 1.2), f = clamp((zz - list[0].z) / (o.z - list[0].z), 0, 1), sc2 = rr(.8, 3.2) * (1 + f * 6), sd = rnd() < .5 ? -1 : 1; sc.deco.push(mk('asteroid', sd * rr(12, 70) * (1 + f * 5), zz, { y: rr(-40, 40) * (1 + f * 4), yaw: rr(0, 6), sc: sc2 })); }
    sc.sky = { space: 1, gal: 1 };
  }
  // stage counts
  const cnt = {}; for (const o of sc.objs) cnt[o.stage] = (cnt[o.stage] || 0) + 1;
  const ix = {}; for (const o of sc.objs) { o.cnt = cnt[o.stage]; o.jj = ix[o.stage] = (ix[o.stage] ?? -1) + 1; o.cutL = clamp(Math.round(o.n * o.cutF), 1, o.n - 1); o.cutF = o.cutL / o.n; o.cutY = o.y + o.h * o.cutF; }
  sc.startZ = sc.objs[0].z - sc.objs[0].fs * 2.6;
  sc.stars = []; for (let i = 0; i < (sc.space ? 700 : 260); i++) sc.stars.push({ x: rr(-1, 1), y: sc.space ? rr(-1, 1) : rr(.02, 1), z: rr(-1, 1), b: rr(.25, 1), s: rr(.5, 3), p: rr(0, 6.28), big: rnd() < .06, c: rnd() < .15 ? '#ffd8b0' : rnd() < .2 ? '#b0c8ff' : '#ffffff' });
  for (const s of sc.stars) { const l = Math.hypot(s.x, s.y, s.z) || 1; s.x /= l; s.y /= l; s.z /= l; }
  sc.clouds = []; if (sc.sky.clouds) for (let i = 0; i < 11; i++) sc.clouds.push({ a: rr(-Math.PI, Math.PI), e: rr(.07, .38), w: rr(.12, .3), k: rnd() * 1000 | 0 });
  sc.neb = []; if (sc.sky.space) for (let i = 0; i < 9; i++) { const a = rr(-Math.PI, Math.PI), e = rr(-.6, .6); sc.neb.push({ d: [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)], r: rr(.3, .8), c: pick(['80,60,200', '200,60,140', '40,120,200', '120,40,160', '200,120,80'], rnd()), a: rr(.05, .14) }); }
  sc.gals = []; if (sc.sky.gal) for (let i = 0; i < 40; i++) { const a = rr(-Math.PI, Math.PI), e = rr(-1.2, 1.2); sc.gals.push({ d: [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)], r: rr(.006, .03), t: rr(0, 3.14), q: rr(.2, .8) }); }
  const DR = { dojo: 6.5, bamboo: 7.5, town: 15, modern: 32, future: 62, space: 40, galaxy: 220 }[id] || 0; sc.DR = DR;
  for (const o of sc.deco) {
    if (Math.abs(o.x) - o.w * .5 > DR) continue;
    o.dz = true; o.cutL = clamp(Math.round(o.n * rr(.25, .55)), 1, o.n - 1); o.cutF = o.cutL / o.n; o.cutY = o.y + o.cutL * o.u;
    o.fs = Math.max(o.w, o.h) * .5; o.chip = chipFor(o.m);
  }
  seed = save;
  return sc;
}

// ---------- camera ----------
const cam = { x: 0, y: 1.5, z: -1, yaw: 0, pitch: 0, fov: 1.05, roll: 0 };
let cY = 1, sY = 0, cP = 1, sP = 0;
function camUpdate() { cY = Math.cos(cam.yaw); sY = Math.sin(cam.yaw); cP = Math.cos(cam.pitch); sP = Math.sin(cam.pitch); F = HH / Math.tan(cam.fov / 2); }
function lookAt(px, py, pz, tx, ty, tz) { cam.x = px; cam.y = py; cam.z = pz; const dx = tx - px, dy = ty - py, dz = tz - pz; cam.yaw = Math.atan2(dx, dz); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
function toCamDir(x, y, z, o) { const x1 = x * cY - z * sY, z1 = x * sY + z * cY; o[0] = x1; o[1] = y * cP - z1 * sP; o[2] = y * sP + z1 * cP; return o; }
function toCam(x, y, z, o) { return toCamDir(x - cam.x, y - cam.y, z - cam.z, o); }
const NEAR = .12;
const tA = [0, 0, 0, 0, 0], tB = [0, 0, 0, 0, 0], tmp = [0, 0, 0], tmp2 = [0, 0, 0];
function proj(x, y, z, o) { toCam(x, y, z, o); if (o[2] < NEAR) return false; o[3] = HW + F * o[0] / o[2]; o[4] = HH - F * o[1] / o[2]; return true; }
function rotMat(kx, kz, th) { const c = Math.cos(th), s = Math.sin(th), t = 1 - c; return [t * kx * kx + c, -s * kz, t * kx * kz, s * kz, c, -s * kx, t * kx * kz, s * kx, t * kz * kz + c]; }
const mv = (m, x, y, z, o) => { o[0] = m[0] * x + m[1] * y + m[2] * z; o[1] = m[3] * x + m[4] * y + m[5] * z; o[2] = m[6] * x + m[7] * y + m[8] * z; return o; };

// ---------- WebGL voxel renderer ----------
const glc = $('#glL');
let renderer = null, scene3 = null, cam3 = null, root = null, MAT = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
  scene3 = new THREE.Scene(); cam3 = new THREE.PerspectiveCamera(60, 1, .05, 5000);
  root = new THREE.Group(); root.scale.x = -1; scene3.add(root); // engine is left-handed (+x to the right): mirror into three.js
  MAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  MAT.color.setRGB(NIGHT[0], NIGHT[1], NIGHT[2]);
} catch (e) { renderer = null; }
const SH = { top: 1.16, bot: .5, nx: 1.04, px: .66, nz: .9, pz: .76 };
function buildGeo(m, l0, l1, yOff) {
  const sz = m.sz, u = m.u, half = sz / 2, D = m.data, n = m.n, ao = m.o.ao ?? .8, flat = !!m.o.flat;
  const get = (x, y, l) => (x < 0 || y < 0 || x >= sz || y >= sz || l < l0 || l >= l1) ? -1 : D[l][y * sz + x];
  const afq = l => n > 1 ? lerp(ao, 1, Math.round(l / (n - 1) * 6) / 6) : 1;
  const shade = (c, k, l) => flat ? (c & 0xffffff) : (c & EM) ? (c & 0xffffff) | EM : mulI(c, k * afq(l));
  const pos = [], col = []; let nv = 0;
  const quad = (c, P) => { for (let q = 0; q < 12; q++) pos.push(P[q]); const em = (c & EM) && !flat ? 1 : 0; const r = (c >> 16 & 255) / 255 / (em ? NIGHT[0] : 1), g = (c >> 8 & 255) / 255 / (em ? NIGHT[1] : 1), b = (c & 255) / 255 / (em ? NIGHT[2] : 1); col.push(r, g, b, r, g, b, r, g, b, r, g, b); nv += 4; };
  const X = x => (x - half) * u, Z = y => -(y - half) * u, Yv = l => (l - l0) * u + yOff;
  // greedy over a W x H mask; emit(i0,j0,i1,j1,key) with inclusive-exclusive bounds
  const greedy = (W, H, mask, emit) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W;) {
      const k = mask[j * W + i]; if (k < 0) { i++; continue; }
      let w = 1; while (i + w < W && mask[j * W + i + w] === k) w++;
      let h = 1; outer: while (j + h < H) { for (let t = 0; t < w; t++) if (mask[(j + h) * W + i + t] !== k) break outer; h++; }
      for (let jj = 0; jj < h; jj++) for (let t = 0; t < w; t++) mask[(j + jj) * W + i + t] = -1;
      emit(i, j, i + w, j + h, k); i += w;
    }
  };
  const mXY = new Int32Array(sz * sz), L = l1 - l0, mSide = new Int32Array(sz * L);
  for (let l = l0; l < l1; l++) {
    for (const dir of [1, -1]) {
      for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) { const c = get(x, y, l); mXY[y * sz + x] = (c >= 0 && get(x, y, l + dir) < 0) ? shade(c, dir > 0 ? SH.top : SH.bot, l) : -1; }
      const Yp = dir > 0 ? Yv(l + 1) : Yv(l);
      greedy(sz, sz, mXY, (x0, y0, x1, y1, k) => quad(k, [X(x0), Yp, Z(y1), X(x1), Yp, Z(y1), X(x1), Yp, Z(y0), X(x0), Yp, Z(y0)]));
    }
  }
  for (let x = 0; x < sz; x++) for (const dir of [-1, 1]) {
    for (let l = l0; l < l1; l++) for (let y = 0; y < sz; y++) { const c = get(x, y, l); mSide[(l - l0) * sz + y] = (c >= 0 && get(x + dir, y, l) < 0) ? shade(c, dir < 0 ? SH.nx : SH.px, l) : -1; }
    const Xp = dir < 0 ? X(x) : X(x + 1);
    greedy(sz, L, mSide, (y0, a0, y1, a1, k) => quad(k, [Xp, Yv(a0 + l0), Z(y0), Xp, Yv(a1 + l0), Z(y0), Xp, Yv(a1 + l0), Z(y1), Xp, Yv(a0 + l0), Z(y1)]));
  }
  for (let y = 0; y < sz; y++) for (const dir of [-1, 1]) {
    for (let l = l0; l < l1; l++) for (let x = 0; x < sz; x++) { const c = get(x, y, l); mSide[(l - l0) * sz + x] = (c >= 0 && get(x, y + dir, l) < 0) ? shade(c, dir < 0 ? SH.pz : SH.nz, l) : -1; }
    const Zp = dir < 0 ? Z(y) : Z(y + 1);
    greedy(sz, L, mSide, (x0, a0, x1, a1, k) => quad(k, [X(x0), Yv(a0 + l0), Zp, X(x1), Yv(a0 + l0), Zp, X(x1), Yv(a1 + l0), Zp, X(x0), Yv(a1 + l0), Zp]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nq = nv / 4, idx = nv > 65535 ? new Uint32Array(nq * 6) : new Uint16Array(nq * 6);
  for (let q = 0; q < nq; q++) { const v = q * 4, j = q * 6; idx[j] = v; idx[j + 1] = v + 1; idx[j + 2] = v + 2; idx[j + 3] = v; idx[j + 4] = v + 2; idx[j + 5] = v + 3; }
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  for (const k of ['position', 'color']) g.attributes[k].onUpload(dropArr); g.index.onUpload(dropArr);
  return g;
}
function buildPoints(m) {
  const sz = m.sz, u = m.u, half = sz / 2, pos = [], col = [];
  for (let l = 0; l < m.n; l++) { const a = m.data[l]; for (let i = 0; i < sz * sz; i++) { const c = a[i]; if (c < 0) continue; const x = i % sz, y = (i / sz) | 0; pos.push((x + .5 - half) * u, (l + .5) * u, -(y + .5 - half) * u); col.push((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere();
  return new THREE.Points(g, new THREE.PointsMaterial({ size: u * 1.7, vertexColors: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
}
function dropArr() { this.array = null; }
const GEO = {};
function sharedGeo(k) { if (!GEO[k]) { const m = getM(k); GEO[k] = buildGeo(m, 0, m.n, 0); } return GEO[k]; }
function ensureMeshes(o) {
  if (o.mesh || !renderer) return;
  if (o.kind === 'galaxy') { o.mesh = buildPoints(getM('galL')); o.top = buildPoints(getM('galR')); o.mesh.frustumCulled = o.top.frustumCulled = false; return; }
  if (!o.path && !o.dz) { o.mesh = new THREE.Mesh(sharedGeo(o.m), MAT); o.mesh.scale.setScalar(o.sc); return; }
  const m = getM(o.m);
  o.mesh = new THREE.Mesh(buildGeo(m, 0, o.cutL, 0), MAT); o.mesh.userData.own = true;
  o.top = new THREE.Mesh(buildGeo(m, o.cutL, m.n, 0), MAT); o.top.userData.own = true;
  if (o.sc !== 1) { o.mesh.scale.setScalar(o.sc); o.top.scale.setScalar(o.sc); }
}
const SCN = [];
function getScene(i) { return SCN[i] || (SCN[i] = buildScene(SCENES[i])); }
let preK = 1, preO = 0, preDone = false;
function prebuildNext(end) {
  if (!renderer || preDone) return;
  while (performance.now() < end) {
    if (preK >= SCENES.length) { preDone = true; for (const k in Mcache) if (Mcache[k].done) Mcache[k].data = null; return; }
    const sc = getScene(preK), all = sc.objs.concat(sc.deco);
    if (preO >= all.length) { preK++; preO = 0; continue; }
    const o = all[preO], m = getMs(o.m);
    if (!m.done) { if (!stepModel(m, end)) return; }
    if (o.kind === 'galaxy') { const r2 = getMs('galR'); if (!r2.done && !stepModel(r2, end)) return; }
    ensureMeshes(o); preO++;
  }
}
function attachScene(sc) {
  if (!renderer) return;
  if (sc.space) MAT.color.setRGB(1, 1, 1); else MAT.color.setRGB(NIGHT[0], NIGHT[1], NIGHT[2]);
  for (const ch of [...root.children]) root.remove(ch);
  for (const o of sc.deco.concat(sc.objs)) { ensureMeshes(o); root.add(o.mesh); if (o.top) root.add(o.top); }
}
const qY = new THREE.Quaternion(), qT = new THREE.Quaternion(), vAx = new THREE.Vector3(), vUp = new THREE.Vector3(0, 1, 0);
function sync3D() {
  // background buildings that stand between the camera and the blade are taken out of the shot
  const occ = !scene.space && wave.on && (state === 'chase' || state === 'final'), fx0 = wave.x, fz0 = wave.z, dx0 = fx0 - cam.x, dz0 = fz0 - cam.z, L2 = dx0 * dx0 + dz0 * dz0 || 1;
  for (const o of scene.deco) {
    const ms = o.mesh; if (!ms) continue; const hw = o.w * .5;
    let vis = !(Math.abs(cam.x - o.x) < hw + .3 && Math.abs(cam.z - o.z) < hw + .3 && cam.y < o.y + o.h);
    if (vis && occ && !o.blast) {
      const t = ((o.x - cam.x) * dx0 + (o.z - cam.z) * dz0) / L2;
      if (t > 0 && t < 1) { const px2 = cam.x + dx0 * t, pz2 = cam.z + dz0 * t, d = Math.hypot(o.x - px2, o.z - pz2), sy = cam.y + (wave.y - cam.y) * t; if (d < hw * 1.15 + .2 && o.y + o.h > sy) o.occT = T; }
      if (o.occT && T - o.occT < .2) vis = false;
    }
    if (vis && scene.id === 'galaxy' && (state === 'final' || state === 'wide') && Math.hypot(cam.x - o.x, cam.y - (o.y + o.h * .5), cam.z - o.z) < o.w * 3 + cs * .4) vis = false;
    ms.visible = vis; ms.position.set(o.x, o.y, o.z); ms.rotation.y = o.yaw;
    if (o.top) {
      const tp = o.top, sh = o.shake ? Math.sin(T * 60) * o.shake * o.w * .02 : 0; tp.visible = vis || o.cut; ms.position.x += sh;
      if (!o.cut) { tp.position.set(o.x + sh, o.cutY, o.z); tp.rotation.set(0, o.yaw, 0); }
      else { const p = o.piece; tp.visible = true; tp.position.set(p.x, p.y, p.z); qY.setFromAxisAngle(vUp, o.yaw + p.spin); qT.setFromAxisAngle(vAx.set(p.kx, 0, p.kz), p.th); tp.quaternion.copy(qT).multiply(qY); }
    }
  }
  for (const o of scene.objs) {
    const a = o.mesh, b = o.top; if (!a) continue;
    if (o.kind === 'galaxy') {
      const g = o.gal || { off: 0, th: 0, dz: 0 };
      // disk turned face-on to the travel direction; model x (the split axis) points up
      qT.setFromAxisAngle(vAx.set(1, 0, 0), Math.PI / 2); qY.setFromAxisAngle(vAx.set(0, 0, 1), Math.PI / 2); qY.multiply(qT);
      const cy = o.y + o.h / 2; _v.set(0, o.h / 2, 0).applyQuaternion(qY);
      a.quaternion.copy(qY); b.quaternion.copy(qY);
      a.position.set(o.x - _v.x, cy - g.off - _v.y, o.z - _v.z + g.dz); b.position.set(o.x - _v.x, cy + g.off - _v.y, o.z - _v.z + g.dz);
      continue;
    }
    const sh = o.shake ? Math.sin(T * 60) * o.shake * o.w * .02 : 0;
    a.position.set(o.x + o.bx + sh, o.y + o.by, o.z + o.bz); a.rotation.set(0, o.yaw, 0);
    if (!o.cut) { b.position.set(o.x + sh, o.cutY, o.z); b.rotation.set(0, o.yaw, 0); }
    else { const p = o.piece; b.position.set(p.x, p.y, p.z); qY.setFromAxisAngle(vUp, o.yaw + (p.spin || 0)); qT.setFromAxisAngle(vAx.set(p.kx, 0, p.kz), p.th); b.quaternion.copy(qT).multiply(qY); }
    // never let the chase camera fly through a cut piece
    if (o.cut && o.kind === 'planet') {
      // shrink a half smoothly as the chase camera closes in, so it never fills the screen or pops
      const R0 = o.R, fz = d => { const k = clamp((d - R0 * 1.3) / (R0 * 2.2), 0, 1); return k * k * (3 - 2 * k); };
      const ka = fz(Math.hypot(cam.x - (o.x + o.bx), cam.y - (o.y + o.by + R0 * .5), cam.z - (o.z + o.bz)));
      const p = o.piece, kb = fz(Math.hypot(cam.x - p.x, cam.y - (p.y + R0 * .5), cam.z - p.z));
      a.scale.setScalar(Math.max(.001, ka)); b.scale.setScalar(Math.max(.001, kb)); a.visible = ka > .01; b.visible = kb > .01;
    } else {
      a.visible = b.visible = true; a.scale.setScalar(1); b.scale.setScalar(1);
      // a flying top piece that swings right into the lens is taken out rather than filling the frame
      if (o.passThru && o.cut && Math.abs(cam.x - o.x) < o.w * .55 && Math.abs(cam.z - o.z) < o.w * .55 && cam.y < o.cutY + .5) a.visible = false;
      if (o.cut && o.piece && o.kind !== 'galaxy') { const p = o.piece, ht = o.h * (1 - o.cutF), rad = Math.max(o.w, ht) * .75; if (Math.hypot(cam.x - p.x, cam.y - (p.y + ht * .5), cam.z - p.z) < rad) b.visible = false; }
    }
  }
}
// sword pressure: a curved sheet of compressed air with a razor-bright leading edge and wind streaks flowing back
const NU = 64, NV = 10, waveLayers = [];
const WAVE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WAVE_FS = `precision mediump float; varying vec2 vUv; uniform float uT, uFade, uUltra, uHue, uGhost;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 hue(float x){ return clamp(abs(fract(x + vec3(0.0, 0.666, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main(){
  float u = vUv.x, v = vUv.y, uc = u * 2.0 - 1.0;
  float taper = pow(max(0.0, 1.0 - uc * uc), 0.45);
  float edge = exp(-v * 26.0) * 1.7 + exp(-v * 7.0) * 0.35;
  float flow = n(vec2(u * 46.0, v * 2.5 - uT * 9.0)) * 0.65 + n(vec2(u * 120.0, v * 5.0 - uT * 16.0)) * 0.35;
  float streak = smoothstep(0.42, 0.95, flow);
  float body = pow(1.0 - v, 1.8) * (0.3 + 1.0 * streak);
  float a = (edge * (1.0 - uGhost * 0.7) + body) * taper * uFade * smoothstep(1.0, 0.7, v);
  vec3 tint = uUltra > 0.5 ? hue(u * 0.9 + uHue + v * 0.3) * 0.85 + 0.15 : vec3(0.55, 0.8, 1.0);
  vec3 col = mix(tint, vec3(1.0), clamp(edge * 0.8 - uGhost, 0.0, 1.0));
  gl_FragColor = vec4(col * a, a);
}`;
function waveSheet(ghost) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(NU * NV * 3), uv = new Float32Array(NU * NV * 2), idx = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * NU + i; uv[k * 2] = i / (NU - 1); uv[k * 2 + 1] = j / (NV - 1); if (i < NU - 1 && j < NV - 1) idx.push(k, k + 1, k + NU, k + 1, k + NU + 1, k + NU); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ vertexShader: WAVE_VS, fragmentShader: WAVE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uUltra: { value: 0 }, uHue: { value: 0 }, uGhost: { value: ghost } } });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; return m;
}
// swept trail: the leading edge's recent positions as a fading ribbon, so the cut plane reads through objects
const TK = 22, TH = 26, EDGE = new Float32Array(TK * 3), trailH = []; let trailM = null, trailZ = 0;
const TRAIL_FS = `precision mediump float; varying vec2 vUv; uniform float uT, uFade, uUltra, uHue;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 hue(float x){ return clamp(abs(fract(x + vec3(0.0, 0.666, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main(){
  float u = vUv.x, v = vUv.y, uc = u * 2.0 - 1.0, taper = pow(max(0.0, 1.0 - uc * uc), 0.6);
  float flow = n(vec2(u * 40.0, v * 8.0 - uT * 6.0)) * 0.6 + n(vec2(u * 9.0, v * 3.0 + uT * 2.0)) * 0.4;
  float a = pow(1.0 - v, 2.0) * taper * uFade * (0.25 + 0.75 * flow) * 0.55;
  vec3 tint = uUltra > 0.5 ? hue(u * 0.8 + uHue - v * 0.4) * 0.8 + 0.2 : mix(vec3(1.0), vec3(0.45, 0.75, 1.0), smoothstep(0.0, 0.3, v));
  gl_FragColor = vec4(tint * a, a);
}`;
if (renderer) {
  const g = new THREE.BufferGeometry(), uv = new Float32Array(TK * TH * 2), idx = [];
  for (let j = 0; j < TH; j++) for (let i = 0; i < TK; i++) { const k = j * TK + i; uv[k * 2] = i / (TK - 1); uv[k * 2 + 1] = j / (TH - 1); if (i < TK - 1 && j < TH - 1) idx.push(k, k + 1, k + TK, k + 1, k + TK + 1, k + TK); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TK * TH * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  trailM = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: WAVE_VS, fragmentShader: TRAIL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uUltra: { value: 0 }, uHue: { value: 0 } } }));
  trailM.frustumCulled = false; trailM.renderOrder = 2;
}
function updTrail() {
  if (!trailM) return;
  // reset on teleports (scene switch) so the ribbon never stretches across worlds
  if (Math.abs(wave.z - trailZ) > Math.max(cs * 3, wave.v * .25)) trailH.length = 0; trailZ = wave.z;
  trailH.unshift(Float32Array.from(EDGE)); if (trailH.length > TH) trailH.pop();
  const on = wave.on && wave.fade > .05 && trailH.length > 2; trailM.visible = on; if (!on) return;
  const P = trailM.geometry.attributes.position.array, U = trailM.material.uniforms;
  U.uT.value = T; U.uFade.value = wave.fade; U.uUltra.value = ultraCut ? 1 : 0; U.uHue.value = (T * .35) % 1;
  for (let j = 0; j < TH; j++) { const e = trailH[Math.min(j, trailH.length - 1)]; for (let i = 0; i < TK; i++) { const k = (j * TK + i) * 3, q = i * 3; P[k] = e[q]; P[k + 1] = e[q + 1]; P[k + 2] = e[q + 2]; } }
  trailM.geometry.attributes.position.needsUpdate = true;
  // energy shed from the edge
  if (false) { const q = (Math.random() * TK | 0) * 3, hw = wave.hw; addP({ x: EDGE[q], y: EDGE[q + 1], z: EDGE[q + 2], vx: rr(-.3, .3) * hw, vy: rr(-.1, .5) * hw, vz: -rr(.2, .9) * hw, life: rr(.15, .35), t: 0, k: 'spark', c: ultraCut ? `hsl(${Math.random() * 360 | 0},100%,72%)` : Math.random() < .6 ? '#cfe6ff' : '#ffffff', s: hw * .025, g: 0 }); }
}
const shocks = [], DEB = 700; let debM = null; const deb = [];
if (renderer) {
  // [thicknessFactor, zBack, additive, front-shift]
  for (const [zb, gh, fa] of [[0, 0, 1], [.55, .6, .45], [1.15, .85, .25]]) { const m = waveSheet(gh); m.userData.zb = zb; m.userData.fa = fa; waveLayers.push(m); root.add(m); }
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.visible = false; r.renderOrder = 4; scene3.add(r); shocks.push({ m: r, t: 9, life: .28, s: 1 }); }
  debM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), DEB); debM.frustumCulled = false; debM.count = 0; root.add(debM);
  debM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEB * 3), 3);
}
function shockAt(x, y, z, size) { const s = shocks.find(q => q.t >= q.life) || shocks[0]; s.t = 0; s.s = size; s.flat = false; s.life = .28; s.m.position.set(-x, y, z); s.m.visible = true; }
function shockFlat(x, y, z, size) { if (!shocks.length) return; const s = shocks.find(q => q.t >= q.life) || shocks[1]; s.t = 0; s.s = size; s.flat = true; s.life = .6; s.m.position.set(-x, y, z); s.m.visible = true; }
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _sv = new THREE.Vector3();
function debris(x, y, z, size, cols, n, speed, sp) {
  if (!debM) return;
  for (let i = 0; i < n; i++) {
    if (deb.length >= DEB) deb.shift();
    deb.push({ x: x + rr(-.4, .4) * size, y: y + rr(-.2, .5) * size, z: z + rr(-.4, .4) * size, vx: rr(-.3, 1) * speed, vy: rr(.2, 1.1) * speed, vz: rr(-.6, .6) * speed, r: rr(0, 6), w: rr(-12, 12), s: size * rr(.03, .08), c: pick(cols, rnd()), t: 0, life: rr(1.2, 2.2), g: sp ? 0 : 1 });
  }
}
function updFx3D(dt) {
  for (const s of shocks) { if (s.t >= s.life) { s.m.visible = false; continue; } s.t += dt; const k = s.t / s.life; const sc2 = s.s * (.3 + ease(k) * 1.2); s.m.scale.set(sc2, sc2, sc2); s.m.material.opacity = (1 - k) * (1 - k) * (s.flat ? .5 : .55); if (s.flat) s.m.quaternion.setFromAxisAngle(_v.set(1, 0, 0), -Math.PI / 2); else s.m.quaternion.copy(cam3.quaternion); }
  updRing(dt);
  if (!debM) return;
  for (let i = deb.length - 1; i >= 0; i--) {
    const d = deb[i]; d.t += dt; if (d.t > d.life) { deb.splice(i, 1); continue; }
    if (d.g) d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.r += d.w * dt;
    if (d.g && d.y < d.s * .5) { d.y = d.s * .5; d.vy *= -.3; d.vx *= .6; d.vz *= .6; d.w *= .6; }
  }
  for (let i = 0; i < deb.length; i++) {
    const d = deb[i], sz = d.s * Math.min(1, (d.life - d.t) * 3);
    _e.set(d.r, d.r * .7, d.r * .3); _q.setFromEuler(_e); _m4.compose(_v.set(d.x, d.y, d.z), _q, _sv.set(sz, sz, sz)); debM.setMatrixAt(i, _m4);
    _c.setHex(d.c); debM.setColorAt(i, _c);
  }
  debM.count = deb.length; debM.instanceMatrix.needsUpdate = true; if (debM.instanceColor) debM.instanceColor.needsUpdate = true;
}
function updWave3D() {
  const on = wave.on && wave.fade > 0;
  for (const m of waveLayers) m.visible = on;
  if (!on) return;
  const hw = wave.hw, stretch = 1 + Math.min(1.2, wave.v / Math.max(1, cs) * .05);
  wave.vt = lerp(wave.vt, wave.vert ? 1 : 0, 1 - Math.exp(-RDT * 3.2)); if (Math.abs(wave.vt - (wave.vert ? 1 : 0)) < .002) wave.vt = wave.vert ? 1 : 0;
  for (const m of waveLayers) {
    const zb = m.userData.zb, P = m.geometry.attributes.position.array, U = m.material.uniforms;
    U.uT.value = T; U.uFade.value = wave.fade * m.userData.fa; U.uUltra.value = ultraCut ? 1 : 0; U.uHue.value = (T * .35) % 1;
    const zz = wave.z - zb * hw * stretch;
    for (let i = 0; i < NU; i++) {
      const ph = zb * 7.1, u = i / (NU - 1) * 2 - 1, W = hw * .62 * stretch * Math.pow(Math.max(0, 1 - u * u), .55);
      let ex, ey, ez = zz - u * u * hw * .42, bx, by, bz;
      // blend horizontal arch -> vertical arch by rotating smoothly (vt 0..1)
      const t = wave.vt, an = t * Math.PI * .5, ca = Math.cos(an), sa = Math.sin(an);
      const hx = u * hw, hy = 0;  // leading edge lies flat in the cut plane; the crescent comes from the swept-back tips
      const hyc = hy; ex = wave.x + hx * ca - hyc * sa; ey = wave.y + hy * ca + hx * sa;
      if (zb === 0 && i % 3 === 0 && (i / 3 | 0) < TK) { const q = (i / 3 | 0) * 3; EDGE[q] = ex; EDGE[q + 1] = ey; EDGE[q + 2] = ez; }
      bx = lerp(-u * .1, .7, t); by = lerp(.78, -u * .1, t); bz = lerp(-.62, -.7, t);
      for (let j = 0; j < NV; j++) {
        const v = j / (NV - 1), k = (j * NU + i) * 3, d = v * W, curl = v * v * W * .3;
        P[k] = ex + bx * d - u * curl * ca; P[k + 1] = ey + by * d - u * curl * sa; P[k + 2] = ez + bz * d;
      }
    }
    m.geometry.attributes.position.needsUpdate = true;
  }
  updTrail();
}
function render3D() {
  if (!renderer) return;
  sync3D(); updWave3D();
  cam3.position.set(-cam.x, cam.y, cam.z);
  const dx = Math.sin(cam.yaw) * Math.cos(cam.pitch), dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
  cam3.lookAt(-cam.x - dx, cam.y + dy, cam.z + dz);
  const near = clamp(cs * .02, .03, 6), far = Math.max(400, cs * 900);
  if (cam3.fov !== cam.fov * 57.2958 || cam3.near !== near || cam3.far !== far || cam3.aspect !== LW / LH) { cam3.fov = cam.fov * 57.2958; cam3.near = near; cam3.far = far; cam3.aspect = LW / LH; cam3.updateProjectionMatrix(); }
  renderer.render(scene3, cam3);
}
function drawGlow(o) {
  if (!o.glow) return; const R = o.R || o.w * .4;
  toCam(o.x + (o.cut ? o.bx : 0), o.y + R, o.z + (o.cut ? o.bz : 0), tmp); if (tmp[2] < NEAR) return;
  const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2], r = R * F / tmp[2];
  if (x + r * 2 < 0 || x - r * 2 > LW) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, r * .85, x, y, r * 1.5);
  const c = o.m === 'earth' ? '90,160,255' : o.m === 'mars' ? '255,140,90' : o.m === 'venus' ? '255,220,150' : o.m === 'neptune' || o.m === 'uranus' ? '120,200,255' : '255,230,180';
  g.addColorStop(0, `rgba(${c},${o.glow * 2.4})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2); ctx.globalCompositeOperation = 'source-over';
}

// ---------- line helper ----------
function line3(ax, ay, az, bx, by, bz) {
  toCam(ax, ay, az, tA); toCam(bx, by, bz, tB);
  if (tA[2] < NEAR && tB[2] < NEAR) return false;
  if (tA[2] < NEAR) { const t = (NEAR - tA[2]) / (tB[2] - tA[2]); for (let i = 0; i < 3; i++) tA[i] += (tB[i] - tA[i]) * t; }
  else if (tB[2] < NEAR) { const t = (NEAR - tB[2]) / (tA[2] - tB[2]); for (let i = 0; i < 3; i++) tB[i] += (tA[i] - tB[i]) * t; }
  ctx.moveTo(HW + F * tA[0] / tA[2], HH - F * tA[1] / tA[2]); ctx.lineTo(HW + F * tB[0] / tB[2], HH - F * tB[1] / tB[2]); return true;
}

// ---------- sky / background ----------
function dirScreen(x, y, z) { toCamDir(x, y, z, tmp); if (tmp[2] < .05) return null; return [HW + F * tmp[0] / tmp[2], HH - F * tmp[1] / tmp[2], tmp[2]]; }
function drawStars(list, maxY, scale = 1) {
  for (const s of list) {
    toCamDir(s.x, s.y, s.z, tmp); if (tmp[2] < .05) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2]; if (x < 0 || x > LW || y < 0 || y > maxY) continue;
    const tw = .5 + .5 * Math.sin(T * s.s + s.p); ctx.globalAlpha = s.b * (.35 + .65 * tw) * scale; ctx.fillStyle = s.c; ctx.fillRect(x | 0, y | 0, 1, 1);
    if (s.big && tw > .6) { ctx.globalAlpha = (tw - .6) * 1.6 * s.b * scale; ctx.fillRect((x | 0) - 1, y | 0, 3, 1); ctx.fillRect(x | 0, (y | 0) - 1, 1, 3); }
  }
  ctx.globalAlpha = 1;
}
function farCols(kind, cols, hy) {
  for (let x = 0; x < LW; x++) {
    const a = cam.yaw + Math.atan((x + .5 - HW) / F);
    if (kind === 'mount') {
      for (let j = 0; j < 2; j++) {
        const h = (.045 + .028 * Math.sin(a * 2.1 + 1.3 + j * 2.4) + .018 * Math.sin(a * 5.3 + j) + .008 * Math.sin(a * 13.1 + j * 3)) * (j ? .62 : 1);
        const top = hy - F * h; ctx.fillStyle = cols[j]; ctx.fillRect(x, top, 1, hy - top + 1);
      }
    } else if (kind === 'roofs') {
      const b = Math.floor(a * 26), f = a * 26 - b; const h = (.008 + hs(b, 2, 5) * .012) * (1 - Math.abs(f - .5) * 1.1) + .004;
      const top = hy - F * h; ctx.fillStyle = cols; ctx.fillRect(x, top, 1, hy - top + 1); if (hs(b, Math.floor(f * 6), 9) > .78) { ctx.fillStyle = '#ffb860'; ctx.fillRect(x, hy - 2, 1, 1); }
    } else if (kind === 'bamboo') {
      const v = vn3(a * 9, 1.3, 3), v2 = vn3(a * 23, 4.1, 2);
      const cb = hy - F * (.5 + v * .35 + v2 * .12), ct = hy - F * 2.2;
      ctx.fillStyle = cols[2]; ctx.fillRect(x, ct, 1, Math.max(0, cb - ct));
      for (let j = 0; j < 3; j++) {
        const K = 70 + j * 45, b = Math.floor(a * K); if (hs(b, j, 3) < .45) continue;
        const ff = a * K - b; if (ff > .16 + j * .05) continue;
        const top = hy - F * (1.6 - j * .3); ctx.fillStyle = cols[j]; ctx.fillRect(x, top, 1, hy - top + 2);
      }
    } else if (kind === 'sky' || kind === 'neon') {
      const neon = kind === 'neon';
      for (let j = 0; j < 2; j++) {
        const K = neon ? 34 : 46; const b = Math.floor(a * K + j * 7.3), sub = Math.floor((a * K + j * 7.3) * 5) % 5;
        let h = (neon ? .03 : .014) + Math.pow(hs(b, 3, j), 2.2) * (neon ? .15 : .07) + (hs(b, 9, j) > .93 ? (neon ? .1 : .04) : 0);
        h *= j ? .7 : 1;
        if (neon && hs(b, 4, j) > .8) h *= 1 + (1 - Math.abs((a * K + j * 7.3) - b - .5) * 2) * .6;
        const top = hy - F * h; ctx.fillStyle = cols[j]; ctx.fillRect(x, top, 1, hy - top + 1);
        if (sub > 0) for (let yy = top + 2; yy < hy - 1; yy += 2) { const row = Math.floor((hy - yy) / 2); if (hs(b * 5 + sub, row, j + 7) > (neon ? .8 : .74)) { ctx.fillStyle = neon ? (hs(b, row, 2) > .5 ? '#4ff3ff' : '#ff6fe0') : (hs(b, row, 2) > .3 ? '#ffcf7a' : '#ffe9b8'); ctx.globalAlpha = j ? .55 : .9; ctx.fillRect(x, yy, 1, 1); ctx.globalAlpha = 1; } }
        if (neon && sub === 2 && hs(b, 5, j) > .6) { ctx.fillStyle = (Math.sin(T * 4 + b) > 0) ? '#ff4fd8' : '#4ff3ff'; ctx.fillRect(x, top, 1, 1); }
      }
    }
  }
}
function drawSky() {
  const K = scene.sky; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (K.space) { drawSpace(K); return; }
  const hy = HH + F * Math.tan(cam.pitch);
  const g = ctx.createLinearGradient(0, hy - F * 1.3, 0, hy);
  g.addColorStop(0, K.top); g.addColorStop(K.mid2 ? .45 : .6, K.mid); if (K.mid2) g.addColorStop(.8, K.mid2); g.addColorStop(1, K.hor);
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, Math.max(0, hy + 1));
  if (K.stars) drawStars(scene.stars, hy, .9);
  if (K.sun) {
    const [az, el, col, size] = K.sun; const p = dirScreen(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    if (p) { const r = Math.max(3, F * size); ctx.globalCompositeOperation = 'lighter'; const sg = ctx.createRadialGradient(p[0], p[1], r * .3, p[0], p[1], r * 5); if (K.moon) { sg.addColorStop(0, 'rgba(170,200,255,.38)'); sg.addColorStop(.3, 'rgba(110,140,220,.13)'); sg.addColorStop(1, 'rgba(60,80,160,0)'); } else { sg.addColorStop(0, 'rgba(255,240,200,.55)'); sg.addColorStop(.3, 'rgba(255,200,140,.18)'); sg.addColorStop(1, 'rgba(255,180,120,0)'); } ctx.fillStyle = sg; ctx.fillRect(p[0] - r * 5, p[1] - r * 5, r * 10, r * 10); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); if (K.moon) { ctx.fillStyle = 'rgba(190,180,140,.5)'; for (const [mx, my, mr] of [[-.3, -.2, .28], [.25, .1, .22], [-.05, .35, .16], [.35, -.3, .12]]) { ctx.beginPath(); ctx.arc(p[0] + mx * r, p[1] + my * r, mr * r, 0, 7); ctx.fill(); } } }
  }
  if (K.bigPlanet) {
    const p = dirScreen(Math.sin(.35) * .82, .55, Math.cos(.35) * .82); if (p) { const r = F * .2; ctx.fillStyle = '#3a2a6a'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a8a'; ctx.beginPath(); ctx.arc(p[0] - r * .25, p[1] - r * .2, r * .8, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,140,220,.6)'; ctx.lineWidth = Math.max(1, r * .06); ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 1.9, r * .38, -.25, 0, 7); ctx.stroke(); }
  }
  for (const c of scene.clouds) {
    const p = dirScreen(Math.sin(c.a) * Math.cos(c.e), Math.sin(c.e), Math.cos(c.a) * Math.cos(c.e)); if (!p) continue;
    const w = c.w * F; if (p[0] < -w || p[0] > LW + w) continue;
    for (let i = 0; i < 6; i++) { const ox = (hs(c.k, i, 1) - .5) * w * 1.6, oy = (hs(c.k, i, 2) - .5) * w * .25, r = w * (.18 + hs(c.k, i, 3) * .22); ctx.fillStyle = K.moon ? '#121a30' : '#c9dff2'; ctx.beginPath(); ctx.ellipse(p[0] + ox, p[1] + oy + r * .18, r, r * .55, 0, 0, 7); ctx.fill(); ctx.fillStyle = K.moon ? '#25304e' : '#ffffff'; ctx.beginPath(); ctx.ellipse(p[0] + ox, p[1] + oy, r * .92, r * .5, 0, 0, 7); ctx.fill(); }
  }
  if (K.far) farCols(K.far, K.farC, hy);
  if (K.roofs) farCols('roofs', K.roofs, hy);
  // haze
  const mg = ctx.createLinearGradient(0, hy - F * .2, 0, hy + 1); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, K.hor); ctx.globalAlpha = .55; ctx.fillStyle = mg; ctx.fillRect(0, hy - F * .2, LW, F * .2 + 1); ctx.globalAlpha = 1;
  // ground
  const gg = ctx.createLinearGradient(0, hy, 0, LH); gg.addColorStop(0, K.gnd[0]); gg.addColorStop(.18, K.gnd[1]); gg.addColorStop(1, K.gnd[2]);
  ctx.fillStyle = gg; ctx.fillRect(0, Math.max(0, hy), LW, LH - hy + 1);
  const far = 40 * Math.max(1, cs * .7);
  for (const d of scene.dots) {
    toCam(d[0], 0, d[1], tmp); if (tmp[2] < .3 || tmp[2] > far) continue;
    const x = HW + F * tmp[0] / tmp[2]; if (x < 0 || x > LW) continue; const y = HH - F * tmp[1] / tmp[2]; if (y > LH || y < 0) continue;
    ctx.fillStyle = d[2]; ctx.fillRect(x | 0, y | 0, tmp[2] < 5 ? d[3] + 1 : d[3], 1);
  }
  if (K.road) { ctx.strokeStyle = 'rgba(240,240,230,.7)'; ctx.lineWidth = 1; ctx.beginPath(); for (let z = -10; z < K.endZ + 40; z += 6) line3(-4.6, 0, z, -4.6, 0, z + 3); ctx.stroke(); ctx.strokeStyle = 'rgba(160,160,170,.6)'; ctx.beginPath(); line3(12, 0, -10, 12, 0, K.endZ + 40); line3(-16, 0, -10, -16, 0, K.endZ + 40); ctx.stroke(); }
  if (K.grid) {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
    const gz = Math.floor(cam.z / 12) * 12;
    ctx.strokeStyle = 'rgba(79,243,255,.32)'; ctx.beginPath(); for (let x = -120; x <= 120; x += 12) line3(x, 0, gz - 60, x, 0, gz + 240); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,79,216,.28)'; ctx.beginPath(); for (let z = gz - 60; z <= gz + 240; z += 12) line3(-120, 0, z, 120, 0, z); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (K.rays) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const x0 = ((i * 53 + 20) % 100) / 100 * LW; ctx.fillStyle = `rgba(170,200,255,${.025 + .015 * Math.sin(T * .5 + i)})`; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + LW * .12, 0); ctx.lineTo(x0 + LW * .45, LH); ctx.lineTo(x0 + LW * .22, LH); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
}
const warpP = [];
function drawWarp(k) {
  if (!(state === 'chase' || state === 'final' || state === 'wide') || !wave.on) return;
  const S = Math.max(6, cs) * 3.2, L = S * 7, sp = clamp(wave.v / Math.max(1, cs), 0, 40), len = Math.min(L * .45, wave.v * .085 + S * .04);
  while (warpP.length < 190) warpP.push({ x: 0, y: 0, z: -1e9, s: 0 });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const kk = k * clamp(sp / 8, .2, 1);
  for (const p of warpP) {
    if (p.s !== S || p.z < cam.z - S * .3 || p.z > cam.z + L * 1.3 || Math.hypot(p.x - cam.x, p.y - cam.y) > S * 3) { const a = Math.random() * 6.283, r = S * (.35 + Math.random() * 1.7); p.x = cam.x + Math.cos(a) * r; p.y = cam.y + Math.sin(a) * r; p.z = cam.z + (p.s !== S ? Math.random() : .85 + Math.random() * .4) * L; p.s = S; }
    if (!proj(p.x, p.y, p.z, tA)) continue; const zb = Math.max(p.z - len, cam.z + S * .08); if (!proj(p.x, p.y, zb, tB)) continue;
    const a = clamp(1 - (p.z - cam.z) / L, 0, 1) * kk; if (a < .02) continue;
    ctx.strokeStyle = `rgba(185,210,255,${(a * .85).toFixed(3)})`; ctx.lineWidth = .6 + a * 1.2; ctx.beginPath(); ctx.moveTo(tA[3], tA[4]); ctx.lineTo(tB[3], tB[4]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawSpace(K) {
  ctx.fillStyle = '#020309'; ctx.fillRect(0, 0, LW, LH);
  ctx.globalCompositeOperation = 'lighter';
  for (const nb of scene.neb) { const p = dirScreen(nb.d[0], nb.d[1], nb.d[2]); if (!p) continue; const r = nb.r * F; const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); g.addColorStop(0, `rgba(${nb.c},${nb.a})`); g.addColorStop(1, `rgba(${nb.c},0)`); ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
  drawStars(scene.stars, LH, 1);
  drawWarp(K.gal ? 1 : .5);
  if (K.gal) for (const g of scene.gals) { const p = dirScreen(g.d[0], g.d[1], g.d[2]); if (!p) continue; const r = Math.max(1, g.r * F); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,210,255,.5)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * g.q, g.t, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.fillRect(p[0] | 0, p[1] | 0, 1, 1); ctx.globalCompositeOperation = 'source-over'; }
  if (!K.gal) { const p = dirScreen(LX / LN, LY / LN, LZ / LN); if (p) { const r = Math.max(4, F * .09); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p[0], p[1], r * .4, p[0], p[1], r * 7); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(.2, 'rgba(255,190,100,.3)'); g.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g; ctx.fillRect(p[0] - r * 7, p[1] - r * 7, r * 14, r * 14); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); } }
}

// ---------- particles ----------
let parts = [], slashes = [];
function addP(p) { if (parts.length < 900) parts.push(p); }
const hx6 = c => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
function burst(o) {
  const s = o.fs, x = o.x, y = o.cutY, z = o.z, sp = !!scene.space;
  for (let i = 0; i < 18; i++) addP({ x: x + rr(-.3, .3) * o.w * .4, y, z: z + rr(-.3, .3) * o.w * .3, vx: rr(-1, 3) * s * .5, vy: rr(-.5, 2.5) * s * .45, vz: rr(-1.5, 3) * s * .4, life: rr(.5, 1.1), t: 0, k: 'chip', c: hx6(pick(o.chip, rnd())), s: s * rr(.015, .035), g: sp ? 0 : 1 });
  for (let i = 0; i < 12; i++) addP({ x, y, z, vx: rr(-5, 5) * s * .4, vy: rr(-2, 4) * s * .4, vz: rr(-2, 6) * s * .4, life: rr(.12, .4), t: 0, k: 'spark', c: rnd() < .4 ? '#ffe680' : '#ffffff', s: s * .02, g: 0 });
  if (ultraCut) for (let i = 0; i < 8; i++) addP({ x, y, z, vx: rr(-4, 4) * s * .4, vy: rr(-3, 3) * s * .4, vz: rr(-3, 5) * s * .4, life: rr(.3, .6), t: 0, k: 'spark', c: `hsl(${rnd() * 360 | 0},100%,70%)`, s: s * .025, g: 0 });
}
function dust(x, z, n, s) { for (let i = 0; i < n; i++) addP({ x: x + rr(-1.5, 1.5) * s * .4, y: .05, z: z + rr(-1.5, 1.5) * s * .4, vx: rr(-.8, .8) * s * .4, vy: rr(.2, .9) * s * .3, vz: rr(-.8, .8) * s * .4, life: rr(.7, 1.5), t: 0, k: 'dust', c: scene.id === 'dojo' || scene.id === 'town' ? '#d8ccb0' : scene.id === 'bamboo' ? '#7a7a50' : '#6a6a78', s: s * .12, g: 0 }); }
function smoke(x, y, z, s, n) { const c = scene.id === 'future' ? '#8e7cb0' : scene.id === 'bamboo' ? '#8a8e78' : '#a29c98'; for (let i = 0; i < n; i++) addP({ x: x + rr(-.5, .5) * s, y: y + rr(-.25, .35) * s, z: z + rr(-.5, .5) * s, vx: rr(-.7, .7) * s, vy: rr(.15, .7) * s, vz: rr(-.3, .9) * s, life: rr(.9, 1.9), t: 0, k: 'smoke', c, s: s * rr(.22, .42), g: 0 }); }
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
    if (p.k === 'dust' || p.k === 'smoke') { const dm = p.k === 'smoke' ? .955 : .94; p.vx *= dm; p.vy *= dm; p.vz *= dm; } else if (p.g) p.vy -= 9.8 * dt * (p.k === 'spark' ? .3 : 1);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.g && p.y < 0) { p.y = 0; p.vy *= -.25; p.vx *= .6; p.vz *= .6; }
  }
}
function drawParts() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of parts) {
    toCam(p.x, p.y, p.z, tmp); if (tmp[2] < .15) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2]; if (x < -4 || x > LW + 4 || y < -4 || y > LH + 4) continue;
    const a = 1 - p.t / p.life, sz = clamp(p.s * F / tmp[2], 1, p.k === 'dust' ? 30 : p.k === 'smoke' ? 70 : 5);
    if (p.k === 'spark') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(x, y, sz, sz); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'smoke') { const r2 = sz * (1 + p.t * 1.6) * .5; ctx.globalAlpha = a * .32 * Math.min(1, p.t * 8); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(x, y, r2, 0, 6.283); ctx.fill(); ctx.globalAlpha *= .6; ctx.beginPath(); ctx.arc(x - r2 * .25, y - r2 * .2, r2 * .6, 0, 6.283); ctx.fill(); }
    else if (p.k === 'dust') { ctx.globalAlpha = a * .3; ctx.fillStyle = p.c; const s2 = sz * (1 + p.t); ctx.fillRect(x - s2 / 2, y - s2 / 2, s2, s2); }
    else { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c; ctx.fillRect(x, y, sz, sz); }
  }
  ctx.globalAlpha = 1;
  if (scene.traffic) { ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1; for (const c of scene.traffic) { const zz = c.z + ((T * c.v) % 300); toCam(c.x, c.y, zz, tmp); if (tmp[2] < .5 || tmp[2] > 260) continue; ctx.strokeStyle = c.c; ctx.globalAlpha = .8; ctx.beginPath(); line3(c.x, c.y, zz, c.x, c.y, zz - c.v * .12); ctx.stroke(); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
}
function bladeEdgePts() {
  const hw = wave.hw, t = wave.vt, an = t * Math.PI * .5, ca = Math.cos(an), sa = Math.sin(an), pts = [];
  for (let k = 0; k < TK; k++) { const u = k * 3 / (NU - 1) * 2 - 1, hx = u * hw, hy = 0, hyc = 0; pts.push([wave.x + hx * ca - hyc * sa, wave.y + hy * ca + hx * sa, wave.z - u * u * hw * .42]); }
  return pts;
}
function drawSlashes() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  for (const s of slashes) {
    const a = 1 - s.t / s.life; if (a <= 0) continue; const L = s.L * (.85 + (1 - a) * .5);
    if (s.pts) {
      const P2 = []; for (const q of s.pts) { if (proj(q[0], q[1], q[2], tA)) P2.push([tA[3], tA[4], clamp(1 - (Math.abs(q[0] - s.x) - s.L) / Math.max(.01, s.L), 0, 1)]); else P2.push(null); }
      const fl = .85 + .15 * Math.sin(T * 70); ctx.lineCap = 'round';
      const pass = (col, lw) => { ctx.lineWidth = lw; for (let i = 1; i < P2.length; i++) { const p0 = P2[i - 1], p1 = P2[i]; if (!p0 || !p1) continue; const k = Math.min(p0[2], p1[2]) * a; if (k < .02) continue; ctx.strokeStyle = col(k); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); } };
      pass(k => ultraCut ? `hsla(${(T * 400) % 360},100%,65%,${k * .22})` : `rgba(120,180,255,${k * .2})`, 11);
      pass(k => ultraCut ? `hsla(${(T * 400 + 60) % 360},100%,72%,${k * .6})` : `rgba(160,210,255,${k * .55})`, 4.5);
      pass(k => `rgba(255,255,255,${k * fl})`, 1.8);
      continue;
    }
    if (s.a) { if (!proj(s.a[0], s.a[1], s.a[2], tA)) continue; if (!proj(s.b[0], s.b[1], s.b[2], tB)) continue; }
    else { if (!proj(s.x - L, s.y + L * .12, s.z - .05 * L, tA)) continue; if (!proj(s.x + L, s.y - L * .12, s.z + .05 * L, tB)) continue; }
    const ax = tA[3], ay = tA[4], bx2 = tB[3], by2 = tB[4], fl = .85 + .15 * Math.sin(T * 70);
    if (s.gr) { ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,80,200,${a * .3})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke(); ctx.strokeStyle = `rgba(255,170,240,${a * .8})`; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2.2; ctx.stroke(); continue; }
    ctx.lineCap = 'round';
    ctx.strokeStyle = ultraCut ? `hsla(${(T * 400) % 360},100%,65%,${a * .22})` : `rgba(120,180,255,${a * .2})`; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
    ctx.strokeStyle = ultraCut ? `hsla(${(T * 400 + 60) % 360},100%,72%,${a * .6})` : `rgba(160,210,255,${a * .55})`; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * fl})`; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].t > slashes[i].life) slashes.splice(i, 1);
}
function boltPath(c, x1, y1, x2, y2, amp, segs) {
  c.beginPath(); c.moveTo(x1, y1); const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 1; i < segs; i++) { const t = i / segs, o = (Math.random() - .5) * 2 * amp * Math.sin(t * Math.PI); c.lineTo(x1 + dx * t + nx * o, y1 + dy * t + ny * o); }
  c.lineTo(x2, y2);
}
function bolt(c, x1, y1, x2, y2, amp, segs, hue, w) {
  boltPath(c, x1, y1, x2, y2, amp, segs);
  c.strokeStyle = `hsla(${hue},100%,65%,.55)`; c.lineWidth = w * 3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = w; c.stroke();
}
// slash wave crescent
const wave = { on: false, x: 0, y: 1, z: 0, v: 0, fade: 1, hw: .6, vert: false, vt: 0 };
function drawWave() {
  if (!wave.on || !ultraCut || wave.fade < .3) return;
  const hw = wave.hw; const P = u => wave.vert ? [wave.x - u * u * hw * .25, wave.y + u * hw, wave.z - u * u * hw * .5] : [wave.x + u * hw, wave.y - u * hw * .42, wave.z - u * u * hw * .5];
  const a = P(-1), b = P(1); if (!proj(a[0], a[1], a[2], tA) || !proj(b[0], b[1], b[2], tB)) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const t = Math.random(); const sx = lerp(tA[3], tB[3], t), sy = lerp(tA[4], tB[4], t); bolt(ctx, sx, sy, sx + (Math.random() - .5) * 40, sy + (Math.random() - .5) * 40, 6, 6, Math.random() * 360, 1); }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- katana (screen-space pixel art) ----------
function drawKatana(t, mode) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = LW / 200; const breathe = Math.sin(T * 1.6) * 1.2 * u;
  let hx = LW * .92, hy = LH * .86 + breathe + (1 - ease(kataIn)) * 90 * u;
  if (qi >= 2) { hx += (Math.random() - .5) * 1.6 * u; hy += (Math.random() - .5) * 1.6 * u; }
  let ang = -2.76;
  if (mode === 1) { ang = lerp(-2.76, -2.76 + 3.4, ease(t)); hx += t * 40 * u; hy -= Math.sin(t * Math.PI) * 30 * u; }
  const c = Math.cos(ang), s = Math.sin(ang);
  ctx.setTransform(c, s, -s, c, hx | 0, hy | 0);
  const tsukaL = 46 * u, tw = 9 * u;
  ctx.fillStyle = '#0c0c10'; ctx.fillRect(-6 * u, -tw / 2, tsukaL + 6 * u, tw);
  ctx.fillStyle = '#e9e4d4';
  for (let x = -2 * u; x < tsukaL - 4 * u; x += 7 * u) { ctx.beginPath(); ctx.moveTo(x, -tw / 2); ctx.lineTo(x + 3.5 * u, 0); ctx.lineTo(x, tw / 2); ctx.lineTo(x + 2 * u, tw / 2); ctx.lineTo(x + 5.5 * u, 0); ctx.lineTo(x + 2 * u, -tw / 2); ctx.fill(); }
  ctx.fillStyle = '#b8902e'; ctx.fillRect(-7 * u, -tw / 2 - 1, 3 * u, tw + 2); ctx.fillRect(tsukaL - 4 * u, -tw / 2 - 1, 4 * u, tw + 2);
  ctx.fillStyle = '#6b5420'; ctx.fillRect(tsukaL, -tw * 1.25, 3 * u, tw * 2.5);
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(tsukaL, -tw * 1.25, 1 * u, tw * 2.5);
  ctx.fillStyle = '#c79a32'; ctx.fillRect(tsukaL + 3 * u, -tw / 2 + 1, 3 * u, tw - 2);
  const bx = tsukaL + 6 * u;
  if (mode === 0) {
    const sl = 150 * u, sw = 8 * u;
    ctx.fillStyle = '#07070b'; ctx.fillRect(bx, -sw / 2, sl, sw);
    ctx.fillStyle = '#23253a'; ctx.fillRect(bx, -sw / 2 + 1, sl, Math.max(1, u));
    ctx.fillStyle = '#4b5070'; ctx.fillRect(bx + 8 * u, -sw / 2 + 1, sl * .5, 1);
    ctx.fillStyle = '#c79a32'; ctx.fillRect(bx, -sw / 2, 3 * u, sw);
    ctx.fillStyle = '#5a1420'; ctx.fillRect(bx + 18 * u, -sw / 2 - 1, 5 * u, sw + 2);
    ctx.fillStyle = '#8a2a36'; ctx.fillRect(bx + 18 * u, sw / 2, 2 * u, 14 * u);
    if (qi >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      const gx = bx + ((T * (qi >= 2 ? 260 : 120) * u) % (sl * 1.6));
      ctx.fillStyle = qi >= 2 ? `hsla(${(T * 500) % 360},100%,70%,.95)` : 'rgba(255,230,140,.7)'; ctx.fillRect(gx, -sw / 2, (qi >= 2 ? 10 : 4) * u, qi >= 2 ? 2 : 1);
      if (qi >= 2) {
        for (let k = 0; k < 3; k++) { const p0 = bx + Math.random() * sl, p1 = p0 + (Math.random() - .3) * 40 * u; boltPath(ctx, p0, (Math.random() - .5) * sw, p1, (Math.random() - .5) * 30 * u, 5 * u, 5); ctx.strokeStyle = `hsla(${Math.random() * 360},100%,70%,.9)`; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.strokeStyle = `hsla(${(T * 300) % 360},100%,65%,.35)`; ctx.lineWidth = 3 * u; ctx.strokeRect(bx - 2 * u, -sw / 2 - 2 * u, sl + 4 * u, sw + 4 * u);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    const bl = 150 * u;
    ctx.fillStyle = '#9aa6b8'; ctx.beginPath(); ctx.moveTo(bx, -3.5 * u); ctx.lineTo(bx + bl, -2 * u); ctx.lineTo(bx + bl + 8 * u, 1 * u); ctx.lineTo(bx + bl, 3 * u); ctx.lineTo(bx, 3 * u); ctx.fill();
    ctx.fillStyle = '#f4f8ff'; ctx.fillRect(bx, 1 * u, bl, Math.max(1, u));
    ctx.fillStyle = '#5b6578'; ctx.fillRect(bx, -3.5 * u, bl, Math.max(1, u));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === 1 && t > .1 && t < .85) {
    ctx.globalCompositeOperation = 'lighter';
    const a0 = lerp(-2.76, -2.76 + 3.4, ease(t - .15)), a1 = lerp(-2.76, -2.76 + 3.4, ease(t));
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k === 0 ? (ultraCut ? `hsla(${(T * 500) % 360},100%,60%,.45)` : 'rgba(120,180,255,.25)') : k === 1 ? 'rgba(200,230,255,.5)' : 'rgba(255,255,255,.95)';
      ctx.lineWidth = (6 - k * 2.3) * u * (ultraCut && k === 0 ? 2 : 1);
      ctx.beginPath(); ctx.arc(hx, hy, 175 * u, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- game state ----------
let state = 'title', T = 0, stT = 0;
let qi = 0, qiFullAt = 0, qiUltraAt = 0, kataIn = 0;
const OW = { x: 0, v: 0, t: 0 }, FLW = { x: 0, v: 0, t: 0 }; let flight = null, burstT = -9; let quake = 0, orbit = null, orbK = 0, ringF = 0; let timeScale = 1, hitstop = 0, shake = 0, flash = 0, split = 0, splitAng = -.4, slowT = 0;
let power = 0, perfect = false, ultraCut = false, REACH = 0, rDisp = 0, nextIdx = 0, finalObj = null, stopped = false, galaxyDone = false;
const fol = { x: -1.1, y: .3, z: -2.2 }, anc = { x: 0, y: 1 };
const smooth = t => t * t * (3 - 2 * t);
let galCutT = -1; const galSpin = () => galCutT < 0 ? 0 : .42 * (1 - Math.exp(-(T - galCutT) * .32));
// chase shot presets (th: azimuth, negative = camera on the left of travel; ph: elevation; d: distance; L: look-ahead; ly: look height; du: dutch)
const SHOTS = [
  { th: -.42, ph: .17, d: 2.3, L: 2.4, ly: .05, fov: 1.12, du: -.05 },   // chase
  { th: -.62, ph: -.03, d: 1.65, L: 2.8, ly: .3, fov: 1.3, du: .11 },   // low skim, looking up
  { th: -.95, ph: .1, d: 2.35, L: 1.3, ly: .02, fov: 1.08, du: -.08 },  // side tracking
  { th: -.48, ph: .46, d: 2.6, L: 2.1, ly: -.18, fov: 1.12, du: .05 },  // high three-quarter
];
SHOTS.hero = { th: -.82, ph: -.06, d: 1.85, L: 1.5, ly: .6, fov: 1.27, du: .13 };
const SEQ = [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 2, 0];
const CS = {}; for (const k of ['th', 'ph', 'd', 'L', 'ly', 'fov', 'du']) CS[k] = { x: SHOTS[0][k === 'fov' ? 'fov' : k], v: 0, t: 0 };
let shotHold = 0, dirO = null, dirZ0 = 0, shotK = 0, shotN = 0, earthCut = false; const FW = { x: 0, v: 0, t: 0 }, FP = { x: 0, y: 1, z: 0 }, FT = { x: 0 }; let GRs = 1;
function pickShot(o) { shotN++; if (o.kind === 'galaxy') return 0; return scene.space ? [0, 2, 3][shotN % 3] : SEQ[shotN % SEQ.length]; }
function spring(sp2, dt, w, z) { const n = Math.max(1, Math.ceil(dt / .012)), h = dt / n; for (let i = 0; i < n; i++) { const a = w * w * (sp2.t - sp2.x) - 2 * z * w * sp2.v; sp2.v += a * h; sp2.x += sp2.v * h; } }
function camReset() { galCutT = -1; for (const k in CS) { CS[k].x = SHOTS[0][k]; CS[k].v = 0; } dirO = null; OW.x = OW.v = 0; FLW.x = FLW.v = 0; flight = null; GRs = scene && scene.space ? 1 : waveGrow(); FW.x = FW.v = 0; FP.x = wave.x; FP.y = wave.y; FP.z = wave.z; }
function camImpulse(o) {
  const big = o.big || o.kind === 'planet';
  CS.d.v += big ? 2.6 : .45; CS.fov.v += big ? 2.6 : .7; CS.du.v += kickDir * (big ? 1.1 : .12); CS.th.v += big ? 1.3 : .05; if (big) CS.ph.v += .6;
} let galS = 0, RDT = .016;
let camKick = 0, kickDir = 1, cs = 1.2, shot = 0, cutsInScene = 0, trans = null, shownStage = -1;
let camS = { px: 0, py: 1.5, pz: -1, tx: 0, ty: 1, tz: 5, fov: 1.05, roll: 0 };
let best = 0; try { best = +localStorage.getItem('choiai_best') || 0; } catch (e) {}
let lang = detectLang(), soundOn = true; try { soundOn = localStorage.getItem('choiai_snd') !== '0'; } catch (e) {}
let inputMode = 'motion';
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const RANK_TH = [0, 1, 2, 3, 4, 6, 10, 14];
const rankOf = r => { let k = 0; for (let i = 0; i < RANK_TH.length; i++) if (r >= RANK_TH[i] - 1e-9) k = i; return k; };
const stageOf = r => clamp(Math.floor(r - 1e-9), 0, 13);
function distOf(r) { r = clamp(r, 0, 14); const s = Math.min(13, Math.floor(r)), t = r - s; if (s === 0) return STAGE_D[1] * t; return STAGE_D[s] * Math.pow(STAGE_D[s + 1] / STAGE_D[s], t); }
function fmtDist(m) {
  const t = tx(); const ly = 9.4607e15;
  const nf = (v, compact) => { try { return new Intl.NumberFormat(lang, compact ? { notation: 'compact', maximumFractionDigits: v < 1e5 ? 1 : 1 } : { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v); } catch (e) { return String(Math.round(v)); } };
  if (m >= ly * .05) { const v = m / ly; return [v >= 1e5 ? nf(v, true) : nf(v), t.ly]; }
  if (m < 1000) return [nf(m), 'm'];
  const km = m / 1000; return [km >= 1e5 ? nf(km, true) : nf(km), 'km'];
}
const canCut = o => REACH >= o.stage + (o.jj + 1) / o.cnt - 1e-9;
function setScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
function loadScene(i) { sceneI = i; scene = getScene(i); for (const o of scene.objs.concat(scene.deco)) { o.cut = false; o.piece = null; o.shake = 0; o.bx = o.by = o.bz = 0; o.gal = null; } deb.length = 0; attachScene(scene); for (const m of waveLayers) root.add(m); if (debM) root.add(debM); if (ringM) root.add(ringM, ringD); if (trailM) { root.add(trailM); trailH.length = 0; } orbit = null; ringO = null; ringF = 0; parts = []; slashes = []; nextIdx = 0; cutsInScene = 0; A.scene(SCENES[i]); }
function resetAll() { loadScene(0); wave.on = false; trans = null; finalObj = null; stopped = false; galaxyDone = false; rDisp = 0; shownStage = -1; slowT = 0; }
function go(s) {
  state = s; stT = 0;
  if (s === 'title') { setScreen('sTitle'); app.classList.remove('cine'); resetAll(); }
  if (s === 'ready') { setScreen('sReady'); qi = 0; qiFullAt = 0; qiUltraAt = 0; kataIn = 0; resetAll(); capture = null; updReadyUI(); app.classList.remove('cine'); }
  if (s === 'slash') setScreen('');
  if (s === 'chase') { setScreen('sHud'); app.classList.add('cine'); updHud(true); }
  if (s === 'result') showResult();
}

// ---------- trigger ----------
function fire(p) {
  if (state !== 'ready') return;
  power = clamp(p, 0, 1);
  ultraCut = qi >= 2;
  perfect = ultraCut && (T - qiUltraAt) < 1.2;
  const mult = qi < 1 ? .45 + .45 * qi : qi < 2 ? 1 + .3 * (qi - 1) : (perfect ? 2.12 : 2);
  REACH = clamp(7.4 * Math.pow(power, .9) * mult, .21, 14);
  go('slash');
  hitstop = .09; flash = 1; shake = 1; split = 1; splitAng = rr(-.55, -.3);
  A.sheath(); A.whoosh(power); if (ultraCut) A.ultraFire(); vib([30, 20, 60]);
  wave.on = false;
  const t = tx(); cutin(perfect ? `<em>${t.perfect}</em>` : ultraCut ? `<em>${t.ultra}</em>` : t.cut, '');
}
function startChase() {
  go('chase');
  const o = scene.objs[0];
  wave.on = true; wave.z = .6; wave.x = 0; wave.y = o.cutY; wave.v = 0; wave.fade = 1; wave.vert = false;
  cs = o.fs; shot = 0; timeScale = .45; shownStage = 0; chaseT = 0; fol.x = -1.1; fol.y = .3; fol.z = -2.2; anc.x = wave.x; anc.y = wave.y; galS = 0; wave.vt = 0; camReset(); earthCut = false;
}
function startPiece(o) {
  const fdz = rr(-.5, .2), fl = Math.hypot(1, fdz), dx = 1 / fl, dz = fdz / fl;
  const p = { x: o.x, y: o.cutY, z: o.z, dx, dz, kx: dz, kz: -dx, th: .02, w: 0, vx: 0, vy: 0, vz: 0, landed: 0, slide: 0, spin: 0 };
  const L = o.h - o.h * o.cutF, sq = Math.sqrt(o.fs);
  if (o.kind === 'tall' || o.kind === 'wide') { const sd = rr(.2, .5), l2 = Math.hypot(sd, 1); p.dx = sd / l2; p.dz = 1 / l2; p.kx = p.dz; p.kz = -p.dx; p.ws = rr(-1.2, 1.2); }
  if (o.kind === 'tall') { p.w = 2.4 + power * 1.8; p.vx = p.dx * (1.4 + power * 1.8) * sq; p.vz = p.dz * (2.2 + power * 2.6) * sq; p.vy = (1.8 + power * 1.8) * sq; p.L = L; }
  else if (o.kind === 'wide') { p.vs = (2.4 + 3 * power) * sq * .8; p.vy = (2.6 + 2.2 * power) * sq; p.w = 2.6 + power * 1.4; p.ws = rr(-2.5, 2.5); }
  else if (o.kind === 'planet') { const v = o.R * (.3 + .4 * power); p.vx = Math.abs(dx) * v * .8; p.vz = v * .25; p.vy = o.R * .7; p.w = .18 + power * .15; p.spin = 0; o.bvx = Math.abs(dx) * v * .15; o.bvz = v * .1; o.bvy = -o.R * .6; }
  o.piece = p;
}
function cutObj(o) {
  o.cut = true; o.cutT = T;
  if (o.kind === 'galaxy') { o.gal = { off: 0, th: 0, dz: 0, v: o.w * .17 * (1 + power) }; galaxyDone = true; }
  else startPiece(o);
  if (o.kind === 'galaxy') { galCutT = T; const Rg = o.w * .5, gy = o.y + o.h / 2; o.cutY = gy; slashes.push({ x: o.x, y: gy, z: o.z, pts: bladeEdgePts(), t: 0, life: 2.2, L: Rg }); for (let i = 0; i < 160; i++) { const xx = o.x + rr(-1, 1) * Rg; addP({ x: xx, y: gy + rr(-.02, .02) * Rg, z: o.z, vx: rr(-.1, .1) * Rg, vy: rr(-1, 1) * Rg * .25, vz: rr(-.1, .1) * Rg, life: rr(.6, 1.6), t: 0, k: 'spark', c: ultraCut ? `hsl(${rnd() * 360 | 0},100%,75%)` : rnd() < .5 ? '#ffffff' : '#bcd8ff', s: Rg * .012, g: 0 }); } shockFlat(o.x, o.y + o.h / 2, o.z, Rg * 1.4); }
  else slashes.push({ x: o.x, y: o.cutY, z: o.z, pts: bladeEdgePts(), t: 0, life: .55, L: o.w * (o.kind === 'planet' ? .8 : .7) });
  burst(o); shockAt(o.x, o.cutY, o.z, o.fs * (o.big ? .75 : .45));
  if (o.kind !== 'galaxy') debris(o.x, o.cutY, o.z, o.kind === 'planet' ? o.R * 1.2 : Math.min(o.w, o.fs * 1.2), o.chip, o.kind === 'planet' ? 70 : o.big ? 46 : 28, o.fs * (3 + power * 2.5), !!scene.space);
  if (!scene.space) smoke(o.x, o.cutY, o.z, Math.min(o.w, o.fs) * .5, o.big ? 12 : 7);
  camKick = 1; kickDir = -kickDir; flash = Math.max(flash, .1); camImpulse(o);
  if (o.kind === 'planet') {
    A.bigCut(); vib([30, 30, 60]); flash = Math.max(flash, o.meteor ? .12 : .26);
    quake = Math.max(quake, o.meteor ? .55 : 1); shake = Math.max(shake, .7);
    shockFlat(o.x, o.cutY, o.z, o.R * (o.meteor ? 2.4 : 3.4)); shockAt(o.x, o.cutY, o.z, o.R * 2.6);
    timeScale = Math.min(timeScale, o.meteor ? .4 : .12); slowT = o.meteor ? .05 : .22;
  } else if (o.big) { A.bigCut(); timeScale = Math.min(timeScale, .3); slowT = .08; shake = Math.max(shake, .5); quake = Math.max(quake, .35); flash = Math.max(flash, .2); vib([20, 30, 40]); } else { A.cut(cutsInScene); shake = Math.max(shake, .12); timeScale = Math.min(timeScale, .5); slowT = Math.max(slowT, .04); }
  cutsInScene++;
  const n = $('#cNum'); n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
}
function updPieces(dt) {
  const objs = scene.objs;
  for (const o of objs) {
    if (o.shake > 0) o.shake = Math.max(0, o.shake - dt * 1.4);
    if (o.kind === 'galaxy' && o.gal) { const g = o.gal; g.off += g.v * dt; g.v *= Math.exp(-dt * .35); g.th = 0; g.dz += g.v * .04 * dt; continue; }
    const p = o.piece; if (!p || p.landed === 2) continue;
    if (o.kind === 'planet') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.th = Math.min(1.2, p.th + p.w * dt); o.bx += o.bvx * dt; o.by += o.bvy * dt; o.bz += o.bvz * dt; continue; }
    if (o.kind === 'tall') {
      if (!p.landed) {
        const alpha = 1.5 * 9.8 / p.L * Math.sin(p.th) + .4;
        p.w += alpha * dt; p.th += p.w * dt; p.spin += (p.ws || 0) * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.vy -= 9.8 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y <= 0) { p.vx *= .9; p.vz *= .9; }
        if (p.th >= 1.53) { p.th = 1.53; p.landed = 1; p.w = -p.w * .18; p.vx *= .2; p.vz *= .2; dust(p.x + p.dx * p.L * .6, p.z + p.dz * p.L * .6, 7, o.fs); if (state !== 'title') A.thud(o.fs); }
      } else {
        p.th += p.w * dt; p.w += 6 * dt; p.y = Math.max(0, p.y - 3 * dt); p.x += p.vx * dt; p.z += p.vz * dt;
        if (p.th >= 1.545) { p.th = 1.545; if (Math.abs(p.w) < .5) { p.landed = 2; p.w = 0; } else p.w = -p.w * .2; }
      }
    } else {
      if (!p.landed) {
        const step = p.vs * dt; p.x += p.dx * step; p.z += p.dz * step; p.slide += step; p.vs *= Math.exp(-dt * .6);
        p.vy -= 9.8 * dt; p.y += p.vy * dt; p.th = Math.min(1.25, p.th + p.w * dt); p.spin += (p.ws || 0) * dt * .6;
        if (p.y <= 0) { p.y = 0; p.landed = 1; dust(p.x, p.z, 10, o.fs); if (state !== 'title') A.thud(o.fs); }
      } else { p.vs *= Math.exp(-dt * 6); const step = p.vs * dt; p.x += p.dx * step; p.z += p.dz * step; p.th = lerp(p.th, .32, 1 - Math.exp(-dt * 6)); if (p.vs < .05) p.landed = 2; }
    }
  }
}

// ---------- camera per state ----------
function shotPos(k, wx, wy, wz, c) {
  if (k === 0) return [wx - 1.7 * c, wy + .12 * c, wz - 1.9 * c, wx + .4 * c, wy - .05 * c, wz + 2.4 * c, 1.15, -.07];
  if (k === 1) return [wx - .85 * c, wy - .6 * c, wz - 1.4 * c, wx + .5 * c, wy + .5 * c, wz + 3.0 * c, 1.3, .18];
  if (k === 2) return [wx - 1.3 * c, wy + .3 * c, wz + 3.3 * c, wx + .2 * c, wy - .05 * c, wz - .8 * c, 1.1, -.12];
  return [wx - 2.6 * c, wy + 2.0 * c, wz - 3.2 * c, wx + .6 * c, wy - .3 * c, wz + 3.0 * c, 1.05, .06];
}
function spaceShot(o, i) {
  const R = o.R * (o.m === 'saturn' ? 1.75 : 1.35), cx = o.x, cy = o.y + o.R, cz = o.z, v = i % 3;
  if (v === 0) return [cx - 2.4 * R, cy + .75 * R, cz - 2.7 * R, cx + .35 * R, cy - .05 * R, cz + .2 * R, 1.0, -.04];
  if (v === 1) return [cx - 2.9 * R, cy - .45 * R, cz - 1.6 * R, cx + .2 * R, cy + .1 * R, cz + .3 * R, 1.02, .08];
  return [cx - 1.6 * R, cy + 1.5 * R, cz - 3.0 * R, cx + .3 * R, cy - .1 * R, cz + .1 * R, 1.0, -.06];
}
function camForState(dt) {
  if (state === 'view') return;
  let px, py, pz, tx_, ty, tz, fov = 1.05, roll = 0, snap = false;
  if (state === 'title') {
    const a = T * .07; px = -2.3 + Math.sin(a) * .9; py = 2.1 + Math.sin(T * .2) * .15; pz = -3.2 + Math.cos(a) * .8; tx_ = .4; ty = 2.1; tz = 14; fov = 1.1;
  } else if (state === 'ready' || state === 'slash') {
    const sw = Math.sin(T * .9) * .02; const jit = qi >= 2 ? (Math.random() - .5) * .006 : 0;
    px = -.32 + sw + jit; py = 1.42 + Math.sin(T * 1.6) * .012 + jit; pz = -1.05; tx_ = .05; ty = 1.18; tz = 7; fov = 1.0 - (qi >= 2 ? .16 : qi >= 1 ? .1 + (qi - 1) * .05 : qi * .06);
    if (state === 'slash') { fov -= stT * .4; roll = -stT * .15; }
  } else if (state === 'chase') {
    const o = scene.objs[nextIdx] || scene.objs[scene.objs.length - 1];
    cs = lerp(cs, o.fs, 1 - Math.exp(-dt * 1.5));
    const sp = clamp(wave.v / Math.max(1, cs), 0, 40);
    galS = lerp(galS, o.kind === 'galaxy' ? 1 : 0, 1 - Math.exp(-dt * 1.6)); const gal = galS;
    {
      // ---- shot director: a new framing per target, sprung so it swings and settles ----
      if (dirO !== o) { const far = o.big || scene.space || o.z - wave.z > cs * 5; dirO = o; dirZ0 = wave.z; if (far) { shotHold = 0; shotK = pickShot(o); } }
      const gap = Math.max(cs * .5, o.z - dirZ0), ap = clamp(1 - (o.z - wave.z) / gap, 0, 1);
      const hero = o.big && !scene.space && o.kind !== 'galaxy', H = hero ? smooth(clamp(ap * 1.6, 0, 1)) : 0;
      const S = SHOTS[shotK], HS = SHOTS.hero, ant = smooth(clamp((ap - .72) / .28, 0, 1));
      let th = lerp(S.th, HS.th, H), ph = lerp(S.ph, HS.ph, H), d = lerp(S.d, HS.d, H), L = lerp(S.L, HS.L, H), ly = lerp(S.ly, HS.ly, H), fv = lerp(S.fov, HS.fov, H), du = lerp(S.du, HS.du, H);
      if (scene.space) { d *= 1.15; ph = Math.max(ph, .05); const pr = scene.id === 'galaxy' ? 1 : smooth(clamp(nextIdx / Math.max(1, scene.objs.length - 2), 0, 1)); th = lerp(th, -.05, pr); du = lerp(du, 0, pr); ph = lerp(ph, .1, pr); L = lerp(L, 2.6, pr); }
      d *= 1 - .16 * ant; fv -= .09 * ant;                   // anticipation: lean in right before the cut
      fv += Math.min(.32, sp * .009);
      CS.th.t = lerp(th, -.05, gal); CS.ph.t = lerp(ph, .1, gal); CS.d.t = lerp(d, 2.2, gal); CS.L.t = lerp(L, 2.4, gal); CS.ly.t = lerp(ly, 0, gal); CS.fov.t = fv; CS.du.t = lerp(du, 0, gal);
      for (const k in CS) spring(CS[k], dt, k === 'fov' ? 7 : k === 'du' ? 5 : 4.2, k === 'fov' ? .55 : .72);
      // keep the target in frame as it is cut: sprung focus weight + eased focus point, pushing in
      FW.t = o.kind === 'galaxy' || orbit ? 0 : smooth(clamp(1 - (o.z - wave.z - cs * 1.5) / (cs * 5), 0, 1)) * (scene.space ? .85 : o.big || FT.x > .5 ? .7 : .25);
      spring(FW, dt, 6, .9); const tallK = clamp((o.h / Math.max(.1, cs) - 1.2) / 1.5, 0, 1), fo = o.kind === 'planet' ? o.y + o.R : lerp(o.cutY, o.cutY + (o.h - o.h * o.cutF) * .35, tallK);
      const fr = scene.space ? 5 : o.big ? 2.4 : 1.4; FP.x = lerp(FP.x, o.x, 1 - Math.exp(-dt * fr)); FP.y = lerp(FP.y, fo, 1 - Math.exp(-dt * fr)); FP.z = lerp(FP.z, o.z, 1 - Math.exp(-dt * fr));
      const fw = clamp(FW.x, 0, .9);
      FT.x = lerp(FT.x, tallK, 1 - Math.exp(-dt * 3)); GRs = lerp(GRs, scene.space ? 1 : waveGrow(), 1 - Math.exp(-dt * 1.8)); const grow = GRs, D = Math.max(.7, CS.d.x * (1 - .3 * fw * (1 - FT.x) + .35 * fw * FT.x)) * cs * grow;
      const ar = scene.space ? 2.6 : 1.1; anc.x = lerp(anc.x, wave.x, 1 - Math.exp(-dt * ar)); anc.y = lerp(anc.y, wave.y, 1 - Math.exp(-dt * ar));
      const by = anc.y + .12 * cs * grow, cph = Math.cos(CS.ph.x);
      px = anc.x + Math.sin(CS.th.x) * cph * D; py = by + Math.sin(CS.ph.x) * D; pz = wave.z - Math.cos(CS.th.x) * cph * D;
      tx_ = anc.x + .22 * cs * grow; ty = anc.y + CS.ly.x * cs * grow; tz = wave.z + CS.L.x * cs * grow;
      tx_ = lerp(tx_, FP.x, fw); ty = lerp(ty, FP.y, fw); tz = lerp(tz, Math.max(FP.z, wave.z + cs * .3), fw);
      fov = CS.fov.x; roll = CS.du.x * (scene.space || o.big ? 1 : .5) - CS.th.v * .06 - .02 - Math.min(.05, sp * .002);
      // high-speed micro vibration
      const vib2 = Math.min(1, sp / 14) * .0015 * cs; px += Math.sin(T * 61) * vib2; py += Math.sin(T * 53.7) * vib2;
      snap = smooth(clamp((stT - .15) / 1.1, 0, 1));
    }
    // Earth: a separate cut that frames the whole planet while the blade circles it, then cut back into the chase
    const ow = orbit ? 1 : 0; if (ow !== OW.x) { if (!ow) { flash = Math.max(flash, .2); CS.fov.v += 1.5; } OW.x = ow; }
    // fly-out: start in front of the blade as it rushes at the screen, swing around its left side and settle behind it
    const FT2 = 2.6; if (flight) { flight.t += dt; if (flight.t > FT2) flight = null; }
    FLW.t = flight ? 1 : 0; if (!flight) spring(FLW, dt, 3.2, 1);
    if (FLW.x > .002 && !orbit) {
      const b = smooth(clamp(FLW.x, 0, 1)), ft = flight ? flight.t : FT2, q = easeIO(clamp(ft / FT2, 0, 1)), ph = .15 + q * (Math.PI - .6), Rc = cs * lerp(2.3, 2.5, q);
      const fpx = wave.x - Math.sin(ph) * Rc, fpy = wave.y + cs * lerp(.12, .45, q), fpz = wave.z + Math.cos(ph) * Rc;
      px = lerp(px, fpx, b); py = lerp(py, fpy, b); pz = lerp(pz, fpz, b);
      let lx = wave.x + cs * .15, ly2 = wave.y, lz = wave.z + cs * lerp(-.3, 2.2, q);
      const mo = scene.objs.find(m => m.m === 'moon'); if (mo) { const dd = mo.z - wave.z, mw = smooth(clamp(1 - Math.abs(dd - mo.R * .5) / (mo.R * 9), 0, 1)) * .85; lx = lerp(lx, mo.x, mw); ly2 = lerp(ly2, mo.y + mo.R, mw); lz = lerp(lz, mo.z, mw); px = lerp(px, lerp(fpx, mo.x - mo.R * 4.2, mw), b * mw * .6); pz = lerp(pz, lerp(fpz, mo.z - mo.R * 3.2, mw), b * mw * .6); }
      tx_ = lerp(tx_, lx, b); ty = lerp(ty, ly2, b); tz = lerp(tz, lz, b);
      fov = lerp(fov, lerp(1.25, 1.12, q), b); roll = lerp(roll, Math.sin(q * Math.PI) * .35 - .05, b);
    }
    if (ringO && OW.x > .002) {
      const e = ringO.o, q = clamp(ringO.t / ringO.T, 0, 1), cx = e.x, cy = e.y + e.R, cz = e.z, D = e.R * (6.2 - q * .9), a = -.42 + q * .12;
      const b = 1; snap = true;
      px = lerp(px, cx + Math.sin(a) * D, b); py = lerp(py, cy + D * (.22 + q * .05), b); pz = lerp(pz, cz - Math.cos(a) * D, b);
      tx_ = lerp(tx_, cx, b); ty = lerp(ty, cy - e.R * .05, b); tz = lerp(tz, cz, b); fov = lerp(fov, 1.0, b); roll = lerp(roll, -.04, b);
    }
    if (trans) { const k = Math.sin(Math.PI * clamp(trans.t / trans.dur, 0, 1)); fov += k * (trans.type === 'warp' ? .55 : trans.type === 'leap' ? .35 : trans.type === 'ground' ? .12 : .22); if (trans.type !== 'ground') fov += Math.exp(-Math.pow((trans.t - trans.sw) / .22, 2)) * .5; }
  } else if (state === 'final') {
    const b = finalObj; const c = b.fs; const a = stT * .2;
    px = b.x - 2.6 * c * Math.cos(a) + Math.sin(a) * c; py = b.cutY + (.25 + stT * .2) * c; pz = b.z - 2.4 * c * Math.cos(a) - Math.sin(a) * c * .6;
    tx_ = b.x + .5 * c; ty = b.cutY + .1 * c; tz = b.z + .2 * c; fov = 1.1 + stT * .05; roll = .05;
    if (b.kind === 'galaxy') { const e2 = ease(clamp(stT / 1.4, 0, 1)), gy = b.y + b.h / 2, ga = galSpin(), D = lerp(1.2, 2.3, e2) * c + stT * .06 * c, a = -.08 + ga; px = b.x + Math.sin(a) * D; py = gy + lerp(.1, .25, e2) * c; pz = b.z - Math.cos(a) * D; tx_ = b.x; ty = gy; tz = b.z; roll = -ga * .9; fov = 1.12; }
  } else if (state === 'wide' || state === 'result') {
    const b = finalObj || scene.objs[0]; const c = b.fs; const t = ease(Math.min(1, (state === 'wide' ? stT : 3) / 2.2));
    px = lerp(b.x - 2.6 * c, b.x - 3.4 * c, t) + Math.sin(T * .1) * .3 * c; py = lerp(b.cutY + .3 * c, b.cutY + 1.6 * c, t); pz = lerp(b.z - 2.4 * c, b.z - 5.2 * c, t);
    tx_ = b.x + .6 * c; ty = lerp(b.cutY, b.cutY - .1 * c, t); tz = b.z + .4 * c; fov = lerp(1.0, 1.12, t);
    if (b.kind === 'galaxy') { const gy = b.y + b.h / 2, ga = galSpin(), D = lerp(2.4, 2.8, t) * c, a = -.08 + ga; px = b.x + Math.sin(a) * D; py = gy + .25 * c; pz = b.z - Math.cos(a) * D; tx_ = b.x; ty = gy; tz = b.z; roll = -ga * .9; }
  }
  if (!scene.space && state !== 'title') py = Math.max(py, .12 * Math.min(cs, 6) + .06);
  const k0 = 1 - Math.exp(-dt * (state === 'wide' ? 6 : state === 'chase' ? 3.2 : 3)), k = snap === true ? 1 : lerp(k0, 1, +snap || 0);
  camS.px = lerp(camS.px, px, k); camS.py = lerp(camS.py, py, k); camS.pz = lerp(camS.pz, pz, k);
  camS.tx = lerp(camS.tx, tx_, k); camS.ty = lerp(camS.ty, ty, k); camS.tz = lerp(camS.tz, tz, k);
  camS.fov = lerp(camS.fov, fov, 1 - Math.exp(-dt * (state === 'chase' ? 14 : 5))); camS.roll = lerp(camS.roll, roll, 1 - Math.exp(-dt * (state === 'chase' ? 10 : 4)));
  lookAt(camS.px, camS.py, camS.pz, camS.tx, camS.ty, camS.tz);
  cam.fov = camS.fov; cam.roll = camS.roll;
}

// ---------- stage announce ----------
function announce(stage) {
  if (stage === shownStage) return; shownStage = stage;
  const t = tx(); const main = t.stages[stage]; const sub = lang === 'en' && stage !== 3 && stage !== 4 ? `STAGE ${String(stage + 1).padStart(2, '0')}` : STAGE_EN[stage];
  cutin(main, sub); A.taiko(.9); updHud(true);
}

// ---------- update ----------
let capture = null;
function update(rdt) {
  T += rdt; RDT = rdt;
  buildStep(state === 'chase' || state === 'slash' || state === 'final' ? 3 : 12);
  if (hitstop > 0) { hitstop -= rdt; camUpdate(); return; }
  if (state === 'chase' || state === 'final') {
    let target = state === 'final' ? .25 : 1; if (slowT > 0) { slowT -= rdt; target = Math.min(target, timeScale); }
    timeScale = lerp(timeScale, target, 1 - Math.exp(-rdt * (state === 'final' ? 8 : 3.5)));
  } else timeScale = lerp(timeScale, 1, 1 - Math.exp(-rdt * 4));
  const dt = rdt * timeScale; stT += rdt;
  shake = Math.max(0, shake - rdt * 2.6); quake = Math.max(0, quake - rdt * 1.5); flash = Math.max(0, flash - rdt * 3.2); split = Math.max(0, split - rdt * 2.2);

  if (state === 'ready') {
    kataIn = Math.min(1, kataIn + rdt * 2.2);
    if (inputMode === 'motion') {
      const R = motion.R;
      if (capture) { capture.t += rdt; if (capture.t > .18) { const pk = capture; capture = null; fire(.78 * clamp((pk.R - 300) / 1500, 0, 1) + .22 * clamp(pk.A / 38, 0, 1)); } }
      else if (R < 28 && T - motion.t < .5) qiAdd(rdt / (qi < 1 ? 1.25 : 1.6));
      else if (R < 300) qiAdd(-rdt * .7 * clamp((R - 28) / 120, 0, 1));
      if (inputMode === 'motion' && stT > 1.1 && T - motion.t > 1.0 && motion.count === 0) { inputMode = 'swipe'; toast(tx().motionOff); updReadyUI(); }
    } else if (swipe.down && !swipe.fired) { if (T - swipe.lastMove > .08) qiAdd(rdt / (qi < 1 ? 1.1 : 1.4)); }
    if (qi >= 2 && Math.random() < rdt * 9) A.plasma();
    updReadyUI();
  }
  if (state === 'slash' && stT > .42) startChase();
  if (state === 'chase') updChase(dt, rdt);
  if (state === 'final') {
    finalWave(dt);
    const dur = finalObj && finalObj.kind === 'galaxy' ? 3.4 : 2.1;
    if (stT > dur) { go('wide'); app.classList.remove('cine'); A.taiko(1.2); }
  }
  if (state === 'wide' && stT > 2.4) go('result');
  if (state === 'chase' || state === 'final') { { const rt = rTarget(); rDisp = Math.max(rDisp, lerp(rDisp, rt, 1 - Math.exp(-rdt * 7))); if (rt - rDisp < .004 && rt >= rDisp) rDisp = rt; } updHud(); }
  for (const s of slashes) s.t += dt;
  updPieces(dt); updDeco(dt); updParts(dt); if (renderer) updFx3D(dt);
  camForState(rdt); camUpdate();
}
function rTarget() {
  if (state === 'final') return REACH;
  if (orbit) return Math.min(REACH, orbit.o.stage + .95 * clamp(orbit.t / orbit.T, 0, 1));
  const o = scene.objs[nextIdx];
  if (!o) { const l = scene.objs[scene.objs.length - 1]; return Math.min(REACH, l.stage + 1); }
  const prevZ = nextIdx > 0 ? scene.objs[nextIdx - 1].z : scene.startZ;
  const f = clamp((wave.z - prevZ) / Math.max(.01, o.z - prevZ), 0, 1);
  return Math.min(REACH, o.stage + (o.jj + f * .92) / o.cnt);
}
function finalWave(dt) {
  if (!wave.on) return;
  blastDeco();
  const o = scene.objs[nextIdx];
  if (o && !stopped) { const zs = o.z - o.w * .45; const d = zs - wave.z; wave.v = lerp(wave.v, Math.max(.6, d * 3), 1 - Math.exp(-dt * 4)); wave.z += wave.v * dt; wave.y = lerp(wave.y, o.cutY, 1 - Math.exp(-dt * 4)); if (d < o.fs * .05) { stopped = true; wave.v = 0; o.shake = 1; A.nick(); burst({ ...o, chip: o.chip, fs: o.fs * .4 }); } }
  else { wave.z += wave.v * dt; }
  wave.fade = Math.max(0, wave.fade - dt * (stopped || !o ? 1.4 : .3)); if (wave.fade <= 0) wave.on = false;
}
function waveGrow() { return 1 + Math.min(.9, chaseT * .075); }
function blastDeco() {
  if (!wave.on || wave.fade < .25) return;
  for (const o of scene.deco) {
    if (!o.dz || o.cut || wave.z < o.z - o.w * .35) continue;
    if (Math.abs(o.x - wave.x) - o.w * .5 > (scene.DR || 0) * (.55 + .45 * waveGrow())) continue;
    if (wave.z > o.z + o.w * 2.5) continue;
    o.cut = true; const sg = o.x >= 0 ? 1 : -1, fdz = rr(-.4, .6), l = Math.hypot(1, fdz), dx = sg / l, dz = fdz / l;
    const sp = (3 + 4 * power) * Math.sqrt(o.fs) * .7 * (ultraCut ? 1.2 : 1);
    o.piece = { x: o.x, y: o.cutY, z: o.z, dx, dz, kx: dz, kz: -dx, th: 0, w: rr(1.6, 3.6) * (o.fs > 8 ? .5 : 1), vx: dx * sp * .55, vy: sp * rr(.7, 1.05), vz: sp * rr(.45, .95), spin: 0, ws: rr(-2.5, 2.5), landed: 0 };
    o.shake = .8;
    debris(o.x, o.cutY, o.z, Math.min(o.w, o.fs * 1.2), o.chip, 16, o.fs * 1.8, !!scene.space); shake = Math.max(shake, .35);
    if (T - lastCrash > .07) { lastCrash = T; A.crash(o.fs); }
  }
}
let lastCrash = 0;
function updDeco(dt) {
  const sp = !!scene.space;
  for (const o of scene.deco) {
    if (o.shake > 0) o.shake = Math.max(0, o.shake - dt * 1.6);
    const p = o.piece; if (!p || p.landed === 2) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.th += p.w * dt; p.spin += p.ws * dt;
    if (sp) continue;
    p.vy -= 9.8 * dt;
    if (p.y <= 0) { p.y = 0; if (!p.landed) { p.landed = 1; dust(p.x, p.z, 6, o.fs); } p.vy = Math.abs(p.vy) > 2 ? -p.vy * .25 : 0; p.vx *= .55; p.vz *= .55; p.w *= .5; p.ws *= .5; if (Math.hypot(p.vx, p.vz) < .3 && Math.abs(p.vy) < .1) p.landed = 2; }
  }
}
let chaseT = 0;
function updChase(dt, rdt) {
  chaseT += dt;
  const accel = 1 + Math.min(1.5, chaseT * .085);
  if (trans) { updTrans(rdt); if (trans && !trans.done) { wave.v = lerp(wave.v, Math.max(wave.v, cs * scene.kv * (.85 + .35 * power) * accel) * (trans.type === 'ground' ? 1 : 1 + .5 * clamp(trans.t / trans.sw, 0, 1)), 1 - Math.exp(-dt * 3)); wave.z += wave.v * dt; return; } }
  blastDeco();
  const objs = scene.objs, o = objs[nextIdx];
  wave.hw = cs * .5 * waveGrow();
  if (o) {
    if (!orbit) announce(o.stage);
    const ty0 = o.kind === 'galaxy' ? o.y + o.h / 2 : o.cutY;
    const wr = o.kind === 'galaxy' ? 7 : 3; wave.x = lerp(wave.x, o.x, 1 - Math.exp(-dt * wr)); wave.y = lerp(wave.y, ty0, 1 - Math.exp(-dt * Math.max(wr, 6)));
    if (!orbit && o.m === 'earth' && !o.orbited && canCut(o) && wave.z >= o.z - o.R * 4.3) startOrbit(o);
    if (orbit) { updOrbit(dt); return; }
    if (canCut(o)) {
      wave.v = lerp(wave.v, cs * scene.kv * (.85 + .35 * power) * accel, 1 - Math.exp(-dt * 6)); wave.z += wave.v * dt;
      if (wave.z >= o.z - (o.cutAt ?? o.w * .12)) {
        cutObj(o); nextIdx++;
        const nx = objs[nextIdx];
        if (o.kind === 'galaxy') { finalObj = o; go('final'); A.final(); cutin(`<em>${tx().galaxyCut}</em>`, lang === 'ja' ? 'GALAXY SLASH' : ''); flash = 1; shake = 1; vib([60, 40, 120]); return; }
        if (nx && !canCut(nx)) { finalObj = o; go('final'); A.final(); flash = .5; shake = 1; vib([40, 30, 80]); return; }
        if (!nx && sceneI >= SCENES.length - 1) { finalObj = o; go('final'); A.final(); return; }
      }
    } else {
      // reach ends right at the start of this scene: decelerate and nick
      const zs = o.z - o.w * .45, d = zs - wave.z; wave.v = Math.max(cs * .3, Math.min(cs * scene.kv, d * 2.5)); wave.z += wave.v * dt;
      if (d < o.fs * .06) { stopped = true; wave.v = 0; o.shake = 1; A.nick(); finalObj = o; go('final'); A.final(); cutin(tx().nick, ''); }
    }
  } else {
    wave.v = lerp(wave.v, cs * scene.kv * accel, 1 - Math.exp(-dt * 3)); wave.z += wave.v * dt;
    const last = objs[objs.length - 1];
    if (wave.z > last.z + last.fs * 1.3 || stT > 0 && wave.z > last.z + last.w) startTrans();
  }
}
function startOrbit(o) {
  const TT = 1.6, v0 = Math.max(wave.v, cs), D0 = (o.z + o.R * 3) - wave.z, If = .2268;
  const vm = clamp((D0 - v0 * If * TT) / (TT * (1 - If)), v0 * .1, v0);
  const cy = o.y + o.R, dy = o.cutY - cy, r0 = Math.sqrt(Math.max(.01, o.R * o.R - dy * dy));
  wave.vert = false; wave.vt = 0; orbit = { o, t: 0, T: TT, v0, vm, a0: Math.atan2(cam.z - o.z, cam.x - o.x), dir: -1, r: r0 * 1.02, pr: 0, cut: false };
  o.orbited = true; ringF = 1; A.whoosh(1);
}
function updOrbit(dt) {
  const ob = orbit, o = ob.o; ob.t += dt; const q = clamp(ob.t / ob.T, 0, 1);
  const f = Math.pow(1 - Math.sin(Math.PI * q), 2); wave.v = ob.vm + (ob.v0 - ob.vm) * f; wave.z += wave.v * dt;
  wave.fade = lerp(wave.fade, q < .8 ? .12 : 1, 1 - Math.exp(-dt * 7));
  ob.pr = easeIO(clamp(q / .82, 0, 1));
  const a = ob.a0 + ob.dir * ob.pr * Math.PI * 2, hx = o.x + Math.cos(a) * ob.r, hz = o.z + Math.sin(a) * ob.r;
  if (q < .82) for (let i = 0; i < 2; i++) addP({ x: hx, y: o.cutY, z: hz, vx: rr(-1, 1) * o.R * .5, vy: rr(-1, 1) * o.R * .4, vz: rr(-1, 1) * o.R * .5, life: rr(.15, .4), t: 0, k: 'spark', c: ultraCut ? `hsl(${rnd() * 360 | 0},100%,70%)` : rnd() < .5 ? '#bfe0ff' : '#ffffff', s: o.R * .05, g: 0 });
  if (!ob.cut && q >= .82) {
    ob.cut = true; cutObj(o); nextIdx++; quake = 1.2; flash = Math.max(flash, .4); shockFlat(o.x, o.cutY, o.z, o.R * 4.5);
    const nx = scene.objs[nextIdx]; if (nx && !canCut(nx)) { orbit = null; finalObj = o; go('final'); A.final(); return; }
  }
  if (q >= 1) { orbit = null; burstT = T; camReset(); CS.fov.v += 2.5; A.whip(); }
}
let ringM = null, ringD = null; const RN = 160;
if (renderer) {
  const mkR = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RN + 1) * 2 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((RN + 1) * 2 * 3), 3)); const idx = []; for (let i = 0; i < RN; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 5; m.visible = false; return m; };
  ringM = mkR(); ringD = mkR();
}
let ringO = null;
function updRing(dt) {
  if (!ringM) return;
  if (orbit) ringO = orbit; else ringF = Math.max(0, ringF - dt * 1.6);
  const ob = ringO, on = !!ob && ringF > 0; ringM.visible = ringD.visible = on; if (!on) return;
  const o = ob.o, head = ob.pr * RN, P1 = ringM.geometry.attributes.position.array, C1 = ringM.geometry.attributes.color.array, P2 = ringD.geometry.attributes.position.array, C2 = ringD.geometry.attributes.color.array;
  const hh = o.R * .075, y = o.cutY, fadeAll = ob.cut ? ringF : 1;
  for (let i = 0; i <= RN; i++) {
    const a = ob.a0 + ob.dir * (i / RN) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), k = i * 6;
    const lit = i <= head ? (.7 + 1.3 * Math.exp(-(head - i) / (RN * .08))) * fadeAll : 0;
    const hue = ultraCut ? (i / RN + T * .4) % 1 : .58; _c.setHSL(hue, ultraCut ? 1 : .6, .62);
    const r = ob.r, x = o.x + ca * r, z = o.z + sa * r;
    P1[k] = x; P1[k + 1] = y - hh; P1[k + 2] = z; P1[k + 3] = x; P1[k + 4] = y + hh; P1[k + 5] = z;
    for (let j = 0; j < 2; j++) { C1[k + j * 3] = lit * (.55 + .45 * _c.r); C1[k + j * 3 + 1] = lit * (.55 + .45 * _c.g); C1[k + j * 3 + 2] = lit * (.55 + .45 * _c.b); }
    const ro = r * (1 + .9 * (i <= head ? Math.exp(-(head - i) / (RN * .06)) : 0));
    P2[k] = x; P2[k + 1] = y; P2[k + 2] = z; P2[k + 3] = o.x + ca * ro; P2[k + 4] = y; P2[k + 5] = o.z + sa * ro;
    C2[k] = lit * _c.r; C2[k + 1] = lit * _c.g; C2[k + 2] = lit * _c.b; C2[k + 3] = C2[k + 4] = C2[k + 5] = 0;
  }
  for (const m of [ringM, ringD]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; }
}
function startTrans() {
  const type = TRANS[sceneI]; trans = { type, t: 0, dur: type === 'leap' ? 1.7 : type === 'warp' ? .9 : type === 'ground' ? 2.05 : .4, sw: type === 'leap' ? .55 : type === 'warp' ? .45 : type === 'ground' ? 1.4 : .2, gp: null, done: false, li: sceneI === 2 ? 0 : 1, locks: 0 };
  if (type === 'leap') { A.leap(); vib([30, 30, 30, 30, 80]); }
  else if (type === 'warp') A.warp(); else if (type === 'ground') { A.bigCut(); wave.vert = true; } else A.whip();
}
function updTrans(rdt) {
  const tr = trans; tr.t += rdt;
  if (tr.type === 'ground' && !tr.done) {
    // the vertical blade bites into the ground and keeps tearing it open
    const hw = wave.hw; wave.y = lerp(wave.y, hw * .15, 1 - Math.exp(-rdt * 5));
    const gx = wave.x, gz = wave.z; if (tr.gp && Math.hypot(gz - tr.gp[1], gx - tr.gp[0]) > hw * .15) { slashes.push({ x: gx, y: .04, z: gz, a: [tr.gp[0], .04, tr.gp[1]], b: [gx, .04, gz], t: 0, life: 2.2, L: 1, gr: 1 }); tr.gp = [gx, gz]; } else if (!tr.gp) tr.gp = [gx, gz];
    if (Math.random() < .8) debris(gx, .05, gz, hw * .5, CHIP.neon, 3, hw * 3, false);
    if (Math.random() < .5) dust(gx, gz, 2, hw * .8);
    for (let i = 0; i < 3; i++) addP({ x: gx + rr(-.1, .1) * hw, y: .05, z: gz, vx: rr(-1, 1) * hw * 1.5, vy: rr(.5, 2) * hw, vz: -rr(.2, 1.5) * hw, life: rr(.2, .5), t: 0, k: 'spark', c: Math.random() < .5 ? '#ffffff' : '#ff8ae0', s: hw * .03, g: 1 });
    quake = Math.max(quake, .25);
  }
  if (tr.type === 'leap') { const tt = tr.t; while (tr.locks < 4 && tt >= LEAP_LK[tr.locks]) { tr.locks++; A.lock(tr.locks === 4); vib(tr.locks === 4 ? 60 : 18); } if (tt > .15 && tt < LEAP_LK[3] && Math.random() < rdt * 22) A.tick(); }
  if (!tr.done && tr.t >= tr.sw && tr.type === 'leap' && !tr.snapped) { tr.wantSnap = true; tr.t = tr.sw; }
  if (!tr.done && tr.t >= tr.sw && (tr.type !== 'leap' || tr.snapped)) {
    tr.done = true; const gnd = tr.type === 'ground'; if (tr.type === 'leap') { if (tr.glass) glassShatter(tr); A.bigCut(); quake = Math.max(quake, .6); } loadScene(sceneI + 1);
    const o = scene.objs[0], ratio = o.fs / Math.max(.01, cs);
    const ox = anc.x, oy = anc.y, oz = wave.z, ocs = cs;
    cs = o.fs; wave.v *= ratio;
    wave.z = gnd ? o.z - (o.R || 1) * 4.1 : o.z - Math.max(o.fs * 2.2, wave.v * .35); wave.x = o.x; wave.y = o.cutY; wave.vert = o.kind === 'galaxy'; wave.vt = wave.vert ? 1 : 0; wave.hw = cs * .5 * waveGrow();
    anc.x = wave.x; anc.y = wave.y; dirO = o; dirZ0 = wave.z;
    // carry the camera across in slash-relative space so nothing jumps
    const rm = (v, a, b) => b + (v - a) * ratio;
    camS.px = rm(camS.px, ox, anc.x); camS.py = rm(camS.py, oy, anc.y); camS.pz = rm(camS.pz, oz, wave.z);
    FP.x = rm(FP.x, ox, anc.x); FP.y = rm(FP.y, oy, anc.y); FP.z = rm(FP.z, oz, wave.z);
    camS.tx = rm(camS.tx, ox, anc.x); camS.ty = rm(camS.ty, oy, anc.y); camS.tz = rm(camS.tz, oz, wave.z);
  }
  if (tr.t >= tr.dur) { trans = null; }
}
function qiAdd(v) {
  const was1 = qi >= 1, was2 = qi >= 2;
  qi = clamp(qi + v, 0, 2);
  if (qi >= 1 && !was1) { qiFullAt = T; A.ring(); vib(15); }
  if (qi >= 2 && !was2) { qiUltraAt = T; A.ultra(); vib([20, 20, 40]); flash = .35; }
}

// ---------- render ----------
const sortList = [];
function render() { renderScene(true); if (trans && trans.wantSnap && !trans.snapped) { const w = view.width, h = view.height; snapC.width = w; snapC.height = h; snapX.imageSmoothingEnabled = false; snapX.drawImage(skyC, 0, 0, w, h); if (renderer) snapX.drawImage(glc, 0, 0, w, h); snapX.drawImage(ovC, 0, 0, w, h); trans.snapped = true; } composite(); }
function renderScene(withUI) {
  ctx = skyCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawSky();
  if (scene.space) for (const o of scene.objs) if (o.kind === 'planet') drawGlow(o);
  render3D();
  ctx = ovCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, LW, LH);
  drawParts(); drawSlashes(); drawWave();
  if (orbit && orbit.pr < 1) { const ob = orbit, o = ob.o, a = ob.a0 + ob.dir * ob.pr * Math.PI * 2; if (proj(o.x + Math.cos(a) * ob.r, o.cutY, o.z + Math.sin(a) * ob.r, tA)) { const x = tA[3], y = tA[4], r = clamp(o.R * 1.1 * F / tA[2], 6, LW * .5); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.12, ultraCut ? `hsla(${(T * 300) % 360},100%,70%,.6)` : 'rgba(150,200,255,.55)'); g.addColorStop(1, 'rgba(80,120,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x - r * 1.2, y - .7, r * 2.4, 1.4); ctx.globalCompositeOperation = 'source-over'; } }
  if (withUI && state === 'ready') drawKatana(0, 0);
  if (withUI && state === 'slash') drawKatana(Math.min(1, stT / .3), 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function renderLandscape(w, h, camSet) {
  const sv = [LW, LH, HW, HH, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, cam.fov];
  LW = w; LH = h; HW = w / 2; HH = h / 2; skyC.width = ovC.width = w; skyC.height = ovC.height = h; skyCtx.imageSmoothingEnabled = ovCtx.imageSmoothingEnabled = false; if (renderer) renderer.setSize(w, h, false);
  if (camSet) camSet(); cam.fov = .82; camUpdate(); renderScene(false);
  const out = document.createElement('canvas'); out.width = w; out.height = h; const o2 = out.getContext('2d'); o2.drawImage(skyC, 0, 0); if (renderer) o2.drawImage(glc, 0, 0); o2.drawImage(ovC, 0, 0);
  [LW, LH, HW, HH, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, cam.fov] = sv; skyC.width = ovC.width = LW; skyC.height = ovC.height = LH; skyCtx.imageSmoothingEnabled = ovCtx.imageSmoothingEnabled = false; if (renderer) renderer.setSize(LW, LH, false); camUpdate();
  return out;
}
function drawTunnel(c, w, h, t) {
  c.fillStyle = '#05020f'; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * .46, R = Math.hypot(w, h) * .62;
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  const cg = c.createRadialGradient(cx, cy, 0, cx, cy, R * .5); cg.addColorStop(0, 'rgba(255,255,255,.55)'); cg.addColorStop(.12, 'rgba(160,120,255,.35)'); cg.addColorStop(1, 'rgba(40,10,80,0)'); c.fillStyle = cg; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 12; k++) { const ph = (k / 12 + t * .9) % 1; const r = R * ph * ph; c.strokeStyle = `hsla(${(k * 30 + t * 220) % 360},100%,62%,${ph * .55})`; c.lineWidth = (1 + ph * 9) * DPR; c.beginPath(); c.ellipse(cx, cy, r, r * .82, t * .3 + k, 0, 7); c.stroke(); }
  for (let i = 0; i < 140; i++) { const a = i * 2.39996 + t * .7, ph = (i * .618 + t * 1.6) % 1, r0 = R * Math.pow(ph, 2.3), r1 = r0 + R * (.03 + ph * .22); c.strokeStyle = `hsla(${(i * 9 + t * 160) % 360},100%,72%,${ph * .85})`; c.lineWidth = (.6 + ph * 2.6) * DPR; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .82); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * .82); c.stroke(); }
  const cr = Math.min(w, h) * .42; c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5 * DPR; c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283 - t * 3.2, l = i % 5 ? cr * .05 : cr * .12; c.strokeStyle = i % 5 ? 'rgba(255,255,255,.3)' : 'rgba(255,214,10,.8)'; c.lineWidth = (i % 5 ? 1 : 2.5) * DPR; c.beginPath(); c.moveTo(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr); c.lineTo(cx + Math.cos(a) * (cr - l), cy + Math.sin(a) * (cr - l)); c.stroke(); }
  c.strokeStyle = 'rgba(255,214,10,.7)'; c.lineWidth = 3 * DPR; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-t * 9) * cr * .8, cy + Math.sin(-t * 9) * cr * .8); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2 * DPR; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-t * 1.4) * cr * .55, cy + Math.sin(-t * 1.4) * cr * .55); c.stroke();
  c.globalCompositeOperation = 'source-over';
}
const grpC = document.createElement('canvas'), grpX = grpC.getContext('2d');
const snapC = document.createElement('canvas'), snapX = snapC.getContext('2d');
function glassInit(tr, w, h) {
  const g = tr.glass = { w, h, ix: w * .5, iy: h * .55, br: [], rings: [] };
  if (proj(wave.x, wave.y + wave.hw * .2, wave.z + wave.hw * .3, tA)) { g.ix = clamp(tA[3] * w / LW, w * .2, w * .8); g.iy = clamp(tA[4] * h / LH, h * .3, h * .75); }
  const D = Math.hypot(w, h), NB = 18;
  g.ang = []; for (let i = 0; i < NB; i++) g.ang.push(i / NB * 6.283 + (Math.random() - .5) * .25);
  for (let i = 0; i < NB; i++) { const pts = [[g.ix, g.iy]]; let a = g.ang[i], x = g.ix, y = g.iy; const L = D * (.05 + Math.random() * .03); for (let k = 0; k < 16; k++) { a += (Math.random() - .5) * .35; x += Math.cos(a) * L; y += Math.sin(a) * L; pts.push([x, y]); } g.br.push({ pts, d: Math.random() * .12 }); }
  // the main slash crack straight across
  const ma = -.06 + (Math.random() - .5) * .06, mp = []; for (let k = -12; k <= 12; k++) { const t = k / 12 * D * .7; mp.push([g.ix + Math.cos(ma) * t + (Math.random() - .5) * 4 * DPR, g.iy + Math.sin(ma) * t + (Math.random() - .5) * 4 * DPR]); }
  g.main = mp;
  g.rad = [0, .045, .1, .17, .27, .4, .58, .82, 1.2].map(r => r * D);
}
function glassShatter(tr) {
  const g = tr.glass, NB = g.ang.length, D = Math.hypot(g.w, g.h), J = [];
  const vtx = (j, i) => { const key = j * 100 + ((i % NB + NB) % NB); if (!J[key]) { const a = g.ang[(i % NB + NB) % NB] + (j > 0 ? (Math.random() - .5) * .12 : 0), r = g.rad[j] * (j > 0 ? .9 + Math.random() * .2 : 0); J[key] = [g.ix + Math.cos(a) * r, g.iy + Math.sin(a) * r]; } return J[key]; };
  g.sh = [];
  for (let j = 0; j < g.rad.length - 1; j++) for (let i = 0; i < NB; i++) {
    const poly = j === 0 ? [vtx(0, 0), vtx(1, i), vtx(1, i + 1)] : [vtx(j, i), vtx(j, i + 1), vtx(j + 1, i + 1), vtx(j + 1, i)];
    const parts2 = j >= 3 && Math.random() < .6 ? [[poly[0], poly[1], poly[2]], [poly[0], poly[2], poly[3]]] : [poly];
    for (const pl of parts2) {
      let cx = 0, cy = 0; for (const q of pl) { cx += q[0]; cy += q[1]; } cx /= pl.length; cy /= pl.length;
      const dx = cx - g.ix, dy = cy - g.iy, dl = Math.hypot(dx, dy) || 1, near = 1 - clamp(dl / D, 0, 1);
      const sp = D * (.22 + near * .6) * (.7 + Math.random() * .6); g.sh.push({ pl, cx, cy, vx: dx / dl * sp, vy: dy / dl * sp + D * .05, w: (Math.random() - .5) * 4, gs: .4 + near * 1.6 + Math.random() * .6, life: .8 + Math.random() * .4 });
    }
  }
  g.pat = null;
}
function drawGlass(c, w, h, tr) {
  const g = tr.glass; if (!g) return; const D = Math.hypot(w, h);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (!tr.done) {
    // cracks race out from the slash
    const t = tr.t / tr.sw;
    c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(170,200,255,${.06 * t})`; c.fillRect(0, 0, w, h);
    const drawPl = (pts, fr) => { const n = Math.max(1, Math.floor((pts.length - 1) * fr)); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k <= n; k++) c.lineTo(pts[k][0], pts[k][1]); };
    const mf = clamp(t / .25, 0, 1), mid = (g.main.length - 1) / 2, mn = Math.floor(mid * mf);
    c.beginPath(); c.moveTo(g.main[mid - mn][0], g.main[mid - mn][1]); for (let k = mid - mn + 1; k <= mid + mn; k++) c.lineTo(g.main[k][0], g.main[k][1]);
    c.strokeStyle = 'rgba(140,190,255,.45)'; c.lineWidth = 7 * DPR; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2 * DPR; c.stroke();
    for (const b of g.br) { const fr = clamp((t - .15 - b.d) / .7, 0, 1); if (fr <= 0) continue; drawPl(b.pts, ease(fr)); c.strokeStyle = 'rgba(150,200,255,.3)'; c.lineWidth = 4 * DPR; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.1 * DPR; c.stroke(); }
    // spider-web rings
    const rf = clamp((t - .45) / .5, 0, 1);
    if (rf > 0) { c.strokeStyle = `rgba(255,255,255,${.6 * rf})`; c.lineWidth = .9 * DPR; for (let j = 1; j < 5; j++) { c.beginPath(); for (let i = 0; i <= g.ang.length; i++) { const a = g.ang[i % g.ang.length], r = g.rad[j] * (.95 + .1 * hs(i, j, 7)); const x = g.ix + Math.cos(a) * r, y = g.iy + Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); } }
  } else if (g.sh && snapC.width) {
    // shards of the old era fly at the camera and dissolve
    const t = tr.t - tr.sw; if (!g.pat) g.pat = c.createPattern(snapC, 'no-repeat');
    for (const sh of g.sh) {
      const k = t / sh.life; if (k >= 1) continue; const a = 1 - clamp((k - .45) / .55, 0, 1), sc2 = 1 + sh.gs * k * k, m = t * t / (t + .22) + t * .08;
      c.save(); c.translate(sh.cx + sh.vx * m, sh.cy + sh.vy * m + D * .12 * t * t); c.rotate(sh.w * m); c.scale(sc2, sc2); c.translate(-sh.cx, -sh.cy);
      c.beginPath(); c.moveTo(sh.pl[0][0], sh.pl[0][1]); for (let q = 1; q < sh.pl.length; q++) c.lineTo(sh.pl[q][0], sh.pl[q][1]); c.closePath();
      c.globalAlpha = a; c.globalCompositeOperation = 'source-over'; c.fillStyle = g.pat; c.fill();
      c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(190,220,255,${.12 + .25 * k})`; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2 * DPR / sc2; c.stroke();
      c.restore();
    }
    // glitter left behind
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1;
    for (let i = 0; i < 70; i++) { const sh = g.sh[(i * 7) % g.sh.length], k = t / (sh.life * 1.4); if (k >= 1) continue; const x = sh.cx + sh.vx * t * 1.15 + Math.sin(i * 3.1) * 20 * DPR, y = sh.cy + sh.vy * t * 1.15 + Math.cos(i * 2.3) * 20 * DPR; c.fillStyle = `rgba(255,255,255,${(1 - k) * (.5 + .5 * Math.sin(T * 40 + i))})`; c.fillRect(x, y, 2 * DPR, 2 * DPR); }
  }
  c.restore();
}
function drawLeapFx(c, w, h, tt, tr) {
  const env = Math.sin(Math.PI * clamp(tt / tr.dur, 0, 1)), fadeOut = clamp((tr.dur - tt) / .3, 0, 1);
  const cx = w / 2, cy = h * .46, R = Math.hypot(w, h) * .6;
  if (!tr.glass) glassInit(tr, w, h);
  drawGlass(c, w, h, tr);
  // compact year read-out, upper part of the screen
  const [y0, y1] = LEAP_YEARS[tr.li], eras = tx().eras[tr.li], lk = LEAP_LK;
  const fs = Math.min(w * .15, h * .075), ycy = h * .34;
  c.save(); c.globalAlpha = fadeOut; c.textAlign = 'center'; c.textBaseline = 'middle';
  const bg = c.createLinearGradient(0, ycy - fs * 1.3, 0, ycy + fs * 1.3); bg.addColorStop(0, 'rgba(8,10,30,0)'); bg.addColorStop(.5, 'rgba(8,10,30,.45)'); bg.addColorStop(1, 'rgba(8,10,30,0)'); c.fillStyle = bg; c.fillRect(0, ycy - fs * 1.3, w, fs * 2.6);
  c.font = `500 ${Math.round(fs * .2)}px Oswald`; c.fillStyle = 'rgba(214,223,236,.95)'; c.fillText('T I M E   L E A P', cx, ycy - fs * .85);
  c.font = `700 ${Math.round(fs)}px Oswald`;
  if (grpC.width !== w || grpC.height !== h) { grpC.width = w; grpC.height = h; }
  const g = grpX; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(fs)}px Oswald`;
  const adv = g.measureText('0').width * 1.04, x0 = cx - adv * 1.5;
  for (let k = 0; k < 4; k++) {
    const locked = tt >= lk[k]; const d = tt < .15 ? y0[k] : locked ? y1[k] : String((hs(k, Math.floor(tt * 30), 3) * 10) | 0);
    const pop = locked ? 1 + .3 * Math.max(0, 1 - (tt - lk[k]) / .16) : 1;
    g.save(); g.translate(x0 + adv * k, ycy); g.scale(pop, pop);
    if (!locked && tt >= .15) { const jx = (Math.random() - .5) * fs * .05; g.fillStyle = 'rgba(255,40,90,.85)'; g.fillText(d, jx - fs * .03, 0); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(40,230,255,.85)'; g.fillText(d, jx + fs * .03, 0); }
    else { g.fillStyle = locked ? '#ffd60a' : '#ffffff'; g.fillText(d, 0, 0); }
    g.restore();
  }
  g.font = `400 ${Math.round(fs * .28)}px "Dela Gothic One","Zen Kaku Gothic New",sans-serif`;
  const done = tt >= lk[3]; g.fillStyle = done ? '#ffd60a' : '#ffffff'; g.fillText(done ? `${eras[0]}  →  ${eras[1]}` : `${eras[0]}  →  ？`, cx, ycy + fs * .82);
  c.shadowColor = 'rgba(14,26,43,1)'; c.shadowBlur = fs * .2; c.drawImage(grpC, 0, 0); c.shadowBlur = 0;
  c.restore();
}
let viewFill = '';
function composite() {
  const w = view.width, h = view.height;
  const sx = (Math.sin(T * 47) + Math.sin(T * 31.7) * .6) * shake * 3, sy = (Math.sin(T * 41.3) + Math.sin(T * 27.1) * .6) * shake * 3;
  const qk = quake * quake, roll = cam.roll + Math.sin(T * 23) * qk * .02; let zoom = 1 + Math.abs(roll) * .35 + shake * .02 + qk * .05, rot = 0, tx2 = 0;
  const qx = (Math.sin(T * 37) + Math.sin(T * 21.7) * .7) * qk * 11, qy = (Math.sin(T * 33.3) + Math.sin(T * 19.1) * .7) * qk * 11;
  const tr = trans; let mode = 'layers', splitOff = 0, smear = 0;
  if (tr) {
    const q = clamp(tr.t / tr.dur, 0, 1); smear = Math.pow(Math.sin(Math.PI * q), 2); zoom *= 1 + smear * .1 + (tr.type !== 'ground' ? Math.exp(-Math.pow((tr.t - tr.sw) / .2, 2)) * .12 : 0);
  } else if (split > 0) mode = 'split';
  stageEl.style.visibility = mode === 'layers' ? 'visible' : 'hidden';
  vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.globalAlpha = 1; vctx.globalCompositeOperation = 'source-over';
  if (mode === 'layers') {
    stageEl.style.transform = `translate(${(sx + tx2 + qx).toFixed(1)}px,${(sy + qy).toFixed(1)}px) rotate(${(roll + rot).toFixed(4)}rad) scale(${zoom.toFixed(4)})`;
    if (viewFill !== '#05080f') { vctx.fillStyle = '#05080f'; vctx.fillRect(0, 0, w, h); viewFill = '#05080f'; }
  } else {
    viewFill = '';
    const dw = w, dh = h;
    const drawLow = () => { vctx.drawImage(skyC, -dw / 2, -dh / 2, dw, dh); if (renderer) vctx.drawImage(glc, -dw / 2, -dh / 2, dw, dh); vctx.drawImage(ovC, -dw / 2, -dh / 2, dw, dh); };
    vctx.fillStyle = '#05080f'; vctx.fillRect(0, 0, w, h);
    if (tr && tr.type === 'leap') drawTunnel(vctx, w, h, T);
    if (mode === 'split') {
      vctx.save(); vctx.translate(w / 2 + sx * DPR, h / 2 + sy * DPR); vctx.rotate(roll); vctx.scale(zoom, zoom);
      const off = splitOff > 0 ? splitOff : Math.sin(split * Math.PI) * 18 * DPR * split;
      const ang = splitOff > 0 ? -.42 : splitAng;
      const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, R = Math.hypot(w, h) * 1.5;
      for (const side of [1, -1]) {
        vctx.save(); vctx.beginPath(); vctx.moveTo(-ca * R, -sa * R); vctx.lineTo(ca * R, sa * R); vctx.lineTo(ca * R + nx * R * side, sa * R + ny * R * side); vctx.lineTo(-ca * R + nx * R * side, -sa * R + ny * R * side); vctx.closePath(); vctx.clip();
        vctx.translate((splitOff > 0 ? nx : ca) * off * side, (splitOff > 0 ? ny : sa) * off * side); drawLow(); vctx.restore();
      }
      vctx.restore();
    }
  }
  // fx overlay
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, w, h); fctx.globalCompositeOperation = 'source-over';
  if (tr && tr.type === 'leap') drawLeapFx(fctx, w, h, tr.t, tr);
  if (state === 'chase' || state === 'slash' || (state === 'final' && stT < .6)) {
    const spd = state === 'chase' ? clamp((wave.v / Math.max(1, cs) - 3) / 9, 0, 1) : state === 'slash' ? .9 : .7 * (1 - stT / .6);
    const k = clamp(spd * .75 + camKick * .5 + (tr ? .35 + Math.max(0, smear) * .65 : 0), 0, 1);
    if (k > .02) focusLines(fctx, w, h, k);
  }
  if (tr && tr.type === 'ground') { const fa = tr.t < tr.sw ? smooth(clamp((tr.t - (tr.sw - .5)) / .5, 0, 1)) : 1 - smooth(clamp((tr.t - tr.sw) / .5, 0, 1)); if (fa > 0) { fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalAlpha = fa; fctx.fillStyle = '#000'; fctx.fillRect(0, 0, w, h); fctx.restore(); } }
  if (tr && tr.type !== 'ground') {
    // whoosh: radial streaks + a soft bloom that peak right at the switch
    const kb = Math.exp(-Math.pow((tr.t - tr.sw) / .2, 2)), D = Math.hypot(w, h); if (kb > .02) {
      fctx.save(); fctx.globalCompositeOperation = 'lighter'; fctx.lineCap = 'round';
      for (let i = 0; i < 110; i++) { const an = i * 2.399 + i * i * .001, ph = (i * .618 + tr.t * 3.2) % 1, r0 = D * (.06 + ph * .5), r1 = r0 * (1.4 + kb * 2.2); fctx.strokeStyle = `rgba(${i % 3 ? '210,230,255' : '255,240,210'},${(kb * (.35 + ph * .6)).toFixed(3)})`; fctx.lineWidth = (1 + ph * 2.5) * DPR; fctx.beginPath(); fctx.moveTo(w / 2 + Math.cos(an) * r0, h * .48 + Math.sin(an) * r0); fctx.lineTo(w / 2 + Math.cos(an) * r1, h * .48 + Math.sin(an) * r1); fctx.stroke(); }
      const g = fctx.createRadialGradient(w / 2, h * .48, 0, w / 2, h * .48, D * .45); g.addColorStop(0, `rgba(255,255,255,${(kb * .5).toFixed(3)})`); g.addColorStop(.35, `rgba(170,200,255,${(kb * .18).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
      fctx.restore();
    }
  }
  { const kb = Math.exp(-Math.pow((T - burstT - .05) / .22, 2)), D = Math.hypot(w, h); if (kb > .02 && !tr) {
      fctx.save(); fctx.globalCompositeOperation = 'lighter'; fctx.lineCap = 'round';
      for (let i = 0; i < 110; i++) { const an = i * 2.399 + i * i * .001, ph = (i * .618 + (T - burstT) * 3.2) % 1, r0 = D * (.06 + ph * .5), r1 = r0 * (1.4 + kb * 2.2); fctx.strokeStyle = `rgba(${i % 3 ? '210,230,255' : '255,240,210'},${(kb * (.35 + ph * .6)).toFixed(3)})`; fctx.lineWidth = (1 + ph * 2.5) * DPR; fctx.beginPath(); fctx.moveTo(w / 2 + Math.cos(an) * r0, h * .48 + Math.sin(an) * r0); fctx.lineTo(w / 2 + Math.cos(an) * r1, h * .48 + Math.sin(an) * r1); fctx.stroke(); }
      const g = fctx.createRadialGradient(w / 2, h * .48, 0, w / 2, h * .48, D * .45); g.addColorStop(0, `rgba(255,255,255,${(kb * .5).toFixed(3)})`); g.addColorStop(.35, `rgba(170,200,255,${(kb * .18).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
      fctx.restore(); } }
  if (tr && tr.type === 'warp') {
    const k = tr.t < tr.sw ? tr.t / tr.sw : 1 - (tr.t - tr.sw) / (tr.dur - tr.sw); fctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) { const an = i * 2.399, r0 = Math.max(w, h) * (.05 + ((i * .37 + tr.t * 2.5) % 1) * .6); fctx.strokeStyle = `rgba(200,220,255,${k * .6})`; fctx.lineWidth = 1.5 * DPR; fctx.beginPath(); fctx.moveTo(w / 2 + Math.cos(an) * r0, h / 2 + Math.sin(an) * r0); fctx.lineTo(w / 2 + Math.cos(an) * r0 * (1.3 + k), h / 2 + Math.sin(an) * r0 * (1.3 + k)); fctx.stroke(); }
    fctx.globalCompositeOperation = 'source-over';
  }
  if (split > 0 && !tr) {
    const ca = Math.cos(splitAng), sa = Math.sin(splitAng), R = Math.hypot(w, h), a = split;
    fctx.save(); fctx.translate(w / 2, h / 2); fctx.globalCompositeOperation = 'lighter';
    fctx.strokeStyle = ultraCut ? `hsla(${(T * 500) % 360},100%,65%,${a * .6})` : `rgba(140,190,255,${a * .5})`; fctx.lineWidth = 26 * DPR * a; fctx.beginPath(); fctx.moveTo(-ca * R, -sa * R); fctx.lineTo(ca * R, sa * R); fctx.stroke();
    fctx.strokeStyle = `rgba(255,255,255,${a})`; fctx.lineWidth = 4 * DPR * a + 1; fctx.stroke(); fctx.restore();
  }
  if (false) { const a = 0; fctx.save(); fctx.translate(w / 2, h / 2); fctx.rotate(-.42); fctx.globalCompositeOperation = 'lighter'; fctx.fillStyle = `rgba(255,255,255,${a})`; fctx.fillRect(-w * 2, -3 * DPR, w * 4, 6 * DPR); fctx.fillStyle = `rgba(160,120,255,${a * .5})`; fctx.fillRect(-w * 2, -20 * DPR, w * 4, 40 * DPR); fctx.restore(); }
  if (flash > 0) { fctx.globalCompositeOperation = 'source-over'; fctx.fillStyle = `rgba(235,245,255,${flash * .85})`; fctx.fillRect(0, 0, w, h); }
  if (state === 'ready' && qi >= 1) {
    if (qi < 2) { const a = .12 + .08 * Math.sin(T * 10); const g = fctx.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, h * .75); g.addColorStop(0, 'rgba(255,214,10,0)'); g.addColorStop(1, `rgba(255,200,40,${a})`); fctx.fillStyle = g; fctx.fillRect(0, 0, w, h); }
    else drawUltraFx(w, h);
  }
}
function focusLines(c, w, h, k) {
  const cx = w / 2, cy = h * .5, R = Math.hypot(w, h) * .62, n = 120, fr = Math.floor(T * 22), mn = Math.min(w, h);
  c.save(); c.globalCompositeOperation = 'source-over';
  for (let pass = 0; pass < 2; pass++) {
    c.beginPath();
    for (let i = pass; i < n; i += 2) {
      const a = (i + hs(i, fr, 1) * .9) / n * 6.2832, inner = mn * (.36 + hs(i, fr, 2) * .3) * (1.35 - k * .45);
      const dw = (.8 + hs(i, fr, 3) * 3.4) * DPR / R * (.6 + k);
      c.moveTo(cx + Math.cos(a - dw) * R, cy + Math.sin(a - dw) * R); c.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); c.lineTo(cx + Math.cos(a + dw) * R, cy + Math.sin(a + dw) * R); c.closePath();
    }
    c.fillStyle = pass ? (ultraCut ? `hsla(${(T * 240) % 360},100%,80%,${.32 * k})` : `rgba(190,220,255,${.3 * k})`) : `rgba(255,255,255,${.42 * k})`; c.fill();
  }
  c.restore();
}
const qiBarEl = $('#qiBar');
function drawUltraFx(w, h) {
  fctx.globalCompositeOperation = 'lighter';
  const hue = (T * 220) % 360, a = .2 + .08 * Math.sin(T * 14);
  const g = fctx.createRadialGradient(w / 2, h / 2, h * .22, w / 2, h / 2, h * .78); g.addColorStop(0, `hsla(${hue},100%,60%,0)`); g.addColorStop(.7, `hsla(${(hue + 120) % 360},100%,55%,${a * .4})`); g.addColorStop(1, `hsla(${(hue + 240) % 360},100%,60%,${a})`);
  fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
  const r = qiBarEl.getBoundingClientRect();
  const bx0 = r.left * DPR, by0 = r.top * DPR, bw = r.width * DPR, bh = r.height * DPR;
  for (let k = 0; k < 4; k++) {
    const sx = bx0 + Math.random() * bw, sy = by0 + (Math.random() < .5 ? 0 : bh);
    bolt(fctx, sx, sy, sx + (Math.random() - .5) * 90 * DPR, sy + (sy === by0 ? -1 : 1) * (20 + Math.random() * 50) * DPR, 10 * DPR, 7, Math.random() * 360, 1.2 * DPR);
  }
  if (Math.random() < .5) { const side = Math.random() * 4 | 0; let x1, y1; if (side === 0) { x1 = Math.random() * w; y1 = 0; } else if (side === 1) { x1 = w; y1 = Math.random() * h; } else if (side === 2) { x1 = Math.random() * w; y1 = h; } else { x1 = 0; y1 = Math.random() * h; } const tx2 = lerp(x1, w * .75, .35 + Math.random() * .2), ty2 = lerp(y1, h * .8, .35 + Math.random() * .2); bolt(fctx, x1, y1, tx2, ty2, 26 * DPR, 12, Math.random() * 360, 1.6 * DPR); }
  fctx.globalCompositeOperation = 'source-over';
}

// ---------- input: motion ----------
const motion = { R: 0, A: 0, t: -9, count: 0 };
function onMotion(e) {
  const r = e.rotationRate; if (!r) return;
  const R = Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0);
  let Am = 0;
  if (e.acceleration && e.acceleration.x != null) Am = Math.hypot(e.acceleration.x, e.acceleration.y, e.acceleration.z);
  else if (e.accelerationIncludingGravity) { const g = e.accelerationIncludingGravity; Am = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.8); }
  motion.R = R; motion.A = Am; motion.t = T; motion.count++;
  if (state === 'ready' && inputMode === 'motion') {
    if (capture) { capture.R = Math.max(capture.R, R); capture.A = Math.max(capture.A, Am); }
    else if (R > 340 && stT > .5) capture = { R, A: Am, t: 0 };
  }
}
window.addEventListener('devicemotion', onMotion);
async function requestMotion() {
  try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); return r === 'granted'; } } catch (e) { return false; }
  return typeof DeviceMotionEvent !== 'undefined';
}
// ---------- input: swipe ----------
const swipe = { down: false, x: 0, y: 0, t: 0, hist: [], fired: false, lastMove: 0 };
const sReady = $('#sReady');
sReady.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; A.unlock(); swipe.down = true; swipe.fired = false; swipe.x = e.clientX; swipe.y = e.clientY; swipe.hist = [[e.clientX, e.clientY, performance.now()]]; swipe.lastMove = T; });
window.addEventListener('pointermove', e => {
  if (!swipe.down || state !== 'ready') return;
  const now = performance.now(), last = swipe.hist[swipe.hist.length - 1];
  if (Math.hypot(e.clientX - last[0], e.clientY - last[1]) > 6) swipe.lastMove = T;
  swipe.hist.push([e.clientX, e.clientY, now]); while (swipe.hist.length > 2 && now - swipe.hist[0][2] > 140) swipe.hist.shift();
  if (inputMode !== 'swipe' || swipe.fired) return;
  const h0 = swipe.hist[0], d = Math.hypot(e.clientX - h0[0], e.clientY - h0[1]), dtm = Math.max(16, now - h0[2]);
  if (d > Math.min(W, H) * .22) { const v = d / Math.min(W, H) / (dtm / 1000); swipe.fired = true; fire(Math.pow(clamp((v - 1) / 9, 0, 1), .85)); }
});
window.addEventListener('pointerup', () => { swipe.down = false; if (state === 'ready' && inputMode === 'swipe' && !swipe.fired) qi = Math.min(qi, qi * .5); });

// ---------- audio ----------
const A = (() => {
  let ac = null, master = null, nbuf = null, amb = null, curScene = 'dojo';
  function unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = soundOn ? .9 : 0;
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; master.connect(comp); comp.connect(ac.destination);
        nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume();
    if (!amb) ambient();
  }
  const now = () => ac.currentTime;
  function noise(dur, type, f0, f1, q, g0, t0 = 0, pan = 0) {
    if (!ac) return; const t = now() + t0;
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + Math.min(.02, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let out = g; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    s.connect(f); f.connect(g); out.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function tone(type, f0, f1, dur, g0, t0 = 0, att = .005) {
    if (!ac) return; const t = now() + t0;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function ambient() {
    amb = {};
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ac.createGain(); g.gain.value = .045;
    const lfo = ac.createOscillator(); lfo.frequency.value = .09; const lg = ac.createGain(); lg.gain.value = .03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(master); s.start(); amb.wf = f; amb.wg = g;
    const dg = ac.createGain(); dg.gain.value = 0; dg.connect(master); amb.dg = dg;
    for (const fr of [55, 82.5, 110.3]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; o.connect(lp); lp.connect(dg); o.start(); }
    const bird = () => { if (!ac) return; if (curScene === 'dojo' || curScene === 'town' || curScene === 'bamboo') { const b = 2600 + Math.random() * 1400, n = 2 + (Math.random() * 3 | 0), pan = Math.random() * 1.4 - .7; for (let i = 0; i < n; i++) { const t = now() + i * .11; const o = ac.createOscillator(); o.frequency.setValueAtTime(b, t); o.frequency.exponentialRampToValueAtTime(b * 1.35, t + .06); const gg = ac.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.exponentialRampToValueAtTime(.018, t + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + .08); let out = gg; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; gg.connect(p); out = p; } o.connect(gg); out.connect(master); o.start(t); o.stop(t + .1); } } setTimeout(bird, 1200 + Math.random() * 2800); };
    setTimeout(bird, 800);
    setScene(curScene);
  }
  function setScene(id) {
    curScene = id; if (!ac || !amb) return; const t = now();
    const W_ = { dojo: [480, .04], bamboo: [700, .055], town: [420, .04], modern: [260, .06], future: [220, .03], space: [160, .015], galaxy: [140, .01] }[id] || [400, .04];
    amb.wf.frequency.setTargetAtTime(W_[0], t, .3); amb.wg.gain.setTargetAtTime(W_[1], t, .3);
    amb.dg.gain.setTargetAtTime(id === 'future' ? .012 : id === 'space' || id === 'galaxy' ? .02 : id === 'modern' ? .006 : 0, t, .4);
  }
  return {
    unlock, scene: setScene,
    setOn(v) { if (master) master.gain.value = v ? .9 : 0; },
    ring() { if (!ac) return; [1760, 2637, 3951, 5274].forEach((f, i) => tone('sine', f, f * .998, 1.6 - i * .25, .06 / (i + 1))); },
    ultra() { if (!ac) return; [1046, 1318, 1568, 2093, 2637, 3136, 4186].forEach((f, i) => tone('triangle', f, f, 1.8, .05, i * .045)); noise(1.2, 'highpass', 3000, 9000, .7, .12); tone('sine', 60, 120, 1.2, .25); },
    plasma() { if (!ac) return; noise(.05 + Math.random() * .05, 'bandpass', 2000 + Math.random() * 5000, 1500 + Math.random() * 4000, 3, .06 + Math.random() * .05, 0, Math.random() * 1.6 - .8); },
    sheath() { noise(.28, 'bandpass', 1800, 7000, 2.5, .5); [3100, 4700, 6900].forEach((f, i) => tone('sine', f, f, .5, .05 / (i + 1), .05)); },
    whoosh(p) { noise(.45, 'bandpass', 300, 2600 + p * 2000, 1.2, .7); noise(.6, 'lowpass', 900, 120, .7, .5, .05); tone('sine', 90, 40, .5, .5, .03); },
    ultraFire() { [523, 784, 1046, 1568].forEach((f, i) => tone('sawtooth', f, f * 1.5, .6, .04, i * .02)); noise(.8, 'highpass', 6000, 2000, 1, .25); },
    cut(i) { if (!ac) return; const f = 650 + ((i * 137) % 500); noise(.06, 'highpass', 4500, 6500, .7, .35, 0, .2); noise(.16, 'bandpass', f, f * .92, 14, .9); tone('triangle', f * 1.02, f * .7, .09, .12); },
    bigCut() { if (!ac) return; tone('sine', 70, 28, 1.4, .6); noise(1.1, 'lowpass', 1600, 80, .7, .55); noise(.12, 'highpass', 4000, 7000, .7, .45); tone('triangle', 420, 210, .5, .15); },
    thud(s = 1) { if (!ac) return; const k = clamp(Math.log2(s + 1) / 4, .3, 1); tone('sine', 85 - k * 40, 30, .3 + k * .6, .2 + k * .15); noise(.5 + k * .6, 'bandpass', 2400 - k * 1800, 300, .8, .07 + k * .08); },
    nick() { [2300, 3460].forEach((f, i) => tone('sine', f, f, .7, .08 / (i + 1))); noise(.08, 'highpass', 5000, 6000, 1, .3); },
    taiko(g = 1) { tone('sine', 110, 46, .55, .6 * g); noise(.15, 'lowpass', 1200, 200, .8, .45 * g); },
    final() { tone('sine', 70, 30, 1.4, .5); noise(1.2, 'bandpass', 5000, 900, 2, .2); [1318, 1975, 2637].forEach((f, i) => tone('sine', f, f, 2.2, .05 / (i + 1), .1)); },
    crash(s = 1) { if (!ac) return; const k = clamp(Math.log2(s + 1) / 5, .2, 1); noise(.25 + k * .5, 'lowpass', 2600 - k * 1600, 150, .7, .35 + k * .2, 0, Math.random() * 1.2 - .6); noise(.12, 'bandpass', 3200, 1800, 1.5, .18); tone('sine', 120 - k * 60, 40, .3 + k * .4, .25); },
    whip() { noise(.35, 'bandpass', 600, 4000, 1.4, .5); },
    warp() { noise(1.3, 'bandpass', 200, 6000, 1.2, .5); tone('sine', 200, 40, 1.2, .3); tone('sawtooth', 80, 900, .7, .05, .6); },
    leap() { noise(2.4, 'bandpass', 150, 5000, 1.5, .4); tone('sawtooth', 55, 440, 2.2, .06); tone('sine', 880, 110, 2.3, .05); },
    tick() { if (!ac) return; tone('square', 1400 + Math.random() * 600, 1200, .03, .025); },
    lock(last) { this.taiko(last ? 1.1 : .55); tone('sine', last ? 1568 : 2093, last ? 1568 : 2093, last ? 1.4 : .35, last ? .1 : .05); if (last) [1046, 1318, 1568, 2093].forEach((f, i) => tone('triangle', f, f, 1.6, .045, .05 + i * .05)); },
    result(r) { this.taiko(1); setTimeout(() => this.taiko(.8), 180); if (r >= 5) [1046, 1568, 2093, 3136].forEach((f, i) => tone('sine', f, f, 2.4, .05, .35 + i * .07)); }
  };
})();
function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ---------- UI ----------
const tx = () => I18N[lang];
function applyLang() {
  document.documentElement.lang = lang;
  const t = tx();
  for (const el of document.querySelectorAll('[data-t]')) { const v = t[el.dataset.t]; if (typeof v === 'string') el.textContent = v; }
  $('.logo .lc').textContent = t.name[0]; $('.logo .la').textContent = t.name[1]; $('.logo .lb').textContent = t.name[2];
  $('#howList').innerHTML = t.how.map(s => `<li>${s}</li>`).join('');
  $('#bSound').textContent = soundOn ? t.on : t.off;
  $('#langList').innerHTML = Object.keys(LANG_NAMES).map(k => `<button data-l="${k}" class="${k === lang ? 'on' : ''}">${LANG_NAMES[k]}</button>`).join('');
  $('#hLbl').textContent = t.dist.toUpperCase();
  updBest(); updShareLink(); updReadyUI(); fitLogo(); preloadFonts();
}
function updBest() { const [n, u] = fmtDist(distOf(best)); $('#bestNum').textContent = best > 0 ? n : '0'; $('#bestUnit').textContent = best > 0 ? u : 'm'; }
function fitLogo() { const el = $('.logo'); if (!el) return; el.style.fontSize = '100px'; const w = el.scrollWidth || 1; el.style.fontSize = Math.min(120, 100 * (W * .84) / w) + 'px'; }
function updReadyUI() {
  if (state !== 'ready') return; const t = tx();
  $('#readyHint').textContent = inputMode === 'swipe' ? (qi >= 1 && qi < 2 ? t.swipeHold2 : t.swipeHold) : (qi >= 1 && qi < 2 ? t.hold2 : t.hold);
  $('#qiFill').style.width = (Math.min(1, qi) * 100).toFixed(1) + '%';
  $('#qiFill2').style.width = (Math.max(0, qi - 1) * 100).toFixed(1) + '%';
  const w = $('#qiWrap'); w.classList.toggle('full', qi >= 1); w.classList.toggle('ultra', qi >= 2);
  $('#qiLabel').textContent = qi >= 2 ? t.qi2 : t.qi; const dc = $('#drawCall'), dtx = qi >= 2 ? t.draw2 : t.draw; if (dc.textContent !== dtx) { dc.textContent = dtx; const len = [...dtx].length, cjk = /[\u3040-\u9fff\uac00-\ud7af]/.test(dtx); dc.style.fontSize = `min(76px, ${Math.min(15, (cjk ? 84 : 150) / len)}vw)`; }
}
let hudStage = -2;
function updHud(force) {
  const [n, u] = fmtDist(distOf(rDisp));
  const el = $('#cNum'); if (el.textContent !== n) el.textContent = n; const ue = $('#cUnit'); if (ue.textContent !== u) ue.textContent = u;
  const o = scene && (orbit ? orbit.o : scene.objs[nextIdx] || scene.objs[scene.objs.length - 1]); const st = o ? o.stage : 0;
  if (st !== hudStage || force) { hudStage = st; const h = $('#hStage'); h.textContent = tx().stages[st]; h.classList.add('on'); }
}
let cutinTO = 0;
function cutin(main, sub) {
  const c = $('#cutin'); const plain = main.replace(/<[^>]+>/g, ''); const len = [...plain].length;
  const isCJK = /[぀-ヿ㐀-鿿가-힯]/.test(plain);
  c.style.setProperty('--cs', isCJK ? (len <= 3 ? 'clamp(60px,22vw,120px)' : `${Math.min(22, 86 / len)}vw`) : `${Math.min(18, 150 / Math.max(4, len))}vw`);
  c.innerHTML = main + (sub ? `<small>${sub}</small>` : ''); c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); clearTimeout(cutinTO); cutinTO = setTimeout(() => c.classList.remove('go'), 950);
}
let toastTO = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastTO); toastTO = setTimeout(() => t.classList.remove('on'), 3200); }
let lastResult = null;
function showResult() {
  const r = rankOf(REACH), t = tx(), nb = REACH > best + 1e-9;
  if (nb) { best = REACH; try { localStorage.setItem('choiai_best', best); } catch (e) {} }
  const st = stageOf(REACH); const [n, u] = fmtDist(distOf(REACH));
  lastResult = { R: REACH, r, st, n, u };
  $('#rRank').textContent = RANKS[r]; $('#rRank').classList.remove('pop'); void $('#rRank').offsetWidth; $('#rRank').classList.add('pop');
  $('#rTitle').textContent = t.titles[r]; $('#rNum').textContent = n; $('#rUnit').textContent = u;
  $('#rReach').innerHTML = `${t.reach}  <em>${t.stages[st]}</em>`;
  const rb = $('#rBest'); if (nb) rb.textContent = t.newBest; else { const [bn, bu] = fmtDist(distOf(best)); rb.textContent = `${t.best} ${bn} ${bu}`; } rb.classList.toggle('nb', nb);
  updBest(); setScreen('sResult'); A.result(r); updShareLink();
  shareImg = null; makeShareImage().then(b => shareImg = b);
}

// ---------- share ----------
let shareImg = null;
async function makeShareImage(generic) {
  try {
    const t0 = generic ? I18N.ja : tx(), r0 = lastResult; const txt = t0.name.join('') + t0.sub + '一太刀で、どこまで斬れるか。藁から、銀河まで。0123456789.,kmuimemocho.github.io/apps/cho-iai-giri' + (r0 ? r0.n + r0.u + t0.reach + t0.stages[r0.st] + t0.titles[r0.r] + RANKS[r0.r] : '');
    await Promise.all(['400 88px "Dela Gothic One"', '900 40px "Zen Kaku Gothic New"', '700 150px Oswald', '500 18px Oswald'].map(f => document.fonts.load(f, txt).catch(() => {})));
    await document.fonts.ready;
  } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; let x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const scn = renderLandscape(400, 210, generic ? generic : null);
  x.filter = 'brightness(1.2) saturate(1.1)'; x.drawImage(scn, 0, 0, 1200, 630); x.filter = 'none';
  const g = x.createLinearGradient(0, 0, 1200, 0); g.addColorStop(0, 'rgba(14,26,43,.86)'); g.addColorStop(.5, 'rgba(14,26,43,.42)'); g.addColorStop(1, 'rgba(14,26,43,0)'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
  const t = generic ? I18N.ja : tx(), r = lastResult;
  const base = x, tl = document.createElement('canvas'); tl.width = 1200; tl.height = 630; x = tl.getContext('2d');
  x.save(); x.transform(1, 0, -0.12, 1, 0, 0); x.textBaseline = 'alphabetic';
  x.font = '400 88px "Dela Gothic One"'; const w0 = x.measureText(t.name[0]).width, w1 = x.measureText(t.name[1]).width;
  const rg = x.createLinearGradient(96, 70, 96 + w0, 150); ['#ff3b6b', '#ffb020', '#fff35a', '#4dff8a', '#3fd8ff', '#7a6bff'].forEach((cc, i) => rg.addColorStop(i / 5, cc));
  x.fillStyle = rg; x.fillText(t.name[0], 110, 146); x.fillStyle = '#fff'; x.fillText(t.name[1], 110 + w0 + 6, 146); x.fillStyle = '#ffd60a'; x.fillText(t.name[2], 110 + w0 + w1 + 12, 146);
  x.font = '500 18px Oswald'; x.fillStyle = '#d6dfec'; x.fillText(t.sub, 114, 182);
  if (generic === true || (generic && !r)) {
    x.font = '900 40px "Zen Kaku Gothic New",sans-serif'; x.fillStyle = '#fff'; x.fillText('一太刀で、どこまで斬れるか。', 118, 330); x.fillStyle = '#ffd60a'; x.fillText('藁から、銀河まで。', 118, 392); x.restore();
  } else {
    x.font = '700 150px Oswald'; x.fillStyle = '#fff'; x.fillText(r.n, 132, 392);
    const nw = x.measureText(r.n).width; x.font = '400 44px "Dela Gothic One","Zen Kaku Gothic New"'; x.fillStyle = '#ffd60a'; x.fillText(r.u, 148 + nw, 388);
    x.font = '400 30px "Dela Gothic One","Zen Kaku Gothic New"'; x.fillStyle = '#d6dfec'; x.fillText(`${t.reach}  ${t.stages[r.st]}`, 140, 248);
    x.font = '700 112px Oswald'; x.fillStyle = '#ffd60a'; x.fillText(RANKS[r.r], 160, 540); const rw = x.measureText(RANKS[r.r]).width;
    let fs = 40; x.font = `900 ${fs}px "Zen Kaku Gothic New","Dela Gothic One",sans-serif`; x.fillStyle = '#fff'; while (x.measureText(t.titles[r.r]).width > 1200 - 220 - rw - 80 && fs > 18) { fs -= 2; x.font = `900 ${fs}px "Zen Kaku Gothic New","Dela Gothic One",sans-serif`; }
    x.fillText(t.titles[r.r], 190 + rw, 524); x.restore();
  }
  base.save(); base.shadowColor = 'rgba(14,26,43,.95)'; base.shadowBlur = 22; base.drawImage(tl, 0, 0); base.restore(); x = base;
  x.font = '500 20px Oswald'; x.fillStyle = 'rgba(214,223,236,.85)'; x.textAlign = 'right'; x.fillText('uimemocho.github.io/apps/cho-iai-giri', 1170, 606);
  const bar = x.createLinearGradient(0, 0, 1200, 0); ['#ff3b6b', '#ffb020', '#fff35a', '#4dff8a', '#3fd8ff', '#7a6bff', '#ff4fd8'].forEach((cc, i) => bar.addColorStop(i / 6, cc)); x.fillStyle = bar; x.fillRect(0, 622, 1200, 8);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
function shareText() { const r = lastResult, t = tx(); return t.shareText(t.stages[r.st], `${r.n} ${r.u}`, RANKS[r.r], t.titles[r.r]); }
function shareIntentURL() { if (!lastResult) return 'https://twitter.com/intent/tweet'; return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(URL_GAME); }
function updShareLink() { const a = $('#bShare'); if (a) a.href = shareIntentURL(); }
const inFrame = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
function onShareClick(e) {
  if (!lastResult) { e.preventDefault(); return; }
  updShareLink();
  if (!inFrame && shareImg && navigator.canShare) {
    let file = null; try { file = new File([shareImg], 'cho-iai-giri.png', { type: 'image/png' }); } catch (err) {}
    if (file && navigator.canShare({ files: [file] })) { e.preventDefault(); navigator.share({ files: [file], text: shareText() + '\n' + URL_GAME }).catch(err => { if (err && err.name === 'AbortError') return; location.href = shareIntentURL(); }); return; }
  }
}
async function doSave() {
  if (!shareImg) shareImg = await makeShareImage();
  const a = document.createElement('a'); a.href = URL.createObjectURL(shareImg); a.download = `cho-iai-giri_${lastResult ? RANKS[lastResult.r] : 'E'}.png`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- buttons ----------
let warned = false; try { warned = localStorage.getItem('choiai_warn') === '1'; } catch (e) {}
async function startReady() { A.unlock(); const ok = await requestMotion(); inputMode = ok ? 'motion' : 'swipe'; motion.count = 0; go('ready'); if (!ok) toast(tx().motionOff); }
$('#bStart').onclick = () => { A.unlock(); if (!warned) { $('#mWarn').classList.add('on'); return; } startReady(); };
$('#bWarnOk').onclick = () => { warned = true; try { localStorage.setItem('choiai_warn', '1'); } catch (e) {} $('#mWarn').classList.remove('on'); startReady(); };
$('#bHow').onclick = () => $('#mHow').classList.add('on');
$('#bSet').onclick = () => $('#mSet').classList.add('on');
for (const m of document.querySelectorAll('.modal')) m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) { if (m.id !== 'mWarn') m.classList.remove('on'); } });
$('#bSound').onclick = () => { soundOn = !soundOn; try { localStorage.setItem('choiai_snd', soundOn ? '1' : '0'); } catch (e) {} A.setOn(soundOn); applyLang(); };
$('#langList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; lang = b.dataset.l; try { localStorage.setItem('choiai_lang', lang); } catch (e) {} applyLang(); });
$('#bRetry').onclick = () => startReady();
$('#bBack').onclick = () => go('title');
$('#bBackR').onclick = () => go('title');
$('#bShare').addEventListener('click', onShareClick);
$('#bSave').onclick = () => doSave();
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const raw = Math.min(.05, (now - last) / 1000); last = now;
  if (DBG.on) { DBG.acc += raw; DBG.n++; if (DBG.acc > .5) { DBG.fps = Math.round(DBG.n / DBG.acc); DBG.acc = 0; DBG.n = 0; const e = $('#dFps'); if (e) e.textContent = `${DBG.fps} fps  ${tx().stages[stageOf(Math.max(rDisp, .01))]}  ${state}`; } }
  update(raw * DBG.speed); render(); requestAnimationFrame(loop);
}
// ---------- debug mode (?debug or tap the title logo 5 times) ----------
const DBG = { on: false, speed: 1, fps: 0, acc: 0, n: 0, taps: [] };
function dbgOpen() {
  if (DBG.on) return; DBG.on = true;
  const d = document.createElement('div'); d.id = 'dbg'; d.className = 'on';
  const st = tx().stages;
  d.innerHTML = `<div class="dh"><b>DEBUG</b><span id="dFps">--</span><button data-a="min">ー</button></div>
  <div class="db">
    <label>開始<select id="dFrom">${SCENES.map((id, i) => `<option value="${i}">${st[SC_STAGE[i]]}</option>`).join('')}</select></label>
    <label>到達<select id="dReach">${st.map((n, i) => `<option value="${i + 1}"${i === 13 ? ' selected' : ''}>${n}まで斬る</option>`).join('')}<option value="0.5">道場で止める</option></select></label>
    <label><span><input type="checkbox" id="dUltra" checked> 超気</span><span>速度 <select id="dSpd" style="max-width:60px"><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option></select></span></label>
    <button class="go" data-a="go">この条件で斬る</button>
    <div class="r3"><button data-a="q1">気 満タン</button><button data-a="q2">超気</button><button data-a="res">リザルト</button></div>
    <label><span><input type="checkbox" id="dHud" checked> HUD表示</span><button data-a="best">ベスト消去</button></label>
  </div>`;
  app.appendChild(d);
  d.addEventListener('click', e => {
    const a = e.target.closest('button'); if (!a) return; const k = a.dataset.a;
    if (k === 'min') d.classList.toggle('min');
    if (k === 'go') dbgGo(+$('#dFrom').value, +$('#dReach').value, $('#dUltra').checked);
    if (k === 'q1' && state === 'ready') qi = Math.max(qi, 1);
    if (k === 'q2' && state === 'ready') { qi = 2; qiUltraAt = T; }
    if (k === 'res' && state !== 'title' && state !== 'result') { if (state === 'ready' || state === 'slash') REACH = REACH || .21; finalObj = finalObj || scene.objs[Math.max(0, nextIdx - 1)]; trans = null; app.classList.remove('cine'); go('result'); }
    if (k === 'best') { best = 0; try { localStorage.removeItem('choiai_best'); } catch (er) {} updBest(); toast('BEST RESET'); }
  });
  d.addEventListener('change', e => { if (e.target.id === 'dSpd') DBG.speed = +e.target.value; if (e.target.id === 'dHud') app.classList.toggle('nohud', !e.target.checked); });
  d.addEventListener('pointerdown', e => e.stopPropagation());
}
function dbgGo(i, reach, ultra) {
  A.unlock(); go('ready');
  qi = ultra ? 2 : 1; ultraCut = ultra; perfect = false; power = 1; REACH = clamp(Math.max(reach, SC_STAGE[i] + .01), .21, 14);
  loadScene(i); go('chase'); hitstop = 0; split = 0; flash = .6; finalObj = null; stopped = false;
  const o = scene.objs[0]; cs = o.fs; wave.on = true; wave.fade = 1; wave.vert = o.kind === 'galaxy'; wave.x = 0; wave.y = o.cutY; wave.v = cs * scene.kv; wave.z = scene.startZ; wave.hw = cs * .5;
  chaseT = 0; timeScale = 1; shownStage = -1; rDisp = SC_STAGE[i]; fol.x = -1.1; fol.y = .3; fol.z = -2.2; stT = .6; anc.x = wave.x; anc.y = wave.y; galS = wave.vert ? 1 : 0; wave.vt = wave.vert ? 1 : 0; camReset(); earthCut = false;
  camS.px = wave.x + fol.x * cs; camS.py = wave.y + fol.y * cs; camS.pz = wave.z + fol.z * cs; camS.tx = wave.x; camS.ty = wave.y; camS.tz = wave.z + 2.5 * cs;
}
$('.logo').addEventListener('click', () => { const t = performance.now(); DBG.taps = DBG.taps.filter(v => t - v < 2500); DBG.taps.push(t); if (DBG.taps.length >= 5) { DBG.taps = []; dbgOpen(); toast('DEBUG MODE'); } });
if (/[?&#]debug/.test(location.search + location.hash)) setTimeout(dbgOpen, 0);
function preloadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const t = tx(); const all = '0123456789.,AD TIMELEAPkmly→？' + t.stages.join('') + t.eras.flat().join('') + t.titles.join('') + t.name.join('') + t.cut + t.perfect + t.ultra + t.nick + t.galaxyCut + t.timeCut + t.reach + t.dist + t.ly + t.qi + t.qi2 + t.draw + t.draw2 + t.newBest + t.best;
  document.fonts.load('400 40px "Dela Gothic One"', all).catch(() => {}); document.fonts.load('900 40px "Zen Kaku Gothic New"', all).catch(() => {});
  document.fonts.load('700 40px Oswald', all).catch(() => {}); document.fonts.load('500 40px Oswald', all).catch(() => {});
}
// debug hook (testing only)
window.__cho = {
  fire: (p, q = 2) => { qi = q; qiUltraAt = T; qiFullAt = T; fire(p); }, go, get state() { return state; }, get scene() { return scene && scene.id; }, get reach() { return REACH; }, get rDisp() { return rDisp; }, get trans() { return trans && trans.type; },
  dcut: () => scene.deco.filter(o => o.cut).length + "/" + scene.deco.filter(o => o.dz).length + "/" + scene.deco.length,
  tri: () => { let t = 0; root.traverse(o => { if (o.isMesh && o.geometry.index) t += o.geometry.index.count / 3; if (o.isPoints) t += o.geometry.attributes.position.count; }); return t; },
  prof: n => { const r = { upd: 0, scene: 0, sky: 0, gl: 0, comp: 0 }; for (let i = 0; i < n; i++) { let t = performance.now(); update(1 / 60); r.upd += performance.now() - t; t = performance.now(); drawSky(); r.sky += performance.now() - t; t = performance.now(); render3D(); r.gl += performance.now() - t; t = performance.now(); renderScene(true); r.scene += performance.now() - t; t = performance.now(); composite(); r.comp += performance.now() - t; } for (const k in r) r[k] = +(r[k] / n).toFixed(1); return r; },
  perf: n => { const t0 = performance.now(); for (let i = 0; i < n; i++) renderScene(true); return (performance.now() - t0) / n; },
  trace: n => { const r = []; for (let i = 0; i < n; i++) { update(1 / 60); r.push([cam.yaw, cam.pitch, cam.fov, cam.x / cs, cam.y / cs, cam.z / cs, state, trans ? 1 : 0, timeScale, scene.id, earthCut ? 1 : 0, nextIdx, +CS.th.x.toFixed(3), +CS.d.x.toFixed(3), shotK, +stT.toFixed(2), +camS.px.toFixed(2), +camS.pz.toFixed(2), +camS.tx.toFixed(2), +camS.tz.toFixed(2)]); if (state === 'result' || state === 'wide') break; } return r; },
  fdbg: () => { const o = scene.objs[nextIdx]; if (!o) return null; const ok = proj(o.x, o.cutY, o.z, tA); return [nextIdx, +FW.x.toFixed(2), +((o.z - wave.z)).toFixed(1), ok ? Math.round(tA[3]) : null, LW, +cs.toFixed(1), +waveGrow().toFixed(2), +camS.tx.toFixed(1), +o.x.toFixed(1), +cam.x.toFixed(1)]; },
  fl: () => [flight ? +flight.t.toFixed(2) : -1, nextIdx, +wave.z.toFixed(1), +wave.v.toFixed(1), scene.objs[nextIdx] ? scene.objs[nextIdx].m : '', scene.objs[nextIdx] ? +scene.objs[nextIdx].z.toFixed(1) : 0, !!orbit],
  pause: v => { DBG.speed = v ? 0 : 1; },
  tr: () => trans && [trans.t.toFixed(3), trans.sw, trans.done, !!trans.snapped, trans.glass && trans.glass.sh ? trans.glass.sh.length : 0, snapC.width],
  skip: t => { for (let i = 0; i < t * 60; i++) update(1 / 60); render(); }, setQi: v => { qi = v; }, buildAll: () => { while (!preDone) prebuildNext(1e15); },
  view: (id, setup) => { loadScene(SCENES.indexOf(id)); state = 'view'; if (setup) setup({ scene, cutObj, lookAt, cam, camS, upd: d => { updPieces(d); updParts(d); } }); },
  ogp: async () => { const sv = scene; loadScene(5); const e = scene.objs[0]; power = .8; cutObj(e); for (let i = 0; i < 90; i++) { updPieces(1 / 60); updParts(1 / 60); } parts = []; slashes = []; const b = await makeShareImage(() => lookAt(e.x - 15, e.y + 9, e.z - 14, e.x + 2, e.y + 4, e.z + 3)); scene = sv; return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
};

loadScene(0);
resize(); addEventListener('resize', resize);
applyLang();
if (document.fonts) document.fonts.ready.then(fitLogo);
camForState(1); camUpdate();
requestAnimationFrame(loop);
})();
