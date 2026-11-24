// 連続斬り — sprite-stack pixel pseudo-3D (Canvas 2D) / sequel to 居合斬り
(() => {
'use strict';
const $ = s => document.querySelector(s);
const view = $('#view'), vctx = view.getContext('2d');
const fx = $('#fx'), fctx = fx.getContext('2d');
const low = document.createElement('canvas'), ctx = low.getContext('2d');
const app = $('#app');
const URL_GAME = 'https://uimemocho.github.io/apps/renzoku-giri/';
const TIME_LIMIT = 5;
const N_STANDS = 1;
const SLICE = .026;
const MAT_BASE = .62, MAT_TOP = 1.82, MAT_R = .082;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIO = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// ---------- RNG ----------
let seed = 20261124;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

// ---------- sizing ----------
let W = 0, H = 0, DPR = 1, S = 3, LW = 200, LH = 400, HW = 100, HH = 200, F = 300;
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  view.width = fx.width = Math.round(W * DPR); view.height = fx.height = Math.round(H * DPR);
  S = Math.max(2, Math.round(Math.min(W, H * .62) * DPR / 210));
  LW = Math.ceil(view.width / S); LH = Math.ceil(view.height / S);
  low.width = LW; low.height = LH; HW = LW / 2; HH = LH / 2;
  ctx.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;
  fitLogo();
}

// ---------- color utils ----------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const FOG = hex('#7a4a62');
const NFOG = 8;
const fogT = b => Math.min(.8, b / (NFOG - 1) * .8);
function fogBucket(z) { return clamp(((z - 4) / 34 * NFOG) | 0, 0, NFOG - 1); }

// ---------- textures (backlit sunset: warm rim on both edges) ----------
function stripTex(pal, fb, rimL = .55, rimR = .9) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 1;
  const g = c.getContext('2d'); const ft = fogT(fb);
  const [dark, mid, light, rim, out] = pal.map(hex);
  for (let x = 0; x < 16; x++) {
    const n = x / 15 * 2 - 1;
    let l = clamp(1 - Math.abs(n + .25) * 1.25, 0, 1);
    l = Math.round(l * 3) / 3;
    let col = l < .5 ? mixc(dark, mid, l * 2) : mixc(mid, light, (l - .5) * 2);
    if (x === 1) col = mixc(col, rim, rimL);
    if (x === 13) col = mixc(col, rim, rimR * .55);
    if (x === 14) col = mixc(dark, rim, rimR);
    if (x === 0 || x === 15) col = out;
    g.fillStyle = css(mixc(col, FOG, ft)); g.fillRect(x, 0, 1, 1);
  }
  return c;
}
const PALS = {
  matA: ['#24220f', '#4a4622', '#77723a', '#ffb45a', '#0b0a04'],
  matB: ['#1e1c0c', '#3e3b1c', '#666232', '#f0a050', '#0b0a04'],
  matC: ['#2a2512', '#55492a', '#857444', '#ffbe6a', '#0b0904'],
  matCD: ['#221e0e', '#463c22', '#6e603a', '#e8a04e', '#0b0904'],
  tie: ['#6a6458', '#a8a090', '#e2dccb', '#fff0d0', '#1c1a14'],
  post: ['#2a1a10', '#4e3220', '#7a5434', '#ffa65a', '#0c0805'],
  postD: ['#1e130b', '#3a2618', '#5a3e26', '#e08a48', '#0a0604'],
};
const TEX = {};
for (const k in PALS) { TEX[k] = []; for (let b = 0; b < NFOG; b++) TEX[k].push(stripTex(PALS[k], b)); }

function faceTex(fb) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const ft = fogT(fb);
  const rim = hex('#3a3618'), a = hex('#d9c88a'), b = hex('#a8964e'), d = hex('#6e6230'), core = hex('#4a4020');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy); if (r > 8) continue;
    const ang = Math.atan2(dy, dx);
    const sp = (r + ang / (Math.PI * 2) * 1.6) % 1.6; // rolled-mat spiral
    let col = r > 7.1 ? rim : r < 1.4 ? core : sp < .55 ? d : (y < 7 ? a : b);
    g.fillStyle = css(mixc(col, FOG, ft)); g.fillRect(x, y, 1, 1);
  }
  return c;
}
const FACE = []; for (let b = 0; b < NFOG; b++) FACE.push(faceTex(b));

// ---------- sprite stacks ----------
function makeStack(n, size, paint) {
  const L = [];
  for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(i, g, size); L.push(c); }
  return L;
}
function sqr(g, s, w, col, col2) { const o = (s - w) / 2 | 0; g.fillStyle = col; g.fillRect(o, o, w, w); if (col2) { g.fillStyle = col2; g.fillRect(o, o, w, 1); g.fillRect(o + w - 1, o, 1, w); } }
function circ(g, s, r, col, col2) { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const d = Math.hypot(x - s / 2 + .5, y - s / 2 + .5); if (d <= r) { g.fillStyle = (col2 && d > r - 1 && (x - y) > 0) ? col2 : col; g.fillRect(x, y, 1, 1); } } }
const LANTERN = makeStack(26, 18, (i, g, s) => {
  const st = '#4a4248', hi = '#c08060', dk = '#2a2428';
  if (i < 3) sqr(g, s, 14 - i, i === 2 ? hi : st, hi);
  else if (i < 10) circ(g, s, 2.6, st, hi);
  else if (i < 12) sqr(g, s, 13, i === 11 ? hi : st, hi);
  else if (i < 18) { sqr(g, s, 11, dk); const o = (s - 11) / 2 | 0; g.fillStyle = '#ffb85a'; g.fillRect(o + 2, o + 2, 7, 7); g.fillStyle = '#fff0c0'; g.fillRect(o + 4, o + 4, 3, 3); g.fillStyle = st; g.fillRect(o, o, 11, 1); g.fillRect(o, o + 10, 11, 1); g.fillRect(o, o, 1, 11); g.fillRect(o + 10, o, 1, 11); if (i === 12 || i === 17) sqr(g, s, 11, st, hi); }
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
      if (d <= rad) { const moss = i > n * .6 && Math.sin(x * 1.7 + y * 2.3 + ph[2]) > .3; g.fillStyle = moss ? '#2e3a22' : (d > rad - 1 && a < -.3 && a > -2.2) ? '#b07a5e' : (i % 2 ? '#3e383e' : '#38333a'); g.fillRect(x, y, 1, 1); }
    }
  });
});
// cloud-pruned pine (niwaki)
function pineStack(v) {
  const save = seed; seed = 900 + v * 37;
  const n = 46, s = 40;
  const pads = [];
  const np = 4 + (rnd() * 2 | 0);
  for (let i = 0; i < np; i++) { const t = i / (np - 1); pads.push({ m: lerp(17, 41, t) + rr(-2, 2), h: rr(3.4, 5), cx: (i % 2 ? 1 : -1) * rr(2, 8) * (1 - t * .6), cy: rr(-4, 4), r: lerp(15, 8, t) + rr(-1, 2) }); }
  const drift = [rr(-.12, .12), rr(-.08, .08)];
  const noise = []; for (let i = 0; i < 64; i++) noise.push(rnd());
  seed = save;
  return makeStack(n, s, (i, g) => {
    const tx = s / 2 + drift[0] * i, ty = s / 2 + drift[1] * i;
    if (i < 40) { const tr = i < 3 ? 2.6 : 1.7; for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const d = Math.hypot(x - tx, y - ty); if (d <= tr) { g.fillStyle = (x - tx) > .5 ? '#7a4a34' : '#3a2418'; g.fillRect(x, y, 1, 1); } } }
    for (const p of pads) {
      const k = (i - p.m) / p.h; if (Math.abs(k) > 1) continue;
      const rad = p.r * Math.sqrt(1 - k * k);
      const cx = tx + p.cx, cy = ty + p.cy;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const a = Math.atan2(y - cy, x - cx); const nn = noise[((a + 3.2) * 10 | 0) % 64];
        const d = Math.hypot(x - cx, y - cy); if (d > rad * (.86 + nn * .2)) continue;
        const edge = d > rad * .72;
        let col = (x * 7 + y * 13 + i * 3) % 5 === 0 ? '#22301c' : '#1a2616';
        if (k > .45) col = edge ? '#7a6a3a' : '#2c3a22';
        if (edge && (x - cx) > 0 && k > -.2) col = '#c8783e';
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
      }
    }
  });
}
const PINES = [0, 1, 2, 3].map(pineStack);
// distant silhouette tree (sky)
// ---------- world ----------
let stands = [], pieces = [], props = [], groundDots = [], clouds = [], ridges = [], crows = [], motes = [];
function buildWorld() {
  seed = 20261124;
  stands = []; props = []; groundDots = []; clouds = []; ridges = []; crows = []; motes = [];
  for (let i = 0; i < N_STANDS; i++) {
    stands.push({ i, x: i * 1.55, z: 4 + rr(-.15, .15), pal: ['matA', 'matB', 'matC'][rnd() * 3 | 0], top: MAT_TOP, cuts: 0, ties: [.86, 1.28, 1.66].map(v => v + rr(-.04, .04)), ph: rr(0, 6), lean: rr(-.012, .012) });
  }
  for (let i = -4; i < N_STANDS + 4; i++) {
    if (i !== 0 && i % 2 === 0) props.push({ x: i * 1.55 + .77, z: 7.3 + rr(-.3, .3), kind: 'lantern', yaw: rr(-.4, .4), sc: rr(.85, 1) });
    if (i % 3 === 0) props.push({ x: i * 1.55 + rr(-.6, .6), z: rr(11, 14), kind: 'pine', v: rnd() * 4 | 0, yaw: rr(0, 6.28), sc: rr(.75, 1.05) });
    if (rnd() < .6) props.push({ x: i * 1.55 + rr(-.8, .8), z: rr(5.6, 9), kind: 'rock', v: rnd() * 3 | 0, yaw: rr(0, 6.28), sc: rr(.5, 1.2) });
  }
  for (let i = 0; i < 12; i++) props.push({ x: rr(-16, 18), z: rr(18.5, 24), kind: 'pine', v: rnd() * 4 | 0, yaw: rr(0, 6.28), sc: rr(1.4, 2.1) });
  // wall segments + dojo
  for (let x = -16; x < 64; x += 4) if (x + 4 <= -8 || x >= 12) props.push({ kind: 'wall', x0: x, x1: x + 4, z: 16, x: x + 2 });
  props.push({ kind: 'dojo', x0: -8, x1: 12, z0: 15.5, z1: 21, x: 2, z: 15.5 });
  for (let i = 0; i < 1500; i++) {
    const zz = rr(-6, 16), x = rr(-14, 62);
    const grav = zz > 3.1 && zz < 5.1;
    const c = grav ? ['#5a4a50', '#6e5a5c', '#4a3c44', '#8a6a5e'][rnd() * 4 | 0] : ['#1e2616', '#26301a', '#2e381e', '#3a3a20', '#4a3a28'][rnd() * 5 | 0];
    groundDots.push([x, zz, c, rnd() < .18 ? 2 : 1]);
  }
  for (let i = 0; i < 26; i++) clouds.push({ a: rr(-1.4, 1.4), e: rr(.05, .55), w: rr(.12, .5), h: rr(.006, .02), s: rr(.002, .006) });
  for (let l = 0; l < 3; l++) { const pts = []; const ph = rr(0, 9); for (let i = 0; i <= 90; i++) { const a = -Math.PI + i / 90 * Math.PI * 2; pts.push(.03 + l * -.008 + (Math.sin(a * 3 + ph) * .5 + Math.sin(a * 7.3 + ph * 2) * .3 + Math.sin(a * 17 + ph) * .12 + .9) * (.05 - l * .012)); } ridges.push(pts); }
  for (let i = 0; i < 40; i++) motes.push({ x: rr(-3, 3), y: rr(.3, 2.4), z: rr(1, 9), p: rr(0, 6.28), s: rr(.4, 1) });
}
function resetStands() {
  for (const s of stands) { s.top = MAT_TOP; s.cuts = 0; }
  pieces = []; parts = []; slashes = [];
}

