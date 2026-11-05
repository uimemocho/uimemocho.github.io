// 効果音エンジン：サンプル再生＋走行状態に連動するループ音（エンジン／路面／噴射／タイヤ）。
// 素材は tools/se/make_se.py で数式合成した dist/audio/se/*.mp3。読めない間は fx.js の簡易合成音で代替する。

export const SE_FILES = [
  "engine-on", "engine-off", "jet", "boost", "road", "skid",
  "crash", "explode", "slip", "smash0", "smash1", "smash2", "bump", "near",
  "boost-fire", "launch", "jump", "land", "item", "magnet", "shield", "clock", "chip",
  "stall", "recover", "door", "count", "go", "finish", "failed", "bonus",
  "star", "starloop", "sparkle",
];
// ループ素材は前後0.25秒ののりしろ付き。値はループ本体の長さ（秒）
export const SE_LOOPS = { "engine-on": 1.0, "engine-off": 1.0, jet: 1.5, boost: 1.2, road: 2.0, skid: 1.0, starloop: 3.2 };
const MARGIN = 0.25;
const ENGINE_BASE_RPM = 1800; // 素材の回転数（60Hz燃焼）

// ギア：速度(m/s)の区切り。各ギア内で回転数が上がり、シフトで落ちる
const GEARS = [0, 9, 18, 28, 40, 54, 70, 200];
export function engineRpm(speed, throttle, air = false) {
  const v = Math.max(0, speed);
  let g = 0;
  while (g < GEARS.length - 2 && v > GEARS[g + 1]) g++;
  const lo = GEARS[g],
    hi = GEARS[g + 1],
    k = Math.min(1, (v - lo) / (hi - lo));
  let rpm = (g === 0 ? 900 : 2300) + k * (g === 0 ? 3600 : 3500);
  if (throttle) rpm += 350;
  if (air) rpm = Math.max(rpm, 6200); // 空中は空転して吹け上がる
  return { rpm: Math.min(7200, rpm), gear: g + 1 };
}

export class SoundEngine {
  constructor(ctx, master) {
    this.ctx = ctx;
    this.buffers = {};
    this.loops = {};
    this.ready = false;
    // SE専用バス：軽いコンプでまとめる
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.8;
    this.bus.connect(this.comp);
    this.comp.connect(master);
    this.state = { rpm: 900, throttle: 0, air: false, lastX: 0 };
  }
  load() {
    if (this.loading) return this.loading;
    const ctx = this.ctx;
    this.loading = Promise.all(
      SE_FILES.map((name) =>
        fetch("audio/se/" + name + ".mp3")
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          .then((d) => new Promise((ok, ng) => ctx.decodeAudioData(d, ok, ng)))
          .then((b) => (this.buffers[name] = b))
          .catch(() => null),
      ),
    ).then(() => {
      this.ready = Object.keys(this.buffers).length > 0;
      if (this.ready) this.startLoops();
      return this.ready;
    });
    return this.loading;
  }
  has(name) {
    return !!this.buffers[name];
  }
  play(name, { gain = 1, rate = 1, jitter = 0, pan = 0, when = 0 } = {}) {
    const b = this.buffers[name];
    if (!b) return false;
    const ctx = this.ctx,
      src = ctx.createBufferSource(),
      g = ctx.createGain();
    src.buffer = b;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    g.gain.value = gain;
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.bus);
    src.start(ctx.currentTime + when);
    return true;
  }
  startLoops() {
    const ctx = this.ctx;
    for (const [name, len] of Object.entries(SE_LOOPS)) {
      const b = this.buffers[name];
      if (!b || this.loops[name]) continue;
      const src = ctx.createBufferSource(),
        g = ctx.createGain(),
        f = ctx.createBiquadFilter();
      src.buffer = b;
      src.loop = true;
      src.loopStart = MARGIN;
      src.loopEnd = Math.min(b.duration, MARGIN + len);
      f.type = "lowpass";
      f.frequency.value = 18000;
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(this.bus);
      src.start(ctx.currentTime, MARGIN + Math.random() * len * 0.5);
      this.loops[name] = { src, g, f };
    }
  }
  set(name, gain, rate, cutoff, tc = 0.06) {
    const l = this.loops[name];
    if (!l) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(gain, t, tc);
    if (rate != null) l.src.playbackRate.setTargetAtTime(rate, t, 0.05);
    if (cutoff != null) l.f.frequency.setTargetAtTime(cutoff, t, 0.08);
  }
  // mode: 'off'（メニュー・ポーズ）/ 'idle'（乗車・カウント：アイドリング、空ぶかし可）/ 'drive' / 'wreck'
  update(run, mode, dt) {
    if (!this.ready) return;
    const s = this.state;
    if (!run || mode === "off") {
      for (const n of Object.keys(this.loops)) this.set(n, 0, null, null, 0.12);
      return;
    }
    const speed = mode === "idle" ? 0 : run.speed || 0,
      air = run.air > 0,
      stalled = run.stall > 0,
      dead = run.totalled || mode === "wreck",
      throttleOn = !stalled && !dead && (run.gasHeld || run.boostActive);
    s.throttle += ((throttleOn ? 1 : 0) - s.throttle) * Math.min(1, dt * 10);
    // 回転数：アイドル中の空ぶかしも反映
    let target = engineRpm(speed, throttleOn, air && mode === "drive").rpm;
    if (mode === "idle") target = throttleOn ? 5200 : 950;
    if (stalled) target = 0;
    if (run.boostActive) target = Math.min(7400, target + 600);
    s.rpm += (target - s.rpm) * Math.min(1, dt * (target > s.rpm ? 7 : 4));
    const rate = Math.max(0.35, s.rpm / ENGINE_BASE_RPM),
      eng = dead || s.rpm < 200 ? 0 : 0.1 + 0.05 * Math.min(1, s.rpm / 6000);
    this.set("engine-on", eng * s.throttle, rate, 1800 + s.rpm * 0.9);
    this.set("engine-off", eng * (1 - s.throttle) * 0.85, rate, 900 + s.rpm * 0.35);
    // 路面ノイズ：速度で大きく明るく、空中では消える
    const v01 = Math.min(1, speed / 60);
    this.set("road", air || dead ? 0 : 0.03 + v01 * 0.12, 0.75 + v01 * 0.6, 600 + v01 * 4000);
    // ブースト・ジェットの噴射
    this.set("boost", run.boostActive && !dead ? 0.2 : 0, 0.95 + v01 * 0.15, 9000, run.boostActive ? 0.04 : 0.25);
    this.set("jet", air && !dead ? 0.26 : 0, 0.9 + Math.sin(performance.now() / 160) * 0.03, 12000, air ? 0.03 : 0.2);
    // タイヤのきしみ：高速での急な横移動・スリップ
    const lateral = Math.abs((run.x || 0) - s.lastX) / Math.max(dt, 1e-3);
    s.lastX = run.x || 0;
    const skid = air || dead ? 0 : Math.max(run.slip > 0 ? 0.35 : 0, Math.min(0.14, Math.max(0, lateral - 6) * 0.02 * v01));
    this.set("skid", skid, 0.9 + v01 * 0.2, 7000, 0.05);
    // 無敵中のループ曲
    this.set("starloop", run.star > 0 && !dead ? 0.55 * Math.min(1, run.star / 0.6) : 0, 1, 18000, 0.08);
    // 着地
    if (s.air && !air && mode === "drive" && !dead) this.play("land", { gain: 0.8, jitter: 0.05 });
    s.air = air;
  }
  stopAll() {
    for (const n of Object.keys(this.loops)) this.set(n, 0, null, null, 0.05);
  }
}
