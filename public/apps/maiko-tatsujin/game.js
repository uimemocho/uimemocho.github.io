import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CATEGORIES, STAT_KEYS, DEFAULT_LOOK, KIMONO_COLORS, OBI_COLORS, computeStats, sanitizeLook, randomLook, NPC_NAMES, physicsFor } from './avatar.js';
import { Battle, NpcBrain, STAGE_R, TIME_LIMIT, DASH_MAX, rankFor, levelFor, applyBuff } from './battle.js';
import { buildMaiko } from './maiko.js';
import { woodTexture, lanternTexture, radialTexture, petalTexture } from './textures.js';
import { LANGS, t, setLang, detectLang, applyI18n, getLang } from './i18n.js';
import { Sound } from './audio.js';
import { Net } from './net.js';
import { Sparks, Flares, ObiRibbon } from './fx.js';
import { makeHandle } from './handles.js';
import { makeResultCard, shareResult, ensureFonts, cardSample } from './share.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('maiko.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('maiko.' + k, JSON.stringify(v)); } catch {} },
};
const isMobile = matchMedia('(pointer:coarse)').matches;
const settings = { se: true, bgm: true, vib: true, hq: !isMobile, ...store.get('settings', {}) };
const sound = new Sound(); Object.assign(sound, { se: settings.se, bgm: settings.bgm, vib: settings.vib });
setLang(detectLang());

let look = sanitizeLook(store.get('look', DEFAULT_LOOK));
let playerName = store.get('name', '') || '';
const myName = () => (playerName.trim() || t('nameDefault')).slice(0, 8);

// ───────── レンダラーと舞台 ─────────
const canvas = $('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#141a2e', 14, 34);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
let BASE_FOV = 46;
camera.position.set(0, 4, 8);

scene.add(new THREE.HemisphereLight('#a9b8ff', '#2a1a14', 0.75));
const key = new THREE.SpotLight('#ffe7c4', 125, 30, 0.62, 0.55, 1.6);
key.position.set(4, 11, -2.5); key.target.position.set(0, 0, 0); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.camera.near = 4; key.shadow.camera.far = 22;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#6f8cff', 1.0); rim.position.set(-4, 5, 7); scene.add(rim);
const fill = new THREE.DirectionalLight('#ffe9d6', 0.9); fill.position.set(0.3, 0.6, 1); camera.add(fill); fill.target.position.set(0, 0, -1); camera.add(fill.target); scene.add(camera);
const warm = new THREE.PointLight('#ff8a4a', 14, 12, 1.8); warm.position.set(0, 2.6, 0); scene.add(warm);

// 空・山並み・月
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {}, vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 v;void main(){float h=clamp(v.y*1.4+.15,0.,1.);vec3 c=mix(vec3(.16,.13,.24),vec3(.04,.05,.12),h);c+=vec3(.35,.12,.08)*pow(1.-abs(v.y),12.)*.5;float s=fract(sin(dot(floor(v.xz*300.),vec2(12.9898,78.233)))*43758.5453);c+=step(.9975,s)*step(.15,v.y)*.8;gl_FragColor=vec4(c,1.);}',
  }));
  scene.add(sky);
  const mts = new THREE.Group();
  const r = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(5);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, d = 30 + r() * 6, h = 3 + r() * 5;
    const m = new THREE.Mesh(new THREE.ConeGeometry(5 + r() * 5, h, 5), new THREE.MeshBasicMaterial({ color: '#0f1424', fog: false }));
    m.position.set(Math.cos(a) * d, -1.6 + h / 2, Math.sin(a) * d); mts.add(m);
  }
  scene.add(mts);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
  moon.position.set(-14, 12, -38); moon.lookAt(0, 2, 0); scene.add(moon);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: radialTexture('halo', 'rgba(255,230,190,0.35)', 'rgba(255,230,190,0)'), transparent: true, depthWrite: false, fog: false }));
  halo.position.copy(moon.position).add(new THREE.Vector3(0.1, 0, 0.1)); halo.lookAt(0, 2, 0); scene.add(halo);
}
// 檜舞台
const stage = new THREE.Group(); scene.add(stage);
{
  const wood = woodTexture(); wood.repeat.set(1.2, 1.2);
  const lacquer = new THREE.MeshStandardMaterial({ color: '#8c1220', roughness: 0.32, metalness: 0.1 });
  const top = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.48, metalness: 0.02, color: '#ffe9cf' });
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(STAGE_R + 0.12, STAGE_R + 0.32, 0.42, 72), [lacquer, top, lacquer]);
  disk.position.y = -0.21; disk.receiveShadow = true; stage.add(disk);
  const gold = new THREE.Mesh(new THREE.TorusGeometry(STAGE_R + 0.12, 0.035, 8, 96), new THREE.MeshStandardMaterial({ color: '#e8b84a', metalness: 0.9, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.3 }));
  gold.rotation.x = Math.PI / 2; gold.position.y = 0.0; stage.add(gold);
  const line = new THREE.Mesh(new THREE.RingGeometry(STAGE_R - 0.03, STAGE_R, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }));
  line.rotation.x = -Math.PI / 2; line.position.y = 0.003; stage.add(line);
  const crest = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }));
  crest.rotation.x = -Math.PI / 2; crest.position.y = 0.003; stage.add(crest);
  for (const z of [-1.7, 1.7]) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.04), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.003, z); stage.add(mark);
  }
  // 足場と水面
  const water = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#0b1022', roughness: 0.15, metalness: 0.6 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.4; scene.add(water);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: radialTexture('pool', 'rgba(255,150,80,0.35)', 'rgba(255,150,80,0)'), transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -1.38; scene.add(glow);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 10), lacquer);
    post.position.set(Math.cos(a) * (STAGE_R - 0.4), -1.0, Math.sin(a) * (STAGE_R - 0.4)); scene.add(post);
  }
}
// 提灯
const lanterns = [];
{
  const ltex = lanternTexture();
  const mat = new THREE.MeshStandardMaterial({ map: ltex, emissive: '#ff8a4a', emissiveMap: ltex, emissiveIntensity: 1.6, roughness: 0.8 });
  const cap = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.13, d = STAGE_R + 2.0;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * d, 2.1 + (i % 2) * 0.25, Math.sin(a) * d);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), mat); body.scale.set(1, 1.35, 1); g.add(body);
    for (const y of [-0.44, 0.44]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), cap); c.position.y = y; g.add(c); }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2, 4), cap); cord.position.y = 1.45; g.add(cord);
    g.lookAt(0, g.position.y, 0); scene.add(g); lanterns.push(g);
  }
}
// 花びら
const PETALS = 260;
const petalGeo = new THREE.BufferGeometry();
const petalPos = new Float32Array(PETALS * 3), petalVel = new Float32Array(PETALS * 3);
for (let i = 0; i < PETALS; i++) { petalPos[i * 3] = (Math.random() - 0.5) * 18; petalPos[i * 3 + 1] = Math.random() * 9; petalPos[i * 3 + 2] = (Math.random() - 0.5) * 18; petalVel[i * 3 + 1] = -0.3 - Math.random() * 0.4; }
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ map: petalTexture(), size: 0.16, transparent: true, depthWrite: false, opacity: 0.85 }));
scene.add(petals);
// 火花（光跡つき）と閃光
const sparks = new Sparks(scene, 1100);
const flares = new Flares(scene, 20);
function burst(x, y, z, n, color, speed = 4, opts = {}) {
  sparks.emit(x, y, z, n, { speed, colors: ['#ffffff', color, color, '#ffb347'], ...opts });
}
// 衝撃の波紋
const waves = [];
function wave(x, z, color, size = 1) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); m.scale.setScalar(0.1); scene.add(m);
  waves.push({ m, t: 0, size });
}

// ポストエフェクト
let composer, bloom;
function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9);
  composer.addPass(bloom); composer.addPass(new OutputPass());
}
setupComposer();
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, settings.hq ? 2 : 1.5);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  composer.setPixelRatio(dpr); composer.setSize(w, h);
  bloom.resolution.set(w * dpr * (settings.hq ? 0.5 : 0.35), h * dpr * (settings.hq ? 0.5 : 0.35));
  camera.aspect = w / h; camera.fov = BASE_FOV = w / h < 0.7 ? 48 : 40; camera.updateProjectionMatrix();
  key.shadow.mapSize.set(settings.hq ? 2048 : 1024, settings.hq ? 2048 : 1024); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
}
addEventListener('resize', resize); resize();

