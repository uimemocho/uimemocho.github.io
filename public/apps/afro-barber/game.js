// アフロバーバー：ゲーム進行
import { Barber, HAIR_COLORS, setHairColor } from './barber.js';
import { Sound } from './audio.js';
import { t, setLang, detectLang, applyI18n, LANGS, lang } from './i18n.js';
import { makeResultCard, shareResult, shareVideo, shareText, intentUrl, sandboxed, ensureFonts, GAME_URL } from './share.js';

const $ = (id) => document.getElementById(id);
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const TH = [35, 48, 60, 70, 78, 86, 93];
const SIZES = { scissors: [0.005, 0.009, 0.016], thin: [0.008, 0.013, 0.022], clipper: [0.011, 0.017, 0.026], razor: [0.006, 0.01, 0.015], comb: [0.01, 0.016, 0.026] };
const GUARDS = [1, 3, 6, 12, 24];
const USUAL = ['maru', 'mohawk', 'buzz', 'hightop', 'short', 'skin'];
const GRAM = 1e6 * 0.03; // m³→g（ふわふわのアフロ 0.03g/cm³）
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const store = {
  get(k, d) { try { const v = localStorage.getItem('afrobarber.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('afrobarber.' + k, JSON.stringify(v)); } catch {} },
};
const lowEnd = /iPhone OS (1[0-3])_/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;
const set = Object.assign({ se: true, bgm: true, vib: true, hq: !lowEnd }, store.get('set', {}));
setLang(detectLang());
const sound = new Sound(); sound.se = set.se; sound.bgm = set.bgm;
let barber;

const S = {
  phase: 'title', time: 0, phaseT: 0, used: 0, tool: 'scissors', size: 1, guard: 2, mirror: true, cut: 0,
  cam: { yaw: 0.4, pitch: 0.08, dist: 1.4, tx: 0, ty: 0.22, tz: -0.06 }, zoom: 1, userYaw: 0.35, userPitch: 0.1,
  result: null, card: null, usual: 'maru', rough0: 1, vol0: 1, lock: false,
};
function screen(name) {
  document.body.dataset.screen = name;
  $('titleScreen').hidden = name !== 'title';
  $('resultScreen').hidden = name !== 'result';
  $('hud').hidden = name !== 'play';
}
function toast(msg, ms = 2600) { const e = $('toast'); e.textContent = msg; e.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), ms); }
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function vib(ms) { if (set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch {} }
function rankOf(v) { let i = 0; while (i < TH.length && v >= TH[i]) i++; return { idx: i, grade: RANKS[i] }; }
function phase(p) { S.phase = p; S.phaseT = 0; }
function saveSet() { store.set('set', set); }
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function refreshTexts() {
  applyI18n();
  document.title = t('name');
  $('tA').textContent = t('tA');
  { const tb = $('tB'); tb.textContent = ''; [...t('tB')].forEach((ch, i) => { const s = document.createElement('span'); s.className = i % 2 ? 'b' : 'r'; s.textContent = ch; tb.appendChild(s); }); }
  document.querySelectorAll('.toggle[data-key]').forEach(b => { const on = !!set[b.dataset.key]; b.setAttribute('aria-pressed', on); b.textContent = on ? t('on') : t('off'); });
  const best = store.get('best', null);
  $('bestLine').textContent = best ? `BEST  ${Math.round(best.sat)}%  ${RANKS[best.rank]}` : '';
}

// ---- 来店〜カット ----
function goTitle() { phase('title'); screen('title'); document.body.classList.remove('cinema'); $('talk').hidden = true; barber.reset(); sound.setMusic(true); refreshTexts(); }
function startRound() {
  sound.init();
  barber.reset();
  S.usual = USUAL[Math.floor(Math.random() * USUAL.length)];
  Object.assign(S, { used: 0, cut: 0, result: null, card: null, zoom: 1, userYaw: 0.35, userPitch: 0.1 });
  screen('intro'); document.body.classList.add('cinema');
  phase('intro'); S.talkI = 0; S.talkT = 0;
  $('talkText').textContent = ''; $('talk').hidden = false;
  sound.setMusic(true, 0.5);
}
function stepIntro(dt) {
  const full = t('talk'), chars = [...full];
  if (S.phaseT > 0.7 && S.talkI < chars.length) {
    S.talkT += dt;
    while (S.talkT > 0.075 && S.talkI < chars.length) { S.talkT -= 0.075; S.talkI++; if (!/[\s、。,.!?]/.test(chars[S.talkI - 1])) sound.mumble(); }
    $('talkText').textContent = chars.slice(0, S.talkI).join('');
  }
  if (S.phaseT > 0.7 + chars.length * 0.075 + 1.5) {
    $('talk').hidden = true; document.body.classList.remove('cinema');
    phase('play'); screen('play'); updateHud(); $('hint').classList.remove('gone'); vib(20);
  }
}
function finish() {
  if (S.phase !== 'play') return;
  phase('end'); S.endStart = S.time; sculpt.mode = null; barber.showCursor(null); sound.buzz(false);
  const c = $('cut'); $('cutText').textContent = t('doneCut'); c.querySelector('em').textContent = ''; { const st = c.querySelector('strong'); st.style.fontSize = ''; const fs = parseFloat(getComputedStyle(st).fontSize), w = st.scrollWidth + fs * 0.25, mx = innerWidth * 0.88; if (w > mx) st.style.fontSize = (fs * mx / w) + 'px'; }
  c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  sound.end(); vib([30, 30, 50]); sound.setMusic(false);
  const st = barber.stats();
  const style = classify(st);
  const symS = clamp((st.sym - 0.62) / 0.36, 0, 1);
  const tidy = clamp(1 - (st.rough / S.rough0 - 1) / 1.6, 0, 1);
  const cut = 1 - st.kept;
  const effort = clamp(cut / 0.25, 0, 1);
  const patchy = st.bald > 0.08 && st.bald < 0.85 ? (1 - symS) * 0.25 : 0;
  let sat = 100 * clamp(0.36 * symS + 0.28 * tidy + 0.36 * effort - patchy, 0, 1) * clamp(cut / 0.12, 0.2, 1);
  const hit = style === S.usual;
  if (hit) sat = Math.min(100, sat + 12);
  const rank = rankOf(sat);
  const re = hit ? 'hit' : sat >= 85 ? 'joy' : sat >= 65 ? 'amuse' : sat >= 45 ? 'sad' : 'anger';
  S.result = { style, sat, rank, re, hit, sym: st.sym, grams: S.cut * GRAM, time: S.used, timeStr: fmtTime(S.used), quote: t('re.' + re), usual: S.usual };
}
function classify(st) {
  if (st.bald > 0.9) return 'skin';
  if (st.kept < 0.12) return 'buzz';
  if (st.center > 0.55 && st.kept < 0.45) return 'mohawk';
  if (st.top > 0.55 && st.side < 0.35) return 'hightop';
  if (st.sym < 0.78) return 'asym';
  if (st.kept > 0.88) return 'same';
  if (st.kept < 0.45) return 'short';
  return 'maru';
}
function showResult() {
  const r = S.result; phase('result'); screen('result'); S.resYaw = S.cam.yaw;
  $('resultLead').textContent = t('lead');
  $('resultMain').querySelector('b').textContent = t('s.' + r.style);
  $('satNum').textContent = Math.round(r.sat); $('satLabel').textContent = t('satLabel');
  $('rankHero').dataset.rank = r.rank.grade; $('rankGrade').textContent = r.rank.grade; $('rankTitle').textContent = t('r.' + r.rank.grade);
  $('reactionTag').textContent = { hit: 'PERFECT', joy: 'JOY', amuse: 'AMUSEMENT', sad: 'SADNESS', anger: 'ANGER' }[r.re];
  $('reactionText').textContent = r.quote;
  $('usualNote').textContent = r.hit ? t('usualHit', { style: t('s.' + r.usual) }) : t('usual', { style: t('s.' + r.usual) });
  const stats = $('resultStats'); stats.innerHTML = '';
  const add = (label, val, unit) => { const d = document.createElement('span'); d.textContent = label; const b = document.createElement('b'); b.textContent = val + unit; d.appendChild(b); stats.appendChild(d); };
  add(t('statTime'), r.timeStr, ''); add(t('statHair'), Math.round(r.grams), 'g'); add(t('statSym'), Math.round(r.sym * 100), '%'); S.video = null;
  const b = store.get('best', null);
  if (!b || r.sat > b.sat) store.set('best', { sat: r.sat, rank: r.rank.idx });
  sound.sting(r.rank.idx); sound.setMusic(true);
  refreshTexts();
}

// ---- HUD ----
function updateHud() {
  $('timer').textContent = fmtTime(S.used);
  document.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === S.tool));
  document.querySelectorAll('.size').forEach(b => b.setAttribute('aria-pressed', +b.dataset.size === S.size));
  $('mirrorBtn').setAttribute('aria-pressed', S.mirror);
  $('lockBtn').setAttribute('aria-pressed', S.lock);
  $('guardBtn').hidden = S.tool !== 'clipper';
  $('guardVal').textContent = GUARDS[S.guard] + 'mm';
  $('undoBtn').disabled = !barber.canUndo();
}

