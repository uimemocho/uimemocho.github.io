import * as T from "./three.module.js";
import { drawSoftwareCar } from "./software-car.js";
import { disposePassenger } from "./passengers.js";
import { createEndingCrowd, celebrationHeight } from "./ending-scene.js";
import { splitDoorShell, DOOR_HINGE } from "./taxi-door.js";
import { makeBoardingPassenger, updateBoardingPassenger, boardingPose } from "./boarding.js";
import { taxiContactPoints, taxiContactHeight, TAXI_PIVOT_Y, ROAD_SURFACE_Y } from "./taxi-contact.js";
import { drawGoalBanner, drawChecker } from "./goal-banner.js";
import { ITEMS, ITEM_KINDS, pickupKind, drawItemIcon } from "./items.js";
import { pickupGeometry } from "./pickup-model.js";
import { mergeGeometries } from "./merge.js";
import { random, LANES, jumpHeight } from "./simulation.js";
import { roadOffset, clamp, viewConfig } from "./track.js";
import { CityWorld, streetPlacement, personType, objectSize, speedIntensity } from "./city-world.js";
import { appearance, weatherState } from "./weather.js";
import { roadLayout } from "./road-mesh.js";
import { TAXI_BODY, TAXI_WINDOWS, TAXI_PILLARS, outwardPanel, sedanBodyGeometry, TAXI_WHEEL_Z, TAXI_WHEEL_RADIUS } from "./taxi-model.js";
import { PaperPost } from "./postfx.js";
export function paperStyleEnabled() {
  try {
    return localStorage.getItem("taxi-paper-style") !== "off";
  } catch {
    return true;
  }
}
// 発光エフェクト用：加算合成・トーンマップ対象外・HDR値でブルームに乗せる
function glowMaterial(hex, power = 1, opacity = 1) {
  const m = new T.MeshBasicMaterial({
    color: new T.Color(hex).multiplyScalar(power),
    transparent: true,
    opacity,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  m.userData.basePower = power;
  return m;
}
// 根元が明るく先端で消える炎の円錐（頂点色で減衰、加算なので黒＝透明）
function flameCone(radius, length, segments) {
  const g = new T.ConeGeometry(radius, length, segments, 4, true);
  const p = g.getAttribute("position"),
    colors = [];
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + length / 2) / length,
      v = Math.pow(Math.min(1, Math.max(0, 1 - t)), 0.7);
    colors.push(v, v, v);
  }
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  return g;
}
function glowSpriteTexture() {
  // DOM不要のデータテクスチャ（テストのNode環境でも生成できる）
  const n = 64,
    data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.min(1, Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2)),
        v = Math.round(255 * Math.pow(1 - d, 2.2)),
        i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = v;
    }
  const t = new T.DataTexture(data, n, n);
  t.magFilter = t.minFilter = T.LinearFilter;
  t.needsUpdate = true;
  return t;
}
// キラキラ：星形の点スプライトを1ドローで描く（アイテム周り・無敵で消えたもの・無敵中のタクシー）
const SPARKLE_MAX = 640;
class Sparkles {
  constructor() {
    const g = new T.BufferGeometry();
    this.pos = new Float32Array(SPARKLE_MAX * 3);
    this.col = new Float32Array(SPARKLE_MAX * 3);
    this.size = new Float32Array(SPARKLE_MAX);
    this.phase = new Float32Array(SPARKLE_MAX);
    g.setAttribute("position", new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute("aColor", new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute("aSize", new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute("aPhase", new T.BufferAttribute(this.phase, 1).setUsage(T.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 } },
      vertexShader: `attribute vec3 aColor;attribute float aSize,aPhase;uniform float uTime,uScale;varying vec3 vColor;varying float vTw,vRot;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
        vTw=.55+.45*sin(uTime*9.+aPhase*6.283);vRot=aPhase*3.+uTime*1.5;vColor=aColor;
        gl_PointSize=clamp(aSize*uScale*(.75+.35*vTw)/max(-mv.z,1.),1.,96.);}`,
      fragmentShader: `varying vec3 vColor;varying float vTw,vRot;
        void main(){vec2 d=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);d=mat2(c,-s,s,c)*d;
        float core=exp(-dot(d,d)*60.);float rays=exp(-abs(d.x)*38.)*exp(-abs(d.y)*5.)+exp(-abs(d.y)*38.)*exp(-abs(d.x)*5.);
        float a=(core*1.4+rays)*vTw;if(a<.01)discard;gl_FragColor=vec4(mix(vColor,vec3(1.),core*.6)*a*1.6,1.);}`,
    });
    this.points = new T.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geometry = g;
    this.n = 0;
    this.c = new T.Color();
  }
  begin() {
    this.n = 0;
  }
  add(x, y, z, color, size, phase) {
    if (this.n >= SPARKLE_MAX) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.c.set(color);
    this.col[i * 3] = this.c.r;
    this.col[i * 3 + 1] = this.c.g;
    this.col[i * 3 + 2] = this.c.b;
    this.size[i] = size;
    this.phase[i] = phase;
  }
  end() {
    const g = this.geometry;
    for (const k of ["position", "aColor", "aSize", "aPhase"]) {
      const at = g.getAttribute(k);
      at.needsUpdate = true;
      at.clearUpdateRanges?.();
      at.addUpdateRange?.(0, this.n * at.itemSize);
    }
    g.setDrawRange(0, this.n);
    this.points.visible = this.n > 0;
  }
}
const RAINBOW = [0xff5f6d, 0xffc371, 0xfff36b, 0x6bffb8, 0x6bc8ff, 0xc76bff];
const COLORS = [0xd6c6b0, 0xa3bec0, 0xd2a795, 0xb9c8d1, 0x8ea9b4, 0xc6b9cd];
function tint(g, color) {
  const c = new T.Color(color),
    n = g.getAttribute("position").count,
    a = [];
  for (let i = 0; i < n; i++) a.push(c.r, c.g, c.b);
  g.setAttribute("color", new T.Float32BufferAttribute(a, 3));
  return g;
}
function merge(gs) {
  if (!gs.length) return null;
  const normalized = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  const result = mergeGeometries(normalized);
  for (let i = 0; i < gs.length; i++) {
    normalized[i].dispose();
    if (normalized[i] !== gs[i]) gs[i].dispose();
  }
  if (!result) throw Error("背景ジオメトリの結合に失敗");
  return result;
}
function roundedBox(w, h, d, r = 0.1) {
  const s = new T.Shape(),
    x = -w / 2 + r,
    y = -h / 2 + r,
    ww = w - 2 * r,
    hh = h - 2 * r;
  s.moveTo(x, y);
  s.lineTo(x + ww, y);
  s.lineTo(x + ww, y + hh);
  s.lineTo(x, y + hh);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: d - 2 * r,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: 1,
    curveSegments: 1,
    steps: 1,
  });
  g.center();
  g.computeVertexNormals();
  return g;
}
export class TaxiView {
  constructor(canvas) {
    this.canvas = canvas;
    this.tiles = new Map();
    this.routeGroup = null;
    this.software = false;
    this.lastX = 0;
    this.shake = 0;
    try {
      // ポスト処理時は画面側のMSAAは不要（レンダーターゲット側で2xMSAA）。メモリ帯域を節約。
      const post = paperStyleEnabled();
      this.renderer = new T.WebGLRenderer({ canvas, antialias: !post, powerPreference: "high-performance" });
      this.quality = 1;
      this.frameTimes = [];
      this.renderer.setPixelRatio(this.targetPixelRatio(post));
      this.renderer.setClearColor(0x6d3746);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
      try {
        this.post = new PaperPost(this.renderer);
        this.post.enabled = paperStyleEnabled();
      } catch (e) {
        console.warn("紙作画シェーダーを無効化", e);
        this.post = null;
      }
    } catch {
      this.software = true;
      const c = document.createElement("canvas");
      c.id = "world";
      c.setAttribute("aria-label", "ワイルドタクシー・軽量立体表示");
      canvas.replaceWith(c);
      this.canvas = c;
      this.ctx = c.getContext("2d");
    }
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(0x80504f, 160, 650);
    this.camera = new T.PerspectiveCamera(61, 1, 0.8, 850);
    this.hemi = new T.HemisphereLight(0xc1d5f0, 0x716a82, 1.8);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffefd2, 2.3);
    this.sun.position.set(-100, 100, -140);
    this.scene.add(this.sun);
    this.fill = new T.DirectionalLight(0xa5b4db, 0.8);
    this.fill.position.set(6, 40, 30);
    this.scene.add(this.fill);
    this.makeSky();
    this.textures = {};
    for (let key of ["asphalt", "paving", "city", "facade", "shops", "boost", "barrier", "icons", "shadow", "goal", "checkerFlag"])
      this.textures[key] = this.makeTexture(key);
    {
      const t = new T.CanvasTexture(this._facadeLit);
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      this.textures.facadeLit = t;
    }
    this.mat = {
      road: new T.MeshStandardMaterial({ map: this.textures.asphalt, side: T.DoubleSide, roughness: 0.78, metalness: 0 }),
      walk: new T.MeshLambertMaterial({ map: this.textures.paving, side: T.DoubleSide }),
      city: new T.MeshLambertMaterial({ map: this.textures.city }),
      facade: new T.MeshLambertMaterial({ map: this.textures.facade, vertexColors: true, emissiveMap: this.textures.facadeLit, emissive: 0xffc27a, emissiveIntensity: 0 }),
      color: new T.MeshLambertMaterial({ vertexColors: true }),
      shops: new T.MeshBasicMaterial({ map: this.textures.shops, side: T.DoubleSide }),
      glass: new T.MeshStandardMaterial({ color: 0x3b304c, roughness: 0.06, metalness: 0.7 }),
      mark: new T.MeshBasicMaterial({ color: 0xd9c5ac, side: T.DoubleSide }),
      curb: new T.MeshLambertMaterial({ color: 0xc2a5a0, side: T.DoubleSide }),
    };
    this.mat.road.side = this.mat.walk.side = this.mat.curb.side = T.FrontSide;
    this.mat.mark = new T.MeshStandardMaterial({ map: this.textures.asphalt, roughness: 0.78, metalness: 0 });
    this.mat.mark.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying float vMarkDepth;\n" +
        shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nvMarkDepth=-mvPosition.z;");
      shader.fragmentShader =
        "varying float vMarkDepth;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.7,.59,.46),1.-smoothstep(75.,170.,vMarkDepth));",
        );
    };
    this.sharedMaterials = new Set(Object.values(this.mat));
    const floor = new T.PlaneGeometry(50000, 50000);
    floor.rotateX(-Math.PI / 2);
    this.textures.city.repeat.set(50000 / 6, 50000 / 6);
    this.add(floor, this.mat.city).position.y = -0.5;
    this.boardingPassenger = makeBoardingPassenger();
    this.scene.add(this.boardingPassenger);
    this.taxi = this.makeTaxi();
    this.taxiPivot = new T.Group();
    this.taxi.position.y = -TAXI_PIVOT_Y;
    this.taxiPivot.add(this.taxi);
    this.scene.add(this.taxiPivot);
    this.taxi.remove(this.carShadow);
    this.scene.add(this.carShadow);
    this.makeHeadlightGround();
    this.sparkles = new Sparkles();
    this.scene.add(this.sparkles.points);
    this.setWeather(weatherState(null));
    this.resize();
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.onLost?.();
    });
  }
  makeSky() {
    const material = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        sunDir: { value: new T.Vector3(-0.3, 0.075, -1).normalize() },
        skyTop: { value: new T.Color(0x548fc7) },
        skyMid: { value: new T.Color(0xa2c9de) },
        skyHorizon: { value: new T.Color(0xf5dfb8) },
        cloudCover: { value: 0.2 },
        night: { value: 0 },
        sunGlow: { value: 1 },
      },
      vertexShader: "varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `
   uniform vec3 sunDir,skyTop,skyMid,skyHorizon;uniform float cloudCover,night,sunGlow;varying vec3 vDir;
   void main(){vec3 d=normalize(vDir);float h=d.y,s=max(dot(d,sunDir),0.);float side=smoothstep(-.3,1.,dot(normalize(vec3(d.x,0.,d.z)+.00001),normalize(vec3(sunDir.x,0.,sunDir.z))));
    vec3 horizon=mix(skyHorizon*.86,skyHorizon,side);vec3 col=mix(horizon,skyMid,smoothstep(0.,.3,h));col=mix(col,skyTop,smoothstep(.22,.9,h));col=mix(col,horizon*.65,smoothstep(0.,.3,-h));
    float cloud=sin(d.x*16.+d.z*7.)*.5+sin(d.x*39.-d.z*14.)*.18;float band=smoothstep(.03,.1,h)*(1.-smoothstep(.15,.45,h));col=mix(col,skyMid*1.15,smoothstep(-.25,.6,cloud)*band*cloudCover*.65);col=mix(col,vec3(dot(col,vec3(.333))),cloudCover*.25);
    col+=vec3(1.,.6,.3)*pow(s,45.)*.35*sunGlow;col+=vec3(1.,.86,.65)*smoothstep(.99935,.9997,s)*1.2*sunGlow;
    vec2 grid=floor(d.xz/(abs(h)+.5)*400.);float star=step(.9991,fract(sin(dot(grid,vec2(12.9898,78.233)))*43758.5453));col+=star*night*(1.-cloudCover)*smoothstep(.15,.35,h)*.45;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
    });
    this.sky = new T.Mesh(new T.SphereGeometry(750, 24, 12), material);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.paintCanvas = document.createElement("canvas");
    this.paintCanvas.width = 128;
    this.paintCanvas.height = 64;
    const texture = new T.CanvasTexture(this.paintCanvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.mapping = T.EquirectangularReflectionMapping;
    this.paintEnvironment = texture;
  }
  // 空を映り込み用の環境マップにする（紙走式：物理ベース材質＋環境光で影を黒く沈めない）
  updateEnvironment() {
    if (!this.renderer) return;
    try {
      if (!this.pmrem) {
        this.pmrem = new T.PMREMGenerator(this.renderer);
        this.envScene = new T.Scene();
        this.envScene.add(new T.Mesh(this.sky.geometry, this.sky.material));
      }
      const old = this.envTarget;
      this.envTarget = this.pmrem.fromScene(this.envScene, 0.04, 0.5, 1000);
      // 軽量化：環境マップ（IBL）は面積の小さい「映り込みが効く所」だけに付ける。
      // 街全体は半球ライトで空色の環境光を受ける。
      const env = this.envTarget.texture;
      for (const m of this.reflective || []) {
        if (m.envMap !== env) {
          m.envMap = env;
          m.needsUpdate = true;
        }
      }
      const wet = !!this.palette?.wet;
      for (const m of [this.mat.road, this.mat.mark]) {
        const want = wet ? env : null;
        if (m.envMap !== want) {
          m.envMap = want;
          m.needsUpdate = true;
        }
      }
      old?.dispose();
    } catch (e) {
      console.warn("環境マップを作れません", e);
    }
  }
  makeHeadlightGround() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 256;
    const c = canvas.getContext("2d"),
      gradient = c.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#fff1be99");
    gradient.addColorStop(0.25, "#fff1be44");
    gradient.addColorStop(1, "#fff1be00");
    c.fillStyle = gradient;
    c.beginPath();
    c.moveTo(58, 0);
    c.lineTo(70, 0);
    c.lineTo(128, 256);
    c.lineTo(0, 256);
    c.closePath();
    c.fill();
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const g = new T.PlaneGeometry(20, 46);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 25);
    this.headlightGround = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5,
        opacity: 0.55,
      }),
    );
    this.scene.add(this.headlightGround);
  }
  setWeather(state) {
    this.weather = state;
    const p = appearance(state),
      signature = [state.phase, state.kind, state.lights, Math.round(state.cloud * 10)].join("/");
    if (signature === this.weatherSignature) return;
    this.weatherSignature = signature;
    this.palette = p;
    this.hemi.color.setHex(p.ambient);
    this.hemi.groundColor.setHex(p.ground);
    this.hemi.intensity = p.ambientPower * 1.3;
    this.sun.color.setHex(p.sun);
    this.sun.intensity = p.sunPower * (1 - state.cloud * 0.3);
    this.fill.intensity = p.fillPower;
    this.scene.fog.color.setHex(p.fog);
    this.scene.fog.near = p.fogNear;
    this.scene.fog.far = p.fogFar;
    if (this.renderer) this.renderer.toneMappingExposure = p.exposure;
    const u = this.sky.material.uniforms;
    u.skyTop.value.setHex(p.top);
    u.skyMid.value.setHex(p.mid);
    u.skyHorizon.value.setHex(p.horizon);
    u.cloudCover.value = state.cloud;
    u.night.value = p.night ? 1 : 0;
    u.sunGlow.value = p.sunGlow;
    // 濡れた路面は粗さを下げて空とライトを映す
    this.mat.road.roughness = p.wet ? 0.22 : 0.78;
    this.mat.road.metalness = p.wet ? 0.15 : 0;
    this.mat.road.emissive.setHex(p.snow ? 0x98a9ba : 0x000000);
    this.mat.road.emissiveIntensity = p.snow ? 0.34 : 0;
    this.mat.mark.roughness = this.mat.road.roughness;
    this.mat.mark.metalness = this.mat.road.metalness;
    this.mat.mark.emissive.copy(this.mat.road.emissive);
    this.mat.mark.emissiveIntensity = this.mat.road.emissiveIntensity;
    this.mat.walk.color.setHex(p.snow ? 0xeaf4ff : 0xffffff);
    this.mat.curb.color.setHex(p.snow ? 0xf1f5ff : 0xc2b6ac);
    // 夜・夕方は窓明かりだけを発光させる（ブルームに乗る）
    this.mat.facade.emissiveIntensity = p.night ? 1.6 : state.phase === "evening" ? 0.7 : 0;
    this.updateEnvironment();
    for (const lamp of this.headlights || []) lamp.visible = p.lights;
    this.headlightGround.visible = p.lights;
    const c = this.paintCanvas.getContext("2d"),
      g = c.createLinearGradient(0, 0, 0, 64),
      hex = (n) => "#" + n.toString(16).padStart(6, "0");
    g.addColorStop(0, hex(p.top));
    g.addColorStop(0.4, hex(p.mid));
    g.addColorStop(0.52, hex(p.horizon));
    g.addColorStop(0.65, hex(p.ground));
    g.addColorStop(1, "#253448");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 64);
    this.paintEnvironment.needsUpdate = true;
  }
  makeTexture(type) {
    const c = document.createElement("canvas");
    c.width = type === "goal" ? 1024 : type === "shops" ? 512 : type === "icons" ? 512 : 256;
    c.height = type === "checkerFlag" || type === "shops" ? 512 : type === "icons" ? 64 : 256;
    const x = c.getContext("2d"),
      rand = random(917);
    if (["asphalt", "paving", "city"].includes(type)) {
      const base = { asphalt: "#383543", paving: "#9c8992", city: "#8e808b" }[type];
      x.fillStyle = base;
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 13000; i++) {
        const a = rand() * (type === "asphalt" ? 0.09 : 0.08);
        x.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        const s = rand() > 0.96 ? 2 : 1;
        x.fillRect(rand() * 256, rand() * 256, s, s);
      }
      if (type !== "asphalt") {
        x.strokeStyle = type === "city" ? "#8f8d864a" : "#6e7b7c88";
        x.lineWidth = 2;
        for (let y = 0; y < 256; y += 32) {
          x.beginPath();
          x.moveTo(0, y + 0.5);
          x.lineTo(256, y + 0.5);
          x.stroke();
          for (let z = ((y / 32) % 2) * 32; z < 256; z += 64) {
            x.beginPath();
            x.moveTo(z, y);
            x.lineTo(z, y + 32);
            x.stroke();
          }
        }
      } else {
        for (let i = 0; i < 7; i++) {
          x.strokeStyle = i % 2 ? "#65738328" : "#202b383b";
          x.lineWidth = 1;
          let xx = rand() * 256,
            yy = rand() * 256;
          x.beginPath();
          x.moveTo(xx, yy);
          for (let j = 0; j < 4; j++) {
            xx += rand() * 18 - 9;
            yy += rand() * 12;
            x.lineTo(xx, yy);
          }
          x.stroke();
        }
        x.fillStyle = "#bac5c609";
        x.fillRect(48, 0, 22, 256);
        x.fillRect(185, 0, 15, 256);
      }
    }
    if (type === "facade") {
      // 窓明かりだけを描いた発光マップ（夜に emissiveMap として使う）
      const lc = document.createElement("canvas");
      lc.width = lc.height = 256;
      var lx = lc.getContext("2d");
      lx.fillStyle = "#000";
      lx.fillRect(0, 0, 256, 256);
      this._facadeLit = lc;
      x.fillStyle = "#b6adb7";
      x.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32) {
        x.fillStyle = "#80748655";
        x.fillRect(0, y + 29, 256, 3);
        for (let a = 6; a < 256; a += 32) {
          const lit = rand() > 0.63,
            grad = x.createLinearGradient(a, y, a + 20, y + 24);
          grad.addColorStop(0, lit ? "#ffe3ad" : "#4c3c68");
          grad.addColorStop(0.5, lit ? "#bc805a" : "#796181");
          grad.addColorStop(1, lit ? "#e5b57b" : "#352d48");
          x.fillStyle = grad;
          x.fillRect(a, y + 3, 20, 22);
          if (lit) {
            lx.fillStyle = "#fff1d0";
            lx.fillRect(a + 1, y + 4, 18, 20);
          }
          x.fillStyle = "#f6c9a988";
          x.fillRect(a, y + 3, 20, 2);
          x.fillStyle = "#d0b2c055";
          x.fillRect(a + 10, y + 3, 1, 22);
        }
      }
    }
    if (type === "shops") {
      const names = [
        "純喫茶 東京",
        "RAMEN / 麺",
        "CITY MART",
        "COFFEE 24",
        "TOKYO RECORDS",
        "タクシー乗り場",
        "ネオン食堂",
        "GAME CENTER",
        "原宿 STYLE",
        "SHIBUYA 109",
        "ラーメン一番",
        "BOOKS / 本",
        "PARKING P",
        "駅前商店街",
        "24H MARKET",
        "WILD TAXI",
      ];
      const colors = ["#f57862", "#2fbdbd", "#618fee", "#d6a24b", "#c360b9", "#48a78b"];
      names.forEach((name, i) => {
        const px = (i % 2) * 256,
          py = Math.floor(i / 2) * 64;
        x.fillStyle = "#162d3d";
        x.fillRect(px, py, 256, 64);
        x.fillStyle = colors[i % colors.length];
        x.fillRect(px + 3, py + 3, 250, 58);
        x.strokeStyle = "#fff4c488";
        x.strokeRect(px + 7, py + 7, 242, 50);
        x.fillStyle = "#fff8de";
        x.textAlign = "center";
        x.font = "900 24px Arial";
        x.fillText(name, px + 128, py + 41, 230);
      });
    }
    if (type === "boost") {
      x.fillStyle = "#174a72";
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = "#22cfea";
      x.fillRect(9, 0, 238, 256);
      x.fillStyle = "#b9ffff";
      for (let y = -40; y < 300; y += 76) {
        x.beginPath();
        x.moveTo(25, y + 42);
        x.lineTo(128, y);
        x.lineTo(231, y + 42);
        x.lineTo(231, y + 59);
        x.lineTo(128, y + 18);
        x.lineTo(25, y + 59);
        x.fill();
      }
      x.fillStyle = "#ebfcff";
      x.fillRect(0, 0, 6, 256);
      x.fillRect(250, 0, 6, 256);
    }
    if (type === "barrier") {
      x.fillStyle = "#ffd44c";
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = "#283748";
      for (let i = -256; i < 512; i += 64) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i + 32, 0);
        x.lineTo(i + 288, 256);
        x.lineTo(i + 256, 256);
        x.fill();
      }
      x.fillStyle = "#ddd";
      x.fillRect(0, 8, 256, 10);
    }
    if (type === "icons") {
      const icons = ["", "", "", "TAXI", "08-88", "GOAL", "", "★"];
      icons.forEach((label, i) => {
        x.fillStyle = ["#9c77df", "#f5c24d", "#59cdb6", "#fff3ae", "#edf2d3", "#48bd9e", "#30c5df", "#ffa65c"][i];
        x.fillRect(i * 64, 0, 64, 64);
        x.strokeStyle = "#fff6d4";
        x.lineWidth = 3;
        x.strokeRect(i * 64 + 3, 3, 58, 58);
        // 文字は自分のマスの中だけ（はみ出すと隣のナンバープレートに「G」が写り込む）
        x.save();
        x.beginPath();
        x.rect(i * 64, 0, 64, 64);
        x.clip();
        x.fillStyle = "#172f40";
        x.textAlign = "center";
        if (i === 4) {
          // ナンバー：板は横長（0.58×0.2）に貼られるので、横を縮めて描くと実際の見た目が自然な比率になる
          x.translate(i * 64 + 32, 0);
          x.scale(0.345, 1);
          x.font = "900 34px Arial";
          x.fillText(label, 0, 44, 160);
        } else {
          x.font = `900 ${i === 3 ? 20 : 40}px Arial`;
          x.fillText(label, i * 64 + 32, 43, 56);
        }
        x.restore();
        const kind = { 0: "boost", 1: "clock", 2: "magnet", 6: "shield" }[i];
        if (kind) drawItemIcon(x, kind, i * 64 + 5, 5, 54);
      });
    }
    if (type === "goal") drawGoalBanner(x, c.width, c.height);
    if (type === "checkerFlag") drawChecker(x, c.width, c.height, 64);
    if (type === "shadow") {
      const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, "#152b3d99");
      g.addColorStop(1, "#152b3d00");
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.anisotropy = this.renderer ? Math.min(4, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    return t;
  }
  add(g, mat, parent = this.scene) {
    const material = mat instanceof T.Material ? mat : new T.MeshLambertMaterial({ color: mat });
    const m = new T.Mesh(g, material);
    parent.add(m);
    return m;
  }
  iconGeometry(w, h, index) {
    const g = new T.PlaneGeometry(w, h),
      uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, (index + uv.getX(i)) / 8);
    return g;
  }
  makeTaxi() {
    const g = new T.Group(),
      yellow = new T.MeshStandardMaterial({ color: 0xffcc37, roughness: 0.28, metalness: 0.12, envMapIntensity: 1.3 });
    this.taxiBodyMaterial = yellow;
    this.reflective = [yellow];
    const staticGroup = new T.Group();
    g.add(staticGroup);
    this.rearDoor = new T.Group();
    this.rearDoor.position.set(DOOR_HINGE.x, 0, DOOR_HINGE.z);
    g.add(this.rearDoor);
    const doorGroup = new T.Group();
    doorGroup.position.set(-DOOR_HINGE.x, 0, -DOOR_HINGE.z);
    this.rearDoor.add(doorGroup);
    const trim = new T.MeshStandardMaterial({ color: 0x24323d, roughness: 0.45, metalness: 0.3 });
    for (const b of TAXI_BODY) {
      if (b.kind === "body") {
        const split = splitDoorShell(sedanBodyGeometry());
        this.add(split.body, yellow, staticGroup);
        this.add(split.door, yellow, doorGroup);
        const inner = split.door.clone();
        inner.translate(0.055, 0, 0);
        this.add(inner, new T.MeshStandardMaterial({ color: 0x344351, side: T.DoubleSide, roughness: 0.6 }), doorGroup);
      } else this.add(roundedBox(b.w, b.h, b.d, 0.055), yellow, staticGroup).position.set(b.x, b.y, b.z);
    }
    this.add(new T.BoxGeometry(1.55, 0.12, 4), trim, staticGroup).position.set(0, 0.32, 0);
    this.mat.glass.color.setHex(0x4c7f9b);
    if ("roughness" in this.mat.glass) {
      this.mat.glass.roughness = 0.05;
      this.mat.glass.metalness = 0.75;
    }
    for (const window of TAXI_WINDOWS) {
      const points = outwardPanel(window.points),
        geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(points.flat(), 3));
      geometry.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      const isDoor = window.name === "side-rear" && window.points[0][0] < 0;
      if (isDoor) {
        const glass = this.mat.glass.clone();
        this.reflective?.push(glass);
        glass.side = T.DoubleSide;
        glass.userData.taxiGlass = true;
        this.add(geometry, glass, doorGroup);
      } else this.add(geometry, this.mat.glass, staticGroup);
    }
    const fixedPillars = TAXI_PILLARS.map(([a, b]) =>
      a[0] < 0 && b[0] < 0 && Math.abs(a[1] - 1.08) < 0.001 && Math.abs(b[1] - 1.08) < 0.001 ? [a, [-0.94, 1.08, -0.16]] : [a, b],
    );
    for (const [a, b] of fixedPillars) {
      const start = new T.Vector3(...a),
        end = new T.Vector3(...b),
        delta = end.clone().sub(start),
        beam = this.add(new T.BoxGeometry(0.08, delta.length() + 0.04, 0.08), yellow, staticGroup);
      beam.position.copy(start.add(end).multiplyScalar(0.5));
      beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    }
    const doorWindow = TAXI_WINDOWS.find((w) => w.name === "side-rear" && w.points[0][0] < 0).points;
    for (let i = 0; i < 4; i++) {
      const start = new T.Vector3(...doorWindow[i]),
        end = new T.Vector3(...doorWindow[(i + 1) % 4]),
        delta = end.clone().sub(start),
        beam = this.add(new T.BoxGeometry(0.055, delta.length(), 0.055), yellow, doorGroup);
      beam.position.copy(start.add(end).multiplyScalar(0.5));
      beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    }
    for (const side of [-1, 1]) {
      this.add(roundedBox(0.22, 0.15, 0.32, 0.035), yellow, staticGroup).position.set(side * 1.14, 1.19, 0.82);
      for (const z of [-0.57, 0.66])
        this.add(new T.BoxGeometry(0.035, 0.045, 0.24), trim, side < 0 && z < 0 ? doorGroup : staticGroup).position.set(
          side * 1.065,
          0.96,
          z,
        );
    }
    // Merge static shell, glazing and trim by material; no repeating body texture.
    for (const parts of [staticGroup, doorGroup]) {
      const buckets = new Map();
      for (const child of [...parts.children]) {
        child.updateMatrix();
        const geom = child.geometry.clone().applyMatrix4(child.matrix);
        if (!buckets.has(child.material)) buckets.set(child.material, []);
        buckets.get(child.material).push(geom);
        child.geometry.dispose();
        parts.remove(child);
      }
      for (const [material, gs] of buckets) this.add(merge(gs), material, parts);
    }
    this.hood = this.add(roundedBox(2.03, 0.12, 1.1, 0.05), yellow, g);
    this.hood.position.set(0, 1.035, 1.64);
    const wheel = new T.CylinderGeometry(TAXI_WHEEL_RADIUS, TAXI_WHEEL_RADIUS, 0.25, 16);
    wheel.rotateZ(Math.PI / 2);
    const tire = new T.MeshStandardMaterial({ color: 0x192c3c, roughness: 0.85 }),
      rim = new T.MeshStandardMaterial({ color: 0xb8c6cf, roughness: 0.25, metalness: 0.85 });
    this.reflective?.push(rim, trim, this.mat.glass);
    this.wheels = [];
    for (const xx of [-1.05, 1.05])
      for (const zz of TAXI_WHEEL_Z) {
        const w = this.add(wheel, tire, g);
        w.position.set(xx, 0.38, zz);
        this.wheels.push(w);
        const cap = this.add(new T.CylinderGeometry(0.19, 0.19, 0.27, 8), rim, g);
        cap.rotation.z = Math.PI / 2;
        cap.position.copy(w.position);
      }
    this.bumper = this.add(new T.BoxGeometry(1.94, 0.12, 0.14), 0xc6cbd1, g);
    this.bumper.position.set(0, 0.5, -2.31);
    for (const xx of [-0.74, 0.74]) {
      this.add(roundedBox(0.49, 0.17, 0.1, 0.02), new T.MeshBasicMaterial({ color: 0xffebba }), g).position.set(xx, 0.8, 2.31);
      this.add(roundedBox(0.42, 0.18, 0.08, 0.015), new T.MeshBasicMaterial({ color: 0xff6855 }), g).position.set(xx, 0.76, -2.33);
    }
    this.headlights = [];
    for (const side of [-1, 1]) {
      const light = new T.SpotLight(0xffedbd, 75, 70, 0.38, 0.55, 1.3);
      light.position.set(side * 0.74, 0.83, 2.36);
      light.target.position.set(side * 0.74, 0.03, 36);
      g.add(light, light.target);
      this.headlights.push(light);
    }
    const icons = new T.MeshBasicMaterial({ map: this.textures.icons, side: T.DoubleSide }),
      roofSign = new T.Group();
    g.add(roofSign);
    roofSign.position.y = 0.075;
    this.add(new T.BoxGeometry(0.6, 0.04, 0.28), trim, g).position.set(0, 1.855, 0);
    for (const back of [-1, 1]) {
      const sign = this.add(this.iconGeometry(0.94, 0.3, 3), icons, roofSign);
      sign.position.set(0, 1.98, back * 0.255);
      if (back < 0) sign.rotation.y = Math.PI;
    }
    this.add(roundedBox(1.05, 0.37, 0.48, 0.05), 0xffed9f, roofSign).position.set(0, 1.97, 0);
    for (const end of [-1, 1]) {
      const plate = this.add(this.iconGeometry(0.58, 0.2, 4), icons, g);
      plate.position.set(0, 0.49, end * 2.395);
      if (end < 0) plate.rotation.y = Math.PI;
    }
    this.add(new T.BoxGeometry(0.8, 0.15, 0.045), trim, g).position.set(0, 0.75, 2.31);
    this.add(new T.BoxGeometry(1.94, 0.12, 0.14), 0xc6cbd1, g).position.set(0, 0.5, 2.31);
    const sh = this.add(
      new T.PlaneGeometry(4, 6.3),
      new T.MeshBasicMaterial({ map: this.textures.shadow, transparent: true, depthWrite: false }),
      g,
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.carShadow = sh;
    // ブースト炎とジェット噴射：外炎・中炎・芯の3層＋ハロー＋火花。加算合成でブルームに乗る。
    const glowTex = glowSpriteTexture();
    this.glowTexture = glowTex;
    const noRay = (o) => {
      o.raycast = () => {};
      return o;
    };
    // 左右の円錐を1ジオメトリに結合して1メッシュにする（メッシュ数を増やさない）
    const layer = (parent, radius, length, segments, material, xs, y, z, rot, flicker) => {
      material.vertexColors = true;
      const geos = xs.map((x) => {
        const g = flameCone(radius, length, segments);
        if (rot === "back") g.rotateX(-Math.PI / 2);
        else g.rotateZ(Math.PI);
        return g.translate(x, y, z);
      });
      const m = noRay(this.add(merge(geos), material, parent));
      m.userData.flicker = flicker;
      m.userData.baseOpacity = material.opacity;
      m.userData.pivot = new T.Vector3(0, y, z);
      return m;
    };
    const halo = (parent, hex, power, size, x, y, z) => {
      const s = noRay(
        new T.Sprite(
          new T.SpriteMaterial({
            map: glowTex,
            color: new T.Color(hex).multiplyScalar(power),
            blending: T.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            fog: false,
          }),
        ),
      );
      s.scale.setScalar(size);
      s.position.set(x, y, z);
      parent.add(s);
      return s;
    };
    const exhaust = [-0.58, 0.58],
      jets = [-0.75, 0.75];
    this.flames = new T.Group();
    this.flameLayers = [
      layer(this.flames, 0.42, 3.2, 10, glowMaterial(0xff4010, 1.4, 0.6), exhaust, 0.44, -3.75, "back", 0.22),
      layer(this.flames, 0.3, 2.1, 10, glowMaterial(0xffa020, 2.2, 0.85), exhaust, 0.44, -3.2, "back", 0.16),
      layer(this.flames, 0.15, 1.3, 8, glowMaterial(0xd8f8ff, 3.2, 1), exhaust, 0.44, -2.8, "back", 0.1),
    ];
    for (const xx of exhaust) halo(this.flames, 0xffa040, 1.2, 1.1, xx, 0.44, -2.45);
    g.add(this.flames);
    this.flames.visible = false;
    this.jumpJets = new T.Group();
    this.jetLayers = [
      layer(this.jumpJets, 1.0, 5.6, 12, glowMaterial(0x1060ff, 1.0, 0.45), jets, -2.4, -0.65, "down", 0.2),
      layer(this.jumpJets, 0.62, 4.2, 12, glowMaterial(0x20c8ff, 1.6, 0.7), jets, -1.7, -0.65, "down", 0.15),
      layer(this.jumpJets, 0.3, 3.0, 8, glowMaterial(0xe0ffff, 2.4, 1), jets, -1.1, -0.65, "down", 0.09),
    ];
    for (const x of jets) {
      halo(this.jumpJets, 0x6fe8ff, 1.3, 1.8, x, 0.05, -0.65);
      halo(this.jumpJets, 0xffffff, 1.5, 0.7, x, 0.12, -0.65);
      const nozzle = noRay(this.add(new T.CylinderGeometry(0.28, 0.38, 0.3, 10), glowMaterial(0x7feaff, 1.4, 0.9), this.jumpJets));
      nozzle.position.set(x, 0.32, -0.65);
    }
    // 衝撃リング（2重、位相ずらし）
    this.jetRings = [0, 1].map(() => {
      const r = noRay(this.add(new T.TorusGeometry(1, 0.06, 6, 32), glowMaterial(0x60e8ff, 1.6, 0.7), this.jumpJets));
      r.rotation.x = Math.PI / 2;
      return r;
    });
    g.add(this.jumpJets);
    this.jumpJets.visible = false;
    // 火花（ブースト・ジェット共通、手続き的に位置を決めるので状態を持たない）
    const sparkGeo = new T.BoxGeometry(0.05, 0.05, 0.55);
    this.sparks = noRay(new T.InstancedMesh(sparkGeo, glowMaterial(0xffc060, 2.5, 1), 28));
    this.sparks.frustumCulled = false;
    this.sparks.visible = false;
    g.add(this.sparks);
    this.sparkDummy = new T.Object3D();
    this.smoke = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshBasicMaterial({ color: 0x59616b, transparent: true, opacity: 0.27, depthWrite: false }),
      6,
    );
    this.smoke.frustumCulled = false;
    g.add(this.smoke);
    this.smokeDummy = new T.Object3D();
    this.bubble = this.add(
      new T.SphereGeometry(2.9, 16, 10),
      new T.MeshBasicMaterial({ color: 0x6ee9ff, wireframe: true, transparent: true, opacity: 0.24 }),
      g,
    );
    this.bubble.position.y = 1;
    this.bubble.visible = false;
    // バリア：フレネル発光の殻を重ねる
    this.bubbleGlow = new T.Mesh(
      new T.SphereGeometry(2.95, 24, 14),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new T.Color(0x5fe6ff).multiplyScalar(2.2) } },
        vertexShader:
          "varying vec3 vN,vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}",
        fragmentShader:
          "uniform float uTime;uniform vec3 uColor;varying vec3 vN,vV;varying float vY;void main(){float f=pow(1.-abs(dot(vN,vV)),2.5);float scan=.55+.45*sin(vY*9.-uTime*7.);gl_FragColor=vec4(uColor*(f*.9+.04)*scan,1.);}",
      }),
    );
    noRay(this.bubbleGlow);
    this.bubble.add(this.bubbleGlow);
    // ライト類の発光（夜間・悪天候時に強める）
    this.lampGlows = [];
    for (const xx of [-0.74, 0.74]) {
      this.lampGlows.push(halo(g, 0xfff0c8, 1.1, 0.95, xx, 0.8, 2.45), halo(g, 0xff3a2a, 1.0, 0.7, xx, 0.76, -2.45));
    }
    this.taxiContact = taxiContactPoints(g, [this.flames, this.jumpJets, this.smoke, this.bubble, this.carShadow, this.sparks, ...this.lampGlows]);
    return g;
  }
  surfaceMesh(data) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(data.position, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(data.normal, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(data.uv, 2));
    g.setIndex(data.index);
    return g;
  }
  clearGroup(g) {
    if (!g) return;
    const disposed = new Set();
    g.traverse((o) => {
      if (o.isMesh) {
        if (!disposed.has(o.geometry)) {
          o.geometry.dispose();
          disposed.add(o.geometry);
        }
        if (!this.sharedMaterials.has(o.material) && !disposed.has(o.material)) {
          o.material.dispose();
          disposed.add(o.material);
        }
      }
    });
    this.scene.remove(g);
  }
  setPassenger(profile) {
    if (this.boardingPassenger?.userData.profile?.key === profile.key) return;
    if (this.boardingPassenger) disposePassenger(this.boardingPassenger);
    this.boardingPassenger = makeBoardingPassenger(profile);
    this.scene.add(this.boardingPassenger);
  }
  setRoute(route, sample, run) {
    this.clearEnding();
    if (run.passenger) this.setPassenger(run.passenger);
    this.route = route;
    this.sample = sample;
    this.run = run;
    this.environment = run.environment || new CityWorld({ points: route, sample, length: run.length }, run.seed);
    this.cameraReady = false;
    this.lastX = 0;
    for (const t of this.tiles.values()) this.clearGroup(t);
    this.tiles.clear();
    this.clearGroup(this.routeGroup);
    this.routeGroup = new T.Group();
    this.scene.add(this.routeGroup);
    this.roadLayout = roadLayout({ points: route, sample, length: run.length });
    for (const [key, mat] of Object.entries({
      asphalt: this.mat.road,
      walk: this.mat.walk,
      curb: this.mat.curb,
      paint: this.mat.mark,
      metal: 0x354354,
    })) {
      this.add(this.surfaceMesh(this.roadLayout.meshes[key]), mat, this.routeGroup);
    }
    const goal = sample(run.length - 3),
      poleMaterial = new T.MeshLambertMaterial({ color: 0x24384b }),
      flagMaterial = new T.MeshBasicMaterial({ map: this.textures.checkerFlag, side: T.DoubleSide });
    for (const side of [-1, 1]) {
      const at = roadOffset(goal, side * 6.65),
        pole = this.add(new T.BoxGeometry(0.26, 8.3, 0.26), poleMaterial, this.routeGroup);
      pole.position.set(at.x, 4.15, at.z);
      const flagAt = roadOffset(goal, side * 7.5),
        flag = this.add(new T.PlaneGeometry(1.35, 3), flagMaterial, this.routeGroup);
      flag.position.set(flagAt.x, 3.7, flagAt.z);
      flag.rotation.y = goal.angle + Math.PI;
    }
    const goalSign = this.add(
      new T.PlaneGeometry(13.4, 2.6),
      new T.MeshBasicMaterial({ map: this.textures.goal, side: T.DoubleSide }),
      this.routeGroup,
    );
    goalSign.position.set(goal.x - Math.sin(goal.angle) * 0.16, 6.9, goal.z - Math.cos(goal.angle) * 0.16);
    goalSign.rotation.y = goal.angle + Math.PI;
    this.makePools();
    this.lastTile = -999;
  }
  nearRoad(x, z, r) {
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const list = this.blockers.get(Math.floor(x / 45) + a + "," + (Math.floor(z / 45) + b)) || [];
        if (list.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (r + 8) ** 2)) return true;
      }
    return false;
  }
  buildingGeometry(w, h, d, color, angle, x, z) {
    const g = new T.BoxGeometry(w, h, d),
      uv = g.getAttribute("uv"),
      normal = g.getAttribute("normal"),
      cols = [];
    for (let i = 0; i < uv.count; i++) {
      const n = normal.getY(i),
        side = Math.abs(normal.getX(i)) > 0.5 ? d : w;
      uv.setXY(i, n > 0.5 ? 0.002 : (uv.getX(i) * side) / 26, n > 0.5 ? 0.002 : (uv.getY(i) * h) / 28);
      const c = new T.Color(color);
      if (n > 0.5) c.multiplyScalar(1.12);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    g.rotateY(angle);
    g.translate(x, h / 2 + 0.16, z);
    return g;
  }
  shopGeometry(w, h, index, x, y, z, angle) {
    const g = new T.PlaneGeometry(w, h),
      uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((index % 2) + uv.getX(i)) / 2, (7 - Math.floor(index / 2) + uv.getY(i)) / 8);
    g.rotateY(angle);
    g.translate(x, y, z);
    return g;
  }
  stream(distance) {
    const index = Math.floor(distance / 180);
    if (index === this.lastTile) return;
    this.lastTile = index;
    const needed = new Set(this.environment.keys(distance));
    for (const key of needed) {
      if (this.tiles.has(key)) continue;
      const data = this.environment.section(key),
        group = new T.Group(),
        buildings = [],
        shopSigns = [];
      group.userData = { buildings: data.buildings, props: [] };
      for (const b of data.buildings) {
        buildings.push(this.buildingGeometry(b.w, b.h, b.d, b.c, b.angle, b.x, b.z));
        const roof = this.buildingGeometry(b.w * 0.55, 1.3, b.d * 0.5, 0x8c9b9e, b.angle, b.x, b.z);
        roof.translate(0, b.h, 0);
        buildings.push(roof);
        if (b.near) {
          const face = { x: b.x + Math.cos(b.angle) * b.side * (b.w / 2 + 0.08), z: b.z - Math.sin(b.angle) * b.side * (b.w / 2 + 0.08) };
          shopSigns.push(this.shopGeometry(b.d * 0.86, 1.6, b.shop, face.x, 4.5, face.z, b.angle + (b.side * Math.PI) / 2));
          buildings.push(this.buildingGeometry(b.w + 0.05, 3.2, b.d * 0.94, 0x456b7b, b.angle, b.x, b.z));
        }
      }
      if (buildings.length) this.add(merge(buildings), this.mat.facade, group);
      if (shopSigns.length) this.add(merge(shopSigns), this.mat.shops, group);
      this.scene.add(group);
      this.tiles.set(key, group);
    }
    for (const [key, t] of this.tiles)
      if (!needed.has(key)) {
        this.clearGroup(t);
        this.tiles.delete(key);
      }
  }
  streetGeometry(type) {
    const gs = [],
      [w, h, d] = objectSize(type),
      box = (ww, hh, dd, color, x, y, z) => {
        const g = tint(new T.BoxGeometry(ww, hh, dd), color);
        g.translate(x, y, z);
        gs.push(g);
      };
    if (type === "tree") {
      box(2.7, 0.35, 2.7, 0xb39e83, 0, 0.2, 0);
      const t = tint(new T.CylinderGeometry(0.16, 0.23, 2.9, 6), 0x775f4e);
      t.translate(0, 1.8, 0);
      gs.push(t);
      const l = tint(new T.IcosahedronGeometry(1.7, 0), 0x4a8b70);
      l.scale(1, 1.3, 1);
      l.translate(0, 4.1, 0);
      gs.push(l);
    }
    if (type === "lamp") {
      box(0.16, 7, 0.16, 0x425366, 0, 3.5, 0);
      box(1.7, 0.12, 0.18, 0x425366, 0.8, 7, 0);
      box(0.85, 0.1, 0.36, 0xffedaa, 0.8, 6.94, 0);
    }
    if (type === "vending") {
      box(1, 2.05, 0.85, 0xe96e79, 0, 1.03, 0);
      box(0.74, 1.25, 0.025, 0xb6e3e3, 0, 0.95, -0.44);
      box(0.12, 0.3, 0.03, 0xffd65c, 0.36, 0.7, -0.45);
    }
    if (type === "bench") {
      box(2.8, 0.18, 0.65, 0xae845d, 0, 0.6, 0);
      box(2.8, 0.5, 0.1, 0xae845d, 0, 1.03, 0.28);
      for (const x of [-1, 1]) box(0.12, 0.55, 0.5, 0x435367, x, 0.28, 0);
    }
    const g = merge(gs);
    g.translate(0, -h / 2, 0);
    return g;
  }
  makePools() {
    this.clearGroup(this.poolGroup);
    this.poolGroup = new T.Group();
    this.scene.add(this.poolGroup);
    this.pools = {};
    const make = (key, g, mat, capacity = 64) => {
      const m = new T.InstancedMesh(g, mat instanceof T.Material ? mat : new T.MeshLambertMaterial({ color: mat }), capacity);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.frustumCulled = false;
      this.poolGroup.add(m);
      this.pools[key] = m;
    };
    make("traffic", roundedBox(2.1, 1, 4.5, 0.1), 0xd9e2e6);
    make("cabin", roundedBox(1.85, 0.6, 2.1, 0.05), this.mat.glass);
    const wheel = new T.CylinderGeometry(0.34, 0.34, 0.22, 8);
    wheel.rotateZ(Math.PI / 2);
    make("trafficWheel", wheel, 0x223245, 384);
    const cab = merge([
      new T.BoxGeometry(2.25, 0.9, 2.25).translate(0, -0.66, 2.1),
      new T.BoxGeometry(2.25, 0.12, 2.25).translate(0, 0.48, 2.1),
    ]);
    make("truckCab", cab, 0x75a8c8);
    make("truckCargo", new T.BoxGeometry(2.35, 2.25, 4.2).translate(0, 0.35, -0.8), 0xe5e8e3);
    make("truckGlass", new T.BoxGeometry(2.08, 0.62, 1.92).translate(0, 0.09, 2.1), this.mat.glass);
    make("truckChassis", new T.BoxGeometry(2.3, 0.36, 6.8).translate(0, -0.85, 0), 0x425366);
    make("lights", new T.BoxGeometry(1.8, 0.12, 0.08), new T.MeshBasicMaterial({ color: new T.Color(0xff675b).multiplyScalar(2), toneMapped: false }));
    make("taxiDebris", new T.BoxGeometry(0.8, 0.36, 1.1), 0xffcc37, 12);
    make("cone", new T.ConeGeometry(0.66, 1.65, 8), 0xff8a3c);
    make("coneBase", new T.BoxGeometry(1.1, 0.12, 1.1), 0xe8e2ce);
    make("barrier", new T.BoxGeometry(2.9, 1.3, 0.75), new T.MeshLambertMaterial({ map: this.textures.barrier }));
    make(
      "oil",
      new T.CylinderGeometry(1.5, 1.5, 0.025, 24),
      new T.MeshStandardMaterial({ color: 0x302542, roughness: 0.08, metalness: 0.4 }),
    );
    make("boost", new T.BoxGeometry(2.7, 0.035, 7), new T.MeshBasicMaterial({ map: this.textures.boost, color: new T.Color(1.7, 1.7, 1.7), toneMapped: false }));
    const ramp = new T.BufferGeometry();
    ramp.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [
          -1.45, 0, -2.6, 1.45, 0, -2.6, -1.45, 1, 2.6, 1.45, 0, -2.6, 1.45, 1, 2.6, -1.45, 1, 2.6, -1.45, 0, -2.6, -1.45, 1, 2.6, -1.45, 0,
          2.6, 1.45, 0, -2.6, 1.45, 0, 2.6, 1.45, 1, 2.6,
        ],
        3,
      ),
    );
    ramp.computeVertexNormals();
    make("ramp", ramp, new T.MeshLambertMaterial({ color: 0xffaf43, side: T.DoubleSide }));
    // 無敵の星はネオン管：照明を受けない発光材質（明るさ>1でブルームに乗る）
    const neon = new T.MeshBasicMaterial({ vertexColors: true, color: new T.Color(2.4, 2.4, 2.4), toneMapped: false, fog: false, side: T.DoubleSide });
    for (const kind of ITEM_KINDS) make("pickup" + kind, pickupGeometry(kind), kind === "star" ? neon : this.mat.color, 24);
    make("skyTip", new T.TorusGeometry(1.6, 0.2, 5, 20), new T.MeshBasicMaterial({ color: new T.Color(0xffde77).multiplyScalar(2.4), toneMapped: false }));
    for (const type of ["tree", "lamp", "vending", "bench"]) make(type, this.streetGeometry(type), this.mat.color);
    make("personBody", roundedBox(0.55, 0.65, 0.32, 0.06), new T.MeshLambertMaterial({ color: 0xffffff }));
    make("personHead", new T.SphereGeometry(0.27, 8, 6), 0xffd4b0);
    make("personArm", new T.BoxGeometry(0.14, 0.6, 0.16), 0xf4c7a3, 128);
    make("personLeg", new T.BoxGeometry(0.18, 0.62, 0.2), 0x34445d, 128);
    this.dummy = new T.Object3D();
  }
  updatePools(run, time) {
    this.sparkleAnchors = [];
    const counts = {};
    for (const key in this.pools) counts[key] = 0;
    const temp = new T.Vector3(),
      rot = new T.Quaternion(),
      localRot = new T.Quaternion(),
      colors = [0xef827d, 0x62c7ce, 0xebbb55, 0xb391dc, 0x83bb89, 0xe497bb];
    const part = (key, pose, x = 0, y = 0, z = 0, pitch = 0, scale = 1, color = null) => {
      const m = this.pools[key];
      if (!m || counts[key] >= m.instanceMatrix.count) return;
      const o = this.dummy;
      rot.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      temp.set(x, y, z).applyQuaternion(rot);
      o.position.set(pose.position.x + temp.x, pose.position.y + temp.y, pose.position.z + temp.z);
      localRot.setFromAxisAngle(new T.Vector3(1, 0, 0), pitch);
      o.quaternion.copy(rot).multiply(localRot);
      o.scale.setScalar(scale);
      o.updateMatrix();
      m.setMatrixAt(counts[key], o.matrix);
      if (color) m.setColorAt(counts[key], new T.Color(color));
      counts[key]++;
    };
    const paint = (type, pose, color = 0, phase = 0, flying = false, scale = 1, vehicleKind = null) => {
      if (personType(type)) {
        const walk = Math.sin(run.elapsed * 8 + phase) * (flying ? 1.2 : 0.5);
        part("personBody", pose, 0, 0.15, 0, 0, scale, colors[color % colors.length]);
        part("personHead", pose, 0, 0.65, 0, 0, scale);
        for (const side of [-1, 1]) {
          part("personArm", pose, side * 0.37, 0.12, 0, flying ? side * 1.5 : walk * side, scale);
          part("personLeg", pose, side * 0.17, -0.5, 0, -walk * side, scale);
        }
        return;
      }
      if (["tree", "lamp", "vending", "bench"].includes(type)) {
        part(type, pose, 0, 0, 0, 0, scale);
        return;
      }
      if (type === "taxiDebris") {
        part("taxiDebris", pose, 0, 0, 0, 0, scale, color % 3 === 0 ? 0x263746 : 0xffcc37);
        return;
      }
      if (type === "traffic") {
        const truck = vehicleKind === "truck";
        if (truck) {
          part("truckChassis", pose, 0, 0, 0, 0, scale);
          part("truckCargo", pose, 0, 0, 0, 0, scale);
          part("truckCab", pose, 0, 0, 0, 0, scale, color || 0x75a8c8);
          part("truckGlass", pose, 0, 0, 0, 0, scale);
        } else {
          part("traffic", pose, 0, -0.16, 0, 0, scale, color || 0xd9e2e6);
          part("cabin", pose, 0, 0.55, 0, 0, scale);
        }
        for (const side of [-1, 1])
          for (const z of truck ? [-2.5, -1.15, 2.3] : [-1.35, 1.35])
            part(
              "trafficWheel",
              pose,
              side * (truck ? 1.14 : 1.04),
              truck ? -1.15 : -0.45,
              z,
              flying ? run.elapsed * 8 : phase / 0.34,
              scale,
            );
        part("lights", pose, 0, truck ? -0.8 : -0.15, truck ? -3.42 : -2.27, 0, scale);
        return;
      }
      part(type, pose, 0, 0, 0, 0, scale);
      if (type === "cone") part("coneBase", pose, 0, -0.78, 0, 0, scale);
    };
    for (const o of run.objects) {
      if (o.used || o.d < run.distance - 20 || o.d > run.distance + 480) continue;
      const kind = pickupKind(o),
        p = roadOffset(this.sample(o.d), LANES[o.lane]),
        y =
          o.type === "skyTip"
            ? 5.5
            : kind
              ? 2.25 + Math.sin(time * 3 + o.id) * 0.2
              : o.type === "traffic"
                ? o.vehicleKind === "truck"
                  ? 1.6
                  : 0.9
                : o.type === "cone"
                  ? 0.9
                  : o.type === "barrier"
                    ? 0.74
                    : 0.12,
        a = p.angle + (kind ? Math.sin(time * 1.6 + o.id) * 0.2 : 0);
      if (kind || o.type === "skyTip") this.sparkleAnchors.push(p.x, y, p.z, kind ? ITEMS[kind].rgb : 0xffde77, o.id);
      paint(
        kind ? "pickup" + kind : o.type,
        { position: { x: p.x, y, z: p.z }, rotation: { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) } },
        o.color,
        o.d,
        false,
        1,
        o.vehicleKind,
      );
    }
    for (const o of run.street) {
      if (run.destroyed.has(o.id) || Math.abs(o.d - run.distance) > 430) continue;
      const p = streetPlacement(o, run.elapsed, this.environment);
      if (!p) continue;
      const type = personType(o.type) ? "pedestrian" : o.type,
        [w, h, d] = objectSize(type),
        a =
          p.angle +
          (type === "lamp" && o.side < 0 ? Math.PI : personType(type) && Math.cos(run.elapsed * 0.72 + o.phase) < 0 ? Math.PI : 0);
      paint(
        type,
        { position: { x: p.x, y: h / 2, z: p.z }, rotation: { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) } },
        o.color,
        o.phase,
      );
    }
    for (const o of run.debris || []) paint(o.type, o, o.color, o.id, true, o.scale, o.vehicleKind);
    for (const key in this.pools) {
      const m = this.pools[key];
      m.count = counts[key];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    if (this.software) {
      this.ratio = Math.min(devicePixelRatio, 2);
      this.canvas.width = this.w * this.ratio;
      this.canvas.height = this.h * this.ratio;
    } else this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }
  clearEnding() {
    if (this.endingCrowd) {
      this.scene.remove(this.endingCrowd);
      this.endingCrowd.geometry.dispose();
      this.endingCrowd.material.dispose();
      this.endingCrowd = null;
    }
    this.endingScene = null;
    this.endingRun = null;
    this.cameraReady = false;
  }
  startEnding(perfect, seed, run, reduced = false) {
    this.clearEnding();
    let distance = clamp(run.distance, 80, Math.max(80, run.length - 120));
    for (let i = 0; i < 24; i++) {
      const d = clamp(distance - i * 14, 40, Math.max(40, run.length - 60)),
        a = this.sample(d - 15).angle,
        b = this.sample(d + 15).angle;
      if (Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.1) {
        distance = d;
        break;
      }
    }
    this.endingScene = { perfect, seed, reduced };
    this.endingRun = {
      ...run,
      distance,
      x: 0,
      targetX: 0,
      crashes: 0,
      air: 0,
      physicsPose: null,
      totalled: false,
      boostActive: false,
      shield: 0,
      boarding: null,
      slip: 0,
      speed: 0,
      objects: [],
      street: [],
      debris: [],
    };
    if (perfect) {
      const at = this.sample(distance);
      this.endingCrowd = createEndingCrowd(seed, at, at.angle);
      this.scene.add(this.endingCrowd);
    }
    return this.endingRun;
  }
  renderEnding(time, frame) {
    if (!this.endingRun) return;
    const full = { w: this.w, h: this.h, aspect: this.camera.aspect },
      top = Math.max(0, Math.round(frame.top)),
      left = Math.max(0, Math.round(frame.left || 0)),
      width = Math.max(1, Math.min(full.w - left, Math.round(frame.width || full.w))),
      height = Math.max(1, Math.min(full.h - top, Math.round(frame.height)));
    this.w = width;
    this.h = height;
    this.camera.aspect = width / height;
    this.renderOffsetX = left;
    this.renderOffsetY = top;
    this.renderRect = { x: left, y: full.h - top - height, w: width, h: height };
    if (this.software) {
      this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      this.ctx.fillStyle = "#142132";
      this.ctx.fillRect(0, 0, full.w, full.h);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(left, top, width, height);
      this.ctx.clip();
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, full.w, full.h);
      this.renderer.setClearColor(0x142132);
      this.renderer.clear();
      this.renderer.setViewport(left, full.h - top - height, width, height);
      this.renderer.setScissor(left, full.h - top - height, width, height);
      this.renderer.setScissorTest(true);
    }
    try {
      this.render(this.endingRun, time, false);
    } finally {
      if (this.software) this.ctx.restore();
      else {
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, full.w, full.h);
      }
      this.renderOffsetX = 0;
      this.renderOffsetY = 0;
      this.renderRect = null;
      this.w = full.w;
      this.h = full.h;
      this.camera.aspect = full.aspect;
      this.camera.updateProjectionMatrix();
    }
  }
  captureEnding(time = 0.65) {
    if (!this.endingRun) return null;
    const old = {
      w: this.w,
      h: this.h,
      ratio: this.ratio,
      pixelRatio: this.renderer?.getPixelRatio(),
      camera: this.camera.clone(),
      ready: this.cameraReady,
      lastX: this.lastX,
      inspection: this.inspection,
    };
    try {
      this.w = 800;
      this.h = 510;
      this.ratio = 1;
      this.inspection = null;
      this.camera.aspect = 800 / 510;
      if (this.software) {
        this.canvas.width = 800;
        this.canvas.height = 510;
      } else {
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(800, 510, false);
      }
      this.render(this.endingRun, time, false);
      const image = document.createElement("canvas");
      image.width = 800;
      image.height = 510;
      image.getContext("2d").drawImage(this.canvas, 0, 0);
      return image;
    } catch {
      return null;
    } finally {
      this.w = old.w;
      this.h = old.h;
      this.ratio = old.ratio;
      this.inspection = old.inspection;
      this.lastX = old.lastX;
      this.cameraReady = old.ready;
      this.camera.copy(old.camera);
      this.camera.updateMatrixWorld();
      if (this.software) {
        this.canvas.width = old.w * old.ratio;
        this.canvas.height = old.h * old.ratio;
      } else {
        this.renderer.setPixelRatio(old.pixelRatio);
        this.renderer.setSize(old.w, old.h, false);
      }
    }
  }
  captureShare(run) {
    if (!this.route) return null;
    const old = {
      w: this.w,
      h: this.h,
      ratio: this.ratio,
      pixelRatio: this.renderer?.getPixelRatio(),
      camera: this.camera.clone(),
      ready: this.cameraReady,
      lastX: this.lastX,
      inspection: this.inspection,
      shake: this.shake,
    };
    const photo = {
      ...run,
      boarding: null,
      x: 0,
      targetX: 0,
      air: 0,
      slip: 0,
      shield: 0,
      physicsPose: null,
      totalled: false,
      boostActive: false,
      debris: [],
      objects: [],
    };
    photo.distance = clamp(run.distance, 60, Math.max(60, run.length - 100));
    // Photograph a straight part of this course so the camera stays over the road.
    for (let i = 0; i < 24; i++) {
      const d = clamp(photo.distance - i * 14, 40, Math.max(40, run.length - 60)),
        a = this.sample(d - 12).angle,
        b = this.sample(d + 12).angle;
      if (Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.13) {
        photo.distance = d;
        break;
      }
    }
    try {
      this.w = 1200;
      this.h = 900;
      this.ratio = 1;
      this.inspection = null;
      this.shareShot = true;
      this.shake = 0;
      this.lastX = photo.x;
      this.cameraReady = false;
      this.camera.aspect = 4 / 3;
      if (this.software) {
        this.canvas.width = 1200;
        this.canvas.height = 900;
      } else {
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(1200, 900, false);
      }
      this.render(photo, run.elapsed, false);
      const image = document.createElement("canvas");
      image.width = 1200;
      image.height = 900;
      image.getContext("2d").drawImage(this.canvas, 0, 0);
      return image;
    } catch {
      return null;
    } finally {
      this.shareShot = false;
      this.w = old.w;
      this.h = old.h;
      this.ratio = old.ratio;
      this.inspection = old.inspection;
      this.shake = old.shake;
      this.lastX = old.lastX;
      this.cameraReady = old.ready;
      this.camera.copy(old.camera);
      this.camera.updateMatrixWorld();
      if (this.software) {
        this.canvas.width = old.w * old.ratio;
        this.canvas.height = old.h * old.ratio;
      } else {
        this.renderer.setSize(old.w, old.h, false);
        this.renderer.setPixelRatio(old.pixelRatio);
      }
    }
  }
  render(run, time, menu = false) {
    if (!this.route) return;
    const distance = this.inspection?.distance ?? (menu ? Math.min(180, run.length * 0.12) : run.distance),
      p = this.sample(distance),
      a = p.angle,
      jump = jumpHeight(run);
    this.stream(distance);
    const at = roadOffset(p, run.x);
    if (this.rearDoor) this.rearDoor.rotation.y = Number.isFinite(run.boarding) ? boardingPose(run.boarding).door : 0;
    if (this.boardingPassenger) updateBoardingPassenger(this.boardingPassenger, run.boarding, at, a);
    if (this.headlightGround) {
      this.headlightGround.position.set(at.x, 0.11, at.z);
      this.headlightGround.rotation.y = a;
    }
    this.taxiPivot.position.set(at.x, 0, at.z);
    this.taxiPivot.rotation.set(
      -Math.sin(Math.PI * (1 - run.air / run.airDuration)) * (run.air > 0 ? 0.09 : 0),
      a + (run.slip > 0 ? Math.sin(time * 15) * 0.18 : 0),
      clamp((run.x - this.lastX) * 0.18, -0.14, 0.14),
    );
    this.taxiPivot.position.y = taxiContactHeight(this.taxiContact, this.taxiPivot.quaternion) + jump;
    this.lastX = run.x;
    if (run.physicsPose && !menu) {
      this.taxiPivot.position.copy(run.physicsPose.position);
      this.taxiPivot.quaternion.set(
        run.physicsPose.rotation.x,
        run.physicsPose.rotation.y,
        run.physicsPose.rotation.z,
        run.physicsPose.rotation.w,
      );
      this.taxiPivot.position.y = Math.max(this.taxiPivot.position.y, taxiContactHeight(this.taxiContact, this.taxiPivot.quaternion));
    }
    this.taxiPivot.visible = !run.totalled;
    this.carShadow.visible = !run.totalled;
    if (this.headlightGround) this.headlightGround.visible = !!this.palette?.lights && !run.totalled;
    const damage = run.crashes > 0;
    this.taxiBodyMaterial.color.setHex(damage ? 0xe3b336 : 0xffcc37);
    this.hood.position.y = damage ? 1.01 : 1.035;
    this.hood.rotation.z = damage ? 0.015 : 0;
    this.bumper.rotation.z = damage ? 0.035 : 0;
    // 無敵中は虹色に光る
    if (run.star > 0 && !run.totalled) {
      const hue = (time * 1.6) % 1;
      this.taxiBodyMaterial.color.setHSL(hue, 1, 0.5);
      this.taxiBodyMaterial.emissive.setHSL(hue, 1, 0.5);
      this.taxiBodyMaterial.emissiveIntensity = 0.3 * Math.min(1, run.star / 0.8);
    } else if (this.taxiBodyMaterial.emissiveIntensity) {
      this.taxiBodyMaterial.emissiveIntensity = 0;
    }
    this.smoke.visible = (damage || run.stall > 0) && !run.totalled;
    for (let i = 0; i < 6; i++) {
      const phase = (time * 0.45 + i / 6) % 1;
      this.smokeDummy.position.set(((i % 2) - 0.5) * 0.7, 1.2 + phase * 2.8, 1.3);
      this.smokeDummy.scale.setScalar(0.12 + phase * 0.55);
      this.smokeDummy.updateMatrix();
      this.smoke.setMatrixAt(i, this.smokeDummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    for (const wheel of this.wheels) wheel.rotation.x = run.distance / 0.37;
    this.flames.visible = run.boostActive || run.air > 0;
    this.flames.scale.set(run.air > 0 ? 1.5 : 1.2, run.air > 0 ? 1.5 : 1.2, (run.air > 0 ? 1.9 : 1.3) + Math.sin(time * 30) * 0.15);
    this.jumpJets.visible = run.air > 0;
    this.jumpJets.scale.set(1, 1 + Math.sin(time * 28) * 0.12, 1);
    if (this.flames.visible || this.jumpJets.visible) this.animateFlames(run, time);
    this.sparks.visible = this.flames.visible && !this.software;
    this.bubble.visible = run.shield > 0;
    if (this.bubble.visible) {
      this.bubble.rotation.y = time * 0.6;
      this.bubbleGlow.material.uniforms.uTime.value = time;
    }
    const lampsOn = !!this.palette?.lights;
    for (const s of this.lampGlows) s.visible = lampsOn && !run.totalled;
    this.carShadow.position.set(
      run.physicsPose && !menu ? run.physicsPose.position.x : at.x,
      0.055,
      run.physicsPose && !menu ? run.physicsPose.position.z : at.z,
    );
    this.carShadow.material.opacity = jump > 0 || run.physicsPose?.position.y > 2 ? 0.3 : 0.8;
    if (!this.software) this.updatePools(run, time);
    if (!this.software && this.sparkles) this.updateSparkles(run, time);
    const intensity = speedIntensity(run.speed),
      config = viewConfig(this.w, this.h),
      back = menu ? Math.max(18, config.back) : config.back,
      eye = menu ? Math.max(9.2, config.eye) : config.eye,
      center = roadOffset(p, run.x * 0.64),
      target = new T.Vector3(
        center.x - Math.sin(a) * back,
        eye + jump * 0.85 + (run.physicsPose ? Math.max(0, run.physicsPose.position.y - 1) * 0.3 : 0),
        center.z - Math.cos(a) * back,
      );
    if (!this.cameraReady) {
      this.camera.position.copy(target);
      this.cameraReady = true;
    } else this.camera.position.lerp(target, 0.22);
    const forward = roadOffset(this.sample(distance + 15), run.x * 0.58),
      shake = this.shake + intensity * 0.08;
    this.camera.position.x += Math.sin(time * 93) * shake * 0.05;
    this.camera.position.y += Math.cos(time * 87) * shake * 0.035;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(forward.x, 1.25 + jump * 0.7, forward.z);
    this.camera.fov = T.MathUtils.lerp(this.camera.fov, Math.min(101, config.fov + intensity * 25 + (run.boostActive ? 5 : 0)), 0.14);
    this.camera.updateProjectionMatrix();
    if (this.inspection) {
      const mode = this.inspection.camera || "rear",
        sideDistance = 5.5,
        focus = new T.Vector3(at.x, 1.1, at.z),
        offset =
          mode === "front"
            ? new T.Vector3(Math.sin(a) * 9, 3.2, Math.cos(a) * 9)
            : mode === "left"
              ? new T.Vector3(Math.cos(a) * sideDistance, 3.5, -Math.sin(a) * sideDistance)
              : mode === "top"
                ? new T.Vector3(0, 32, -0.01)
                : new T.Vector3(-Math.sin(a) * 11, 5, -Math.cos(a) * 11);
      this.camera.position.copy(focus).add(offset);
      if (mode === "top") this.camera.up.set(Math.sin(a), 0, Math.cos(a));
      this.camera.lookAt(focus);
      this.camera.fov = mode === "left" ? Math.max(52, (2 * Math.atan(2.9 / (6.5 * this.camera.aspect)) * 180) / Math.PI) : 52;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    if (Number.isFinite(run.boarding) && !this.inspection && !this.shareShot) {
      const boarding = boardingPose(run.boarding),
        approach = clamp(run.boarding / 0.7, 0, 1),
        focusX = clamp(boarding.x * 0.5, -2.8, -0.8),
        side = 8 - 2 * approach,
        back = 18 - 5 * approach,
        focus = new T.Vector3(at.x + Math.cos(a) * focusX, 1.05, at.z - Math.sin(a) * focusX);
      this.camera.position.set(
        at.x - Math.cos(a) * side - Math.sin(a) * back,
        5.4 - 0.9 * approach,
        at.z + Math.sin(a) * side - Math.cos(a) * back,
      );
      this.camera.lookAt(focus);
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
    }
    if (this.shareShot) {
      const focus = new T.Vector3(at.x, 1.05, at.z);
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(at.x + Math.cos(a) * 4.2 + Math.sin(a) * 8, 2.8, at.z - Math.sin(a) * 4.2 + Math.cos(a) * 8);
      this.camera.lookAt(focus);
      const right = new T.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.camera.lookAt(focus.addScaledVector(right, -2.2));
      this.camera.fov = 43;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
    }
    if (this.endingScene) {
      const perfect = this.endingScene.perfect,
        phi = perfect ? 0.27 : 0.6,
        side = perfect ? Math.sin(phi) * 10.5 : Math.sin(phi) * 10.4,
        back = perfect ? Math.cos(phi) * 10.5 : Math.cos(phi) * 10.4,
        focusDistance = perfect ? -4.6 : 0.25,
        focus = new T.Vector3(at.x + Math.sin(a) * focusDistance, perfect ? 0.65 : 0.95, at.z + Math.cos(a) * focusDistance);
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        at.x + Math.cos(a) * side + Math.sin(a) * back,
        perfect ? 7.5 : 3.0,
        at.z - Math.sin(a) * side + Math.cos(a) * back,
      );
      this.camera.lookAt(focus);
      this.camera.fov = perfect ? 46 : 38;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      if (this.endingCrowd) {
        this.endingCrowd.userData.time.value = time;
        this.endingCrowd.userData.motion.value = this.endingScene.reduced ? 0 : 1;
      }
    }
    this.sky?.position.copy(this.camera.position);
    if (!menu && !this.shareShot && !this.endingScene && this.renderer && this.frameTimes) this.trackFrame(time);
    else this.lastFrameTime = null;
    if (this.software) this.drawSoftware(run, time, menu);
    else if (this.post?.enabled) {
      this.post.render(this.scene, this.camera, {
        rect: this.renderRect,
        time,
        speed: menu ? 0 : intensity,
        boost: !menu && run.boostActive,
        night: !!this.palette?.night,
      });
    } else this.renderer.render(this.scene, this.camera);
  }
  updateSparkles(run, time) {
    const sp = this.sparkles;
    sp.begin();
    // アイテム：周りを星が回ってまたたく
    const A = this.sparkleAnchors || [];
    for (let i = 0; i < A.length; i += 5) {
      const [x, y, z, color, id] = [A[i], A[i + 1], A[i + 2], A[i + 3], A[i + 4]];
      for (let k = 0; k < 5; k++) {
        const a = time * (1.8 + k * 0.17) + k * 1.2566 + id,
          r = 1.05 + 0.25 * Math.sin(time * 2 + k + id);
        sp.add(x + Math.cos(a) * r, y + Math.sin(time * 2.6 + k * 2 + id) * 0.7, z + Math.sin(a) * r, k % 2 ? 0xffffff : color, k === 0 ? 1.1 : 0.7, (k * 0.21 + id * 0.137) % 1);
      }
    }
    // 無敵で消えたもの：その場でキラキラ弾ける
    for (const e of run.sparkles || []) {
      const age = (run.elapsed ?? 0) - e.time;
      if (age < 0 || age > 1.1) continue;
      const p = roadOffset(this.sample(e.d), e.off);
      for (let k = 0; k < 18; k++) {
        const a = k * 2.39996 + e.id,
          r = 0.6 + age * (4 + (k % 4)),
          up = 1 + age * (2.5 + (k % 3)) - age * age * 2.5;
        sp.add(p.x + Math.cos(a) * r, up, p.z + Math.sin(a) * r, RAINBOW[(k + e.id) % RAINBOW.length], (1.6 - age) * (k % 3 ? 0.8 : 1.3), (k * 0.17 + e.id * 0.31) % 1);
      }
    }
    // 無敵中のタクシー：周囲を回る星と後ろに流れる星屑
    if (run.star > 0 && !run.totalled && this.taxiPivot.visible) {
      const c = this.taxiPivot.position,
        h = this.taxiPivot.rotation.y,
        fx = Math.sin(h),
        fz = Math.cos(h);
      for (let k = 0; k < 14; k++) {
        const a = time * 3.2 + k * 0.4488;
        sp.add(c.x + Math.cos(a) * 2.6, c.y + 0.6 + Math.sin(time * 4 + k) * 0.9, c.z + Math.sin(a) * 2.6, RAINBOW[k % RAINBOW.length], 0.9, (k * 0.13) % 1);
      }
      for (let k = 0; k < 20; k++) {
        const t = (time * 2.2 + k / 20) % 1,
          side = ((k * 37) % 11) / 11 - 0.5;
        sp.add(c.x - fx * (2.6 + t * 9) + fz * side * 2.2, c.y + 0.4 + t * 1.2, c.z - fz * (2.6 + t * 9) - fx * side * 2.2, RAINBOW[k % RAINBOW.length], 1.1 * (1 - t), (k * 0.29) % 1);
      }
    }
    sp.end();
    sp.material.uniforms.uTime.value = time;
    sp.material.uniforms.uScale.value = (this.renderer ? this.renderer.getDrawingBufferSize(this._sz || (this._sz = new T.Vector2())).y : this.h) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }
  setPaperStyle(on) {
    if (this.post) this.post.enabled = !!on;
    this.applyPixelRatio();
  }
  // 解像度：ポスト処理あり＝DPR上限1.5（紙目・ブルームで粗さが目立たない）、なし＝従来の2。
  // さらに走行中のフレーム間隔を見て、重い端末だけ段階的に下げる（下限0.6倍）。
  targetPixelRatio(post = this.post?.enabled) {
    return Math.max(1, Math.min(devicePixelRatio, post ? 1.5 : 2) * (this.quality || 1));
  }
  applyPixelRatio() {
    if (!this.renderer) return;
    const ratio = this.targetPixelRatio();
    if (Math.abs(this.renderer.getPixelRatio() - ratio) < 0.01) return;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.w, this.h, false);
  }
  trackFrame(time) {
    if (this.lastFrameTime != null) {
      const dt = (time - this.lastFrameTime) * 1000;
      if (dt > 0 && dt < 250) this.frameTimes.push(dt);
    }
    this.lastFrameTime = time;
    if (this.frameTimes.length < 60) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b),
      median = sorted[sorted.length >> 1];
    this.frameTimes.length = 0;
    // 30fps目標：中央値が42ms超なら下げる、34ms未満が続けば少し戻す
    if (median > 42 && this.quality > 0.6) this.quality = Math.max(0.6, this.quality - 0.15);
    else if (median < 34.5 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.05);
    else return;
    this.applyPixelRatio();
  }
  animateFlames(run, time) {
    const flick = (list, speed) =>
      list.forEach((m, i) => {
        const f = m.userData.flicker,
          n = Math.sin(time * speed + i * 2.1) * 0.5 + Math.sin(time * speed * 2.7 + i) * 0.5;
        const k = 1 + n * f * 0.7;
        m.scale.setScalar(k);
        m.position.copy(m.userData.pivot).multiplyScalar(1 - k);
        m.material.opacity = m.userData.baseOpacity * (0.82 + 0.18 * Math.sin(time * speed * 1.7 + i * 3));
      });
    flick(this.flameLayers, 41);
    if (this.jumpJets.visible) {
      flick(this.jetLayers, 37);
      this.jetRings.forEach((r, i) => {
        const ph = (time * 2.2 + i * 0.5) % 1;
        r.position.set(0, -0.3 - ph * 3.4, -0.65);
        r.scale.setScalar(0.6 + ph * 2.6);
        r.material.opacity = 0.75 * (1 - ph);
      });
    }
    if (!this.sparks) return;
    const air = run.air > 0,
      d = this.sparkDummy;
    for (let i = 0; i < 28; i++) {
      const ph = (time * (1.6 + (i % 5) * 0.23) + i * 0.137) % 1,
        side = i % 2 ? 0.58 : -0.58,
        a = i * 2.39996,
        spread = 0.35 + ph * 0.9;
      if (air) {
        d.position.set(side * 1.3 + Math.cos(a) * spread, 0.1 - ph * 5.2, -0.65 + Math.sin(a) * spread);
        d.rotation.set(Math.PI / 2, 0, 0);
      } else {
        d.position.set(side + Math.cos(a) * spread * 0.5, 0.44 + Math.sin(a) * spread * 0.35 + ph * 0.3, -2.6 - ph * 6.5);
        d.rotation.set(0, Math.cos(a) * 0.15, 0);
      }
      d.scale.setScalar(1.1 - ph * 0.9);
      d.updateMatrix();
      this.sparks.setMatrixAt(i, d.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    this.sparks.visible = true;
  }
  drawSoftware(run, time, menu) {
    const c = this.ctx,
      w = this.w,
      h = this.h,
      dist = this.inspection?.distance ?? (menu ? Math.min(180, run.length * 0.12) : run.distance),
      p = this.sample(dist),
      a = p.angle,
      boost = run.boostActive;
    const jump = jumpHeight(run),
      f = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360)),
      dir = new T.Vector3();
    this.camera.getWorldDirection(dir);
    const hy = clamp(h / 2 + (f * dir.y) / Math.max(0.001, Math.hypot(dir.x, dir.z)), -h, h),
      cam = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      matrix = this.camera.matrixWorldInverse.elements;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.setTransform(this.ratio, 0, 0, this.ratio, (this.renderOffsetX || 0) * this.ratio, (this.renderOffsetY || 0) * this.ratio);
    if (this.shake) c.translate(Math.sin(time * 93) * this.shake * 1.5, Math.cos(time * 87) * this.shake);
    const pal = this.palette || appearance(weatherState(null)),
      hex = (n) => "#" + n.toString(16).padStart(6, "0");
    const sky = c.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0, hex(pal.top));
    sky.addColorStop(0.5, hex(pal.mid));
    sky.addColorStop(1, hex(pal.horizon));
    c.fillStyle = sky;
    c.fillRect(-20, -20, w + 40, h + 40);
    let sun = c.createRadialGradient(w * 0.78, h * 0.32, 5, w * 0.78, h * 0.32, h * 0.25);
    sun.addColorStop(0, pal.night ? "#dfeaff66" : "#ffdfa5bb");
    sun.addColorStop(0.1, pal.night ? "#dfeaff22" : "#ffc17a88");
    sun.addColorStop(1, "#ffe3a000");
    c.fillStyle = sun;
    c.fillRect(0, 0, w, h * 0.5);
    c.fillStyle = pal.snow ? "#dbe3ed" : pal.night ? "#626b81" : "#a7a2a2";
    c.fillRect(0, hy, w, h - hy);
    if (!this.cityPattern) this.cityPattern = c.createPattern(this.textures.city.image, "repeat");
    c.globalAlpha = 0.32;
    c.fillStyle = this.cityPattern;
    c.fillRect(0, hy, w, h - hy);
    c.globalAlpha = 1;
    const cameraSpace = (v) => ({
      x: matrix[0] * v[0] + matrix[4] * v[1] + matrix[8] * v[2] + matrix[12],
      y: matrix[1] * v[0] + matrix[5] * v[1] + matrix[9] * v[2] + matrix[13],
      z: -(matrix[2] * v[0] + matrix[6] * v[1] + matrix[10] * v[2] + matrix[14]),
    });
    const screen = (v) => ({ x: w * 0.5 + (v.x * f) / v.z, y: h * 0.5 - (v.y * f) / v.z, depth: v.z });
    const project = (x, y, z) => {
      const q = cameraSpace([x, y, z]);
      return q.z > 1 ? screen(q) : null;
    };
    function clipPoly(world) {
      let points = world.map(cameraSpace),
        out = [];
      for (let i = 0; i < points.length; i++) {
        const v = points[i],
          prev = points[(i + points.length - 1) % points.length],
          inV = v.z >= 1,
          inPrev = prev.z >= 1;
        if (inV !== inPrev) {
          const t = (1 - prev.z) / (v.z - prev.z);
          out.push({ x: prev.x + (v.x - prev.x) * t, y: prev.y + (v.y - prev.y) * t, z: 1 });
        }
        if (inV) out.push(v);
      }
      return out.map(screen);
    }
    const path = (points) => {
      if (points.length < 3) return false;
      c.beginPath();
      points.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      return true;
    };
    const poly = (world, color, stroke = false) => {
      const points = clipPoly(world);
      if (!path(points)) return;
      c.fillStyle = color;
      c.fill();
      if (stroke) {
        c.strokeStyle = color;
        c.lineWidth = 0.65;
        c.stroke();
      }
    };
    const local = (origin, x, y, z) => {
      if (origin.rotation) {
        const q = origin.rotation,
          v = new T.Vector3(x, y - (origin.pivotY || 0), z).applyQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w));
        return [origin.x + v.x, (origin.poseY || 0) + v.y, origin.z + v.z];
      }
      return [
        origin.x + x * Math.cos(origin.angle) + z * Math.sin(origin.angle),
        y,
        origin.z - x * Math.sin(origin.angle) + z * Math.cos(origin.angle),
      ];
    };
    const quadAt = (d, off, width, len, y) => {
      const at = roadOffset(this.sample(d), off);
      return [
        local(at, -width / 2, y, -len / 2),
        local(at, width / 2, y, -len / 2),
        local(at, width / 2, y, len / 2),
        local(at, -width / 2, y, len / 2),
      ];
    };
    const drawBox = (b, color = b.c, top = null) => {
      const at = { x: b.x, z: b.z, angle: b.angle || 0, rotation: b.rotation, pivotY: b.pivotY, poseY: b.poseY },
        y = b.y || 0,
        hw = b.w / 2,
        hd = b.d / 2,
        v = [];
      for (let yy of [y, y + b.h]) for (let zz of [-hd, hd]) for (let xx of [-hw, hw]) v.push(local(at, xx, yy, zz));
      const dx = cam.x - b.x,
        dz = cam.z - b.z,
        lx = dx * Math.cos(at.angle) - dz * Math.sin(at.angle),
        lz = dx * Math.sin(at.angle) + dz * Math.cos(at.angle),
        raw = typeof color === "number" ? "#" + color.toString(16).padStart(6, "0") : color;
      const shade = (factor) => {
        if (typeof color !== "number") return raw;
        const rr = ((color >> 16) & 255) * (pal.night ? 0.67 : 1),
          gg = ((color >> 8) & 255) * (pal.night ? 0.75 : 1),
          bb = (color & 255) * (pal.night ? 0.9 : 1);
        return `rgb(${Math.round(rr * factor)},${Math.round(gg * factor)},${Math.round(bb * factor)})`;
      };
      const col = shade(1);
      const sides = [
        lx > 0 ? [v[1], v[3], v[7], v[5]] : [v[0], v[4], v[6], v[2]],
        lz > 0 ? [v[2], v[6], v[7], v[3]] : [v[0], v[1], v[5], v[4]],
      ];
      poly(sides[0], shade(0.8));
      poly(sides[1], col);
      poly([v[4], v[5], v[7], v[6]], top || shade(1.08));
      return { at, lx, lz, side: sides[0], front: sides[1] };
    };
    const drawTexture = (image, sx, sy, sw, sh, world) => {
      let q = world.map((v) => project(...v));
      if (q.some((v) => !v)) return;
      if (q[0].x > q[1].x) q = [q[1], q[0], q[3], q[2]];
      const source = [
        [0, 0],
        [sw, 0],
        [sw, sh],
        [0, sh],
      ];
      for (const tri of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const [i, j, k] = tri,
          a = source[i],
          b = source[j],
          d = source[k],
          P = q[i],
          Q = q[j],
          R = q[k],
          det = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        if (Math.abs(det) < 0.01) continue;
        const aa = ((Q.x - P.x) * (d[1] - a[1]) - (R.x - P.x) * (b[1] - a[1])) / det,
          bb = ((Q.y - P.y) * (d[1] - a[1]) - (R.y - P.y) * (b[1] - a[1])) / det,
          cc = ((R.x - P.x) * (b[0] - a[0]) - (Q.x - P.x) * (d[0] - a[0])) / det,
          dd = ((R.y - P.y) * (b[0] - a[0]) - (Q.y - P.y) * (d[0] - a[0])) / det;
        c.save();
        path([P, Q, R]);
        c.clip();
        c.transform(aa, bb, cc, dd, P.x - aa * a[0] - cc * a[1], P.y - bb * a[0] - dd * a[1]);
        c.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
        c.restore();
      }
    };
    const traceSurface = (data) => {
      c.beginPath();
      for (let i = 0; i < data.index.length; i += 3) {
        const world = data.index.slice(i, i + 3).map((n) => [data.position[n * 3], data.position[n * 3 + 1], data.position[n * 3 + 2]]),
          q = clipPoly(world);
        if (q.length < 3 || q.every((p) => p.depth > 600) || q.every((p) => p.x < -w) || q.every((p) => p.x > w * 2)) continue;
        q.forEach((v, j) => (j ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
        c.closePath();
      }
    };
    traceSurface(this.roadLayout.outer);
    c.fillStyle = pal.snow ? "#d9e1eb" : pal.night ? "#83879b" : "#b5a8ac";
    c.fill();
    traceSurface(this.roadLayout.road);
    c.save();
    c.clip();
    const roadGradient = c.createLinearGradient(0, hy, 0, h);
    roadGradient.addColorStop(0, hex(pal.fog));
    roadGradient.addColorStop(0.5, pal.snow ? "#8994a5" : pal.wet ? "#49596d" : "#55525f");
    roadGradient.addColorStop(1, pal.snow ? "#738095" : pal.night ? "#353e52" : "#3c414f");
    c.fillStyle = roadGradient;
    c.fillRect(0, Math.min(0, hy), w, h * 2);
    c.restore();
    traceSurface(this.roadLayout.meshes.curb);
    c.fillStyle = pal.snow ? "#edf2f7" : "#b7b1a3";
    c.fill();
    traceSurface(this.roadLayout.meshes.paint);
    const paint = c.createLinearGradient(0, hy, 0, h);
    paint.addColorStop(0, hex(pal.fog));
    paint.addColorStop(0.28, "#d8d3bf");
    paint.addColorStop(1, "#ede7d5");
    c.fillStyle = paint;
    c.fill();
    traceSurface(this.roadLayout.meshes.metal);
    c.fillStyle = "#354354";
    c.fill();
    if (pal.lights) {
      const taxi = roadOffset(this.sample(dist), run.x),
        near = project(...local(taxi, 0, 0.12, 3)),
        far = project(...local(taxi, 0, 0.12, 44));
      if (near && far) {
        const glow = c.createLinearGradient(near.x, near.y, far.x, far.y);
        glow.addColorStop(0, "#ffeabf55");
        glow.addColorStop(0.5, "#ffeabf22");
        glow.addColorStop(1, "#ffeabf00");
        c.save();
        c.globalCompositeOperation = "screen";
        poly([local(taxi, -0.8, 0.12, 2.4), local(taxi, 0.8, 0.12, 2.4), local(taxi, 10, 0.12, 45), local(taxi, -10, 0.12, 45)], glow);
        c.restore();
      }
    }
    const objects = [];
    for (const group of this.tiles.values()) {
      for (const b of group.userData.buildings) {
        const q = project(b.x, b.h / 2, b.z);
        if (q && q.depth < 590 && Math.abs(q.x - w * 0.5) < w * 2.3) objects.push({ type: "building", b, depth: q.depth });
      }
    }
    for (const o of run.street) {
      if (run.destroyed.has(o.id) || Math.abs(o.d - dist) > 430) continue;
      const at = streetPlacement(o, run.elapsed, this.environment);
      if (!at) continue;
      const q = project(at.x, 2, at.z);
      if (q && q.depth < 380) objects.push({ type: "prop", b: { ...o, x: at.x, z: at.z, a: at.angle, angle: at.angle }, depth: q.depth });
    }
    for (const o of run.debris || []) {
      const q = project(o.position.x, o.position.y, o.position.z);
      if (q) {
        const [ww, hh, dd] = objectSize(o.type, o.vehicleKind);
        objects.push({
          type: ["traffic", "cone", "barrier", "taxiDebris"].includes(o.type) ? "obstacle" : "prop",
          b: {
            type: o.type,
            vehicleKind: o.vehicleKind,
            x: o.position.x,
            z: o.position.z,
            rotation: o.rotation,
            pivotY: hh / 2,
            poseY: o.position.y,
            angle: 0,
            a: 0,
            side: 1,
            color: o.color,
            phase: 0,
            flying: true,
            age: o.age,
          },
          depth: q.depth,
        });
      }
    }
    for (const o of run.objects) {
      if (o.used || o.d < dist - 20 || o.d > dist + 440) continue;
      const at = roadOffset(this.sample(o.d), LANES[o.lane]),
        q = project(at.x, 0, at.z);
      if (q) objects.push({ type: "obstacle", b: { ...o, ...at }, depth: q.depth });
    }
    const finish = this.sample(run.length - 3),
      finishPoint = project(finish.x, 6.9, finish.z);
    if (finishPoint && finishPoint.depth < 600) objects.push({ type: "goal", b: finish, depth: finishPoint.depth });
    objects.sort((a, b) => b.depth - a.depth);
    for (const object of objects) {
      const b = object.b,
        depth = object.depth;
      c.globalAlpha = clamp(1 - (depth - (pal.fogFar < 500 ? 70 : 160)) / (pal.fogFar < 500 ? 350 : 650), 0.18, 1);
      if (object.type === "goal") {
        const at = { x: b.x, z: b.z, angle: b.angle };
        for (const side of [-1, 1]) {
          const pole = local(at, side * 6.65, 0, 0);
          drawBox({ x: pole[0], z: pole[2], w: 0.26, h: 8.3, d: 0.26, c: 0x24384b });
          const x = side * 7.5;
          drawTexture(this.textures.checkerFlag.image, 0, 0, 256, 512, [
            local(at, x - 0.675, 5.2, -0.16),
            local(at, x + 0.675, 5.2, -0.16),
            local(at, x + 0.675, 2.2, -0.16),
            local(at, x - 0.675, 2.2, -0.16),
          ]);
        }
        drawTexture(this.textures.goal.image, 0, 0, 1024, 256, [
          local(at, -6.7, 8.2, -0.16),
          local(at, 6.7, 8.2, -0.16),
          local(at, 6.7, 5.6, -0.16),
          local(at, -6.7, 5.6, -0.16),
        ]);
        continue;
      }
      if (object.type === "building") {
        const face = drawBox({ ...b, y: 0.16 }),
          at = face.at;
        drawBox({ x: b.x, z: b.z, w: b.w * 0.52, d: b.d * 0.5, h: 1.2, y: b.h + 0.16, angle: b.angle, c: 0x9ba7a5 });
        if (depth < 170) {
          const sideSign = Math.sign(face.lx),
            frontSign = Math.sign(face.lz);
          const window = (px, py, pz, alongSide) => {
            const windowPoints = alongSide
              ? [local(at, px, py, pz - 1), local(at, px, py, pz + 1), local(at, px, py + 2.2, pz + 1), local(at, px, py + 2.2, pz - 1)]
              : [local(at, px - 1, py, pz), local(at, px + 1, py, pz), local(at, px + 1, py + 2.2, pz), local(at, px - 1, py + 2.2, pz)];
            poly(windowPoints, Math.floor(py + px + pz) % 3 ? "#493a5f" : "#d59e71");
            const qq = windowPoints.map((v) => project(...v));
            if (qq.every(Boolean)) {
              c.beginPath();
              c.moveTo(qq[3].x, qq[3].y);
              c.lineTo(qq[2].x, qq[2].y);
              c.strokeStyle = "#b5d6dd";
              c.lineWidth = 0.6;
              c.stroke();
            }
          };
          for (let yy = b.near ? 6 : 3; yy < b.h - 2; yy += 4.5) {
            for (let zz = -b.d / 2 + 2; zz < b.d / 2 - 1; zz += 3.9) window(sideSign * (b.w / 2 + 0.02), yy, zz, true);
            for (let xx = -b.w / 2 + 2; xx < b.w / 2 - 1; xx += 3.9) window(xx, yy, frontSign * (b.d / 2 + 0.02), false);
          }
          if (b.near) {
            const xx = b.side * (b.w / 2 + 0.04),
              front = [
                local(at, xx, 0.6, -b.d * 0.44),
                local(at, xx, 0.6, b.d * 0.44),
                local(at, xx, 3.5, b.d * 0.44),
                local(at, xx, 3.5, -b.d * 0.44),
              ];
            poly(front, "#284f63");
            const sign = [
              local(at, xx, 5.3, -b.d * 0.43),
              local(at, xx, 5.3, b.d * 0.43),
              local(at, xx, 3.7, b.d * 0.43),
              local(at, xx, 3.7, -b.d * 0.43),
            ];
            drawTexture(this.textures.shops.image, (b.shop % 2) * 256, Math.floor(b.shop / 2) * 64, 256, 64, sign);
          }
        }
      } else if (object.type === "prop") {
        const prop = { x: b.x, z: b.z, angle: b.a || 0, rotation: b.rotation, pivotY: b.pivotY, poseY: b.poseY };
        const q = project(...local(prop, 0, 0, 0)),
          top = project(...local(prop, 0, b.type === "lamp" ? 7 : 4.2, 0));
        if (!q || !top) continue;
        const s = f / depth;
        if (b.type === "lamp") {
          const e = project(...local(prop, (b.side || 1) * 0.9, 6.9, 0));
          c.strokeStyle = "#435365";
          c.lineWidth = Math.max(1, s * 0.13);
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(top.x, top.y);
          if (e) c.lineTo(e.x, e.y);
          c.stroke();
          if (e) {
            c.fillStyle = "#fff5b3";
            c.fillRect(e.x - s * 0.35, e.y - s * 0.05, s * 0.7, Math.max(2, s * 0.15));
            if (depth < 140) {
              const glow = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, s * 0.9);
              glow.addColorStop(0, "#fff3b144");
              glow.addColorStop(1, "#fff3b100");
              c.fillStyle = glow;
              c.fillRect(e.x - s, e.y - s, s * 2, s * 2);
            }
          }
        }
        if (b.type === "tree") {
          c.fillStyle = "#24393b22";
          c.beginPath();
          c.ellipse(q.x, q.y, 2 * s, 0.6 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "#795f4c";
          c.lineWidth = Math.max(1, s * 0.25);
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(top.x, top.y);
          c.stroke();
          const grad = c.createRadialGradient(top.x - 0.6 * s, top.y - 1 * s, 0, top.x, top.y, 2.1 * s);
          grad.addColorStop(0, "#77ad7e");
          grad.addColorStop(1, "#2f665d");
          c.fillStyle = grad;
          c.beginPath();
          c.ellipse(top.x, top.y, 1.7 * s, 2.1 * s, 0, 0, Math.PI * 2);
          c.fill();
        }
        if (b.type === "vending") {
          drawBox({ ...prop, w: 1, d: 0.85, h: 2.05, c: 0xe86775 });
          const label = project(b.x, 1.6, b.z);
          if (label) {
            c.fillStyle = "#d8f4f3";
            c.fillRect(label.x - 0.32 * s, label.y, 0.64 * s, 0.85 * s);
            c.fillStyle = "#1c7683";
            c.fillRect(label.x - 0.3 * s, label.y + 0.23 * s, 0.6 * s, 0.1 * s);
          }
        }
        if (b.type === "bench") drawBox({ ...prop, w: 2.8, d: 0.65, h: 0.25, y: 0.5, c: 0xa87f57 });
        if (personType(b.type)) {
          const colors = [0xe87f7c, 0x62c7ce, 0xebbb55, 0xb391dc, 0x83bb89, 0xe497bb],
            at = prop;
          drawBox({ ...at, w: 0.58, d: 0.32, h: 0.66, y: 0.65, c: colors[(b.color || 0) % 6] });
          const head = project(...local(at, 0, 1.58, 0));
          if (head) {
            c.fillStyle = "#ffd2b0";
            c.beginPath();
            c.arc(head.x, head.y, Math.max(1, s * 0.27), 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#344454";
            c.fillRect(head.x - s * 0.23, head.y - s * 0.23, s * 0.46, s * 0.12);
          }
          const walk = Math.sin(run.elapsed * 8 + (b.phase || 0)) * (b.flying ? 0.9 : 0.35);
          for (const side of [-1, 1]) {
            const armA = project(...local(at, side * 0.33, 1.25, 0)),
              armB = project(...local(at, side * (b.flying ? 0.65 : 0.4), b.flying ? 1.8 : 0.77, walk * side)),
              legA = project(...local(at, side * 0.16, 0.68, 0)),
              legB = project(...local(at, side * 0.17, 0.06, -walk * side));
            for (const [a, b, col] of [
              [armA, armB, "#f0c3a1"],
              [legA, legB, "#34445d"],
            ])
              if (a && b) {
                c.strokeStyle = col;
                c.lineWidth = Math.max(1, s * 0.15);
                c.beginPath();
                c.moveTo(a.x, a.y);
                c.lineTo(b.x, b.y);
                c.stroke();
              }
          }
          if (b.flying) {
            const star = project(...local(at, 0, 2.05, 0));
            if (star) {
              c.fillStyle = "#ffe788";
              c.font = `bold ${Math.max(8, s * 0.55)}px Arial`;
              c.fillText("★", star.x, star.y);
            }
          }
        }
      } else {
        const at = { x: b.x, z: b.z, angle: b.angle, rotation: b.rotation, pivotY: b.pivotY, poseY: b.poseY },
          q = project(b.x, 0, b.z);
        if (!q) continue;
        if (b.type === "taxiDebris") {
          drawBox({ ...at, w: 0.8, h: 0.36, d: 1.1, c: b.color % 3 === 0 ? 0x263746 : 0xffcc37 });
        } else if (b.type === "traffic") {
          const truck = b.vehicleKind === "truck",
            offset = (x, z) => {
              const p = local(at, x, 0, z);
              return { ...at, x: p[0], z: p[2] };
            },
            boxes = truck
              ? [
                  { ...at, w: 2.3, d: 6.8, h: 0.36, y: 0.57, c: 0x425366 },
                  { ...offset(0, -0.8), w: 2.35, d: 4.2, h: 2.25, y: 0.825, c: 0xe5e8e3 },
                  { ...offset(0, 2.1), w: 2.25, d: 2.25, h: 0.9, y: 0.49, c: b.color || 0x75a8c8 },
                  { ...offset(0, 2.1), w: 2.08, d: 1.92, h: 0.62, y: 1.38, c: 0x355b75 },
                  { ...offset(0, 2.1), w: 2.25, d: 2.25, h: 0.12, y: 2.02, c: b.color || 0x75a8c8 },
                ]
              : [
                  { ...at, w: 2.1, d: 4.5, h: 1, y: 0.24, c: b.color || 0xe2e6dc },
                  { ...at, w: 1.85, d: 2.1, h: 0.6, y: 1.24, c: 0x355b75 },
                ];
          for (const side of [-1, 1])
            for (const z of truck ? [-2.5, -1.15, 2.3] : [-1.35, 1.35])
              boxes.push({ ...offset(side * (truck ? 1.14 : 1.04), z), w: 0.22, d: 0.68, h: 0.68, y: 0.11, c: 0x223245 });
          boxes.sort((a, b) =>
            (a.c === 0x223245) !== (b.c === 0x223245)
              ? a.c === 0x223245
                ? -1
                : 1
              : (project(b.x, b.y + b.h / 2, b.z)?.depth || 0) - (project(a.x, a.y + a.h / 2, a.z)?.depth || 0),
          );
          for (const box of boxes) drawBox(box, box.c, box.c === 0x355b75 ? "#b8d0d0" : undefined);
          if ((cam.x - at.x) * Math.sin(at.angle) + (cam.z - at.z) * Math.cos(at.angle) < 0) {
            const back = offset(0, truck ? -3.42 : -2.27);
            poly([local(back, -0.9, 0.65, 0), local(back, 0.9, 0.65, 0), local(back, 0.9, 0.8, 0), local(back, -0.9, 0.8, 0)], "#fa786b");
          }
        } else if (b.type === "oil") {
          const ring = [];
          for (let i = 0; i < 24; i++) ring.push(local(at, Math.cos((i * Math.PI) / 12) * 1.5, 0.085, Math.sin((i * Math.PI) / 12) * 2));
          poly(ring, "#312c46");
          const pp = project(at.x, 0.1, at.z);
          if (pp) {
            c.strokeStyle = "#b594cd88";
            c.lineWidth = Math.max(1, (f / depth) * 0.06);
            c.beginPath();
            c.ellipse(pp.x, pp.y, (f / depth) * 0.95, (f / depth) * 0.24, 0.1, 0, Math.PI * 1.5);
            c.stroke();
          }
        } else if (b.type === "boost") {
          const base = [local(at, -1.4, 0.085, -3.5), local(at, 1.4, 0.085, -3.5), local(at, 1.4, 0.085, 3.5), local(at, -1.4, 0.085, 3.5)];
          poly(base, "#25c7e7");
          for (let z = -2.8; z < 3; z += 2) {
            poly(
              [
                local(at, -1, 0.09, z - 0.5),
                local(at, 0, 0.09, z + 0.4),
                local(at, 1, 0.09, z - 0.5),
                local(at, 1, 0.09, z),
                local(at, 0, 0.09, z + 0.9),
                local(at, -1, 0.09, z),
              ],
              "#d5ffff",
            );
          }
        } else if (b.type === "ramp") {
          poly(
            [local(at, -1.45, 0.12, -2.6), local(at, 1.45, 0.12, -2.6), local(at, 1.45, 1.12, 2.6), local(at, -1.45, 1.12, 2.6)],
            "#ffb956",
          );
          poly([local(at, 1.45, 0.12, -2.6), local(at, 1.45, 0.12, 2.6), local(at, 1.45, 1.12, 2.6)], "#b56f3c");
        } else if (b.type === "cone") {
          poly([local(at, -0.7, 0.12, 0), local(at, 0.7, 0.12, 0), local(at, 0, 1.8, 0)], "#ff9149");
          poly([local(at, -0.35, 1, 0), local(at, 0.35, 1, 0), local(at, 0.22, 1.25, 0), local(at, -0.22, 1.25, 0)], "#fff3d3");
        } else if (b.type === "barrier") {
          drawBox({ ...at, w: 2.9, d: 0.75, h: 1.3, y: 0.12, c: 0xe5ad45 });
          const sc = f / depth;
          c.fillStyle = "#27384a";
          for (let i = -2; i <= 2; i++) {
            c.save();
            c.translate(q.x + i * sc * 0.5, q.y - 0.7 * sc);
            c.rotate(0.4);
            c.fillRect(-0.12 * sc, -0.5 * sc, 0.24 * sc, sc);
            c.restore();
          }
        } else if (b.type === "skyTip") {
          const ring = project(at.x, 5.5, at.z);
          if (ring) {
            c.strokeStyle = "#ffdd5e";
            c.lineWidth = Math.max(2, (f / depth) * 0.2);
            c.beginPath();
            c.arc(ring.x, ring.y, (1.6 * f) / depth, 0, Math.PI * 2);
            c.stroke();
          }
        } else if (pickupKind(b)) {
          const kind = pickupKind(b),
            yy = 2.25 + Math.sin(time * 3 + b.id) * 0.2,
            q = project(b.x, yy, b.z);
          if (q) {
            const size = Math.max(5, (2.15 * f) / q.depth);
            c.save();
            c.shadowColor = ITEMS[kind].color;
            c.shadowBlur = Math.min(15, size * 0.2);
            drawItemIcon(c, kind, q.x - size / 2, q.y - size / 2, size);
            c.shadowBlur = 0;
            if (size > 22) {
              c.font = `700 ${Math.min(12, Math.max(8, size * 0.2))}px sans-serif`;
              c.textAlign = "center";
              c.fillStyle = ITEMS[kind].color;
              c.fillText(b.type === "clock" ? "+4秒" : ITEMS[kind].name, q.x, q.y + size * 0.72);
            }
            c.restore();
          }
        }
      }
    }
    c.globalAlpha = 1;
    const taxi = {
      x: this.taxiPivot.position.x,
      z: this.taxiPivot.position.z,
      angle: a,
      rotation: this.taxiPivot.quaternion,
      pivotY: TAXI_PIVOT_Y,
      poseY: this.taxiPivot.position.y,
    };
    const contact = project(taxi.x, ROAD_SURFACE_Y + 0.015, taxi.z);
    if (contact && !run.totalled) {
      const sc = f / contact.depth;
      c.fillStyle = "#132f3d44";
      c.beginPath();
      c.ellipse(contact.x, contact.y, sc * 1.4, sc * 0.65, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (boost || run.air > 0) {
      for (const side of [-0.58, 0.58]) {
        const base = local(taxi, side, 0.47, -2.1),
          tail = local(taxi, side, 0.47, -(run.air > 0 ? 8 : 4.3) - Math.sin(time * 30) * 0.2);
        const q = project(...base),
          t = project(...tail);
        if (q && t) {
          const sc = f / q.depth,
            flame = c.createLinearGradient(q.x, q.y, t.x, t.y);
          flame.addColorStop(0, "#ddffff");
          flame.addColorStop(0.4, "#4cd6ff");
          flame.addColorStop(1, "#ffb55d00");
          c.fillStyle = flame;
          c.beginPath();
          c.moveTo(q.x - sc * 0.2, q.y);
          c.quadraticCurveTo(t.x - sc * 0.4, t.y, t.x, t.y + sc * 0.3);
          c.quadraticCurveTo(t.x + sc * 0.4, t.y, q.x + sc * 0.2, q.y);
          c.closePath();
          c.fill();
        }
      }
    }
    if (run.air > 0) {
      for (const side of [-1, 1]) {
        const q = project(...local(taxi, side * 0.75, 0.25, -0.65)),
          tip = project(...local(taxi, side * 0.75, -4.2, -1.3));
        if (q && tip) {
          const sc = f / q.depth,
            g = c.createLinearGradient(q.x, q.y, tip.x, tip.y);
          g.addColorStop(0, "#fff");
          g.addColorStop(0.3, "#b8ffff");
          g.addColorStop(0.7, "#36ceff");
          g.addColorStop(1, "#bb72ff00");
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(q.x - sc * 0.35, q.y);
          c.lineTo(q.x + sc * 0.35, q.y);
          c.lineTo(tip.x + sc * 0.7, tip.y);
          c.lineTo(tip.x, tip.y + sc * 0.5);
          c.lineTo(tip.x - sc * 0.7, tip.y);
          c.closePath();
          c.fill();
        }
      }
    }
    if (!run.totalled) {
      // Share the actual sedan meshes with WebGL, including glazing, tires and lamps.
      this.taxiPivot.updateMatrixWorld(true);
      const faces = [],
        light = new T.Vector3(-0.4, 1, 0.5).normalize(),
        excluded = new Set([this.flames, this.jumpJets, this.smoke, this.bubble]);
      const collect = (object) => {
        if (!object.visible || excluded.has(object)) return;
        if (object.isMesh && !object.isInstancedMesh) {
          const geometry = object.geometry,
            position = geometry.getAttribute("position"),
            uv = geometry.getAttribute("uv"),
            idx = geometry.index,
            material = object.material;
          const phase = geometry.getAttribute("celebrationPhase"),
            vertexColor = geometry.getAttribute("color"),
            vertices = Array.from({ length: position.count }, (_, i) => {
              const v = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
              if (phase) v.y += celebrationHeight(time, phase.getX(i), this.endingScene?.reduced);
              return v;
            }),
            count = idx ? idx.count : position.count;
          for (let i = 0; i < count; i += 3) {
            const ids = [0, 1, 2].map((n) => (idx ? idx.getX(i + n) : i + n)),
              v = ids.map((n) => vertices[n]),
              normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
            if (normal.lengthSq() < 1e-12) continue;
            const facing = normal.dot(new T.Vector3(cam.x, cam.y, cam.z).sub(v[0]));
            if (facing <= 0 && material.side !== T.DoubleSide) continue;
            const world = v.map((p) => [p.x, p.y, p.z]),
              q = world.map((v) => project(...v));
            if (q.some((v) => !v)) continue;
            const n = normal.normalize();
            const color = material.color.clone();
            if (material.vertexColors && vertexColor)
              color.multiply(new T.Color(vertexColor.getX(ids[0]), vertexColor.getY(ids[0]), vertexColor.getZ(ids[0])));
            const strength = material.isMeshBasicMaterial ? 1 : 0.66 + Math.max(0, n.dot(light)) * 0.48;
            color.multiplyScalar(strength * (pal.night ? 0.78 : 1));
            faces.push({
              q,
              world,
              color: "#" + color.getHexString(),
              glass: material === this.mat.glass || material.userData.taxiGlass,
              map: material.map?.image,
              uv: uv && ids.map((id) => [uv.getX(id), uv.getY(id)]),
              depth: q.reduce((sum, p) => sum + p.depth, 0) / 3 - (material.map?.image?.width === 512 ? 0.45 : 0),
            });
          }
        }
        for (const child of object.children) collect(child);
      };
      collect(this.taxi);
      if (this.endingCrowd) {
        this.endingCrowd.updateMatrixWorld(true);
        collect(this.endingCrowd);
      }
      if (this.boardingPassenger) {
        this.boardingPassenger.updateMatrixWorld(true);
        collect(this.boardingPassenger);
      }
      drawSoftwareCar(c, faces, w, h, pal.night);
    }
    if ((run.crashes || run.stall > 0) && !run.totalled) {
      for (let i = 0; i < 6; i++) {
        const phase = (time * 0.45 + i / 6) % 1,
          q = project(...local(taxi, ((i % 2) - 0.5) * 0.7, 1.25 + phase * 2.8, 1.2));
        if (!q) continue;
        const r = (f / q.depth) * (0.12 + phase * 0.6),
          smoke = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        smoke.addColorStop(0, `rgba(64,73,86,${0.35 * (1 - phase)})`);
        smoke.addColorStop(1, "#50586500");
        c.fillStyle = smoke;
        c.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      }
    }
    if (run.shield > 0) {
      const q = project(...local(taxi, 0, 1.3, 0));
      if (q) {
        const sc = f / q.depth;
        c.strokeStyle = "#a0efffbb";
        c.lineWidth = 2;
        c.fillStyle = "#7adaff11";
        c.beginPath();
        c.ellipse(q.x, q.y, 2.5 * sc, 2.9 * sc, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
  }
}
