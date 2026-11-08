// キャンバスで描く手続きテクスチャ（外部画像なし）
import * as THREE from 'three';
import { KIMONO_COLORS, OBI_COLORS } from './avatar.js';

const cache = new Map();
function tex(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.userData.redraw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  cache.set(key, t);
  return t;
}
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function flower(c, x, y, r, petal, center, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    c.rotate(Math.PI * 2 / 5);
    c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.36, r * 0.55, 0, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = center; c.beginPath(); c.arc(0, 0, r * 0.2, 0, Math.PI * 2); c.fill();
  c.restore();
}

// 着物：裾に向かって柄が濃くなる「裾模様」。v=0 が裾
export function kimonoTexture(colorId) {
  const col = KIMONO_COLORS[colorId];
  return tex('kimono-' + colorId, 1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, col.deep); g.addColorStop(0.45, col.base); g.addColorStop(1, col.base);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(7 + colorId.length);
    // 流水
    c.strokeStyle = col.accent + '55'; c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const y0 = h - 30 - i * 26; c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + Math.sin(x / 70 + i) * 10);
      c.stroke();
    }
    // 花（下ほど密）
    for (let i = 0; i < 150; i++) {
      const t = Math.pow(r(), 1.8), y = h - t * h * 0.9, x = r() * w;
      const s = 10 + r() * 22 * (1 - t * 0.6);
      const petal = r() < 0.5 ? col.accent : r() < 0.5 ? '#ffffff' : '#ffd0dc';
      flower(c, x, y, s, petal, '#e8b84a', r() * 6);
      if (x < 40) flower(c, x + w, y, s, petal, '#e8b84a');
    }
    // 金の霞
    c.fillStyle = '#e8c76a44';
    for (let i = 0; i < 14; i++) { const x = r() * w, y = h * (0.3 + r() * 0.5); c.fillRect(x, y, 80 + r() * 120, 10); }
  }, { repeat: true });
}

// 帯：金襴の亀甲・麻の葉
export function obiTexture(obiId, withMon = false) {
  const o = OBI_COLORS[obiId];
  return tex('obi-' + obiId + (withMon ? '-mon' : ''), 256, withMon ? 1024 : 256, (c, w, h) => {
    c.fillStyle = o.base; c.fillRect(0, 0, w, h);
    c.strokeStyle = o.line + 'aa'; c.lineWidth = 2;
    const s = 32;
    for (let y = -s; y < h + s; y += s * 0.866) {
      for (let x = -s; x < w + s; x += s * 1.5) {
        const ox = (Math.round(y / (s * 0.866)) % 2) * s * 0.75;
        c.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; c.lineTo(x + ox + Math.cos(a) * s * 0.48, y + Math.sin(a) * s * 0.48); }
        c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(x + ox - s * 0.24, y); c.lineTo(x + ox + s * 0.24, y); c.stroke();
      }
    }
    c.fillStyle = o.line + '55'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
    if (withMon) {
      // 帯の先に入るオリジナルの紋（五弁花の丸紋）
      const cx = w / 2, cy = h - 150;
      c.fillStyle = o.mon; c.beginPath(); c.arc(cx, cy, 70, 0, Math.PI * 2); c.fill();
      c.fillStyle = o.base; c.beginPath(); c.arc(cx, cy, 60, 0, Math.PI * 2); c.fill();
      flower(c, cx, cy, 52, o.mon, o.base);
      c.fillStyle = o.line; c.fillRect(0, h - 40, w, 6);
    }
  }, { repeat: !withMon });
}