// ───────── 状態 ─────────
const S = {
  screen: 'title', maikos: [], battle: null, local: 0, mode: 'one', difficulty: 1, npc: null, net: null, role: null,
  phase: 'idle', pull: null, pullValue: 0, launchedLocal: false, endTimer: 0, shake: 0, hitstop: 0, slow: 1, paused: false,
  oppName: '', oppLook: null, oppTag: '', streak: 0, best: store.get('best', 0), ostreak: 0, obest: store.get('bestOnline', 0), onlineKind: 'random', lastResult: null, peerWantsAgain: false, iWantAgain: false,
  camPos: new THREE.Vector3(0, 1.1, -4.2), camLook: new THREE.Vector3(0, 0.34, 0), dressYaw: 0, time: 0, lastSnap: 0, seenEvents: new Set(), outbox: [],
  critZoom: 0, critRoll: 1,
  render: [], blasts: [], kotens: [], boost: 0, obi: null, grindSnd: 0,
};

function setScreen(name) {
  S.screen = name; document.body.dataset.screen = name;
  for (const [id, n] of [['titleScreen', 'title'], ['dressScreen', 'dress'], ['levelScreen', 'level'], ['onlineScreen', 'online'], ['resultScreen', 'result']]) $(id).hidden = n !== name;
  $('hud').hidden = name !== 'battle';
  document.body.classList.toggle('playing', name === 'battle');
}
function toast(msg, ms = 2200) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); }
function impact(main, sub = '', kind = '') {
  const el = $('impact'); $('impactMain').textContent = main; $('impactSub').textContent = sub; el.dataset.kind = kind;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

// ───────── 舞妓の配置 ─────────
function clearMaikos() { for (const m of S.maikos) { scene.remove(m.root); m.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } S.maikos = []; }
function placeSolo() {
  clearMaikos();
  const m = buildMaiko(look); m.root.position.set(0, 0, 0); scene.add(m.root); S.maikos = [m];
  S.render = [{ x: 0, z: 0, omega: 0, omegaMax: 1, wob: 0, phi: 0, state: 'ready', endT: 0 }];
}

// ───────── タイトル ─────────
function refreshOnlineBest() { $('onlineBest').textContent = S.obest ? t('best', { n: S.obest }) : ''; }
function refreshTitle() {
  $('dressName').textContent = myName();
  $('bestStreak').textContent = S.best ? t('best', { n: S.best }) : '';
}
function goTitle() {
  endNet(); S.phase = 'idle'; S.battle = null; sound.stopWhirl(); sound.playBgm('menu');
  placeSolo(); setScreen('title'); refreshTitle();
}

// ───────── 身支度 ─────────
let activeCat = 'height', prevStats = computeStats(look);
function renderDress() {
  const tabs = $('catTabs'); tabs.innerHTML = '';
  for (const c of CATEGORIES) {
    const b = document.createElement('button'); b.role = 'tab'; b.textContent = t(c.key); b.setAttribute('aria-selected', c.key === activeCat);
    b.onclick = () => { activeCat = c.key; sound.play('tap'); renderDress(); }; tabs.appendChild(b);
  }
  const grid = $('optGrid'); grid.innerHTML = '';
  const cat = CATEGORIES.find(c => c.key === activeCat);
  for (const o of cat.options) {
    const b = document.createElement('button'); b.setAttribute('aria-pressed', look[cat.key] === o.id);
    if (cat.key === 'color' || cat.key === 'obi') { const sw = document.createElement('i'); sw.className = 'swatch'; sw.style.background = cat.key === 'color' ? KIMONO_COLORS[o.id].base : OBI_COLORS[o.id].base; b.appendChild(sw); }
    b.appendChild(document.createTextNode(t(cat.key + '.' + o.id)));
    b.onclick = () => { if (look[cat.key] === o.id) return; prevStats = computeStats(look); look = { ...look, [cat.key]: o.id }; store.set('look', look); sound.play('select'); rebuildDressMaiko(); renderDress(); };
    grid.appendChild(b);
  }
  const st = computeStats(look), bars = $('statBars'); bars.innerHTML = '';
  for (const k of STAT_KEYS) {
    const d = st[k] - prevStats[k], row = document.createElement('div');
    row.innerHTML = `<span>${t(k)}</span><i><b style="width:${st[k]}%"></b></i><em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${st[k]}</em>`;
    bars.appendChild(row);
  }
  prevStats = st;
}
function rebuildDressMaiko() {
  const yaw = S.maikos[0] ? S.maikos[0].spin.rotation.y : 0;
  placeSolo(); S.maikos[0].resetFace(yaw);
  S.maikos[0].root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  burst(0, 0.9, 0, 18, '#ffd6e0', 2);
}
function openDress() {
  setScreen('dress'); $('nameInput').value = playerName; $('nameInput').placeholder = t('nameDefault'); prevStats = computeStats(look); renderDress(); placeSolo(); S.dressYaw = 0;
}

// ───────── 相手の格 ─────────
function renderLevels() {
  const list = $('levelList'); list.innerHTML = '';
  for (let d = 0; d < 4; d++) {
    const b = document.createElement('button'); b.setAttribute('aria-pressed', S.difficulty === d);
    b.innerHTML = `<b>${t('d' + d)}</b><span class="dots">${[0, 1, 2, 3].map(i => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span><small>LV.${d + 1}</small>`;
    b.onclick = () => { S.difficulty = d; sound.play('select'); renderLevels(); };
    list.appendChild(b);
  }
}

// ───────── バトル ─────────
function npcIdentity(rng = Math.random) {
  const n = NPC_NAMES[Math.floor(rng() * NPC_NAMES.length)];
  return getLang().startsWith('zh') || getLang() === 'ja' ? n[0] : n[1];
}
function pickNpcLook(d) {
  const L = randomLook();
  if (d >= 2) { // 強い相手はそれなりに組み合わせを考える
    const builds = [{ height: 'tall', hem: 'wide', okobo: 'mid', kanzashi: 'bekko', item: 'kinchaku' }, { height: 'small', hem: 'narrow', okobo: 'high', kanzashi: 'hana', item: 'sensu' }, { height: 'mid', hem: 'wide', okobo: 'low', kanzashi: 'cho', item: 'kasa' }];
    Object.assign(L, builds[Math.floor(Math.random() * builds.length)]);
  }
  return L;
}

function startBattle(opts) {
  sound.unlock();
  S.mode = opts.mode; S.difficulty = opts.difficulty ?? S.difficulty;
  S.local = opts.local ?? 0; S.role = opts.role || null;
  const lookA = S.local === 0 ? look : opts.oppLook, lookB = S.local === 0 ? opts.oppLook : look;
  S.oppName = opts.oppName; S.oppLook = opts.oppLook; S.oppTag = opts.oppTag || '';
  S.battle = new Battle(lookA, lookB, opts.seed ?? (Math.random() * 1e9) | 0);
  S.level = opts.level || null;
  S.npc = opts.npc ? new NpcBrain(S.battle, 1 - S.local, opts.level || S.difficulty) : null;
  if (opts.npc && opts.level) applyBuff(S.battle.tops[1 - S.local], opts.level.buff);
  S.seenEvents = new Set(); S.outbox = []; S.peerWantsAgain = false; S.iWantAgain = false; S.lastResult = null;
  clearMaikos();
  S.maikos = [buildMaiko(lookA), buildMaiko(lookB)];
  S.render = S.battle.tops.map(a => ({ x: a.x, z: a.z, omega: 0, omegaMax: a.p.omegaMax, wob: 0, phi: 0, state: 'ready', endT: 0 }));
  S.maikos.forEach((m, i) => { scene.add(m.root); m.resetFace(i === 0 ? 0 : Math.PI); m.setRingColor(i === S.local ? '#ffd60a' : '#ff4d5e', 0.75); });
  if (ribbon) { ribbon.dispose(); ribbon = null; } S.obi = null; S.blasts = []; S.kotens = []; S.boost = 0;
  S.launchedLocal = false; S.pullValue = 0; S.pull = null; S.endTimer = 0; S.slow = 1; S.hitstop = 0; S.paused = false;
  document.body.classList.toggle('offline', !S.net && S.mode !== 'online-npc');
  setScreen('battle');
  $('hudMeName').textContent = myName(); $('hudOpName').textContent = S.oppName;
  $('vsMe').textContent = myName(); $('vsOp').textContent = S.oppName; $('vsMeTag').textContent = t('you').toUpperCase(); $('vsOpTag').textContent = S.oppTag;
  $('pullGuide').hidden = true; $('dashBar').hidden = true; $('waitMsg').hidden = true;
  S.phase = 'intro'; S.phaseT = 0;
  const vc = $('vsCut'); vc.classList.remove('show'); vc.classList.toggle('boss', !!(opts.level && opts.level.boss)); void vc.offsetWidth; vc.classList.add('show');
  sound.playBgm('battle'); sound.play('found');
}

function beginPull() {
  S.phase = 'pull'; S.phaseT = 0;
  $('pullGuide').hidden = false; $('pullFill').style.width = '0%';
  resetObi();
}

// 帯を引く入力：引いた分だけ帯が画面外へ伸び、指を離しても勢いで出続ける。引き切ると舞い出す
const OBI_TOTAL = 1.1; // 画面の高さ何個分で帯を引き切るか
const pullState = { id: null, lastX: 0, lastY: 0, lastT: 0, x0: 0, yaw0: 0 };
let ribbon = null;
function resetObi() {
  S.obi = { remain: 1, s: 0, sMax: 0, dragging: false, touched: false, fx: innerWidth / 2, fy: innerHeight * 0.6, drift: 0, lastMove: 0, done: false };
  if (ribbon) ribbon.dispose();
  ribbon = new ObiRibbon(scene, S.maikos[S.local].obiId);
}
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (S.screen === 'dress') { pullState.id = e.pointerId; pullState.x0 = e.clientX; pullState.yaw0 = S.dressYaw; return; }
  if (S.screen !== 'battle' || S.paused) return;
  if (S.phase === 'pull' && !S.launchedLocal && S.obi && !S.obi.done) {
    pullState.id = e.pointerId; pullState.lastX = e.clientX; pullState.lastY = e.clientY; pullState.lastT = performance.now();
    Object.assign(S.obi, { dragging: true, touched: true, fx: e.clientX, fy: e.clientY, lastMove: performance.now() });
    canvas.setPointerCapture(e.pointerId);
  } else if (S.phase === 'battle') localDash();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== pullState.id) return;
  if (S.screen === 'dress') { S.dressYaw = pullState.yaw0 + (e.clientX - pullState.x0) * 0.012; return; }
  const o = S.obi; if (S.phase !== 'pull' || !o || o.done) return;
  const now = performance.now(), dts = Math.max(0.008, (now - pullState.lastT) / 1000);
  const dy = e.clientY - pullState.lastY, dx = e.clientX - pullState.lastX;
  if (dy > 0) {
    o.remain -= dy / innerHeight / OBI_TOTAL;
    const inst = dy / innerHeight / dts;
    o.s = o.s * 0.45 + inst * 0.55; o.lastMove = now; o.sLast = o.s;
  }
  o.drift += dx / innerWidth;
  o.fx = e.clientX; o.fy = Math.max(o.fy, e.clientY);
  pullState.lastX = e.clientX; pullState.lastY = e.clientY; pullState.lastT = now;
});
const endPointer = (e) => {
  if (e.pointerId !== pullState.id) return; pullState.id = null;
  if (S.obi) {
    const o = S.obi; o.dragging = false; if (performance.now() - o.lastMove < 140) o.s = Math.max(o.s, o.sLast || 0);
    // 離した瞬間に帯が抜けて飛び出す（ある程度引けていれば待たせない）
    if (!o.done && o.touched && S.phase === 'pull' && !S.launchedLocal && (o.s > 0.35 || o.remain < 0.75)) { o.pulledFrac = 1 - Math.max(0, o.remain); o.remain = 0; obiComplete(); }
  }
};
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);

