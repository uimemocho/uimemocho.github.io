// アフロバーバー：頭のモデルと、ハサミで切れるアフロ（細かいスカラー場）
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';

async function fetchBin(url) { const s = (await (await fetch(url)).text()).trim(); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const occ = (f) => f <= -0.5 ? 0 : f >= 0.5 ? 1 : f + 0.5;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

async function loadHead() {
  const buf = await fetchBin('head.b64.txt'); const dv = new DataView(buf);
  const n = dv.getUint32(4, true), ni = dv.getUint32(8, true); let o = 12;
  const take = (cnt, T) => { const a = new T(buf.slice(o, o + cnt * T.BYTES_PER_ELEMENT)); o += cnt * T.BYTES_PER_ELEMENT; return a; };
  const P = take(n * 3, Float32Array), N = take(n * 3, Float32Array), UV = take(n * 2, Float32Array), T = take(n * 4, Float32Array), I = take(ni, Uint16Array);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('tangent', new THREE.BufferAttribute(T, 4));
  g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere();
  return g;
}
async function loadSdf() {
  const buf = await fetchBin('headsdf.b64.txt'); const dv = new DataView(buf);
  const nx = dv.getUint32(4, true), ny = dv.getUint32(8, true), nz = dv.getUint32(12, true);
  const ox = dv.getFloat32(16, true), oy = dv.getFloat32(20, true), oz = dv.getFloat32(24, true), s = dv.getFloat32(28, true), sc = dv.getFloat32(32, true);
  const d = new Int8Array(buf.slice(36, 36 + nx * ny * nz));
  return (x, y, z) => {
    const fx = (x - ox) / s, fy = (y - oy) / s, fz = (z - oz) / s;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return -0.03;
    const ix = fx | 0, iy = fy | 0, iz = fz | 0, tx = fx - ix, ty = fy - iy, tz = fz - iz;
    const b = ix + nx * (iy + ny * iz), sy = nx, sz = nx * ny;
    const l = (a, c, t) => a + (c - a) * t;
    return sc * l(l(l(d[b], d[b + 1], tx), l(d[b + sy], d[b + 1 + sy], tx), ty), l(l(d[b + sz], d[b + 1 + sz], tx), l(d[b + sy + sz], d[b + 1 + sy + sz], tx), ty), tz);
  };
}

// 縮れ毛の質感：渦巻く巻き毛のレリーフ＋表面のでこぼこ＋ふわっとした毛羽（シェル）
export const HAIR_COLORS = ['#3b2c22', '#1b1a1c', '#6e4a2c', '#d2a85c', '#b9bcc4', '#b3261e', '#2f5ad0', '#2f9a52', '#e86aa0'];
const HAIR_U = { value: new THREE.Color(0.042, 0.027, 0.019) };
export function setHairColor(i) {
  const c = new THREE.Color(HAIR_COLORS[i] || HAIR_COLORS[0]); c.convertSRGBToLinear(); HAIR_U.value.copy(c);
}
function hairMaterial(shell = 0) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a110c, roughness: 0.8, metalness: 0 });
  mat.customProgramCacheKey = () => 'afro-hair-' + shell;
  mat.extensions = { derivatives: true };
  const NOISE = `
float hs(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z); }
float lump(vec3 p){ return vn(p*70.0)*0.6 + vn(p*150.0)*0.4; }`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHair = HAIR_U;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vWp; varying vec3 vWn; attribute float skin; varying float vSkin;${NOISE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
 transformed += objectNormal * ((lump(position) - 0.5) * 0.0042 + ${(shell * 0.0013).toFixed(4)});`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal); vSkin = skin;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uHair;
varying vec3 vWp; varying vec3 vWn; varying float vSkin;${NOISE}
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float curl2(vec2 uv, out float tip){
  vec2 g=floor(uv), f=fract(uv); float best=9.0, best2=9.0; vec2 bd=vec2(0.0); float seed=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 o=vec2(float(x),float(y)); vec2 hh=h22(g+o); vec2 r=o+hh*0.8+0.1-f; float d=dot(r,r);
    if(d<best){best2=best;best=d;bd=r;seed=hh.x;} else if(d<best2){best2=d;} }
  float r=sqrt(best); float a=atan(bd.y,bd.x); float edge=sqrt(best2)-r;
  float dome=smoothstep(0.0,0.45,edge);
  float dir=seed>0.5?1.0:-1.0;
  float sp=0.5+0.5*sin(a*dir*2.0+r*26.0+seed*6.2831);
  tip=sp*dome;
  return dome*(0.45+0.55*sp*smoothstep(0.0,0.12,r));
}
float curl3(vec3 p, vec3 n, float s, out float tip){ vec3 w=pow(abs(n),vec3(4.0)); w/=(w.x+w.y+w.z); float t1,t2,t3;
  float h=curl2(p.yz*s,t1)*w.x+curl2(p.zx*s+17.3,t2)*w.y+curl2(p.xy*s+31.7,t3)*w.z; tip=t1*w.x+t2*w.y+t3*w.z; return h; }
vec3 bumpN(vec3 surf_pos, vec3 surf_norm, float h){
  vec3 sx=dFdx(surf_pos), sy=dFdy(surf_pos); vec3 r1=cross(sy,surf_norm), r2=cross(surf_norm,sx);
  float det=dot(sx,r1); vec2 dh=vec2(dFdx(h),dFdy(h)); vec3 g=sign(det)*(dh.x*r1+dh.y*r2);
  return normalize(abs(det)*surf_norm-g); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
 vec3 nn = normalize(vWn);
 float tA, tB; float cA = curl3(vWp, nn, 120.0, tA); float cB = curl3(vWp + 0.37, nn, 210.0, tB);
 float cu = cA * 0.5 + cB * 0.5, tip = max(tA * 0.7, tB * 0.6);
 float lod = clamp(1.7 - length(fwidth(vWp)) * 210.0 * 2.2, 0.0, 1.0);
 cu = mix(0.45, cu, lod); tip = mix(0.22, tip, lod);
 float strand = vn(vWp * vec3(900.0, 1300.0, 900.0));
 ${shell > 0 ? `if (strand * (0.55 + 0.6 * cu) < ${(0.30 + shell * 0.12).toFixed(2)}) discard;` : ''}
 float fresh = 1.0 - clamp(vSkin, 0.0, 1.0);
 float hBump = cu * mix(0.0022, 0.0015, fresh) + (strand - 0.5) * 0.0003;
 float lum = smoothstep(0.06, 0.45, max(max(uHair.r, uHair.g), uHair.b));
 vec3 mid = uHair, deep = uHair * mix(0.21, 0.42, lum), hi = mix(min(uHair * 3.6 + 0.004, vec3(1.0)), uHair + (1.0 - uHair) * 0.3, lum);
 vec3 hc = mix(deep, mid, smoothstep(0.1, 0.7, cu));
 hc = mix(hc, hi, tip * 0.42 * smoothstep(0.45, 0.95, cu));
 hc *= (0.85 + 0.3 * vn(vWp * 45.0)) * (1.0 + ${(shell * 0.12).toFixed(2)});
 diffuseColor.rgb = hc;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
 normal = bumpN(-vViewPosition, normal, hBump);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
 roughnessFactor = mix(0.95, 0.6, tip);`);
  };
  return mat;
}

