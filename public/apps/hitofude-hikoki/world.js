// 3Dの世界：空・街・山・海・天候・紙飛行機
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { hash2, fbm } from './terrain.js';
import { wxKind } from './weather.js';

const TSIZE = 4200, TN = 150; // 地形グリッド
const MAXB = 2400, MAXT = 2600;

// 時間帯（JST）から空の色
export function skyPhase(wx, now = new Date()) {
  const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const h = jst.getHours() + jst.getMinutes() / 60;
  if (!wx.isDay) return (h > 16 && h < 19.3) || (h > 4 && h < 6) ? 'twilight' : 'night';
  if (h < 7.2 || h > 15.6) return 'golden';
  return 'day';
}
const PALETTE = {
  day: { top: '#3f7fd6', hor: '#bfd8ef', sun: '#fff4e0', sunI: 2.6, hemiS: '#cfe3ff', hemiG: '#6d6450', hemiI: 1.0, night: 0, exposure: 1.0 },
  golden: { top: '#3c5ea8', hor: '#ffc38a', sun: '#ffb36b', sunI: 2.4, hemiS: '#ffd9b5', hemiG: '#4b3b38', hemiI: 0.85, night: 0.15, exposure: 1.02 },
  twilight: { top: '#1b2550', hor: '#e07a5f', sun: '#ff9a6b', sunI: 0.9, hemiS: '#8a86c8', hemiG: '#2a2030', hemiI: 0.55, night: 0.75, exposure: 1.1 },
  night: { top: '#060b1d', hor: '#1b2747', sun: '#aab8ff', sunI: 0.5, hemiS: '#5d6aa8', hemiG: '#141020', hemiI: 0.42, night: 1, exposure: 1.18 },
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#bfd8ef', 400, 4600);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 9000);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight('#cfe3ff', '#6d6450', 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffffff', 0.35); fill.position.set(0, 0.4, 1); camera.add(fill); fill.target.position.set(0, 0, -1); camera.add(fill.target);

  // 空
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, cloud: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 top,hor,sunCol,sunDir;uniform float night,cloud;varying vec3 v;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){float y=max(v.y,0.);vec3 c=mix(hor,top,pow(y,.55));c=mix(c,hor*.8,smoothstep(0.,-.2,v.y));
      float s=max(dot(v,normalize(sunDir)),0.);c+=sunCol*(pow(s,700.)*(1.-cloud)*2.5+pow(s,8.)*.25);
      vec2 g=floor(v.xz/(v.y+1.2)*1100.);float st=step(.9985,h(g))*smoothstep(.05,.35,v.y)*night*(1.-cloud*.9);c+=vec3(st);
      gl_FragColor=vec4(c,1.);}`,
  }));
  sky.renderOrder = -10; scene.add(sky);
  // 月
  const moon = new THREE.Mesh(new THREE.CircleGeometry(70, 32), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
  scene.add(moon);

  // 地形
  const tGeo = new THREE.PlaneGeometry(TSIZE, TSIZE, TN, TN); tGeo.rotateX(-Math.PI / 2);
  tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tGeo.attributes.position.count * 3), 3));
  const tMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrainMesh = new THREE.Mesh(tGeo, tMat); scene.add(terrainMesh);
  const baseXZ = Float32Array.from(tGeo.attributes.position.array);

  // 海
  const waterTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), img = c.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const n1 = fbm(x / 16, y / 16, 3), n2 = fbm(x / 16 + 5, y / 16 + 9, 3); const i = (y * 128 + x) * 4; img.data[i] = 128 + (n1 - 0.5) * 180; img.data[i + 1] = 128 + (n2 - 0.5) * 180; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160); return t;
  })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshPhongMaterial({ color: '#1d4766', specular: '#bcd4ff', shininess: 90, normalMap: waterTex, normalScale: new THREE.Vector2(0.35, 0.35) }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0; scene.add(water);

  // 建物（窓は世界座標から生成）
  const night = { value: 0 };
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  bMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix*instanceMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;varying vec3 vWP;varying vec3 vWN;float wh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if(abs(vWN.y)<.5){vec2 q=vec2(abs(vWN.x)>.5?vWP.z:vWP.x,vWP.y);vec2 cell=floor(q/vec2(3.2,3.6));vec2 f=fract(q/vec2(3.2,3.6));
        float win=step(.18,f.x)*step(f.x,.82)*step(.28,f.y)*step(f.y,.8);
        float lit=step(.52,wh(cell+floor(vWP.xz*.03)));diffuseColor.rgb*=1.-win*.35;
        totalEmissiveRadiance+=win*lit*uNight*mix(vec3(1.,.78,.45),vec3(.75,.85,1.),wh(cell*1.7))*1.6;}
        else{totalEmissiveRadiance+=uNight*vec3(.02,.02,.03);}`);
  };
  const buildings = new THREE.InstancedMesh(bGeo, bMat, MAXB); buildings.count = 0; buildings.frustumCulled = false; scene.add(buildings);
  // 木
  const trGeo = new THREE.ConeGeometry(1, 1, 6); trGeo.translate(0, 0.5, 0);
  const trees = new THREE.InstancedMesh(trGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAXT); trees.count = 0; trees.frustumCulled = false; scene.add(trees);

  // 展望台
  const deck = new THREE.Group(); scene.add(deck);
  const lampLights = [];
  {
    const stone = new THREE.MeshLambertMaterial({ color: '#6f6d6a' }), metal = new THREE.MeshLambertMaterial({ color: '#2b3442' });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 9), stone); floor.position.set(0, -0.5, -0.4); deck.add(floor);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 0.06), metal); rail.position.set(0, 1.05, -4.9); deck.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 0.55; deck.add(rail2);
    for (let i = -9; i <= 9; i += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), metal); p.position.set(i, 0.55, -4.9); deck.add(p); }
    for (const x of [-7, 7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), metal); pole.position.set(x, 1.7, -3.6); deck.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a8' })); bulb.position.set(x, 3.45, -3.6); deck.add(bulb);
      const pl = new THREE.PointLight('#ffcf8a', 0, 14, 1.6); pl.position.copy(bulb.position); deck.add(pl); lampLights.push([pl, bulb]);
    }
  }
  // 吹き流し（風向きと強さが見える）
  const flagGeo = new THREE.PlaneGeometry(1.6, 0.36, 16, 2); flagGeo.translate(0.8, 0, 0);
  const flagBase = Float32Array.from(flagGeo.attributes.position.array);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: '#ff4d5e', side: THREE.DoubleSide, emissive: '#3a0a10' }));
  const flagPole = new THREE.Group(); flagPole.position.set(2.6, 0, -3.2); deck.add(flagPole);
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 4.2, 6), new THREE.MeshLambertMaterial({ color: '#d6dfec' })); fp.position.y = 2.1; flagPole.add(fp);
  flag.position.y = 3.95; flagPole.add(flag);

  // 富士山（遠景）
  const fuji = (() => {
    const g = new THREE.ConeGeometry(5200, 2600, 48, 6, true); const col = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 2600 + 0.5; const c = y > 0.72 ? new THREE.Color('#f2f6ff') : new THREE.Color('#4f6690').lerp(new THREE.Color('#7f94b8'), y); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.92 })); m.visible = false; scene.add(m); return m;
  })();

  // 雲
  const puff = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 44 + Math.random() * 44, r = 18 + Math.random() * 26; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const clouds = [];
  for (let i = 0; i < 36; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: true, color: '#ffffff' })); scene.add(s); clouds.push(s); }

  // 雨・雪
  const RAIN = 1400;
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN * 6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c9d6ea', transparent: true, opacity: 0.45, fog: false })); rain.frustumCulled = false; scene.add(rain);
  const rainP = new Float32Array(RAIN * 3).map(() => (Math.random() - 0.5) * 80);
  // 風の筋
  const WS = 140;
  const wsGeo = new THREE.BufferGeometry(); wsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WS * 6), 3));
  wsGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WS * 6), 3));
  const streaks = new THREE.LineSegments(wsGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); streaks.frustumCulled = false; scene.add(streaks);
  const wsP = new Float32Array(WS * 4).map((_, i) => i % 4 === 3 ? Math.random() : (Math.random() - 0.5) * 40);
  // 上昇気流の目印（光の粒）
  const TH = 600;
  const thGeo = new THREE.BufferGeometry(); thGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TH * 3), 3));
  const thermalPts = new THREE.Points(thGeo, new THREE.PointsMaterial({ color: '#ffe9a8', size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); thermalPts.frustumCulled = false; scene.add(thermalPts);
  const thSeed = new Float32Array(TH * 3).map(() => Math.random());

  // 軌跡
  const TRAIL = 70;
  const trGeo2 = new THREE.BufferGeometry(); trGeo2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  trGeo2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trGeo2, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; scene.add(trail);
  let trailN = 0;

  // ポストエフェクト
  let composer, bloom, grain, hq = true;
  function setupComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.82); composer.addPass(bloom);
    grain = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, t: { value: 0 }, amt: { value: 0.045 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;uniform float t,amt;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+t)*43758.5453);}void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;c.rgb*=1.-dot(d,d)*.55;c.rgb+=(h(vUv*913.)-.5)*amt;gl_FragColor=c;}',
    });
    composer.addPass(grain);
    composer.addPass(new OutputPass());
  }
  setupComposer();

  let T = null, air = null, phase = 'day', kind = 'clear', center = { x: 1e9, z: 1e9 };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
  const KCOL = { 0: '#22343c', 1: '#7d7a72', 2: '#2c4528', 3: '#6b7a43', 4: '#2a3c44', 5: '#86837d' };

  function rebuild(cx, cz) {
    center = { x: cx, z: cz };
    const pos = tGeo.attributes.position, col = tGeo.attributes.color, nightK = PALETTE[phase].night;
    const snow = kind === 'snow';
    for (let i = 0; i < pos.count; i++) {
      const x = baseXZ[i * 3] + cx, z = baseXZ[i * 3 + 2] + cz;
      const h = T.height(x, z); pos.setY(i, h); pos.setX(i, x); pos.setZ(i, z);
      const k = T.kind(x, z);
      tmpC.set(KCOL[k]);
      const n = fbm(x * 0.01, z * 0.01, 2);
      tmpC.multiplyScalar(0.82 + n * 0.36);
      if (k === 2 && h > 260) tmpC.lerp(new THREE.Color('#5b6b4a'), Math.min(1, (h - 260) / 500) * 0.5);
      if (snow && k !== 0 && k !== 4) tmpC.lerp(new THREE.Color('#e8eef6'), 0.75);
      if (k === 1) tmpC.lerp(new THREE.Color('#a39a8a'), n * 0.3);
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
    // 建物
    let nb = 0; const R = 1500, C = 30;
    const gx0 = Math.floor((cx - R) / C), gx1 = Math.floor((cx + R) / C), gz0 = Math.floor((cz - R) / C), gz1 = Math.floor((cz + R) / C);
    const dens = T.P.town || 1;
    for (let gx = gx0; gx <= gx1 && nb < MAXB; gx++) for (let gz = gz0; gz <= gz1 && nb < MAXB; gz++) {
      const x = (gx + 0.5) * C, z = (gz + 0.5) * C;
      if ((x - cx) ** 2 + (z - cz) ** 2 > R * R) continue;
      if (T.kind(x, z) !== 1) continue;
      const r = hash2(gx * 1.3, gz * 0.7); if (r > 0.62) continue;
      const core = fbm(x * 0.0009 + 9, z * 0.0009, 2) * dens;
      const hgt = 6 + Math.pow(hash2(gz, gx), 3) * 30 + Math.max(0, core - 0.45) * 220 * hash2(gx + 3, gz);
      const w = 10 + hash2(gx + 7, gz) * 14, d = 10 + hash2(gx, gz + 7) * 14;
      const y = T.height(x, z) - 1;
      tmpP.set(x + (r - 0.3) * 6, y, z); tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.floor(r * 4) * 0.08); tmpS.set(w, hgt, d);
      tmpM.compose(tmpP, tmpQ, tmpS); buildings.setMatrixAt(nb, tmpM);
      tmpC.setHSL(0.08 + hash2(gx, gz + 1) * 0.08, 0.06 + hash2(gz, gx + 1) * 0.1, 0.55 + hash2(gx + 2, gz) * 0.3); buildings.setColorAt(nb, tmpC);
      nb++;
    }
    buildings.count = nb; buildings.instanceMatrix.needsUpdate = true; if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    // 木
    let nt = 0; const RT = 1000, CT = 20;
    for (let gx = Math.floor((cx - RT) / CT); gx <= Math.floor((cx + RT) / CT) && nt < MAXT; gx++) for (let gz = Math.floor((cz - RT) / CT); gz <= Math.floor((cz + RT) / CT) && nt < MAXT; gz++) {
      const x = (gx + hash2(gx, gz)) * CT, z = (gz + hash2(gz, gx)) * CT;
      if ((x - cx) ** 2 + (z - cz) ** 2 > RT * RT) continue;
      const k = T.kind(x, z); if (k !== 2 && !(k === 3 && hash2(gx + 5, gz) < 0.08)) continue;
      if (hash2(gx * 0.7, gz * 1.9) > 0.55) continue;
      if (Math.hypot(x, z - 1) < 26) continue; // 展望台の周りは空ける
      const th = T.height(x, z); if (z < 0 && th > T.top - 32 && Math.abs(x) < -z * 1.4 + 40) continue; // 眺望を遮らない
      const s = 4 + hash2(gx + 1, gz + 2) * 4;
      tmpP.set(x, T.height(x, z) - 0.5, z); tmpQ.identity(); tmpS.set(s, s * (1.7 + hash2(gz, gx + 9)), s);
      tmpM.compose(tmpP, tmpQ, tmpS); trees.setMatrixAt(nt, tmpM);
      tmpC.setHSL(0.27 + hash2(gx, gz + 3) * 0.07, 0.35, 0.16 + hash2(gx + 4, gz) * 0.1); if (kind === 'snow') tmpC.lerp(new THREE.Color('#dfe7f0'), 0.6); trees.setColorAt(nt, tmpC);
      nt++;
    }
    trees.count = nt; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  }

  function setSpot(spot, wx, terrain, airModel) {
    T = terrain; air = airModel; phase = skyPhase(wx); kind = wxKind(wx.code);
    const P = PALETTE[phase];
    const wet = kind === 'rain' || kind === 'thunder' || kind === 'snow';
    const cl = Math.min(1, (wx.cloud ?? 30) / 100);
    const top = new THREE.Color(P.top), hor = new THREE.Color(P.hor);
    if (wet || kind === 'fog' || cl > 0.7) { const grey = new THREE.Color(phase === 'night' ? '#151a26' : '#9aa4b2'); top.lerp(grey, 0.55 + (wet ? 0.2 : 0)); hor.lerp(grey, 0.5); }
    skyU.top.value.copy(top); skyU.hor.value.copy(hor); skyU.night.value = P.night; skyU.cloud.value = wet ? 1 : cl * 0.6;
    scene.fog.color.copy(hor);
    scene.fog.near = kind === 'fog' ? 60 : wet ? 200 : 500; scene.fog.far = kind === 'fog' ? 900 : wet ? 2600 : 4800;
    // 太陽／月の向き：時間帯で高さ、方角は投げる向きに対してやや斜め前
    const elev = phase === 'day' ? 0.9 : phase === 'golden' ? 0.22 : phase === 'twilight' ? 0.06 : 0.6;
    const az = (spot.heading > 90 && spot.heading < 270) ? 0.7 : -0.6;
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
    skyU.sunDir.value.copy(sd); skyU.sunCol.value.set(phase === 'night' ? '#000000' : P.sun);
    sun.color.set(P.sun); sun.intensity = P.sunI * (wet ? 0.45 : 1 - cl * 0.35);
    hemi.color.set(P.hemiS); hemi.groundColor.set(P.hemiG); hemi.intensity = P.hemiI;
    renderer.toneMappingExposure = P.exposure;
    night.value = P.night;
    moon.visible = phase === 'night' && !wet && cl < 0.85;
    moon.userData.dir = new THREE.Vector3(-Math.sin(az) * 0.6, 0.45, -0.75).normalize();
    lampLights.forEach(([pl, b]) => { pl.intensity = P.night > 0.5 ? 18 : 0; b.material.color.set(P.night > 0.5 ? '#ffe2a8' : '#c8c2b4'); });
    water.material.color.set(phase === 'night' ? '#0b1a2c' : phase === 'twilight' ? '#2a2f4a' : '#1d4766');
    deck.position.set(0, T.top, 0);
    fuji.visible = !!T.P.fuji && !wet && kind !== 'fog';
    // 雲の配置
    const n = Math.round(6 + cl * 30);
    clouds.forEach((s, i) => {
      s.visible = i < n;
      const a = hash2(i, 3) * Math.PI * 2, r = 600 + hash2(i, 9) * 3400;
      s.position.set(Math.cos(a) * r, T.top + 380 + hash2(i, 5) * 700, -Math.abs(Math.sin(a)) * r - 300);
      const sc = 500 + hash2(i, 7) * 900; s.scale.set(sc * 1.8, sc, 1);
      s.material.color.set(phase === 'night' ? '#39445e' : phase === 'twilight' ? '#e8a58f' : wet ? '#a3abb6' : '#ffffff');
      s.material.opacity = phase === 'night' ? 0.5 : 0.85;
    });
    rain.visible = wet; rain.material.color.set(kind === 'snow' ? '#ffffff' : '#c9d6ea');
    trailN = 0; trGeo2.setDrawRange(0, 0);
    rebuild(0, -TSIZE * 0.3);
  }

  // 紙飛行機の3Dモデル
  function makePlane(shape, tex) {
    const S = 0.32, pts = shape.pts;
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch { tris = []; }
    const area = (tri) => Math.abs((contour[tri[1]].x - contour[tri[0]].x) * (contour[tri[2]].y - contour[tri[0]].y) - (contour[tri[2]].x - contour[tri[0]].x) * (contour[tri[1]].y - contour[tri[0]].y)) / 2;
    const covered = tris.reduce((s, t) => s + area(t), 0);
    const pos = [], uv = [], idx = [];
    const dihedral = 0.22;
    const vtx = (x, y) => { pos.push(x * S, Math.abs(x) * dihedral * S, -y * S); uv.push((x + 1) / 2, (y + 1) / 2); return pos.length / 3 - 1; };
    if (tris.length && covered > shape.A * 0.6) {
      contour.forEach(p => vtx(p.x, p.y));
      tris.forEach(t => idx.push(t[0], t[1], t[2]));
    } else {
      // 自己交差などで分割できない時は重心からの扇
      const c = vtx(shape.cx, shape.cy); contour.forEach(p => vtx(p.x, p.y));
      for (let i = 0; i < contour.length; i++) idx.push(c, 1 + i, 1 + (i + 1) % contour.length);
    }
    // 竜骨（中央の折り目の下側）
    const yTop = Math.min(0.98, shape.cy + shape.len * 0.42), yTail = shape.cy - shape.len * 0.38;
    const k0 = vtx(0, yTop), k1 = vtx(0, yTail), k2 = pos.length / 3; pos.push(0, -0.1 * S, -(yTail + shape.len * 0.15) * S); uv.push(0.5, (yTail + 1) / 2);
    idx.push(k0, k1, k2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const map = new THREE.CanvasTexture(tex); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.12 + night.value * 0.3 }));
    const grp = new THREE.Group(); grp.add(m);
    // 重心が原点に来るように
    m.position.z = shape.cy * S;
    return grp;
  }

  function trailPush(p) {
    const a = trGeo2.attributes.position.array;
    if (trailN < TRAIL) trailN++;
    a.copyWithin(3, 0, (TRAIL - 1) * 3); a[0] = p.x; a[1] = p.y; a[2] = p.z;
    const c = trGeo2.attributes.color.array;
    for (let i = 0; i < trailN; i++) { const f = 1 - i / trailN; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f * f * 0.45; }
    trGeo2.attributes.position.needsUpdate = true; trGeo2.attributes.color.needsUpdate = true; trGeo2.setDrawRange(0, trailN);
  }
  function trailClear() { trailN = 0; trGeo2.setDrawRange(0, 0); }

  const wv = { x: 0, y: 0, z: 0, g: 0 };
  function update(dt, t, focus, gust, sim) {
    // focus: 追従位置（飛行機）
    if (Math.hypot(focus.x - center.x, focus.z - center.z) > 650) rebuild(Math.round(focus.x / 40) * 40 + (focus.vx || 0) * 20, Math.round(focus.z / 40) * 40 + (focus.vz || 0) * 20);
    sky.position.copy(camera.position);
    if (moon.visible) { moon.position.copy(camera.position).addScaledVector(moon.userData.dir, 7000); moon.lookAt(camera.position); }
    if (fuji.visible) { const b = -0.32; fuji.position.set(camera.position.x + Math.sin(b) * 7600, -200, camera.position.z - Math.cos(b) * 7600); }
    water.position.x = Math.round(camera.position.x / 50) * 50; water.position.z = Math.round(camera.position.z / 50) * 50;
    waterTex.offset.x = t * 0.01; waterTex.offset.y = t * 0.006;
    sun.position.copy(camera.position).addScaledVector(skyU.sunDir.value, 500); sun.target.position.copy(camera.position);
    grain.uniforms.t.value = t % 10;
    for (const c of clouds) { if (!c.visible) continue; const dx = c.position.x - camera.position.x, dz = c.position.z - camera.position.z; if (Math.abs(dx) > 4200) c.position.x -= Math.sign(dx) * 8400; if (Math.abs(dz) > 4200) c.position.z -= Math.sign(dz) * 8400; }
    // 吹き流し
    if (air) {
      const s = air.base + 0.6 + (gust || 0) * 3;
      flagPole.rotation.y = Math.atan2(-air.wzv, air.wxv);
      const p = flagGeo.attributes.position, amp = Math.min(1, s / 8);
      for (let i = 0; i < p.count; i++) {
        const bx = flagBase[i * 3], by = flagBase[i * 3 + 1];
        const u = bx / 1.6, wave = Math.sin(t * (6 + s) - u * 7) * 0.12 * u * (0.4 + amp);
        const droop = (1 - amp) * u * 1.1;
        p.setXYZ(i, bx * (0.55 + amp * 0.45), by - droop * 0.9 + wave * 0.3, wave);
      }
      p.needsUpdate = true; flagGeo.computeVertexNormals();
    }
    // 風の筋（カメラの周り）
    if (air) {
      const a = wsGeo.attributes.position.array, ca = wsGeo.attributes.color.array, cam = camera.position;
      air.at(cam.x, cam.y, cam.z, sim, wv);
      const sp = Math.hypot(wv.x, wv.z) + 0.3, ux = wv.x / sp, uz = wv.z / sp;
      const vis = Math.min(1, 0.15 + sp / 10) * (0.35 + (gust || 0) * 0.65);
      for (let i = 0; i < WS; i++) {
        const o = i * 4;
        wsP[o] += wv.x * dt * 2; wsP[o + 1] += wv.y * dt * 2; wsP[o + 2] += wv.z * dt * 2; wsP[o + 3] += dt * 0.6;
        for (let k = 0; k < 3; k++) if (Math.abs(wsP[o + k]) > 22) wsP[o + k] = -Math.sign(wsP[o + k]) * 20;
        if (wsP[o + 3] > 1) wsP[o + 3] = 0;
        const x = cam.x + wsP[o], y = cam.y + wsP[o + 1] * 0.5, z = cam.z + wsP[o + 2], L = 0.8 + sp * 0.35;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - ux * L; a[i * 6 + 4] = y; a[i * 6 + 5] = z - uz * L;
        const f = Math.sin(wsP[o + 3] * Math.PI) * vis * 0.55;
        ca[i * 6] = ca[i * 6 + 1] = ca[i * 6 + 2] = f; ca[i * 6 + 3] = ca[i * 6 + 4] = ca[i * 6 + 5] = 0;
      }
      wsGeo.attributes.position.needsUpdate = true; wsGeo.attributes.color.needsUpdate = true;
    }
    // 雨・雪
    if (rain.visible) {
      const a = rainGeo.attributes.position.array, cam = camera.position, snow = kind === 'snow';
      const fall = snow ? 2.2 : 24, wx = air ? air.wxv * air.base : 0, wz = air ? air.wzv * air.base : 0;
      for (let i = 0; i < RAIN; i++) {
        rainP[i * 3] += wx * dt * 0.6; rainP[i * 3 + 1] -= fall * dt; rainP[i * 3 + 2] += wz * dt * 0.6;
        if (rainP[i * 3 + 1] < -40) rainP[i * 3 + 1] += 80; for (const k of [0, 2]) if (Math.abs(rainP[i * 3 + k]) > 40) rainP[i * 3 + k] *= -0.98;
        const x = cam.x + rainP[i * 3], y = cam.y + rainP[i * 3 + 1], z = cam.z + rainP[i * 3 + 2];
        const L = snow ? 0.08 : 0.9;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - wx * 0.02; a[i * 6 + 4] = y + L; a[i * 6 + 5] = z - wz * 0.02;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // 上昇気流の粒（近くの熱上昇の柱）
    if (air && air.thermal > 0) {
      thermalPts.visible = true;
      const a = thGeo.attributes.position.array, C = 520, f = focus;
      const gx = Math.floor(f.x / C), gz = Math.floor(f.z / C); let k = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const h = hash2(gx + i + 101, gz + j + 37); if (h < 0.5) continue;
        const ox = (gx + i + 0.5 + (hash2(gx + i, gz + j) - 0.5) * 0.5) * C, oz = (gz + j + 0.5 + (hash2(gz + j, gx + i) - 0.5) * 0.5) * C;
        const rad = 60 + h * 60;
        for (let q = 0; q < 66 && k < TH; q++, k++) {
          const s0 = thSeed[k * 3], s1 = thSeed[k * 3 + 1], s2 = thSeed[k * 3 + 2];
          const ang = s0 * 6.283 + t * 0.4, rr = Math.sqrt(s1) * rad;
          const base = Math.max(0, T.height(ox, oz));
          a[k * 3] = ox + Math.cos(ang) * rr; a[k * 3 + 2] = oz + Math.sin(ang) * rr; a[k * 3 + 1] = base + ((s2 * 900 + t * 40 * (0.6 + h)) % 900);
        }
      }
      for (; k < TH; k++) a[k * 3 + 1] = -9999;
      thGeo.attributes.position.needsUpdate = true;
    } else thermalPts.visible = false;
  }

  function resize(w, h, dpr) {
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function render() { if (hq) composer.render(); else renderer.render(scene, camera); }
  function setHQ(v) { hq = v; }
  return { fuji, trail, renderer, scene, camera, setSpot, update, render, resize, makePlane, trailPush, trailClear, setHQ, get T() { return T; }, deck };
}
