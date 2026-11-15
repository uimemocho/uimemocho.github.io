// 機体の形の解析と飛行シミュレーション（THREE非依存）
// 描画座標：x 右+（-1..1, 中心線0）、y 前+（-1..1, 機首が +1）
import { hash2 } from './terrain.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const G = 9.8;

// ───────── 一筆の整形 ─────────
export function resample(pts, n = 64) {
  if (pts.length < 2) return pts.slice();
  const out = [], seg = [];
  let total = 0;
  const closed = pts.concat([pts[0]]);
  for (let i = 1; i < closed.length; i++) { const l = Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]); seg.push(l); total += l; }
  const step = total / n; let acc = 0, i = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (i < seg.length - 1 && acc + seg[i] < target) { acc += seg[i]; i++; }
    const t = seg[i] ? (target - acc) / seg[i] : 0;
    const a = closed[i], b = closed[i + 1];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
export function mirrorStroke(pts) {
  // 片側だけ描いた線を中心線で折り返す（左右対称モード）
  const side = pts.reduce((s, p) => s + p[0], 0) >= 0 ? 1 : -1;
  const half = pts.map(p => [Math.abs(p[0]) * side, p[1]]);
  const back = half.slice().reverse().map(p => [-p[0], p[1]]);
  return half.concat(back);
}

// ───────── 形→性能 ─────────
export function analyze(raw) {
  const pts = resample(raw, 64);
  let A2 = 0, cx = 0, cy = 0, per = 0;
  let minX = 9, maxX = -9, minY = 9, maxY = -9, left = 0, right = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0; A2 += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    per += Math.hypot(x1 - x0, y1 - y0);
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x0); minY = Math.min(minY, y0); maxY = Math.max(maxY, y0);
  }
  const A = Math.abs(A2) / 2 || 1e-4;
  cx = A2 ? cx / (3 * A2) : 0; cy = A2 ? cy / (3 * A2) : 0;
  // 左右の面積（格子サンプリング）
  const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  let fillA = 0;
  for (let gx = -20; gx < 20; gx++) for (let gy = -20; gy < 20; gy++) { const x = (gx + 0.5) / 20, y = (gy + 0.5) / 20; if (inside(x, y)) { fillA++; if (x < 0) left++; else right++; } }
  const span = maxX - minX, len = maxY - minY;
  const AR = span * span / A;
  const jag = per * per / (4 * Math.PI * A);
  const tot = left + right || 1;
  const asym = (right - left) / tot * 0.6 + clamp(cx / Math.max(0.2, span), -1, 1) * 0.4;
  // 重心：紙の面積の重心と、機首の折り重ね（前寄り）の合成
  const com = cy * 0.68 + (maxY - len * 0.16) * 0.32;
  const margin = (com - cy) / Math.max(0.2, len);

  // 0..1 の性能
  const lift = clamp((A - 0.12) / 1.05);
  const arS = clamp((AR - 0.8) / 3.6);
  const jagP = clamp((jag - 1.6) / 6);
  const glide = clamp(arS * 0.85 + 0.25 - jagP * 0.55 - (len < 0.35 ? 0.3 : 0));
  const stab = clamp(1 - Math.abs(margin - 0.12) / 0.14);
  const straight = clamp(1 - Math.abs(asym) * 3.2);
  const tiny = A < 0.07 || span < 0.18 || len < 0.18;

  // 物理パラメータ
  const m = A + 0.35, loading = m / Math.max(0.05, A);
  const Vt = 13.5 * Math.sqrt(loading / 1.35);
  let LD = 3.2 + glide * 7.8 + stab * 1.2;
  if (margin > 0.28) LD *= clamp(1 - (margin - 0.28) * 1.6, 0.55, 1);
  if (tiny) LD = 2.2;
  const damp = 0.25 + clamp(margin / 0.12) * 1.9;
  const bias = clamp(asym * 1.4, -0.5, 0.5);
  const type = typeOf({ A, AR, len, span, asym, margin, fill: A / Math.max(0.05, span * len), jag, tiny });
  return { pts, A, span, len, AR, jag, asym, margin, cx, cy, lift, glide, stab, straight, Vt, LD, damp, bias, type, tiny };
}
function typeOf(s) {
  if (s.tiny) return 'paper';
  if (s.jag > 7) return 'spiky';
  if (Math.abs(s.asym) > 0.12) return 'tricky';
  if (s.AR > 3.4) return 'glider';
  if (s.A > 1.45) return 'kite';
  if (s.len > s.span * 1.45) return 'dart';
  if (s.fill > 0.78) return 'zabuton';
  if (s.margin < 0.03) return 'wild';
  return 'standard';
}