// ---- 入力 ----
const ptrs = new Map();
const sculpt = { last: null, mode: null, lx: 0, ly: 0, pinch: 0, mid: null };
function radius() { return Math.max(SIZES[S.tool][S.size], barber.c * 1.25); }
function applyAt(hit) {
  const res = barber.brush(S.tool, hit, radius(), S.mirror, S.tool === 'razor' ? 0.0004 : S.tool === 'clipper' ? GUARDS[S.guard] / 1000 : 0);
  if (res.changed) {
    S.cut += res.removed;
    if (S.tool === 'scissors') { sound.snip(Math.min(20, res.removed * 2e6)); vib(5); }
    else if (S.tool === 'thin') sound.thinSnip();
    else if (S.tool === 'clipper') sound.cutHair();
    else if (S.tool === 'razor') sound.scrape();
    else sound.brush();
    if (!$('hint').classList.contains('gone')) $('hint').classList.add('gone');
  }
}
function stroke(x, y) {
  const hit = barber.pick(x, y);
  barber.showCursor(hit, radius(), S.tool);
  if (!hit) { sculpt.last = null; return; }
  if (!sculpt.last) { applyAt(hit); sculpt.last = hit; return; }
  const p = hit.point, r = radius(), d = p.distanceTo(sculpt.last.point), step = r * 0.35;
  if (d < step) return;
  const n = Math.min(16, Math.floor(d / step));
  for (let i = 1; i <= n; i++) {
    const k = i / n, q = sculpt.last.point.clone().lerp(p, k), nn = sculpt.last.normal.clone().lerp(hit.normal, k).normalize();
    applyAt({ point: q, normal: nn, hair: true });
  }
  sculpt.last = hit;
}
function endStroke() { if (sculpt.mode === 'sculpt') { barber.endStroke(); sound.buzz(false); updateHud(); } }
function bindInput() {
  const cv = $('world');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.phase !== 'play') return;
    if (ptrs.size === 1) {
      const hit = e.button === 2 ? null : barber.pick(e.clientX, e.clientY);
      const ok = hit && (hit.hair || S.tool === 'clipper' || S.tool === 'razor');
      // 視点ロック中は、髪の外から描き始めてもそのまま切れる
      if (ok || (S.lock && e.button !== 2)) { sculpt.mode = 'sculpt'; barber.beginStroke(); sculpt.last = null; if (S.tool === 'clipper') sound.buzz(true); stroke(e.clientX, e.clientY); }
      else sculpt.mode = 'orbit';
      sculpt.lx = e.clientX; sculpt.ly = e.clientY;
    } else if (ptrs.size === 2 && !S.lock) {
      endStroke(); sculpt.mode = 'pinch'; barber.showCursor(null);
      const [a, b] = [...ptrs.values()]; sculpt.pinch = Math.hypot(a.x - b.x, a.y - b.y); sculpt.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (S.phase === 'play' && e.pointerType === 'mouse') barber.showCursor(barber.pick(e.clientX, e.clientY), radius(), S.tool); return; }
    p.x = e.clientX; p.y = e.clientY;
    if (S.phase !== 'play') return;
    if (sculpt.mode === 'sculpt') stroke(e.clientX, e.clientY);
    else if (sculpt.mode === 'orbit') {
      const dx = e.clientX - sculpt.lx, dy = e.clientY - sculpt.ly; sculpt.lx = e.clientX; sculpt.ly = e.clientY;
      S.userYaw -= dx * 0.008; S.userPitch = clamp(S.userPitch + dy * 0.005, -0.35, 1.1);
    } else if (sculpt.mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (sculpt.pinch > 0) S.zoom = clamp(S.zoom * sculpt.pinch / d, 0.32, 1.35);
      S.userYaw -= (mid.x - sculpt.mid.x) * 0.008; S.userPitch = clamp(S.userPitch + (mid.y - sculpt.mid.y) * 0.005, -0.35, 1.1);
      sculpt.pinch = d; sculpt.mid = mid;
    }
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) { endStroke(); sculpt.mode = null; sculpt.last = null; if (e.pointerType !== 'mouse') barber.showCursor(null); }
    else if (ptrs.size === 1) { if (sculpt.mode !== 'sculpt') sculpt.mode = S.lock ? null : 'orbit'; const [p] = [...ptrs.values()]; sculpt.lx = p.x; sculpt.ly = p.y; }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ptrs.size) barber.showCursor(null); });
  cv.addEventListener('wheel', (e) => { if (S.phase !== 'play' || S.lock) return; e.preventDefault(); S.zoom = clamp(S.zoom * Math.exp(e.deltaY * 0.0012), 0.32, 1.35); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (S.phase !== 'play') return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    const keys = { 1: 'scissors', 2: 'thin', 3: 'clipper', 4: 'razor', 5: 'comb' }; if (keys[e.key]) setTool(keys[e.key]);
    if (e.key === '[') { S.size = Math.max(0, S.size - 1); updateHud(); } else if (e.key === ']') { S.size = Math.min(2, S.size + 1); updateHud(); }
  });
}
function setTool(tl) { S.tool = tl; sound.click(); updateHud(); }
function undo() { if (!barber.undo()) return; sound.click(); updateHud(); }

