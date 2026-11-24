// 居合斬り — sprite-stack pixel pseudo-3D (Canvas 2D)
(() => {
'use strict';
const $ = s => document.querySelector(s);
const view = $('#view'), vctx = view.getContext('2d');
const fx = $('#fx'), fctx = fx.getContext('2d');
const low = document.createElement('canvas'), ctx = low.getContext('2d');
const app = $('#app');
const URL_GAME = 'https://uimemocho.github.io/apps/iai-giri/';
const MAX_BAMBOO = 120;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// ---------- RNG ----------
let seed = 20261124;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

// ---------- sizing ----------
let W = 0, H = 0, DPR = 1, S = 3, LW = 200, LH = 400, HW = 100, HH = 200, F = 300;
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  view.width = fx.width = Math.round(W * DPR); view.height = fx.height = Math.round(H * DPR);
  S = Math.max(2, Math.round(W * DPR / 210));
  LW = Math.ceil(view.width / S); LH = Math.ceil(view.height / S);
  low.width = LW; low.height = LH; HW = LW / 2; HH = LH / 2;
  ctx.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;
  fitLogo();
}

// ---------- color utils ----------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const FOG = hex('#16233f');
const NFOG = 8;
const fogT = b => Math.min(.9, b / (NFOG - 1) * .9);

// ---------- textures ----------
function stripTex(pal, fb) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 1;
  const g = c.getContext('2d'); const ft = fogT(fb);
  const [dark, mid, light, rim, out] = pal.map(hex);
  for (let x = 0; x < 16; x++) {
    const n = x / 15 * 2 - 1;
    let l = clamp(1 - Math.abs(n + .38) * 1.3, 0, 1);
    l = Math.round(l * 3) / 3;
    let col = l < .5 ? mixc(dark, mid, l * 2) : mixc(mid, light, (l - .5) * 2);
    if (x === 13) col = mixc(col, rim, .45);
    if (x === 14) col = mixc(dark, rim, .8);
    if (x === 0 || x === 15) col = out;
    g.fillStyle = css(mixc(col, FOG, ft)); g.fillRect(x, 0, 1, 1);
  }
  return c;
}
const PALS = {
  g1: ['#0f2a22', '#2a5c45', '#6aa680', '#a6dcc4', '#040b09'],
  g2: ['#202816', '#4b5730', '#8f9a5a', '#cfd79c', '#070905'],
  g3: ['#0d2526', '#235150', '#5f9b8e', '#9fd8d0', '#030a0a'],
  node: ['#2a4a3a', '#5f9478', '#bfe0c4', '#eefaf0', '#0a1712'],
  nodeD: ['#030806', '#0a1913', '#173628', '#3b6a55', '#020504'],
  sheath: ['#24170e', '#523822', '#8c6740', '#c9a678', '#0a0604'],
  branch: ['#0b1d17', '#1d3f31', '#3e7058', '#6fa88e', '#030806'],
};
const TEX = {};
for (const k in PALS) { TEX[k] = []; for (let b = 0; b < NFOG; b++) TEX[k].push(stripTex(PALS[k], b)); }

function faceTex(fb) {
  const c = document.createElement('canvas'); c.width = c.height = 14; const g = c.getContext('2d'); const ft = fogT(fb);
  const rim = hex('#2f6a4f'), ring = hex('#f1e9c6'), ring2 = hex('#c9bd8e'), hole = hex('#1a160e'), hole2 = hex('#3a3020');
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot(x - 6.5, y - 6.5); if (d > 7) continue;
    let col = d > 5.8 ? rim : d > 4.1 ? (y < 6 ? ring : ring2) : (y > 8 ? hole2 : hole);
    g.fillStyle = css(mixc(col, FOG, ft)); g.fillRect(x, y, 1, 1);
  }
  return c;
}
const FACE = []; for (let b = 0; b < NFOG; b++) FACE.push(faceTex(b));

function leafTex(v, fb) {
  const c = document.createElement('canvas'); c.width = 28; c.height = 18; const g = c.getContext('2d'); const ft = fogT(fb);
  const save = seed; seed = 777 + v * 131;
  const cols = ['#0c2219', '#17392a', '#2c5c43', '#5f9a78', '#9ccdb0'].map(hex);
  const n = 6 + (rnd() * 4 | 0);
  for (let i = 0; i < n; i++) {
    const a = rr(-Math.PI * .95, -Math.PI * .05) + (rnd() < .3 ? Math.PI * .5 : 0);
    const len = rr(7, 12), bx = 14 + rr(-4, 4), by = 7 + rr(-2, 3);
    for (let t = 0; t <= len; t++) {
      const wdt = Math.sin(t / len * Math.PI) * 1.6 + .2;
      const px = bx + Math.cos(a) * t, py = by + Math.sin(a) * t * .6 + t * t * .02;
      for (let s = -wdt; s <= wdt; s += 1) {
        const qx = Math.round(px - Math.sin(a) * s), qy = Math.round(py + Math.cos(a) * s * .6);
        let ci = s < -wdt + 1 ? 3 : s > wdt - 1 ? 1 : 2;
        if (t > len * .75 && s < 0) ci = 4;
        if (i % 3 === 0) ci = Math.max(0, ci - 1);
        g.fillStyle = css(mixc(cols[ci], FOG, ft)); g.fillRect(qx, qy, 1, 1);
      }
    }
  }
  seed = save;
  return c;
}
const LEAF = []; for (let v = 0; v < 4; v++) { LEAF.push([]); for (let b = 0; b < NFOG; b++) LEAF[v].push(leafTex(v, b)); }

function moonTex() {
  const c = document.createElement('canvas'); c.width = c.height = 30; const g = c.getContext('2d');
  const save = seed; seed = 99;
  const cr = []; for (let i = 0; i < 9; i++) cr.push([rr(5, 25), rr(5, 25), rr(1.2, 3.6)]);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
    const d = Math.hypot(x - 14.5, y - 14.5); if (d > 14.5) continue;
    let col = hex('#fbf6dc');
    const sh = (x - 14.5) * .5 + (y - 14.5) * .35; if (sh > 4) col = hex('#ebe2bb'); if (sh > 8) col = hex('#d9cc9e');
    for (const [cx, cy, r] of cr) { const e = Math.hypot(x - cx, y - cy); if (e < r) col = mixc(col, hex('#b8ad80'), e < r - 1 ? .55 : .3); }
    if (d > 13.6) col = mixc(col, hex('#fff8d8'), .6);
    g.fillStyle = css(col); g.fillRect(x, y, 1, 1);
  }
  seed = save; return c;
}
const MOON = moonTex();

// ---------- sprite stacks (true layered slices) ----------
function makeStack(n, size, paint) {
  const L = [];
  for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(i, g, size); L.push(c); }
  return L;
}
function sqr(g, s, w, col, col2) { const o = (s - w) / 2 | 0; g.fillStyle = col; g.fillRect(o, o, w, w); if (col2) { g.fillStyle = col2; g.fillRect(o, o, w, 1); g.fillRect(o, o, 1, w); } }
function circ(g, s, r, col, col2) { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const d = Math.hypot(x - s / 2 + .5, y - s / 2 + .5); if (d <= r) { g.fillStyle = (col2 && d > r - 1 && (x + y) < s) ? col2 : col; g.fillRect(x, y, 1, 1); } } }
const LANTERN = makeStack(26, 18, (i, g, s) => {
  const st = '#3d424c', hi = '#5f6672', dk = '#22252c';
  if (i < 3) sqr(g, s, 14 - i, i === 2 ? hi : st, hi);
  else if (i < 10) circ(g, s, 2.6, st, hi);
  else if (i < 12) sqr(g, s, 13, i === 11 ? hi : st, hi);
  else if (i < 18) { sqr(g, s, 11, dk); const o = (s - 11) / 2 | 0; g.fillStyle = '#ffcf6a'; g.fillRect(o + 2, o + 2, 7, 7); g.fillStyle = '#fff2c0'; g.fillRect(o + 4, o + 4, 3, 3); g.fillStyle = st; g.fillRect(o, o, 11, 1); g.fillRect(o, o + 10, 11, 1); g.fillRect(o, o, 1, 11); g.fillRect(o + 10, o, 1, 11); if (i === 12 || i === 17) sqr(g, s, 11, st, hi); }
  else if (i < 22) sqr(g, s, 17 - (i - 18) * 3, i === 18 ? hi : st, hi);
  else circ(g, s, i < 24 ? 2 : 1.2, st, hi);
});
const ROCKS = [0, 1, 2].map(v => {
  const save = seed; seed = 500 + v * 17; const ph = [rr(0, 6), rr(0, 6), rr(0, 6)]; const n = 7 + v * 2; seed = save;
  return makeStack(n, 16, (i, g, s) => {
    const r0 = 7 * Math.sqrt(1 - Math.pow(i / n, 1.6));
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5);
      const rad = r0 * (1 + .18 * Math.sin(a * 2 + ph[0]) + .1 * Math.sin(a * 3 + ph[1]));
      if (d <= rad) { const moss = i > n * .6 && Math.sin(x * 1.7 + y * 2.3 + ph[2]) > .3; g.fillStyle = moss ? '#2b4a30' : (d > rad - 1 && a < -.5 && a > -2.6) ? '#7b818c' : (i % 2 ? '#4b505a' : '#454a53'); g.fillRect(x, y, 1, 1); }
    }
  });
});

