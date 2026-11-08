// 身支度（アバター）定義と性能計算。見た目の選択がそのまま回転バトルの性能になる。
export const CATEGORIES = [
  { key: 'height', options: [
    { id: 'small', d: { weight: -12, balance: 12, speed: 10 } },
    { id: 'mid', d: {} },
    { id: 'tall', d: { weight: 14, balance: -10, spin: 6, speed: -6 } },
  ] },
  { key: 'hem', options: [
    { id: 'narrow', d: { speed: 8, weight: -4, balance: -6 } },
    { id: 'mid', d: {} },
    { id: 'wide', d: { balance: 10, weight: 6, speed: -8 } },
  ] },
  { key: 'okobo', options: [
    { id: 'low', d: { balance: 8, crit: -6 } },
    { id: 'mid', d: {} },
    { id: 'high', d: { balance: -10, crit: 14, spin: 4 } },
  ] },
  { key: 'kanzashi', options: [
    { id: 'hana', d: { crit: 10 } },
    { id: 'cho', d: { spin: 10 } },
    { id: 'bekko', d: { weight: 8, balance: 4 } },
    { id: 'none', d: { speed: 6 } },
  ] },
  { key: 'obi', options: [
    { id: 'kin', d: { spin: 6 } },
    { id: 'beni', d: { crit: 4, speed: 4 } },
    { id: 'ai', d: { balance: 6 } },
    { id: 'gin', d: { weight: 4, spin: 2 } },
  ] },
  { key: 'item', options: [
    { id: 'sensu', d: { crit: 8, speed: 2 } },
    { id: 'kasa', d: { balance: 8, spin: 8, speed: -10 } },
    { id: 'kinchaku', d: { weight: 10, speed: -2 } },
    { id: 'none', d: { speed: 8 } },
  ] },
  { key: 'color', options: [
    { id: 'sakura', d: {} }, { id: 'fuji', d: {} }, { id: 'wakatake', d: {} },
    { id: 'momiji', d: {} }, { id: 'asagi', d: {} }, { id: 'sumi', d: {} },
  ] },
];

export const STAT_KEYS = ['spin', 'weight', 'balance', 'crit', 'speed'];
const BASE = { spin: 50, weight: 50, balance: 50, crit: 30, speed: 50 };

export const KIMONO_COLORS = {
  sakura: { base: '#f3b6c4', deep: '#d9708a', accent: '#fff3f5' },
  fuji: { base: '#a99ad8', deep: '#6c5aa8', accent: '#f1ecff' },
  wakatake: { base: '#8fcf9a', deep: '#3f8f5c', accent: '#f0fff1' },
  momiji: { base: '#e2553f', deep: '#9e2a1f', accent: '#ffd9a8' },
  asagi: { base: '#5fc3cf', deep: '#1f7f93', accent: '#e9fdff' },
  sumi: { base: '#2c2f3a', deep: '#14161d', accent: '#d9b25a' },
};
export const OBI_COLORS = {
  kin: { base: '#d8a93a', line: '#fff0b8', mon: '#8a5a12' },
  beni: { base: '#c41e3a', line: '#ffcf6a', mon: '#ffe6a8' },
  ai: { base: '#1f3a6e', line: '#9fc4ff', mon: '#e8d38a' },
  gin: { base: '#d7dbe2', line: '#ffffff', mon: '#8c95a6' },
};

export const DEFAULT_LOOK = { height: 'mid', hem: 'mid', okobo: 'mid', kanzashi: 'hana', obi: 'kin', item: 'sensu', color: 'sakura' };

export function sanitizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  for (const c of CATEGORIES) if (look && c.options.some(o => o.id === look[c.key])) out[c.key] = look[c.key];
  return out;
}

export function computeStats(look) {
  const s = { ...BASE };
  for (const c of CATEGORIES) {
    const o = c.options.find(x => x.id === look[c.key]);
    if (o) for (const k in o.d) s[k] += o.d[k];
  }
  for (const k of STAT_KEYS) s[k] = Math.max(5, Math.min(100, s[k]));
  return s;
}

export function bodyScale(look) {
  return {
    height: look.height === 'small' ? 0.88 : look.height === 'tall' ? 1.12 : 1,
    hem: look.hem === 'narrow' ? 0.86 : look.hem === 'wide' ? 1.16 : 1,
    okobo: look.okobo === 'low' ? 0.05 : look.okobo === 'high' ? 0.13 : 0.09,
  };
}

// 物理パラメータ。数値は試合が25〜40秒で決着するように調整。
export function physicsFor(look) {
  const s = computeStats(look), b = bodyScale(look);
  return {
    mass: 1 + s.weight / 100 * 1.2,
    radius: 0.36 * b.hem * (0.6 + 0.4 * b.height),
    omegaMax: 62 + s.spin * 0.42,
    decay: 2.1 * (1.25 - s.spin * 0.005),
    wobbleOmega: 24 * (1.15 - s.balance * 0.006),
    wobbleGain: 1.15 - s.balance * 0.007,
    crit: 0.06 + s.crit * 0.0042,
    launch: 1.5 + s.speed * 0.018,
    dash: (2.3 + s.speed * 0.02) * (look.item === 'sensu' ? 1.18 : 1),
    stats: s,
  };
}

export const NPC_NAMES = [
  ['小梅', 'Koume'], ['豆千代', 'Mamechiyo'], ['菊ふく', 'Kikufuku'], ['桃若', 'Momowaka'],
  ['鈴音', 'Suzune'], ['市香', 'Ichika'], ['葉月', 'Hazuki'], ['千鶴', 'Chizuru'], ['紗月', 'Satsuki'], ['乃々葉', 'Nonoha'],
];

export function randomLook(rng = Math.random) {
  const look = {};
  for (const c of CATEGORIES) look[c.key] = c.options[Math.floor(rng() * c.options.length)].id;
  return look;
}