// 定番のおまかせ機体
export const PRESETS = {
  dart: [[0, 0.95], [0.12, 0.3], [0.62, -0.62], [0.08, -0.5], [0, -0.7], [-0.08, -0.5], [-0.62, -0.62], [-0.12, 0.3]],
  glider: [[0, 0.62], [0.2, 0.36], [0.9, 0.18], [0.92, 0.0], [0.2, -0.05], [0.16, -0.55], [0.36, -0.72], [0, -0.66], [-0.36, -0.72], [-0.16, -0.55], [-0.2, -0.05], [-0.92, 0.0], [-0.9, 0.18], [-0.2, 0.36]],
  delta: [[0, 0.85], [0.7, -0.6], [0, -0.42], [-0.7, -0.6]],
};

// ───────── 空気（風・突風・上昇気流） ─────────
export const WIND_GAIN = 1.5; // 上空ほど風が強い分の誇張
export function makeAir(wx, terrain, heading) {
  // wx: {ws, wd, gust, code, isDay, cloud}  heading: 投げる方角（度）
  // 世界座標：-Z が heading 方向。風は「吹いてくる方角」wd。
  const toDir = (wx.wd + 180 - heading) * Math.PI / 180; // 世界での風下方向（heading基準、右回り）
  const base = wx.ws * WIND_GAIN;
  const wxv = Math.sin(toDir), wzv = -Math.cos(toDir);
  const gustAmp = Math.max(0.6, (wx.gust - wx.ws)) * WIND_GAIN;
  const tail = -wzv * base; // 追い風成分（+が追い風）
  const sunny = wx.isDay && !isWet(wx.code) && (wx.cloud ?? 30) < 80;
  const thermal = sunny ? 1.2 + (1 - (wx.cloud ?? 30) / 100) * 1.8 : 0;
  const wet = isWet(wx.code) ? (wx.code >= 71 && wx.code <= 77 ? 0.85 : 0.78) : 1;
  const storm = wx.code >= 95 ? 1 : 0;
  const R = terrain.P.R;
  function gust(t) {
    // 周期の違う波を重ねた突風（0..1）
    const g = 0.5 + 0.5 * (Math.sin(t * 0.9) * 0.55 + Math.sin(t * 2.3 + 1.3) * 0.3 + Math.sin(t * 0.37 + 4) * 0.35);
    return clamp(g * 1.05 - 0.04);
  }
  function at(x, y, z, t, out) {
    const g = gust(t);
    const s = base + gustAmp * (g - 0.35) + storm * Math.sin(t * 5.1 + x * 0.01) * 2.5;
    out.x = wxv * s; out.z = wzv * s;
    // 尾根の上昇気流（向かい風が山に当たる）／風下の沈下
    const d = -z, r = Math.hypot(x * 0.85, d + R * 0.12) / R;
    const agl = y - Math.max(0, terrain.height(x, z));
    const near = Math.exp(-r * r * 1.6) * clamp(1 - agl / 140, 0, 1);
    let up = near * (tail < 0 ? -tail * 0.3 : -tail * 0.12);
    // 熱上昇気流（格子ごと）
    if (thermal > 0) {
      const C = 520, gx = Math.floor(x / C), gz = Math.floor(z / C);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const h = hash2(gx + i + 101, gz + j + 37); if (h < 0.5) continue;
        const ox = (gx + i + 0.5 + (hash2(gx + i, gz + j) - 0.5) * 0.5) * C, oz = (gz + j + 0.5 + (hash2(gz + j, gx + i) - 0.5) * 0.5) * C;
        const dd = Math.hypot(x - ox, z - oz) / (60 + h * 60);
        if (dd < 1.6) up += thermal * (0.6 + h) * Math.exp(-dd * dd * 1.8);
      }
    }
    out.y = up;
    out.g = g;
    return out;
  }
  return { at, gust, base, tail, thermal, wet, storm, toDir, wxv, wzv };
}
export const isWet = (c) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86) || c >= 95;