// ---------- world ----------
function genNodes(h) {
  const n = []; let s = 0; n.push(0);
  while (s < h) { const t = s / h; s += lerp(.2, .44, Math.min(1, t * 2.2)) * (t > .8 ? .8 : 1) * rr(.92, 1.08); if (s < h) n.push(s); }
  n.push(h); return n;
}
function genBamboo(x, z, row) {
  const h = row ? rr(7.5, 9.5) : rr(6, 11);
  const b = { x, z, h, r: row ? rr(.055, .07) : rr(.035, .075), nodes: genNodes(h), type: rnd() < .22 ? 'g2' : rnd() < .3 ? 'g3' : 'g1',
    sheath: rnd() < .35 ? 1 + (rnd() * 2 | 0) : 0, lean: [row ? rr(-.01, .01) : rr(-.05, .05), row ? 0 : rr(-.03, .03)], leaves: [], ph: rr(0, 6.28), row,
    cut: false, piece: null, cutH: 0, shake: 0 };
  for (let i = 0; i < b.nodes.length; i++) {
    const s = b.nodes[i];
    if (s > h * .52 && (i % 2 === 0 || s > h * .85)) {
      const a = rr(0, 6.28), o = rr(.25, .65) * (s / h + .3);
      b.leaves.push({ s: s + rr(.1, .4), ox: Math.cos(a) * o, oz: Math.sin(a) * o, v: rnd() * 4 | 0, sz: rr(.7, 1.25), br: rnd() < .6 });
    }
  }
  b.leaves.push({ s: h + .2, ox: 0, oz: 0, v: rnd() * 4 | 0, sz: 1.3, br: false });
  return b;
}
let row = [], bg = [], props = [], groundDots = [], stars = [], sil = [], fireflies = [];
function buildWorld() {
  seed = 20261124;
  row = []; bg = []; props = []; groundDots = []; stars = []; sil = [];
  let z = 3;
  for (let i = 0; i < MAX_BAMBOO; i++) { row.push(genBamboo(rr(-.32, .32), z, true)); z += rr(1.05, 1.3); }
  for (let i = 0; i < 520; i++) {
    const side = rnd() < .5 ? -1 : 1;
    const x = side < 0 ? -rr(4.7, 16) : rr(1.7, 16);
    const zz = rr(-14, 175);
    if (zz < -1 && x > -7 && x < 2.2) continue;
    bg.push(genBamboo(x, zz, false));
  }
  // props: stone lanterns + rocks (sprite stacks)
  props.push({ x: -4.6, z: 12, kind: 'lantern', yaw: .1, sc: 1 });
  props.push({ x: 1.4, z: 9.6, kind: 'lantern', yaw: -.2, sc: 1 });
  for (let zz = 28; zz < 160; zz += rr(22, 30)) props.push({ x: rr(1.4, 1.7), z: zz, kind: 'lantern', yaw: rr(-.4, .4), sc: 1 });
  for (let i = 0; i < 26; i++) props.push({ x: rnd() < .6 ? rr(.9, 3.2) : -rr(4.4, 6.5), z: rr(-2, 160), kind: 'rock', v: rnd() * 3 | 0, yaw: rr(0, 6.28), sc: rr(.5, 1.1) });
  for (let i = 0; i < 1300; i++) {
    const zz = rr(-10, 170), x = rr(-9, 9) * (rnd() < .6 ? .45 : 1);
    const c = ['#1b2a1d', '#243322', '#2f3a24', '#3a3a26', '#1a2433', '#2a2f3c'][rnd() * 6 | 0];
    groundDots.push([x, zz, c, rnd() < .15 ? 2 : 1]);
  }
  for (let i = 0; i < 340; i++) stars.push({ a: rr(-Math.PI, Math.PI), e: Math.asin(rr(.02, .98)) * 1.05, b: rr(.25, 1), s: rr(.5, 3), p: rr(0, 6.28), big: rnd() < .06 });
  for (let l = 0; l < 3; l++) for (let i = 0; i < 90 + l * 30; i++) sil.push({ l, a: rr(-Math.PI, Math.PI), w: rr(.6, 1.8) * (1 + (2 - l) * .4), lean: rr(-.06, .06), hy: rr(.3, 1) });
  fireflies = [];
  for (let i = 0; i < 26; i++) fireflies.push({ x: rr(-3, 3), y: rr(.3, 2.2), z: rr(0, 60), p: rr(0, 6.28), s: rr(.4, 1) });
}

// ---------- camera ----------
const cam = { x: 0, y: 1.5, z: -1, yaw: 0, pitch: 0, fov: 1.05, roll: 0 };
let cY = 1, sY = 0, cP = 1, sP = 0;
function camUpdate() { cY = Math.cos(cam.yaw); sY = Math.sin(cam.yaw); cP = Math.cos(cam.pitch); sP = Math.sin(cam.pitch); F = HH / Math.tan(cam.fov / 2); }
function lookAt(px, py, pz, tx, ty, tz) {
  cam.x = px; cam.y = py; cam.z = pz;
  const dx = tx - px, dy = ty - py, dz = tz - pz;
  cam.yaw = Math.atan2(dx, dz); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}
function toCamDir(x, y, z, o) {
  const x1 = x * cY - z * sY, z1 = x * sY + z * cY;
  o[0] = x1; o[1] = y * cP - z1 * sP; o[2] = y * sP + z1 * cP; return o;
}
function toCam(x, y, z, o) { return toCamDir(x - cam.x, y - cam.y, z - cam.z, o); }
const NEAR = .12;

// ---------- drawing primitives (low-res) ----------
const tA = [0, 0, 0], tB = [0, 0, 0];
function drawSeg(ax, ay, az, bx, by, bz, r, tex) {
  if (az < NEAR && bz < NEAR) return;
  if (az < NEAR) { const t = (NEAR - az) / (bz - az); ax += (bx - ax) * t; ay += (by - ay) * t; az = NEAR; }
  else if (bz < NEAR) { const t = (NEAR - bz) / (az - bz); bx += (ax - bx) * t; by += (ay - by) * t; bz = NEAR; }
  const pax = HW + F * ax / az, pay = HH - F * ay / az, pbx = HW + F * bx / bz, pby = HH - F * by / bz;
  const w = Math.max(1, r * F * (1 / az + 1 / bz));
  if ((pax < -w && pbx < -w) || (pax > LW + w && pbx > LW + w) || (pay < -2 && pby < -2) || (pay > LH + 2 && pby > LH + 2)) return;
  let dx = pbx - pax, dy = pby - pay; let len = Math.hypot(dx, dy);
  if (len < 1) { if (len < 1e-4) { dx = 0; dy = -1; } else { dx /= len; dy /= len; } len = 1; dx *= 1; dy *= 1; }
  const ux = dx / len, uy = dy / len; const px = -uy, py = ux;
  const ddx = ux * Math.max(len, 1), ddy = uy * Math.max(len, 1);
  ctx.setTransform(px * w, py * w, ddx, ddy, pax - px * w / 2, pay - py * w / 2);
  ctx.drawImage(tex, 0, 0, 1, 1);
}
function drawFace(cx, cy, cz, ux, uy, uz, r, fb, sign) {
  if (cz < NEAR) return;
  const il = 1 / Math.hypot(cx, cy, cz);
  const facing = -(ux * cx + uy * cy + uz * cz) * il * sign;
  if (facing <= .02) return;
  const sx = HW + F * cx / cz, sy = HH - F * cy / cz;
  const w = r * 2.1 * F / cz;
  // screen axis direction
  const ex = cx + ux * .1, ey = cy + uy * .1, ez = Math.max(NEAR, cz + uz * .1);
  let dx = HW + F * ex / ez - sx, dy = HH - F * ey / ez - sy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const k = Math.max(.22, facing);
  const px = -dy, py = dx;
  ctx.setTransform(px * w, py * w, dx * w * k, dy * w * k, sx - (px * w + dx * w * k) / 2, sy - (py * w + dy * w * k) / 2);
  ctx.drawImage(FACE[fb], 0, 0, 1, 1);
}
function proj(x, y, z, o) { toCam(x, y, z, o); if (o[2] < NEAR) return false; o[3] = HW + F * o[0] / o[2]; o[4] = HH - F * o[1] / o[2]; return true; }

