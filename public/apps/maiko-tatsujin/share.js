// リザルト画像とX投稿
import { t } from './i18n.js';
export const GAME_URL = 'https://uimemocho.github.io/apps/maiko-tatsujin/';
const TAGS = '#舞妓の達人 #ゲーム開発 #個人開発 #gamedev';

export function shareText(r) {
  let s = t('shareText', { result: t(r.out), kimarite: t(r.kimarite), rank: r.rank.grade, title: t('r.' + r.rank.grade), rpm: r.rpm });
  if (r.streak || r.streakEnded) s += '\n' + t('shareStreak', { n: r.streak });
  return s + '\n' + TAGS;
}

// キャンバス描画は unicode-range の遅延読込を起こさないので、使う文字を先に読む
export async function ensureFonts(sample) {
  const fams = ['400 40px "Dela Gothic One"', '700 22px "Zen Kaku Gothic New"', '500 16px "Zen Kaku Gothic New"', '400 30px Oswald', '600 60px Oswald'];
  try { await Promise.all(fams.map(f => document.fonts.load(f, sample))); } catch {}
}
export function cardSample(r, me, opp) {
  return ['MAIKO MASTER舞妓の達人0123456789.rpmRANKuimemocho.github.io/apps/maiko-tatsujin vs', t(r.out), r.headline || '', t('streakEnd', { n: r.streak }), t('kimarite'), t(r.kimarite), t('r.' + r.rank.grade), r.rank.grade, t('maxRpm'), t('crits'), t('finish'), t('sec'), t('streakN', { n: r.streak }), me, opp, '：'].join('');
}
export function makeResultCard({ canvas: scene, result: r, me, opp, mode }) {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // 3Dシーンを右側に（中央トリミング）
  const sw = scene.width, sh = scene.height, ta = W / H;
  let cw = sw, ch = sw / ta; if (ch > sh) { ch = sh; cw = sh * ta; }
  c.drawImage(scene, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#0e1a2bf5'); g.addColorStop(0.45, '#0e1a2bd8'); g.addColorStop(0.7, '#0e1a2b40'); g.addColorStop(1, '#0e1a2b00');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fit = (text, font, max, min, width) => { let s = max; while (s > min) { c.font = font.replace('$', s); if (c.measureText(text).width <= width) break; s--; } return s; };
  const disp = '"Dela Gothic One",sans-serif', body = '"Zen Kaku Gothic New",sans-serif', num = 'Oswald,sans-serif';
  c.textBaseline = 'alphabetic';
  // タイトル
  c.fillStyle = '#ffd60a'; c.fillRect(60, 50, 6, 24);
  c.font = `500 22px ${num}`; c.fillStyle = '#d6dfec'; c.fillText('MAIKO MASTER', 80, 71);
  c.save(); c.transform(1, 0, -0.12, 1, 0, 0);
  c.font = `400 70px ${disp}`; c.fillStyle = '#fff'; c.fillText('舞妓', 74, 158); let x = 74 + c.measureText('舞妓').width;
  c.font = `400 30px ${disp}`; c.fillText('の', x + 2, 158); x += c.measureText('の').width + 4;
  c.font = `400 70px ${disp}`; c.fillStyle = '#ffd60a'; c.fillText('達人', x, 158);
  c.restore();
  // 勝敗
  const outCol = r.out === 'win' ? '#ffd60a' : r.out === 'lose' ? '#d6dfec' : '#ffffff';
  const head = r.headline || t(r.out); fit(head, `400 $px ${disp}`, 86, 40, 470); c.fillStyle = outCol; c.fillText(head, 62, 268);
  c.font = `700 24px ${body}`; c.fillStyle = '#fff'; c.fillText(t('kimarite') + '：' + t(r.kimarite), 64, 312);
  fit(`${me}  vs  ${opp}`, `700 $px ${body}`, 22, 14, 470); c.fillStyle = '#d6dfec'; c.fillText(`${me}  vs  ${opp}`, 64, 348);
  c.fillStyle = '#ffffff40'; c.fillRect(64, 372, 440, 1);
  // ランク
  c.font = `400 18px ${num}`; c.fillStyle = '#d6dfec'; c.fillText('RANK', 66, 408);
  c.save(); c.translate(64, 0); c.transform(1, 0, -0.14, 1, 60, 0);
  c.font = `600 168px ${num}`;
  if (r.rank.grade === 'SSS') { const gg = c.createLinearGradient(0, 400, 300, 560); gg.addColorStop(0, '#fff8d8'); gg.addColorStop(0.5, '#ffe37d'); gg.addColorStop(1, '#ff9a4d'); c.fillStyle = gg; }
  else c.fillStyle = r.rank.idx <= 1 ? '#d6dfec' : '#ffd60a';
  c.fillText(r.rank.grade, 0, 562); const rw = c.measureText(r.rank.grade).width; c.restore();
  fit(t('r.' + r.rank.grade), `400 $px ${disp}`, 30, 16, Math.max(120, 440 - rw)); c.fillStyle = '#fff'; c.fillText(t('r.' + r.rank.grade), 64 + rw + 34, 556);
  // 数値
  c.fillStyle = '#0e1a2bf0'; c.fillRect(0, 590, W, 85); c.fillStyle = '#ffd60a'; c.fillRect(60, 590, 80, 3);
  const col = (label, val, unit, x0) => {
    c.font = `700 16px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(label, x0, 620);
    c.font = `400 36px ${num}`; c.fillStyle = '#fff'; c.fillText(val, x0, 658); const w = c.measureText(val).width;
    c.font = `500 15px ${body}`; c.fillStyle = '#b9c6d8'; c.fillText(unit, x0 + w + 6, 656);
  };
  col(t('maxRpm'), String(r.rpm), 'rpm', 64); col(t('crits'), String(r.crits), '', 250); col(t('finish'), r.time.toFixed(1), t('sec'), 380);
  if (r.streakEnded) { c.font = `400 26px ${disp}`; c.fillStyle = '#ffd60a'; c.fillText(t('streakEnd', { n: r.streak }), 560, 656); }
  c.textAlign = 'right'; c.font = `400 18px ${num}`; c.fillStyle = '#9fb0c6'; c.fillText('uimemocho.github.io/apps/maiko-tatsujin', W - 40, 656);
  return cv;
}

export async function shareResult(card, r, onSaved) {
  const text = shareText(r);
  const blob = await new Promise(res => card.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'maiko-tatsujin.png', { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iP|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], text: text + '\n' + GAME_URL }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  // PC：画像を保存してX投稿画面を開く
  if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'maiko-tatsujin.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); onSaved && onSaved(); }
  const u = new URL('https://x.com/intent/post'); u.searchParams.set('text', text); u.searchParams.set('url', GAME_URL);
  window.open(u.href, '_blank', 'noopener');
}