// ───────── 飛行 ─────────
export class Flight {
  constructor(shape, terrain, air) {
    this.s = shape; this.T = terrain; this.air = air;
    this.p = { x: 0, y: terrain.top + 1.5, z: -0.6 };
    this.v = { x: 0, y: 0, z: 0 };
    this.V = 0; this.gam = 0; this.psi = 0; this.phi = 0; this.input = 0;
    this.t = 0; this.age = 0; this.done = false; this.maxY = this.p.y; this.maxAlt = 0; this.lift = 0; this.stall = 0;
    this.thermalTime = 0; this.events = []; this.trace = [];
    this._w = { x: 0, y: 0, z: 0, g: 0 };
    this.Vt = shape.Vt; this.LD = shape.LD * air.wet;
    this.boost = 0;
  }
  launch(power, aim, catchBonus) {
    // power 0..1.3（1超は力みすぎ）、aim ラジアン（右+）
    this.V = this.Vt * (0.55 + power * 1.05) * (catchBonus ? 1.12 : 1);
    this.gam = 0.07 + Math.max(0, power - 0.95) * 1.6; // 力むと機首が上がる
    this.psi = aim;
    this.boost = catchBonus ? 2.5 : 0;
    this.launchT = 0;
  }
  step(dt) {
    if (this.done) return;
    const s = this.s, w = this.air.at(this.p.x, this.p.y, this.p.z, this.t, this._w);
    const Vr = this.V / this.Vt;
    // 失速：速度が落ちると揚力が抜ける
    const cl = Vr < 0.5 ? clamp((Vr - 0.25) / 0.25) * 0.8 : 1;
    this.stall = cl < 0.95 ? Math.min(1, this.stall + dt * 2) : Math.max(0, this.stall - dt);
    const Lm = G * Vr * Vr * cl;
    const Dm = G * Vr * Vr / this.LD * (1 + Math.abs(this.phi) * 0.6) + (cl < 1 ? G * 0.25 : 0);
    // 入力とクセによるバンク
    const tgtPhi = clamp(this.input * 0.75 + s.bias * (0.6 + Vr * 0.4), -0.95, 0.95);
    this.phi += (tgtPhi - this.phi) * Math.min(1, dt * 2.6);
    this.V += (-Dm - G * Math.sin(this.gam)) * dt;
    this.V = Math.max(1.2, this.V);
    const gs = -Math.atan(1 / this.LD);
    let dg = (Lm * Math.cos(this.phi) - G * Math.cos(this.gam)) / this.V;
    dg -= s.damp * (this.gam - gs) * 0.9;
    // 不安定な機体はふらつく
    dg += (1 - s.stab) * Math.sin(this.t * 3.7 + s.A * 9) * 0.35;
    this.gam = clamp(this.gam + dg * dt, -1.35, 1.35);
    this.psi += Lm * Math.sin(this.phi) / (this.V * Math.max(0.3, Math.cos(this.gam))) * dt;
    const ch = Math.cos(this.gam);
    if (this.boost > 0) this.boost -= dt;
    const bx = this.boost > 0 ? this.air.wxv * 2.5 : 0, bz = this.boost > 0 ? this.air.wzv * 2.5 : 0;
    this.v.x = Math.sin(this.psi) * ch * this.V + w.x + bx;
    this.v.z = -Math.cos(this.psi) * ch * this.V + w.z + bz;
    this.v.y = Math.sin(this.gam) * this.V + w.y;
    this.p.x += this.v.x * dt; this.p.y += this.v.y * dt; this.p.z += this.v.z * dt;
    this.t += dt; this.age += dt;
    if (w.y > 1.2) this.thermalTime += dt;
    this.lift = w.y;
    this.maxY = Math.max(this.maxY, this.p.y);
    if (this.trace.length === 0 || this.age - this.trace[this.trace.length - 1][3] > 0.5) this.trace.push([this.p.x, this.p.y, this.p.z, this.age]);
    const gh = this.T.height(this.p.x, this.p.z);
    const ground = Math.max(gh, 0);
    this.maxAlt = Math.max(this.maxAlt, this.p.y - ground);
    if (this.p.y <= ground + 0.15 && this.age > 0.3) {
      this.p.y = ground + 0.15; this.done = true;
      this.landKind = gh < 0 ? 'sea' : this.T.kind(this.p.x, this.p.z);
    }
    if (this.age > 600) this.done = true;
  }
  get dist() { return Math.hypot(this.p.x, this.p.z); }
}

// 標準機・理想的な投げでの試算（おすすめ判定用）
export function estimate(shape, terrain, air) {
  const f = new Flight(shape, terrain, air);
  f.launch(0.85, 0, false);
  for (let i = 0; i < 12000 && !f.done; i++) f.step(0.05);
  return f.dist;
}
