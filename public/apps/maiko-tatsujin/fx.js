// 派手め演出：光跡つき火花・閃光・衝撃波・画面外へ伸びる帯リボン
import * as THREE from 'three';
import { radialTexture, obiTexture } from './textures.js';

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,240,200,.9)'); r.addColorStop(1, 'rgba(255,180,80,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (const [a, l, w] of [[0, 64, 5], [Math.PI / 2, 64, 5], [Math.PI / 4, 40, 3], [-Math.PI / 4, 40, 3]]) {
    g.save(); g.translate(64, 64); g.rotate(a);
    const lg = g.createLinearGradient(-l, 0, l, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(-l, -w / 2, l * 2, w); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sparks {
  constructor(scene, n = 900) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.col = new Float32Array(n * 3); this.drag = new Float32Array(n); this.grav = new Float32Array(n);
    this.linePos = new Float32Array(n * 6); this.lineCol = new Float32Array(n * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false; scene.add(this.lines);
    this.headPos = new Float32Array(n * 3); this.headCol = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.headPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.headCol, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: radialTexture('spark', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
    this.points.frustumCulled = false; scene.add(this.points);
    this.tmp = new THREE.Color();
  }
  // opts: { speed, up, color(s), life, spread(dir), gravity }
  emit(x, y, z, count, opts = {}) {
    const pal = opts.colors || ['#ffffff', '#fff1a8', '#ffd060', '#ff9a3c'];
    const sp = opts.speed ?? 5, up = opts.up ?? 0.7, life = opts.life ?? 0.6;
    for (let k = 0; k < count; k++) {
      const i = this.i = (this.i + 1) % this.n;
      let dx, dy, dz;
      if (opts.dir) { // 方向つき（円錐状）
        const s = opts.cone ?? 0.6;
        dx = opts.dir[0] + (Math.random() - 0.5) * s * 2; dy = opts.dir[1] + (Math.random() - 0.5) * s * 2; dz = opts.dir[2] + (Math.random() - 0.5) * s * 2;
      } else {
        const a = Math.random() * Math.PI * 2, e = Math.random();
        dx = Math.cos(a) * (1 - e * 0.4); dz = Math.sin(a) * (1 - e * 0.4); dy = up * (0.2 + e);
      }
      const l = Math.hypot(dx, dy, dz) || 1, v = sp * (0.35 + Math.random() * 0.9);
      this.vel[i * 3] = dx / l * v; this.vel[i * 3 + 1] = dy / l * v; this.vel[i * 3 + 2] = dz / l * v;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.max[i] = this.life[i] = life * (0.5 + Math.random() * 0.8);
      this.drag[i] = opts.drag ?? 1.6; this.grav[i] = opts.gravity ?? 9;
      this.tmp.set(pal[(Math.random() * pal.length) | 0]);
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
    }
  }
  update(dt, floorR) {
    const { pos, vel, life, max, col, linePos, lineCol, headPos, headCol } = this;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, k = i * 6;
      if (life[i] <= 0) { headPos[j + 1] = -99; linePos[k + 1] = linePos[k + 4] = -99; continue; }
      life[i] -= dt;
      const f = Math.exp(-this.drag[i] * dt);
      vel[j] *= f; vel[j + 2] *= f; vel[j + 1] = vel[j + 1] * f - this.grav[i] * dt;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.02 && pos[j] * pos[j] + pos[j + 2] * pos[j + 2] < floorR * floorR) { pos[j + 1] = 0.02; vel[j + 1] *= -0.45; vel[j] *= 0.7; vel[j + 2] *= 0.7; }
      const a = Math.max(0, life[i] / max[i]), hot = a * a;
      headPos[j] = pos[j]; headPos[j + 1] = pos[j + 1]; headPos[j + 2] = pos[j + 2];
      headCol[j] = col[j] * hot; headCol[j + 1] = col[j + 1] * hot; headCol[j + 2] = col[j + 2] * hot;
      const tl = 0.035 + 0.02 * a; // 光跡の長さ
      linePos[k] = pos[j]; linePos[k + 1] = pos[j + 1]; linePos[k + 2] = pos[j + 2];
      linePos[k + 3] = pos[j] - vel[j] * tl; linePos[k + 4] = pos[j + 1] - vel[j + 1] * tl; linePos[k + 5] = pos[j + 2] - vel[j + 2] * tl;
      lineCol[k] = col[j] * a; lineCol[k + 1] = col[j + 1] * a; lineCol[k + 2] = col[j + 2] * a;
      lineCol[k + 3] = lineCol[k + 4] = lineCol[k + 5] = 0;
    }
    this.lines.geometry.attributes.position.needsUpdate = true; this.lines.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Flares {
  constructor(scene, n = 16) {
    const tex = starTexture();
    this.pool = Array.from({ length: n }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      s.visible = false; s.renderOrder = 10; scene.add(s); return { s, t: 1, d: 0.3, size: 1 };
    });
    this.i = 0;
  }
  pop(x, y, z, size = 1.5, color = '#ffffff', dur = 0.32) {
    const f = this.pool[this.i = (this.i + 1) % this.pool.length];
    f.s.position.set(x, y, z); f.s.material.color.set(color); f.t = 0; f.d = dur; f.size = size; f.s.visible = true; f.s.material.rotation = Math.random() * Math.PI;
  }
  update(dt) {
    for (const f of this.pool) {
      if (!f.s.visible) continue; f.t += dt; const k = f.t / f.d;
      if (k >= 1) { f.s.visible = false; continue; }
      const sc = f.size * (k < 0.15 ? k / 0.15 * 1.2 : 1.2 - (k - 0.15) * 0.6);
      f.s.scale.setScalar(sc); f.s.material.opacity = 0.85 * (1 - k * k);
    }
  }
}

// 帯リボン：結び目から指の位置を通って画面外へ
export class ObiRibbon {
  constructor(scene, obiId) {
    this.N = 56;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 2 * 3); this.uv = new Float32Array(this.N * 2 * 2);
    const idx = []; for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    const map = obiTexture(obiId).clone(); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true;
    this.mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.45, metalness: obiId === 'kin' || obiId === 'gin' ? 0.35 : 0.08, transparent: true });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.scroll = 0; this.time = 0; this.free = null;
  }
  // p0:結び目, pf:指, pe:画面外, cam:カメラ位置, wave:揺れ量
  set(p0, pf, pe, cam, wave, scrollDelta) {
    this.mesh.visible = true; this.time += 0.016; this.scroll += scrollDelta;
    const mid = p0.clone().lerp(pf, 0.5); mid.y -= 0.12 + wave * 0.05;
    this.curve.points[0].copy(p0); this.curve.points[1].copy(mid); this.curve.points[2].copy(pf); this.curve.points[3].copy(pe);
    this.build(cam, wave);
  }
  // 腰に巻き付く点列 → 指 → 画面外
  setPath(head, pf, pe, cam, wave, scrollDelta) {
    this.mesh.visible = true; this.time += 0.016; this.scroll += scrollDelta;
    const last = head[head.length - 1], mid = last.clone().lerp(pf, 0.5); mid.y -= 0.12 + wave * 0.05;
    const pts = [...head.map(p => p.clone()), mid, pf.clone(), pe.clone()];
    if (this.curve.points.length !== pts.length) this.curve.points = pts; else pts.forEach((p, i) => this.curve.points[i].copy(p));
    this.build(cam, wave);
  }
  build(cam, wave) {
    const N = this.N, pts = this.curve.getSpacedPoints(N - 1), len = this.curve.getLength();
    const t = new THREE.Vector3(), side = new THREE.Vector3(), view = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[Math.min(N - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      t.subVectors(q, o).normalize(); view.subVectors(cam, p).normalize();
      side.crossVectors(t, view).normalize();
      // 布のねじれ・はためき
      const u = i / (N - 1), tw = Math.sin(u * 9 - this.time * 14) * wave * 0.5 * u;
      side.applyAxisAngle(t, tw);
      const w = 0.085 + 0.025 * u, ripple = Math.sin(u * 22 - this.time * 20) * 0.03 * wave * u;
      const nx = p.x + up.x * ripple, ny = p.y + ripple, nz = p.z;
      this.pos.set([nx - side.x * w, ny - side.y * w, nz - side.z * w, nx + side.x * w, ny + side.y * w, nz + side.z * w], i * 6);
      const v = u * len / 0.28 - this.scroll;
      this.uv.set([0, v, 1, v], i * 4);
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  // 引き切った瞬間：結び目から外れて画面外へ飛ぶ
  release(vel) { this.free = { t: 0, vel: vel.clone() }; }
  updateFree(dt, cam) {
    if (!this.free) return;
    const f = this.free; f.t += dt;
    for (const p of this.curve.points) { p.addScaledVector(f.vel, dt); }
    this.curve.points[0].addScaledVector(f.vel, dt * 1.6); // 先端がしなる
    f.vel.y -= 6 * dt;
    this.mat.opacity = Math.max(0, 1 - f.t / 0.7);
    this.time += dt; this.build(cam, 1.2);
    if (f.t > 0.7) { this.mesh.visible = false; this.free = null; this.mat.opacity = 1; }
  }
  hide() { this.mesh.visible = false; this.free = null; this.mat.opacity = 1; }
  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
