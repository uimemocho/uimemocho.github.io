// リザルト画像・X投稿・挑戦状URL
import { t } from './i18n.js';
import { resample } from './plane.js';
export const GAME_URL = 'https://uimemocho.github.io/apps/hitofude-hikoki/';
const TAGS = '#一筆飛行機 #ゲーム開発 #個人開発 #gamedev';

// 機体の形 ⇄ 文字列
export function encodeShape(pts) {
  const r = resample(pts, 40), b = new Uint8Array(80);
  r.forEach((p, i) => { b[i * 2] = Math.round((Math.max(-1, Math.min(1, p[0])) + 1) * 127.5); b[i * 2 + 1] = Math.round((Math.max(-1, Math.min(1, p[1])) + 1) * 127.5); });
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShape(s) {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); if (bin.length < 16) return null;
    const pts = []; for (let i = 0; i + 1 < bin.length; i += 2) pts.push([bin.charCodeAt(i) / 127.5 - 1, bin.charCodeAt(i + 1) / 127.5 - 1]);
    return pts;
  } catch { return null; }
}
export const challengeUrl = (pts) => GAME_URL + '?p=' + encodeShape(pts);

export function shareText(r) {
  return t('shareText', { spot: t('p.' + r.spot), dist: r.dist.toLocaleString('en-US'), rank: r.rank.grade, title: t('r.' + r.rank.grade), type: t('t.' + r.type), wind: r.windText, time: r.timeText }) + '\n' + TAGS;
}

export async function ensureFonts(sample) {
  const fams = ['400 40px "Dela Gothic One"', '700 22px "Zen Kaku Gothic New"', '500 16px "Zen Kaku Gothic New"', '400 30px Oswald', '600 60px Oswald'];
  try { await Promise.all(fams.map(f => document.fonts.load(f, sample))); } catch {}
}

// 紙に描いた機体（投稿画像・記録用）
export function paperImage(pts, size = 512, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d');
  c.fillStyle = opts.bg || '#f6f2e8'; c.fillRect(0, 0, size, size);
  c.strokeStyle = 'rgba(70,110,170,.16)'; c.lineWidth = 1;
  for (let i = 1; i < 16; i++) { const p = i * size / 16; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, size); c.moveTo(0, p); c.lineTo(size, p); c.stroke(); }
  c.strokeStyle = 'rgba(255,77,94,.35)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(size / 2, 0); c.lineTo(size / 2, size); c.stroke(); c.setLineDash([]);
  if (pts && pts.length > 2) {
    const P = (p) => [(p[0] + 1) / 2 * size, (1 - p[1]) / 2 * size];
    c.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
    c.fillStyle = opts.fill || 'rgba(255,255,255,.92)'; c.fill();
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = opts.ink || '#1a2740'; c.lineWidth = size / 90; c.stroke();
  }
  return cv;
}

