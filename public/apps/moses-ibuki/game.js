// モーゼの息吹：ゲーム進行
import { Ocean } from './ocean.js';
import { Breath } from './breath.js';
import { Sound } from './audio.js';
import { t, setLang, detectLang, applyI18n, LANGS, lang } from './i18n.js';
import { fmtDist, fmtMult, makeResultCard, shareResult, shareText, intentUrl, sandboxed, ensureFonts } from './share.js';
// 指連打モードはマイクが使えないアーティファクト内だけ。公開版はマイクのみ
const ALLOW_FINGER = sandboxed;

const $ = (id) => document.getElementById(id);
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const TH = [30, 150, 500, 1500, 5000, 15000, 30000];
const BLOW_LIMIT = 12;      // 吹き始めてからの上限秒
const WAIT_LIMIT = 10;      // 吹き始めるまで待つ上限秒
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const store = {
  get(k, d) { try { const v = localStorage.getItem('moses.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('moses.' + k, JSON.stringify(v)); } catch {} },
};
const set = Object.assign({ se: true, bgm: true, vib: true, hq: !/iPhone OS (1[0-4])_/.test(navigator.userAgent), mode: Breath.supported() ? 'mic' : 'finger' }, store.get('set', {}));
if (!ALLOW_FINGER) set.mode = 'mic';
else if (!Breath.supported()) set.mode = 'finger';

setLang(detectLang());
const sound = new Sound(); sound.se = set.se; sound.bgm = set.bgm;
let ocean, breath = null;

// ---- 状態 ----
const S = {
  phase: 'title', time: 0, phaseT: 0,
  L: 0, W: 9, close: 0, front: 0, p: 0,
  started: false, startT: 0, quiet: 0, sustain: 0, mult: 1, maxMult: 1, peak: 0, dur: 0,
  taps: [], fingerUsed: false, warned: false, vibT: 0,
  cam: [0, 6.5, -16], tgt: [0, -1.5, 60], roll: 0,
  result: null, card: null, next: null,
};

// ---- 画面 ----
function screen(name) {
  document.body.dataset.screen = name;
  $('titleScreen').hidden = name !== 'title';
  $('resultScreen').hidden = name !== 'result';
  $('hud').hidden = name !== 'play';
}
function toast(msg, ms = 2600) { const e = $('toast'); e.textContent = msg; e.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), ms); }
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function vib(ms) { if (set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch {} }
function rankOf(m) { let i = 0; while (i < TH.length && m >= TH[i]) i++; return { idx: i, grade: RANKS[i] }; }

function refreshTexts() {
  applyI18n();
  document.title = t('name');
  $('tA').textContent = t('tA'); $('tB').textContent = t('tB');
  $('cutText').textContent = t('blowCut');
  fitTitle();
  $('modeName').textContent = set.mode === 'mic' ? t('mic') : t('finger');
  $('modeToggle').textContent = set.mode === 'mic' ? t('mic') : t('finger');
  document.querySelectorAll('.toggle[data-key]').forEach(b => { const on = !!set[b.dataset.key]; b.setAttribute('aria-pressed', on); b.textContent = on ? t('on') : t('off'); });
  const best = store.get('best', 0);
  $('bestLine').textContent = best > 0 ? (() => { const d = fmtDist(best); return `${t('best')}  ${d.num} ${d.unit}`; })() : '';
}
// タイトルを1行に収める（画面幅の9割まで）
function fitTitle() {
  const h = $('title'); if (!h) return;
  const max = Math.min(innerWidth * 0.9, 560);
  let fs = /^(ja|zh)/.test(lang()) ? 76 : 60; h.style.fontSize = fs + 'px';
  while (fs > 22 && h.scrollWidth > max) { fs -= 2; h.style.fontSize = fs + 'px'; }
}
function saveSet() { store.set('set', set); }

// ---- 開始 ----
async function startRound() {
  sound.init(); sound.click();
  if (!ALLOW_FINGER && !Breath.supported()) { toast(t('noMicPub'), 5200); return; }
  screen('play'); document.body.classList.remove('blowing');
  Object.assign(S, { L: 0, W: 9, close: 0, front: 0, p: 0, started: false, quiet: 0, sustain: 0, mult: 1, maxMult: 1, peak: 0, dur: 0, taps: [], warned: false, fingerUsed: set.mode === 'finger' });
  updateHud();
  $('blowGuide').hidden = true; $('holdBtn').hidden = true; $('count').hidden = true;
  sound.setMusic(false); sound.setAmb(0.12);
  if (set.mode === 'mic') {
    phase('calib');
    $('calib').hidden = false; $('calibFill').style.width = '0';
    try {
      if (!breath) breath = new Breath(sound.ctx);
      await breath.start();
      await breath.calibrate(1300, (k) => { $('calibFill').style.width = Math.min(100, k * 100) + '%'; });
    } catch (e) {
      console.warn(e);
      if (breath) breath.stop();
      if (!ALLOW_FINGER) { $('calib').hidden = true; goTitle(); toast(t('noMicPub'), 5200); return; }
      set.mode = 'finger'; S.fingerUsed = true; refreshTexts(); toast(t('noMic'), 3600);
    }
    $('calib').hidden = true;
    if (S.phase !== 'calib') return;
  }
  countdown();
}
function countdown() {
  phase('count');
  const el = $('count'); el.hidden = false;
  let n = 3;
  const step = () => {
    if (S.phase !== 'count') return;
    if (n === 0) { el.hidden = true; beginBlow(); return; }
    el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    sound.tick(n === 1); n--; setTimeout(step, 620);
  };
  step();
}
function beginBlow() {
  phase('blow');
  const c = $('cut'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  sound.cut(); flash(); vib(40);
  $('blowGuide').hidden = false; $('blowGuide').classList.remove('warn');
  $('blowHint').textContent = set.mode === 'mic' ? t('blowHint') : t('holdHint');
  $('blowSub').textContent = set.mode === 'mic' ? t('blowSub') : t('finger');
  $('holdBtn').hidden = set.mode !== 'finger';
  $('breathPeak').style.left = '0';
}
function phase(p) { S.phase = p; S.phaseT = 0; }

function endBlow() {
  phase('reveal');
  document.body.classList.remove('blowing');
  $('holdBtn').hidden = true;
  if (breath) breath.stop();
  sound.setRumble(0);
  if (S.L > 5) { sound.roar(); vib([60, 40, 120]); }
  sound.setAmb(0.3);
  const rank = rankOf(S.L);
  S.result = { dist: S.L, rank, sec: S.dur, peak: S.peak, mult: S.maxMult, finger: S.fingerUsed };
}
function showResult() {
  const r = S.result;
  phase('result'); screen('result');
  const d = fmtDist(r.dist);
  $('resultDist').innerHTML = `<b>${d.num}</b><small>${d.unit}</small>`;
  $('resultMode').textContent = r.finger ? t('finger') : '';
  $('rankHero').dataset.rank = r.rank.grade; $('rankGrade').textContent = r.rank.grade; $('rankTitle').textContent = t('r.' + r.rank.grade);
  $('statSec').textContent = r.sec.toFixed(1); $('statPeak').textContent = Math.round(r.peak * 100); $('statMult').textContent = '×' + fmtMult(r.mult);
  const best = store.get('best', 0);
  if (r.dist > best && r.dist > 0) { store.set('best', r.dist); $('bestNote').textContent = t('newBest'); } else $('bestNote').textContent = '';
  sound.sting(r.rank.idx); sound.setMusic(true);
  refreshTexts();
}
// 割れた海を閉じてから次へ
function collapse(next) {
  if (S.phase === 'collapse') return;
  sound.init(); sound.click();
  S.next = next; phase('collapse'); screen('play');
  $('blowGuide').hidden = true; $('holdBtn').hidden = true; $('calib').hidden = true; $('count').hidden = true;
  if (S.L > 5) { sound.crash(); vib(80); }
  sound.setMusic(false);
}

// ---- 毎フレーム ----
function stepPlay(dt) {
  S.phaseT += dt;
  if (S.phase === 'blow') {
    let p = 0;
    if (set.mode === 'mic' && breath) p = breath.update(dt);
    else {
      // 指連打：直近0.6秒の連打の速さを息の強さにする（毎秒8.5回で最大）
      const now = S.phaseT; S.taps = S.taps.filter(x => now - x < 0.6);
      const target = Math.min(1, S.taps.length / 0.6 / 8.5);
      S.p += (target - S.p) * (1 - Math.exp(-dt * (target > S.p ? 8 : 4))); p = S.p;
    }
    S.p = p;
    if (!S.started && p > 0.18) { S.started = true; S.startT = S.phaseT; document.body.classList.add('blowing'); }
    if (S.started) {
      S.dur = S.phaseT - S.startT;
      if (p > 0.1) S.sustain += dt * clamp((p - 0.15) / 0.75, 0, 1.1); else S.sustain = Math.max(0, S.sustain - dt * 2);
      S.mult = Math.exp(0.8 * Math.min(S.sustain, 10));
      S.maxMult = Math.max(S.maxMult, S.mult);
      S.L += 22 * Math.pow(p, 1.5) * S.mult * dt;
      S.peak = Math.max(S.peak, p);
      S.W = Math.max(S.W - dt * 0.2, 8 + 10 * p);
      S.quiet = p < 0.07 ? S.quiet + dt : 0;
      if (S.quiet > 0.65 || S.dur > BLOW_LIMIT) endBlow();
      S.vibT -= dt; if (p > 0.3 && S.vibT <= 0) { vib(Math.round(15 + p * 25)); S.vibT = 0.14; }
    } else {
      if (S.phaseT > 4 && !S.warned) { S.warned = true; $('blowGuide').classList.add('warn'); $('blowHint').textContent = set.mode === 'mic' ? t('noBreath') : t('holdHint'); }
      if (S.phaseT > WAIT_LIMIT) endBlow();
    }
    S.front = lerp(S.front, Math.min(1, p * 1.3), 1 - Math.exp(-dt * 6));
    sound.setRumble(p);
    updateHud();
  } else if (S.phase === 'reveal') {
    S.front = lerp(S.front, 0, 1 - Math.exp(-dt * 2)); S.p = lerp(S.p, 0, 1 - Math.exp(-dt * 4));
    if (S.phaseT > 3.4) { snapshotCard(); showResult(); }
  } else if (S.phase === 'collapse') {
    S.close = Math.min(1, S.close + dt / 2.1);
    if (S.close >= 1) {
      S.L = 0; S.close = 0; S.front = 0;
      const n = S.next; S.next = null;
      if (n === 'title') goTitle(); else startRound();
    }
  }
}
function updateHud() {
  const d = fmtDist(S.L);
  $('hudDist').textContent = d.num; $('hudUnit').textContent = d.unit;
  $('hudDist').parentElement.classList.toggle('km', d.unit === 'km');
  $('hudMult').textContent = '×' + fmtMult(S.mult);
  $('multBox').classList.toggle('on', S.mult > 1.05); $('multBox').classList.toggle('hot', S.mult > 50);
  $('breathFill').style.width = (S.p * 100).toFixed(1) + '%';
  $('breathPeak').style.left = (S.peak * 100).toFixed(1) + '%';
  $('timeFill').style.width = (S.started ? Math.max(0, 1 - S.dur / BLOW_LIMIT) * 100 : 100) + '%';
}

// カメラ：割れた先端が常に画面に入るように
function camGoal(time) {
  const L = S.L;
  if (S.phase === 'title') return { pos: [Math.sin(time * 0.05) * 3, 6.5 + Math.sin(time * 0.13) * 0.4, -16], tgt: [Math.sin(time * 0.04) * 6, -1.5, 60] };
  if (S.phase === 'result' || (S.phase === 'reveal' && S.phaseT > 0.9) || (S.phase === 'collapse' && S.close < 0.5 && S.L > 5)) {
    const sw = S.phase === 'result' ? Math.sin(time * 0.07) * 0.06 : 0;
    const h = Math.min(30 + L * 0.3, 380);
    return { pos: [-(40 + h * 0.5) * (1 + sw), h, -(60 + h * 0.4)], tgt: [-h * 0.06, -6, 40 + Math.min(L * 0.5, h * 6)] };
  }
  if (S.phase === 'collapse') return { pos: [0, 6.5, -16], tgt: [0, -1.5, 60] };
  const Lc = Math.min(L, 4000);
  return { pos: [0, 7 + Lc * 0.09, -16 - Lc * 0.05], tgt: [0, -2 - Math.min(L, 2000) * 0.004, 40 + Math.min(L * 0.75, 2600)] };
}
function stepCam(dt, time) {
  const g = camGoal(time);
  const k = 1 - Math.exp(-dt * (S.phase === 'blow' ? 3.2 : S.phase === 'reveal' ? 1.4 : 1.8));
  for (let i = 0; i < 3; i++) { S.cam[i] = lerp(S.cam[i], g.pos[i], k); S.tgt[i] = lerp(S.tgt[i], g.tgt[i], k); }
  S.roll = Math.sin(time * 0.3) * 0.006 + (S.phase === 'blow' ? Math.sin(time * 23) * 0.004 * S.p : 0);
}
function drawState(time) {
  return { time, cam: shake(S.cam, time), tgt: S.tgt, L: S.L, W: S.W, close: S.close, breath: S.phase === 'blow' ? S.p : 0, front: S.front, roll: S.roll, fov: 1.9 };
}
function shake(c, time) {
  const a = S.phase === 'blow' ? S.p * 0.12 * (1 + c[1] * 0.01) : S.phase === 'collapse' ? (1 - S.close) * 0.25 : 0;
  return [c[0] + Math.sin(time * 31) * a, c[1] + Math.sin(time * 27 + 1) * a, c[2]];
}
function goTitle() { phase('title'); screen('title'); sound.setMusic(true); sound.setAmb(0.3); refreshTexts(); }

// 投稿画像用に横長で一枚描く
function snapshotCard() {
  try {
    const cv = ocean.canvas, ow = cv.width, oh = cv.height;
    cv.width = 1200; cv.height = 675;
    const L = S.L, h = Math.min(26 + L * 0.25, 320);
    const st = drawState(S.time); st.cam = [-(30 + h * 0.45), h, -(50 + h * 0.35)]; const tz = 40 + Math.min(L * 0.5, h * 6); st.tgt = [st.cam[0] - 0.42 * (tz - st.cam[2]), -6, tz]; st.roll = 0; st.fov = 1.6;
    ocean.render(st);
    const shot = document.createElement('canvas'); shot.width = 1200; shot.height = 675; shot.getContext('2d').drawImage(cv, 0, 0);
    cv.width = ow; cv.height = oh; ocean.render(drawState(S.time));
    S.card = makeResultCard(shot, S.result);
  } catch (e) { console.warn(e); S.card = null; }
}

// ---- ループ ----
let last = performance.now(), running = true;
function loop(now) {
  const dtMs = Math.min(100, now - last); last = now;
  const dt = dtMs / 1000;
  if (running) {
    S.time += dt;
    stepPlay(dt); stepCam(dt, S.time);
    ocean.render(drawState(S.time));
    ocean.adapt(dtMs);
  }
  requestAnimationFrame(loop);
}

// ---- 入力・UI ----
function openSheet(which) {
  $('sheet').hidden = false;
  for (const id of ['settingsBody', 'howtoBody', 'shareBody']) $(id).hidden = id !== which;
}
function bind() {
  document.addEventListener('pointerdown', () => { if (!sound.ctx) { sound.init(); sound.setAmb(0.3); sound.setMusic(S.phase === 'title' || S.phase === 'result'); } }, { capture: true });
  $('playBtn').onclick = () => startRound();
  $('againBtn').onclick = () => collapse('round');
  $('resultTitle').onclick = () => collapse('title');
  $('howtoBtn').onclick = () => { sound.click(); openSheet('howtoBody'); };
  $('settingsBtn').onclick = () => { sound.click(); openSheet('settingsBody'); };
  $('modeBtn').onclick = $('modeToggle').onclick = () => {
    sound.click();
    if (set.mode === 'finger' && !Breath.supported()) { toast(t('noMic')); return; }
    set.mode = set.mode === 'mic' ? 'finger' : 'mic'; saveSet(); refreshTexts();
  };
  $('sheetClose').onclick = () => { sound.click(); $('sheet').hidden = true; };
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) $('sheet').hidden = true; });
  document.querySelectorAll('.toggle[data-key]').forEach(b => b.onclick = () => {
    const k = b.dataset.key; set[k] = !set[k]; saveSet();
    sound.se = set.se; sound.bgm = set.bgm; sound.init(); sound.setAmb(0.3); sound.setMusic(S.phase === 'title' || S.phase === 'result');
    if (k === 'hq') ocean.setQuality(set.hq);
    refreshTexts();
  });
  const sel = $('langSelect'); LANGS.forEach(([v, n]) => { const o = document.createElement('option'); o.value = v; o.textContent = n; sel.appendChild(o); });
  sel.value = lang(); sel.onchange = () => { setLang(sel.value); refreshTexts(); if (S.result && S.phase === 'result') { snapshotCardText(); showResult(); } };
  // 指モード
  const hb = $('holdBtn');
  addEventListener('pointerdown', (e) => {
    if (S.phase !== 'blow' || set.mode !== 'finger') return;
    e.preventDefault(); S.taps.push(S.phaseT);
    hb.classList.remove('on'); void hb.offsetWidth; hb.classList.add('on');
    sound._tone(420 + Math.random() * 80, 0.05, 0.05, 'triangle');
  }, { passive: false });
  hb.addEventListener('contextmenu', e => e.preventDefault());
  // 投稿
  $('shareBtn').onclick = async () => {
    sound.click(); const r = S.result; if (!r) return;
    await ensureFonts();
    if (!S.card) snapshotCardText();
    if (sandboxed) {
      $('sharePreview').src = S.card.toDataURL('image/png');
      $('shareXLink').href = intentUrl(r);
      openSheet('shareBody');
    } else await shareResult(S.card, r, () => toast(t('saved')));
  };
  $('copyText').onclick = async () => { try { await navigator.clipboard.writeText(shareText(S.result) + '\n' + 'https://uimemocho.github.io/apps/moses-ibuki/'); toast(t('copied')); } catch { toast(shareText(S.result)); } };
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (document.hidden) { if (S.phase === 'blow') endBlow(); if (sound.ctx) sound.ctx.suspend(); }
    else if (sound.ctx) sound.ctx.resume();
  });
  addEventListener('resize', () => { ocean.resize(); fitTitle(); });
}
// 言語変更時は画像を作り直す
function snapshotCardText() { if (S.result) snapshotCard(); }

// ---- 起動 ----
async function boot() {
  try { ocean = new Ocean($('world')); }
  catch (e) { console.error(e); $('bootMsg').textContent = 'WebGL2 が使えないため表示できません'; return; }
  ocean.setQuality(set.hq);
  if (!ALLOW_FINGER) {
    $('modeBtn').hidden = true; $('modeToggle').closest('.set-row').hidden = true;
    $('modeBtn').parentElement.classList.add('single');
    const h4 = document.querySelector('[data-i18n="how4"]'); if (h4) h4.dataset.i18n = 'micHelp';
  }
  bind(); refreshTexts(); screen('title');
  await ensureFonts(); fitTitle();
  ocean.render(drawState(0));
  $('boot').classList.add('gone');
  requestAnimationFrame(loop);
  // テスト用の窓口
  window.__moses = { S, set, startRound, endBlow, collapse, get card() { return S.card; }, get ocean() { return ocean; } };
}
boot();