// ---- カメラ ----
function playOffY() {
  const tb = document.querySelector('.toolbar'), H = innerHeight;
  if (!tb) return 0;
  const r3 = document.querySelector('.hud-row3'), bottom = tb.getBoundingClientRect().top - 34, top = r3 ? r3.getBoundingClientRect().bottom + 6 : 64;
  return ((top + bottom) / 2 - H / 2) / H - 0.04;
}
function camGoal(time) {
  const fit = barber.fitDist();
  if (S.phase === 'title') return { yaw: 0.35 + Math.sin(time * 0.25) * 0.5, pitch: 0.06, dist: fit * 1.08, ty: barber.camera.aspect > 1.15 ? 0.26 : 0.2, tz: -0.06 };
  if (S.phase === 'intro') return { yaw: 0.3 - S.phaseT * 0.03, pitch: 0.03, dist: 0.95, ty: 0.205, tz: -0.02 };
  if (S.phase === 'end' || S.phase === 'wait') return { yaw: S.userYaw + (S.time - S.endStart) * 1.5, pitch: 0.08, dist: fit, ty: 0.22, tz: -0.06, offY: playOffY() };
  if (S.phase === 'result') {
    const g = $('resultGap').getBoundingClientRect(), H = innerHeight, W = innerWidth, fv = barber.camera.fov * Math.PI / 180;
    const gh = Math.max(80, g.height), cy = g.top + gh / 2;
    const dv = 0.43 * H / (2 * Math.tan(fv / 2) * gh * 0.96), fh = 2 * Math.atan(Math.tan(fv / 2) * W / H), dw = 0.37 / (2 * Math.tan(fh / 2) * 0.8);
    return { yaw: S.resYaw + S.phaseT * 0.25, pitch: 0.06, dist: Math.max(dv, dw), ty: 0.225, tz: -0.06, offY: (cy - H / 2) / H };
  }
  return { yaw: S.userYaw, pitch: S.userPitch, dist: fit * S.zoom, ty: 0.225 - (1 - S.zoom) * 0.03, tz: -0.06, offY: playOffY() };
}
function stepCam(dt, time) {
  const g = camGoal(time), c = S.cam;
  const k = 1 - Math.exp(-dt * (S.phase === 'play' ? 14 : S.phase === 'intro' ? 3 : 2.2));
  c.yaw = lerp(c.yaw, g.yaw, k); c.pitch = lerp(c.pitch, g.pitch, k); c.dist = lerp(c.dist, g.dist, k); c.ty = lerp(c.ty, g.ty, k); c.tz = lerp(c.tz, g.tz, k); c.offY = lerp(c.offY || 0, g.offY || 0, k);
  barber.cam = c;
}
function snapshotCard() {
  try { S.card = makeResultCard(barber.shot(640, 0.5, 0.06), S.result); } catch (e) { console.warn(e); S.card = null; }
}

