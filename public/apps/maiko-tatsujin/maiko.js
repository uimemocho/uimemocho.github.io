// 手続き生成の舞妓さん。正面は -Z、背中（だらりの帯）は +Z。
import * as THREE from 'three';
import { bodyScale, KIMONO_COLORS, OBI_COLORS } from './avatar.js';
import { kimonoTexture, obiTexture, faceTexture, kanokoTexture, radialTexture, streakTexture, fanTexture } from './textures.js';

const V = (x, y) => new THREE.Vector2(x, y);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });

function petalShape(r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 8; i++) {
    const a = i / (n * 8) * Math.PI * 2, k = 0.55 + 0.45 * Math.abs(Math.cos(a * n / 2));
    const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

function flowerMesh(r, color) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(petalShape(r)), std({ color, side: THREE.DoubleSide, roughness: 0.5, emissive: color, emissiveIntensity: 0.12 }));
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), std({ color: '#f2c14e', metalness: 0.4, roughness: 0.3 }));
  c.position.z = r * 0.05; m.add(c);
  return m;
}

export function buildMaiko(look) {
  const sc = bodyScale(look), H = sc.height, R = sc.hem, ok = sc.okobo;
  const kc = KIMONO_COLORS[look.color], oc = OBI_COLORS[look.obi];
  const root = new THREE.Group();          // 舞台上の位置
  const tilt = new THREE.Group();          // ぐらつき
  const spin = new THREE.Group();          // 回転
  const body = new THREE.Group();          // スケール
  root.add(tilt); tilt.add(spin); spin.add(body);
  body.scale.setScalar(H);

  const kimonoMat = std({ map: kimonoTexture(look.color), roughness: 0.62 });
  const obiMat = std({ map: obiTexture(look.obi), roughness: 0.42, metalness: look.obi === 'kin' || look.obi === 'gin' ? 0.35 : 0.08 });
  const skin = std({ color: '#fbf1ec', roughness: 0.55 });
  const hairMat = std({ color: '#0d0b10', roughness: 0.28, metalness: 0.1 });
  const red = std({ color: '#c8102e', roughness: 0.5 });
  const cast = (m) => { m.castShadow = true; return m; };

  // おこぼ
  for (const sx of [-1, 1]) {
    const g = cast(new THREE.Mesh(new THREE.BoxGeometry(0.07, ok, 0.13), std({ color: '#1a1012', roughness: 0.25, metalness: 0.2 })));
    g.position.set(sx * 0.055, ok / 2, -0.03); body.add(g);
  }
  // 裾（ろくろ形状）
  const rh = 0.3 * R;
  const skirtPts = [V(rh, ok + 0.01), V(rh * 0.985, ok + 0.06), V(rh * 0.86, ok + 0.2), V(0.205, ok + 0.36), V(0.165, ok + 0.5), V(0.155, ok + 0.56)];
  const skirt = cast(new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 40), kimonoMat)); body.add(skirt);
  const under = new THREE.Mesh(new THREE.LatheGeometry([V(rh * 1.02, ok + 0.005), V(rh * 1.0, ok + 0.035)], 40), red); body.add(under);
  // 胴
  const torso = cast(new THREE.Mesh(new THREE.LatheGeometry([V(0.155, ok + 0.55), V(0.165, ok + 0.7), V(0.16, ok + 0.8), V(0.135, ok + 0.87), V(0.06, ok + 0.905)], 32), kimonoMat));
  body.add(torso);
  // 体表の半径（高さ→半径）。めり込み防止の当たり判定に使う
  const surf = [...skirtPts.map(p => [p.y, p.x]), [ok + 0.56, 0.18], [ok + 0.75, 0.18], [ok + 0.8, 0.165], [ok + 0.87, 0.14], [ok + 0.905, 0.07]].sort((a, b) => a[0] - b[0]);
  const surfR = (h) => {
    if (h <= surf[0][0]) return surf[0][1]; if (h >= surf[surf.length - 1][0]) return 0;
    for (let i = 1; i < surf.length; i++) if (h <= surf[i][0]) { const [y0, r0] = surf[i - 1], [y1, r1] = surf[i]; return r0 + (r1 - r0) * (h - y0) / (y1 - y0 || 1); }
    return 0;
  };
  // 襟（赤い半襟）
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 24, Math.PI * 1.3), red);
  collar.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.85 - Math.PI / 2); collar.position.set(0, ok + 0.885, -0.01); body.add(collar);
  // 帯
  const obi = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.176, 0.17, 36, 1, true), obiMat)); obi.position.y = ok + 0.645; body.add(obi);
  const obiage = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.178, 0.025, 36, 1, true), std({ color: '#e8364f', roughness: 0.6 })); obiage.position.y = ok + 0.74; body.add(obiage);
  const obijime = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.007, 6, 40), std({ color: '#f4d27a', metalness: 0.5, roughness: 0.3 })); obijime.rotation.x = Math.PI / 2; obijime.position.y = ok + 0.64; body.add(obijime);
  const pocchiri = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), std({ color: '#3fb58a', metalness: 0.2, roughness: 0.15 })); pocchiri.position.set(0, ok + 0.64, -0.186); pocchiri.scale.set(1.4, 1, 0.6); body.add(pocchiri);

  // だらりの帯（背中に垂れる2枚）
  const darari = new THREE.Group(); darari.position.set(0, ok + 0.72, 0.18); body.add(darari);
  const knot = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), obiMat)); knot.rotation.z = Math.PI / 2; knot.scale.set(1, 1, 0.7); knot.position.set(0, -0.005, 0.03); darari.add(knot);
  const panels = [];
  const monMat = std({ map: obiTexture(look.obi, true), side: THREE.DoubleSide, roughness: 0.45, metalness: obiMat.metalness });
  for (const [x, len] of [[-0.04, 0.6], [0.045, 0.66]]) {
    const pv = new THREE.Group(); pv.position.set(x, -0.03, 0.045); darari.add(pv);
    const geo = new THREE.PlaneGeometry(0.13, len, 1, 16); geo.translate(0, -len / 2, 0);
    { // 裾の広がりに沿って外へ逃がす
      const pa = geo.attributes.position, zTop = 0.18 + 0.045;
      for (let k = 0; k < pa.count; k++) { const h = ok + 0.72 - 0.03 + pa.getY(k), r = surfR(h) + 0.018; pa.setZ(k, Math.max(0, Math.sqrt(Math.max(0, r * r - (x + pa.getX(k)) ** 2)) - zTop)); }
      geo.computeVertexNormals();
    }
    const m = cast(new THREE.Mesh(geo, monMat)); pv.add(m);
    panels.push({ pv, m, len, base: geo.attributes.position.array.slice() });
  }
  // 帯の先の房（引っ張るときの目印）
  const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), std({ color: '#ffd60a', emissive: '#ffb000', emissiveIntensity: 0.0, roughness: 0.4 }));
  panels[1].m.add(tassel); tassel.position.set(0, -panels[1].len - 0.02, 0.01);

  // 腕（肩・肘・手首の2関節）と振袖
  const UP = new THREE.Vector3(0, 1, 0);
  const limb = (a, b, r0, r1, mat, seg = 12) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = cast(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg, 1), mat));
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize());
    return m;
  };
  const ball = (p, r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat); m.position.copy(p); return m; };
  const solveElbow = (S, H, L1, L2, hint) => {
    const d = new THREE.Vector3().subVectors(H, S), dist = Math.min(d.length(), L1 + L2 - 1e-4), dir = d.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const perp = hint.clone().sub(dir.clone().multiplyScalar(hint.dot(dir))).normalize();
    return S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  };
  const POSES = {
    none: { L: [-0.035, 0.6, -0.2], R: [0.035, 0.61, -0.205] },
    sensu: { L: [-0.05, 0.62, -0.19], R: [0.13, 0.86, -0.2] },
    kasa: { L: [-0.05, 0.62, -0.19], R: [0.075, 0.77, -0.18] },
    kinchaku: { L: [-0.15, 0.6, -0.24], R: [0.035, 0.61, -0.205] },
  };
  const pose0 = POSES[look.item] || POSES.none;
  const sleeveTex = kimonoMat.map.clone(); sleeveTex.repeat.set(2.4, 1.6); sleeveTex.offset.set(0.1, 0.72); sleeveTex.needsUpdate = true;
  const sleeveMat = std({ map: sleeveTex, roughness: 0.62, side: THREE.DoubleSide });
  const lining = std({ color: '#d4203c', roughness: 0.55 });
  const arms = [], hands = {};
  for (const sx of [-1, 1]) {
    const S = new THREE.Vector3(sx * 0.132, ok + 0.845, 0.005);
    const tgt = pose0[sx > 0 ? 'R' : 'L'], H = new THREE.Vector3(tgt[0], ok + tgt[1], tgt[2]);
    const L1 = 0.2, L2 = 0.185;
    const E = solveElbow(S, H, L1, L2, new THREE.Vector3(sx, -0.55, 0.45).normalize());
    const W = E.clone().add(new THREE.Vector3().subVectors(H, E).setLength(L2));
    const g = new THREE.Group(); g.position.copy(S); body.add(g);
    const s0 = new THREE.Vector3(), e = E.clone().sub(S), w = W.clone().sub(S);
    // 肩の丸み・上腕・肘・前腕（着物の袖に包まれている）
    g.add(ball(s0, 0.045, kimonoMat));
    g.add(limb(s0, e, 0.04, 0.035, kimonoMat)); g.add(ball(e, 0.035, kimonoMat));
    g.add(limb(e, w, 0.034, 0.03, kimonoMat));
    // 袖口から出る手首と手
    const dir = new THREE.Vector3().subVectors(w, e).normalize();
    const cuff = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.03, 14, 1, true), lining));
    cuff.position.copy(w); cuff.quaternion.setFromUnitVectors(UP, dir); g.add(cuff);
    g.add(limb(w.clone().addScaledVector(dir, -0.01), w.clone().addScaledVector(dir, 0.03), 0.018, 0.016, skin, 10));
    const hand = new THREE.Group(); hand.position.copy(w).addScaledVector(dir, 0.055); hand.quaternion.setFromUnitVectors(UP, dir); g.add(hand);
    const palm = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin)); palm.scale.set(0.021, 0.038, 0.012); hand.add(palm);
    const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.026, 3, 8), skin); fingers.position.set(0, 0.034, -0.002); fingers.scale.set(1.8, 1, 0.9); hand.add(fingers);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.018, 3, 6), skin); thumb.position.set(-sx * 0.016, 0.006, -0.006); thumb.rotation.z = sx * 0.6; hand.add(thumb);
    hands[sx > 0 ? 'R' : 'L'] = { g, hand, w, dir };
    // 振袖：前腕に沿って垂れる厚みのある布（縁は赤い裏地）
    const x = dir.clone(), y = UP.clone().sub(x.clone().multiplyScalar(UP.dot(x))).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    const basis = new THREE.Group(); basis.position.copy(e); basis.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); g.add(basis);
    const swing = new THREE.Group(); basis.add(swing);
    const len = e.distanceTo(w), sw = len + 0.05, sh = 0.46, cr = 0.08, x0 = -0.035;
    const shp = new THREE.Shape(); shp.moveTo(x0, 0.03); shp.lineTo(x0 + sw, 0.03); shp.lineTo(x0 + sw, -sh + cr);
    shp.quadraticCurveTo(x0 + sw, -sh, x0 + sw - cr, -sh); shp.lineTo(x0 + cr, -sh); shp.quadraticCurveTo(x0, -sh, x0, -sh + cr); shp.closePath();
    const sgeo = new THREE.ExtrudeGeometry(shp, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.007, bevelSegments: 2, curveSegments: 8 });
    sgeo.translate(0, 0, -0.008);
    { // 体の中に入る部分を外へ押し出す（肩位置 S と袖の基底で体の座標へ）
      const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(e.clone().add(S)), inv = m.clone().invert(), pa = sgeo.attributes.position, v = new THREE.Vector3();
      for (let k = 0; k < pa.count; k++) {
        v.fromBufferAttribute(pa, k).applyMatrix4(m);
        const rad = Math.hypot(v.x, v.z), need = surfR(v.y) + 0.03;
        if (rad < need) { const f = need / Math.max(rad, 1e-4); v.x *= f; v.z *= f; v.applyMatrix4(inv); pa.setXYZ(k, v.x, v.y, v.z); }
      }
      sgeo.computeVertexNormals();
    }
    const sleeve = cast(new THREE.Mesh(sgeo, [sleeveMat, lining])); swing.add(sleeve);
    const outward = Math.sign(z.x * sx) || 1;
    arms.push({ g, sx, swing, outward });
  }
  // 襟の重ね（左前にならないよう右前で）
  const juban = std({ color: '#fbf6f0', roughness: 0.6 }), edge = std({ color: kc.deep, roughness: 0.6 });
  for (const sx of [1, -1]) {
    const top = new THREE.Vector3(sx * 0.048, ok + 0.892, -0.05), bot = new THREE.Vector3(-sx * 0.01, ok + 0.745, -0.172 - (sx > 0 ? 0.004 : 0));
    const c1 = limb(top, bot, 0.0075, 0.0075, juban, 6); c1.scale.z = 0.5; body.add(c1);
    const off = new THREE.Vector3(sx * 0.014, 0, -0.003);
    const c2 = limb(top.clone().add(off), bot.clone().add(off), 0.008, 0.008, edge, 6); c2.scale.z = 0.5; body.add(c2);
  }
  // 首と頭
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.09, 12), skin); neck.position.y = ok + 0.94; body.add(neck);
  const head = new THREE.Group(); head.position.y = ok + 1.06; body.add(head);
  const face = cast(new THREE.Mesh(new THREE.SphereGeometry(0.112, 32, 24), std({ map: faceTexture(), roughness: 0.55 })));
  face.scale.set(0.95, 1.05, 0.98); head.add(face);
  // 割れしのぶ
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), hairMat); cap.position.y = 0.012; cap.rotation.x = -0.32; head.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), hairMat); back.position.set(0, 0.0, 0.038); back.scale.set(1.02, 1.02, 0.95); head.add(back);
  for (const sx of [-1, 1]) {
    const bin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), hairMat); bin.position.set(sx * 0.1, -0.005, 0.02); bin.scale.set(0.55, 1, 1.05); head.add(bin);
  }
  const bun = cast(new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), hairMat)); bun.position.set(0, 0.14, 0.03); bun.scale.set(1.2, 0.78, 0.95); head.add(bun);
  for (const sx of [-1, 1]) { const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), hairMat); lobe.position.set(sx * 0.065, 0.15, 0.0); head.add(lobe); }
  const kanoko = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 10), std({ map: kanokoTexture(), roughness: 0.6 })); kanoko.position.set(0, 0.17, -0.04); kanoko.scale.set(1, 0.7, 0.55); head.add(kanoko);
  const tabo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), hairMat); tabo.position.set(0, -0.06, 0.11); tabo.scale.set(1, 0.75, 0.8); head.add(tabo);

  // 簪
  const danglers = [];
  const addDangler = (parent, x, y, z, colors, n = 4, step = 0.035) => {
    const pv = new THREE.Group(); pv.position.set(x, y, z); parent.add(pv);
    for (let i = 0; i < n; i++) {
      const f = flowerMesh(0.016, colors[i % colors.length]); f.position.y = -step * (i + 1); f.rotation.y = Math.PI; pv.add(f);
    }
    danglers.push(pv);
  };
  if (look.kanzashi === 'hana') {
    const g = new THREE.Group(); g.position.set(-0.08, 0.1, -0.08); head.add(g);
    [['#ff8fb1', 0, 0, 0.034], ['#ffffff', 0.04, 0.03, 0.028], ['#ff4d6d', -0.035, 0.03, 0.026], ['#ffc2d4', 0.02, -0.035, 0.024], ['#ffffff', -0.03, -0.025, 0.022]].forEach(([c, x, y, r]) => {
      const f = flowerMesh(r, c); f.position.set(x, y, 0); f.rotation.y = Math.PI + 0.5; g.add(f);
    });
    addDangler(head, -0.11, 0.06, -0.06, ['#ff8fb1', '#ffffff']); addDangler(head, -0.085, 0.06, -0.085, ['#ff4d6d', '#ffc2d4'], 5);
  } else if (look.kanzashi === 'cho') {
    const silver = std({ color: '#e9eef5', metalness: 0.95, roughness: 0.18, side: THREE.DoubleSide });
    const g = new THREE.Group(); g.position.set(0.06, 0.16, -0.06); head.add(g);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), silver); w.scale.set(1, 0.7, 1); w.position.set(sx * 0.03, 0.01, 0); w.rotation.set(0, Math.PI + sx * 0.6, sx * 0.4); g.add(w);
      const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), silver); w2.position.set(sx * 0.024, -0.025, 0); w2.rotation.set(0, Math.PI + sx * 0.6, -sx * 0.3); g.add(w2);
    }
    const silverDang = ['#e9eef5', '#bfd3ff'];
    addDangler(head, 0.1, 0.1, -0.05, silverDang, 5, 0.03); addDangler(head, 0.07, 0.1, -0.08, silverDang, 4, 0.03);
  } else if (look.kanzashi === 'bekko') {
    const tort = std({ color: '#7a3e12', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
    const comb = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 20, Math.PI * 0.9), tort); comb.position.set(0, 0.1, -0.02); comb.rotation.set(-0.3, 0, Math.PI * 0.05); comb.scale.set(1, 0.7, 1); head.add(comb);
    for (const sx of [-1, 1]) { const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 8), tort); stick.rotation.z = Math.PI / 2; stick.position.set(0, 0.13, 0.04 + sx * 0.03); head.add(stick); }
  }

  // 持ち物（手に持たせる）
  let canopy = null, fan = null, kasaG = null, kasaArm = null;
  const Rh = hands.R, Lh = hands.L;
  if (look.item === 'sensu') {
    const fg = new THREE.Group(); fg.position.copy(Rh.w).addScaledVector(Rh.dir, 0.06); Rh.g.add(fg);
    fan = cast(new THREE.Mesh(new THREE.CircleGeometry(0.17, 24, Math.PI * 0.16, Math.PI * 0.68), std({ map: fanTexture(), side: THREE.DoubleSide, roughness: 0.5 })));
    fan.rotation.set(0.15, Math.PI, -0.35); fan.position.z = -0.03; fg.add(fan);
    const ribs = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12, Math.PI * 0.16, Math.PI * 0.68), std({ color: '#2a1408', side: THREE.DoubleSide })); ribs.rotation.copy(fan.rotation); ribs.position.z = 0.001; fg.add(ribs);
  } else if (look.item === 'kasa') {
    const kg = new THREE.Group(); kg.position.copy(Rh.w).addScaledVector(Rh.dir, 0.05); Rh.g.add(kg);
    kasaG = kg; kasaArm = Rh.g;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 6), std({ color: '#6b3a1c' })); stick.position.y = 0.3; kg.add(stick);
    const can = new THREE.Group(); can.position.y = 0.67; kg.add(can);
    const top = cast(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.13, 24, 1, true), std({ color: '#c8102e', side: THREE.DoubleSide, roughness: 0.6 })));
    can.add(top);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std({ color: '#111' })); hub.position.y = 0.08; can.add(hub);
    // 骨：傘の内側の面に沿わせる（面の頂点と同じ角度に置き、少し内側へ）
    const ribMat = std({ color: '#5a2a10' }), CR = 0.34, CH = 0.13, IN = 0.012;
    for (let i = 0; i < 24; i += 2) {
      const th = i / 24 * Math.PI * 2, rr = CR - 0.006;
      const A = new THREE.Vector3(0, CH / 2 - IN, 0), B = new THREE.Vector3(Math.sin(th) * rr, CH / 2 - CH * (rr / CR) - IN, Math.cos(th) * rr);
      can.add(limb(A, B, 0.0028, 0.0028, ribMat, 5));
      // 受け骨（柄から骨の中ほどへ）
      const rm = 0.15, M = new THREE.Vector3(Math.sin(th) * rm, CH / 2 - CH * (rm / CR) - IN - 0.004, Math.cos(th) * rm);
      can.add(limb(new THREE.Vector3(0, -0.15, 0), M, 0.002, 0.002, ribMat, 4));
    }
    canopy = can;
  } else if (look.item === 'kinchaku') {
    const bg = new THREE.Group(); bg.position.copy(Lh.w).addScaledVector(Lh.dir, 0.05); Lh.g.add(bg);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 4), std({ color: '#f4d27a' })); cord.position.y = -0.045; bg.add(cord);
    const bag = cast(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), std({ map: kanokoTexture(), roughness: 0.6 }))); bag.scale.set(1, 1.15, 0.8); bag.position.y = -0.14; bg.add(bag);
    const neckBag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.03, 12), bag.material); neckBag.position.y = -0.085; bg.add(neckBag);
    danglers.push(bg);
  }

  // 残像（高速回転の気配）
  const blur = new THREE.Mesh(new THREE.CylinderGeometry(rh * 1.06, 0.2, 0.56, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: streakTexture(), color: kc.accent, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  blur.position.y = ok + 0.28; blur.material.map.repeat.set(3, 1); body.add(blur);
  // 足元の影
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTexture('shadow', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; shadow.scale.setScalar(rh * 2.8 * H); root.add(shadow);
  // 足元の光の輪（自分=金、相手=朱）
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 48), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; ring.scale.setScalar(H * R); root.add(ring);

  // 傾けた時は裾の縁を支点にする（床に沈まない）
  const _q = new THREE.Quaternion(), _rim = new THREE.Vector3(), _tmp = new THREE.Vector3(), _down = new THREE.Vector3();
  const rimPivot = () => {
    _q.setFromEuler(tilt.rotation);
    _down.set(0, 1, 0).applyQuaternion(_q); // 傾いた軸
    const hx = _down.x, hz = _down.z, hl = Math.hypot(hx, hz);
    if (hl < 1e-4) { tilt.position.set(0, 0, 0); return; }
    _rim.set(hx / hl * rh * H, 0, hz / hl * rh * H);   // 傾いた側の裾の縁
    _tmp.copy(_rim).applyQuaternion(_q);
    tilt.position.copy(_rim).sub(_tmp);
  };
  let tail = 1, vis = 0, flare = 0, fallT = 0, lean = 0, faceAngle = null, pose = 0, sway = 0, time = Math.random() * 10;

  return {
    root, spin, tilt, ring, tassel, height: (ok + 1.25) * H,
    setRingColor(c, o = 0.8) { ring.material.color.set(c); ring.material.opacity = o; },
    // s: { omega, omegaMax, wob, phi, state, endT, pull, dt, win }
    update(s) {
      const dt = s.dt; time += dt;
      const spinning = s.state === 'spin';
      const ratio = Math.min(1, (s.omega || 0) / (s.omegaMax || 1));
      // 見た目の回転は折り返し防止のため上限あり
      const boost = s.boost || 0;
      const visRate = (15 + 24 * boost) * Math.tanh((s.omega || 0) / 26);
      if (faceAngle !== null && !spinning) {
        const d = ((faceAngle - vis) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        vis += d * Math.min(1, dt * 4);
      } else vis += (spinning ? visRate : (s.preSpin || 0)) * dt;
      spin.rotation.y = vis;
      // 遠心力で袖と帯が広がる
      const targetFlare = spinning ? Math.min(1.35, 0.25 + ratio * 1.25 + boost * 0.3) : (s.preSpin) ? Math.min(1.1, s.preSpin * 0.05) : (s.pull ? 0 : 0.03 + 0.03 * Math.sin(time * 2));
      flare += (Math.min(targetFlare, s.flareCap ?? 9) - flare) * Math.min(1, dt * 6);
      flare = Math.max(0, flare);
      const flareD = Math.max(0, Math.min(flare, s.flareCapD ?? 9));
      const pull = s.pull || 0;
      panels.forEach((p, i) => {
        p.pv.rotation.x = -(flareD * (0.95 + i * 0.12) + pull * 0.35);
        p.pv.scale.y = Math.max(0.02, tail * (i === 1 ? 1 : 0.9));
        p.pv.visible = tail > 0.01;
        p.pv.rotation.z = spinning ? Math.sin(time * 9 + i) * 0.05 * flareD : 0;
      });
      tassel.material.emissiveIntensity = s.pullHint ? 0.6 + 0.4 * Math.sin(time * 6) : 0;
      tassel.scale.setScalar(s.pullHint ? 1.6 : 1);
      arms.forEach(({ g, sx, swing, outward }) => {
        // 回転が速いほど腕が広がり、袖が遠心力で舞い上がる
        const raise = sx > 0 ? pose * (fan ? 1.25 : canopy ? 0.2 : 0.9) : pose * 0.25;
        g.rotation.z = sx * (flare * 0.85 + raise);
        g.rotation.y = -sx * flare * 0.25;
        swing.rotation.x = -outward * (flare * 1.15 + 0.05 + (0.5 + 0.5 * Math.sin(time * 1.7 + sx)) * 0.03);
      });
      danglers.forEach((d, i) => { d.rotation.z = (i % 2 ? 1 : -1) * flare * 0.8; d.rotation.x = flare * 0.9 + (0.5 + 0.5 * Math.sin(time * 7 + i)) * 0.08 * (flare + 0.2); });
      if (kasaG) kasaG.quaternion.copy(kasaArm.quaternion).invert(); // 腕が広がっても傘はまっすぐ
      if (canopy) canopy.rotation.y += visRate * dt * 0.3;
      blur.material.opacity = spinning ? Math.min(0.95, 0.18 + ratio * 0.55 + boost * 0.35) : Math.min(0.5, (s.preSpin || 0) * 0.025);
      blur.material.map.offset.x -= dt * (6 * ratio + 10 * boost + (s.preSpin || 0) * 0.3);
      // 引っ張り時の前傾
      lean += ((pull ? -0.12 * pull : 0) - lean) * Math.min(1, dt * 10);
      // ぐらつき・倒れ
      if (s.state === 'fallen') {
        // コテン：少し粘ってから倒れ、床で小さく跳ねる
        fallT = Math.min(1, fallT + dt * 1.6);
        const u = fallT, bounce = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
        const e = bounce(Math.min(1, u * u * 1.6 + u * 0.2)), a = 1.36 * e;
        tilt.rotation.set(Math.sin(s.phi) * a, 0, Math.cos(s.phi) * a); rimPivot();
      } else {
        fallT = 0;
        const w = Math.min(1, s.wob || 0) * 0.42;
        sway *= Math.exp(-dt * 1.5);
        if (s.state === 'stopped') sway = Math.max(sway, 0.0);
        tilt.rotation.set(Math.sin(s.phi || 0) * w + lean, 0, Math.cos(s.phi || 0) * w + sway * Math.sin(time * 5)); rimPivot();
      }
      // 勝ちポーズ（扇を掲げる）
      pose += ((s.win ? 1 : 0) - pose) * Math.min(1, dt * 3);
      if (s.win && !spinning) faceAngle = s.faceTo ?? 0; else if (spinning) faceAngle = null;
    },
    stopSway() { sway = 0.35; },
    setTail(v) { tail = Math.max(0, Math.min(1, v)); },
    knot, obiId: look.obi,
    resetFace(a) { vis = a; faceAngle = null; },
  };
}