// ---------- camera ----------
const cam = { x: 0, y: 1.5, z: -1, yaw: 0, pitch: 0, fov: 1.05, roll: 0 };
let cY = 1, sY = 0, cP = 1, sP = 0;
function camUpdate() { cY = Math.cos(cam.yaw); sY = Math.sin(cam.yaw); cP = Math.cos(cam.pitch); sP = Math.sin(cam.pitch); F = HH / Math.tan(cam.fov / 2) * Math.min(1, (LW / LH) / .5 * .82 + .18); }
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
const NEAR = .1;
function proj(x, y, z, o) { toCam(x, y, z, o); if (o[2] < NEAR) return false; o[3] = HW + F * o[0] / o[2]; o[4] = HH - F * o[1] / o[2]; return true; }

// ---------- drawing primitives ----------
const tA = [0, 0, 0, 0, 0], tB = [0, 0, 0, 0, 0];
function drawSeg(ax, ay, az, bx, by, bz, r, tex) {
  if (az < NEAR && bz < NEAR) return;
  if (az < NEAR) { const t = (NEAR - az) / (bz - az); ax += (bx - ax) * t; ay += (by - ay) * t; az = NEAR; }
  else if (bz < NEAR) { const t = (NEAR - bz) / (az - bz); bx += (ax - bx) * t; by += (ay - by) * t; bz = NEAR; }
  const pax = HW + F * ax / az, pay = HH - F * ay / az, pbx = HW + F * bx / bz, pby = HH - F * by / bz;
  const w = Math.max(1, r * F * (1 / az + 1 / bz));
  if ((pax < -w && pbx < -w) || (pax > LW + w && pbx > LW + w) || (pay < -w && pby < -w) || (pay > LH + w && pby > LH + w)) return;
  let dx = pbx - pax, dy = pby - pay; let len = Math.hypot(dx, dy);
  if (len < 1e-4) { dx = 0; dy = -1; len = 1; } else { dx /= len; dy /= len; }
  const L = Math.max(len, 1);
  const px = -dy, py = dx;
  ctx.setTransform(px * w, py * w, dx * L, dy * L, pax - px * w / 2, pay - py * w / 2);
  ctx.drawImage(tex, 0, 0, 1, 1);
}
function drawFace(cx, cy, cz, ux, uy, uz, r, fb, sign) {
  if (cz < NEAR) return;
  const il = 1 / Math.hypot(cx, cy, cz);
  const facing = -(ux * cx + uy * cy + uz * cz) * il * sign;
  if (facing <= .02) return;
  const sx = HW + F * cx / cz, sy = HH - F * cy / cz;
  const w = r * 2.1 * F / cz;
  const ex = cx + ux * .1, ey = cy + uy * .1, ez = Math.max(NEAR, cz + uz * .1);
  let dx = HW + F * ex / ez - sx, dy = HH - F * ey / ez - sy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const k = Math.max(.2, facing);
  const px = -dy, py = dx;
  ctx.setTransform(px * w, py * w, dx * w * k, dy * w * k, sx - (px * w + dx * w * k) / 2, sy - (py * w + dy * w * k) / 2);
  ctx.drawImage(FACE[fb], 0, 0, 1, 1);
}
function rotMat(kx, kz, th) {
  const l = Math.hypot(kx, kz) || 1; kx /= l; kz /= l;
  const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  return [t * kx * kx + c, -s * kz, t * kx * kz,
          s * kz, c, -s * kx,
          t * kx * kz, s * kx, t * kz * kz + c];
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mv = (m, x, y, z, o) => { o[0] = m[0] * x + m[1] * y + m[2] * z; o[1] = m[3] * x + m[4] * y + m[5] * z; o[2] = m[6] * x + m[7] * y + m[8] * z; return o; };
const Oc = [0, 0, 0], Uc = [0, 0, 0], tmp = [0, 0, 0, 0, 0], tmp2 = [0, 0, 0, 0, 0];
function poly(pts, fill) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { if (!proj(pts[i][0], pts[i][1], pts[i][2], tmp)) return false; if (i) ctx.lineTo(tmp[3], tmp[4]); else ctx.moveTo(tmp[3], tmp[4]); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); return true;
}
function line3(a, b, col, w = 1) {
  if (!proj(a[0], a[1], a[2], tA) || !proj(b[0], b[1], b[2], tB)) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tA[3], tA[4]); ctx.lineTo(tB[3], tB[4]); ctx.stroke();
}

