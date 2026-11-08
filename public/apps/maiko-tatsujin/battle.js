// 回転バトルの純粋シミュレーション（描画なし）。オンライン時はホスト側だけが進める。
import { physicsFor } from './avatar.js';

export const STAGE_R = 3.0;
export const TIME_LIMIT = 40;
export const DASH_MAX = 3;
const DASH_RECHARGE = 3.5;
const DT = 1 / 120;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTop(look, side) {
  const p = physicsFor(look);
  return {
    side, look, p,
    x: 0, z: side === 0 ? 1.7 : -1.7, vx: 0, vz: 0,
    omega: 0, wob: 0, phi: side * Math.PI, spin: 0,
    launched: false, superb: false, power: 0,
    state: 'ready', // ready | spin | stopped | fallen | out
    endT: 0, dashes: DASH_MAX, dashT: 0, cd: 0,
    maxOmega: 0, crits: 0, hits: 0, dashCount: 0, critT: -9, dashT0: -9, dashHitT: -9,
  };
}

export class Battle {
  constructor(lookA, lookB, seed = 1) {
    this.tops = [makeTop(lookA, 0), makeTop(lookB, 1)];
    this.rng = mulberry32(seed);
    this.t = 0; this.acc = 0; this.lastHit = -1;
    this.started = false; this.over = false; this.result = null;
    this.events = []; this.eventSeq = 0;
  }

  emit(e) { e.id = ++this.eventSeq; this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // power 0..1, angle（ラジアン、左右の狙い）
  launch(side, power, angle, superb = false) {
    const a = this.tops[side];
    if (a.launched) return;
    power = Math.max(0.08, Math.min(1, power));
    angle = Math.max(-0.9, Math.min(0.9, angle || 0));
    a.launched = true; a.power = power; a.superb = !!superb;
    a.omega = a.p.omegaMax * (0.42 + 0.58 * power) * (superb ? 1.06 : 1);
    const dir = side === 0 ? -1 : 1, spd = a.p.launch * (0.3 + 0.7 * power);
    a.vx = Math.sin(angle) * spd * (side === 0 ? 1 : -1);
    a.vz = dir * Math.cos(angle) * spd;
    a.state = 'spin';
    a.maxOmega = a.omega;
    if (this.tops[0].launched && this.tops[1].launched) { this.started = true; this.emit({ type: 'start' }); }
  }

  dash(side, tx, tz) {
    const a = this.tops[side], b = this.tops[1 - side];
    if (!this.started || this.over || a.state !== 'spin' || a.dashes <= 0 || a.cd > 0) return false;
    let dx = (tx ?? b.x) - a.x, dz = (tz ?? b.z) - a.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    a.vx = a.vx * 0.35 + dx * a.p.dash; a.vz = a.vz * 0.35 + dz * a.p.dash;
    a.omega -= a.p.omegaMax * 0.03;
    a.dashes--; a.cd = 0.45; a.dashCount++; a.dashT0 = this.t;
    this.emit({ type: 'dash', side });
    return true;
  }

  update(dt) {
    if (!this.started || this.over) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= DT && !this.over) { this.step(DT); this.acc -= DT; }
  }

  step(dt) {
    this.t += dt;
    for (const a of this.tops) this.stepTop(a, dt);
    this.collide(dt);
    this.checkEnd();
  }

