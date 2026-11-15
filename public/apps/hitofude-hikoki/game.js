import * as THREE from 'three';
import { createWorld } from './world.js';
import { analyze, PRESETS, mirrorStroke, makeAir, Flight, resample } from './plane.js';
import { makeTerrain } from './terrain.js';
import { SPOTS, fetchWeather, fallbackWeather, rateSpots, parOf, wxKind, dir16 } from './weather.js';
import { LANGS, t, setLang, detectLang, applyI18n, getLang } from './i18n.js';
import { Sound } from './audio.js';
import { makeResultCard, shareResult, ensureFonts, paperImage, challengeUrl, decodeShape, GAME_URL, sandboxed, intentUrl, shareText } from './share.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('hitofude.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hitofude.' + k, JSON.stringify(v)); } catch {} },
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const isMobile = matchMedia('(pointer:coarse)').matches;
const settings = { se: true, bgm: true, vib: true, hq: true, ...store.get('settings', {}) };
const sound = new Sound(); Object.assign(sound, { se: settings.se, bgm: settings.bgm, vib: settings.vib });
setLang(detectLang());

// ───────── ランク ─────────
const GRADES = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const RANK_AT = [0, 0.4, 0.62, 0.85, 1.05, 1.3, 1.6, 2.0]; // 静穏時の標準機の飛距離に対する比
export function rankFor(ratio) { let i = 0; for (let k = 0; k < RANK_AT.length; k++) if (ratio >= RANK_AT[k]) i = k; return { grade: GRADES[i], idx: i }; }

// ───────── 状態 ─────────
let stroke = store.get('stroke', null) || PRESETS.dart;
let shape = analyze(stroke);
let challenge = null;
let wxList = fallbackWeather(), wxLive = false, rated = null, wxLoading = true;
let spotIdx = clamp(store.get('spot', 0) | 0, 0, SPOTS.length - 1);
const bests = store.get('bests', {});
{
  const q = new URLSearchParams(location.search).get('p');
  const pts = q && decodeShape(q);
  if (pts && pts.length > 8) { challenge = pts; }
}

// ───────── 世界 ─────────
const world = createWorld($('world'));
const { camera } = world;
world.setHQ(settings.hq);
let planeObj = null;
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, settings.hq ? (isMobile ? 2 : 1.75) : 1.25);
  world.resize(w, h, dpr);
}
addEventListener('resize', resize); resize();

let T = makeTerrain(SPOTS[spotIdx].id), air = makeAir(wxList[spotIdx], T, SPOTS[spotIdx].heading);
let snapCam = true;
function loadSpot(i) {
  spotIdx = i; snapCam = true; const spot = SPOTS[i];
  T = makeTerrain(spot.id); air = makeAir(wxList[i], T, spot.heading);
  world.setSpot(spot, wxList[i], T, air);
  placePlane();
}
// 方眼ノートを切り抜いた紙の質感（色と凹凸）
function planeTexture(pts) {
  const S = 512, mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
  const cv = mk(), c = cv.getContext('2d'), bv = mk(), b = bv.getContext('2d');
  c.fillStyle = '#f3efe4'; c.fillRect(0, 0, S, S); b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 110, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(120,100,70,.05)' : 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S); }
  c.strokeStyle = 'rgba(70,110,170,.2)'; c.lineWidth = 1;
  for (let i = 1; i < 16; i++) { const p = i * S / 16 + 0.5; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.moveTo(0, p); c.lineTo(S, p); c.stroke(); }
  for (let i = 0; i < 5200; i++) { // 紙の繊維
    const x = Math.random() * S, y = Math.random() * S, a = Math.random() * 6.28, l = 2 + Math.random() * 7, dk = Math.random() < 0.55;
    c.strokeStyle = dk ? `rgba(110,95,70,${0.03 + Math.random() * 0.07})` : `rgba(255,255,255,${0.05 + Math.random() * 0.12})`; c.lineWidth = 0.6 + Math.random() * 0.6;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    b.strokeStyle = dk ? `rgba(0,0,0,${0.05 + Math.random() * 0.1})` : `rgba(255,255,255,${0.05 + Math.random() * 0.1})`; b.lineWidth = 1;
    b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke();
  }
  // 折り目：中央と左右の翼の折り返し
  const crease = (x, w, dark) => {
    let g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.46, `rgba(40,30,20,${dark})`); g.addColorStop(0.54, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - w, 0, w * 2, S);
    g = b.createLinearGradient(x - w * 0.6, 0, x + w * 0.6, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = g; b.fillRect(x - w, 0, w * 2, S);
  };
  crease(S / 2, 12, 0.2);
  const off = Math.max(0.1, Math.min(0.22, shape.span * 0.11)) * S / 2; crease(S / 2 - off, 8, 0.1); crease(S / 2 + off, 8, 0.1);
  // 鉛筆の線
  const P = (p) => [(p[0] + 1) / 2 * S, (1 - p[1]) / 2 * S];
  c.lineJoin = c.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) {
    c.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); const j = pass ? 1.2 : 0; const xx = x + (Math.random() - 0.5) * j, yy = y + (Math.random() - 0.5) * j; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.closePath();
    c.strokeStyle = pass ? 'rgba(45,52,70,.35)' : 'rgba(40,46,62,.78)'; c.lineWidth = pass ? 2.2 : 5; c.stroke();
  }
  return { map: cv, bump: bv };
}
function placePlane() {
  if (planeObj) world.scene.remove(planeObj);
  planeObj = world.makePlane(shape, planeTexture(shape.pts));
  world.scene.add(planeObj);
  planeObj.position.set(0.18, T.top + 1.35, 0.4);
  planeObj.rotation.set(0.12, 0, 0, 'YXZ');
}
loadSpot(spotIdx);

