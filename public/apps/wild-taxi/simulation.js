import { trafficProfile, advanceTraffic, trafficContact, trafficHalfWidth } from "./traffic.js";
import { ITEMS, ITEM_KINDS, normalizeItem, pickupKind } from "./items.js";
import { clamp } from "./track.js";
import { createStreetObjects, streetPlacement, personType } from "./city-world.js";
export const LANES = [-3.2, 0, 3.2];
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function routeFor(data, from, to) {
  const n = data.stations.length;
  if (from === to) throw Error("出発駅と目的駅は別の駅を選んでください");
  function path(dir) {
    let i = from,
      p = [];
    while (i !== to) {
      let leg = dir === 1 ? data.legs[i] : [...data.legs[(i - 1 + n) % n]].reverse();
      p.push(...leg);
      i = (i + dir + n) % n;
    }
    let clean = p.filter((q, j) => !j || Math.hypot(q[0] - p[j - 1][0], q[1] - p[j - 1][1]) > 0.01);
    let len = clean.slice(1).reduce((v, q, j) => v + Math.hypot(q[0] - clean[j][0], q[1] - clean[j][1]), 0);
    return { points: clean, length: len };
  }
  const a = path(1),
    b = path(-1);
  return a.length < b.length ? a : b;
}
// 時間帯ごとのコース配置。昼＝既存（通勤ラッシュ）、夕＝夕焼けドライブ（加速床・ジャンプ多め）、夜＝夜間工事（トラック・工事区間・アイテム多め）。
// 同じシード・同じ時間帯なら配置は同じ（リトライやセーブ再開でも再現する）。
export const COURSE_LAYOUTS = {
  day: { step: 45, pattern: ["traffic", "boost", "oil", "item", "ramp", "cone", "clock", "traffic", "magnet", "traffic", "oil", "boost"] },
  evening: { step: 42, pattern: ["boost", "traffic", "ramp", "item", "boost", "cone", "traffic", "clock", "ramp", "magnet", "traffic", "boost"] },
  night: { step: 48, pattern: ["works", "item", "truck", "clock", "ramp", "works", "magnet", "boost", "truck", "item", "oil", "clock"] },
};
export function createRun(length, seed = 1, phase = "day") {
  const layout = COURSE_LAYOUTS[phase] || COURSE_LAYOUTS.day,
    rand = random(seed + (phase === "evening" ? 7919 : phase === "night" ? 104729 : 0)),
    objects = [];
  let id = 0,
    trafficIndex = 0;
  for (let d = 90; d < length - 65; d += layout.step) {
    const lane = Math.floor(rand() * 3),
      i = Math.floor((d - 90) / layout.step),
      slot = layout.pattern[i % layout.pattern.length];
    // 夜間工事：1車線をバリア、隣の車線をコーンの列でふさぐ（残る1車線を抜ける）
    if (slot === "works") {
      const open = lane,
        a = (open + 1) % 3,
        b = (open + 2) % 3;
      objects.push({ id: id++, d, lane: a, type: "barrier", used: false });
      for (let k = 0; k < 3; k++) objects.push({ id: id++, d: d + 4 + k * 7, lane: b, type: "cone", used: false });
      objects.push({ id: id++, d: d + 18, lane: a, type: "cone", used: false });
      continue;
    }
    const type = slot === "truck" ? "traffic" : slot;
    const profile = type === "traffic" ? trafficProfile(seed, trafficIndex++) : {};
    if (slot === "truck") {
      profile.vehicleKind = "truck";
      profile.cruiseSpeed = Math.min(profile.cruiseSpeed ?? 14, 15);
    }
    objects.push({
      ...profile,
      id: id++,
      d,
      lane,
      type,
      itemKind: type === "item" ? ITEM_KINDS[Math.floor(random(Math.imul(seed + i * 13, 2654435761))() * ITEM_KINDS.length)] : null,
      used: false,
    });
    if (type === "traffic" && i % 2 === 0 && phase !== "night") objects.push({ id: id++, d: d + 12, lane: (lane + 1) % 3, type: "cone", used: false });
    if (type === "ramp") {
      objects.push({ id: id++, d: d + 17, lane, type: "barrier", used: false });
      objects.push({ id: id++, d: d + 28, lane, type: "skyTip", used: false });
      // 夕方は空中チップが連なる
      if (phase === "evening") objects.push({ id: id++, d: d + 40, lane: (lane + 1) % 3, type: "skyTip", used: false });
    }
  }
  return {
    distance: 0,
    length,
    speed: 0,
    lane: 1,
    x: 0,
    targetX: 0,
    steer: 0,
    street: createStreetObjects(length, seed, phase),
    phase,
    destroyed: new Set(),
    impacts: [],
    impactId: 0,
    smashes: 0,
    damageCounts: {},
    sidewalkSeconds: 0,
    maxSpeed: 0,
    crashes: 0,
    totalled: false,
    debug: false,
    rollTime: 0,
    rollRequest: null,
    invulnerable: 0,
    jolt: 0,
    physicsPose: null,
    debris: [],
    gasHeld: false,
    boostActive: false,
    startType: "normal",
    stall: 0,
    elapsed: 0,
    limit: Math.ceil(length / 29 + 12),
    remaining: Math.ceil(length / 29 + 12),
    boost: 0,
    shield: 0,
    magnet: 0,
    star: 0,
    slow: 0,
    slowTarget: 34,
    slip: 0,
    air: 0,
    airDuration: 2.7,
    item: null,
    objects,
    status: "running",
    event: "",
    eventTime: 0,
    hits: 0,
    coins: 0,
    bonus: 0,
    combo: 0,
    maxCombo: 0,
    nearMisses: 0,
    eventId: 0,
    events: [],
    seed,
  };
}
export function steerTo(r, x) {
  if (r.status !== "running") return;
  r.targetX = clamp(x, -13, 13);
}
export function dragSteer(r, pixels, viewport) {
  steerTo(r, r.targetX + (pixels * 18) / (Math.min(viewport, 700) * 0.85));
}
// Keyboard compatibility, without lane snapping.
export function setLane(r, dir) {
  steerTo(r, r.targetX + dir * 1.5);
  r.lane = clamp(r.lane + dir, 0, 2);
}
export const DRIVE_SPEED = { coast: 28, accelerate: 54, boost: 78 };
export function holdAccelerator(r, held) {
  if (held && r.status !== "running") return;
  r.gasHeld = !!held;
}
export function signal(r, text, kind = "bonus", value = 0) {
  r.event = text;
  r.eventTime = 1.6;
  r.events.push({ id: ++r.eventId, kind, text, value, time: r.elapsed });
  if (r.events.length > 24) r.events.shift();
}
// アイテムは拾った瞬間に発動する。テキストは「名前！ 効果」（fxで見出しと説明に分けて表示）。
export function applyItem(r, kind) {
  kind = normalizeItem(kind);
  if (!kind) return;
  const it = ITEMS[kind];
  if (kind === "shield") r.shield = Math.max(r.shield, it.seconds);
  if (kind === "boost") {
    r.boost = Math.max(r.boost, it.seconds);
    r.speed = Math.max(r.speed, 60);
  }
  if (kind === "clock") {
    r.remaining += it.seconds;
    r.bonus += it.seconds;
  }
  if (kind === "magnet") r.magnet = Math.max(r.magnet, it.seconds);
  if (kind === "star") {
    r.star = it.seconds;
    r.slip = 0;
    r.slow = 0;
  }
  r.lastItem = kind;
  signal(r, it.name + "！ " + it.effect, kind === "clock" ? "clock" : kind === "boost" ? "boost" : kind, kind === "clock" ? it.seconds : r.combo);
}
// 旧仕様（所持して使う）の互換用。所持中のアイテムがあれば即発動する。
export function useItem(r) {
  if (!r.item || r.status !== "running" || r.stall > 0) return;
  const i = normalizeItem(r.item);
  if (!i) return;
  r.item = null;
  applyItem(r, i);
}
export function chain(r) {
  r.combo++;
  r.maxCombo = Math.max(r.maxCombo, r.combo);
}
export function tick(r, dt) {
  if (r.status !== "running") return;
  dt = clamp(dt, 0, 0.1);
  const before = r.distance,
    beforeX = r.x;
  advanceTraffic(r, dt);
  r.elapsed += dt;
  r.maxSpeed = Math.max(r.maxSpeed, r.speed);
  if (Math.abs(r.x) > 6.1) r.sidewalkSeconds += dt;
  r.jolt = Math.max(0, r.jolt - dt);
  r.invulnerable = Math.max(0, r.invulnerable - dt);
  if (r.rollTime > 0) {
    r.rollTime = Math.max(0, r.rollTime - dt);
    r.remaining = Math.max(0, r.remaining - dt);
    r.boostActive = false;
    if (r.remaining <= 0) {
      r.status = "failed";
      signal(r, "TIME UP", "failed");
    }
    return;
  }
  r.remaining -= dt;
  r.eventTime = Math.max(0, r.eventTime - dt);
  for (const k of ["boost", "shield", "magnet", "star", "slow", "slip", "stall"]) r[k] = Math.max(0, r[k] - dt);
  r.air = Math.max(0, r.air - dt);
  const previous = r.boostActive;
  r.boostActive = r.boost > 0 && r.stall <= 0;
  if (r.boostActive && !previous) signal(r, "限界突破", "boost");
  let target = r.slow > 0 ? r.slowTarget : r.boostActive ? DRIVE_SPEED.boost : r.gasHeld ? DRIVE_SPEED.accelerate : DRIVE_SPEED.coast;
  if (r.star > 0) target = Math.max(target, DRIVE_SPEED.accelerate); // 無敵中は全開
  if (r.stall > 0) r.speed = 0;
  else r.speed += clamp(target - r.speed, -32 * dt, 30 * dt);
  if (r.steer) steerTo(r, r.targetX + r.steer * 8 * dt);
  const aim = clamp(r.targetX + (r.slip > 0 ? Math.sin(r.elapsed * 12) * 0.8 : 0), -13, 13);
  r.x += (aim - r.x) * (1 - Math.exp(-dt * (r.slip > 0 ? 8 : 17)));
  r.distance = Math.min(r.length, r.distance + r.speed * dt);
  for (const o of r.objects) {
    if (o.type !== "traffic" || o.used) continue;
    const laneX = LANES[o.lane],
      contact = trafficContact(o, before, r.distance, beforeX, r.x, laneX),
      relative = r.distance - o.d;
    if (contact !== null && r.air <= 0) {
      o.used = true;
      const impact = { ...o, d: (o.previousD ?? o.d) + (o.d - (o.previousD ?? o.d)) * contact, off: laneX };
      if (r.star > 0) {
        vanishObject(r, impact);
        continue;
      }
      smashObject(r, impact, r.shield <= 0);
      if (r.shield > 0) {
        r.shield = 0;
        signal(r, "完全ガード", "shield");
      }
      continue;
    }
    if (!o.missed && relative > 2) {
      o.missed = true;
      const dx = Math.abs(r.x - laneX);
      if (dx >= trafficHalfWidth(o) && dx < trafficHalfWidth(o) + 1.3 && r.air <= 0) {
        r.nearMisses++;
        chain(r);
        signal(r, "危機一髪", "near", r.combo);
      }
    }
  }
  for (const o of r.objects) {
    if (o.type === "traffic" || o.used || o.d < before - 8 || o.d > r.distance + 2) continue;
    const collect = ["item", "clock", "magnet", "skyTip"].includes(o.type),
      hazard = ["traffic", "cone", "barrier", "oil"].includes(o.type),
      dx = Math.abs(r.x - LANES[o.lane]),
      width = o.type === "cone" ? 1.0 : o.type === "traffic" ? 1.55 : 1.45,
      aligned = dx < width;
    if (!aligned && !(collect && r.magnet > 0)) {
      if (hazard && !o.missed && r.distance > o.d + 2) {
        o.missed = true;
        o.used = true;
        if (dx < width + 1.3 && r.air <= 0) {
          r.nearMisses++;
          chain(r);
          signal(r, "危機一髪", "near", r.combo);
        }
      }
      continue;
    }
    if (r.air > 0 && !collect) {
      o.used = true;
      continue;
    }
    if (o.type === "skyTip" && r.air <= 0) continue;
    o.used = true;
    if (hazard) {
      if (r.star > 0) {
        vanishObject(r, { ...o, off: LANES[o.lane] });
        continue;
      }
      if (r.shield > 0) {
        if (o.type !== "oil") smashObject(r, { ...o, off: LANES[o.lane] }, false);
        r.shield = 0;
        signal(r, "完全ガード", "shield");
        continue;
      }
      if (o.type === "oil") {
        r.hits++;
        r.slow = 0.4;
        r.slip = 1.1;
        r.speed *= 0.87;
        r.slowTarget = r.speed;
        r.jolt = 0.18;
        signal(r, "スリップ！", "hit");
      } else {
        smashObject(r, { ...o, off: LANES[o.lane] }, o.type === "traffic");
      }
      continue;
    }
    if (o.type === "boost") {
      r.boost = 2.3;
      chain(r);
      signal(r, "爆速領域", "boost", r.combo);
    }
    if (o.type === "ramp") {
      r.air = r.airDuration;
      r.boost = Math.max(r.boost, 3);
      r.speed = Math.max(r.speed, 78);
      r.maxSpeed = Math.max(r.maxSpeed, r.speed);
      chain(r);
      signal(r, "ジェット離陸！", "jump", r.combo);
    }
    if (o.type === "item") {
      r.coins++;
      chain(r);
      applyItem(r, pickupKind(o));
    }
    if (o.type === "skyTip") {
      r.remaining += 3;
      r.bonus += 3;
      r.coins += 3;
      chain(r);
      signal(r, "空中チップ +3秒", "clock", 3);
    }
    if (o.type === "clock") {
      r.remaining += 4;
      r.bonus += 4;
      r.coins++;
      chain(r);
      signal(r, "時間奪還 +4秒", "clock", 4);
    }
    if (o.type === "magnet") {
      r.coins++;
      chain(r);
      applyItem(r, "magnet");
    }
  }
  for (const o of r.street) {
    if (r.destroyed.has(o.id) || o.d < before - 7 || o.d > r.distance + 5) continue;
    const p = streetPlacement(o, r.elapsed, r.environment);
    if (!p || p.d < before - 4 || p.d > r.distance + 2) continue;
    const radius = personType(o.type) ? 1.05 : o.type === "lamp" ? 1.05 : o.type === "tree" ? 1.4 : 1.65;
    if (Math.abs(r.x - p.off) > radius || r.air > 0) continue;
    r.destroyed.add(o.id);
    if (r.star > 0) vanishObject(r, { ...o, d: p.d, off: p.off });
    else smashObject(r, { ...o, d: p.d, off: p.off }, false);
  }
  if (r.remaining <= 0) {
    r.remaining = 0;
    r.status = "failed";
    signal(r, "TIME UP", "failed");
  } else if (r.distance >= r.length) {
    r.status = "delivered";
    signal(r, "配達制覇", "finish", r.maxCombo);
  }
}
export function jumpHeight(r) {
  return r.air > 0 ? Math.pow(Math.sin(Math.PI * (1 - r.air / r.airDuration)), 0.8) * 11 : 0;
}