  stepTop(a, dt) {
    if (a.state === 'out') { a.x += a.vx * dt; a.z += a.vz * dt; a.endT += dt; return; }
    const alive = a.state === 'spin';
    // 回転の減衰（ぐらつくほど裾が擦れて減る）
    const decay = a.p.decay + a.omega * 0.006 + a.wob * 3.2;
    a.omega = Math.max(0, a.omega - decay * dt * (alive ? 1 : 4));
    a.spin += a.omega * dt;
    // ぐらつき
    if (alive) {
      if (a.omega < a.p.wobbleOmega) a.wob += dt * a.p.wobbleGain * 0.6 * (1.12 - a.omega / a.p.wobbleOmega);
      else a.wob = Math.max(0, a.wob - dt * 0.22);
      a.phi += dt * (3 + a.omega * 0.08);
    }
    // 舞台はわずかなすり鉢。中央へ寄りつつ、回転の向きに流れる
    const r = Math.hypot(a.x, a.z) || 1e-6;
    const orbit = alive ? 0.32 * Math.min(1, a.omega / a.p.omegaMax) : 0;
    const ax = -a.x * 0.95 + (-a.z / r) * orbit + (alive ? Math.cos(a.phi) * a.wob * 0.9 : 0);
    const az = -a.z * 0.95 + (a.x / r) * orbit + (alive ? Math.sin(a.phi) * a.wob * 0.9 : 0);
    a.vx += ax * dt; a.vz += az * dt;
    const fr = Math.exp(-(alive ? 0.42 : 3.5) * dt);
    a.vx *= fr; a.vz *= fr;
    a.x += a.vx * dt; a.z += a.vz * dt;
    if (a.cd > 0) a.cd -= dt;
    if (a.dashes < DASH_MAX) { a.dashT += dt; if (a.dashT >= DASH_RECHARGE) { a.dashes++; a.dashT = 0; } }
    a.maxOmega = Math.max(a.maxOmega, a.omega);
    // 舞台の縁
    const lim = STAGE_R - a.p.radius * 0.45, d = Math.hypot(a.x, a.z);
    if (d > lim) {
      const nx = a.x / d, nz = a.z / d, vr = a.vx * nx + a.vz * nz;
      if (alive && (vr > 3.5 || (vr > 1.5 && a.wob > 0.6) || (vr > 2.0 && this.t - a.critT < 0.8))) {
        a.state = 'out'; a.endT = 0; this.emit({ type: 'out', side: a.side, x: a.x, z: a.z, dashKO: this.t - a.dashHitT < 1.2 });
      } else if (vr > 0) {
        a.vx -= 1.5 * vr * nx; a.vz -= 1.5 * vr * nz;
        a.x = nx * lim; a.z = nz * lim;
        if (vr > 0.5) this.emit({ type: 'rim', side: a.side, x: a.x, z: a.z, power: vr });
      }
    }
    if (alive) {
      if (a.wob >= 1) { a.state = 'fallen'; a.endT = 0; this.emit({ type: 'fallen', side: a.side, dashKO: this.t - a.dashHitT < 1.2 }); }
      else if (a.omega < 6.5) { a.state = 'stopped'; a.endT = 0; this.emit({ type: 'stopped', side: a.side, dashKO: this.t - a.dashHitT < 1.2 }); }
    } else a.endT += dt;
  }