// ---- ループ ----
let last = performance.now(), running = true;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running) {
    S.time += dt; S.phaseT += dt;
    if (S.phase === 'intro') stepIntro(dt);
    if (S.phase === 'play') { S.used += dt; $('timer').textContent = fmtTime(S.used); }
    else if (S.phase === 'end' && S.phaseT > 2.4) {
      phase('wait'); const r = S.result;
      ensureFonts(t('s.' + r.style) + t('r.' + r.rank.grade) + r.quote + t('lead') + t('satLabel') + t('statTime') + t('statHair') + t('statSym')).then(() => { snapshotCard(); showResult(); });
    }
    stepCam(dt, S.time);
    if (!barber.recording) barber.render(dt);
  }
  requestAnimationFrame(loop);
}

// ---- UI ----
function openSheet(which) { $('sheet').hidden = false; for (const id of ['settingsBody', 'howtoBody', 'shareBody', 'colorBody']) $(id).hidden = id !== which; }
function bind() {
  document.addEventListener('pointerdown', () => { if (!sound.ctx) { sound.init(); sound.setMusic(true, S.phase === 'play' ? 0.5 : 1); } }, { capture: true });
  $('playBtn').onclick = () => { sound.click(); startRound(); };
  const applyColor = () => {
    const i = set.color | 0; setHairColor(i);
    document.documentElement.style.setProperty('--hc', HAIR_COLORS[i]);
    document.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(+s.dataset.i === i)));
  };
  document.querySelectorAll('.swatches').forEach((box) => {
    box.innerHTML = HAIR_COLORS.map((c, i) => `<button class="swatch" data-i="${i}" style="--c:${c}" aria-label="${t('c' + i)}"></button>`).join('');
    box.onclick = (e) => { const s = e.target.closest('.swatch'); if (!s) return; sound.click(); set.color = +s.dataset.i; saveSet(); applyColor(); };
  });
  applyColor();
  $('colorBtn').onclick = () => { sound.click(); openSheet('colorBody'); };
  $('howtoBtn').onclick = () => { sound.click(); openSheet('howtoBody'); };
  $('settingsBtn').onclick = () => { sound.click(); openSheet('settingsBody'); };
  $('exitBtn').onclick = () => { sound.click(); sound.buzz(false); goTitle(); };
  $('doneBtn').onclick = () => { sound.click(); finish(); };
  $('againBtn').onclick = () => { sound.click(); startRound(); };
  $('resultTitle').onclick = () => { sound.click(); goTitle(); };
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  document.querySelectorAll('.size').forEach(b => b.onclick = () => { S.size = +b.dataset.size; sound.click(); updateHud(); });
  $('mirrorBtn').onclick = () => { S.mirror = !S.mirror; sound.click(); updateHud(); };
  $('lockBtn').onclick = () => { S.lock = !S.lock; sound.click(); toast(t('viewLock') + ' ' + (S.lock ? t('on') : t('off')), 1200); updateHud(); };
  $('guardBtn').onclick = () => { S.guard = (S.guard + 1) % GUARDS.length; sound.click(); updateHud(); };
  $('undoBtn').onclick = () => undo();
  $('sheetClose').onclick = () => { sound.click(); $('sheet').hidden = true; $('shareVideo').pause(); };
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) $('sheet').hidden = true; });
  document.querySelectorAll('.toggle[data-key]').forEach(b => b.onclick = () => {
    const k = b.dataset.key; set[k] = !set[k]; saveSet();
    sound.se = set.se; sound.bgm = set.bgm; sound.init(); sound.setMusic(true, S.phase === 'play' ? 0.5 : 1);
    if (k === 'hq') barber.setQuality(set.hq);
    refreshTexts();
  });
  const sel = $('langSelect'); LANGS.forEach(([v, n]) => { const o = document.createElement('option'); o.value = v; o.textContent = n; sel.appendChild(o); });
  sel.value = lang(); sel.onchange = async () => { setLang(sel.value); refreshTexts(); if (S.result && S.phase === 'result') { S.result.quote = t('re.' + S.result.re); await ensureFonts(t('s.' + S.result.style) + S.result.quote); snapshotCard(); showResult(); } };
  $('shareImgBtn').onclick = async () => {
    sound.click(); const r = S.result; if (!r) return;
    await ensureFonts(t('s.' + r.style) + r.quote);
    if (!S.card) snapshotCard(); if (!S.card) return;
    if (sandboxed) { $('sharePreview').hidden = false; $('shareVideo').hidden = true; $('shareVideo').pause(); $('sharePreview').src = S.card.toDataURL('image/png'); $('shareNote').textContent = t('saveHint'); $('shareXLink').href = intentUrl(r); openSheet('shareBody'); }
    else await shareResult(S.card, r, () => toast(t('saved')));
  };
  $('shareVidBtn').onclick = async () => {
    sound.click(); const r = S.result; if (!r) return;
    if (!S.video) {
      $('recOverlay').hidden = false; $('recBar').style.width = '0%';
      try { S.video = await barber.recordSpin(6, 720, 900, (k) => { $('recBar').style.width = (k * 100).toFixed(0) + '%'; }); }
      catch (e) { console.warn(e); $('recOverlay').hidden = true; toast('Video is not supported on this browser'); return; }
      $('recOverlay').hidden = true;
    }
    const { blob, ext } = S.video;
    if (sandboxed) {
      const v = $('shareVideo'); if (v.dataset.url) URL.revokeObjectURL(v.dataset.url); v.dataset.url = URL.createObjectURL(blob); v.src = v.dataset.url; v.hidden = false; $('sharePreview').hidden = true; v.play().catch(() => {});
      $('shareNote').textContent = t('videoHint'); $('shareXLink').href = intentUrl(r); openSheet('shareBody');
    } else await shareVideo(blob, ext, r, () => toast(t('saved')));
  };
  $('copyText').onclick = async () => { try { await navigator.clipboard.writeText(shareText(S.result) + '\n' + GAME_URL); toast(t('copied')); } catch { toast(shareText(S.result)); } };
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden; last = performance.now();
    if (document.hidden) { sound.buzz(false); if (sound.ctx) sound.ctx.suspend(); } else if (sound.ctx) sound.ctx.resume();
  });
  addEventListener('resize', () => barber.resize());
}

async function boot() {
  try { barber = new Barber($('world')); barber.hq = set.hq; await barber.load(); }
  catch (e) { console.error(e); $('bootMsg').textContent = 'WebGL が使えないため表示できません'; return; }
  { const st0 = barber.stats(); S.rough0 = st0.rough; S.vol0 = st0.vol; }
  barber.onDrop = (v) => { S.cut += v; if (v > 2e-6) { sound.thud(v > 4e-5); vib(v > 4e-5 ? 30 : 12); } };
  bindInput(); bind(); refreshTexts(); screen('title');
  await ensureFonts();
  barber.cam = S.cam; barber.render(0);
  $('boot').classList.add('gone');
  requestAnimationFrame(loop);
  window.__ab = { S, barber, startRound, finish, goTitle, get card() { return S.card; } };
}
boot();