// 顔：球のUVで u=0.75 が正面（-Z）
export function faceTexture() {
  return tex('face', 1024, 512, (c, w, h) => {
    c.fillStyle = '#fbf3ee'; c.fillRect(0, 0, w, h);
    const cx = w * 0.75, cy = h * 0.53;
    // 頬紅
    const blush = (x) => { const g = c.createRadialGradient(x, cy + 34, 2, x, cy + 34, 36); g.addColorStop(0, '#f2a3a688'); g.addColorStop(1, '#f2a3a600'); c.fillStyle = g; c.fillRect(x - 40, cy - 10, 80, 90); };
    blush(cx - 70); blush(cx + 70);
    // 目元の紅
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 46;
      const g = c.createRadialGradient(ex + sx * 12, cy - 6, 2, ex + sx * 12, cy - 6, 30); g.addColorStop(0, '#e0465a99'); g.addColorStop(1, '#e0465a00');
      c.fillStyle = g; c.fillRect(ex - 40, cy - 40, 80, 60);
      // 目（伏し目の弧）
      c.strokeStyle = '#1b1416'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - sx * 24, cy - 2); c.quadraticCurveTo(ex, cy + 10, ex + sx * 26, cy - 8); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(ex + sx * 22, cy - 6); c.lineTo(ex + sx * 32, cy - 14); c.stroke();
      // 眉
      c.strokeStyle = '#3b2a2c'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(ex - sx * 18, cy - 44); c.quadraticCurveTo(ex + sx * 4, cy - 54, ex + sx * 24, cy - 46); c.stroke();
    }
    // 唇（下唇に紅）
    c.fillStyle = '#c8102e'; c.beginPath(); c.ellipse(cx, cy + 70, 13, 7, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#d9465c'; c.beginPath(); c.ellipse(cx, cy + 69, 9, 3, 0, Math.PI, Math.PI * 2); c.fill();
  });
}

export function kanokoTexture() {
  return tex('kanoko', 128, 128, (c, w, h) => {
    c.fillStyle = '#d0102c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd9df';
    for (let y = 4; y < h; y += 12) for (let x = (y / 12 % 2) * 6 + 3; x < w; x += 12) c.fillRect(x, y, 4, 4);
  }, { repeat: true });
}

export function woodTexture() {
  return tex('wood', 1024, 1024, (c, w, h) => {
    const r = rng(42);
    const plank = 64;
    for (let x = 0; x < w; x += plank) {
      const tone = 196 + r() * 26;
      c.fillStyle = `rgb(${tone},${tone * 0.78 | 0},${tone * 0.52 | 0})`; c.fillRect(x, 0, plank, h);
      for (let i = 0; i < 16; i++) {
        c.strokeStyle = `rgba(120,70,30,${0.06 + r() * 0.12})`; c.lineWidth = 1 + r() * 2;
        const ox = x + r() * plank; c.beginPath();
        for (let y = 0; y <= h; y += 16) c.lineTo(ox + Math.sin(y / (60 + r() * 30) + i) * 3, y);
        c.stroke();
      }
      c.fillStyle = 'rgba(70,40,20,.45)'; c.fillRect(x, 0, 2, h);
      const cut = r() * h; c.fillRect(x, cut, plank, 2);
    }
  }, { repeat: true });
}

export function lanternTexture() {
  return tex('lantern', 512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff6a3c'); g.addColorStop(0.5, '#ffb070'); g.addColorStop(1, '#ff6a3c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a3311b66'; c.lineWidth = 3;
    for (let y = 12; y < h; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#2a0d08'; c.font = '900 150px "Dela Gothic One","Hiragino Mincho ProN",serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('舞', w * 0.25, h * 0.54); c.fillText('舞', w * 0.75, h * 0.54);
  });
}

export function radialTexture(key, inner, outer) {
  return tex('radial-' + key, 128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

export function petalTexture() {
  return tex('petal', 64, 64, (c) => {
    c.fillStyle = '#ffd6e0'; c.beginPath(); c.ellipse(32, 32, 14, 24, 0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff99'; c.beginPath(); c.ellipse(28, 26, 5, 10, 0.4, 0, Math.PI * 2); c.fill();
  });
}

export function streakTexture() {
  return tex('streak', 512, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 40; i++) {
      const y = r() * h, x = r() * w, l = 40 + r() * 200;
      const g = c.createLinearGradient(x, 0, x + l, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.2 + r() * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x, y, l, 1 + r() * 3);
    }
  }, { repeat: true });
}

export function fanTexture() {
  return tex('fan', 512, 256, (c, w, h) => {
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f4d27a'); g.addColorStop(0.55, '#f4d27a00');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7a0a1a55'; c.lineWidth = 2;
    for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    flower(c, w * 0.3, h * 0.35, 40, '#ffffff', '#f4d27a'); flower(c, w * 0.7, h * 0.25, 28, '#ffe3ea', '#f4d27a');
  });
}