  collide() {
    const [a, b] = this.tops;
    if (a.state === 'out' || b.state === 'out') return;
    let dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz), rr = a.p.radius + b.p.radius;
    if (d >= rr || d < 1e-6) return;
    const nx = dx / d, nz = dz / d, tx = -nz, tz = nx;
    // 押し戻し
    const pen = rr - d, ia = 1 / a.p.mass, ib = 1 / b.p.mass, sw = ia + ib;
    a.x -= nx * pen * ia / sw; a.z -= nz * pen * ia / sw;
    b.x += nx * pen * ib / sw; b.z += nz * pen * ib / sw;
    const rvx = b.vx - a.vx, rvz = b.vz - a.vz, vn = rvx * nx + rvz * nz;
    if (vn >= 0 || this.t - this.lastHit < 0.06) return;
    this.lastHit = this.t;
    const spinA = a.state === 'spin' ? a.omega : 0, spinB = b.state === 'spin' ? b.omega : 0;
    // 回転同士の弾き：回転が強いほど大きく弾き合う
    const clash = (spinA * a.p.radius + spinB * b.p.radius);
    const e = 0.5 + 0.4 * Math.min(1, (spinA + spinB) / 140);
    const J = ((1 + e) * (-vn) + Math.min(1.0, clash * 0.02)) / sw;
    const Jt = 0.22 * J * Math.min(1, clash / 40);
    a.vx -= (nx * J + tx * Jt) * ia; a.vz -= (nz * J + tz * Jt) * ia;
    b.vx += (nx * J + tx * Jt) * ib; b.vz += (nz * J + tz * Jt) * ib;
    // 回転とぐらつきへの影響
    const tot = spinA + spinB + 1e-6;
    const Js = Math.min(J, 7);
    const lossA = Js * ia * 1.25 * (0.55 + 0.45 * spinB / tot), lossB = Js * ib * 1.25 * (0.55 + 0.45 * spinA / tot);
    a.omega = Math.max(0, a.omega - lossA); b.omega = Math.max(0, b.omega - lossB);
    a.wob += J * ia * 0.045 * a.p.wobbleGain; b.wob += J * ib * 0.045 * b.p.wobbleGain;
    a.hits++; b.hits++;
    // 踏み込み中の相手に当てられた記録（踏み込みKOの判定用）
    if (this.t - b.dashT0 < 0.7) a.dashHitT = this.t;
    if (this.t - a.dashT0 < 0.7) b.dashHitT = this.t;
    // 会心：速く踏み込んだ側が判定
    const relSpeed = Math.max(0, -vn);
    let crit = -1;
    if (relSpeed > 1.7) {
      const pa = a.vx * nx + a.vz * nz, pb = -(b.vx * nx + b.vz * nz);
      const atk = pa >= pb ? a : b, def = atk === a ? b : a;
      if (atk.state === 'spin' && this.rng() < atk.p.crit * Math.min(1.6, relSpeed / 2.4)) {
        crit = atk.side; atk.crits++;
        def.omega = Math.max(0, def.omega - 8 - relSpeed * 1.6);
        def.wob += 0.22 * def.p.wobbleGain; def.critT = this.t;
        const k = 1.1 / def.p.mass, sx = def === b ? nx : -nx, sz = def === b ? nz : -nz;
        def.vx += sx * k * 1.6; def.vz += sz * k * 1.6;
      }
    }
    this.emit({ type: 'hit', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, power: J, crit });
  }

  checkEnd() {
    const [a, b] = this.tops;
    const downA = a.state !== 'spin', downB = b.state !== 'spin';
    let winner = null, kim = null, draw = false;
    if (downA || downB) {
      if (downA && downB) draw = true;
      else { const loser = downA ? a : b; winner = 1 - loser.side; kim = loser.state === 'out' ? 'out' : loser.state === 'fallen' ? 'topple' : 'spin'; }
    } else if (this.t >= TIME_LIMIT) {
      const sa = a.omega / a.p.omegaMax - a.wob * 0.3, sb = b.omega / b.p.omegaMax - b.wob * 0.3;
      if (Math.abs(sa - sb) < 0.02) draw = true; else { winner = sa > sb ? 0 : 1; kim = 'decision'; }
    } else return;
    this.over = true;
    this.result = { winner: draw ? -1 : winner, kimarite: draw ? 'draw' : kim, time: this.t };
    this.emit({ type: 'end', result: this.result });
  }

  // ネット同期用スナップショット
  snapshot() {
    const q = v => Math.round(v * 1000) / 1000;
    return {
      t: q(this.t), st: this.started ? 1 : 0, ov: this.over ? 1 : 0, res: this.result,
      p: this.tops.map(a => [q(a.x), q(a.z), q(a.vx), q(a.vz), q(a.omega), q(a.wob), q(a.phi), q(a.spin), a.state, a.dashes, q(a.dashT), a.crits, q(a.maxOmega), a.superb ? 1 : 0, a.launched ? 1 : 0, q(a.endT)]),
    };
  }
  applySnapshot(s) {
    this.t = s.t; this.started = !!s.st; this.over = !!s.ov; this.result = s.res || null;
    s.p.forEach((v, i) => {
      const a = this.tops[i];
      [a.x, a.z, a.vx, a.vz, a.omega, a.wob, a.phi, a.spin, a.state, a.dashes, a.dashT, a.crits, a.maxOmega] = v;
      a.superb = !!v[13]; a.launched = !!v[14]; a.endT = v[15];
    });
  }
}

// レベルデザイン：n番目の一番の強さ。5番ごとに強敵、その次はひと息つける
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function levelFor(n) {
  const pos = (n - 1) % 5, boss = pos === 4, rest = pos === 0 && n > 1;
  let k = Math.min(1, (n - 1) / 18);
  if (boss) k += 0.12; else if (rest) k = Math.max(0, k - 0.1);
  if (n > 18) k += Math.min(0.2, (n - 18) * 0.01);
  const c = clamp01(k);
  const early = n <= 3 ? [-0.16, -0.1, -0.05][n - 1] : 0; // 序盤はライト層でも勝てるように少し弱く
  return {
    n, k, boss, rest,
    power: 0.36 + 0.58 * c, powerVar: 0.2 - 0.12 * c,
    aim: 0.8 - 0.65 * c,
    think: 0.7 - 0.5 * c,
    aggro: 0.06 + 0.34 * c,
    ringOut: k > 0.15, conserve: k > 0.3, punish: k > 0.42, dodge: k > 0.55, intercept: k > 0.62,
    superb: c > 0.45 ? (c - 0.45) * 0.9 : 0,
    buff: early + (boss ? 0.02 + 0.04 * c : 0) + Math.max(0, k - 0.9) * 0.2,
    firstDelay: 1.9 - 1.3 * c,
    grade: k < 0.25 ? 0 : k < 0.5 ? 1 : k < 0.8 ? 2 : 3,
  };
}
// 強敵は能力を少し上乗せする
export function applyBuff(top, buff) {
  if (!buff) return; buff = Math.max(-0.3, buff);
  top.p = { ...top.p, omegaMax: top.p.omegaMax * (1 + buff), mass: top.p.mass * (1 + buff * 0.6), wobbleGain: top.p.wobbleGain * (1 - buff * 0.8), crit: top.p.crit + buff * 0.3, dash: top.p.dash * (1 + buff * 0.5) };
}