// アフロの外形（リファレンスの四角いアフロ）
export const BOX = { min: [-0.172, 0.045, -0.258], max: [0.172, 0.415, 0.128] };
function afroSd(x, y, z) {
  const hw = 0.136 + 0.023 * smooth(0.07, 0.25, y);
  const zf = 0.112 - 0.012 * smooth(0.3, 0.4, y), zb = -0.196 - 0.044 * smooth(0.07, 0.24, y);
  const y0 = 0.055, y1 = 0.402, yc = (y0 + y1) / 2, hy = (y1 - y0) / 2, zc = (zf + zb) / 2, hz = (zf - zb) / 2;
  const p = 5;
  const qx = Math.abs(x) / hw, qy = Math.abs(y - yc) / hy, qz = Math.abs(z - zc) / hz;
  return (Math.pow(Math.pow(qx, p) + Math.pow(qy, p) + Math.pow(qz, p), 1 / p) - 1) * Math.min(hw, hy, hz);
}
// 生え際より前（顔・耳・もみあげ）は毛を置かない。正なら置ける
// 生え際：頭頂を上から見た方位角（0=額, 90=耳, 180=うなじ）ごとの高さ
const HL = [[0,.2365],[16,.238],[21,.2403],[40,.2448],[53,.2471],[58,.2403],[64,.2146],[71,.1946],[77,.166],[81,.145],[91,.142],[94.5,.166],[98,.186],[105,.19],[112.7,.1877],[120.3,.1746],[129.6,.1518],[146.4,.1289],[157.9,.1118],[165,.1032],[175,.0998],[180,.098]];
function faceSd(x, y, z) {
  const th = Math.atan2(Math.abs(x), z - 0.005) * 57.29578;
  let i = 1; while (i < HL.length - 1 && HL[i][0] < th) i++;
  const [t0, h0] = HL[i - 1], [t1, h1] = HL[i], u = Math.min(1, Math.max(0, (th - t0) / (t1 - t0)));
  const h = h0 + (h1 - h0) * u, k = (h1 - h0) / ((t1 - t0) / 57.29578 * 0.08);
  return (y - h) / Math.sqrt(1 + k * k);
}
const CS = 14; // チャンクの一辺（セル数）

// サーフェスネッツ：F は格子点の値（正が石の中）
function nets(F, nx, ny, nz, i0, i1, j0, j1, k0, k1, ox, oy, oz, c, skinArr, tgtArr) {
  const W = i1 - i0 + 2, H = j1 - j0 + 2, D = k1 - k0 + 2;
  const cache = new Int32Array(W * H * D).fill(-2);
  const pos = [], nor = [], skn = [], tou = [], idx = [];
  const sx = 1, sy = nx, sz = nx * ny;
  const cellV = (i, j, k) => {
    const li = i - i0 + 1, lj = j - j0 + 1, lk = k - k0 + 1, ci = li + W * (lj + H * lk);
    const cv = cache[ci]; if (cv !== -2) return cv;
    const b = i + nx * (j + ny * k);
    const v0 = F[b], v1 = F[b + sx], v2 = F[b + sy], v3 = F[b + sx + sy], v4 = F[b + sz], v5 = F[b + sx + sz], v6 = F[b + sy + sz], v7 = F[b + sx + sy + sz];
    let mask = 0; if (v0 > 0) mask |= 1; if (v1 > 0) mask |= 2; if (v2 > 0) mask |= 4; if (v3 > 0) mask |= 8; if (v4 > 0) mask |= 16; if (v5 > 0) mask |= 32; if (v6 > 0) mask |= 64; if (v7 > 0) mask |= 128;
    if (mask === 0 || mask === 255) { cache[ci] = -1; return -1; }
    let px = 0, py = 0, pz = 0, n = 0;
    const e = (a, b2, ax, ay, az, bx, by, bz) => { if ((a > 0) !== (b2 > 0)) { const t = a / (a - b2); px += ax + (bx - ax) * t; py += ay + (by - ay) * t; pz += az + (bz - az) * t; n++; } };
    e(v0, v1, 0, 0, 0, 1, 0, 0); e(v2, v3, 0, 1, 0, 1, 1, 0); e(v4, v5, 0, 0, 1, 1, 0, 1); e(v6, v7, 0, 1, 1, 1, 1, 1);
    e(v0, v2, 0, 0, 0, 0, 1, 0); e(v1, v3, 1, 0, 0, 1, 1, 0); e(v4, v6, 0, 0, 1, 0, 1, 1); e(v5, v7, 1, 0, 1, 1, 1, 1);
    e(v0, v4, 0, 0, 0, 0, 0, 1); e(v1, v5, 1, 0, 0, 1, 0, 1); e(v2, v6, 0, 1, 0, 0, 1, 1); e(v3, v7, 1, 1, 0, 1, 1, 1);
    px /= n; py /= n; pz /= n;
    const gx = (v1 + v3 + v5 + v7) - (v0 + v2 + v4 + v6), gy = (v2 + v3 + v6 + v7) - (v0 + v1 + v4 + v5), gz = (v4 + v5 + v6 + v7) - (v0 + v1 + v2 + v3);
    const gl = Math.hypot(gx, gy, gz) || 1;
    const id = pos.length / 3;
    pos.push(ox + (i + px) * c, oy + (j + py) * c, oz + (k + pz) * c);
    nor.push(-gx / gl, -gy / gl, -gz / gl);
    if (skinArr) skn.push((skinArr[b] + skinArr[b + sx] + skinArr[b + sy] + skinArr[b + sx + sy] + skinArr[b + sz] + skinArr[b + sx + sz] + skinArr[b + sy + sz] + skinArr[b + sx + sy + sz]) / 8); else skn.push(0);
    if (tgtArr) tou.push(1 - (tgtArr[b] + tgtArr[b + sx] + tgtArr[b + sy] + tgtArr[b + sx + sy] + tgtArr[b + sz] + tgtArr[b + sx + sz] + tgtArr[b + sy + sz] + tgtArr[b + sx + sy + sz]) / 8); else tou.push(0);
    cache[ci] = id; return id;
  };
  const quad = (a, b2, c2, d, flip) => { if (a < 0 || b2 < 0 || c2 < 0 || d < 0) return; if (flip) idx.push(a, c2, b2, a, d, c2); else idx.push(a, b2, c2, a, c2, d); };
  for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const b = i + nx * (j + ny * k), v = F[b] > 0;
    if (i < nx - 1 && j >= 1 && k >= 1 && j <= ny - 2 && k <= nz - 2 && v !== (F[b + sx] > 0))
      quad(cellV(i, j - 1, k - 1), cellV(i, j, k - 1), cellV(i, j, k), cellV(i, j - 1, k), !v);
    if (j < ny - 1 && i >= 1 && k >= 1 && i <= nx - 2 && k <= nz - 2 && v !== (F[b + sy] > 0))
      quad(cellV(i - 1, j, k - 1), cellV(i - 1, j, k), cellV(i, j, k), cellV(i, j, k - 1), !v);
    if (k < nz - 1 && i >= 1 && j >= 1 && i <= nx - 2 && j <= ny - 2 && v !== (F[b + sz] > 0))
      quad(cellV(i - 1, j - 1, k), cellV(i, j - 1, k), cellV(i, j, k), cellV(i - 1, j, k), !v);
  }
  return { pos, nor, skn, tou, idx };
}
function toGeometry(r, g) {
  g = g || new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(r.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(r.nor, 3));
  g.setAttribute('skin', new THREE.Float32BufferAttribute(r.skn, 1));
  g.setAttribute('tout', new THREE.Float32BufferAttribute(r.tou, 1));
  const n = r.pos.length / 3;
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(r.idx, 1) : new THREE.Uint16BufferAttribute(r.idx, 1));
  g.computeBoundingSphere();
  return g;
}