const _v = new THREE.Vector3(), _p0 = new THREE.Vector3(), _pf = new THREE.Vector3(), _pe = new THREE.Vector3();
function screenToWorld(x, y, dist, out) {
  _v.set(x / innerWidth * 2 - 1, -(y / innerHeight * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(_v, dist);
}
function updateObi(dt) {
  const o = S.obi; if (!o || !ribbon) return;
  if (o.done) { ribbon.updateFree(dt, camera.position); return; }
  if (S.phase !== 'pull' || S.launchedLocal) return;
  const before = o.remain, now = performance.now();
  if (o.dragging) { if (now - o.lastMove > 70) o.s *= Math.exp(-12 * dt); }
  else if (o.s > 0) { // 慣性で帯が出続ける
    o.remain -= o.s * dt / OBI_TOTAL; o.fy += o.s * dt * innerHeight * 0.8;
    o.s *= Math.exp(-1.7 * dt); if (o.s < 0.03) o.s = 0;
  }
  o.sMax = Math.max(o.sMax, o.s);
  const pulled = Math.max(0, before - o.remain);
  S.maikos[S.local].setTail(o.touched ? Math.max(0, o.remain) : 1);
  $('pullFill').style.width = Math.min(100, (1 - Math.max(0, o.remain)) * 100) + '%';
  $('pullFill').classList.toggle('max', o.s > 2.2);
  sound.setWhirl(2, Math.min(90, o.s * 38), 0);
  if (pulled > 0.004) sound.play('pull', { p: Math.min(1, o.s / 3) });
  if (o.touched) {
    const mk = S.maikos[S.local];
    mk.knot.getWorldPosition(_p0);
    screenToWorld(o.fx, Math.min(o.fy, innerHeight * 1.05), 1.5, _pf);
    screenToWorld(o.fx + o.drift * 40, innerHeight * 1.9, 0.9, _pe);
    // 結び目がカメラの反対側にある時は、胴に巻き付くように腰の周りを回してから引き出す
    const c = mk.root.position, cy = _p0.y, R = 0.27 * (S.battle.tops[S.local].look.height === 'small' ? 0.88 : S.battle.tops[S.local].look.height === 'tall' ? 1.12 : 1);
    const aK = Math.atan2(_p0.z - c.z, _p0.x - c.x), aC = Math.atan2(camera.position.z - c.z, camera.position.x - c.x);
    let d = aC - aK; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const wrap = [];
    const steps = Math.floor(Math.abs(d) / 0.5);
    for (let k = 1; k <= steps; k++) { const a = aK + d * k / (steps + 1); wrap.push(new THREE.Vector3(c.x + Math.cos(a) * R, cy - 0.01 * k, c.z + Math.sin(a) * R)); }
    ribbon.setPath([_p0, ...wrap], _pf, _pe, camera.position, Math.min(1.4, 0.25 + o.s * 0.5), pulled * OBI_TOTAL * 9);
    if (o.s > 1.2 && Math.random() < o.s * dt * 6) sparks.emit(_p0.x, _p0.y, _p0.z, 2, { speed: 2, colors: ['#fff1a8', '#ffd060'], life: 0.35 });
  }
  if (o.remain <= 0) obiComplete();
}
function obiComplete() {
  const o = S.obi; o.done = true; o.dragging = false;
  const power = Math.min(1, 0.2 + 0.4 * Math.min(1, o.sMax / 3) + 0.35 * Math.min(1, o.s / 2.2) + 0.15 * (o.pulledFrac ?? 1));
  const superb = o.s > 2.0 && o.sMax > 2.6;
  const angle = Math.max(-0.7, Math.min(0.7, -o.drift * 0.9));
  // 帯は結び目から外れて画面外へ飛んでいく
  const away = new THREE.Vector3().subVectors(camera.position, _p0).setY(0).normalize().multiplyScalar(9 + o.s * 3); away.y = -3;
  ribbon.release(away);
  S.maikos[S.local].setTail(0);
  sound.setWhirl(2, 0, 0); sound.play('snap');
  localLaunch(power, angle, superb);
}

function localLaunch(power, angle, superb) {
  S.launchedLocal = true; S.pullValue = 0; $('pullGuide').hidden = true;
  if (S.net && S.role === 'guest') { S.net.send({ type: 'launch', power, angle, superb }); }
  else S.battle.launch(S.local, power, angle, superb);
  if (S.npc) {
    const p = S.npc.launchParams(), b = S.battle, go = () => { if (S.battle === b) b.launch(1 - S.local, p.power, p.angle, p.superb); };
    if (S.mode === 'online-npc') setTimeout(go, 80 + Math.random() * 520); else go();
  }
  sound.play('launch');
  if (superb) setTimeout(() => impact(t('superb'), 'SUPERB', 'crit'), 150);
  S.myPower = power;
  if (S.battle.started) onStart(); else if (S.net || S.mode === 'online-npc') { $('waitMsg').hidden = false; }
}
function onStart() {
  if (S.phase === 'battle') return;
  S.phase = 'battle'; S.phaseT = 0; $('waitMsg').hidden = true; $('dashBar').hidden = false;
  const el = $('maie'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sound.play('maie'); flash(); S.shake = 0.9; S.boost = 1; speedLines(); S.camSnap = 0.7;
  S.maikos.forEach((m, i) => {
    m.setTail(0);
    const r = S.render[i], c = i === S.local ? '#ffd60a' : '#ff4d5e';
    sparks.emit(r.x, 0.15, r.z, 120, { speed: 9, up: 0.35, colors: ['#ffffff', c, '#ffb347'], life: 0.7 });
    sparks.emit(r.x, 0.9, r.z, 40, { speed: 6, up: 1.4, colors: ['#ffffff', '#fff1a8'] });
    flares.pop(r.x, 0.6, r.z, 1.3, c, 0.35); wave(r.x, r.z, c, 1.6); wave(r.x, r.z, '#ffffff', 1.0);
  });
}
function localDash() {
  if (!S.battle || S.battle.over) return;
  if (S.net && S.role === 'guest') { const me = S.battle.tops[S.local]; if (me.dashes > 0 && me.state === 'spin') { S.net.send({ type: 'dash' }); sound.play('dash'); } return; }
  if (S.battle.dash(S.local)) { /* 効果音はイベントで */ }
}

// イベント → 演出
function handleEvent(e) {
  if (S.seenEvents.has(e.id)) return; S.seenEvents.add(e.id);
  const loc = S.local;
  switch (e.type) {
    case 'start': onStart(); break;
    case 'hit': {
      const p = Math.min(1, e.power / 6);
      sound.play('hit', { power: e.power });
      burst(e.x, 0.5, e.z, 40 + p * 110 | 0, '#ffd060', 5 + p * 7, { up: 0.6, life: 0.7 });
      flares.pop(e.x, 0.55, e.z, 0.6 + p * 0.9, '#fff1c0', 0.24);
      S.shake = Math.max(S.shake, 0.25 + p * 0.45); S.hitstop = Math.max(S.hitstop, 0.03 + p * 0.04);
      if (e.crit >= 0) {
        const mine = e.crit === loc;
        critImpact(e.x, e.z, mine);
      } else if (p > 0.4) wave(e.x, e.z, '#ffd60a', 0.7);
      break;
    }
    case 'dash': sound.play('dash'); {
      const r = S.render[e.side], a = S.battle.tops[e.side], sp = Math.hypot(a.vx, a.vz) || 1;
      sparks.emit(r.x, 0.2, r.z, 50, { speed: 6, dir: [-a.vx / sp, 0.25, -a.vz / sp], cone: 0.45, colors: ['#ffffff', '#bfe3ff', '#ffd060'], life: 0.5 });
      wave(r.x, r.z, '#ffffff', 0.8); flares.pop(r.x, 0.4, r.z, 1.2, '#ffffff', 0.2);
    } break;
    case 'rim': sound.play('rim'); burst(e.x, 0.15, e.z, 30, '#ffb070', 4, { up: 0.9 }); flares.pop(e.x, 0.2, e.z, 0.9, '#ffb070', 0.2); break;
    case 'out': impact(t('out'), 'RING OUT', e.side === loc ? 'bad' : 'crit'); if (e.dashKO) startBlast(e.side, 'out'); else { sound.play('out'); S.slow = 0.4; } break;
    case 'fallen': impact(t('toppled'), 'TOPPLED', e.side === loc ? 'bad' : 'crit'); if (e.dashKO) startBlast(e.side, 'fallen'); else koten(e.side); break;
    case 'stopped': impact(t('stopped'), 'STOPPED', e.side === loc ? 'bad' : 'crit'); if (e.dashKO) startBlast(e.side, 'stopped'); else koten(e.side); break;
    case 'end': onEnd(e.result); break;
  }
}

// 会心：止め絵＋反転＋カットイン＋光柱。通常ヒットとはっきり区別する
const pillars = [];
const pillarTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); return t; })();
function critImpact(x, z, mine) {
  const cc = mine ? '#ffd60a' : '#ff3b4e', c2 = mine ? '#5ab8ff' : '#ff8a8a';
  sound.play('crit'); sound.play('critBig');
  S.hitstop = 0.24; S.shake = 1.3; S.critZoom = 1; S.critRoll = (Math.random() < 0.5 ? -1 : 1);
  setTimeout(() => { S.slow = 0.35; }, 60);
  document.body.classList.add('crit-invert'); setTimeout(() => { document.body.classList.remove('crit-invert'); flash(); }, 90);
  const cut = $('critCut'); cut.className = mine ? 'mine' : 'theirs'; void cut.offsetWidth; cut.classList.add('show');
  speedLines();
  wave(x, z, cc, 1.8); wave(x, z, '#ffffff', 1.1); wave(x, z, c2, 2.8); setTimeout(() => wave(x, z, cc, 3.6), 120);
  burst(x, 0.6, z, 220, c2, 13, { up: 0.9, life: 1 });
  sparks.emit(x, 0.6, z, 90, { speed: 9, up: 0.5, colors: ['#ffffff', cc, '#ffb347'], life: 0.9 });
  sparks.emit(x, 0.9, z, 70, { speed: 3, up: 1.5, colors: ['#ffd6e0', '#ffb7c9', '#ffffff'], gravity: 0.8, drag: 2.2, life: 1.6 }); // 花びらの爆ぜ
  flares.pop(x, 0.7, z, 2.6, cc, 0.5); flares.pop(x, 0.6, z, 1.2, '#ffffff', 0.3);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, 7, 24, 1, true), new THREE.MeshBasicMaterial({ map: pillarTex, color: cc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.position.set(x, 3.4, z); scene.add(m); pillars.push({ m, t: 0 });
}
function updatePillars(dt) {
  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i]; p.t += dt; const k = p.t / 0.7;
    p.m.scale.set(1 + k * 1.5, 1, 1 + k * 1.5); p.m.material.opacity = Math.max(0, 1 - k) * (k < 0.08 ? k / 0.08 : 1);
    if (k >= 1) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); pillars.splice(i, 1); }
  }
}