export class NpcBrain {
  constructor(battle, side, level, rng = Math.random) {
    this.b = battle; this.side = side; this.L = typeof level === 'number' ? levelFor([1, 4, 9, 15][level] || 1) : level; this.rng = rng;
    this.think = this.L.firstDelay + rng() * 0.8;
  }
  launchParams() {
    const L = this.L, r = this.rng;
    const power = Math.max(0.2, Math.min(1, L.power + (r() - 0.5) * 2 * L.powerVar));
    const angle = (r() - 0.5) * L.aim;
    return { power, angle, superb: r() < L.superb && power > 0.85 };
  }
  update(dt) {
    const b = this.b, L = this.L; if (!b.started || b.over) return;
    this.think -= dt; if (this.think > 0) return;
    this.think = L.think * (0.75 + this.rng() * 0.5);
    const me = b.tops[this.side], op = b.tops[1 - this.side];
    if (me.state !== 'spin' || me.dashes <= 0 || me.cd > 0) return;
    const dx = op.x - me.x, dz = op.z - me.z, dist = Math.hypot(dx, dz) || 1;
    const opR = Math.hypot(op.x, op.z), meR = Math.hypot(me.x, me.z), myRatio = me.omega / me.p.omegaMax, opRatio = op.omega / op.p.omegaMax;
    // 回避：相手が踏み込んできたら横へかわす
    if (L.dodge && op.cd > 0.25 && dist < 1.7) {
      const ovx = op.vx, ovz = op.vz, toward = (ovx * -dx + ovz * -dz) / dist;
      if (toward > 1.2 && this.rng() < 0.55) { const s = this.rng() < 0.5 ? 1 : -1; b.dash(this.side, me.x - dz / dist * s, me.z + dx / dist * s); return; }
    }
    let want = 0;
    if (dist < 2.4) want += L.aggro;
    if (L.ringOut && opR > 3.0 * 0.6 && meR < opR) want += 0.35 + L.k * 0.3;
    if (L.punish && op.wob > 0.4) want += 0.35;
    if (L.conserve && myRatio < 0.32 && opRatio > myRatio) want -= 0.35;
    if (this.rng() >= want) return;
    if (L.intercept) b.dash(this.side, op.x + op.vx * 0.28, op.z + op.vz * 0.28);
    else b.dash(this.side);
  }
}

// ランク判定（E〜SSS）
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export function rankFor(battle, side, difficulty = 1) {
  const r = battle.result, me = battle.tops[side];
  if (!r) return { grade: 'E', idx: 0, score: 0 };
  let score;
  if (r.winner === -1) score = 42 + me.crits * 3;
  else if (r.winner !== side) score = 18 + Math.min(18, me.crits * 6) + (me.superb ? 4 : 0) + Math.min(10, battle.t / 4);
  else {
    const remain = me.state === 'spin' ? me.omega / me.p.omegaMax : 0;
    score = 44 + remain * 26 + Math.min(18, me.crits * 6) + (r.kimarite === 'out' ? 10 : r.kimarite === 'topple' ? 7 : r.kimarite === 'decision' ? -6 : 3)
      + Math.max(0, (TIME_LIMIT - battle.t) / TIME_LIMIT) * 12 + (me.superb ? 5 : 0) + [-8, -2, 3, 7][difficulty ?? 1];
  }
  const cuts = [0, 30, 45, 55, 65, 75, 84, 92];
  let idx = 0; for (let i = 0; i < cuts.length; i++) if (score >= cuts[i]) idx = i;
  return { grade: RANKS[idx], idx, score: Math.round(score) };
}