// ───────── 画面 ─────────
let screen = 'title';
const screens = { title: 'titleScreen', draw: 'drawScreen', stage: 'stageScreen', result: 'resultScreen' };
function show(name) {
  screen = name; document.body.dataset.screen = name;
  for (const [k, id] of Object.entries(screens)) $(id).hidden = k !== name;
  $('hud').hidden = !(name === 'aim' || name === 'flight' || name === 'land');
  document.body.classList.toggle('playing', name === 'aim' || name === 'flight');
  document.body.classList.toggle('aiming', name === 'aim');
  $('pullGuide').hidden = name !== 'aim'; $('steerHint').hidden = name !== 'flight';
  sound.duck(name === 'flight' || name === 'aim');
}
function toast(msg) { const e = $('toast'); e.textContent = msg; e.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), 2600); }
function impact(main, sub = '', kind = '') {
  const e = $('impact'); $('impactMain').textContent = main; $('impactSub').textContent = sub; e.dataset.kind = kind;
  e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
}
function flash() { const e = $('flash'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
function speedLines() { const e = $('speedLines'); e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }

function refreshTitle() {
  $('planeName').textContent = t('t.' + shape.type);
  const vals = Object.values(bests); const b = vals.length ? Math.max(...vals) : 0;
  $('bestLine').textContent = b ? `${t('best')} ${b.toLocaleString('en-US')}m` : '';
  $('challengeBox').hidden = !challenge;
  if (challenge) {
    const s = analyze(challenge); $('challengeType').textContent = t('t.' + s.type);
    const c = $('challengeImg').getContext('2d'); c.drawImage(paperImage(challenge, 120), 0, 0);
  }
}

// ───────── 描く ─────────
const paper = $('paper'), pctx = paper.getContext('2d');
let drawing = null, mirror = store.get('mirror', false);
$('mirrorChk').checked = mirror;
function paperDraw(pts, live) {
  const img = paperImage(live ? null : pts, 600); pctx.clearRect(0, 0, 600, 600); pctx.drawImage(img, 0, 0);
  if (mirror) { pctx.fillStyle = 'rgba(26,39,64,.05)'; pctx.fillRect(0, 0, 300, 600); }
  if (live && pts.length > 1) {
    pctx.lineJoin = pctx.lineCap = 'round'; pctx.strokeStyle = '#1a2740'; pctx.lineWidth = 6.5;
    const P = (p) => [(p[0] + 1) * 300, (1 - p[1]) * 300];
    const drawPath = (arr) => { pctx.beginPath(); arr.forEach((p, i) => { const [x, y] = P(p); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); }); pctx.stroke(); };
    drawPath(pts);
    if (mirror) { pctx.globalAlpha = 0.35; drawPath(pts.map(p => [-p[0], p[1]])); pctx.globalAlpha = 1; }
  }
}
function statRows(s) {
  const rows = [['s_lift', s.lift], ['s_glide', s.glide], ['s_stab', s.stab], ['s_straight', s.straight]];
  $('statBars').innerHTML = rows.map(([k, v]) => `<div><span>${t(k)}</span><i><b style="width:${Math.round(v * 100)}%"></b></i><em>${Math.round(v * 100)}</em></div>`).join('');
  $('typeName').textContent = t('t.' + s.type) + (s.tiny ? '' : '');
}
function setStroke(pts, save = true) {
  stroke = pts; shape = analyze(pts);
  if (save) store.set('stroke', pts.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]));
  paperDraw(shape.pts, false); statRows(shape);
  $('drawHint').classList.add('gone');
}
function openDraw() {
  show('draw'); paperDraw(shape.pts, false); statRows(shape); $('drawHint').classList.toggle('gone', true);
}
const toNorm = (e) => { const r = paper.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), clamp(1 - (e.clientY - r.top) / r.height * 2, -1, 1)]; };
paper.addEventListener('pointerdown', (e) => { sound.unlock(); paper.setPointerCapture(e.pointerId); drawing = [toNorm(e)]; $('drawHint').classList.add('gone'); paperDraw(drawing, true); });
paper.addEventListener('pointermove', (e) => {
  if (!drawing) return; const p = toNorm(e), l = drawing[drawing.length - 1];
  const d = Math.hypot(p[0] - l[0], p[1] - l[1]);
  if (d > 0.012) { drawing.push(p); paperDraw(drawing, true); if (Math.random() < 0.5) sound.pen(Math.min(1, d * 20)); }
});
const endDraw = () => {
  if (!drawing) return; let pts = drawing; drawing = null;
  if (pts.length < 6) { paperDraw(shape.pts, false); return; }
  if (mirror) pts = mirrorStroke(pts);
  challenge = null;
  setStroke(pts); sound.paper();
  if (shape.tiny) toast(t('tooSmall'));
};
paper.addEventListener('pointerup', endDraw); paper.addEventListener('pointercancel', endDraw);
$('mirrorChk').addEventListener('change', (e) => { mirror = e.target.checked; store.set('mirror', mirror); paperDraw(shape.pts, false); });
$('clearPlane').onclick = () => { sound.ui(); paperDraw([], true); $('drawHint').classList.remove('gone'); };
let presetI = 0;
$('randomPlane').onclick = () => { sound.paper(); const keys = Object.keys(PRESETS); const p = PRESETS[keys[presetI++ % keys.length]]; challenge = null; setStroke(p.map(q => [q[0], q[1]])); };
$('drawDone').onclick = () => { sound.ui(); placePlane(); openStage(); };
$('drawBack').onclick = () => { sound.ui(); placePlane(); show('title'); refreshTitle(); };