// 決着：負けた舞妓を吹っ飛ばす（演出のみ）
function startBlast(side, why) {
  if (S.blasts[side]) return;
  const r = S.render[side], o = S.render[1 - side];
  let dx = r.x - o.x, dz = r.z - o.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { dx = r.x || 0.01; dz = r.z || 0.01; d = Math.hypot(dx, dz); }
  dx /= d; dz /= d;
  const speed = why === 'out' ? 9 : 7.5;
  const axis = new THREE.Vector3(-dz, 0.25 * (Math.random() - 0.5), dx).normalize();
  S.blasts[side] = { dx, dz, pos: new THREE.Vector3(r.x, 0, r.z), vel: new THREE.Vector3(dx * speed, 7, dz * speed), axis, rot: 0, rotSpeed: 13 + Math.random() * 5, splashed: false, t: 0, spin: 0 };
  sound.play('ko'); flash(); speedLines(); S.hitstop = 0.16; S.slow = 0.28; S.shake = 1.2;
  sparks.emit(r.x, 0.6, r.z, 160, { speed: 12, up: 0.9, colors: ['#fff1a8', '#ffd060', '#ff9a3c', '#ff6a3c'], life: 1 });
  sparks.emit(r.x, 0.6, r.z, 60, { speed: 7, dir: [dx, 0.6, dz], cone: 0.35, colors: ['#ffffff', '#ffd060'], life: 0.9 });
  flares.pop(r.x, 0.7, r.z, 2.0, side === S.local ? '#ff4d5e' : '#ffd60a', 0.45); flares.pop(r.x, 0.7, r.z, 1.0, '#ffffff', 0.25);
  wave(r.x, r.z, '#ffffff', 2.2); wave(r.x, r.z, side === S.local ? '#ff3b4e' : '#5ab8ff', 3.2);
}
function updateBlasts(dt) {
  S.blasts.forEach((b, i) => {
    if (!b) return; b.t += dt;
    const m = S.maikos[i]; if (!m) return;
    if (!b.splashed) {
      b.vel.y -= 11 * dt; b.pos.addScaledVector(b.vel, dt); b.rot += b.rotSpeed * dt;
      const onStage = Math.hypot(b.pos.x, b.pos.z) < STAGE_R + 0.2;
      if (onStage && b.pos.y < 0.28 && b.vel.y < 0) { b.pos.y = 0.28; b.vel.y *= -0.45; b.vel.x *= 0.8; b.vel.z *= 0.8; sparks.emit(b.pos.x, 0.1, b.pos.z, 40, { speed: 6, up: 0.6 }); sound.play('rim'); S.shake = Math.max(S.shake, 0.5); }
      if (!onStage && b.pos.y < -1.35) {
        b.splashed = true; b.vel.multiplyScalar(0.12);
        sparks.emit(b.pos.x, -1.35, b.pos.z, 160, { speed: 7, up: 2.5, colors: ['#ffffff', '#cfe8ff', '#8fc8ff'], gravity: 12, drag: 1.2, life: 1.1 });
        wave(b.pos.x, b.pos.z, '#cfe8ff', 2.4); waves[waves.length - 1].m.position.y = -1.36;
        sound.play('splash'); S.shake = Math.max(S.shake, 0.4);
      }
      if (Math.random() < 0.9) sparks.emit(b.pos.x, b.pos.y + 0.6, b.pos.z, 4, { speed: 1.5, colors: ['#ffd060', '#ffffff'], life: 0.5, gravity: 2 });
    } else { b.pos.y -= dt * 0.6; b.rot += dt * 1.5; }
    m.root.position.copy(b.pos);
    m.root.quaternion.setFromAxisAngle(b.axis, b.rot);
    m.root.visible = b.pos.y > -3;
  });
}
// 回転が尽きたら、その場でコテン
function koten(side) {
  S.slow = 0.5; S.kotens.push({ side, t: 0, done: false });
}
function updateKotens(dt) {
  for (const k of S.kotens) {
    k.t += dt;
    if (!k.done && k.t > 0.42) {
      k.done = true; const r = S.render[k.side];
      const ox = Math.sin(r.phi) * 0.5, oz = Math.cos(r.phi) * 0.5;
      sparks.emit(r.x - oz * 0.6, 0.05, r.z + ox * 0.6, 26, { speed: 1.6, up: 0.5, colors: ['#e9d9c0', '#cbb89a', '#ffffff'], gravity: 1.5, drag: 3, life: 0.8 });
      sound.play('koten'); S.shake = Math.max(S.shake, 0.3);
    }
  }
}
function speedLines() { const el = $('speedLines'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

function onEnd(result) {
  if (S.phase === 'end') return;
  S.phase = 'end'; S.endTimer = 0; S.lastResult = result;
  $('dashBar').hidden = true; sound.stopWhirl();
  if (result.kimarite === 'decision' || result.kimarite === 'draw') impact(t('timeup'), 'TIME', '');
  if (S.net && S.role === 'host') S.net.send({ type: 'snap', s: S.battle.snapshot(), ev: [...S.outbox.splice(0), { type: 'end', result, id: 1e9 }] });
}

function streakFamily() {
  if (S.mode === 'streak') return 'offline';
  if (S.mode === 'online-npc' || (S.mode === 'online' && S.onlineKind === 'random')) return 'online';
  return null;
}
function showResult() {
  const b = S.battle, r = S.lastResult || b.result, me = b.tops[S.local];
  const out = r.winner === -1 ? 'draw' : r.winner === S.local ? 'win' : 'lose';
  const rank = rankFor(b, S.local, S.net || S.mode === 'online-npc' ? 2 : S.difficulty);
  const el = $('resultScreen'); el.dataset.out = out;
  $('resultTitle').textContent = t(out);
  const kim = r.kimarite === 'forfeit' ? 'k.forfeit' : 'k.' + (r.kimarite || 'draw');
  $('resultKimarite').textContent = t('kimarite') + '：' + t(kim);
  $('resultMode').textContent = (streakFamily() === 'online' ? t('online') + ' / ' + t('streak') : S.mode === 'online' ? t('online') + ' / ' + t('one') + ' · ' + t('roomCode') : S.mode === 'streak' ? t('streak') : t('one')) + '　vs ' + S.oppName;
  $('rankHero').dataset.rank = rank.grade; $('rankGrade').textContent = rank.grade; $('rankTitle').textContent = t('r.' + rank.grade);
  const rpm = Math.round(me.maxOmega * 60 / (Math.PI * 2));
  $('statRpm').textContent = rpm; $('statCrit').textContent = me.crits; $('statTime').textContent = (r.time ?? b.t).toFixed(1);
  $('statRemain').textContent = me.state === 'spin' ? Math.min(100, Math.round(me.omega / me.p.omegaMax * 100)) : 0;
  // 勝ち抜き
  let streakText = '', n = 0;
  const fam = streakFamily();
  if (fam) {
    const key = fam === 'online' ? 'ostreak' : 'streak', bestKey = fam === 'online' ? 'obest' : 'best';
    if (out === 'win') S[key]++;
    n = S[key];
    streakText = out === 'win' ? t('streakN', { n }) : t('streakEnd', { n });
    if (n > S[bestKey]) { S[bestKey] = n; store.set(fam === 'online' ? 'bestOnline' : 'best', n); }
  }
  const streakWin = !!fam && out === 'win' && n >= 2;
  const headline = streakWin ? t('streakWin', { n }) : t(out);
  const ht = $('resultTitle'); ht.textContent = headline; ht.classList.toggle('streak-win', streakWin); ht.classList.toggle('long', headline.length > 7);
  $('streakLine').textContent = streakWin ? '' : streakText;
  $('againBtn').textContent = fam && out === 'win' ? t('next') : t('again');
  S.result = { out, headline, rank, kimarite: kim, rpm, crits: me.crits, time: r.time ?? b.t, streak: fam ? n : 0, streakEnded: !!fam && out !== 'win' };
  setScreen('result');
  sound.play(out === 'win' ? 'win' : 'lose'); setTimeout(() => sound.play('rank'), 450);
  S.shareCache = null;
}

// ───────── オンライン ─────────
function endNet() { if (S.net) { S.net.close(); S.net = null; } clearInterval(S.seekTick); S.role = null; }
function showOnlineStatus(msg, code) {
  $('onlineStatus').hidden = false; $('onlineMsg').textContent = msg;
  $('roomCodeShow').hidden = !code; if (code) $('roomCodeNum').textContent = code;
  $('onlineMain').hidden = true; $('friendMenu').hidden = true;
}
function resetOnlineUi(view = 'main') { $('onlineStatus').hidden = true; $('onlineMain').hidden = view !== 'main'; $('friendMenu').hidden = view !== 'friend'; $('joinRow').hidden = true; $('seekProgress').style.width = '0%'; }
async function openNet(keepTimer = false) {
  if (keepTimer) { if (S.net) { S.net.close(); S.net = null; } } else endNet();
  const net = new Net(); S.net = net;
  try { await net.connect(); } catch { if (S.net === net) { S.net = null; } throw new Error('connect'); }
  if (S.net !== net) { net.close(); throw new Error('cancelled'); }
  net.on('matched', (m) => onMatched(m));
  net.on('msg', (m) => onNetMsg(m));
  net.on('drop', () => { if (S.net === net && S.screen === 'battle' && S.phase !== 'end') opponentLeft(); });
  return net;
}
// 相手が見つからない時は、そのままオンラインの相手として対戦を始める
function quietMatch() {
  endNet(); clearInterval(S.seekTick);
  if (S.screen !== 'online') return;
  const L0 = levelFor(Math.max(1, S.ostreak + 1 + (Math.random() < 0.3 ? -1 : Math.random() < 0.2 ? 1 : 0))), L = { ...L0, boss: false, buff: Math.min(0, L0.buff) }, d = L.grade, oppLook = d >= 2 ? pickNpcLook(d) : randomLook();
  const name = makeHandle(getLang(), myName());
  S.ghost = { name, look: oppLook, d, L };
  sound.play('found'); showOnlineStatus(t('found')); $('seekProgress').style.width = '100%';
  setTimeout(() => { if (S.screen === 'online') startBattle({ mode: 'online-npc', difficulty: d, level: L, oppLook, oppName: name, oppTag: 'ONLINE', npc: true }); }, 700);
}
async function randomMatch() {
  S.onlineKind = 'random';
  sound.unlock(); endNet(); showOnlineStatus(t('searching')); $('seekProgress').style.width = '0%';
  let t0 = performance.now(), LIMIT = 2500 + Math.random() * 4500; // 探している時間はばらつかせる
  clearInterval(S.seekTick);
  S.seekTick = setInterval(() => {
    const k = (performance.now() - t0) / LIMIT; $('seekProgress').style.width = Math.min(96, k * 100) + '%';
    if (k >= 1 && !(S.net && (S.net.mode === 'room' || S.net.pending))) quietMatch();
  }, 100);
  let net; try { net = await openNet(true); } catch { return; } // 接続できなくても、時間が来たら対戦開始
  if (S.screen !== 'online' || S.net !== net) return;
  t0 = performance.now(); LIMIT = 4000 + Math.random() * 5000; // つながったら本物の相手を探す時間を確保
  net.seek({ name: myName(), look });
}
async function createRoom() {
  S.onlineKind = 'room';
  sound.unlock(); showOnlineStatus(t('searching'));
  let net; try { net = await openNet(); } catch { showOnlineStatus(t('connectFail')); return; }
  const code = net.createRoom({ name: myName(), look });
  showOnlineStatus(t('roomWait'), code);
}
async function joinRoom() {
  S.onlineKind = 'room';
  const code = $('codeInput').value.replace(/\D/g, '');
  if (code.length !== 4) { $('codeInput').focus(); return; }
  sound.unlock(); showOnlineStatus(t('searching'));
  let net; try { net = await openNet(); } catch { showOnlineStatus(t('connectFail')); return; }
  net.joinRoom(code, { name: myName(), look });
  showOnlineStatus(t('roomWait'), code);
}
function onMatched(m) {
  clearInterval(S.seekTick); sound.play('found');
  showOnlineStatus(t('found'));
  S.role = m.role; S.peer = { name: String(m.peer?.name || '???').slice(0, 8), look: sanitizeLook(m.peer?.look) };
  if (m.role === 'host') setTimeout(() => hostStart(), 700);
}
function hostStart() {
  if (!S.net) return;
  const seed = (Math.random() * 1e9) | 0;
  S.net.send({ type: 'start', seed, name: myName(), look });
  startBattle({ mode: 'online', local: 0, role: 'host', oppLook: S.peer.look, oppName: S.peer.name, oppTag: 'ONLINE', seed });
  S.pullDeadline = performance.now() + 20000;
}
function onNetMsg(m) {
  switch (m.type) {
    case 'start':
      if (S.role !== 'guest') return;
      S.peer = { name: String(m.name || S.peer?.name || '???').slice(0, 8), look: sanitizeLook(m.look) };
      startBattle({ mode: 'online', local: 1, role: 'guest', oppLook: S.peer.look, oppName: S.peer.name, oppTag: 'ONLINE', seed: m.seed });
      break;
    case 'launch': if (S.role === 'host' && S.battle) { S.battle.launch(1, +m.power || 0.3, +m.angle || 0, !!m.superb); if (S.battle.started) onStart(); } break;
    case 'dash': if (S.role === 'host' && S.battle) S.battle.dash(1); break;
    case 'snap':
      if (S.role !== 'guest' || !S.battle) return;
      S.battle.applySnapshot(m.s);
      for (const e of m.ev || []) handleEvent(e);
      if (S.battle.started && S.phase !== 'battle' && S.phase !== 'end') onStart();
      break;
    case 'again':
      S.peerWantsAgain = true;
      if (S.iWantAgain && S.role === 'host') hostStart(); else if (S.screen === 'result') toast(t('again') + '?');
      break;
    case 'bye': opponentLeft(); break;
  }
}
function opponentLeft() {
  if (!S.net) return;
  if (S.screen !== 'battle' && streakFamily() === 'online') { endNet(); return; } // 勝ち抜きでは次へ進むだけ
  toast(t('left'), 3000);
  if (S.screen === 'battle' && S.battle && S.phase !== 'end') {
    endNet(); S.lastResult = { winner: S.local, kimarite: 'forfeit', time: S.battle.t };
    S.battle.over = true; S.battle.result = S.lastResult; onEnd(S.lastResult);
  } else endNet();
}

// ───────── メインループ ─────────
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
function lerpRender(dt) {
  const b = S.battle;
  b.tops.forEach((a, i) => {
    const r = S.render[i], k = S.role === 'guest' ? 0.35 : 1;
    r.x += (a.x - r.x) * k; r.z += (a.z - r.z) * k;
    r.omegaMax = a.p.omegaMax; r.wob += (a.wob - r.wob) * (S.role === 'guest' ? 0.3 : 1);
    r.phi = a.phi; r.endT = a.endT;
    if (S.phase === 'end' && a.state === 'spin') { // 勝者はゆっくり舞い止まって決めポーズ
      r.omega = Math.min(r.omega || a.omega, a.omega) * Math.exp(-1.3 * dt);
      r.state = r.omega < 9 ? 'ready' : 'spin'; r.wob *= 0.95;
    } else { r.omega = a.omega; r.state = a.state; }
  });
}
let rawDtCam = 0.016;
function updateCamera(dt) {
  const back = S.local === 0 ? 1 : -1;
  const desiredPos = tmpV, desiredLook = tmpL;
  if (S.screen === 'title') {
    const a = S.time * 0.12;
    desiredPos.set(Math.sin(a) * 4.2, 1.1, -Math.cos(a) * 4.2); desiredLook.set(0, 0.34, 0);
  } else if (S.screen === 'dress') {
    const aspect = innerWidth / innerHeight;
    desiredPos.set(0.15, 0.95, aspect < 0.6 ? -3.3 : -2.7); desiredLook.set(0, aspect < 0.6 ? 0.02 : 0.25, 0);
  } else if (S.screen === 'level' || S.screen === 'online') {
    desiredPos.set(2.3, 1.3, -2.6); desiredLook.set(-0.6, 0.75, 0);
  } else if (S.battle) {
    const me = S.render[S.local], op = S.render[1 - S.local];
    if (S.phase === 'intro') {
      const k = Math.min(1, S.phaseT / 1.8);
      desiredPos.set(Math.sin(k * 1.4 - 0.7) * 6, 2.6 + (1 - k) * 2, back * (5.5 - k * 1.2)); desiredLook.set(0, 0.6, 0);
    } else if (S.phase === 'pull' || (S.phase !== 'battle' && S.phase !== 'end')) {
      desiredPos.set(me.x + 0.55 * back, 1.75, me.z + back * 2.75); desiredLook.set(me.x - 0.1 * back, 0.3, me.z - back * 1.4);
    } else if (S.phase === 'battle') {
      const cx = me.x * 0.55 + op.x * 0.45, cz = me.z * 0.55 + op.z * 0.45;
      const sep = Math.hypot(me.x - op.x, me.z - op.z), d = Math.max(6.2, Math.min(10.5, 5.2 + sep * 1.15));
      desiredPos.set(cx * 0.6, d * 0.78, cz * 0.6 + back * d * 0.64); desiredLook.set(cx * 0.85, 0.2, cz * 0.85 - back * 0.3);
    } else if (S.blasts.some(Boolean) && S.endTimer < 1.4) { // 吹っ飛ぶ舞妓を追う
      const bl = S.blasts.find(Boolean);
      desiredPos.set(-bl.dx * 5.5 - bl.dz * 2.2, 3.6, -bl.dz * 5.5 + bl.dx * 2.2); desiredLook.set(bl.pos.x * 0.75, Math.max(-1.2, bl.pos.y * 0.7), bl.pos.z * 0.75);
    } else { // end：勝者に寄る
      const w = S.battle.result && S.battle.result.winner >= 0 ? S.render[S.battle.result.winner] : me;
      const a = S.endTimer * 0.35;
      desiredPos.set(w.x + Math.sin(a) * 2.6, 1.5, w.z + back * Math.cos(a) * 2.6); desiredLook.set(w.x, 0.7, w.z);
    }
  }
  if (S.camSnap > 0) S.camSnap -= dt;
  const k = 1 - Math.exp(-dt * (S.camSnap > 0 ? 9 : S.phase === 'battle' ? 3.2 : 2.4));
  S.camPos.lerp(desiredPos, k); S.camLook.lerp(desiredLook, k);
  camera.position.copy(S.camPos);
  if (S.shake > 0) { const s = S.shake * S.shake * 0.25; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; S.shake = Math.max(0, S.shake - dt * 2.2); }
  camera.lookAt(S.camLook);
  if (S.critZoom > 0) {
    S.critZoom = Math.max(0, S.critZoom - rawDtCam * 2.2);
    const e = S.critZoom * S.critZoom;
    camera.fov = BASE_FOV - 12 * e; camera.updateProjectionMatrix();
    camera.rotateZ(0.14 * e * S.critRoll);
    if (S.critZoom === 0) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
  }
}

function updateHud() {
  const b = S.battle; if (!b) return;
  const me = b.tops[S.local], op = b.tops[1 - S.local];
  const g = (a) => a.state === 'spin' ? Math.max(0, a.omega / a.p.omegaMax) : 0;
  $('hudMeGauge').style.width = (g(me) * 100) + '%'; $('hudOpGauge').style.width = (g(op) * 100) + '%';
  $('hudMeRpm').textContent = Math.round(me.omega * 9.549) + ' rpm'; $('hudOpRpm').textContent = Math.round(op.omega * 9.549) + ' rpm';
  document.querySelector('.plate.me').classList.toggle('low', g(me) < 0.25 && me.state === 'spin' && b.started);
  document.querySelector('.plate.op').classList.toggle('low', g(op) < 0.25 && op.state === 'spin' && b.started);
  const left = Math.max(0, TIME_LIMIT - b.t); $('hudTime').textContent = Math.ceil(left);
  document.querySelector('.clock').classList.toggle('warn', left < 10 && b.started);
  const pips = document.querySelectorAll('.pips i');
  pips.forEach((p, i) => { const on = i < me.dashes; p.className = on ? 'on' : ''; p.innerHTML = !on && i === me.dashes ? `<b style="width:${Math.min(100, me.dashT / 3.5 * 100)}%"></b>` : ''; });
}

function frame() {
  requestAnimationFrame(frame);
  const rawDt = Math.min(clock.getDelta(), 0.25);
  let dt = Math.min(rawDt, 0.05);
  S.time += dt;
  if (S.paused) { composer.render(); return; }
  if (S.hitstop > 0) { S.hitstop -= dt; dt *= 0.08; }
  const simDt = dt * S.slow;
  S.slow += (1 - S.slow) * Math.min(1, dt * 1.2);

  if (S.screen === 'battle' && S.battle) {
    S.phaseT += rawDt;
    if (S.phase === 'intro' && S.phaseT > 1.7) beginPull();
    // ホストまたはオフラインのみ物理を進める
    if (!S.net || S.role === 'host') {
      if (S.npc) S.npc.update(simDt);
      S.battle.update(simDt);
      // ゲストの引きが遅い場合は弱めに自動発射
      if (S.net && S.role === 'host' && !S.battle.started && S.launchedLocal && performance.now() > S.pullDeadline) S.battle.launch(1, 0.3, 0, false);
      const evs = S.battle.drainEvents();
      if (S.net && S.role === 'host') {
        S.outbox.push(...evs);
        if (performance.now() - S.lastSnap > 50) { S.lastSnap = performance.now(); S.net.send({ type: 'snap', s: S.battle.snapshot(), ev: S.outbox.splice(0) }); }
        if (S.net.silentFor() > 9000 && S.phase !== 'end') opponentLeft();
      }
      for (const e of evs) handleEvent(e);
    } else if (S.net && S.role === 'guest') {
      if (performance.now() - S.lastSnap > 1000) { S.lastSnap = performance.now(); S.net.send({ type: 'ping' }); }
      if (S.net.silentFor() > 9000 && S.phase !== 'end') opponentLeft();
    }
    lerpRender(rawDt);
    if (S.phase === 'end') { S.endTimer += rawDt; if (S.endTimer > 3.3 && S.screen === 'battle') showResult(); }
    updateHud();
  }

  updateObi(dt);
  S.boost = Math.max(0, S.boost - dt * 0.6);
  // 舞妓の描画
  S.maikos.forEach((m, i) => {
    const r = S.render[i]; if (!r) return;
    let y = 0, state = r.state;
    if (S.blasts[i]) { m.update({ dt, omega: 0, omegaMax: 1, wob: 0, phi: 0, state: 'ready', preSpin: 18 }); return; }
    if (state === 'out') { y = -r.endT * r.endT * 5; state = 'fallen'; }
    if (state === 'stopped') state = 'fallen';
    m.root.position.set(r.x, y, r.z);
    // 裾が舞台を擦る火花
    if (S.screen === 'battle' && r.state === 'spin' && S.battle && S.battle.started) {
      const ratio = r.omega / r.omegaMax, rate = (ratio * ratio * 26 + S.boost * 90) * dt, rad = S.battle.tops[i].p.radius * 0.82;
      let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      while (n-- > 0) {
        const a = Math.random() * Math.PI * 2, ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
        sparks.emit(r.x + ox, 0.04, r.z + oz, 1, { speed: 2.5 + ratio * 3 + S.boost * 4, dir: [oz / rad, 0.45, -ox / rad], cone: 0.35, life: 0.4, colors: i === S.local ? ['#ffffff', '#ffe27a', '#ffb347'] : ['#ffffff', '#ffb0a0', '#ff7a5c'] });
      }
      if (rate > 0.6 && performance.now() - S.grindSnd > 90) { S.grindSnd = performance.now(); sound.play('grind', { k: Math.min(1, rate / 3) }); }
    }
    const winner = S.battle && S.battle.result && S.battle.result.winner === i && S.phase === 'end';
    let faceTo = 0;
    if (winner) { const dx = camera.position.x - r.x, dz = camera.position.z - r.z; faceTo = Math.atan2(-dx, -dz); }
    const pulling = S.phase === 'pull' && i === S.local && !S.launchedLocal;
    const preSpin = pulling && S.obi ? S.obi.s * 9 : 0;
    // 相手が近い時は袖や帯の広がりを抑えて、相手の体にめり込ませない
    let flareCap = 9, flareCapD = 9;
    if (S.battle && S.maikos.length === 2 && !S.blasts[i]) {
      const o = S.render[1 - i], ob = S.battle.tops[1 - i], me = S.battle.tops[i];
      const H = me.look.height === 'small' ? 0.88 : me.look.height === 'tall' ? 1.12 : 1;
      const g = (Math.hypot(o.x - r.x, o.z - r.z) - ob.p.radius * 0.9 - 0.04) / H;
      flareCap = g <= 0.24 ? 0.05 : Math.asin(Math.min(1, (g - 0.24) / 0.55));
      flareCapD = g <= 0.26 ? 0.05 : Math.asin(Math.min(1, (g - 0.26) / 0.62));
    }
    m.update({ dt, preSpin, flareCap, flareCapD, boost: S.boost, omega: S.screen === 'title' ? 0 : r.omega, omegaMax: r.omegaMax, wob: r.wob, phi: r.phi, state: S.screen === 'title' || S.screen === 'dress' ? 'ready' : state, pull: pulling && S.obi ? Math.min(1, S.obi.s / 2.5) : 0, pullHint: pulling && S.obi && !S.obi.touched, win: winner && r.state !== 'spin', faceTo });
    if (S.screen === 'dress' && i === 0) m.spin.rotation.y = S.dressYaw + Math.sin(S.time * 0.6) * 0.15;
    if (S.screen === 'title' && i === 0) m.spin.rotation.y = Math.sin(S.time * 0.5) * 0.4;
    if (S.battle && S.screen === 'battle') sound.setWhirl(i, r.state === 'spin' ? r.omega : 0, (r.x / STAGE_R) * (S.local === 0 ? 1 : -1));
  });

  // 花びら：回転中の舞妓の周りで渦を巻く
  for (let i = 0; i < PETALS; i++) {
    const k = i * 3; let x = petalPos[k], y = petalPos[k + 1], z = petalPos[k + 2];
    let vx = petalVel[k] + Math.sin(S.time * 0.7 + i) * 0.25, vz = petalVel[k + 2] + Math.cos(S.time * 0.5 + i * 1.3) * 0.25;
    for (const r of S.render) {
      if (!r || r.state !== 'spin') continue;
      const dx = x - r.x, dz = z - r.z, d2 = dx * dx + dz * dz;
      if (d2 < 2.5 && y < 1.6) { const f = (r.omega / 80) * 2.4 / (0.3 + d2); vx += -dz * f; vz += dx * f; petalVel[k + 1] = Math.max(petalVel[k + 1], 0.3 * f); }
    }
    petalVel[k + 1] += (-0.45 - petalVel[k + 1]) * dt * 0.8;
    x += vx * dt; y += petalVel[k + 1] * dt; z += vz * dt;
    if (y < -0.5 || Math.abs(x) > 12 || Math.abs(z) > 12) { x = (Math.random() - 0.5) * 16; y = 6 + Math.random() * 3; z = (Math.random() - 0.5) * 16; petalVel[k + 1] = -0.4; }
    petalPos[k] = x; petalPos[k + 1] = y; petalPos[k + 2] = z;
  }
  petalGeo.attributes.position.needsUpdate = true;
  // 火花
  sparks.update(dt, STAGE_R + 0.1); flares.update(dt);
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]; w.t += dt; const k = w.t / 0.55;
    w.m.scale.setScalar(0.2 + k * 2.4 * w.size); w.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); waves.splice(i, 1); }
  }
  updateBlasts(dt * S.slow); updateKotens(dt); updatePillars(rawDt);
  lanterns.forEach((l, i) => { l.rotation.z = Math.sin(S.time * 0.8 + i) * 0.04; });
  warm.intensity = 12 + Math.sin(S.time * 3.1) * 1.2;

  rawDtCam = rawDt; updateCamera(dt);
  composer.render();
}