export class Barber {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 0);
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    this.cam = { yaw: 0.35, pitch: 0.1, dist: 1.4, tx: 0, ty: 0.22, tz: -0.06 };
    this.hq = true; this.debris = []; this.islands = []; this.undoStack = [];
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff2e6, 0x283246, 0.55));
    const key = new THREE.DirectionalLight(0xfff0e0, 1.7); key.position.set(-0.6, 1.0, 0.9); s.add(key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.0); rim.position.set(0.7, 0.6, -0.9); s.add(rim);
    const fill = new THREE.DirectionalLight(0xffe2cc, 0.35); fill.position.set(0.8, 0.1, 0.6); s.add(fill);
    this.root = new THREE.Group(); s.add(this.root);
    this.hairGroup = new THREE.Group(); this.root.add(this.hairGroup);
    this.hairMat = hairMaterial(0);
    this.shellMats = [hairMaterial(1), hairMaterial(2), hairMaterial(3)];
    // 切った毛の欠片
    this.bitMat = new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.9, flatShading: true });
    this.bits = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.bitMat, 1400); this.bits.count = 0; this.bits.frustumCulled = false;
    this.bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(this.bits);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    ring.renderOrder = 10; ring.visible = false; s.add(ring); this.cursor = ring;
  }

  async load() {
    const tl = new THREE.TextureLoader();
    const loadTex = (u) => new Promise((res, rej) => tl.load(u, res, undefined, rej));
    const [g, sdf, col, nor] = await Promise.all([loadHead(), loadSdf(), loadTex('head_color.jpg'), loadTex('head_normal.jpg')]);
    col.encoding = THREE.sRGBEncoding; col.flipY = false; nor.flipY = false;
    col.anisotropy = nor.anisotropy = 4;
    this.sdf = sdf;
    const m = new THREE.MeshStandardMaterial({ map: col, normalMap: nor, roughness: 0.5, metalness: 0, vertexTangents: true });
    // 頭皮の毛根（刈り上げたところの青み）。カミソリで剃ると肌に戻る
    this.shave = new Float32Array(g.attributes.position.count).fill(30); g.setAttribute('shave', new THREE.BufferAttribute(this.shave, 1));
    { const pp = g.attributes.position.array, hr = new Float32Array(pp.length / 3); for (let v = 0; v < hr.length; v++) hr[v] = faceSd(pp[v * 3], pp[v * 3 + 1], pp[v * 3 + 2]); g.setAttribute('hreg', new THREE.BufferAttribute(hr, 1)); }
    m.customProgramCacheKey = () => 'afro-head';
    m.onBeforeCompile = (sh) => { sh.uniforms.uHair = HAIR_U;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float shave; attribute float hreg; varying float vShave; varying float vReg; varying vec3 vHp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvShave = shave; vReg = hreg; vHp = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uHair; varying float vShave; varying float vReg; varying vec3 vHp;
float hs3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hs3(i),hs3(i+vec3(1,0,0)),f.x),mix(hs3(i+vec3(0,1,0)),hs3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hs3(i+vec3(0,0,1)),hs3(i+vec3(1,0,1)),f.x),mix(hs3(i+vec3(0,1,1)),hs3(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
 {
  float ax = abs(vHp.x), y = vHp.y, z = vHp.z;
  float region = vReg;
  float stub = smoothstep(-0.003, 0.005, region) * smoothstep(0.05, 0.075, y);
  float ear = (1.0 - smoothstep(-0.002, 0.003, ax - 0.083)) * 0.0 + step(0.083, ax) * step(y, 0.188) * step(0.136, y) * step(-0.026, z) * step(z, -0.006);
  stub *= (1.0 - ear);
  float len = vShave;                       // 毛の長さ(mm)：0=剃り上げ
  float dens = len <= 0.05 ? 0.0 : clamp(0.42 + 0.17 * log2(1.0 + len), 0.0, 0.97);
  float dots = vn3(vHp * 1500.0) * 0.6 + vn3(vHp * 400.0) * 0.4;
  float fine = vn3(vHp * 3200.0);
  vec3 stubC = mix(diffuseColor.rgb * mix(0.72, 0.42, dens), uHair * 0.95, (0.45 + 0.4 * dots) * dens + fine * 0.12 * dens);
  diffuseColor.rgb = mix(diffuseColor.rgb, stubC, stub * mix(0.55, 1.0, dens) * step(0.05, len));
 }`);
    };
    this.head = new THREE.Mesh(g, m); this.root.add(this.head);
    this.headPos = g.attributes.position.array;
    this.setQuality(this.hq, true);
  }
  setQuality(hq, force) {
    if (this.hq === hq && !force) return;
    this.hq = hq;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hq ? 2 : 1.4));
    this.resize();
    const keep = this.f ? { f: this.f, orig: this.orig, nx: this.nx, ny: this.ny, nz: this.nz, c: this.c } : null;
    this.buildGrid(hq ? 0.0042 : 0.006);
    if (keep) this.resample(keep);
    this.remeshAll();
  }
  buildGrid(c) {
    this.c = c;
    const nx = this.nx = Math.round((BOX.max[0] - BOX.min[0]) / c) + 1, ny = this.ny = Math.round((BOX.max[1] - BOX.min[1]) / c) + 1, nz = this.nz = Math.round((BOX.max[2] - BOX.min[2]) / c) + 1;
    const N = this.cells = nx * ny * nz;
    this.f = new Float32Array(N); this.allow = new Float32Array(N); this.init = new Float32Array(N);
    this.orig = new Uint8Array(N); this.rootP = new Uint8Array(N); this.hd = new Float32Array(N); this.mark = new Uint8Array(N);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = i + nx * (j + ny * k);
      const x = BOX.min[0] + i * c, y = BOX.min[1] + j * c, z = BOX.min[2] + k * c;
      const sd = this.sdf(x, y, z); this.hd[id] = -sd; // 頭皮からの距離（外が正）
      const fs = faceSd(x, y, z);
      let a = Math.min(-afroSd(x, y, z), -sd - 0.0012, fs) / c;
      if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) a = Math.min(a, -1);
      a = clamp(a, -2, 2);
      this.allow[id] = a; this.init[id] = a;
      this.rootP[id] = a > 0 && sd > -2.6 * c && y > 0.06 ? 1 : 0;
    }
    this.f.set(this.init); this.orig.fill(1);
    this.ncx = Math.ceil((nx - 1) / CS); this.ncy = Math.ceil((ny - 1) / CS); this.ncz = Math.ceil((nz - 1) / CS);
    if (this.chunks) for (const m of this.chunks) if (m) { this.hairGroup.remove(m); m.geometry.dispose(); }
    this.chunks = new Array(this.ncx * this.ncy * this.ncz).fill(null);
    this.dirtyChunks = new Set(); this.undoStack = []; this.stroke = null;
    this.clearDebris();
  }
  resample(s) {
    const { nx, ny, nz, c } = this; const at = (A, i, j, k) => A[i + s.nx * (j + s.ny * k)];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = i + nx * (j + ny * k);
      const fx = clamp(i * c / s.c, 0, s.nx - 1.001), fy = clamp(j * c / s.c, 0, s.ny - 1.001), fz = clamp(k * c / s.c, 0, s.nz - 1.001);
      const a = fx | 0, b = fy | 0, d = fz | 0, tx = fx - a, ty = fy - b, tz = fz - d, l = (p, q, t) => p + (q - p) * t;
      const v = l(l(l(at(s.f, a, b, d), at(s.f, a + 1, b, d), tx), l(at(s.f, a, b + 1, d), at(s.f, a + 1, b + 1, d), tx), ty), l(l(at(s.f, a, b, d + 1), at(s.f, a + 1, b, d + 1), tx), l(at(s.f, a, b + 1, d + 1), at(s.f, a + 1, b + 1, d + 1), tx), ty), tz);
      this.f[id] = Math.min(this.allow[id], v * s.c / c);
      this.orig[id] = at(s.orig, Math.round(fx), Math.round(fy), Math.round(fz));
    }
  }
  reset() { if (this.shave) { this.shave.fill(30); this.head.geometry.attributes.shave.needsUpdate = true; } this.f.set(this.init); this.orig.fill(1); this.undoStack = []; this.stroke = null; this.clearDebris(); this.remeshAll(); }
  clearDebris() {
    this.debris = []; if (this.bits) this.bits.count = 0;
    for (const isl of this.islands || []) { this.root.remove(isl.mesh); isl.mesh.geometry.dispose(); }
    this.islands = [];
  }
  remeshAll() { for (let n = 0; n < this.chunks.length; n++) this.dirtyChunks.add(n); this.flushChunks(1e9); }
  markRegion(i0, i1, j0, j1, k0, k1) {
    const cx0 = clamp(Math.floor((i0 - 1) / CS), 0, this.ncx - 1), cx1 = clamp(Math.floor(i1 / CS), 0, this.ncx - 1);
    const cy0 = clamp(Math.floor((j0 - 1) / CS), 0, this.ncy - 1), cy1 = clamp(Math.floor(j1 / CS), 0, this.ncy - 1);
    const cz0 = clamp(Math.floor((k0 - 1) / CS), 0, this.ncz - 1), cz1 = clamp(Math.floor(k1 / CS), 0, this.ncz - 1);
    for (let z = cz0; z <= cz1; z++) for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) this.dirtyChunks.add(x + this.ncx * (y + this.ncy * z));
  }
  flushChunks(max) {
    let n = 0;
    for (const ci of this.dirtyChunks) {
      if (n++ >= max) break;
      this.dirtyChunks.delete(ci);
      const cx = ci % this.ncx, cy = ((ci / this.ncx) | 0) % this.ncy, cz = (ci / (this.ncx * this.ncy)) | 0;
      const i0 = cx * CS, j0 = cy * CS, k0 = cz * CS;
      const r = nets(this.f, this.nx, this.ny, this.nz, i0, Math.min(i0 + CS, this.nx - 1), j0, Math.min(j0 + CS, this.ny - 1), k0, Math.min(k0 + CS, this.nz - 1), BOX.min[0], BOX.min[1], BOX.min[2], this.c, this.orig, null);
      let m = this.chunks[ci];
      if (!r.idx.length) { if (m) { this.hairGroup.remove(m); m.geometry.dispose(); this.chunks[ci] = null; } continue; }
      if (!m) { m = new THREE.Mesh(new THREE.BufferGeometry(), this.hairMat); this.chunks[ci] = m; this.hairGroup.add(m); }
      else { m.geometry.dispose(); m.geometry = new THREE.BufferGeometry(); }
      toGeometry(r, m.geometry);
      this.attachShells(m);
    }
  }

  // 毛羽のシェル（高画質のみ）
  attachShells(m) {
    const n = this.hq ? 3 : 1;
    while (m.children.length > n) m.remove(m.children[m.children.length - 1]);
    for (let q = 0; q < n; q++) { let s = m.children[q]; if (!s) { s = new THREE.Mesh(m.geometry, this.shellMats[q]); m.add(s); } s.geometry = m.geometry; }
  }
  // 仕上がりの分析
  stats() {
    const { nx, ny, nz, c } = this; let n = 0, n0 = 0, d = 0, top = 0, center = 0, side = 0, side0 = 0, thick = 0, shaved = 0, scalp = 0, xs = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = i + nx * (j + ny * k), o = occ(this.f[id]), o0 = occ(this.init[id]); n0 += o0;
      const x = BOX.min[0] + i * c, y = BOX.min[1] + j * c;
      if (this.rootP[id]) { scalp++; if (this.f[id] <= 0) shaved++; }
      if (Math.abs(x) > 0.06 && y < 0.3) side0 += o0;
      if (!o) continue; n += o;
      d += Math.abs(o - occ(this.f[(nx - 1 - i) + nx * (j + ny * k)]));
      if (y > 0.3) top += o;
      if (Math.abs(x) < 0.04) center += o;
      if (Math.abs(x) > 0.06 && y < 0.3) side += o;
      if (o > 0.5) { thick = Math.max(thick, this.hd[id]); xs = Math.max(xs, Math.abs(x)); }
    }
    let verts = 0; for (const m of this.chunks) if (m) verts += m.geometry.attributes.position.count;
    const vol = n * c * c * c;
    return {
      kept: n0 ? n / n0 : 0, vol, sym: n ? 1 - d / (2 * n) : 1, top: n ? top / n : 0, center: n ? center / n : 0,
      side: side0 ? side / side0 : 0, thick, width: xs, bald: scalp ? shaved / scalp : 0,
      rough: vol > 1e-7 ? verts * c * c / Math.pow(vol, 2 / 3) : 0,
    };
  }

  sampleF(x, y, z) {
    const { nx, ny, nz, c } = this, f = this.f;
    const fx = (x - BOX.min[0]) / c, fy = (y - BOX.min[1]) / c, fz = (z - BOX.min[2]) / c;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return -2;
    const i = fx | 0, j = fy | 0, k = fz | 0, tx = fx - i, ty = fy - j, tz = fz - k, b = i + nx * (j + ny * k), sy = nx, sz = nx * ny;
    const l = (a, q, t) => a + (q - a) * t;
    return l(l(l(f[b], f[b + 1], tx), l(f[b + sy], f[b + 1 + sy], tx), ty), l(l(f[b + sz], f[b + 1 + sz], tx), l(f[b + sy + sz], f[b + 1 + sy + sz], tx), ty), tz);
  }
  ray(px, py) {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this.camera); return rc.ray;
  }
  pick(px, py) {
    const ray = this.ray(px, py), o = ray.origin, d = ray.direction;
    let t0 = 0, t1 = 1e9;
    for (let a = 0; a < 3; a++) {
      const oa = o.getComponent(a), da = d.getComponent(a);
      if (Math.abs(da) < 1e-9) { if (oa < BOX.min[a] || oa > BOX.max[a]) return null; continue; }
      let ta = (BOX.min[a] - oa) / da, tb = (BOX.max[a] - oa) / da; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 > t1) return null;
    const step = this.c * 0.45; let tp = t0;
    for (let t = t0; t <= t1; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (this.sampleF(x, y, z) > 0) {
        let a = tp, b = t;
        for (let it = 0; it < 7; it++) { const m = (a + b) / 2; if (this.sampleF(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m) > 0) b = m; else a = m; }
        const p = new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b), h = this.c;
        const n = new THREE.Vector3(this.sampleF(p.x - h, p.y, p.z) - this.sampleF(p.x + h, p.y, p.z), this.sampleF(p.x, p.y - h, p.z) - this.sampleF(p.x, p.y + h, p.z), this.sampleF(p.x, p.y, p.z - h) - this.sampleF(p.x, p.y, p.z + h));
        if (n.lengthSq() < 1e-10) n.copy(d).negate(); n.normalize();
        return { hair: true, point: p, normal: n, dir: d.clone() };
      }
      if (this.sdf(x, y, z) > 0) {
        const p = new THREE.Vector3(x, y, z), h = 0.004;
        const n = new THREE.Vector3(this.sdf(x - h, y, z) - this.sdf(x + h, y, z), this.sdf(x, y - h, z) - this.sdf(x, y + h, z), this.sdf(x, y, z - h) - this.sdf(x, y, z + h));
        if (n.lengthSq() < 1e-12) n.copy(d).negate(); n.normalize();
        return { hair: false, point: p, normal: n, dir: d.clone() };
      }
      tp = t;
    }
    return null;
  }
  beginStroke() { this.stroke = { backups: new Map(), removed: 0 }; }
  endStroke() {
    if (!this.stroke) return 0;
    const dropped = this.dropIslands();
    if (this.stroke.backups.size) { this.undoStack.push(this.stroke.backups); if (this.undoStack.length > 30) this.undoStack.shift(); }
    this.stroke = null; return dropped;
  }
  touch(i0, i1, j0, j1, k0, k1) {
    if (!this.stroke) return;
    const B = this.stroke.backups, P = CS, npx = Math.ceil(this.nx / P), npy = Math.ceil(this.ny / P);
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); k0 = Math.max(0, k0); i1 = Math.min(this.nx - 1, i1); j1 = Math.min(this.ny - 1, j1); k1 = Math.min(this.nz - 1, k1);
    for (let z = Math.floor(k0 / P); z <= Math.floor(k1 / P); z++) for (let y = Math.floor(j0 / P); y <= Math.floor(j1 / P); y++) for (let x = Math.floor(i0 / P); x <= Math.floor(i1 / P); x++) {
      const key = x + npx * (y + npy * z); if (B.has(key)) continue;
      const a0 = x * P, b0 = y * P, c0 = z * P, a1 = Math.min(a0 + P, this.nx), b1 = Math.min(b0 + P, this.ny), c1 = Math.min(c0 + P, this.nz);
      const n = (a1 - a0) * (b1 - b0) * (c1 - c0), fs = new Float32Array(n), os = new Uint8Array(n); let q = 0;
      for (let k = c0; k < c1; k++) for (let j = b0; j < b1; j++) { const base = this.nx * (j + this.ny * k); for (let i = a0; i < a1; i++) { fs[q] = this.f[base + i]; os[q++] = this.orig[base + i]; } }
      B.set(key, { a0, a1, b0, b1, c0, c1, fs, os });
    }
  }
  undo() {
    const B = this.undoStack.pop(); if (!B) return false;
    for (const v of B.values()) {
      let q = 0;
      for (let k = v.c0; k < v.c1; k++) for (let j = v.b0; j < v.b1; j++) { const base = this.nx * (j + this.ny * k); for (let i = v.a0; i < v.a1; i++) { this.f[base + i] = v.fs[q]; this.orig[base + i] = v.os[q++]; } }
      this.markRegion(v.a0, v.a1, v.b0, v.b1, v.c0, v.c1);
    }
    return true;
  }
  canUndo() { return this.undoStack.length > 0; }

  // 道具：scissors / thin / clipper(guard) / razor / comb
  brush(tool, hit, radius, mirror, guard) {
    const p = hit.point, nrm = hit.normal;
    const list = [[p, nrm]];
    if (mirror && Math.abs(p.x) > radius * 0.3) list.push([new THREE.Vector3(-p.x, p.y, p.z), new THREE.Vector3(-nrm.x, nrm.y, nrm.z)]);
    const { nx, ny, nz, c } = this; let removed = 0;
    const deep = tool === 'clipper' || tool === 'razor' ? 0.09 : 0; // 頭皮側へ届く深さ
    for (const [P, Nn] of list) {
      const ex = deep ? Math.abs(Nn.x) * deep : 0, ey = deep ? Math.abs(Nn.y) * deep : 0, ez = deep ? Math.abs(Nn.z) * deep : 0;
      const pad = radius + c * 1.5;
      const i0 = clamp(Math.floor((P.x - pad - ex - BOX.min[0]) / c), 1, nx - 2), i1 = clamp(Math.ceil((P.x + pad + ex - BOX.min[0]) / c), 1, nx - 2);
      const j0 = clamp(Math.floor((P.y - pad - ey - BOX.min[1]) / c), 1, ny - 2), j1 = clamp(Math.ceil((P.y + pad + ey - BOX.min[1]) / c), 1, ny - 2);
      const k0 = clamp(Math.floor((P.z - pad - ez - BOX.min[2]) / c), 1, nz - 2), k1 = clamp(Math.ceil((P.z + pad + ez - BOX.min[2]) / c), 1, nz - 2);
      this.touch(i0 - 1, i1 + 1, j0 - 1, j1 + 1, k0 - 1, k1 + 1);
      if (tool === 'comb') {
        const ops = [];
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const x = BOX.min[0] + i * c, y = BOX.min[1] + j * c, z = BOX.min[2] + k * c, dd = Math.hypot(x - P.x, y - P.y, z - P.z);
          if (dd > radius) continue;
          const id = i + nx * (j + ny * k), f = this.f;
          const av = (f[id - 1] + f[id + 1] + f[id - nx] + f[id + nx] + f[id - nx * ny] + f[id + nx * ny] + f[id] * 2) / 8;
          ops.push(id, Math.min(this.allow[id], f[id] + (av - f[id]) * 0.55 * (1 - dd / radius)));
        }
        for (let q = 0; q < ops.length; q += 2) { const id = ops[q], nv = ops[q + 1], ov = this.f[id], dd = occ(ov) - occ(nv); if (dd > 0) removed += dd; this.f[id] = nv; }
      } else {
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const x = BOX.min[0] + i * c, y = BOX.min[1] + j * c, z = BOX.min[2] + k * c;
          const id = i + nx * (j + ny * k), ov = this.f[id]; if (ov <= -2) continue;
          let nv = ov;
          if (tool === 'scissors') {
            const dd = Math.hypot(x - P.x, y - P.y, z - P.z); nv = Math.min(ov, (dd - radius) / c);
          } else if (tool === 'thin') {
            const dd = Math.hypot(x - P.x, y - P.y, z - P.z); if (dd < radius) nv = ov - 0.22 * (1 - dd / radius);
          } else {
            // バリカン／カミソリ：頭皮から guard より外を刈る（筒状の範囲）
            const vx = x - P.x, vy = y - P.y, vz = z - P.z, t = vx * Nn.x + vy * Nn.y + vz * Nn.z;
            if (t > radius * 0.5 || t < -deep) continue;
            const lat = Math.hypot(vx - Nn.x * t, vy - Nn.y * t, vz - Nn.z * t); if (lat > radius) continue;
            const g2 = guard >= c * 2.4 ? guard : 0.0004;
            nv = Math.min(ov, (g2 - this.hd[id]) / c + (lat / radius) * (lat / radius) * 0.6);
          }
          if (nv >= ov) continue;
          nv = Math.max(nv, -2); removed += occ(ov) - occ(nv); this.f[id] = nv; this.orig[id] = 0;
        }
      }
      this.markRegion(i0 - 1, i1 + 1, j0 - 1, j1 + 1, k0 - 1, k1 + 1);
      if (tool === 'razor') this.shaveAt(P, Nn, radius, 0);
      else if (tool === 'clipper') this.shaveAt(P, Nn, radius, Math.min(guard, c * 2.4) * 1000);
      if (removed > 0.3) this.spawnBits(P, radius, removed, Nn);
    }
    const vol = removed * c * c * c;
    if (this.stroke) this.stroke.removed += vol;
    return { removed: vol, changed: removed > 0.03 };
  }

  // 頭皮の毛の長さを短くする（mm）
  shaveAt(P, Nn, radius, lenMM) {
    const hp = this.headPos, sh = this.shave; let ch = false;
    for (let v = 0; v < sh.length; v++) {
      const vx = hp[v * 3] - P.x, vy = hp[v * 3 + 1] - P.y, vz = hp[v * 3 + 2] - P.z, t = vx * Nn.x + vy * Nn.y + vz * Nn.z;
      if (t > 0.012 || t < -0.1) continue;
      const lat = Math.hypot(vx - Nn.x * t, vy - Nn.y * t, vz - Nn.z * t); if (lat > radius * 1.05) continue;
      if (lenMM < sh[v]) { sh[v] = lenMM; ch = true; }
    }
    if (ch) this.head.geometry.attributes.shave.needsUpdate = true;
  }
  // 頭皮から切り離された毛はかたまりで落ちる
  dropIslands() {
    const { nx, ny, nz, c } = this, mk = this.mark, f = this.f; mk.fill(0);
    const st = new Int32Array(this.cells); let sp = 0; const sxy = nx * ny;
    for (let id = 0; id < this.cells; id++) if (f[id] > 0 && this.rootP[id]) { mk[id] = 1; st[sp++] = id; }
    while (sp) {
      const id = st[--sp], i = id % nx, j = ((id / nx) | 0) % ny, k = (id / sxy) | 0;
      if (i > 0 && f[id - 1] > 0 && !mk[id - 1]) { mk[id - 1] = 1; st[sp++] = id - 1; }
      if (i < nx - 1 && f[id + 1] > 0 && !mk[id + 1]) { mk[id + 1] = 1; st[sp++] = id + 1; }
      if (j > 0 && f[id - nx] > 0 && !mk[id - nx]) { mk[id - nx] = 1; st[sp++] = id - nx; }
      if (j < ny - 1 && f[id + nx] > 0 && !mk[id + nx]) { mk[id + nx] = 1; st[sp++] = id + nx; }
      if (k > 0 && f[id - sxy] > 0 && !mk[id - sxy]) { mk[id - sxy] = 1; st[sp++] = id - sxy; }
      if (k < nz - 1 && f[id + sxy] > 0 && !mk[id + sxy]) { mk[id + sxy] = 1; st[sp++] = id + sxy; }
    }
    let total = 0; const comp = new Int32Array(this.cells).fill(-1); let ncomp = 0; const comps = [];
    for (let id = 0; id < this.cells; id++) {
      if (!(f[id] > 0) || mk[id] || comp[id] >= 0) continue;
      const list = []; comp[id] = ncomp; st[0] = id; sp = 1;
      while (sp) {
        const q = st[--sp]; list.push(q);
        const i = q % nx, j = ((q / nx) | 0) % ny, k = (q / sxy) | 0;
        const nb = [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1, k > 0 ? q - sxy : -1, k < nz - 1 ? q + sxy : -1];
        for (const n of nb) if (n >= 0 && f[n] > 0 && !mk[n] && comp[n] < 0) { comp[n] = ncomp; st[sp++] = n; }
      }
      comps.push(list); ncomp++;
    }
    for (const list of comps) {
      let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1, k0 = 1e9, k1 = -1, vol = 0;
      for (const q of list) { const i = q % nx, j = ((q / nx) | 0) % ny, k = (q / sxy) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; if (k < k0) k0 = k; if (k > k1) k1 = k; vol += occ(f[q]); }
      i0 = Math.max(0, i0 - 2); j0 = Math.max(0, j0 - 2); k0 = Math.max(0, k0 - 2); i1 = Math.min(nx - 1, i1 + 2); j1 = Math.min(ny - 1, j1 + 2); k1 = Math.min(nz - 1, k1 + 2);
      this.touch(i0, i1, j0, j1, k0, k1);
      const W = i1 - i0 + 1, H = j1 - j0 + 1, D = k1 - k0 + 1, L = new Float32Array(W * H * D).fill(-1), O = new Uint8Array(W * H * D);
      const inC = new Set(list);
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const g = i + nx * (j + ny * k), l = (i - i0) + W * ((j - j0) + H * (k - k0));
        if (inC.has(g)) { L[l] = f[g]; O[l] = this.orig[g]; } else L[l] = Math.min(f[g], -0.2);
      }
      for (const q of list) f[q] = Math.min(f[q], -0.6);
      this.markRegion(i0, i1, j0, j1, k0, k1);
      total += vol * c * c * c;
      if (vol < 3) continue;
      const r = nets(L, W, H, D, 0, W - 1, 0, H - 1, 0, D - 1, 0, 0, 0, c, O, null);
      if (!r.idx.length) continue;
      let cx = 0, cy = 0, cz = 0; const nv = r.pos.length / 3;
      for (let q = 0; q < r.pos.length; q += 3) { cx += r.pos[q]; cy += r.pos[q + 1]; cz += r.pos[q + 2]; }
      cx /= nv; cy /= nv; cz /= nv; let rad = 0;
      for (let q = 0; q < r.pos.length; q += 3) { r.pos[q] -= cx; r.pos[q + 1] -= cy; r.pos[q + 2] -= cz; rad = Math.max(rad, Math.hypot(r.pos[q], r.pos[q + 1], r.pos[q + 2])); }
      const wx = BOX.min[0] + i0 * c + cx, wy = BOX.min[1] + j0 * c + cy, wz = BOX.min[2] + k0 * c + cz;
      const mesh = new THREE.Mesh(toGeometry(r), this.hairMat); this.attachShells(mesh); mesh.position.set(wx, wy, wz); this.root.add(mesh);
      if (this.islands.length > 10) { const old = this.islands.shift(); this.root.remove(old.mesh); old.mesh.geometry.dispose(); }
      this.islands.push({ mesh, vx: (wx > 0 ? 0.08 : -0.08) + (Math.random() - 0.5) * 0.1, vy: 0.05, vz: 0.05 + Math.random() * 0.06, wx: (Math.random() - 0.5) * 4, wz: (Math.random() - 0.5) * 4, rad: Math.max(0.006, rad * 0.55), life: 0, rest: 0 });
    }
    if (total && this.onDrop) this.onDrop(total);
    return total;
  }
  // ケープの表面の高さ
  capeY(r) { return r < 0.062 ? -1 : 0.012 - (r - 0.062) / 0.42 * 0.33 - Math.pow((r - 0.062) / 0.42, 2) * 0.05; }
  spawnBits(P, radius, amount, n) {
    const cnt = Math.min(16, Math.ceil(amount * 0.35));
    for (let q = 0; q < cnt; q++) {
      if (this.debris.length > 1380) this.debris.shift();
      const a = Math.random() * 6.283, b = Math.acos(Math.random() * 2 - 1), r = radius * Math.cbrt(Math.random());
      const x = P.x + Math.sin(b) * Math.cos(a) * r, y = P.y + Math.cos(b) * r, z = P.z + Math.sin(b) * Math.sin(a) * r;
      this.debris.push({ x, y, z, vx: n.x * 0.25 + (Math.random() - 0.5) * 0.12, vy: n.y * 0.2 + Math.random() * 0.08, vz: n.z * 0.25 + (Math.random() - 0.5) * 0.12, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, s: this.c * (0.5 + Math.random() * 1.0), sy: 0.45 + Math.random() * 0.6, life: 0, rest: 0, drag: 2.2 + Math.random() * 2 });
    }
  }
  stepDebris(dt) {
    const g = 9.8, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const collide = (d, rad) => {
      const sd = this.sdf(d.x, d.y, d.z);
      if (sd > -rad) {
        const h = 0.004, gx = this.sdf(d.x + h, d.y, d.z) - this.sdf(d.x - h, d.y, d.z), gy = this.sdf(d.x, d.y + h, d.z) - this.sdf(d.x, d.y - h, d.z), gz = this.sdf(d.x, d.y, d.z + h) - this.sdf(d.x, d.y, d.z - h);
        const L = Math.hypot(gx, gy, gz) || 1, nx = -gx / L, ny = -gy / L, nz = -gz / L, vn = d.vx * nx + d.vy * ny + d.vz * nz;
        if (vn < 0) { d.vx -= 1.3 * vn * nx; d.vy -= 1.3 * vn * ny; d.vz -= 1.3 * vn * nz; d.vx *= 0.7; d.vz *= 0.7; }
        const push = sd + rad; d.x += nx * push; d.y += ny * push; d.z += nz * push;
      }
      if (false) {
        d.y = cy + rad;
        if (d.vy < 0) { d.vy *= -0.15; d.vx = d.vx * 0.55 + (d.x / (rr || 1)) * 0.06; d.vz = d.vz * 0.55 + (d.z / (rr || 1)) * 0.06; if (Math.abs(d.vy) < 0.05) d.rest = (d.rest || 0) + dt * 2; }
        return true;
      }
      return false;
    };
    let n = 0; const keep = [];
    for (const d of this.debris) {
      d.life += dt;
      if (d.rest < 2) {
        // 軽い毛は空気抵抗でふわっと落ちる
        d.vy -= g * dt; const k = Math.exp(-d.drag * dt); d.vx *= k; d.vz *= k; d.vy *= Math.exp(-d.drag * 0.6 * dt);
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt;
        if (collide(d, 0.0015)) { d.wx *= 0.6; d.wy *= 0.6; }
      }
      if (d.y < -0.6 || d.life > 14) continue;
      keep.push(d);
      if (n < 1400) {
        const fade = d.life > 12 ? Math.max(0.01, 1 - (d.life - 12) / 2) : 1;
        p.set(d.x, d.y, d.z); e.set(d.rx, d.ry, 0); q.setFromEuler(e); s.set(d.s * fade, d.s * d.sy * fade, d.s * fade);
        m.compose(p, q, s); this.bits.setMatrixAt(n++, m);
      }
    }
    this.debris = keep; this.bits.count = n; this.bits.instanceMatrix.needsUpdate = true;
    const kept = [];
    for (const is of this.islands) {
      is.life += dt; const M = is.mesh;
      if (is.rest < 1.5) {
        is.vy -= g * dt; M.position.x += is.vx * dt; M.position.y += is.vy * dt; M.position.z += is.vz * dt;
        M.rotation.x += is.wx * dt; M.rotation.z += is.wz * dt;
        const d = { x: M.position.x, y: M.position.y, z: M.position.z, vx: is.vx, vy: is.vy, vz: is.vz, rest: is.rest };
        if (collide(d, is.rad)) { is.wx *= 0.85; is.wz *= 0.85; }
        M.position.set(d.x, d.y, d.z); is.vx = d.vx; is.vy = d.vy; is.vz = d.vz; is.rest = d.rest;
      }
      if (M.position.y < -1 || is.life > 12) { this.root.remove(M); M.geometry.dispose(); continue; }
      if (is.life > 10) M.scale.setScalar(Math.max(0.01, 1 - (is.life - 10) / 2));
      kept.push(is);
    }
    this.islands = kept;
  }

  showCursor(hit, radius, tool) {
    if (!hit) { this.cursor.visible = false; return; }
    const c = this.cursor; c.visible = true;
    c.position.copy(hit.point); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal); c.scale.setScalar(radius);
    c.material.color.set({ scissors: 0xff4d57, thin: 0x7fa8ff, clipper: 0xffffff, razor: 0xffffff, comb: 0x7fa8ff }[tool] || 0xff4d57);
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  fitDist() {
    const a = this.camera.aspect, fv = this.camera.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * a);
    return Math.max(0.215 / Math.tan(fh / 2), 0.235 / Math.tan(fv / 2)) + 0.18;
  }
  applyCam(st = this.cam) {
    const c = this.camera, cp = Math.cos(st.pitch);
    const oy = st.offY || 0;
    if (Math.abs(oy) > 0.001) { const w = 1000, h = 1000 / c.aspect; c.setViewOffset(w, h, 0, -oy * h, w, h); } else if (c.view) c.clearViewOffset();
    c.position.set(st.tx + Math.sin(st.yaw) * cp * st.dist, st.ty + Math.sin(st.pitch) * st.dist, st.tz + Math.cos(st.yaw) * cp * st.dist);
    c.lookAt(st.tx, st.ty, st.tz);
  }
  render(dt) {
    if (this.dirtyChunks.size) this.flushChunks(this.stroke ? 40 : 80);
    if (dt) this.stepDebris(dt);
    this.applyCam();
    this.renderer.render(this.scene, this.camera);
  }
  // 回転するだけの動画（両端にバーバーポール）
  async recordSpin(sec, W, H, onp) {
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = (window.MediaRecorder && types.find(t => MediaRecorder.isTypeSupported(t))) || '';
    if (!mime) throw new Error('MediaRecorder unsupported');
    const out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d');
    const r = this.renderer, cv = this.canvas, ow = cv.width, oh = cv.height, pr = r.getPixelRatio(), cam = this.camera, asp = cam.aspect;
    this.recording = true; const cursor = this.cursor.visible; this.cursor.visible = false; this.flushChunks(1e9);
    r.setPixelRatio(1); r.setSize(W, H, false); cam.aspect = W / H; if (cam.view) cam.clearViewOffset(); cam.updateProjectionMatrix();
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#f6f8fb'); bg.addColorStop(1, '#e3e9f0');
    const sp = x.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.45, W * 0.75); sp.addColorStop(0, '#ffffff'); sp.addColorStop(1, '#ffffff00');
    const pole = (X, Y, w, h, off) => { x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip(); const cols = ['#e3262f', '#ffffff', '#2d5fd3', '#ffffff'], ws = [14, 9, 14, 9]; let q = 0; for (let p = Y - w - 46 - (off % 46); p < Y + h + 46;) { x.fillStyle = cols[q % 4]; x.beginPath(); x.moveTo(X, p + w); x.lineTo(X + w, p); x.lineTo(X + w, p + ws[q % 4]); x.lineTo(X, p + w + ws[q % 4]); x.closePath(); x.fill(); p += ws[q % 4]; q++; } x.restore(); };
    const stream = out.captureStream(30), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => rec.onstop = res);
    const y0 = 0.45; rec.start(200);
    const t0 = performance.now();
    await new Promise((res) => {
      const frame = () => {
        const t = (performance.now() - t0) / 1000, k = Math.min(1, t / sec);
        this.applyCam({ yaw: y0 + k * Math.PI * 2, pitch: 0.06, dist: 1.08, tx: 0, ty: 0.215, tz: -0.06 });
        r.render(this.scene, cam);
        x.fillStyle = bg; x.fillRect(0, 0, W, H); x.fillStyle = sp; x.fillRect(0, 0, W, H);
        x.drawImage(cv, 0, 0, W, H); pole(0, 0, 14, H, t * 60); pole(W - 14, 0, 14, H, t * 60);
        onp && onp(k);
        if (k < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
    await new Promise(r2 => setTimeout(r2, 250)); rec.stop(); await done;
    cam.aspect = asp; cam.updateProjectionMatrix(); r.setPixelRatio(pr); r.setSize(ow / pr, oh / pr, false);
    this.cursor.visible = cursor; this.recording = false;
    const type = mime.split(';')[0];
    return { blob: new Blob(chunks, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm' };
  }
  shot(size, yaw, pitch) {
    const r = this.renderer, cv = this.canvas, ow = cv.width, oh = cv.height, pr = r.getPixelRatio();
    const cursor = this.cursor.visible; this.cursor.visible = false;
    this.flushChunks(1e9);
    r.setPixelRatio(1); r.setSize(size, size, false);
    const cam = this.camera, asp = cam.aspect; cam.aspect = 1; if (cam.view) cam.clearViewOffset(); cam.updateProjectionMatrix();
    this.applyCam({ yaw, pitch, dist: 1.32, tx: 0, ty: 0.2, tz: -0.06 });
    r.render(this.scene, cam);
    const out = document.createElement('canvas'); out.width = out.height = size; out.getContext('2d').drawImage(cv, 0, 0, size, size);
    cam.aspect = asp; cam.updateProjectionMatrix(); r.setPixelRatio(pr); r.setSize(ow / pr, oh / pr, false);
    this.cursor.visible = cursor; this.render(0);
    return out;
  }
}