// rotation (Rodrigues) about horizontal axis k by angle th → matrix
function rotMat(kx, kz, th) {
  const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  // axis (kx,0,kz)
  return [t * kx * kx + c, -s * kz, t * kx * kz,
          s * kz, c, -s * kx,
          t * kx * kz, s * kx, t * kz * kz + c];
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mv = (m, x, y, z, o) => { o[0] = m[0] * x + m[1] * y + m[2] * z; o[1] = m[3] * x + m[4] * y + m[5] * z; o[2] = m[6] * x + m[7] * y + m[8] * z; return o; };

// generic stalk renderer. world origin O, matrix M, local range [s0,s1] with nodes offset
const Oc = [0, 0, 0], Uc = [0, 0, 0], Xc = [0, 0, 0], Zc = [0, 0, 0], tmp = [0, 0, 0], tmp2 = [0, 0, 0];
function fogBucket(z) { return clamp(((z - 5) / 42 * NFOG) | 0, 0, NFOG - 1); }
function drawStalk(b, ox, oy, oz, M, s0, s1, nodeOff, opts) {
  toCam(ox, oy, oz, Oc);
  mv(M, b.lean[0], 1, b.lean[1], tmp); toCamDir(tmp[0], tmp[1], tmp[2], Uc);
  const mz = Oc[2] + Uc[2] * (s1 - s0) * .5;
  if (mz < NEAR && Oc[2] + Uc[2] * (s1 - s0) < NEAR) return;
  const fb = Math.min(NFOG - 1, fogBucket(Math.max(Oc[2], mz)) + (b.row ? 0 : 1));
  const far = mz > 24;
  const tx = TEX[b.type][fb], tn = TEX.node[fb], td = TEX.nodeD[fb], tsh = TEX.sheath[fb];
  const nodes = b.nodes; const r = b.r;
  const len = s1 - s0;
  if (far) {
    drawSeg(Oc[0], Oc[1], Oc[2], Oc[0] + Uc[0] * len, Oc[1] + Uc[1] * len, Oc[2] + Uc[2] * len, r, tx);
  } else {
    let prev = s0;
    for (let i = 0; i < nodes.length; i++) {
      const sN = nodes[i]; if (sN <= s0 + 1e-4) continue;
      const e = Math.min(sN, s1);
      const a = prev - s0, c = e - s0;
      const tt = (b.sheath && i <= b.sheath) ? tsh : tx;
      drawSeg(Oc[0] + Uc[0] * a, Oc[1] + Uc[1] * a, Oc[2] + Uc[2] * a, Oc[0] + Uc[0] * c, Oc[1] + Uc[1] * c, Oc[2] + Uc[2] * c, r * (1 - sN / b.h * .25), tt);
      if (sN < s1 - .02 && sN > s0 + .02) {
        const q = c, rw = r * (1 - sN / b.h * .25);
        drawSeg(Oc[0] + Uc[0] * (q - .02), Oc[1] + Uc[1] * (q - .02), Oc[2] + Uc[2] * (q - .02), Oc[0] + Uc[0] * (q + .01), Oc[1] + Uc[1] * (q + .01), Oc[2] + Uc[2] * (q + .01), rw * 1.13, tn);
        drawSeg(Oc[0] + Uc[0] * (q - .045), Oc[1] + Uc[1] * (q - .045), Oc[2] + Uc[2] * (q - .045), Oc[0] + Uc[0] * (q - .02), Oc[1] + Uc[1] * (q - .02), Oc[2] + Uc[2] * (q - .02), rw * 1.03, td);
      }
      prev = e; if (e >= s1) break;
    }
  }
  // cut faces
  if (opts && opts.topFace) drawFace(Oc[0] + Uc[0] * len, Oc[1] + Uc[1] * len, Oc[2] + Uc[2] * len, Uc[0], Uc[1], Uc[2], r, fb, 1);
  if (opts && opts.botFace) drawFace(Oc[0], Oc[1], Oc[2], Uc[0], Uc[1], Uc[2], r, fb, -1);
  // leaves
  if (opts && opts.leaves && mz < 70) {
    const lv = b.leaves; const tb = TEX.branch[fb];
    for (let i = 0; i < lv.length; i++) {
      const L = lv[i]; if (L.s < s0 + .3) continue;
      const sl = L.s - s0;
      const sw = Math.sin(T * 1.3 + b.ph + i) * .06 * (L.s / b.h);
      mv(M, L.ox + sw + b.lean[0] * L.s, sl, L.oz + b.lean[1] * L.s, tmp);
      toCamDir(tmp[0], tmp[1], tmp[2], tmp2);
      const lx = Oc[0] + tmp2[0], ly = Oc[1] + tmp2[1], lz = Oc[2] + tmp2[2];
      if (lz < .3) continue;
      if (L.br && !far) {
        const bs = sl - .25;
        drawSeg(Oc[0] + Uc[0] * bs, Oc[1] + Uc[1] * bs, Oc[2] + Uc[2] * bs, lx, ly, lz, .008, tb);
      }
      const sz = L.sz * F / lz; if (sz < 1.5) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(LEAF[L.v][fogBucket(lz)], HW + F * lx / lz - sz / 2, HH - F * ly / lz - sz * .3, sz, sz * .64);
    }
  }
}
function drawStack(p) {
  const layers = p.kind === 'lantern' ? LANTERN : ROCKS[p.v];
  const height = p.kind === 'lantern' ? 1.75 * p.sc : .45 * p.sc;
  const size = p.kind === 'lantern' ? .78 * p.sc : .9 * p.sc;
  toCam(p.x, 0, p.z, Oc); if (Oc[2] < .4) return;
  toCam(p.x, height, p.z, tmp); if (tmp[2] < .4) return;
  const bx = HW + F * Oc[0] / Oc[2], by = HH - F * Oc[1] / Oc[2], tx2 = HW + F * tmp[0] / tmp[2], ty2 = HH - F * tmp[1] / tmp[2];
  const w = size * F / Oc[2]; if (bx < -w || bx > LW + w) return;
  const hpx = Math.hypot(tx2 - bx, ty2 - by);
  const steps = Math.max(layers.length, Math.ceil(hpx));
  const phi = cam.yaw - p.yaw; const k = clamp(Math.abs(Math.sin(Math.atan2(cam.y - height * .5, Math.hypot(p.x - cam.x, p.z - cam.z)))), .16, 1);
  const c = Math.cos(phi), s = Math.sin(phi);
  const fb = fogBucket(Oc[2]);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1); const L = layers[Math.min(layers.length - 1, (t * layers.length) | 0)];
    const cx = lerp(bx, tx2, t), cy = lerp(by, ty2, t);
    ctx.setTransform(c * w, s * w * k, -s * w, c * w * k, cx - (c * w - s * w) / 2, cy - (s * w * k + c * w * k) / 2);
    ctx.drawImage(L, 0, 0, 1, 1);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (fb > 0) { /* fog veil */ }
  if (p.kind === 'lantern') {
    const ly = lerp(by, ty2, .58), r = w * 2.4;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(bx, ly, 0, bx, ly, r);
    g.addColorStop(0, 'rgba(255,190,90,.55)'); g.addColorStop(.4, 'rgba(255,150,60,.16)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(bx - r, ly - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- sky / background ----------
function drawSky() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const hy = HH + F * Math.tan(cam.pitch);
  const g = ctx.createLinearGradient(0, hy - F * 1.4, 0, hy);
  g.addColorStop(0, '#03050d'); g.addColorStop(.55, '#0b1430'); g.addColorStop(.88, '#1a2a55'); g.addColorStop(1, '#243766');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, Math.max(0, hy + 1));
  // stars
  for (const s of stars) {
    toCamDir(Math.sin(s.a) * Math.cos(s.e), Math.sin(s.e), Math.cos(s.a) * Math.cos(s.e), tmp);
    if (tmp[2] < .05) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2];
    if (x < 0 || x > LW || y < 0 || y > hy) continue;
    const tw = .5 + .5 * Math.sin(T * s.s + s.p); const a = s.b * (.35 + .65 * tw);
    ctx.fillStyle = `rgba(${220 + 35 * tw | 0},${230 + 25 * tw | 0},255,${a})`;
    ctx.fillRect(x | 0, y | 0, 1, 1);
    if (s.big && tw > .6) { ctx.fillStyle = `rgba(200,220,255,${(tw - .6) * 1.5 * s.b})`; ctx.fillRect((x | 0) - 1, y | 0, 3, 1); ctx.fillRect(x | 0, (y | 0) - 1, 1, 3); }
  }
  // moon
  const ma = .12, me = .3;
  toCamDir(Math.sin(ma) * Math.cos(me), Math.sin(me), Math.cos(ma) * Math.cos(me), tmp);
  if (tmp[2] > .05) {
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2];
    const ms = Math.max(14, F * .085) | 0;
    ctx.globalCompositeOperation = 'lighter';
    let hg = ctx.createRadialGradient(x, y, ms * .3, x, y, ms * 4.2);
    hg.addColorStop(0, 'rgba(160,190,255,.32)'); hg.addColorStop(.35, 'rgba(90,120,200,.12)'); hg.addColorStop(1, 'rgba(40,60,120,0)');
    ctx.fillStyle = hg; ctx.fillRect(x - ms * 4.2, y - ms * 4.2, ms * 8.4, ms * 8.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(MOON, Math.round(x - ms / 2), Math.round(y - ms / 2), ms, ms);
    moonScreen = [x, y, ms];
  } else moonScreen = null;
  // silhouettes (distant grove)
  const lc = ['#0c1428', '#0a1122', '#070c18'];
  for (const s of sil) {
    toCamDir(Math.sin(s.a), 0, Math.cos(s.a), tmp); if (tmp[2] < .05) continue;
    const x = HW + F * tmp[0] / tmp[2]; if (x < -4 || x > LW + 4) continue;
    const w = Math.max(1, s.w * F / 220);
    ctx.fillStyle = lc[s.l];
    const top = hy - F * (.35 + s.hy * .9) * (1 + s.l * .25);
    ctx.setTransform(1, 0, s.lean, 1, 0, 0);
    ctx.fillRect(x - s.lean * hy, top, w, hy - top + 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // mist band
  const mg = ctx.createLinearGradient(0, hy - F * .25, 0, hy + F * .05);
  mg.addColorStop(0, 'rgba(40,60,110,0)'); mg.addColorStop(.8, 'rgba(50,72,125,.35)'); mg.addColorStop(1, 'rgba(30,44,80,.2)');
  ctx.fillStyle = mg; ctx.fillRect(0, hy - F * .25, LW, F * .3);
  // ground
  const gg = ctx.createLinearGradient(0, hy, 0, LH);
  gg.addColorStop(0, '#141f36'); gg.addColorStop(.12, '#0e1626'); gg.addColorStop(1, '#070a10');
  ctx.fillStyle = gg; ctx.fillRect(0, Math.max(0, hy), LW, LH - hy + 1);
  for (const d of groundDots) {
    toCam(d[0], 0, d[1], tmp); if (tmp[2] < .3 || tmp[2] > 60) continue;
    const x = HW + F * tmp[0] / tmp[2]; if (x < 0 || x > LW) continue;
    const y = HH - F * tmp[1] / tmp[2]; if (y > LH) continue;
    const sz = tmp[2] < 6 ? d[3] + (tmp[2] < 3 ? 1 : 0) : 1;
    ctx.fillStyle = d[2]; ctx.fillRect(x | 0, y | 0, sz, 1);
  }
}
let moonScreen = null;

// ---------- particles ----------
let parts = [], slashes = [];
function addP(p) { if (parts.length < 900) parts.push(p); }
function burst(x, y, z, power) {
  for (let i = 0; i < 10; i++) addP({ x, y, z, vx: rr(-1, 3), vy: rr(-.5, 2.5), vz: rr(-1, 3), life: rr(.4, .9), t: 0, k: 'chip', c: rnd() < .5 ? '#efe6c2' : '#9fd0a8' });
  for (let i = 0; i < 9; i++) addP({ x, y, z, vx: rr(-5, 5), vy: rr(-2, 4), vz: rr(-2, 6), life: rr(.12, .35), t: 0, k: 'spark', c: rnd() < .4 ? '#ffe680' : '#ffffff' });
}
function leafFall(x, y, z, n) { for (let i = 0; i < n; i++) addP({ x: x + rr(-1, 1), y: y + rr(-1, 1), z: z + rr(-1, 1), vx: rr(-.6, .6), vy: rr(-.4, .2), vz: rr(-.6, .6), life: rr(2, 4), t: 0, k: 'leaf', c: rnd() < .5 ? '#2c5c43' : '#5f9a78', p: rr(0, 6) }); }
function dust(x, z, n) { for (let i = 0; i < n; i++) addP({ x: x + rr(-1.5, 1.5), y: .05, z: z + rr(-1.5, 1.5), vx: rr(-.8, .8), vy: rr(.2, .9), vz: rr(-.8, .8), life: rr(.6, 1.3), t: 0, k: 'dust', c: '#56607a' }); }
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
    if (p.k === 'leaf') { p.vy -= .6 * dt; p.vy *= .96; p.vx += Math.sin(T * 3 + p.p) * dt * 1.5; p.vx *= .97; p.vz *= .97; }
    else if (p.k === 'dust') { p.vx *= .94; p.vy *= .94; p.vz *= .94; }
    else p.vy -= 9.8 * dt * (p.k === 'spark' ? .3 : 1);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0) { p.y = 0; p.vy *= -.25; p.vx *= .6; p.vz *= .6; }
  }
}
function drawParts() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of parts) {
    toCam(p.x, p.y, p.z, tmp); if (tmp[2] < .15) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2]; if (x < -4 || x > LW + 4 || y < -4 || y > LH + 4) continue;
    const a = 1 - p.t / p.life;
    if (p.k === 'spark') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.c; const s = Math.max(1, Math.min(3, .04 * F / tmp[2])); ctx.fillRect(x, y, s, s); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'dust') { ctx.globalAlpha = a * .35; ctx.fillStyle = p.c; const s = Math.max(1, (.15 + p.t * .4) * F / tmp[2]); ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    else { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c; const s = Math.max(1, Math.min(4, .05 * F / tmp[2])); ctx.fillRect(x, y, p.k === 'leaf' ? s * (1 + (Math.sin(T * 9 + (p.p || 0)) > 0)) : s, s); }
  }
  ctx.globalAlpha = 1;
  // fireflies
  ctx.globalCompositeOperation = 'lighter';
  for (const f of fireflies) {
    const fx_ = f.x + Math.sin(T * .4 * f.s + f.p) * .8, fy = f.y + Math.sin(T * .7 + f.p * 2) * .3, fz = f.z + Math.cos(T * .3 + f.p) * .8;
    toCam(fx_, fy, fz, tmp); if (tmp[2] < .3 || tmp[2] > 40) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2];
    const a = Math.max(0, Math.sin(T * 1.6 * f.s + f.p)) * clamp(1 - tmp[2] / 40, 0, 1);
    if (a < .05) continue;
    ctx.fillStyle = `rgba(200,255,140,${a})`; ctx.fillRect(x | 0, y | 0, 1, 1);
    ctx.fillStyle = `rgba(160,255,120,${a * .25})`; ctx.fillRect((x | 0) - 1, (y | 0) - 1, 3, 3);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawSlashes() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  for (const s of slashes) {
    const a = 1 - s.t / s.life; if (a <= 0) continue;
    const L = .55 + (1 - a) * .5;
    if (!proj(s.x - L, s.y + L * .42, s.z - .05, tA)) continue; const ax = tA[3], ay = tA[4];
    if (!proj(s.x + L, s.y - L * .42, s.z + .05, tB)) continue;
    ctx.strokeStyle = `rgba(150,200,255,${a * .35})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tB[3], tB[4]); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tB[3], tB[4]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].t > slashes[i].life) slashes.splice(i, 1);
}
// slash wave crescent
function drawWave() {
  if (!wave.on) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  const fade = wave.fade;
  for (let g = 3; g >= 0; g--) {
    const zz = wave.z - g * .55 * (1 + wave.v * .03);
    const al = (g === 0 ? 1 : .35 / g) * fade;
    let first = true; ctx.beginPath();
    let ok = true;
    for (let i = 0; i <= 16; i++) {
      const u = i / 8 - 1;
      const x = wave.x + u * .62, y = 1.05 - u * .26, z = zz - (u * u) * .3;
      if (!proj(x, y, z, tA)) { ok = false; break; }
      if (first) { ctx.moveTo(tA[3], tA[4]); first = false; } else ctx.lineTo(tA[3], tA[4]);
    }
    if (!ok) continue;
    toCam(wave.x, 1.05, zz, tmp); const wpx = Math.max(1, .045 * F / Math.max(.3, tmp[2]));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(110,170,255,${.2 * al})`; ctx.lineWidth = wpx * 3.2; ctx.stroke();
    ctx.strokeStyle = `rgba(190,225,255,${.5 * al})`; ctx.lineWidth = wpx * 1.8; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,240,${al})`; ctx.lineWidth = Math.max(1, wpx * .6); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- katana (screen-space pixel art) ----------
function drawKatana(t, mode) {
  // mode: 0 sheathed, 1 drawing swing (t 0..1)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = LW / 200;
  const breathe = Math.sin(T * 1.6) * 1.2 * u;
  let hx = LW * .92, hy = LH * .86 + breathe + (1 - ease(kataIn)) * 90 * u;
  let ang = -2.76; // pointing up-left
  if (mode === 1) { ang = lerp(-2.76, -2.76 + 3.4, ease(t)); hx += t * 40 * u; hy -= Math.sin(t * Math.PI) * 30 * u; }
  ctx.save(); ctx.translate(hx | 0, hy | 0); ctx.rotate(ang + Math.PI / 2 * 0);
  const c = Math.cos(ang), s = Math.sin(ang);
  ctx.setTransform(c, s, -s, c, hx | 0, hy | 0);
  // along +x = toward tip
  const tsukaL = 46 * u, tw = 9 * u;
  // tsuka (handle)
  ctx.fillStyle = '#0c0c10'; ctx.fillRect(-6 * u, -tw / 2, tsukaL + 6 * u, tw);
  ctx.fillStyle = '#e9e4d4';
  for (let x = -2 * u; x < tsukaL - 4 * u; x += 7 * u) { ctx.beginPath(); ctx.moveTo(x, -tw / 2); ctx.lineTo(x + 3.5 * u, 0); ctx.lineTo(x, tw / 2); ctx.lineTo(x + 2 * u, tw / 2); ctx.lineTo(x + 5.5 * u, 0); ctx.lineTo(x + 2 * u, -tw / 2); ctx.fill(); }
  ctx.fillStyle = '#b8902e'; ctx.fillRect(-7 * u, -tw / 2 - 1, 3 * u, tw + 2); ctx.fillRect(tsukaL - 4 * u, -tw / 2 - 1, 4 * u, tw + 2);
  // tsuba
  ctx.fillStyle = '#6b5420'; ctx.fillRect(tsukaL, -tw * 1.25, 3 * u, tw * 2.5);
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(tsukaL, -tw * 1.25, 1 * u, tw * 2.5);
  ctx.fillStyle = '#c79a32'; ctx.fillRect(tsukaL + 3 * u, -tw / 2 + 1, 3 * u, tw - 2);
  const bx = tsukaL + 6 * u;
  if (mode === 0) {
    // saya
    const sl = 150 * u, sw = 8 * u;
    ctx.fillStyle = '#07070b'; ctx.fillRect(bx, -sw / 2, sl, sw);
    ctx.fillStyle = '#23253a'; ctx.fillRect(bx, -sw / 2 + 1, sl, Math.max(1, u));
    ctx.fillStyle = '#4b5070'; ctx.fillRect(bx + 8 * u, -sw / 2 + 1, sl * .5, 1);
    ctx.fillStyle = '#c79a32'; ctx.fillRect(bx, -sw / 2, 3 * u, sw);
    ctx.fillStyle = '#5a1420'; ctx.fillRect(bx + 18 * u, -sw / 2 - 1, 5 * u, sw + 2); // kurikata + sageo
    ctx.fillStyle = '#8a2a36'; ctx.fillRect(bx + 18 * u, sw / 2, 2 * u, 14 * u);
    // glint when qi full
    if (qiFullT > 0) { const gx = bx + ((T * 120 * u) % (sl * 1.6)); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,140,.7)'; ctx.fillRect(gx, -sw / 2, 4 * u, 1); ctx.globalCompositeOperation = 'source-over'; }
  } else {
    // blade
    const bl = 150 * u;
    ctx.fillStyle = '#9aa6b8'; ctx.beginPath(); ctx.moveTo(bx, -3.5 * u); ctx.lineTo(bx + bl, -2 * u); ctx.lineTo(bx + bl + 8 * u, 1 * u); ctx.lineTo(bx + bl, 3 * u); ctx.lineTo(bx, 3 * u); ctx.fill();
    ctx.fillStyle = '#f4f8ff'; ctx.fillRect(bx, 1 * u, bl, Math.max(1, u));
    ctx.fillStyle = '#5b6578'; ctx.fillRect(bx, -3.5 * u, bl, Math.max(1, u));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
  if (mode === 1 && t > .1 && t < .85) {
    // swing smear arc
    ctx.globalCompositeOperation = 'lighter';
    const a0 = lerp(-2.76, -2.76 + 3.4, ease(t - .15)), a1 = lerp(-2.76, -2.76 + 3.4, ease(t));
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(120,180,255,.25)' : k === 1 ? 'rgba(200,230,255,.5)' : 'rgba(255,255,255,.95)';
      ctx.lineWidth = (6 - k * 2.3) * u;
      ctx.beginPath(); ctx.arc(hx, hy, 175 * u, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- game state ----------
let state = 'title', T = 0, stT = 0;
let qi = 0, qiFullT = 0, qiFullAt = 0, kataIn = 0;
let timeScale = 1, hitstop = 0, shake = 0, flash = 0, split = 0, splitAng = -.4;
let N = 0, cutCount = 0, power = 0, perfect = false;
const wave = { on: false, x: 0, z: 0, v: 0, fade: 1, stopZ: 0, done: false };
let shot = 0, shotT = 0, lastCutIdx = -1, finalT = 0, finalBamboo = null;
let camS = { px: 0, py: 1.5, pz: -1, tx: 0, ty: 1, tz: 5, fov: 1.05, roll: 0 };
let best = 0; try { best = +localStorage.getItem('iai_best') || 0; } catch (e) {}
let lang = detectLang(), soundOn = true; try { soundOn = localStorage.getItem('iai_snd') !== '0'; } catch (e) {}
let inputMode = 'motion';
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const RANK_TH = [0, 5, 12, 22, 36, 55, 78, 100];
const rankOf = n => { let r = 0; for (let i = 0; i < RANK_TH.length; i++) if (n >= RANK_TH[i]) r = i; return r; };

function resetWorld() {
  for (const b of row) { b.cut = false; b.piece = null; b.shake = 0; }
  parts = []; slashes = []; wave.on = false; cutCount = 0; N = 0;
}
function setScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
function go(s) {
  state = s; stT = 0;
  if (s === 'title') { setScreen('sTitle'); app.classList.remove('cine'); resetWorld(); }
  if (s === 'ready') { setScreen('sReady'); qi = 0; qiFullT = 0; qiFullAt = 0; kataIn = 0; resetWorld(); capture = null; updReadyUI(); app.classList.remove('cine'); }
  if (s === 'slash') { setScreen(''); }
  if (s === 'chase') { setScreen('sHud'); app.classList.add('cine'); $('#cNum').textContent = '0'; }
  if (s === 'result') { showResult(); }
}

// ---------- trigger ----------
function fire(p) {
  if (state !== 'ready') return;
  power = clamp(p, 0, 1);
  const glow = qi >= 1 && (T - qiFullAt) < 1.5;
  perfect = glow;
  const mult = qi < 1 ? .55 + .4 * qi : glow ? 1.18 : .96;
  N = clamp(Math.round(MAX_BAMBOO * Math.pow(power, 1.15) * mult), 1, MAX_BAMBOO);
  go('slash');
  hitstop = .09; flash = 1; shake = 1; split = 1; splitAng = rr(-.55, -.3);
  A.sheath(); A.whoosh(power); vib([30, 20, 60]);
  wave.on = false; wave.x = 0; wave.z = .6; wave.v = 0; wave.fade = 1; wave.done = false;
  cutin(perfect ? '<em>一閃</em>' : '斬', '');
}
function startChase() {
  go('chase');
  wave.on = true; wave.z = .8; wave.x = 0;
  wave.vmax = 16 + 26 * power; shot = 0; shotT = 0; lastCutIdx = -1;
  timeScale = .3;
}
function cutBamboo(b, idx) {
  b.cut = true; const ch = rr(.85, 1.2); b.cutH = ch;
  const fxv = 1, fzv = rr(-.6, .15); const l = Math.hypot(fxv, fzv);
  const fdx = fxv / l, fdz = fzv / l;
  b.piece = { x: b.x, y: ch, z: b.z, fdx, fdz, kx: fdz, kz: -fdx, th: .04, w: rr(1.1, 1.6) + power * 1.2, vx: fdx * rr(1.2, 2.2), vz: fdz * rr(1, 2), vy: rr(.6, 1.2) + power, landed: false, slide: 0 };
  slashes.push({ x: b.x, y: ch, z: b.z, t: 0, life: .32 });
  burst(b.x, ch, b.z, power);
  leafFall(b.x, b.h * .8, b.z, 3);
  A.cut(idx);
  cutCount++;
  const n = $('#cNum'); n.textContent = cutCount; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
  const ms = { 10: ['疾風', 10], 25: ['迅雷', 25], 50: ['烈火', 50], 75: ['無双', 75], 100: ['神速', 100], 120: ['全斬', 120] }[cutCount];
  if (ms && cutCount < N) { cutin(ms[0], ms[1] + ' CUTS'); A.taiko(.8); hitstop = .05; shake = .7; flash = .35; vib(25); }
  else if (cutCount % 5 === 0) vib(8);
  shake = Math.max(shake, .25);
}
function updPieces(dt) {
  for (const b of row) {
    if (b.shake > 0) b.shake = Math.max(0, b.shake - dt * 1.4);
    const p = b.piece; if (!p || p.landed === 2) continue;
    const L = b.h - b.cutH;
    if (!p.landed) {
      const alpha = 1.5 * 9.8 / L * Math.sin(p.th) + .4;
      p.w += alpha * dt; p.th += p.w * dt;
      p.slide += dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.vy -= 9.8 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y <= 0) { p.vx *= .9; p.vz *= .9; }
      if (p.th >= 1.53) {
        p.th = 1.53; p.landed = 1; p.w = -p.w * .18; p.vx *= .2; p.vz *= .2;
        dust(p.x + p.fdx * L * .6, p.z + p.fdz * L * .6, 6);
        leafFall(p.x + p.fdx * L, 1, p.z + p.fdz * L, 6);
        if (state === 'chase' || state === 'final' || state === 'slash') A.thud();
      }
    } else {
      p.th += p.w * dt; p.w += 6 * dt; p.y = Math.max(0, p.y - 3 * dt);
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.th >= 1.545) { p.th = 1.545; if (Math.abs(p.w) < .5) { p.landed = 2; p.w = 0; } else p.w = -p.w * .2; }
    }
  }
}

// ---------- camera direction per state ----------
function camForState(dt) {
  let px, py, pz, tx, ty, tz, fov = 1.05, roll = 0, snap = false;
  const zw = wave.z;
  if (state === 'title') {
    const a = T * .06;
    px = Math.sin(a) * 1.6 - .6; py = 1.6 + Math.sin(T * .2) * .2; pz = -4.5 + Math.cos(a) * 1.2;
    tx = .2; ty = 2.7; tz = 12; fov = 1.1;
  } else if (state === 'ready' || state === 'slash') {
    const sw = Math.sin(T * .9) * .02;
    px = -.32 + sw; py = 1.42 + Math.sin(T * 1.6) * .012; pz = -1.05;
    tx = .05; ty = 1.18; tz = 7; fov = 1.0 - (qi >= 1 ? .1 : qi * .06);
    if (state === 'slash') { fov -= stT * .4; roll = -stT * .15; }
  } else if (state === 'chase') {
    const sp = wave.v / 40;
    if (shot === 0) { px = -2.3; py = 1.15; pz = zw - 2.7; tx = .35; ty = 1.05; tz = zw + 2.6; fov = 1.08 + sp * .2; roll = -.05; }
    else if (shot === 1) { px = -1.05; py = .32; pz = zw - 1.9; tx = .5; ty = 1.6; tz = zw + 3.2; fov = 1.2 + sp * .2; roll = .13; }
    else if (shot === 2) { px = -1.7; py = 1.45; pz = zw + 4.6; tx = .2; ty = 1.0; tz = zw - .6; fov = 1.0; roll = -.08; }
    else { px = -3.6; py = 3.3; pz = zw - 4.2; tx = .6; ty = .8; tz = zw + 3.2; fov = 1.0 + sp * .15; roll = .04; }
    snap = true;
  } else if (state === 'final') {
    const b = finalBamboo; const a = stT * .25;
    px = b.x - 2.8 + Math.sin(a) * .5; py = 1.25 + stT * .35; pz = b.z - 2.6 - stT * .4; tx = b.x + 1.6; ty = 1.5; tz = b.z - .4; fov = 1.1 + stT * .08; roll = .06;
  } else if (state === 'wide' || state === 'result') {
    const zEnd = finalBamboo ? finalBamboo.z : 10;
    const t = ease(Math.min(1, (state === 'wide' ? stT : 3) / 2.2));
    const d = Math.max(8, zEnd * .35);
    px = lerp(-2.4, -3.4, t) + Math.sin(T * .1) * .3; py = lerp(1.3, 4.2 + Math.min(4, zEnd * .03), t); pz = lerp(zEnd - 3, -5 - Math.min(10, zEnd * .05), t);
    tx = .6; ty = lerp(1.2, .6, t); tz = lerp(zEnd + 1, Math.max(10, zEnd * .55), t); fov = lerp(1.0, 1.15, t);
  }
  const k = snap ? 1 : 1 - Math.exp(-dt * (state === 'wide' ? 6 : 3));
  camS.px = lerp(camS.px, px, k); camS.py = lerp(camS.py, py, k); camS.pz = lerp(camS.pz, pz, k);
  camS.tx = lerp(camS.tx, tx, k); camS.ty = lerp(camS.ty, ty, k); camS.tz = lerp(camS.tz, tz, k);
  camS.fov = lerp(camS.fov, fov, 1 - Math.exp(-dt * 5)); camS.roll = lerp(camS.roll, roll, 1 - Math.exp(-dt * 4));
  lookAt(camS.px, camS.py, camS.pz, camS.tx, camS.ty, camS.tz);
  cam.fov = camS.fov; cam.roll = camS.roll;
}

// ---------- update ----------
let capture = null; // gyro capture
function update(rdt) {
  T += rdt;
  if (hitstop > 0) { hitstop -= rdt; camUpdate(); return; }
  if (state === 'chase' || state === 'final') {
    const target = state === 'final' ? .22 : 1;
    timeScale = lerp(timeScale, target, 1 - Math.exp(-rdt * (state === 'final' ? 8 : 2.2)));
  } else timeScale = lerp(timeScale, 1, 1 - Math.exp(-rdt * 4));
  const dt = rdt * timeScale; stT += rdt;
  shake = Math.max(0, shake - rdt * 2.6); flash = Math.max(0, flash - rdt * 3.2); split = Math.max(0, split - rdt * 2.2);

  if (state === 'ready') {
    kataIn = Math.min(1, kataIn + rdt * 2.2);
    if (inputMode === 'motion') {
      const R = motion.R;
      if (capture) {
        capture.t += rdt;
        if (capture.t > .18) { const pk = capture; capture = null; fire(.78 * clamp((pk.R - 300) / 1500, 0, 1) + .22 * clamp(pk.A / 38, 0, 1)); }
      } else if (R < 28 && T - motion.t < .5) qiAdd(rdt / 1.25);
      else if (R < 300) qiAdd(-rdt * .7 * clamp((R - 28) / 120, 0, 1));
      if (inputMode === 'motion' && stT > 1.1 && T - motion.t > 1.0 && motion.count === 0) { inputMode = 'swipe'; toast(L().motionOff); updReadyUI(); }
    } else {
      if (swipe.down && !swipe.fired) { if (T - swipe.lastMove > .08) qiAdd(rdt / 1.1); }
    }
    if (qi >= 1) qiFullT += rdt;
    updReadyUI();
  }
  if (state === 'slash') {
    if (stT > .42) startChase();
  }
  if (state === 'chase') {
    const remain = N - cutCount;
    const idx = cutCount;
    const done = cutCount >= N;
    if (!done) {
      const frac = remain / Math.max(1, N);
      wave.v = Math.max(7, wave.vmax * (.38 + .62 * Math.min(1, frac * 1.4)));
      wave.z += wave.v * dt;
      const b = row[idx];
      wave.x = lerp(wave.x, b.x, 1 - Math.exp(-dt * 6));
      if (wave.z >= b.z) {
        cutBamboo(b, idx);
        if (cutCount >= N) { finalBamboo = b; go('final'); A.final(); flash = .5; shake = 1; vib([40, 30, 80]); }
        // shot changes
        const every = N < 10 ? 999 : Math.max(5, Math.round(N / 7));
        if (cutCount % every === 0 && cutCount < N - 2) { shot = (shot + 1) % 4; flash = Math.max(flash, .25); }
      }
    }
  }
  if (state === 'final') {
    // wave continues to nick next bamboo
    const nb = row[N];
    if (wave.on) {
      wave.v = lerp(wave.v, 3, 1 - Math.exp(-dt * 3));
      wave.z += wave.v * dt; wave.fade = Math.max(0, wave.fade - dt * 1.6);
      if (nb && wave.z >= nb.z - .2 && !wave.done) { wave.done = true; nb.shake = 1; A.nick(); burst(nb.x, 1.05, nb.z, .2); }
      if (wave.fade <= 0) wave.on = false;
    }
    if (stT > 1.9) { go('wide'); app.classList.remove('cine'); A.taiko(1.2); }
  }
  if (state === 'wide' && stT > 2.4) go('result');
  for (const s of slashes) s.t += dt;
  updPieces(dt);
  updParts(dt);
  camForState(rdt);
  camUpdate();
}
function qiAdd(v) {
  const was = qi >= 1;
  qi = clamp(qi + v, 0, 1);
  if (qi >= 1 && !was) { qiFullAt = T; qiFullT = 0; A.ring(); vib(15); }
  if (qi < 1) qiFullT = 0;
}

// ---------- render ----------
const sortList = [];
function render() { renderScene(true); composite(); }
function renderScene(withUI) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawSky();
  // collect objects
  sortList.length = 0;
  const tanX = HW / F * 1.25 + .1;
  for (const b of bg) {
    toCam(b.x, 0, b.z, tmp); if (tmp[2] < -1 || tmp[2] > 62) continue;
    if (Math.abs(tmp[0]) > (Math.max(tmp[2], 0) + 2) * tanX + 1) continue;
    sortList.push([tmp[2], 0, b]);
  }
  for (const b of row) {
    toCam(b.x, 0, b.z, tmp);
    if (!b.piece) { if (tmp[2] < -1 || tmp[2] > 80) continue; if (Math.abs(tmp[0]) > (Math.max(tmp[2], 0) + 2) * tanX + 1) continue; sortList.push([tmp[2], 1, b]); }
    else {
      if (tmp[2] > -1 && tmp[2] < 80) sortList.push([tmp[2], 2, b]);
      const p = b.piece, L = (b.h - b.cutH) * .5;
      toCam(p.x + Math.sin(p.th) * p.fdx * L, p.y + Math.cos(p.th) * L, p.z + Math.sin(p.th) * p.fdz * L, tmp2);
      if (tmp2[2] > -4 && tmp2[2] < 80) sortList.push([tmp2[2], 3, b]);
    }
  }
  for (const p of props) { toCam(p.x, 0, p.z, tmp); if (tmp[2] < .3 || tmp[2] > 60) continue; sortList.push([tmp[2], 4, p]); }
  sortList.sort((a, b) => b[0] - a[0]);
  for (const it of sortList) {
    const b = it[2];
    if (it[1] === 0) drawStalk(b, b.x, 0, b.z, I3, 0, b.h, 0, { leaves: true });
    else if (it[1] === 1) {
      const sh = b.shake ? Math.sin(T * 60) * b.shake * .03 : 0;
      drawStalk(b, b.x + sh, 0, b.z, I3, 0, b.h, 0, { leaves: true });
    } else if (it[1] === 2) drawStalk(b, b.x, 0, b.z, I3, 0, b.cutH, 0, { topFace: true });
    else if (it[1] === 3) {
      const p = b.piece; const M = rotMat(p.kx, p.kz, p.th);
      drawStalk(b, p.x, p.y, p.z, M, b.cutH, b.h, 0, { leaves: true, botFace: true });
    } else drawStack(b);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawParts();
  drawSlashes();
  drawWave();
  if (withUI && state === 'ready') drawKatana(0, 0);
  if (withUI && state === 'slash') drawKatana(Math.min(1, stT / .3), 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function renderLandscape(w, h, camSet) {
  const sv = [LW, LH, HW, HH, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, cam.fov];
  LW = w; LH = h; HW = w / 2; HH = h / 2; low.width = w; low.height = h; ctx.imageSmoothingEnabled = false;
  if (camSet) camSet(); cam.fov = .78; camUpdate(); renderScene(false);
  const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(low, 0, 0);
  [LW, LH, HW, HH, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, cam.fov] = sv; low.width = LW; low.height = LH; ctx.imageSmoothingEnabled = false; camUpdate();
  return out;
}
function composite() {
  const w = view.width, h = view.height;
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.fillStyle = '#05080f'; vctx.fillRect(0, 0, w, h);
  const sx = (rnd() - .5) * shake * 10 * DPR, sy = (rnd() - .5) * shake * 10 * DPR;
  const roll = cam.roll; const zoom = 1 + Math.abs(roll) * .35 + shake * .02;
  const dw = LW * S, dh = LH * S;
  const drawLow = () => { vctx.drawImage(low, -dw / 2, -dh / 2, dw, dh); };
  vctx.save(); vctx.translate(w / 2 + sx, h / 2 + sy); vctx.rotate(roll); vctx.scale(zoom, zoom);
  if (split > 0) {
    const off = Math.sin(split * Math.PI) * 18 * DPR * split;
    const ca = Math.cos(splitAng), sa = Math.sin(splitAng); const nx = -sa, ny = ca; const R = Math.hypot(w, h);
    for (const side of [1, -1]) {
      vctx.save(); vctx.beginPath();
      vctx.moveTo(-ca * R, -sa * R); vctx.lineTo(ca * R, sa * R); vctx.lineTo(ca * R + nx * R * side, sa * R + ny * R * side); vctx.lineTo(-ca * R + nx * R * side, -sa * R + ny * R * side); vctx.closePath(); vctx.clip();
      vctx.translate(ca * off * side, sa * off * side); drawLow(); vctx.restore();
    }
  } else drawLow();
  vctx.restore();
  // fx overlay
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, w, h);
  if (state === 'chase' && wave.v > 10) {
    const a = clamp((wave.v - 10) / 30, 0, .55);
    fctx.strokeStyle = `rgba(220,235,255,${a * .5})`; fctx.lineWidth = 1.5 * DPR;
    const cx = w * .55, cy = h * .45;
    for (let i = 0; i < 26; i++) {
      const an = (i * 2.399 + Math.floor(T * 30) * .7) % 6.283; const r0 = Math.max(w, h) * (.38 + ((i * 7.3 + T * 9) % 1) * .2);
      fctx.beginPath(); fctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); fctx.lineTo(cx + Math.cos(an) * r0 * 1.6, cy + Math.sin(an) * r0 * 1.6); fctx.stroke();
    }
  }
  if (split > 0) {
    const ca = Math.cos(splitAng), sa = Math.sin(splitAng), R = Math.hypot(w, h);
    const a = split;
    fctx.save(); fctx.translate(w / 2, h / 2); fctx.globalCompositeOperation = 'lighter';
    fctx.strokeStyle = `rgba(140,190,255,${a * .5})`; fctx.lineWidth = 26 * DPR * a; fctx.beginPath(); fctx.moveTo(-ca * R, -sa * R); fctx.lineTo(ca * R, sa * R); fctx.stroke();
    fctx.strokeStyle = `rgba(255,255,255,${a})`; fctx.lineWidth = 4 * DPR * a + 1; fctx.stroke();
    fctx.restore();
  }
  if (flash > 0) { fctx.fillStyle = `rgba(235,245,255,${flash * .85})`; fctx.fillRect(0, 0, w, h); }
  if (state === 'ready' && qi >= 1) {
    const a = .12 + .08 * Math.sin(T * 10);
    const g = fctx.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, h * .75);
    g.addColorStop(0, 'rgba(255,214,10,0)'); g.addColorStop(1, `rgba(255,200,40,${a})`);
    fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
  }
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
    else if (R > 340 && stT > .5) { capture = { R, A: Am, t: 0 }; }
  }
}
window.addEventListener('devicemotion', onMotion);
async function requestMotion() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission(); return r === 'granted';
    }
  } catch (e) { return false; }
  return typeof DeviceMotionEvent !== 'undefined';
}
// ---------- input: swipe ----------
const swipe = { down: false, x: 0, y: 0, t: 0, hist: [], fired: false, lastMove: 0 };
const sReady = $('#sReady');
sReady.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  A.unlock();
  swipe.down = true; swipe.fired = false; swipe.x = e.clientX; swipe.y = e.clientY; swipe.hist = [[e.clientX, e.clientY, performance.now()]]; swipe.lastMove = T;
});
window.addEventListener('pointermove', e => {
  if (!swipe.down || state !== 'ready') return;
  const now = performance.now();
  const last = swipe.hist[swipe.hist.length - 1];
  if (Math.hypot(e.clientX - last[0], e.clientY - last[1]) > 6) swipe.lastMove = T;
  swipe.hist.push([e.clientX, e.clientY, now]);
  while (swipe.hist.length > 2 && now - swipe.hist[0][2] > 140) swipe.hist.shift();
  if (inputMode !== 'swipe' || swipe.fired) return;
  const h0 = swipe.hist[0]; const d = Math.hypot(e.clientX - h0[0], e.clientY - h0[1]); const dtm = Math.max(16, now - h0[2]);
  if (d > Math.min(W, H) * .22) {
    const v = d / Math.min(W, H) / (dtm / 1000); // screens per second
    swipe.fired = true; fire(Math.pow(clamp((v - 1) / 9, 0, 1), .85));
  }
});
window.addEventListener('pointerup', () => { swipe.down = false; if (state === 'ready' && inputMode === 'swipe' && !swipe.fired) qi = Math.min(qi, qi * .5); });

// ---------- audio ----------
const A = (() => {
  let ac = null, master = null, nbuf = null, amb = false;
  function unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = soundOn ? .9 : 0;
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
        master.connect(comp); comp.connect(ac.destination);
        nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume();
    if (!amb) { amb = true; ambient(); }
  }
  const now = () => ac.currentTime;
  function noise(dur, type, f0, f1, q, g0, t0 = 0, pan = 0) {
    if (!ac) return; const t = now() + t0;
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + Math.min(.02, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
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
    // wind
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = ac.createGain(); g.gain.value = .05;
    const lfo = ac.createOscillator(); lfo.frequency.value = .09; const lg = ac.createGain(); lg.gain.value = .035; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(master); s.start();
    // leaves rustle layer
    const s2 = ac.createBufferSource(); s2.buffer = nbuf; s2.loop = true; const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 3200; f2.Q.value = .6;
    const g2 = ac.createGain(); g2.gain.value = .006; const l2 = ac.createOscillator(); l2.frequency.value = .21; const lg2 = ac.createGain(); lg2.gain.value = .005; l2.connect(lg2); lg2.connect(g2.gain); l2.start();
    s2.connect(f2); f2.connect(g2); g2.connect(master); s2.start(.3);
    const cricket = () => {
      if (!ac) return;
      const base = 4100 + Math.random() * 500, pan = Math.random() * 1.6 - .8, n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) { const t0 = i * .06; const t = now() + t0; const o = ac.createOscillator(); o.frequency.value = base; const gg = ac.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.exponentialRampToValueAtTime(.012, t + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + .045);
        let out = gg; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; gg.connect(p); out = p; } o.connect(gg); out.connect(master); o.start(t); o.stop(t + .06); }
      setTimeout(cricket, 400 + Math.random() * 1400);
    };
    cricket();
    const creak = () => { if (!ac) return; if (state === 'title' || state === 'ready') tone('triangle', 120 + Math.random() * 60, 90, .7, .012, 0, .2); setTimeout(creak, 4000 + Math.random() * 6000); };
    setTimeout(creak, 3000);
  }
  return {
    unlock,
    setOn(v) { if (master) master.gain.value = v ? .9 : 0; },
    ring() { if (!ac) return; [1760, 2637, 3951, 5274].forEach((f, i) => tone('sine', f, f * .998, 1.6 - i * .25, .06 / (i + 1))); },
    sheath() { noise(.28, 'bandpass', 1800, 7000, 2.5, .5); [3100, 4700, 6900].forEach((f, i) => tone('sine', f, f, .5, .05 / (i + 1), .05)); },
    whoosh(p) { noise(.45, 'bandpass', 300, 2600 + p * 2000, 1.2, .7); noise(.6, 'lowpass', 900, 120, .7, .5, .05); tone('sine', 90, 40, .5, .5, .03); },
    cut(i) {
      if (!ac) return; const f = 650 + ((i * 137) % 500);
      noise(.06, 'highpass', 4500, 6500, .7, .35, 0, .2);
      noise(.16, 'bandpass', f, f * .92, 14, .9);
      tone('triangle', f * 1.02, f * .7, .09, .12);
    },
    thud() { if (!ac) return; tone('sine', 85, 38, .3, .2); noise(.5, 'bandpass', 2400, 1400, .8, .07); },
    nick() { [2300, 3460].forEach((f, i) => tone('sine', f, f, .7, .08 / (i + 1))); noise(.08, 'highpass', 5000, 6000, 1, .3); },
    taiko(g = 1) { tone('sine', 110, 46, .55, .6 * g); noise(.15, 'lowpass', 1200, 200, .8, .45 * g); },
    final() { tone('sine', 70, 30, 1.4, .5); noise(1.2, 'bandpass', 5000, 900, 2, .2); [1318, 1975, 2637].forEach((f, i) => tone('sine', f, f, 2.2, .05 / (i + 1), .1)); },
    result(r) { this.taiko(1); setTimeout(() => this.taiko(.8), 180); if (r >= 5) [1046, 1568, 2093, 3136].forEach((f, i) => tone('sine', f, f, 2.4, .05, .35 + i * .07)); }
  };
})();
function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ---------- UI ----------
const L = () => I18N[lang];
function applyLang() {
  document.documentElement.lang = lang;
  const t = L();
  for (const el of document.querySelectorAll('[data-t]')) { const v = t[el.dataset.t]; if (typeof v === 'string') el.textContent = v; }
  $('.logo .la').textContent = t.name[0]; $('.logo .lb').textContent = t.name[1];
  $('#howList').innerHTML = t.how.map(s => `<li>${s}</li>`).join('');
  $('#cUnit').textContent = t.unit;
  $('#qiLabel').textContent = t.qi; $('#drawCall').textContent = t.draw;
  $('#bSound').textContent = soundOn ? t.on : t.off;
  $('#langList').innerHTML = Object.keys(LANG_NAMES).map(k => `<button data-l="${k}" class="${k === lang ? 'on' : ''}">${LANG_NAMES[k]}</button>`).join('');
  $('#bestNum').textContent = best;
  updShareLink(); updReadyUI(); fitLogo(); if (typeof preloadFonts === 'function') try { preloadFonts(); } catch (e) {}
}
function fitLogo() {
  const el = $('.logo'); if (!el) return;
  el.style.fontSize = '100px';
  const w = el.scrollWidth || 1;
  el.style.fontSize = Math.min(120, 100 * (W * .8) / w) + 'px';
}
function updReadyUI() {
  if (state !== 'ready') return;
  $('#readyHint').textContent = inputMode === 'swipe' ? L().swipeHold : L().hold;
  $('#qiFill').style.width = (qi * 100).toFixed(1) + '%';
  $('#qiWrap').classList.toggle('full', qi >= 1);
}
let cutinTO = 0;
function cutin(main, sub) { const c = $('#cutin'); c.innerHTML = main + (sub ? `<small>${sub}</small>` : ''); c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); clearTimeout(cutinTO); cutinTO = setTimeout(() => c.classList.remove('go'), 950); }
let toastTO = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastTO); toastTO = setTimeout(() => t.classList.remove('on'), 3200); }
let lastResult = null;
function showResult() {
  const r = rankOf(cutCount); const t = L();
  const nb = cutCount > best;
  if (nb) { best = cutCount; try { localStorage.setItem('iai_best', best); } catch (e) {} }
  lastResult = { n: cutCount, r, perfect };
  $('#rRank').textContent = RANKS[r]; $('#rRank').classList.remove('pop'); void $('#rRank').offsetWidth; $('#rRank').classList.add('pop');
  $('#rTitle').textContent = t.titles[r];
  $('#rNum').textContent = cutCount;
  const rb = $('#rBest'); rb.textContent = nb ? t.newBest : `${t.best} ${best}`; rb.classList.toggle('nb', nb);
  $('#bestNum').textContent = best;
  setScreen('sResult');
  A.result(r);
  updShareLink();
  shareImg = null; makeShareImage().then(b => shareImg = b);
}

// ---------- share ----------
let shareImg = null;
async function makeShareImage(generic) {
  try { await document.fonts.ready; } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const scn = renderLandscape(400, 210, generic ? () => lookAt(-2.1, 1.25, -2.4, .9, 2.4, 14) : null);
  x.filter = 'brightness(1.3) saturate(1.1)'; x.drawImage(scn, 0, 0, 1200, 630); x.filter = 'none';
  let g = x.createLinearGradient(0, 0, 1200, 0); g.addColorStop(0, 'rgba(14,26,43,.85)'); g.addColorStop(.5, 'rgba(14,26,43,.4)'); g.addColorStop(1, 'rgba(14,26,43,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
  const t = generic ? I18N.ja : L(), r = lastResult;
  x.save(); x.transform(1, 0, -0.12, 1, 0, 0);
  x.textBaseline = 'alphabetic'; x.shadowColor = '#0e1a2b'; x.shadowBlur = 24;
  x.font = '400 92px "Dela Gothic One"'; const wa = x.measureText(t.name[0]).width;
  x.fillStyle = '#fff'; x.fillText(t.name[0], 96, 150); x.fillStyle = '#ffd60a'; x.fillText(t.name[1], 96 + wa + 8, 150);
  x.shadowBlur = 10; x.font = '500 18px Oswald'; x.fillStyle = '#d6dfec'; x.fillText(t.sub.replace(/ /g, ' '), 100, 186);
  if (generic) { x.shadowBlur = 20; x.font = '900 40px "Zen Kaku Gothic New",sans-serif'; x.fillStyle = '#fff'; x.fillText('スマホを振り抜け。', 104, 330); x.fillText('一太刀で、竹を何本斬れるか。', 104, 390); x.restore(); x.font = '500 20px Oswald'; x.fillStyle = 'rgba(214,223,236,.85)'; x.textAlign = 'right'; x.fillText('uimemocho.github.io/apps/iai-giri', 1170, 606); x.fillStyle = '#ffd60a'; x.fillRect(0, 622, 1200, 8); return new Promise(res => c.toBlob(b => res(b), 'image/png')); }
  x.shadowBlur = 24; x.font = '700 190px Oswald'; x.fillStyle = '#fff'; const nTxt = String(r.n); x.fillText(nTxt, 120, 408);
  const nw = x.measureText(nTxt).width; x.font = '400 46px "Dela Gothic One"'; x.fillStyle = '#ffd60a'; x.fillText(t.unit, 132 + nw, 404);
  x.font = '700 120px Oswald'; x.fillStyle = '#ffd60a'; x.fillText(RANKS[r.r], 150, 548);
  const rw = x.measureText(RANKS[r.r]).width;
  x.font = '900 40px "Zen Kaku Gothic New","Dela Gothic One",sans-serif'; x.fillStyle = '#fff';
  let tt = t.titles[r.r]; let fs = 40; while (x.measureText(tt).width > 1200 - 210 - rw - 80 && fs > 18) { fs -= 2; x.font = `900 ${fs}px "Zen Kaku Gothic New","Dela Gothic One",sans-serif`; }
  x.fillText(tt, 180 + rw, 530);
  x.restore();
  x.font = '500 20px Oswald'; x.fillStyle = 'rgba(214,223,236,.85)'; x.textAlign = 'right'; x.fillText('uimemocho.github.io/apps/iai-giri', 1170, 606);
  x.fillStyle = '#ffd60a'; x.fillRect(0, 622, 1200, 8);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
function shareIntentURL() {
  const r = lastResult; if (!r) return 'https://twitter.com/intent/tweet';
  const t = L(); const text = t.shareText(r.n, RANKS[r.r], t.titles[r.r]);
  return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(URL_GAME);
}
function updShareLink() { const a = $('#bShare'); if (a) a.href = shareIntentURL(); }
const inFrame = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
function onShareClick(e) {
  const r = lastResult; if (!r) { e.preventDefault(); return; }
  updShareLink();
  // 画像つき共有（スマホ）。awaitを挟まずにクリック直後に呼ぶ
  if (!inFrame && shareImg && navigator.canShare) {
    const t = L(); const text = t.shareText(r.n, RANKS[r.r], t.titles[r.r]);
    let file = null; try { file = new File([shareImg], 'iai-giri.png', { type: 'image/png' }); } catch (err) {}
    if (file && navigator.canShare({ files: [file] })) {
      e.preventDefault();
      navigator.share({ files: [file], text: text + '\n' + URL_GAME }).catch(err => {
        if (err && err.name === 'AbortError') return;
        location.href = shareIntentURL();
      });
      return;
    }
  }
  // それ以外はリンクとしてそのままXの投稿画面を開く
}
async function doSave() {
  if (!shareImg) shareImg = await makeShareImage();
  const a = document.createElement('a'); a.href = URL.createObjectURL(shareImg); a.download = `iai-giri_${lastResult ? lastResult.n : 0}.png`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- buttons ----------
let warned = false; try { warned = localStorage.getItem('iai_warn') === '1'; } catch (e) {}
async function startReady() {
  A.unlock();
  const ok = await requestMotion();
  inputMode = ok ? 'motion' : 'swipe';
  motion.count = 0;
  go('ready');
  if (!ok) toast(L().motionOff);
}
$('#bStart').onclick = () => { A.unlock(); if (!warned) { $('#mWarn').classList.add('on'); return; } startReady(); };
$('#bWarnOk').onclick = () => { warned = true; try { localStorage.setItem('iai_warn', '1'); } catch (e) {} $('#mWarn').classList.remove('on'); startReady(); };
$('#bHow').onclick = () => $('#mHow').classList.add('on');
$('#bSet').onclick = () => $('#mSet').classList.add('on');
for (const m of document.querySelectorAll('.modal')) m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) { if (m.id !== 'mWarn') m.classList.remove('on'); } });
$('#bSound').onclick = () => { soundOn = !soundOn; try { localStorage.setItem('iai_snd', soundOn ? '1' : '0'); } catch (e) {} A.setOn(soundOn); applyLang(); };
$('#langList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; lang = b.dataset.l; try { localStorage.setItem('iai_lang', lang); } catch (e) {} applyLang(); });
$('#bRetry').onclick = () => startReady();
$('#bBack').onclick = () => go('title');
$('#bBackR').onclick = () => go('title');
$('#bShare').addEventListener('click', onShareClick);
$('#bSave').onclick = () => doSave();
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}
// debug hook (testing only)
window.__iai = { fire: p => { qi = 1; qiFullAt = T; fire(p); }, go, get state() { return state; }, get cut() { return cutCount; }, skip: t => { for (let i = 0; i < t * 60; i++) { update(1 / 60); } render(); }, setQi: v => { qi = v; if (v >= 1) qiFullAt = T; }, ogp: async (g = true) => { const b = await makeShareImage(g); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } };

buildWorld();
resize(); addEventListener('resize', resize);
applyLang();
function preloadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const t = L(); const all = '斬一閃疾風迅雷烈火無双神速全斬0123456789CUTS' + t.titles.join('') + t.newBest + t.best + t.unit + t.draw + t.qi + t.motionOff + t.swipeHold + t.hold + t.rank + t.share + t.retry + t.save + t.back + t.name.join('');
  document.fonts.load('400 40px "Dela Gothic One"', all).catch(() => {});
  document.fonts.load('900 40px "Zen Kaku Gothic New"', all).catch(() => {});
  document.fonts.load('700 40px Oswald', all).catch(() => {}); document.fonts.load('500 40px Oswald', all).catch(() => {});
}
preloadFonts();
if (document.fonts) document.fonts.ready.then(fitLogo);
camForState(1); camUpdate();
requestAnimationFrame(loop);
})();