// ───────── 設定・シート ─────────
function openSheet(kind) {
  $('sheet').hidden = false;
  $('settingsBody').hidden = kind !== 'settings'; $('howtoBody').hidden = kind !== 'howto'; $('pauseBody').hidden = kind !== 'pause';
  $('sheetTitle').hidden = kind !== 'pause';
  $('sheetClose').textContent = kind === 'pause' ? t('resume') : t('close');
  if (kind === 'settings') renderSettings();
  if (S.screen === 'battle' && !S.net && S.mode !== 'online-npc') S.paused = true;
}
function closeSheet() { $('sheet').hidden = true; S.paused = false; clock.getDelta(); }
function renderSettings() {
  document.querySelectorAll('.toggle').forEach(b => {
    const k = b.dataset.key, on = !!settings[k];
    b.setAttribute('aria-pressed', on); b.textContent = k === 'hq' ? (on ? t('high') : t('normal')) : (on ? t('on') : t('off'));
  });
  const sel = $('langSelect'); if (!sel.options.length) for (const [k, n] of LANGS) sel.add(new Option(n, k));
  sel.value = getLang();
}
document.querySelectorAll('.toggle').forEach(b => b.onclick = () => {
  const k = b.dataset.key; settings[k] = !settings[k]; store.set('settings', settings);
  Object.assign(sound, { se: settings.se, bgm: settings.bgm, vib: settings.vib }); sound.applyToggles();
  if (k === 'hq') resize();
  sound.play('tap'); renderSettings();
});
$('langSelect').onchange = (e) => { setLang(e.target.value); applyI18n(); renderSettings(); refreshTitle(); if (S.screen === 'dress') renderDress(); if (S.screen === 'level') renderLevels(); };

