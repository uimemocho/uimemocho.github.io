// 地形（THREE非依存）。発射地点は原点、投げる向きは -Z。d = -z が前方距離。
const fract = (x) => x - Math.floor(x);
export const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 地点ごとの地形。H=眼下の街との高低差（m）、R=山すその広がり
export const PROFILES = {
  hakodate: { H: 300, R: 900, base: 6, sea: (x, d) => Math.abs(x) > 820 + Math.max(0, d - 3600) * 0.9 + (fbm(d * 0.004, 3) - 0.5) * 260, town: 1 },
  sendai: { H: 110, R: 520, base: 40, river: { d: 300, w: 70 }, sea: () => false, town: 1 },
  takao: { H: 400, R: 1500, base: 190, forestUntil: 2300, sea: () => false, town: 0.8, ridges: 1 },
  nihondaira: { H: 290, R: 1000, base: 8, sea: (x, d) => x > 760 - d * 0.05 + (fbm(d * 0.003, 7) - 0.5) * 300 || d > 9000, town: 0.7, fuji: true },
  maya: { H: 690, R: 2300, base: 20, sea: (x, d) => d > 4300 + (fbm(x * 0.002, 1) - 0.5) * 300 && !(d > 4900 && d < 5700 && Math.abs(x - 300) < 700), town: 1.2 },
  onomichi: { H: 135, R: 460, base: 6, sea: (x, d) => d > 560 + (fbm(x * 0.004, 2) - 0.5) * 60 && d < 930 + (fbm(x * 0.003, 9) - 0.5) * 120, town: 1.1, island: 1 },
  yashima: { H: 285, R: 680, base: 4, sea: (x, d) => d > 720 && !(x < -700 + d * 0.15 && d < 3200) && !isle(x, d), town: 0.8 },
  inasa: { H: 320, R: 1000, base: 8, sea: (x, d) => d > 1450 + (fbm(x * 0.003, 4) - 0.5) * 160 && d < 2100 + (fbm(x * 0.002, 5) - 0.5) * 220, town: 1.1, hillsAfter: 3400 },
};
function isle(x, d) {
  // 瀬戸内の小島
  const cx = Math.floor(x / 1400), cd = Math.floor(d / 1400);
  const r = hash2(cx + 31, cd + 7);
  if (r < 0.45) return false;
  const ox = (cx + 0.2 + hash2(cx, cd) * 0.6) * 1400, od = (cd + 0.2 + hash2(cd, cx) * 0.6) * 1400;
  return Math.hypot(x - ox, d - od) < 180 + r * 260;
}
const isleH = (x, d) => {
  const cx = Math.floor(x / 1400), cd = Math.floor(d / 1400);
  const r = hash2(cx + 31, cd + 7); if (r < 0.45) return 0;
  const ox = (cx + 0.2 + hash2(cx, cd) * 0.6) * 1400, od = (cd + 0.2 + hash2(cd, cx) * 0.6) * 1400;
  const k = 1 - Math.hypot(x - ox, d - od) / (180 + r * 260);
  return k > 0 ? k * k * (40 + r * 120) : 0;
};

export function makeTerrain(spotId) {
  const P = PROFILES[spotId] || PROFILES.hakodate;
  const hillCenterD = -P.R * 0.12;
  function hill(x, d) {
    const r = Math.hypot(x * 0.85, d - hillCenterD) / P.R;
    const core = 0.5 * Math.exp(-r * r * 2.3) + 0.5 * Math.exp(-r * 3.2);
    const plateau = 1 - sstep(0, 0.05, r) * 0.04;
    return P.H * core * plateau + (P.ridges ? (fbm(x * 0.003, d * 0.003) - 0.5) * 160 * (1 - core) * sstep(0, 2200, P.forestUntil - d) : 0);
  }
  function kindAt(x, d) {
    if (P.sea(x, d)) return 0; // sea
    if (P.river && Math.abs(d - P.river.d - (fbm(x * 0.004, 11) - 0.5) * 120) < P.river.w * 0.5) return 4; // river
    const r = Math.hypot(x * 0.85, d - hillCenterD) / P.R;
    if (r < 0.04) return 5; // 展望台
    if (r < 0.62 || (P.forestUntil && d < P.forestUntil)) return 2; // forest
    const tn = fbm(x * 0.0016 + 3, d * 0.0016) * P.town;
    if (tn > 0.36) return 1; // town
    return 3; // field
  }
  function height(x, z) {
    const d = -z;
    const k = kindAt(x, d);
    const land = P.base + (fbm(x * 0.0022, d * 0.0022) - 0.5) * 26 + (P.hillsAfter ? sstep(P.hillsAfter, P.hillsAfter + 2500, d) * fbm(x * 0.002 + 5, d * 0.002) * 260 : 0);
    let h = Math.max(land, hill(x, d) + P.base * 0.6);
    if (P.island && d > 930) h = Math.max(h, P.base + fbm(x * 0.003, d * 0.003) * 90 * sstep(930, 1300, d));
    if (k === 0) {
      // 海岸線のなめらかな落ち込み
      return -6 + Math.max(0, isleH(x, d) - 6);
    }
    if (k === 4) return Math.min(h, P.base - 4);
    if (k === 1) h = P.base + (h - P.base) * 0.55 + 2;
    return h;
  }
  const T = {
    P, height, kind: (x, z) => kindAt(x, -z),
    top: 0,
  };
  T.top = height(0, 0); // 展望台の高さ
  // 30m区画ごとの建物・家（描画と当たり判定で共有）
  const cells = new Map();
  T.structs = (gx, gz) => {
    const key = gx * 100003 + gz; let v = cells.get(key); if (v !== undefined) return v;
    if (cells.size > 30000) cells.clear();
    v = null;
    const C = 30, x = (gx + 0.5) * C, z = (gz + 0.5) * C;
    const mid = hash2(gx * 2.7 + 1, gz * 1.9 + 4);
    if (kindAt(x, -z) === 1 && mid >= 0.09) {
      const r = hash2(gx * 1.3, gz * 0.7), core = fbm(x * 0.0009 + 9, z * 0.0009, 2) * (P.town || 1);
      if ((core > 0.38 && r < 0.62) || mid > 0.9) {
        const h = core > 0.38 && r < 0.62 ? 10 + Math.pow(hash2(gz, gx), 3) * 30 + Math.max(0, core - 0.42) * 240 * hash2(gx + 3, gz) : 12 + hash2(gz, gx) * 14;
        v = { tall: true, list: [{ x, z, w: 11 + hash2(gx + 7, gz) * 9, d: 11 + hash2(gx, gz + 7) * 9, h, y: height(x, z) - 1 }] };
      } else {
        const gap = 0.06 + fbm(x * 0.004 + 3, z * 0.004, 2) * 0.5, list = [];
        for (let q = 0; q < 4; q++) {
          const hx = hash2(gx * 3.1 + q, gz * 1.7), hz = hash2(gz * 2.3 + q, gx * 0.9); if (hx < gap) continue;
          const px = x + ((q & 1) - 0.5) * 11.5 + (hz - 0.5) * 2, pz = z + ((q >> 1) - 0.5) * 11.5 + (hx - 0.5) * 2;
          list.push({ x: px, z: pz, w: 6 + hz * 4, d: 6 + hash2(hx * 5, hz * 3) * 4, h: 5.5 + hash2(hx * 9, hz * 9) * 4.5, y: height(px, pz) - 0.6, hx, hz });
        }
        v = { tall: false, list };
      }
    }
    cells.set(key, v); return v;
  };
  return T;
}