// 無敵中に触れたもの：キラキラ消える。被害額・接触数・破片には数えない（描画用に r.sparkles へ記録）
export function vanishObject(r, o) {
  chain(r);
  r.vanished = (r.vanished || 0) + 1;
  (r.sparkles ||= []).push({ id: (r.sparkleId = (r.sparkleId || 0) + 1), d: o.d, off: o.off ?? 0, type: o.type, time: r.elapsed });
  if (r.sparkles.length > 24) r.sparkles.shift();
  r.jolt = Math.max(r.jolt, 0.05);
  signal(r, "キラッ！", "sparkle", r.combo);
}
export function smashObject(r, o, heavy = false) {
  const speed = r.speed,
    guarded = r.shield > 0 || r.star > 0;
  if (!guarded) r.hits++;
  r.smashes++;
  const damageType = personType(o.type) ? "pedestrian" : o.type;
  r.damageCounts[damageType] = (r.damageCounts[damageType] || 0) + 1;
  chain(r);
  r.impacts.push({
    id: ++r.impactId,
    type: o.type,
    d: o.d,
    off: o.off ?? 0,
    side: Math.sign((o.off ?? 0) - r.x) || 1,
    speed,
    color: o.color ?? 0,
    vehicleKind: o.vehicleKind,
  });
  r.impacts = r.impacts.slice(-32);
  if (heavy && !guarded && r.invulnerable <= 0) {
    r.rollRequest = { type: o.type, side: Math.sign(r.x) || 1, speed };
    signal(r, "大・横・転", "crash");
  } else {
    r.speed = guarded ? speed : Math.max(10, speed * (personType(o.type) ? 0.93 : o.type === "cone" ? 0.95 : 0.88));
    r.slow = guarded ? 0 : 0.12;
    r.slowTarget = r.speed;
    r.jolt = 0.15;
    signal(r, personType(o.type) ? "ぶっ飛び！" : "連続粉砕", "smash", r.combo);
  }
}