// ───────── ボタン配線 ─────────
const click = (id, fn) => $(id).addEventListener('click', () => { sound.unlock(); sound.play('tap'); fn(); });
click('oneBtn', () => { S.streak = 0; startStreakBout(); });
click('levelBack', () => goTitle());
click('levelGo', () => { const oppLook = pickNpcLook(S.difficulty); startBattle({ mode: 'one', difficulty: S.difficulty, oppLook, oppName: npcIdentity(), oppTag: t('npc') + ' · ' + t('d' + S.difficulty), npc: true }); });
function startStreakBout() {
  const L = levelFor(S.streak + 1);
  startBattle({ mode: 'streak', difficulty: L.grade, level: L, oppLook: pickNpcLook(L.boss ? 3 : L.grade), oppName: npcIdentity(), oppTag: t('bout', { n: L.n }) + (L.boss ? ' · ' + t('boss') : ''), npc: true });
}
click('onlineBtn', () => { S.ostreak = 0; setScreen('online'); resetOnlineUi(); refreshOnlineBest(); $('onlineName').value = playerName; $('onlineName').placeholder = t('nameDefault'); });
click('onlineBack', () => { endNet(); goTitle(); });
click('onlineCancel', () => { endNet(); resetOnlineUi(S.onlineKind === 'room' ? 'friend' : 'main'); });
click('friendBtn', () => resetOnlineUi('friend'));
click('friendBack', () => resetOnlineUi('main'));
click('joinMenuBtn', () => { $('joinRow').hidden = false; $('codeInput').focus(); });
click('randomMatchBtn', randomMatch);
click('createRoomBtn', createRoom);
click('joinRoomBtn', joinRoom);
click('dressBtn', openDress);
click('resultDress', () => { endNet(); openDress(); });
click('dressBack', () => goTitle());
click('dressDone', () => { goTitle(); toast(t('done')); });
click('randomLook', () => { prevStats = computeStats(look); look = randomLook(); store.set('look', look); rebuildDressMaiko(); renderDress(); });
for (const id of ['nameInput', 'onlineName']) $(id).addEventListener('input', (e) => { playerName = e.target.value.slice(0, 8); store.set('name', playerName); refreshTitle(); });
click('howtoBtn', () => openSheet('howto'));
click('settingsBtn', () => openSheet('settings'));
click('pauseBtn', () => openSheet('pause'));
click('sheetClose', closeSheet);
click('sheetTitle', () => { closeSheet(); goTitle(); });
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
click('resultTitleBtn', () => goTitle());
click('againBtn', () => {
  if (streakFamily() === 'online') { // 勝ち抜き：次の相手を探す（負けたら0から）
    if (S.result && S.result.out !== 'win') S.ostreak = 0;
    endNet(); setScreen('online'); resetOnlineUi(); refreshOnlineBest(); randomMatch(); return;
  }
  if (S.mode === 'online' && S.net) {
    S.iWantAgain = true; S.net.send({ type: 'again' });
    if (S.peerWantsAgain && S.role === 'host') hostStart(); else toast(t('waiting'));
    return;
  }
  if (S.mode === 'streak') { if (S.result && S.result.out !== 'win') S.streak = 0; startStreakBout(); return; }
  startBattle({ mode: 'one', difficulty: S.difficulty, oppLook: pickNpcLook(S.difficulty), oppName: npcIdentity(), oppTag: t('npc') + ' · ' + t('d' + S.difficulty), npc: true });
});
// シェア用に16:9で撮り直す（舞妓を右側に）
function renderCardScene() {
  const W = 1200, H = 675, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 120);
  const r = S.battle && S.battle.result && S.battle.result.winner >= 0 ? S.render[S.battle.result.winner] : S.render[S.local] || { x: 0, z: 0 };
  const dir = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(r.x, 0.7, r.z)).setY(0).normalize();
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  cam.position.set(r.x + dir.x * 3.6, 1.15, r.z + dir.z * 3.6);
  cam.lookAt(r.x - side.x * 1.0, 0.6, r.z - side.z * 1.0);
  const prevTarget = renderer.getRenderTarget(), prevPR = renderer.getPixelRatio();
  renderer.setRenderTarget(rt); renderer.render(scene, cam); 
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(prevTarget); rt.dispose();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  ctx.putImageData(img, 0, 0); return cv;
}
click('shareBtn', async () => {
  try {
    await ensureFonts(cardSample(S.result, myName(), S.oppName));
    const card = makeResultCard({ canvas: renderCardScene(), result: S.result, me: myName(), opp: S.oppName, mode: S.mode, look });
    await shareResult(card, S.result, () => toast(t('saveImage')));
  } catch (e) { console.warn(e); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S.screen === 'battle' && !S.net && S.mode !== 'online-npc' && S.phase === 'battle') openSheet('pause'); });
addEventListener('pagehide', () => endNet());

// ───────── 起動 ─────────
applyI18n();
placeSolo(); setScreen('title'); refreshTitle();
requestAnimationFrame(frame);
Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
  $('oneBtn').disabled = false; $('boot').classList.add('gone'); lanternTexture().userData.redraw(); sound.playBgm('menu');
});
window.__maiko = { startStreakBout, renderer, info: () => renderer.info.render, renderCardScene, renderNow: () => composer.render(), S, startBattle, look: () => look, pickNpcLook, localLaunch, physicsFor };