// straw mat cylinder: world origin(o) = point at height s0 on axis, M rotation, from s0 to s1 (mat-local absolute heights)
function drawMat(st, ox, oy, oz, M, s0, s1, faces) {
  toCam(ox, oy, oz, Oc);
  mv(M, st.lean, 1, 0, tmp); toCamDir(tmp[0], tmp[1], tmp[2], Uc);
  const len = s1 - s0;
  const mz = Oc[2] + Uc[2] * len * .5;
  if (Oc[2] < NEAR && Oc[2] + Uc[2] * len < NEAR) return;
  const fb = fogBucket(Math.max(NEAR, mz));
  const tA_ = TEX[st.pal][fb], tB_ = TEX.matCD[fb], tt = TEX.tie[fb];
  const far = mz > 9;
  const step = far ? len : .045;
  let a = 0, k = Math.floor(s0 / .045);
  while (a < len - 1e-4) {
    const b = far ? len : Math.min(len, Math.max(a + .004, (Math.floor((s0 + a) / .045 + 1e-6) + 1) * .045 - s0));
    drawSeg(Oc[0] + Uc[0] * a, Oc[1] + Uc[1] * a, Oc[2] + Uc[2] * a, Oc[0] + Uc[0] * b, Oc[1] + Uc[1] * b, Oc[2] + Uc[2] * b, MAT_R, (k & 1) ? tB_ : tA_);
    a = b; k++;
  }
  for (const th of st.ties) {
    if (th - .014 < s0 || th + .014 > s1) continue;
    const q = th - s0;
    drawSeg(Oc[0] + Uc[0] * (q - .014), Oc[1] + Uc[1] * (q - .014), Oc[2] + Uc[2] * (q - .014), Oc[0] + Uc[0] * (q + .014), Oc[1] + Uc[1] * (q + .014), Oc[2] + Uc[2] * (q + .014), MAT_R * 1.06, tt);
  }
  if (faces & 1) drawFace(Oc[0] + Uc[0] * len, Oc[1] + Uc[1] * len, Oc[2] + Uc[2] * len, Uc[0], Uc[1], Uc[2], MAT_R, fb, 1);
  if (faces & 2) drawFace(Oc[0], Oc[1], Oc[2], Uc[0], Uc[1], Uc[2], MAT_R, fb, -1);
}
function drawStandBody(st) {
  const fb = fogBucket(Math.max(NEAR, toCam(st.x, 0, st.z, tmp)[2]));
  // long shadow toward camera (sun behind)
  ctx.globalAlpha = .38;
  const sl = st.top > MAT_BASE + .1 ? 3.4 : 1.6;
  poly([[st.x - .09, .002, st.z], [st.x + .09, .002, st.z], [st.x + .2, .002, st.z - sl], [st.x + .02, .002, st.z - sl]], '#1a0f1c');
  poly([[st.x - .42, .002, st.z - .05], [st.x + .42, .002, st.z - .05], [st.x + .5, .002, st.z - .6], [st.x - .3, .002, st.z - .6]], '#1a0f1c');
  ctx.globalAlpha = 1;
  // cross feet
  toCam(st.x - .42, .04, st.z, tA); toCam(st.x + .42, .04, st.z, tB);
  drawSeg(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], .045, TEX.postD[fb]);
  toCam(st.x, .04, st.z - .42, tA); toCam(st.x, .04, st.z + .42, tB);
  drawSeg(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], .045, TEX.post[fb]);
  // post
  toCam(st.x, 0, st.z, tA); toCam(st.x, MAT_BASE + .02, st.z, tB);
  drawSeg(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], .05, TEX.post[fb]);
  toCam(st.x, .07, st.z, tA); toCam(st.x, .16, st.z, tB);
  drawSeg(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], .085, TEX.postD[fb]);
}
function drawStack(p) {
  let layers, height, size;
  if (p.kind === 'lantern') { layers = LANTERN; height = 1.6 * p.sc; size = .72 * p.sc; }
  else if (p.kind === 'pine') { layers = PINES[p.v]; height = 3.0 * p.sc; size = 2.5 * p.sc; }
  else { layers = ROCKS[p.v]; height = .45 * p.sc; size = .9 * p.sc; }
  toCam(p.x, 0, p.z, Oc); if (Oc[2] < .4) return;
  toCam(p.x, height, p.z, tmp); if (tmp[2] < .4) return;
  const bx = HW + F * Oc[0] / Oc[2], by = HH - F * Oc[1] / Oc[2], tx2 = HW + F * tmp[0] / tmp[2], ty2 = HH - F * tmp[1] / tmp[2];
  const w = size * F / Oc[2]; if (bx < -w || bx > LW + w) return;
  const hpx = Math.hypot(tx2 - bx, ty2 - by);
  const steps = Math.min(220, Math.max(layers.length, Math.ceil(hpx)));
  const phi = cam.yaw - p.yaw; const k = clamp(Math.abs(Math.sin(Math.atan2(cam.y - height * .5, Math.hypot(p.x - cam.x, p.z - cam.z)))), .14, 1);
  const c = Math.cos(phi), s = Math.sin(phi);
  const fb = fogBucket(Oc[2]);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1); const L = layers[Math.min(layers.length - 1, (t * layers.length) | 0)];
    const cx = lerp(bx, tx2, t), cy = lerp(by, ty2, t);
    ctx.setTransform(c * w, s * w * k, -s * w, c * w * k, cx - (c * w - s * w) / 2, cy - (s * w * k + c * w * k) / 2);
    ctx.drawImage(L, 0, 0, 1, 1);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (p.kind === 'lantern') {
    const ly = lerp(by, ty2, .58), r = w * 2.4;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(bx, ly, 0, bx, ly, r);
    g.addColorStop(0, 'rgba(255,180,90,.5)'); g.addColorStop(.4, 'rgba(255,140,60,.14)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(bx - r, ly - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawWall(p) {
  const z = p.z, h = 1.85;
  poly([[p.x0, 0, z], [p.x1, 0, z], [p.x1, h, z], [p.x0, h, z]], '#5a3a4c');
  poly([[p.x0, 0, z], [p.x1, 0, z], [p.x1, .35, z], [p.x0, .35, z]], '#3a2634');
  for (let x = p.x0 + 1; x < p.x1; x += 2) line3([x, .35, z], [x, h, z], 'rgba(40,24,36,.55)');
  poly([[p.x0, h, z - .35], [p.x1, h, z - .35], [p.x1, h + .32, z + .1], [p.x0, h + .32, z + .1]], '#251a28');
  line3([p.x0, h + .32, z + .1], [p.x1, h + .32, z + .1], '#ff9a5a');
  line3([p.x0, h, z - .35], [p.x1, h, z - .35], '#120c16');
}
function drawDojo(p) {
  const { x0, x1, z0, z1 } = p;
  const fl = .55, wh = 2.7, eave = 3.05, ridge = 5.0, ov = 1.1;
  // side walls if visible
  if (cam.x < x0) poly([[x0, 0, z0], [x0, 0, z1], [x0, wh, z1], [x0, wh, z0]], '#2e1c1c');
  if (cam.x > x1) poly([[x1, 0, z0], [x1, 0, z1], [x1, wh, z1], [x1, wh, z0]], '#2e1c1c');
  // front wall
  poly([[x0, fl, z0 + .9], [x1, fl, z0 + .9], [x1, wh, z0 + .9], [x0, wh, z0 + .9]], '#3a2420');
  // shoji panels glowing
  for (let x = x0 + .4; x < x1 - .5; x += 1.8) {
    poly([[x, fl + .15, z0 + .89], [x + 1.4, fl + .15, z0 + .89], [x + 1.4, wh - .25, z0 + .89], [x, wh - .25, z0 + .89]], '#f2b46e');
    ctx.globalAlpha = .55; for (let k = 1; k < 4; k++) line3([x + k * .35, fl + .15, z0 + .88], [x + k * .35, wh - .25, z0 + .88], '#7a4a2e'); for (let k = 1; k < 6; k++) { const y = fl + .15 + k * (wh - .4 - fl) / 6; line3([x, y, z0 + .88], [x + 1.4, y, z0 + .88], '#7a4a2e'); } ctx.globalAlpha = 1;
  }
  // engawa floor
  poly([[x0 - .2, fl, z0], [x1 + .2, fl, z0], [x1 + .2, fl, z0 + .9], [x0 - .2, fl, z0 + .9]], '#6a3e2a');
  poly([[x0 - .2, 0, z0], [x1 + .2, 0, z0], [x1 + .2, fl, z0], [x0 - .2, fl, z0]], '#24140f');
  line3([x0 - .2, fl, z0], [x1 + .2, fl, z0], '#ffac6a');
  // pillars
  for (let x = x0; x <= x1 + .01; x += 3) { poly([[x - .1, 0, z0 + .02], [x + .1, 0, z0 + .02], [x + .1, eave, z0 + .02], [x - .1, eave, z0 + .02]], '#2a1812'); line3([x + .1, fl, z0], [x + .1, eave, z0], '#c8703e'); }
  // roof
  const zc = (z0 + z1) / 2;
  poly([[x0 - ov, eave, z0 - ov], [x1 + ov, eave, z0 - ov], [x1 - .8, ridge, zc], [x0 + .8, ridge, zc]], '#2a2230');
  if (cam.x < x0 + 2) poly([[x0 - ov, eave, z0 - ov], [x0 + .8, ridge, zc], [x0 - ov, eave, z1 + ov]], '#1e1824');
  if (cam.x > x1 - 2) poly([[x1 + ov, eave, z0 - ov], [x1 - .8, ridge, zc], [x1 + ov, eave, z1 + ov]], '#1e1824');
  ctx.globalAlpha = .5; for (let i = 1; i < 7; i++) { const t = i / 7; line3([lerp(x0 - ov, x0 + .8, t), lerp(eave, ridge, t), lerp(z0 - ov, zc, t)], [lerp(x1 + ov, x1 - .8, t), lerp(eave, ridge, t), lerp(z0 - ov, zc, t)], '#463a4c'); } ctx.globalAlpha = 1;
  line3([x0 + .8, ridge, zc], [x1 - .8, ridge, zc], '#ffb070', 2);
  line3([x0 - ov, eave, z0 - ov], [x1 + ov, eave, z0 - ov], '#120c14', 2);
  // warm spill from shoji
  proj((x0 + x1) / 2, fl + 1, z0 + .9, tmp);
  if (tmp[2] > NEAR) {
    const r = 9 * F / tmp[2];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(tmp[3], tmp[4], 0, tmp[3], tmp[4], r);
    g.addColorStop(0, 'rgba(255,150,70,.18)'); g.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = g; ctx.fillRect(tmp[3] - r, tmp[4] - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- sky / background ----------
const SUN_A = .18, SUN_E = .045;
let sunScreen = null;
function skyPt(a, e, o) { toCamDir(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e), o); if (o[2] < .03) return false; o[3] = HW + F * o[0] / o[2]; o[4] = HH - F * o[1] / o[2]; return true; }
function drawSky() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const hy = HH + F * Math.tan(cam.pitch);
  const g = ctx.createLinearGradient(0, hy - F * 1.5, 0, hy);
  g.addColorStop(0, '#191636'); g.addColorStop(.38, '#3e2754'); g.addColorStop(.62, '#8a3c5c'); g.addColorStop(.82, '#e06a48'); g.addColorStop(.94, '#ffa95e'); g.addColorStop(1, '#ffd48c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, Math.max(0, hy + 2));
  // sun
  if (skyPt(SUN_A, SUN_E, tmp)) {
    const x = tmp[3], y = tmp[4]; const ms = Math.max(10, F * .07);
    ctx.globalCompositeOperation = 'lighter';
    let hg = ctx.createRadialGradient(x, y, 0, x, y, ms * 9);
    hg.addColorStop(0, 'rgba(255,220,150,.75)'); hg.addColorStop(.12, 'rgba(255,170,90,.35)'); hg.addColorStop(.45, 'rgba(255,110,70,.12)'); hg.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.fillStyle = hg; ctx.fillRect(x - ms * 9, y - ms * 9, ms * 18, ms * 18);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff1c8'; ctx.beginPath(); ctx.arc(x | 0, y | 0, ms / 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd890'; ctx.fillRect((x - ms / 2) | 0, (y + ms * .12) | 0, ms | 0, 1); ctx.fillRect((x - ms * .45) | 0, (y + ms * .28) | 0, (ms * .9) | 0, 1);
    sunScreen = [x, y, ms];
  } else sunScreen = null;
  // clouds (lit from below)
  for (const c of clouds) {
    const a = c.a + T * c.s * .05;
    if (!skyPt(a - c.w / 2, c.e, tA) || !skyPt(a + c.w / 2, c.e, tB)) continue;
    const th = Math.max(1, c.h * F * 1.6);
    const d = Math.abs(a - SUN_A) + c.e;
    const lit = clamp(1 - d * 1.2, 0, 1);
    ctx.fillStyle = css(mixc(hex('#5a2c4e'), hex('#ffb070'), lit * .9)); ctx.fillRect(tA[3] | 0, (tA[4] - th) | 0, (tB[3] - tA[3]) | 0, th | 0);
    ctx.fillStyle = css(mixc(hex('#a04a56'), hex('#ffe0a0'), lit)); ctx.fillRect((tA[3] + 2) | 0, tA[4] | 0, Math.max(1, tB[3] - tA[3] - 4) | 0, 1);
  }
  // crows
  for (const c of crows) {
    if (!skyPt(c.a, c.e, tmp)) continue;
    const f = Math.sin(T * 10 + c.p) > 0; ctx.fillStyle = '#1a1020';
    ctx.fillRect(tmp[3] | 0, tmp[4] | 0, 1, 1); ctx.fillRect((tmp[3] - 2) | 0, (tmp[4] - (f ? 1 : 0)) | 0, 2, 1); ctx.fillRect((tmp[3] + 1) | 0, (tmp[4] - (f ? 1 : 0)) | 0, 2, 1);
  }
  // mountains
  const mc = ['#6a3456', '#4e2848', '#371e3a'];
  for (let l = 0; l < 3; l++) {
    ctx.fillStyle = mc[l]; ctx.beginPath(); let first = true, lastX = 0;
    const pts = ridges[l];
    for (let i = 0; i < pts.length; i++) {
      const a = -Math.PI + i / (pts.length - 1) * Math.PI * 2 + l * .3;
      toCamDir(Math.sin(a), pts[i], Math.cos(a), tmp); if (tmp[2] < .05) { if (!first) ctx.lineTo(lastX, hy + 2); first = true; continue; }
      const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2];
      if (first) { ctx.moveTo(x, hy + 2); ctx.lineTo(x, y); first = false; } else ctx.lineTo(x, y);
      lastX = x;
    }
    if (!first) ctx.lineTo(lastX, hy + 2);
    ctx.fill();
  }
  // haze band
  const mg = ctx.createLinearGradient(0, hy - F * .2, 0, hy + F * .04);
  mg.addColorStop(0, 'rgba(255,150,100,0)'); mg.addColorStop(.85, 'rgba(240,130,100,.35)'); mg.addColorStop(1, 'rgba(160,80,90,.25)');
  ctx.fillStyle = mg; ctx.fillRect(0, hy - F * .2, LW, F * .26);
  // ground
  const gg = ctx.createLinearGradient(0, hy, 0, LH);
  gg.addColorStop(0, '#8a5050'); gg.addColorStop(.05, '#4e3a32'); gg.addColorStop(.3, '#2e2c1e'); gg.addColorStop(1, '#17170d');
  ctx.fillStyle = gg; ctx.fillRect(0, Math.max(0, hy), LW, LH - hy + 1);
  // gravel band
  ctx.globalAlpha = .5; { const a = cam.x - 5, b = cam.x + 12; poly([[a, .001, 3.1], [b, .001, 3.1], [b, .001, 5.1], [a, .001, 5.1]], '#3e3034'); }; ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const d of groundDots) {
    toCam(d[0], 0, d[1], tmp); if (tmp[2] < .3 || tmp[2] > 40) continue;
    const x = HW + F * tmp[0] / tmp[2]; if (x < 0 || x > LW) continue;
    const y = HH - F * tmp[1] / tmp[2]; if (y > LH) continue;
    const sz = tmp[2] < 5 ? d[3] + (tmp[2] < 2.5 ? 1 : 0) : 1;
    ctx.fillStyle = d[2]; ctx.fillRect(x | 0, y | 0, sz, 1);
  }
}

// ---------- particles ----------
let parts = [], slashes = [];
function addP(p) { if (parts.length < 700) parts.push(p); }
function strawBurst(x, y, z, sd, n) {
  for (let i = 0; i < n; i++) addP({ x, y, z, vx: sd * rr(.5, 3) + rr(-.6, .6), vy: rr(-.3, 2.2), vz: rr(-1.4, 1), life: rr(.6, 1.4), t: 0, k: 'straw', c: ['#e8d290', '#b8a258', '#8a7a3e', '#ffcf80'][rnd() * 4 | 0], p: rr(0, 6) });
  for (let i = 0; i < 6; i++) addP({ x, y, z, vx: sd * rr(1, 5), vy: rr(-1.5, 2.5), vz: rr(-2, 2), life: rr(.1, .28), t: 0, k: 'spark', c: rnd() < .5 ? '#ffe2a0' : '#ffffff' });
}
function dust(x, z, n) { for (let i = 0; i < n; i++) addP({ x: x + rr(-.3, .3), y: .05, z: z + rr(-.3, .3), vx: rr(-.6, .6), vy: rr(.2, .7), vz: rr(-.6, .6), life: rr(.6, 1.2), t: 0, k: 'dust', c: '#8a6a6a' }); }
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
    if (p.k === 'straw') { p.vy -= 4 * dt; p.vx *= .97; p.vz *= .97; p.vx += Math.sin(T * 5 + p.p) * dt * .8; }
    else if (p.k === 'dust') { p.vx *= .94; p.vy *= .94; p.vz *= .94; }
    else p.vy -= 3 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0) { p.y = 0; p.vy *= -.2; p.vx *= .5; p.vz *= .5; }
  }
}
function drawParts() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of parts) {
    toCam(p.x, p.y, p.z, tmp); if (tmp[2] < .15) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2]; if (x < -4 || x > LW + 4 || y < -4 || y > LH + 4) continue;
    const a = 1 - p.t / p.life;
    if (p.k === 'spark') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.c; const s = Math.max(1, Math.min(3, .03 * F / tmp[2])); ctx.fillRect(x, y, s, s); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'dust') { ctx.globalAlpha = a * .3; ctx.fillStyle = p.c; const s = Math.max(1, (.12 + p.t * .3) * F / tmp[2]); ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    else { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c; const s = Math.max(1, Math.min(4, .035 * F / tmp[2])); const hz = Math.sin(T * 12 + p.p) > 0; ctx.fillRect(x, y, hz ? s * 2 : s, hz ? s : s * 2); }
  }
  ctx.globalAlpha = 1;
  // dust motes in the low sun
  ctx.globalCompositeOperation = 'lighter';
  for (const f of motes) {
    const mx = cam.x + f.x + Math.sin(T * .3 * f.s + f.p) * .6, my = f.y + Math.sin(T * .5 + f.p * 2) * .2, mz = cam.z + f.z;
    toCam(mx, my, mz, tmp); if (tmp[2] < .3) continue;
    const x = HW + F * tmp[0] / tmp[2], y = HH - F * tmp[1] / tmp[2];
    const a = (.35 + .65 * Math.max(0, Math.sin(T * 1.2 * f.s + f.p))) * .5;
    ctx.fillStyle = `rgba(255,200,130,${a})`; ctx.fillRect(x | 0, y | 0, 1, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawSlashes() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  for (const s of slashes) {
    const a = 1 - s.t / s.life; if (a <= 0) continue;
    const L = s.hold ? .14 : .3 + (1 - a) * .6;
    if (!proj(s.x - L, s.y + L * .42 * s.sd, s.z - .03, tA)) continue; const ax = tA[3], ay = tA[4];
    if (!proj(s.x + L, s.y - L * .42 * s.sd, s.z - .03, tB)) continue;
    if (!s.hold) { ctx.strokeStyle = `rgba(255,170,90,${a * .4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tB[3], tB[4]); ctx.stroke(); }
    ctx.strokeStyle = `rgba(255,250,230,${s.hold ? .55 + .45 * a : a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tB[3], tB[4]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].t > slashes[i].life) slashes.splice(i, 1);
}

// ---------- katana (screen-space pixel art, mirrored per side) ----------
function drawKatana() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = LW / 200;
  const side = kata.side; // 1: right hand position, -1: left (mirrored)
  const breathe = Math.sin(T * 1.6) * 1.2 * u;
  const restA = -2.02, endA = .7;
  let hx = LW * .99, hy = LH * 1.04 + breathe + (1 - ease(kata.in)) * 70 * u;
  let ang = restA, smear = -1;
  const sheathed = kata.sheathed;
  if (kata.swing >= 0) {
    const t = kata.swing;
    ang = lerp(restA, endA, easeIO(t)); hx -= Math.sin(t * Math.PI) * 26 * u; hy -= Math.sin(t * Math.PI) * 26 * u;
    smear = t;
  }
  if (sheathed) { ang = -2.62; hx = LW * .8; hy = LH * .99 + breathe + (1 - ease(kata.in)) * 70 * u; }
  const base = side < 0 ? [-1, 0, 0, 1, LW, 0] : [1, 0, 0, 1, 0, 0];
  const c = Math.cos(ang), s = Math.sin(ang);
  // compose base * translate(hx,hy) * rotate(ang)
  const m = [base[0] * c + base[2] * s, base[1] * c + base[3] * s, base[0] * -s + base[2] * c, base[1] * -s + base[3] * c, base[0] * hx + base[2] * hy + base[4], base[1] * hx + base[3] * hy + base[5]];
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4] | 0, m[5] | 0);
  const tsukaL = 46 * u, tw = 9 * u;
  ctx.fillStyle = '#0c0a0c'; ctx.fillRect(-6 * u, -tw / 2, tsukaL + 6 * u, tw);
  ctx.fillStyle = '#e4d6c4';
  for (let x = -2 * u; x < tsukaL - 4 * u; x += 7 * u) { ctx.beginPath(); ctx.moveTo(x, -tw / 2); ctx.lineTo(x + 3.5 * u, 0); ctx.lineTo(x, tw / 2); ctx.lineTo(x + 2 * u, tw / 2); ctx.lineTo(x + 5.5 * u, 0); ctx.lineTo(x + 2 * u, -tw / 2); ctx.fill(); }
  ctx.fillStyle = '#b8902e'; ctx.fillRect(-7 * u, -tw / 2 - 1, 3 * u, tw + 2); ctx.fillRect(tsukaL - 4 * u, -tw / 2 - 1, 4 * u, tw + 2);
  ctx.fillStyle = '#5a4018'; ctx.fillRect(tsukaL, -tw * 1.25, 3 * u, tw * 2.5);
  ctx.fillStyle = '#ffc070'; ctx.fillRect(tsukaL, -tw * 1.25, 1 * u, tw * 2.5);
  ctx.fillStyle = '#c79a32'; ctx.fillRect(tsukaL + 3 * u, -tw / 2 + 1, 3 * u, tw - 2);
  const bx = tsukaL + 6 * u;
  if (sheathed) {
    const sl = 150 * u, sw = 8 * u;
    ctx.fillStyle = '#07070b'; ctx.fillRect(bx, -sw / 2, sl, sw);
    ctx.fillStyle = '#3a2430'; ctx.fillRect(bx, -sw / 2 + 1, sl, Math.max(1, u));
    ctx.fillStyle = '#c86a4a'; ctx.fillRect(bx + 8 * u, -sw / 2 + 1, sl * .5, 1);
    ctx.fillStyle = '#c79a32'; ctx.fillRect(bx, -sw / 2, 3 * u, sw);
    ctx.fillStyle = '#5a1420'; ctx.fillRect(bx + 18 * u, -sw / 2 - 1, 5 * u, sw + 2);
    ctx.fillStyle = '#8a2a36'; ctx.fillRect(bx + 18 * u, sw / 2, 2 * u, 14 * u);
  } else {
    const bl = 150 * u;
    ctx.fillStyle = '#8c8a98'; ctx.beginPath(); ctx.moveTo(bx, -3.5 * u); ctx.lineTo(bx + bl, -2 * u); ctx.lineTo(bx + bl + 8 * u, 1 * u); ctx.lineTo(bx + bl, 3 * u); ctx.lineTo(bx, 3 * u); ctx.fill();
    ctx.fillStyle = '#fff4e4'; ctx.fillRect(bx, 1 * u, bl, Math.max(1, u));
    ctx.fillStyle = '#4e4656'; ctx.fillRect(bx, -3.5 * u, bl, Math.max(1, u));
    // sunset glint traveling the edge
    const gx = bx + ((T * 260 * u) % (bl * 1.6));
    if (gx < bx + bl) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,214,10,.95)'; ctx.fillRect(gx, .5 * u, 10 * u, Math.max(1, u * 1.2)); ctx.globalCompositeOperation = 'source-over'; }
  }
  if (smear > .08 && smear < .9) {
    ctx.setTransform(base[0], base[1], base[2], base[3], base[4], base[5]);
    ctx.globalCompositeOperation = 'lighter';
    const a0 = lerp(restA, endA, easeIO(smear - .2)), a1 = lerp(restA, endA, easeIO(smear));
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(255,140,70,.28)' : k === 1 ? 'rgba(255,210,160,.5)' : 'rgba(255,255,245,.95)';
      ctx.lineWidth = (8 - k * 3) * u;
      ctx.beginPath(); ctx.arc(hx, hy, 178 * u, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- game state ----------
let state = 'title', T = 0, stT = 0;
let qi = 0, armed = true, lastSwingT = -9;
let timeScale = 1, hitstop = 0, shake = 0, flash = 0, split = 0, splitAng = .4;
let cutCount = 0, timeLeft = TIME_LIMIT, curStand = 0, allCut = false;
let cdStep = 0, punch = 0, rollKick = 0, presetIdx = 0, presetSnap = false;
const kata = { side: 1, swing: -1, in: 0, sheathed: false, pend: null };
let camS = { px: 0, py: 1.5, pz: -1, tx: 0, ty: 1, tz: 5, fov: 1.05, roll: 0 };
let best = 0; try { best = +localStorage.getItem('rz_best5') || 0; } catch (e) {}
let lang = detectLang(), soundOn = true; try { soundOn = localStorage.getItem('rz_snd') !== '0'; } catch (e) {}
let inputMode = 'motion';
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const RANK_TH = [0, 8, 13, 18, 23, 28, 33, 38];
const rankOf = n => { let r = 0; for (let i = 0; i < RANK_TH.length; i++) if (n >= RANK_TH[i]) r = i; return r; };
const pieceCount = () => cutCount + 1;
const MILESTONE = { 10: '疾風', 20: '迅雷', 30: '烈火', 38: '無双', 45: '神速' };

function setScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
function go(s) {
  state = s; stT = 0;
  if (s === 'title') { setScreen('sTitle'); app.classList.remove('cine'); resetStands(); }
  if (s === 'ready') {
    setScreen('sReady'); qi = 0; resetStands(); app.classList.remove('cine');
    curStand = 0; kata.in = 0; kata.swing = -1; kata.side = 1; kata.pend = null;
    cutCount = 0; timeLeft = TIME_LIMIT; presetIdx = 0; allCut = false; armed = true;
    updReadyUI();
  }
  if (s === 'count') { setScreen('sHud'); cdStep = 0; updHud(); }
  if (s === 'play') { setScreen('sHud'); }
  if (s === 'final') { app.classList.add('cine'); }
  if (s === 'result') { app.classList.remove('cine'); showResult(); }
}

// ---------- swing / cut ----------
// every distinct swing is one cut. A new swing may interrupt the previous animation.
function trySwing() {
  if (state !== 'play' || !armed || allCut) return false;
  if (T - lastSwingT < .09) return false;
  if (kata.pend && !kata.pend.resolved) resolveCut(kata.pend);
  if (kata.swing >= 0) kata.side = -kata.side;
  armed = false; lastSwingT = T;
  kata.swing = 0; kata.in = 1;
  kata.pend = { side: kata.side, resolved: false };
  A.whoosh(.6);
  return true;
}
function resolveCut(pend) {
  pend.resolved = true;
  if (state !== 'play' || allCut) return;
  const st = stands[curStand];
  const sd = pend.side;
  for (const p of pieces) if (p.stage === 'hold') p.hold = Math.min(p.hold, 0); // previous slice starts to slide
  let h = st.top - SLICE * rr(.9, 1.1);
  if (h < MAT_BASE + SLICE * .6) { h = MAT_BASE; }
  const piece = { st, s0: h, s1: st.top, sd, stage: 'hold', hold: .24, slide: 0, cx: st.x, cy: (h + st.top) / 2, cz: st.z, vx: 0, vy: 0, vz: 0, kx: rr(-.35, .35), kz: 1, th: 0, w: 0 };
  if (h <= MAT_BASE) { piece.s0 = MAT_BASE; piece.cy = (MAT_BASE + st.top) / 2; }
  pieces.push(piece);
  st.top = h; st.cuts++;
  slashes.push({ x: st.x, y: h, z: st.z - MAT_R * .6, sd, t: 0, life: .2 });
  slashes.push({ x: st.x, y: h, z: st.z - MAT_R * .9, sd, t: 0, life: piece.hold + .05, hold: true, piece });
  strawBurst(st.x + sd * .05, h, st.z - .05, sd, 8);
  cutCount++;
  A.cut(cutCount, false);
  hitstop = .028; shake = .35; flash = .07;
  punch = .7; rollKick = sd * .05;
  if (cutCount % 3 === 0) { split = .6; splitAng = sd * .42; }
  vib(12);
  const n = $('#cNum'); n.textContent = pieceCount(); n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
  const ms = MILESTONE[pieceCount()];
  if (ms) { cutin(ms, `${pieceCount()} ${L().unit}`); A.taiko(.8); flash = .2; shake = .6; }
  if (cutCount % 4 === 0) { presetIdx = (presetIdx + 1) % 4; presetSnap = true; }
  if (h <= MAT_BASE) { allCut = true; cutin('全断', 'ALL CUT'); A.final(); timeLeft = Math.min(timeLeft, .6); }
  updHud();
}
function updPieces(dt) {
  for (const p of pieces) {
    if (p.stage === 'rest') continue;
    const len = p.s1 - p.s0;
    if (p.stage === 'hold') {
      p.hold -= dt;
      p.cx = p.st.x + Math.sin(T * 70) * .002;
      if (p.hold <= 0) { p.stage = 'slide'; p.slide = 0; A.slip(); }
    } else if (p.stage === 'slide') {
      p.slide += dt;
      const d = 1.6 * p.slide * p.slide;
      p.cx = p.st.x + p.sd * d; p.cy = (p.s0 + p.s1) / 2 - d * .42;
      p.th = -p.sd * d * 1.2;
      if (d > MAT_R * 1.6) { p.stage = 'fall'; p.vx = p.sd * (1.0 + rnd() * .9); p.vy = -.2; p.vz = rr(-.8, .2); p.w = -p.sd * rr(4, 9); }
    } else if (p.stage === 'fall') {
      p.vy -= 9.8 * dt; p.cx += p.vx * dt; p.cy += p.vy * dt; p.cz += p.vz * dt; p.th += p.w * dt;
      const M = rotMat(p.kx, p.kz, p.th); mv(M, 0, 1, 0, tmp);
      const uy = Math.abs(tmp[1]);
      const lowY = p.cy - uy * len / 2 - MAT_R * Math.sqrt(Math.max(0, 1 - uy * uy));
      if (lowY < 0) {
        p.cy -= lowY;
        if (p.vy < 0) { if (p.vy < -1.5) { dust(p.cx, p.cz, 3); A.thud(len); } p.vy *= -.3; }
        p.vx *= .6; p.vz *= .6; p.w *= .6;
        if (Math.abs(p.vy) < .5) {
          p.stage = 'rest';
          // short slices rest on their cut face (like coins), longer ones lie down
          if (len > MAT_R * 2.2) p.th = Math.round((p.th - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
          else p.th = Math.round(p.th / Math.PI) * Math.PI;
          mv(rotMat(p.kx, p.kz, p.th), 0, 1, 0, tmp); const uy2 = Math.abs(tmp[1]);
          p.cy = uy2 * len / 2 + MAT_R * Math.sqrt(Math.max(0, 1 - uy2 * uy2));
        }
      }
    }
  }
}

// ---------- camera direction per state ----------
// framing presets around the stand. All stay on the camera side (z < stand): the imaginary line is kept.
function preset(i, cx, cz, t, ty) {
  const br = Math.sin(t * .9) * .03;
  switch (i) {
    case 0: return [cx - .55 + br, ty + .3, cz - 1.75, cx + .06, ty - .05, cz, 1.0, .0];
    case 1: return [cx - .42, Math.max(.3, ty - .7) + br, cz - 1.45, cx + .02, ty + .1, cz, 1.08, .05];
    case 2: return [cx + .62 + br, ty + .7, cz - 1.55, cx - .06, ty - .1, cz, .98, -.04];
    default: return [cx - 1.0, ty + .05, cz - 1.2 + br, cx + .1, ty - .05, cz + .2, 1.02, .02];
  }
}
function camForState(dt) {
  let px, py, pz, tx, ty, tz, fov = 1.05, roll = 0, k = 1 - Math.exp(-dt * 3.5);
  const st = stands[curStand];
  const focus = clamp(st.top - .08, MAT_BASE + .2, 1.6);
  if (state === 'title') {
    const a = T * .12;
    px = st.x + Math.sin(a) * 2.6 - .4; py = .8 + Math.sin(T * .3) * .1; pz = st.z - 2.4 - Math.cos(a) * .4; tx = st.x + .4; ty = 1.55; tz = st.z + 1.2; fov = 1.15; roll = .03;
    k = 1 - Math.exp(-dt * 2);
  } else if (state === 'ready' || state === 'count') {
    const p = preset(0, st.x, st.z, T, 1.25);
    const c = state === 'count' ? cdT() : 0;
    px = p[0] - .25 + c * .25; py = p[1] + .1; pz = p[2] - .6 + c * .6; tx = p[3]; ty = p[4]; tz = p[5]; fov = p[6] + .1 - qi * .07;
  } else if (state === 'play') {
    const p = preset(presetIdx, st.x, st.z, T, focus);
    px = p[0]; py = p[1]; pz = p[2]; tx = p[3]; ty = p[4]; tz = p[5]; fov = p[6]; roll = p[7];
    k = presetSnap ? 1 : 1 - Math.exp(-dt * 9); presetSnap = false;
    const dx = tx - px, dy = ty - py, dz = tz - pz, l = Math.hypot(dx, dy, dz);
    px += dx / l * punch * .14; py += dy / l * punch * .14; pz += dz / l * punch * .14; fov -= punch * .05; roll += rollKick;
  } else if (state === 'final') {
    // slow orbit around the stand while the last slices fall
    const t = stT; const a = -1.15 + t * .5;
    px = st.x + Math.sin(a) * 1.7; py = .55 + t * .22; pz = Math.min(st.z - .35, st.z - Math.cos(a) * 1.6); tx = st.x; ty = .75; tz = st.z; fov = .98; roll = .05;
    k = t < .05 ? 1 : 1 - Math.exp(-dt * 5);
  } else if (state === 'wide' || state === 'result') {
    const t = easeIO(Math.min(1, (state === 'wide' ? stT : 3) / 2.4));
    px = lerp(st.x - .8, st.x + 1.6, t) + Math.sin(T * .1) * .15; py = lerp(.9, 2.7, t); pz = lerp(st.z - 1.6, st.z - 3.1, t);
    tx = lerp(st.x, st.x + .1, t); ty = lerp(.8, .25, t); tz = lerp(st.z, st.z + .5, t); fov = lerp(1.0, 1.1, t);
    k = state === 'wide' && stT < .05 ? 1 : 1 - Math.exp(-dt * 6);
  }
  camS.px = lerp(camS.px, px, k); camS.py = lerp(camS.py, py, k); camS.pz = lerp(camS.pz, pz, k);
  camS.tx = lerp(camS.tx, tx, k); camS.ty = lerp(camS.ty, ty, k); camS.tz = lerp(camS.tz, tz, k);
  const kf = k === 1 ? 1 : 1 - Math.exp(-dt * 7);
  camS.fov = lerp(camS.fov, fov, kf); camS.roll = lerp(camS.roll, roll, kf);
  lookAt(camS.px, camS.py, camS.pz, camS.tx, camS.ty, camS.tz);
  cam.fov = camS.fov; cam.roll = camS.roll;
}
const cdT = () => clamp(stT / 2.4, 0, 1);

// ---------- update ----------
function update(rdt) {
  T += rdt;
  if (hitstop > 0) { hitstop -= rdt; camUpdate(); return; }
  const slow = state === 'final' ? .3 : 1;
  timeScale = lerp(timeScale, slow, 1 - Math.exp(-rdt * (slow < 1 ? 14 : 5)));
  const dt = rdt * timeScale; stT += rdt;
  shake = Math.max(0, shake - rdt * 3); flash = Math.max(0, flash - rdt * 4); split = Math.max(0, split - rdt * 3.5);
  punch = Math.max(0, punch - rdt * 6); rollKick *= Math.exp(-rdt * 8);
  kata.in = Math.min(1, kata.in + rdt * 6);

  if (state === 'ready') {
    if (inputMode === 'motion') {
      const R = motion.R;
      if (R < 30 && T - motion.t < .5) qi = Math.min(1, qi + rdt / 1.1);
      else if (R > 60) qi = Math.max(0, qi - rdt * .8);
      if (stT > 1.2 && T - motion.t > 1.0 && motion.count === 0) { inputMode = 'swipe'; toast(L().motionOff); }
    } else if (swipe.down && T - swipe.lastMove > .08) qi = Math.min(1, qi + rdt / 1.0);
    updReadyUI();
    if (qi >= 1) { go('count'); A.ring(); vib(15); }
  }
  if (state === 'count') {
    const step = Math.floor(stT / .7);
    if (step >= cdStep && step <= 3) {
      cdStep = step + 1;
      if (step < 3) { countIn(String(3 - step)); A.tick(true); }
      else { countIn('始め'); A.taiko(1.1); flash = .3; vib([20, 20, 40]); }
    }
    if (stT > 3 * .7 + .15) { go('play'); armed = true; }
  }
  if (state === 'play') {
    const prev = timeLeft;
    timeLeft -= rdt;
    if (Math.ceil(timeLeft) !== Math.ceil(prev) && timeLeft > 0) A.tick(false);
    if (timeLeft <= 0) { timeLeft = 0; endRound(); }
    updHud();
  }
  if (state === 'final' && stT > 2.3) { go('wide'); app.classList.remove('cine'); A.taiko(1.2); }
  if (state === 'wide' && stT > 2.6) go('result');
  if (kata.swing >= 0) {
    kata.swing += rdt / .12;
    if (kata.pend && !kata.pend.resolved && kata.swing >= .4) resolveCut(kata.pend);
    if (kata.swing >= 1) { kata.swing = -1; kata.side = -kata.side; kata.in = .55; }
  }
  if (rnd() < rdt * .12 && crows.length < 4) crows.push({ a: cam.yaw + rr(-.9, -.5), e: rr(.08, .3), v: rr(.04, .08), p: rr(0, 6) });
  for (let i = crows.length - 1; i >= 0; i--) { crows[i].a += crows[i].v * rdt; if (crows[i].a > cam.yaw + 1.2) crows.splice(i, 1); }
  for (const s of slashes) { s.t += dt; if (s.hold && s.piece && s.piece.stage !== 'hold') s.t = s.life; }
  updPieces(dt);
  updParts(dt);
  camForState(rdt);
  camUpdate();
}
function endRound() {
  if (kata.pend && !kata.pend.resolved) resolveCut(kata.pend);
  go('final'); countIn('止め'); A.final(); flash = .4; shake = .8; vib([40, 30, 80]);
  for (const p of pieces) if (p.stage === 'hold') p.hold = Math.min(p.hold, .35);
}

// ---------- render ----------
const sortList = [];
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawSky();
  sortList.length = 0;
  const tanX = HW / F * 1.3 + .15;
  const vis = (x, z, far = 45) => { toCam(x, 0, z, tmp); if (tmp[2] < -2 || tmp[2] > far) return null; if (Math.abs(tmp[0]) > (Math.max(tmp[2], 0) + 3) * tanX + 2) return null; return tmp[2]; };
  for (const s of stands) { const d = vis(s.x, s.z, 30); if (d !== null) sortList.push([d, 1, s]); }
  for (const p of pieces) { const d = vis(p.cx, p.cz, 30); if (d !== null) sortList.push([d - .05, 2, p]); }
  for (const p of props) {
    let d;
    if (p.kind === 'wall') { toCam(clamp(cam.x, p.x0, p.x1), 0, p.z, tmp); d = tmp[2]; if (d < .5 || d > 60) continue; if (Math.abs(tmp[0]) > (d + 6) * tanX + 6) continue; }
    else if (p.kind === 'dojo') { toCam(clamp(cam.x, p.x0, p.x1), 0, p.z, tmp); d = tmp[2] + 4; if (d < 1 || d > 70) continue; }
    else { d = vis(p.x, p.z, p.kind === 'pine' ? 60 : 35); if (d === null || d < .4) continue; }
    sortList.push([d, 3, p]);
  }
  sortList.sort((a, b) => b[0] - a[0]);
  for (const it of sortList) {
    const o = it[2];
    if (it[1] === 1) {
      drawStandBody(o);
      if (o.top > MAT_BASE + .01) drawMat(o, o.x, MAT_BASE, o.z, I3, MAT_BASE, o.top, o.cuts ? 1 : 0);
    } else if (it[1] === 2) {
      const len = o.s1 - o.s0; const M = rotMat(o.kx, o.kz, o.th); mv(M, 0, 1, 0, tmp2);
      drawMat(o.st, o.cx - tmp2[0] * len / 2, o.cy - tmp2[1] * len / 2, o.cz - tmp2[2] * len / 2, M, o.s0, o.s1, o.s1 < MAT_TOP - .01 ? 3 : 2);
    } else if (o.kind === 'wall') drawWall(o);
    else if (o.kind === 'dojo') drawDojo(o);
    else drawStack(o);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawParts();
  drawSlashes();
  if (state === 'ready' || state === 'count' || state === 'play') drawKatana();
  composite();
}
function composite() {
  const w = view.width, h = view.height;
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.fillStyle = '#0a0610'; vctx.fillRect(0, 0, w, h);
  const sx = (rnd() - .5) * shake * 10 * DPR, sy = (rnd() - .5) * shake * 10 * DPR;
  const roll = cam.roll; const zoom = 1 + Math.abs(roll) * .35 + shake * .02;
  const dw = LW * S, dh = LH * S;
  const drawLow = () => { vctx.drawImage(low, -dw / 2, -dh / 2, dw, dh); };
  vctx.save(); vctx.translate(w / 2 + sx, h / 2 + sy); vctx.rotate(roll); vctx.scale(zoom, zoom);
  if (split > 0) {
    const off = Math.sin(split * Math.PI) * 12 * DPR * split;
    const ca = Math.cos(splitAng), sa = Math.sin(splitAng); const nx = -sa, ny = ca; const R = Math.hypot(w, h);
    for (const side of [1, -1]) {
      vctx.save(); vctx.beginPath();
      vctx.moveTo(-ca * R, -sa * R); vctx.lineTo(ca * R, sa * R); vctx.lineTo(ca * R + nx * R * side, sa * R + ny * R * side); vctx.lineTo(-ca * R + nx * R * side, -sa * R + ny * R * side); vctx.closePath(); vctx.clip();
      vctx.translate(ca * off * side, sa * off * side); drawLow(); vctx.restore();
    }
  } else drawLow();
  vctx.restore();
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, w, h);
  // sun glare (screen space)
  if (sunScreen) {
    const gx = (sunScreen[0] - HW) * S + w / 2, gy = (sunScreen[1] - HH) * S + h / 2;
    fctx.globalCompositeOperation = 'lighter';
    const g = fctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * .7);
    g.addColorStop(0, 'rgba(255,170,90,.22)'); g.addColorStop(.3, 'rgba(255,110,70,.07)'); g.addColorStop(1, 'rgba(255,80,60,0)');
    fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
    // ghosts
    const cx = w / 2, cy = h / 2;
    for (const [k, r, a] of [[-.5, .05, .07], [-1.1, .09, .05], [.4, .03, .08]]) {
      const x = cx + (gx - cx) * k, y = cy + (gy - cy) * k; fctx.fillStyle = `rgba(255,190,120,${a})`; fctx.beginPath(); fctx.arc(x, y, Math.min(w, h) * r, 0, 7); fctx.fill();
    }
    fctx.globalCompositeOperation = 'source-over';
  }
  if (split > 0) {
    const ca = Math.cos(splitAng), sa = Math.sin(splitAng), R = Math.hypot(w, h);
    fctx.save(); fctx.translate(w / 2, h / 2); fctx.globalCompositeOperation = 'lighter';
    fctx.strokeStyle = `rgba(255,170,90,${split * .5})`; fctx.lineWidth = 20 * DPR * split; fctx.beginPath(); fctx.moveTo(-ca * R, -sa * R); fctx.lineTo(ca * R, sa * R); fctx.stroke();
    fctx.strokeStyle = `rgba(255,255,240,${split})`; fctx.lineWidth = 3 * DPR * split + 1; fctx.stroke();
    fctx.restore();
  }
  if (flash > 0) { fctx.fillStyle = `rgba(255,240,220,${flash * .8})`; fctx.fillRect(0, 0, w, h); }
  if (state === 'play' || state === 'count') { // qi stays full until time is up
    const a = .09 + .05 * Math.sin(T * 9);
    const g = fctx.createRadialGradient(w / 2, h / 2, h * .28, w / 2, h / 2, h * .8);
    g.addColorStop(0, 'rgba(255,214,10,0)'); g.addColorStop(1, `rgba(255,190,40,${a})`);
    fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
  }
  if (state === 'play' && timeLeft < 2) {
    const a = (.5 + .5 * Math.sin(T * 10)) * .14 * (1 - timeLeft / 2);
    const g = fctx.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .8);
    g.addColorStop(0, 'rgba(255,60,40,0)'); g.addColorStop(1, `rgba(255,60,40,${a})`);
    fctx.fillStyle = g; fctx.fillRect(0, 0, w, h);
  }
}

// ---------- input: motion (gyro) ----------
const motion = { R: 0, A: 0, t: -9, count: 0, peak: 0 };
function onMotion(e) {
  const r = e.rotationRate; if (!r) return;
  const R = Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0);
  let Am = 0;
  if (e.acceleration && e.acceleration.x != null) Am = Math.hypot(e.acceleration.x, e.acceleration.y, e.acceleration.z);
  else if (e.accelerationIncludingGravity) { const g = e.accelerationIncludingGravity; Am = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.8); }
  motion.R = R; motion.A = Am; motion.t = T; motion.count++;
  if (inputMode !== 'motion') return;
  // a swing ends when the rate falls well below its peak (the reversal of a back-and-forth flick)
  if (!armed) { motion.peak = Math.max(motion.peak, R); if (R < Math.max(140, motion.peak * .5)) armed = true; }
  else if (R > 300 && trySwing()) motion.peak = R;
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
// ---------- input: swipe (fallback when no motion sensor) ----------
const swipe = { down: false, x: 0, y: 0, sx: 0, sy: 0, st: 0, dir: null, lastMove: 0 };
function onDown(e) {
  if (e.target.closest('button,a')) return;
  A.unlock();
  swipe.down = true; swipe.x = swipe.sx = e.clientX; swipe.y = swipe.sy = e.clientY; swipe.st = performance.now(); swipe.dir = null; swipe.lastMove = T;
  if (inputMode === 'swipe') armed = true;
}
$('#sReady').addEventListener('pointerdown', onDown);
$('#sHud').addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', e => {
  if (!swipe.down) return;
  const now = performance.now();
  const mx = e.clientX - swipe.x, my = e.clientY - swipe.y, ml = Math.hypot(mx, my);
  if (ml < 3) return;
  // a pause or a direction reversal starts a new stroke
  if (T - swipe.lastMove > .06 || (swipe.dir && (mx * swipe.dir[0] + my * swipe.dir[1]) / ml < -.2)) {
    swipe.sx = swipe.x; swipe.sy = swipe.y; swipe.st = now;
    if (inputMode === 'swipe') armed = true;
  }
  swipe.lastMove = T; swipe.x = e.clientX; swipe.y = e.clientY;
  const dx = swipe.x - swipe.sx, dy = swipe.y - swipe.sy, d = Math.hypot(dx, dy);
  if (d > 4) swipe.dir = [dx / d, dy / d];
  if (inputMode !== 'swipe' || state !== 'play') return;
  if (d > Math.min(W, H) * .12 && now - swipe.st < 220) trySwing();
});
window.addEventListener('pointerup', () => { swipe.down = false; if (inputMode === 'swipe') armed = true; });

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
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + Math.min(.015, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let out = g; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    s.connect(f); f.connect(g); out.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function tone(type, f0, f1, dur, g0, t0 = 0, att = .005, pan = 0) {
    if (!ac) return; const t = now() + t0;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let out = g; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function ambient() {
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; const g = ac.createGain(); g.gain.value = .045;
    const lfo = ac.createOscillator(); lfo.frequency.value = .07; const lg = ac.createGain(); lg.gain.value = .03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(master); s.start();
    // higurashi (evening cicada)
    const higu = () => {
      if (!ac) return;
      const t0 = now(), base = 4300 + Math.random() * 500, pan = Math.random() * 1.6 - .8, n = 10 + (Math.random() * 8 | 0);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(base, t0);
      const g2 = ac.createGain(); g2.gain.setValueAtTime(.0001, t0);
      for (let i = 0; i < n; i++) { const tt = t0 + i * .13, amp = .016 * Math.sin((i + 1) / (n + 1) * Math.PI); g2.gain.exponentialRampToValueAtTime(Math.max(.0002, amp), tt + .02); g2.gain.exponentialRampToValueAtTime(.0001, tt + .11); o.frequency.setValueAtTime(base * (1 - i * .006), tt); }
      let out = g2; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g2.connect(p); out = p; }
      o.connect(g2); out.connect(master); o.start(t0); o.stop(t0 + n * .13 + .2);
      setTimeout(higu, 3000 + Math.random() * 5000);
    };
    setTimeout(higu, 800);
    const crow = () => { if (!ac) return; if (state === 'title' || state === 'ready' || state === 'result') { const p = Math.random() * 1.4 - .7; for (let i = 0; i < 2; i++) { noise(.22, 'bandpass', 1100, 700, 5, .05, i * .32, p); tone('sawtooth', 620, 480, .2, .012, i * .32, .02, p); } } setTimeout(crow, 7000 + Math.random() * 9000); };
    setTimeout(crow, 4000);
  }
  return {
    unlock,
    setOn(v) { if (master) master.gain.value = v ? .9 : 0; },
    ring() { if (!ac) return; [1760, 2637, 3951, 5274].forEach((f, i) => tone('sine', f, f * .998, 1.4 - i * .25, .05 / (i + 1))); },
    ping() { tone('sine', 2637, 2630, .25, .05); tone('sine', 3951, 3940, .2, .025); },
    sheath() { noise(.28, 'bandpass', 1800, 7000, 2.5, .5); [3100, 4700, 6900].forEach((f, i) => tone('sine', f, f, .5, .05 / (i + 1), .05)); },
    whoosh(p) { noise(.22, 'bandpass', 500, 2400 + p * 1600, 1.4, .45); noise(.25, 'lowpass', 900, 150, .7, .3, .02); },
    cut(i) {
      if (!ac) return; const f = 1400 + ((i * 173) % 700);
      noise(.05, 'highpass', 5000, 7000, .7, .4, 0, .15);
      noise(.11, 'bandpass', f, f * .7, 4, .9);       // dry straw shear
      noise(.18, 'bandpass', 420, 260, 2, .35, .01);   // fibrous body
      tone('triangle', 240, 120, .08, .14);
    },
    glance() { noise(.08, 'bandpass', 2600, 1800, 3, .25); tone('square', 900, 700, .05, .04); },
    slip() { noise(.12, 'bandpass', 3200, 1600, 2, .12); },
    thud(len) { if (!ac) return; tone('sine', 120 - len * 30, 50, .22, .12 + len * .1); noise(.25, 'bandpass', 1400, 600, 1, .08); },
    step() { noise(.16, 'bandpass', 900, 300, 1, .12); noise(.1, 'highpass', 4000, 6000, 1, .06); },
    tick(big) { tone('square', big ? 1500 : 1900, big ? 1500 : 1900, .05, big ? .08 : .05); noise(.03, 'highpass', 3000, 3000, 1, .1); },
    bonus() { [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, .5, .05, i * .05)); },
    taiko(g = 1) { tone('sine', 110, 46, .55, .6 * g); noise(.15, 'lowpass', 1200, 200, .8, .45 * g); },
    final() { this.taiko(1.2); tone('sine', 70, 30, 1.4, .5); [523, 784, 1046].forEach((f, i) => tone('sine', f, f * .995, 3, .05 / (i + 1), .1)); },
    bell() { if (!ac) return; [196, 392.6, 588, 830, 1046].forEach((f, i) => tone('sine', f, f * .997, 6 - i, .09 / (i + 1), 0, .01)); },
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
  $('#qiLabel').textContent = t.qi;
  $('#bSound').textContent = soundOn ? t.on : t.off;
  $('#langList').innerHTML = Object.keys(LANG_NAMES).map(k => `<button data-l="${k}" class="${k === lang ? 'on' : ''}">${LANG_NAMES[k]}</button>`).join('');
  $('#bestNum').textContent = best;
  updReadyUI(); fitLogo(); updShareLink();
}
function fitLogo() {
  const el = $('.logo'); if (!el) return;
  el.style.fontSize = '100px';
  const w = el.scrollWidth || 1;
  el.style.fontSize = Math.min(120, 100 * (Math.min(W, 520) * .86) / w) + 'px';
}
function updReadyUI() {
  if (state !== 'ready') return;
  $('#readyHint').textContent = inputMode === 'swipe' ? L().swipeHold : L().hold;
  $('#qiFill').style.width = (qi * 100).toFixed(1) + '%';
  $('#qiWrap').classList.toggle('full', qi >= 1);
}
let lastHud = '';
function updHud() {
  const tl = Math.max(0, timeLeft);
  $('#tFill').style.width = clamp(tl / TIME_LIMIT * 100, 0, 100) + '%';
  const s = tl.toFixed(2) + '|' + cutCount;
  if (s === lastHud) return; lastHud = s;
  $('#tNum').textContent = tl.toFixed(2);
  $('#timeBox').classList.toggle('low', tl < 2 && state === 'play');
  $('#cNum').textContent = pieceCount();
}
let cutinTO = 0;
function cutin(main, sub) { const c = $('#cutin'); c.className = ''; c.innerHTML = `<em>${main}</em>` + (sub ? `<small>${sub}</small>` : ''); void c.offsetWidth; c.classList.add('go'); clearTimeout(cutinTO); cutinTO = setTimeout(() => c.classList.remove('go'), 950); }
function countIn(s) { const c = $('#cutin'); c.className = ''; c.innerHTML = s.length > 1 ? `<em>${s}</em>` : s; void c.offsetWidth; c.classList.add('cd'); clearTimeout(cutinTO); cutinTO = setTimeout(() => c.classList.remove('cd'), 720); }
let judgeTO = 0;
function judge(s, cls) { const j = $('#judge'); j.className = cls; j.textContent = s; void j.offsetWidth; j.classList.add('go'); clearTimeout(judgeTO); judgeTO = setTimeout(() => j.classList.remove('go'), 560); }
let toastTO = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastTO); toastTO = setTimeout(() => t.classList.remove('on'), 3200); }
let lastResult = null;
function showResult() {
  const n = pieceCount(); const r = rankOf(n); const t = L();
  const nb = n > best;
  if (nb) { best = n; try { localStorage.setItem('rz_best5', best); } catch (e) {} }
  lastResult = { n, r, cuts: cutCount, rate: cutCount / TIME_LIMIT };
  $('#rRank').textContent = RANKS[r]; $('#rRank').classList.remove('pop'); void $('#rRank').offsetWidth; $('#rRank').classList.add('pop');
  $('#rTitle').textContent = t.titles[r];
  $('#rNum').textContent = n; $('#rPerf').textContent = cutCount; $('#rMax').textContent = (cutCount / TIME_LIMIT).toFixed(1);
  const rb = $('#rBest'); rb.textContent = nb ? t.newBest : `${t.best} ${best}`; rb.classList.toggle('nb', nb);
  $('#bestNum').textContent = best;
  setScreen('sResult');
  A.result(r);
  updShareLink();
  shareImg = null; makeShareImage().then(b => shareImg = b);
}

