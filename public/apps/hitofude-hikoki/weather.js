// 8地方の発射地点と、Open-Meteo（https://open-meteo.com/）の実況
import { analyze, PRESETS, makeAir, estimate, isWet } from './plane.js';
import { makeTerrain } from './terrain.js';

// heading＝投げる方角（北=0、東=90、度）
export const SPOTS = [
  { id: 'hakodate', region: 'hokkaido', lat: 41.7594, lon: 140.7044, heading: 340, elev: 334 },
  { id: 'sendai', region: 'tohoku', lat: 38.2527, lon: 140.8562, heading: 90, elev: 130 },
  { id: 'takao', region: 'kanto', lat: 35.6251, lon: 139.2437, heading: 85, elev: 599 },
  { id: 'nihondaira', region: 'chubu', lat: 34.9706, lon: 138.4644, heading: 45, elev: 307 },
  { id: 'maya', region: 'kinki', lat: 34.7337, lon: 135.2088, heading: 170, elev: 702 },
  { id: 'onomichi', region: 'chugoku', lat: 34.4105, lon: 133.1985, heading: 170, elev: 144 },
  { id: 'yashima', region: 'shikoku', lat: 34.3577, lon: 134.1008, heading: 315, elev: 292 },
  { id: 'inasa', region: 'kyushu', lat: 32.7547, lon: 129.8577, heading: 110, elev: 333 },
];

const API = 'https://api.open-meteo.com/v1/forecast';
const CURRENT = 'temperature_2m,is_day,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m';

export async function fetchWeather(timeoutMs = 7000) {
  const u = new URL(API);
  u.searchParams.set('latitude', SPOTS.map(s => s.lat).join(','));
  u.searchParams.set('longitude', SPOTS.map(s => s.lon).join(','));
  u.searchParams.set('current', CURRENT);
  u.searchParams.set('wind_speed_unit', 'ms');
  u.searchParams.set('timezone', 'Asia/Tokyo');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(u.href, { signal: ctl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    let js = await res.json(); if (!Array.isArray(js)) js = [js];
    return SPOTS.map((s, i) => {
      const c = js[i] && js[i].current; if (!c) throw new Error('no current');
      return {
        live: true, time: c.time, ws: +c.wind_speed_10m || 0, wd: +c.wind_direction_10m || 0, gust: Math.max(+c.wind_gusts_10m || 0, +c.wind_speed_10m || 0),
        code: +c.weather_code || 0, isDay: !!c.is_day, cloud: +c.cloud_cover || 0, temp: +c.temperature_2m, elev: js[i].elevation,
      };
    });
  } finally { clearTimeout(tm); }
}

// 取得できない時の仮の天気（時刻で変わる）
export function fallbackWeather(now = new Date()) {
  const hr = now.getHours(), seed = now.getFullYear() * 1e4 + (now.getMonth() + 1) * 100 + now.getDate() + hr * 0.01;
  const rnd = (k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const day = hr >= 6 && hr < 17;
  return SPOTS.map((s, i) => {
    const ws = 1 + rnd(i) * 6;
    return { live: false, time: '', ws, wd: rnd(i + 20) * 360, gust: ws * (1.3 + rnd(i + 40) * 0.6), code: rnd(i + 60) < 0.15 ? 61 : rnd(i + 70) < 0.5 ? 1 : 3, isDay: day, cloud: rnd(i + 80) * 100, temp: 14, elev: s.elev };
  });
}

// 標準機（ダート）で試算し、静穏時との比でおすすめを付ける
const STD = analyze(PRESETS.dart);
const calm = { ws: 0, wd: 0, gust: 0, code: 1, isDay: false, cloud: 50 };
const parCache = {};
export function parOf(id) {
  if (parCache[id]) return parCache[id];
  const spot = SPOTS.find(s => s.id === id), T = makeTerrain(id);
  return (parCache[id] = estimate(STD, T, makeAir(calm, T, spot.heading)));
}
export function rateSpots(wxList) {
  const rows = SPOTS.map((spot, i) => {
    const wx = wxList[i], T = makeTerrain(spot.id), air = makeAir(wx, T, spot.heading);
    const ratio = estimate(STD, T, air) / parOf(spot.id);
    const tail = air.tail;
    let reason = null;
    if (isWet(wx.code)) reason = 'wet';
    else if (tail > 1.6) reason = 'tail';
    else if (air.thermal > 1.5) reason = 'thermal';
    else if (tail < -2.5) reason = 'ridge';
    return { spot, wx, ratio, tail, thermal: air.thermal, reason };
  });
  const sorted = rows.slice().sort((a, b) => b.ratio - a.ratio);
  sorted.forEach((r, k) => { r.recommend = k < 2 && r.ratio > 1.06 && r.reason !== 'wet'; });
  return rows;
}

// WMOコード → 天気の種類
export function wxKind(code) {
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 2) return 'cloud';
  return 'clear';
}
// 16方位
export const DIR16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const dir16 = (deg) => DIR16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
