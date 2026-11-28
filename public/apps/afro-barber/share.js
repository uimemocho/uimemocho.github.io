// リザルト画像・X投稿
import { t } from './i18n.js';
export const GAME_URL = 'https://uimemocho.github.io/apps/afro-barber/';
const TAGS = '#アフロバーバー #ゲーム開発 #個人開発 #gamedev';

export function shareText(r) {
  return t('shareText', { style: t('s.' + r.style), p: Math.round(r.sat), rank: r.rank.grade, title: t('r.' + r.rank.grade) }) + '\n' + TAGS;
}
export async function ensureFonts(extra = '') {
  const fams = ['400 40px "Dela Gothic One"', '500 22px "Zen Kaku Gothic New"', '700 22px "Zen Kaku Gothic New"', '900 22px "Zen Kaku Gothic New"', '400 30px Oswald', '600 60px Oswald'];
  const txt = 'AFROBARBER0123456789%.,' + t('tA') + t('tB') + t('sub') + extra;
  try { await Promise.all(fams.map(f => document.fonts.load(f, txt))); } catch {}
}
export function makeResultCard(shot, r) {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#f6f8fb'); bg.addColorStop(1, '#e3e9f0'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const sp = c.createRadialGradient(890, 300, 20, 890, 330, 420); sp.addColorStop(0, '#ffffff'); sp.addColorStop(1, '#ffffff00'); c.fillStyle = sp; c.fillRect(0, 0, W, H);
  c.drawImage(shot, 575, -10, 620, 620);
  const fit = (text, font, max, min, width) => { let s = max; while (s > min) { c.font = font.replace('$', s); if (c.measureText(text).width <= width) break; s--; } return s; };
  const disp = '"Dela Gothic One",sans-serif', body = '"Zen Kaku Gothic New",sans-serif', num = 'Oswald,sans-serif';
  // バーバーポールの帯
  const pole = (x, y, w, h) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); const cols = ['#e3262f', '#ffffff', '#2d5fd3', '#ffffff'], ws = [9, 6, 9, 6]; let q = 0; for (let p = x - h - 40; p < x + w + 40; ) { c.fillStyle = cols[q % 4]; c.beginPath(); c.moveTo(p, y + h); c.lineTo(p + h, y); c.lineTo(p + h + ws[q % 4], y); c.lineTo(p + ws[q % 4], y + h); c.closePath(); c.fill(); p += ws[q % 4]; q++; } c.restore(); };
  pole(0, 0, 10, H); pole(W - 10, 0, 10, H);
  c.fillStyle = '#e3262f'; c.fillRect(60, 48, 6, 24);
  c.font = `500 20px ${num}`; c.fillStyle = '#5d6b80'; c.fillText(t('sub'), 80, 68);
  // タイトル（1行）
  c.save(); c.transform(1, 0, -0.12, 1, 0, 0);
  const tA = t('tA'), tB = t('tB'), gap = /[a-zа-я가-힣]/i.test(tA) ? 0.25 : 0;
  fit(tA + tB + (gap ? ' ' : ''), `400 $px ${disp}`, 60, 26, 480);
  const fs = parseInt(c.font, 10);
  c.fillStyle = '#16233a'; c.fillText(tA, 76, 134); const x0 = 76 + c.measureText(tA).width + fs * gap;
  { let xx = x0; [...tB].forEach((ch, i) => { c.fillStyle = i % 2 ? '#5b8cff' : '#ff4d57'; c.fillText(ch, xx, 134); xx += c.measureText(ch).width; }); }
  c.restore();
  // 見出しとスタイル名
  fit(t('lead'), `700 $px ${body}`, 24, 14, 480); c.fillStyle = '#16233a'; c.fillText(t('lead'), 64, 196);
  const sn = t('s.' + r.style);
  c.save(); c.transform(1, 0, -0.1, 1, 28, 0);
  fit(sn, `900 $px ${body}`, 58, 24, 470); c.fillStyle = '#ff4d57'; c.fillText(sn, 56, 262); c.restore();
  // 満足度
  c.font = `700 15px ${body}`; c.fillStyle = '#5d6b80'; c.fillText(t('satLabel'), 64, 306);
  c.save(); c.transform(1, 0, -0.12, 1, 40, 0);
  const p = String(Math.round(r.sat)); c.font = `600 104px ${num}`; c.fillStyle = '#16233a'; c.fillText(p, 56, 404); const pw = c.measureText(p).width;
  c.font = `400 40px ${num}`; c.fillStyle = '#ff4d57'; c.fillText('%', 66 + pw, 404);
  c.restore();
  // ランク
  c.font = `400 16px ${num}`; c.fillStyle = '#5d6b80'; c.fillText('RANK', 300, 330);
  c.save(); c.transform(1, 0, -0.14, 1, 60, 0);
  c.font = `600 96px ${num}`;
  if (r.rank.grade === 'SSS') { const gg = c.createLinearGradient(300, 330, 520, 410); gg.addColorStop(0, '#e0a100'); gg.addColorStop(0.5, '#ff8a00'); gg.addColorStop(1, '#ff4d57'); c.fillStyle = gg; }
  else c.fillStyle = r.rank.idx <= 1 ? '#8a96a8' : '#ff4d57';
  c.fillText(r.rank.grade, 296, 412); c.restore();
  fit(t('r.' + r.rank.grade), `900 $px ${body}`, 24, 13, 240); c.fillStyle = '#16233a'; c.fillText(t('r.' + r.rank.grade), 300, 446);
  // お客さんのひとこと
  const q = r.quote;
  c.save(); c.transform(1, 0, -0.06, 1, 30, 0);
  fit(q, `900 $px ${body}`, 22, 12, 440);
  const qw = c.measureText(q).width;
  c.fillStyle = '#16233a'; c.fillRect(58, 474, qw + 36, 52);
  c.beginPath(); c.moveTo(84, 526); c.lineTo(100, 526); c.lineTo(80, 542); c.closePath(); c.fill();
  c.fillStyle = '#ffffff'; c.fillText(q, 76, 508); c.restore();
  // 下帯
  c.fillStyle = '#ffffffee'; c.fillRect(10, 596, W - 20, 79); c.fillStyle = '#16233a22'; c.fillRect(10, 596, W - 20, 1);
  const col = (label, val, unit, x) => {
    c.font = `700 15px ${body}`; c.fillStyle = '#5d6b80'; c.fillText(label, x, 624);
    c.font = `400 30px ${num}`; c.fillStyle = '#16233a'; c.fillText(val, x, 660); const w = c.measureText(val).width;
    c.font = `500 14px ${body}`; c.fillStyle = '#5d6b80'; c.fillText(unit, x + w + 6, 658);
  };
  col(t('statTime'), r.timeStr, '', 64); col(t('statHair'), String(Math.round(r.grams)), 'g', 250); col(t('statSym'), String(Math.round(r.sym * 100)), '%', 436);
  c.textAlign = 'right'; c.font = `400 17px ${num}`; c.fillStyle = '#5d6b80'; c.fillText('uimemocho.github.io/apps/afro-barber', W - 40, 658);
  return cv;
}

export function shareTextOnly(r) { return shareText(r); }
export async function shareVideo(blob, ext, r, onSaved) {
  const text = shareText(r), file = new File([blob], 'afro-barber.' + ext, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iP|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], text: text + '\n' + GAME_URL }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); onSaved && onSaved();
  window.open(intentUrl(r), '_blank', 'noopener');
}
export const sandboxed = !/(^|\.)uimemocho\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
export function intentUrl(r) { const u = new URL('https://x.com/intent/post'); u.searchParams.set('text', shareText(r)); u.searchParams.set('url', GAME_URL); return u.href; }
export async function shareResult(card, r, onSaved) {
  const text = shareText(r);
  const blob = await new Promise(res => card.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'afro-barber.png', { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iP|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], text: text + '\n' + GAME_URL }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'afro-barber.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); onSaved && onSaved(); }
  window.open(intentUrl(r), '_blank', 'noopener');
}