// ───────── 場所 ─────────
const ICONS = {
  clear: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  night: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18Z"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  rain: '<path d="M7 15h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 15Z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
  snow: '<path d="M7 15h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 15Z"/><path d="M9 19h.01M12 21h.01M15 19h.01"/>',
  thunder: '<path d="M7 14h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14Z"/><path d="M12 14l-2 4h3l-2 4"/>',
};
function relWind(i) {
  const wx = wxList[i], spot = SPOTS[i];
  const rel = ((wx.wd + 180 - spot.heading) % 360 + 360) % 360; // 0=真っすぐ前へ吹く
  const c = Math.cos(rel * Math.PI / 180);
  const kind = wx.ws < 0.6 ? 'calm' : c > 0.42 ? 'tail' : c < -0.42 ? 'head' : 'cross';
  return { rel, kind, comp: wx.ws * Math.abs(c) };
}
function windLabel(i) {
  const w = relWind(i), wx = wxList[i];
  if (w.kind === 'calm') return t('calm');
  const v = (w.kind === 'cross' ? wx.ws : w.comp).toFixed(1);
  return `${t(w.kind)} ${v}m/s`;
}
function spotRow(i) {
  const spot = SPOTS[i], wx = wxList[i], w = relWind(i), r = rated && rated[i];
  const k = wxKind(wx.code), icon = ICONS[k === 'clear' && !wx.isDay ? 'night' : k];
  const tailCls = w.kind === 'tail' ? 'good' : w.kind === 'head' ? 'bad' : '';
  const rec = r && r.recommend ? `<span class="rec">${t('recommend')}</span>` : '';
  const reason = r && r.recommend && r.reason ? ` ・ <em>${t('r_' + r.reason)}</em>` : '';
  const best = bests[spot.id] ? `<span class="best">${t('best')} ${bests[spot.id].toLocaleString('en-US')}m</span>` : '';
  const arrowLen = 0.45 + Math.min(1, wx.ws / 9) * 0.55;
  return `<button class="spot" role="option" data-i="${i}" data-tail="${tailCls}" aria-selected="${i === spotIdx}">${rec}
    <svg class="warrow" viewBox="-22 -22 44 44"><circle r="19"/><path class="launch" d="M0 -19V-6" fill="none"/><g transform="rotate(${w.rel.toFixed(0)})"><path d="M0 ${-15 * arrowLen} L6 ${-3 * arrowLen} L2 ${-4 * arrowLen} L2 ${13 * arrowLen} L-2 ${13 * arrowLen} L-2 ${-4 * arrowLen} L-6 ${-3 * arrowLen}Z"/></g></svg>
    <span class="nm"><small>${t('q.' + spot.id)}</small><b>${t('p.' + spot.id)}</b><span>${windLabel(i)}${reason}</span>${best}</span>
    <span class="wx"><svg viewBox="0 0 24 24">${icon}</svg><b>${Number.isFinite(wx.temp) ? Math.round(wx.temp) + '°' : ''}</b></span></button>`;
}
function renderSpots() {
  const list = $('spotList');
  if (wxLoading) { list.innerHTML = `<div class="spot-loading">${t('loadingWx')}</div>`; $('wxSource').textContent = ''; return; }
  list.innerHTML = SPOTS.map((_, i) => spotRow(i)).join('');
  const tm = wxList[0].time ? wxList[0].time.slice(11, 16) : '';
  $('wxSource').textContent = wxLive ? `${t('live', { time: tm })} ・ ${t('liveSrc')}` : t(sandboxed ? 'offlineArt' : 'offline');
}
$('spotList').addEventListener('click', (e) => {
  const b = e.target.closest('.spot'); if (!b) return; sound.ui();
  const i = +b.dataset.i; if (i !== spotIdx) { loadSpot(i); store.set('spot', i); }
  $('spotList').querySelectorAll('.spot').forEach(el => el.setAttribute('aria-selected', String(+el.dataset.i === i)));
});
function openStage() { show('stage'); renderSpots(); }
$('stageBack').onclick = () => { sound.ui(); show('title'); refreshTitle(); };
$('stageGo').onclick = () => { if (wxLoading) return; sound.ui(); startAim(); };