// ---------- share ----------
let shareImg = null;
async function makeShareImage() {
  try { await document.fonts.ready; } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const sc = Math.max(1200 / LW, 630 / LH);
  x.drawImage(low, (1200 - LW * sc) / 2, (630 - LH * sc) / 2 - 40, LW * sc, LH * sc);
  let g = x.createLinearGradient(0, 0, 1200, 0); g.addColorStop(0, 'rgba(14,26,43,.92)'); g.addColorStop(.55, 'rgba(14,26,43,.55)'); g.addColorStop(1, 'rgba(14,26,43,.08)');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
  const t = L(), r = lastResult;
  x.save(); x.transform(1, 0, -0.12, 1, 0, 0);
  x.textBaseline = 'alphabetic'; x.shadowColor = '#0e1a2b'; x.shadowBlur = 24;
  let fs = 92; x.font = `400 ${fs}px "Dela Gothic One"`;
  while (x.measureText(t.name[0] + t.name[1]).width > 720 && fs > 40) { fs -= 4; x.font = `400 ${fs}px "Dela Gothic One"`; }
  const wa = x.measureText(t.name[0]).width;
  x.fillStyle = '#fff'; x.fillText(t.name[0], 96, 150); x.fillStyle = '#ffd60a'; x.fillText(t.name[1], 96 + wa + 8, 150);
  x.shadowBlur = 10; x.font = '500 18px Oswald'; x.fillStyle = '#d6dfec'; x.fillText(t.sub, 100, 186);
  x.shadowBlur = 24; x.font = '700 190px Oswald'; x.fillStyle = '#fff'; const nTxt = String(r.n); x.fillText(nTxt, 120, 400);
  const nw = x.measureText(nTxt).width; x.font = '400 46px "Dela Gothic One"'; x.fillStyle = '#ffd60a'; x.fillText(t.unit, 132 + nw, 396);
  x.shadowBlur = 10; x.font = '900 22px "Zen Kaku Gothic New","Dela Gothic One",sans-serif'; x.fillStyle = '#c9d4e4';
  x.fillText(`${t.statCuts} ${r.cuts}   ${t.statRate} ${r.rate.toFixed(1)}   ${TIME_LIMIT}s`, 126, 440);
  x.shadowBlur = 24; x.font = '700 120px Oswald'; x.fillStyle = '#ffd60a'; x.fillText(RANKS[r.r], 150, 568);
  const rw = x.measureText(RANKS[r.r]).width;
  x.font = '900 40px "Zen Kaku Gothic New","Dela Gothic One",sans-serif'; x.fillStyle = '#fff';
  let tt = t.titles[r.r]; fs = 40; while (x.measureText(tt).width > 1200 - 210 - rw - 80 && fs > 18) { fs -= 2; x.font = `900 ${fs}px "Zen Kaku Gothic New","Dela Gothic One",sans-serif`; }
  x.fillText(tt, 180 + rw, 550);
  x.restore();
  x.font = '500 20px Oswald'; x.fillStyle = 'rgba(214,223,236,.85)'; x.textAlign = 'right'; x.fillText('uimemocho.github.io/apps/renzoku-giri', 1170, 606);
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
  if (!inFrame && shareImg && navigator.canShare) {
    const t = L(); const text = t.shareText(r.n, RANKS[r.r], t.titles[r.r]);
    let file = null; try { file = new File([shareImg], 'renzoku-giri.png', { type: 'image/png' }); } catch (err) {}
    if (file && navigator.canShare({ files: [file] })) {
      e.preventDefault();
      navigator.share({ files: [file], text: text + '\n' + URL_GAME }).catch(err => { if (err && err.name === 'AbortError') return; location.href = shareIntentURL(); });
    }
  }
}
async function doSave() {
  if (!shareImg) shareImg = await makeShareImage();
  const a = document.createElement('a'); a.href = URL.createObjectURL(shareImg); a.download = `renzoku-giri_${lastResult ? lastResult.n : 0}.png`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- buttons ----------
let warned = false; try { warned = localStorage.getItem('rz_warn') === '1'; } catch (e) {}
async function startReady() {
  A.unlock();
  const ok = await requestMotion();
  inputMode = ok ? 'motion' : 'swipe';
  motion.count = 0;
  go('ready');
  if (!ok) toast(L().motionOff);
}
$('#bStart').onclick = () => { A.unlock(); if (!warned) { $('#mWarn').classList.add('on'); return; } startReady(); };
$('#bWarnOk').onclick = () => { warned = true; try { localStorage.setItem('rz_warn', '1'); } catch (e) {} $('#mWarn').classList.remove('on'); startReady(); };
$('#bHow').onclick = () => $('#mHow').classList.add('on');
$('#bSet').onclick = () => $('#mSet').classList.add('on');
for (const m of document.querySelectorAll('.modal')) m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) { if (m.id !== 'mWarn') m.classList.remove('on'); } });
$('#bSound').onclick = () => { soundOn = !soundOn; try { localStorage.setItem('rz_snd', soundOn ? '1' : '0'); } catch (e) {} A.setOn(soundOn); applyLang(); };
$('#langList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; lang = b.dataset.l; try { localStorage.setItem('rz_lang', lang); } catch (e) {} applyLang(); });
$('#bRetry').onclick = () => startReady();
$('#bBack').onclick = () => go('title');
$('#bBackR').onclick = () => go('title');
$('#bShare').addEventListener('click', onShareClick);
$('#bSave').onclick = () => doSave();
document.addEventListener('gesturestart', e => e.preventDefault());
let bellDone = false;
document.addEventListener('pointerdown', () => { A.unlock(); if (!bellDone) { bellDone = true; A.bell(); } }, { once: false });

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}
// test hooks (headless verification only)
window.__rz = {
  go, get state() { return state; }, get cut() { return cutCount; }, get time() { return timeLeft; },
  step: (t, fn) => { for (let i = 0; i < t * 60; i++) { update(1 / 60); if (fn) fn(); } render(); },
  swing: () => { armed = true; lastSwingT = -9; inputMode = 'motion'; trySwing(); },
  setMode: m => { inputMode = m; }, setQi: v => { qi = v; }, motion, get dbg() { return { qi, inputMode, T, armed, mt: motion.t }; }
};

buildWorld();
resize(); addEventListener('resize', resize);
applyLang();
if (document.fonts) document.fonts.ready.then(fitLogo);
camForState(1); camUpdate();
requestAnimationFrame(loop);
})();
