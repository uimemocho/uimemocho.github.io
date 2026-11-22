// リザルト画像・X投稿
import { t, lang } from './i18n.js';
const BOLD = { 'zh-Hans': 'MosesBoldSC', 'zh-Hant': 'MosesBoldTC', ko: 'MosesBoldKR' };
const boldFam = () => `"${BOLD[lang()] || 'MosesBold'}","MosesBold",sans-serif`;
export const GAME_URL = 'https://uimemocho.github.io/apps/moses-ibuki/';
const TAGS = '#ゲーム開発 #個人開発 #gamedev';

export function fmtDist(m) {
  if (m < 1000) return { num: Math.round(m).toLocaleString('en-US'), unit: 'm' };
  return { num: (m / 1000).toFixed(m < 10000 ? 2 : 1), unit: 'km' };
}
export function shareText(r) {
  const d = fmtDist(r.dist);
  return t('shareText', { dist: d.num + d.unit, rank: r.rank.grade, title: t('r.' + r.rank.grade), sec: r.sec.toFixed(1), mode: r.finger ? '（' + t('finger') + '）' : '' }) + '\n' + TAGS;
}
export async function ensureFonts() {
  const fams = ['400 40px "Dela Gothic One"', '700 22px "Zen Kaku Gothic New"', '400 30px Oswald', '600 60px Oswald', '900 30px "MosesBold"', `900 30px "${BOLD[lang()] || 'MosesBold'}"`];
  try { await Promise.all(fams.map(f => document.fonts.load(f, 'モーゼの息吹ABCm0123'))); } catch {}
}
export function makeResultCard(scene, r) {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const sw = scene.width, sh = scene.height, ta = W / H;
  let cw = sw, ch = sw / ta; if (ch > sh) { ch = sh; cw = sh * ta; }
  c.imageSmoothingQuality = 'high';
  c.drawImage(scene, (sw - cw) / 2, Math.max(0, (sh - ch) * 0.55), cw, ch, 0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#0e1a2bf2'); g.addColorStop(0.42, '#0e1a2bc8'); g.addColorStop(0.7, '#0e1a2b30'); g.addColorStop(1, '#0e1a2b00');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fit = (text, font, max, min, width) => { let s = max; while (s > min) { c.font = font.replace('$', s); if (c.measureText(text).width <= width) break; s--; } return s; };
  const cjk = !!BOLD[lang()];
  const disp = cjk ? boldFam() : '"Dela Gothic One",sans-serif', bold = boldFam(), dw8 = cjk ? 900 : 400, body = '"Zen Kaku Gothic New",sans-serif', num = 'Oswald,sans-serif';
  // ロゴ
  c.fillStyle = '#ffd60a'; c.fillRect(60, 50, 6, 24);
  c.font = `500 20px ${num}`; c.fillStyle = '#d6dfec'; c.fillText(t('sub'), 80, 70);
  c.save(); c.transform(1, 0, -0.12, 1, 0, 0);
  const tA = t('tA'), tB = t('tB');
  fit(tA + tB, `${dw8} $px ${disp}`, 62, 30, 480);
  const fs = parseInt(c.font, 10);
  c.fillStyle = '#fff'; c.fillText(tA, 76, 146); const x0 = 76 + c.measureText(tA).width + (/[a-z가-힣]/i.test(tA) ? fs * 0.25 : 2);
  c.fillStyle = '#ffd60a'; c.fillText(tB, x0, 146);
  c.restore();
  // 距離
  fit(t('lead'), `700 $px ${body}`, 26, 15, 480); c.fillStyle = '#fff'; c.fillText(t('lead'), 64, 214);
  const d = fmtDist(r.dist);
  c.save(); c.transform(1, 0, -0.12, 1, 30, 0);
  fit(d.num, `600 $px ${num}`, 140, 70, 380); c.fillStyle = '#ffd60a'; c.fillText(d.num, 60, 352); const dw = c.measureText(d.num).width;
  c.font = `400 46px ${num}`; c.fillStyle = '#fff'; c.fillText(d.unit, 72 + dw, 352);
  c.restore();
  c.fillStyle = '#ffffff40'; c.fillRect(64, 392, 440, 1);
  // ランク
  c.font = `400 18px ${num}`; c.fillStyle = '#d6dfec'; c.fillText('RANK', 66, 428);
  c.save(); c.transform(1, 0, -0.14, 1, 72, 0);
  c.font = `600 124px ${num}`;
  if (r.rank.grade === 'SSS') { const gg = c.createLinearGradient(0, 440, 320, 560); gg.addColorStop(0, '#fff8d8'); gg.addColorStop(0.5, '#ffe37d'); gg.addColorStop(1, '#ff9a4d'); c.fillStyle = gg; }
  else c.fillStyle = r.rank.idx <= 1 ? '#d6dfec' : '#ffd60a';
  c.fillText(r.rank.grade, 64, 550); const rw = c.measureText(r.rank.grade).width; c.restore();
  fit(t('r.' + r.rank.grade), `900 $px ${bold}`, 34, 16, Math.max(140, 430 - rw)); c.fillStyle = '#fff'; c.fillText(t('r.' + r.rank.grade), 64 + rw + 40, 538);
  if (r.finger) { c.font = `700 15px ${body}`; const ft = t('finger'); const fw = c.measureText(ft).width; c.fillStyle = '#ffffff22'; c.fillRect(64 + rw + 40, 552, fw + 18, 26); c.fillStyle = '#d6dfec'; c.fillText(ft, 64 + rw + 49, 571); }
  // 下帯
  c.fillStyle = '#0e1a2bf0'; c.fillRect(0, 596, W, 79); c.fillStyle = '#ffd60a'; c.fillRect(60, 596, 80, 3);
  const col = (label, val, unit, x) => {
    c.font = `700 15px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(label, x, 624);
    c.font = `400 30px ${num}`; c.fillStyle = '#fff'; c.fillText(val, x, 660); const w = c.measureText(val).width;
    c.font = `500 14px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(unit, x + w + 6, 658);
  };
  col(t('statSec'), r.sec.toFixed(1), t('sec'), 64); col(t('statPeak'), String(Math.round(r.peak * 100)), '%', 250); col(t('statMult'), '×' + fmtMult(r.mult), '', 436);
  c.textAlign = 'right'; c.font = `400 17px ${num}`; c.fillStyle = '#9fb0c6'; c.fillText('uimemocho.github.io/apps/moses-ibuki', W - 40, 658);
  return cv;
}
export function fmtMult(m) { return m < 10 ? m.toFixed(1) : m < 1000 ? Math.round(m).toString() : (m / 1000).toFixed(1) + 'k'; }

// claude.ai のアーティファクトなど、ダウンロードや共有が使えない場所
export const sandboxed = !/(^|\.)uimemocho\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
export function intentUrl(r) { const u = new URL('https://x.com/intent/post'); u.searchParams.set('text', shareText(r)); u.searchParams.set('url', GAME_URL); return u.href; }
export async function shareResult(card, r, onSaved) {
  const text = shareText(r);
  const blob = await new Promise(res => card.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'moses-ibuki.png', { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iP|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], text: text + '\n' + GAME_URL }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'moses-ibuki.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); onSaved && onSaved(); }
  window.open(intentUrl(r), '_blank', 'noopener');
}