async function loadWeather() {
  wxLoading = true; if (screen === 'stage') renderSpots();
  try { wxList = await fetchWeather(); wxLive = true; }
  catch { wxList = fallbackWeather(); wxLive = false; }
  const dbg = new URLSearchParams(location.search).get('debugwx');
  if (dbg) wxList = wxList.map(w => ({ ...w, isDay: dbg !== 'night', code: dbg === 'rain' ? 63 : dbg === 'snow' ? 73 : dbg === 'fog' ? 45 : 1, cloud: dbg === 'day' ? 35 : 90, phase: dbg === 'day' ? 'day' : undefined }));
  try { rated = rateSpots(wxList); } catch { rated = null; }
  wxLoading = false;
  // 初回はおすすめの場所を選んでおく
  if (!store.get('spot', null) && rated) { const r = rated.filter(x => x.recommend)[0]; if (r) spotIdx = SPOTS.indexOf(r.spot); }
  if (screen === 'title' || screen === 'stage') loadSpot(spotIdx);
  if (screen === 'stage') renderSpots();
}

// ───────── 投げる ─────────
let simT = 0, aimState = null, flight = null, flightReal = 0, landT = 0, resultData = null, lastEvent = {};
let timeScale = 1, camYaw = 0, steer = null;
const hand = new THREE.Vector3();
function startAim() {
  if (planeObj) placePlane();
  world.trailClear();
  show('aim');
  const spot = SPOTS[spotIdx], wx = wxList[spotIdx];
  $('hudSpot').textContent = t('p.' + spot.id);
  const k = wxKind(wx.code);
  $('hudWx').textContent = `${t('w_' + k)} ${Number.isFinite(wx.temp) ? Math.round(wx.temp) + '°' : ''}`;
  $('hudDist').textContent = '0'; $('hudAlt').textContent = Math.round(T.top);
  aimState = { down: false, power: 0, aim: 0, x0: 0, y0: 0 };
  camYaw = 0;
  impact(t('p.' + spot.id), windLabel(spotIdx));
  sound.unlock();
}
function windHud() {
  // 画面上の矢印：機首（上）に対して風が吹いていく向き
  const yaw = flight ? flight.psi : (aimState ? aimState.aim : 0);
  const ang = Math.atan2(air.wxv, -air.wzv) - yaw;
  $('compassArrow').setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(1)}) scale(${(0.55 + Math.min(1, air.base / 10) * 0.45).toFixed(2)})`);
  const c = Math.cos(ang), cls = air.base < 0.9 ? 'side' : c > 0.42 ? '' : c < -0.42 ? 'bad' : 'side';
  $('compass').className = 'compass ' + cls;
  $('compassTxt').textContent = (air.base / 1.5).toFixed(1) + 'm/s';
}
const stage = $('world');
function hudPointer(e) { return { x: e.clientX, y: e.clientY }; }
addEventListener('pointerdown', (e) => {
  if (e.target.closest('button,select,input,.sheet,header')) return;
  if (screen === 'aim' && aimState) { const p = hudPointer(e); Object.assign(aimState, { down: true, x0: p.x, y0: p.y, power: 0, id: e.pointerId }); sound.paper(); }
  else if (screen === 'flight') { steer = { x0: e.clientX, id: e.pointerId }; }
});
addEventListener('pointermove', (e) => {
  if (screen === 'aim' && aimState && aimState.down) {
    const dy = (e.clientY - aimState.y0) / (innerHeight * 0.34), dx = (e.clientX - aimState.x0) / (innerWidth * 0.5);
    const np = clamp(dy, 0, 1.3);
    if (Math.floor(np * 10) !== Math.floor(aimState.power * 10)) sound.stretch(np);
    aimState.power = np; aimState.aim = clamp(dx * 0.75, -0.75, 0.75);
  } else if (screen === 'flight' && steer && flight) {
    flight.input = clamp((e.clientX - steer.x0) / (innerWidth * 0.28), -1, 1);
  }
});
const pointerUp = () => {
  if (screen === 'aim' && aimState && aimState.down) {
    aimState.down = false;
    if (aimState.power < 0.12) { aimState.power = 0; return; }
    launch();
  } else if (screen === 'flight') { steer = null; if (flight) flight.input = 0; }
};
addEventListener('pointerup', pointerUp); addEventListener('pointercancel', pointerUp);

function launch() {
  const g = air.gust(simT), caught = g > 0.84 && air.base + 0.1 > 0;
  flight = new Flight(shape, T, air); flight.t = simT;
  flight.p.x = planeObj.position.x; flight.p.y = planeObj.position.y; flight.p.z = planeObj.position.z;
  flight.launch(aimState.power, aimState.aim, caught);
  world.trail.visible = false;
  flightReal = 0; timeScale = caught ? 0.35 : 1; lastEvent = { thermal: -9, stall: -9 };
  resultData = { caught, power: aimState.power, spot: SPOTS[spotIdx].id };
  show('flight'); sound.throw(aimState.power);
  if (caught) { catchCut(); sound.catchWind(); flash(); }
  else if (aimState.power > 1.03) impact(t('i_over'), 'TOO HARD', 'bad');
  else if (aimState.power < 0.4) impact(t('i_weak'), 'WEAK', 'bad');
  speedLines();
}
function catchCut() {
  const e = $('catchCut'); $('catchMain').textContent = t('i_catch').length <= 6 ? t('i_catch') : t('i_catch').slice(0, 6);
  e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
}

// ───────── 結果 ─────────
const LAND = { 0: 'sea', 1: 'town', 2: 'forest', 3: 'field', 4: 'river', 5: 'deck', sea: 'sea' };
function finish() {
  const f = flight, spot = SPOTS[spotIdx], wx = wxList[spotIdx];
  let land = LAND[f.landKind] || 'field'; if (f.dist < 30 && f.p.y > T.top - 25) land = 'deck';
  const dist = Math.round(f.dist);
  const ratio = dist / parOf(spot.id);
  const rank = rankFor(ratio);
  const prev = bests[spot.id] || 0, isBest = dist > prev;
  if (isBest) { bests[spot.id] = dist; store.set('bests', bests); }
  const tm = wx.time ? `${+wx.time.slice(5, 7)}/${+wx.time.slice(8, 10)} ${wx.time.slice(11, 16)}` : '';
  resultData = Object.assign(resultData, {
    dist, rank, land, type: shape.type, air: f.age, maxAlt: Math.round(f.maxAlt),
    windText: t('windDesc', { dir: t(dir16(wx.wd)), ws: wx.ws.toFixed(1) }) + (wxLive ? '' : ' *'), timeText: tm, isBest,
  });
  $('resultFrom').textContent = t('from', { spot: t('p.' + spot.id) });
  $('resultDist').querySelector('b').textContent = dist.toLocaleString('en-US');
  $('resultLand').textContent = t('land_' + land);
  const hero = $('rankHero'); hero.dataset.rank = rank.grade; $('rankGrade').textContent = rank.grade; $('rankTitle').textContent = t('r.' + rank.grade);
  $('statAir').textContent = f.age.toFixed(1); $('statAlt').textContent = Math.round(f.maxAlt);
  $('statWind').textContent = resultData.windText + (tm ? '  ' + tm : '');
  $('bestNote').textContent = isBest && prev ? `${t('newBest')} ${dist.toLocaleString('en-US')}m` : '';
  show('result');
  sound.fanfare(rank.idx >= 4);
  ensureFonts('一筆飛行機ONE-STROKE PLANE0123456789m.RANK' + t('from', { spot: t('p.' + spot.id) }) + t('land_' + land) + t('r.' + rank.grade) + t('t.' + shape.type) + t('airtime') + t('maxAlt') + t('windAt') + t('sec') + resultData.windText + 'uimemocho.github.io/apps/hitofude-hikoki/');
}
async function buildCard() { world.render(); return makeResultCard({ scene: $('world'), r: resultData, pts: shape.pts }); }
window.__card = async () => (await buildCard()).toDataURL('image/png');
$('shareBtn').onclick = async () => {
  sound.ui();
  world.render();
  const card = makeResultCard({ scene: $('world'), r: resultData, pts: shape.pts });
  const url = challengeUrl(shape.pts);
  if (sandboxed) {
    $('sharePreview').src = card.toDataURL('image/png');
    $('shareXLink').href = intentUrl(resultData, url);
    $('copyText').onclick = async () => { try { await navigator.clipboard.writeText(shareText(resultData) + '\n' + url); toast(t('copied')); } catch {} };
    openSheet('share'); return;
  }
  await shareResult(card, resultData, url, () => toast(t('saved')));
};
$('againBtn').onclick = () => { sound.ui(); startAim(); };
$('resultDraw').onclick = () => { sound.ui(); openDraw(); };
$('resultStage').onclick = () => { sound.ui(); placePlane(); openStage(); };

// ───────── タイトル ─────────
$('flyBtn').onclick = () => {
  sound.unlock(); sound.ui();
  if (challenge) { setStroke(challenge, false); placePlane(); }
  openStage();
};
$('drawBtn').onclick = () => { sound.unlock(); sound.ui(); openDraw(); };
$('howtoBtn').onclick = () => openSheet('howto');

// ───────── 設定シート ─────────
let paused = false;
function openSheet(kind) {
  sound.ui(); $('sheet').hidden = false;
  $('settingsBody').hidden = kind !== 'settings'; $('howtoBody').hidden = kind !== 'howto'; $('pauseBody').hidden = kind !== 'pause'; $('shareBody').hidden = kind !== 'share';
  $('sheetTitle').hidden = kind !== 'pause';
  if (kind === 'pause') paused = true;
  syncToggles();
}
function closeSheet() { $('sheet').hidden = true; paused = false; }
$('settingsBtn').onclick = () => openSheet('settings');
$('pauseBtn').onclick = () => openSheet('pause');
$('sheetClose').onclick = () => { sound.ui(); closeSheet(); };
$('sheetTitle').onclick = () => { closeSheet(); flight = null; aimState = null; placePlane(); show('title'); refreshTitle(); };
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
function syncToggles() { document.querySelectorAll('.toggle').forEach(b => { const on = !!settings[b.dataset.key]; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'ON' : 'OFF'; }); }
document.querySelectorAll('.toggle').forEach(b => b.onclick = () => {
  const k = b.dataset.key; settings[k] = !settings[k]; store.set('settings', settings); syncToggles(); sound.unlock();
  if (k === 'se') sound.setSe(settings.se); if (k === 'bgm') sound.setBgm(settings.bgm); if (k === 'vib') sound.vib = settings.vib;
  if (k === 'hq') { world.setHQ(settings.hq); resize(); }
  sound.ui();
});
{
  const sel = $('langSelect'); sel.innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join(''); sel.value = getLang();
  sel.onchange = () => { setLang(sel.value); store.set('lang', sel.value); try { localStorage.setItem('hitofude.lang', JSON.stringify(sel.value)); } catch {} applyI18n(); refreshTitle(); if (screen === 'stage') renderSpots(); if (screen === 'draw') statRows(shape); };
}
applyI18n(); refreshTitle(); syncToggles();

// ───────── ループ ─────────
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), look = new THREE.Vector3(), camPos = new THREE.Vector3();
let camT = 0, heading = new THREE.Vector2(0, -1), titleT = 0, lastThermalMsg = -9;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (paused) { world.render(); return; }
  camT += dt;
  const focus = { x: 0, z: -40 };
  if (screen === 'title' || screen === 'draw' || screen === 'stage' || screen === 'aim') {
    simT += dt;
    // 展望台からの眺め
    titleT += dt;
    const top = T.top;
    if (screen === 'aim') {
      const a = aimState || { power: 0, aim: 0 };
      camYaw += (a.aim * 0.55 - camYaw) * Math.min(1, dt * 6);
      camPos.set(Math.sin(camYaw) * -1.6 + 0.0, top + 1.68, Math.cos(camYaw) * 1.6 + 0.2);
      camera.position.lerp(camPos, Math.min(1, dt * 8));
      look.set(Math.sin(camYaw) * 40, top - 12, -Math.cos(camYaw) * 40 + 0.2);
      camera.lookAt(look);
      // 手に持った機体
      const pw = a.power;
      hand.set(0.16 + Math.sin(a.aim) * 0.1, top + 1.38 - pw * 0.22, 0.35 + pw * 0.55);
      planeObj.position.lerp(hand, Math.min(1, dt * 14));
      planeObj.rotation.set(0.1 + pw * 0.18, -a.aim, Math.sin(camT * 2) * 0.02 - a.aim * 0.3, 'YXZ');
      const g = air.gust(simT);
      $('gustFill').style.width = (g * 100).toFixed(1) + '%';
      $('gustBox').classList.toggle('peak', g > 0.84);
      const pf = $('pullFill'); pf.style.width = Math.min(100, pw / 1.3 * 100) + '%'; pf.classList.toggle('over', pw > 1.03); pf.classList.toggle('max', pw > 0.8 && pw <= 1.03);
      sound.wind(0.25 + g * 0.5 + air.base / 20);
      windHud();
    } else {
      const sway = Math.sin(titleT * 0.12) * 0.35;
      camPos.set(Math.sin(sway) * 1.6, top + 1.9 + Math.sin(titleT * 0.2) * 0.15, 1.9);
      if (snapCam) { camera.position.copy(camPos); snapCam = false; } else camera.position.lerp(camPos, Math.min(1, dt * 2));
      look.set(Math.sin(sway) * 60, top - 34, -160);
      camera.lookAt(look);
      if (planeObj) { planeObj.position.set(0.18, top + 1.35 + Math.sin(titleT * 1.3) * 0.02, 0.4); planeObj.rotation.set(0.12, Math.sin(titleT * 0.5) * 0.1, 0, 'YXZ'); }
      sound.wind(0.12 + air.gust(simT) * 0.2);
    }
    world.update(dt, camT, focus, air.gust(simT), simT);
  } else if (screen === 'flight' && flight) {
    flightReal += dt;
    const f = flight;
    const agl = f.p.y - Math.max(0, T.height(f.p.x, f.p.z));
    let target = flightReal < 0.9 ? (resultData.caught ? 0.35 + flightReal * 0.7 : 1) : Math.min(24, 1.6 + (flightReal - 0.9) * 0.95);
    target = Math.min(target, 1.2 + Math.max(0, agl) * 0.22);
    timeScale += (target - timeScale) * Math.min(1, dt * 3);
    let simDt = dt * timeScale;
    while (simDt > 0 && !f.done) { const h = Math.min(0.04, simDt); f.step(h); simDt -= h; }
    simT = f.t;
    // イベント
    if (f.lift > 1.2 && f.age - lastEvent.thermal > 12) { lastEvent.thermal = f.age; impact(t('i_thermal'), 'THERMAL'); sound.thermal(); }
    if (f.stall > 0.7 && f.age - lastEvent.stall > 6 && f.age > 0.5) { lastEvent.stall = f.age; impact(t('i_stall'), 'STALL', 'bad'); sound.stall(); }
    // 機体の姿勢
    planeObj.position.set(f.p.x, f.p.y, f.p.z);
    planeObj.rotation.set(f.gam + 0.06, -f.psi, -f.phi, 'YXZ');
    world.trailPush(planeObj.position);
    // 追従カメラ
    const hv = Math.hypot(f.v.x, f.v.z);
    if (hv > 0.5) { tmpV.set(f.v.x / hv, f.v.z / hv, 0); heading.lerp(new THREE.Vector2(tmpV.x, tmpV.y), Math.min(1, dt * 2.2)).normalize(); }
    const back = 1.9 + Math.min(1.6, timeScale * 0.07), up = 0.42 + Math.min(0.6, timeScale * 0.025);
    camPos.set(f.p.x - heading.x * back, f.p.y + up, f.p.z - heading.y * back);
    const gh = Math.max(0, T.height(camPos.x, camPos.z)) + 0.8; if (camPos.y < gh) camPos.y = gh;
    camera.position.copy(camPos);
    look.set(f.p.x + heading.x * 9, f.p.y - 0.15, f.p.z + heading.y * 9);
    camera.lookAt(look);
    camera.fov += ((58 + Math.min(14, timeScale * 0.6)) - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix();
    $('hudDist').textContent = Math.round(f.dist).toLocaleString('en-US');
    $('hudAlt').textContent = Math.max(0, Math.round(agl));
    windHud();
    sound.wind(0.35 + Math.min(0.6, timeScale / 30), f.V);
    world.update(dt, camT, { x: f.p.x, z: f.p.z, vx: f.v.x, vz: f.v.z }, air.gust(simT), simT);
    if (f.done) {
      screen = 'land'; landT = 0; world.trail.visible = true;
      const land = LAND[f.landKind] || 'field';
      sound.land(land); flash();
      impact(t('land_' + land), Math.round(f.dist).toLocaleString('en-US') + ' m', 'crit');
      $('steerHint').hidden = true;
    }
  } else if (screen === 'land' && flight) {
    landT += dt;
    const f = flight, a = landT * 0.35;
    camera.fov += (50 - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix();
    camPos.set(f.p.x - heading.x * (2.2 + landT) + Math.sin(a) * 1.4, f.p.y + 1.2 + landT * 0.5, f.p.z - heading.y * (2.2 + landT) + Math.cos(a) * 1.4);
    camera.position.lerp(camPos, Math.min(1, dt * 3));
    camera.lookAt(f.p.x, f.p.y, f.p.z);
    world.update(dt, camT, { x: f.p.x, z: f.p.z }, air.gust(simT), simT);
    sound.wind(0.15);
    if (landT > 2.3) finish();
  } else if (screen === 'result' && flight) {
    const f = flight, a = camT * 0.12;
    camPos.set(f.p.x + Math.sin(a) * 5, f.p.y + 3, f.p.z + Math.cos(a) * 5);
    camera.position.lerp(camPos, Math.min(1, dt * 1.5));
    camera.lookAt(f.p.x, f.p.y + 0.3, f.p.z);
    world.update(dt, camT, { x: f.p.x, z: f.p.z }, air.gust(simT), simT);
    sound.wind(0.1);
  }
  world.render();
}
show('title');
requestAnimationFrame(frame);
loadWeather();
setTimeout(() => { $('boot').classList.add('gone'); }, 350);
document.addEventListener('visibilitychange', () => { if (document.hidden && (screen === 'flight' || screen === 'aim')) openSheet('pause'); });
// 開発・検証用
window.__game = { world, get T() { return T; }, get flight() { return flight; }, get screen() { return screen; }, get shape() { return shape; }, setStroke, startAim, launch: (p, a) => { aimState.power = p; aimState.aim = a; launch(); }, get air() { return air; }, rankFor, loadSpot, get wx() { return wxList; }, get rated() { return rated; } };