export function makeResultCard({ scene, r, pts }) {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const sw = scene.width, sh = scene.height, ta = W / H;
  let cw = sw, ch = sw / ta; if (ch > sh) { ch = sh; cw = sh * ta; }
  c.drawImage(scene, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#0e1a2bf5'); g.addColorStop(0.46, '#0e1a2bd8'); g.addColorStop(0.72, '#0e1a2b40'); g.addColorStop(1, '#0e1a2b10');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fit = (text, font, max, min, width) => { let s = max; while (s > min) { c.font = font.replace('$', s); if (c.measureText(text).width <= width) break; s--; } return s; };
  const disp = '"Dela Gothic One",sans-serif', body = '"Zen Kaku Gothic New",sans-serif', num = 'Oswald,sans-serif';
  c.textBaseline = 'alphabetic';
  // ロゴ
  c.fillStyle = '#ffd60a'; c.fillRect(60, 50, 6, 24);
  c.font = `500 22px ${num}`; c.fillStyle = '#d6dfec'; c.fillText('ONE-STROKE PLANE', 80, 71);
  c.save(); c.transform(1, 0, -0.12, 1, 0, 0);
  c.font = `400 64px ${disp}`; c.fillStyle = '#fff'; c.fillText('一筆', 76, 150); const x0 = 76 + c.measureText('一筆').width;
  c.fillStyle = '#ffd60a'; c.fillText('飛行機', x0 + 4, 150);
  c.restore();
  // 場所と飛距離
  fit(t('from', { spot: t('p.' + r.spot) }), `700 $px ${body}`, 28, 16, 480); c.fillStyle = '#fff'; c.fillText(t('from', { spot: t('p.' + r.spot) }), 64, 214);
  c.save(); c.transform(1, 0, -0.12, 1, 30, 0);
  c.font = `600 132px ${num}`; c.fillStyle = '#ffd60a'; const ds = r.dist.toLocaleString('en-US'); fit(ds, `600 $px ${num}`, 132, 70, 400); c.fillText(ds, 60, 350); const dw = c.measureText(ds).width;
  c.font = `400 44px ${num}`; c.fillStyle = '#fff'; c.fillText('m', 70 + dw, 350);
  c.restore();
  fit(t('land_' + r.land), `700 $px ${body}`, 22, 14, 470); c.fillStyle = '#d6dfec'; c.fillText(t('land_' + r.land), 64, 392);
  c.fillStyle = '#ffffff40'; c.fillRect(64, 414, 440, 1);
  // ランク
  c.font = `400 18px ${num}`; c.fillStyle = '#d6dfec'; c.fillText('RANK', 66, 448);
  c.save(); c.transform(1, 0, -0.14, 1, 70, 0);
  c.font = `600 120px ${num}`;
  if (r.rank.grade === 'SSS') { const gg = c.createLinearGradient(0, 450, 300, 560); gg.addColorStop(0, '#fff8d8'); gg.addColorStop(0.5, '#ffe37d'); gg.addColorStop(1, '#ff9a4d'); c.fillStyle = gg; }
  else c.fillStyle = r.rank.idx <= 1 ? '#d6dfec' : '#ffd60a';
  c.fillText(r.rank.grade, 64, 566); const rw = c.measureText(r.rank.grade).width; c.restore();
  fit(t('r.' + r.rank.grade), `400 $px ${disp}`, 30, 16, Math.max(120, 430 - rw)); c.fillStyle = '#fff'; c.fillText(t('r.' + r.rank.grade), 64 + rw + 40, 556);
  // 機体（紙）
  const paper = paperImage(pts, 360);
  c.save(); c.translate(905, 300); c.rotate(-0.06);
  c.fillStyle = '#0006'; c.fillRect(-170, -160, 360, 360);
  c.drawImage(paper, -180, -180, 360, 360);
  c.restore();
  c.save(); c.translate(905, 512); c.rotate(-0.06);
  c.fillStyle = '#ffd60a'; const tt = t('t.' + r.type); c.font = `400 26px ${disp}`; const tw = c.measureText(tt).width;
  c.fillRect(-tw / 2 - 16, -26, tw + 32, 40); c.fillStyle = '#0e1a2b'; c.textAlign = 'center'; c.fillText(tt, 0, 4);
  c.restore();
  // 下帯
  c.textAlign = 'left';
  c.fillStyle = '#0e1a2bf0'; c.fillRect(0, 596, W, 79); c.fillStyle = '#ffd60a'; c.fillRect(60, 596, 80, 3);
  const col = (label, val, unit, x) => {
    c.font = `700 15px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(label, x, 624);
    c.font = `400 30px ${num}`; c.fillStyle = '#fff'; c.fillText(val, x, 660); const w = c.measureText(val).width;
    c.font = `500 14px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(unit, x + w + 6, 658);
  };
  col(t('airtime'), r.air.toFixed(1), t('sec'), 64); col(t('maxAlt'), String(r.maxAlt), 'm', 230);
  c.font = `700 15px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(t('windAt'), 400, 624);
  fit(r.windText + '  ' + r.timeText, `700 $px ${body}`, 22, 13, 380); c.fillStyle = '#fff'; c.fillText(r.windText + '  ' + r.timeText, 400, 657);
  c.textAlign = 'right'; c.font = `400 17px ${num}`; c.fillStyle = '#9fb0c6'; c.fillText('uimemocho.github.io/apps/hitofude-hikoki', W - 40, 658);
  return cv;
}

// claude.ai のアーティファクトなど、ダウンロードや共有が使えない場所
export const sandboxed = !/(^|\.)uimemocho\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
export function intentUrl(r, url) { const u = new URL('https://x.com/intent/post'); u.searchParams.set('text', shareText(r)); u.searchParams.set('url', url); return u.href; }
export async function shareResult(card, r, url, onSaved) {
  const text = shareText(r);
  const blob = await new Promise(res => card.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'hitofude-hikoki.png', { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iP|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], text: text + '\n' + url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hitofude-hikoki.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); onSaved && onSaved(); }
  const u = new URL('https://x.com/intent/post'); u.searchParams.set('text', text); u.searchParams.set('url', url);
  window.open(u.href, '_blank', 'noopener');
}
