import { speedIntensity } from "./city-world.js";
import { SoundEngine } from "./sound.js";
const $ = (id) => document.getElementById(id);
// BGM：時間帯ごとのループ。ファイル前後に0.5秒ののりしろがあり、
// loopStart=0.5s / loopEnd=0.5s+ループ長 で再生するとデコーダのパディングに依存せず継ぎ目が一致する。
export const BGM_TRACKS = {
  day: { src: "audio/bgm-day.mp3", loop: (16 * 4 * 60) / 128 },
  evening: { src: "audio/bgm-evening.mp3", loop: (16 * 4 * 60) / 108 },
  night: { src: "audio/bgm-night.mp3", loop: (24 * 4 * 60) / 140 },
};
const BGM_MARGIN = 0.5;
const BGM_LEVEL = { menu: 0.42, play: 0.62, result: 0.36, ending: 0.18, pause: 0.16, star: 0.18 };
const COLORS = ["#f3ece2", "#ffb74d", "#ff9b6a", "#c5b7dd", "#e8d8bd"];
export class TaxiFX {
  constructor() {
    this.canvas = $("fx");
    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.rings = [];
    this.ending = null;
    this.elapsed = 0;
    this.lastId = 0;
    this.flash = 0;
    this.shake = 0;
    this.energy = 0;
    this.burstAge = 10;
    this.explosionAge = 10;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.muted = false;
    this.volume = 0.65;
    try {
      this.muted = localStorage.getItem("taxi-sound") === "off";
      const saved = localStorage.getItem("taxi-volume");
      if (saved !== null) this.volume = Math.max(0, Math.min(1, Number(saved) || 0));
      this.bgmOn = localStorage.getItem("taxi-bgm") !== "off";
    } catch {
      this.bgmOn = true;
    }
    this.bgmPhase = "day";
    this.bgmMood = "menu";
    this.bgmBuffers = {};
    this.bgmLoading = {};
    this.bgmVoice = null;
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", () => {
        if (!this.audio) return;
        if (document.hidden) this.audio.suspend?.();
        else this.audio.resume?.();
      });
    this.resize();
    this.updateSoundButton();
  }
  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    this.ratio = Math.min(devicePixelRatio, 1.25); // 集中線などの2D層は低めの解像度で十分
    this.canvas.width = this.w * this.ratio;
    this.canvas.height = this.h * this.ratio;
  }
  unlock() {
    try {
      if (!this.audio) {
        this.audio = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.audio.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.audio.destination);
      }
      if (!this.wind) this.makeWind();
      if (!this.se) {
        this.se = new SoundEngine(this.audio, this.master);
        this.se.load();
      }
      if (!this.bgmGain) {
        this.bgmGain = this.audio.createGain();
        this.bgmGain.gain.value = this.bgmOn ? BGM_LEVEL[this.bgmMood] : 0;
        this.bgmGain.connect(this.master);
      }
      if (this.audio.state === "suspended") this.audio.resume();
      this.playBgm(this.bgmPhase);
    } catch {}
  }
  // ---- BGM ----
  loadBgm(phase) {
    const track = BGM_TRACKS[phase];
    if (!track || !this.audio) return Promise.resolve(null);
    if (this.bgmBuffers[phase]) return Promise.resolve(this.bgmBuffers[phase]);
    if (!this.bgmLoading[phase])
      this.bgmLoading[phase] = fetch(track.src)
        .then((r) => {
          if (!r.ok) throw Error("BGM " + r.status);
          return r.arrayBuffer();
        })
        .then((data) => new Promise((ok, ng) => this.audio.decodeAudioData(data, ok, ng)))
        .then((buffer) => (this.bgmBuffers[phase] = buffer))
        .catch((e) => {
          console.warn("BGMを読み込めません", e);
          delete this.bgmLoading[phase];
          return null;
        });
    return this.bgmLoading[phase];
  }
  setBgmPhase(phase) {
    if (!BGM_TRACKS[phase]) phase = "day";
    if (phase === this.bgmPhase && this.bgmVoice) return;
    this.bgmPhase = phase;
    if (this.audio) this.playBgm(phase);
  }
  playBgm(phase) {
    if (!this.audio || !this.bgmOn) return;
    if (this.bgmVoice?.phase === phase) return;
    const request = (this.bgmRequest = phase);
    this.loadBgm(phase).then((buffer) => {
      if (!buffer || this.bgmRequest !== request || !this.bgmOn || this.bgmVoice?.phase === phase) return;
      const ctx = this.audio,
        t = ctx.currentTime,
        track = BGM_TRACKS[phase],
        source = ctx.createBufferSource(),
        gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = BGM_MARGIN;
      source.loopEnd = Math.min(buffer.duration, BGM_MARGIN + track.loop);
      source.connect(gain);
      gain.connect(this.bgmGain);
      const fade = this.bgmVoice ? 1.6 : 0.8;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + fade);
      source.start(t, BGM_MARGIN);
      const old = this.bgmVoice;
      if (old) {
        old.gain.gain.cancelScheduledValues(t);
        old.gain.gain.setValueAtTime(old.gain.gain.value, t);
        old.gain.gain.linearRampToValueAtTime(0, t + fade);
        old.source.stop(t + fade + 0.05);
      }
      this.bgmVoice = { phase, source, gain };
    });
  }
  stopBgm() {
    const v = this.bgmVoice;
    this.bgmVoice = null;
    this.bgmRequest = null;
    if (!v || !this.audio) return;
    const t = this.audio.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    v.source.stop(t + 0.45);
  }
  setBgmMood(mood) {
    if (!BGM_LEVEL[mood] || mood === this.bgmMood) return;
    this.bgmMood = mood;
    if (this.bgmGain && this.bgmOn) this.bgmGain.gain.setTargetAtTime(BGM_LEVEL[mood], this.audio.currentTime, 0.35);
  }
  setBgm(on) {
    this.bgmOn = !!on;
    try {
      localStorage.setItem("taxi-bgm", this.bgmOn ? "on" : "off");
    } catch {}
    if (!this.bgmOn) this.stopBgm();
    else {
      this.unlock();
      if (this.bgmGain) this.bgmGain.gain.setTargetAtTime(BGM_LEVEL[this.bgmMood], this.audio.currentTime, 0.2);
      this.playBgm(this.bgmPhase);
    }
    this.updateSoundButton();
  }
  makeWind() {
    const ctx = this.audio,
      buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    const osc = ctx.createOscillator(),
      engine = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 60;
    engine.gain.value = 0;
    osc.connect(engine);
    engine.connect(this.master);
    osc.start();
    this.wind = { source, filter, gain, osc, engine };
  }
  updateWind(run, playing) {
    if (!this.wind) return;
    const ctx = this.audio,
      t = ctx.currentTime,
      amount = playing && !this.muted ? speedIntensity(run?.speed || 0) : 0;
    this.wind.gain.gain.setTargetAtTime(amount ** 2 * 0.09, t, 0.09);
    this.wind.filter.frequency.setTargetAtTime(450 + amount * 2200, t, 0.1);
    this.wind.osc.frequency.setTargetAtTime(65 + amount * 170, t, 0.1);
    this.wind.engine.gain.setTargetAtTime(this.se?.ready ? 0 : amount * 0.009, t, 0.1);
  }
  setMuted(value) {
    this.muted = !!value;
    try {
      localStorage.setItem("taxi-sound", this.muted ? "off" : "on");
    } catch {}
    if (!this.muted) this.unlock();
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.audio.currentTime, 0.025);
    this.updateSoundButton();
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    try {
      localStorage.setItem("taxi-volume", this.volume);
    } catch {}
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.audio.currentTime, 0.025);
    this.updateSoundButton();
  }
  toggleSound() {
    this.setMuted(!this.muted);
  }
  updateSoundButton() {
    if ($("sound")) $("sound").checked = !this.muted;
    if ($("volume")) $("volume").value = Math.round(this.volume * 100);
    if ($("volumeValue")) $("volumeValue").textContent = Math.round(this.volume * 100) + "%";
    if ($("bgm")) $("bgm").checked = this.bgmOn;
  }
  reset() {
    this.ending = null;
    this.particles = [];
    this.rings = [];
    this.lastId = 0;
    this.flash = 0;
    this.shake = 0;
    this.energy = 0;
    this.burstAge = 10;
    this.explosionAge = 10;
    $("impact").classList.remove("show");
    $("combo").hidden = true;
  }
  // 大きな衝撃の瞬間だけBGMを下げて、SEを前に出す
  duckBgm(depth = 0.35, hold = 0.5) {
    const g = this.bgmGain?.gain;
    if (!g || !this.bgmOn) return;
    const t = this.audio.currentTime,
      base = BGM_LEVEL[this.bgmMood] ?? 0.4;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(base * depth, t + 0.04);
    g.setValueAtTime(base * depth, t + hold);
    g.linearRampToValueAtTime(base, t + hold + 0.8);
  }
  // サンプル音（dist/audio/se）。読めていなければ false を返し、従来の合成音にフォールバック
  sample(kind, text = "", value = 0) {
    const se = this.se;
    if (!se?.ready) return false;
    const pick = (a) => a[(Math.random() * a.length) | 0];
    switch (kind) {
      case "crash":
        this.duckBgm(0.3, 0.7);
        return se.play("crash", { gain: 1, jitter: 0.04 });
      case "explode":
        this.duckBgm(0.15, 1.4);
        return se.play("explode", { gain: 1.1 });
      case "smash":
        return se.play(pick(["smash0", "smash1", "smash2"]), { gain: 0.7, jitter: 0.12, pan: Math.random() * 1.2 - 0.6 });
      case "hit":
        return se.play("slip", { gain: 0.85, jitter: 0.05 });
      case "near":
        return se.play("near", { gain: 0.8, jitter: 0.1, pan: Math.random() < 0.5 ? -0.5 : 0.5 });
      case "boost":
        // アイテムのブーストは強く、加速床・コンボは少し軽く
        if (text.includes("ブースト")) {
          this.duckBgm(0.6, 0.4);
          se.play("item", { gain: 0.55 });
        }
        return se.play("boost-fire", { gain: text.includes("ブースト") ? 1 : 0.75, rate: text.includes("ブースト") ? 1 : 1.12, jitter: 0.03 });
      case "launch":
        return se.play("launch", { gain: 1 });
      case "jump":
        this.duckBgm(0.6, 0.5);
        return se.play("jump", { gain: 1 });
      case "item":
        return se.play("item", { gain: 0.75 });
      case "magnet":
        se.play("item", { gain: 0.6 });
        return se.play("magnet", { gain: 0.8 });
      case "star":
        se.play("item", { gain: 0.6 });
        return se.play("star", { gain: 0.9 });
      case "sparkle":
        return se.play("sparkle", { gain: 0.7, jitter: 0.12, pan: Math.random() * 1.2 - 0.6 });
      case "clock":
        if (value === 6) se.play("item", { gain: 0.6 });
        return se.play(value === 3 ? "chip" : "clock", { gain: 0.8 });
      case "shield":
        if (text.includes("！ ")) se.play("item", { gain: 0.6 });
        return se.play("shield", { gain: 0.85 });
      case "stall":
        return se.play("stall", { gain: 0.9 });
      case "recover":
        return se.play("recover", { gain: 0.85 });
      case "door":
        return se.play("door", { gain: 0.8, jitter: 0.03 });
      case "count3":
      case "count2":
      case "count1":
        return se.play("count", { gain: 0.6 });
      case "go":
      case "start":
        return se.play("go", { gain: 0.7 });
      case "finish":
        return se.play("finish", { gain: 0.9 });
      case "failed":
        return se.play("failed", { gain: 0.8 });
      case "ending":
      case "endingPerfect":
        return false; // ファンファーレは従来の合成音
      default:
        return se.play("bonus", { gain: 0.55, jitter: 0.05 });
    }
  }
  sound(kind, text = "", value = 0) {
    if (this.muted || !this.audio || this.audio.state !== "running") return;
    if (this.sample(kind, text, value)) return;
    const ctx = this.audio,
      t = ctx.currentTime;
    const play = (frequency, end, duration, start = 0, type = "triangle", gain = 0.05) => {
      const osc = ctx.createOscillator(),
        g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, t + start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + start + duration);
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(gain, t + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + start);
      osc.stop(t + start + duration + 0.01);
    };
    if (kind === "ending" || kind === "endingPerfect") {
      const notes = kind === "endingPerfect" ? [523, 659, 784, 1047, 988, 1175, 1319, 1568] : [523, 659, 784, 1047, 784, 1319];
      notes.forEach((n, i) => play(n, n, 0.32, i * 0.105, "triangle", 0.04));
      play(131, 262, 0.65, 0.05, "sine", 0.05);
      return;
    }
    if (kind === "door") {
      play(115, 48, 0.12, 0, "triangle", 0.055);
      play(280, 90, 0.08, 0.03, "triangle", 0.025);
      return;
    }
    if (["count3", "count2", "count1"].includes(kind)) {
      const n = { count3: 440, count2: 590, count1: 740 }[kind];
      play(n, n, 0.09, 0, "sine", 0.045);
      return;
    }
    if (kind === "stall") {
      play(180, 42, 0.4, 0, "sawtooth", 0.05);
      return;
    }
    if (kind === "explode") {
      play(95, 24, 0.65, 0, "sawtooth", 0.12);
      play(340, 38, 0.48, 0.05, "triangle", 0.07);
      return;
    }
    if (kind === "crash") {
      play(85, 26, 0.38, 0, "sawtooth", 0.1);
      play(950, 90, 0.3, 0.03, "triangle", 0.05);
      return;
    }
    if (kind === "smash") {
      play(170, 52, 0.12, 0, "triangle", 0.045);
      return;
    }
    if (kind === "hit") {
      play(110, 38, 0.19, 0, "sawtooth", 0.07);
      return;
    }
    if (kind === "jump") {
      play(90, 1600, 0.65, 0, "sawtooth", 0.045);
      play(350, 2200, 0.4, 0.1, "triangle", 0.05);
      return;
    }
    if (kind === "boost" || kind === "launch") {
      play(130, 880, 0.28, 0, "sawtooth", 0.035);
      play(260, 1320, 0.25, 0.07, "triangle", 0.05);
      return;
    }
    if (kind === "finish") {
      [523, 659, 784, 1047].forEach((n, i) => play(n, n * 1.002, 0.22, i * 0.075, "triangle", 0.045));
      return;
    }
    if (kind === "failed") {
      play(260, 98, 0.4, 0, "triangle", 0.06);
      return;
    }
    play(kind === "near" ? 740 : 523, kind === "jump" ? 1568 : 1047, 0.13);
    play(1047, 1568, 0.16, 0.08, "sine", 0.06);
  }
  burst(text, kind = "bonus", value = 0) {
    // 無敵で消えた時は見出しを出さず、音と軽い光だけ（連続しても邪魔にならないように）
    if (kind === "sparkle") {
      this.energy = Math.max(this.energy, 0.45);
      this.sound(kind, text, value);
      return;
    }
    if (kind === "explode") this.explosionAge = 0;
    const good = !["hit", "crash", "failed", "explode", "stall"].includes(kind),
      big = ["boost", "launch", "jump", "finish", "crash", "explode"].includes(kind);
    this.burstAge = 0;
    this.energy = big ? 1 : 0.65;
    this.flash = this.reduced ? 0 : big ? 0.19 : 0.085;
    this.shake = this.reduced
      ? 0
      : kind === "explode"
        ? 13
        : kind === "crash"
          ? 10
          : kind === "hit"
            ? 4
            : kind === "smash"
              ? 1.5
              : big
                ? 4.5
                : 1.2;
    const impact = $("impact");
    impact.classList.remove("show");
    impact.dataset.kind = kind;
    // アイテムは「名前！ 効果」を見出しと説明に分ける
    const split = text.indexOf("！ "),
      itemEffect = split > 0 ? text.slice(split + 2) : "";
    $("impactMain").textContent = split > 0 ? text.slice(0, split + 1) : text;
    $("impactSub").textContent = itemEffect
      ? itemEffect
      : kind === "launch"
        ? "ROCKET START"
        : kind === "stall"
          ? "ENGINE STALL"
          : kind === "explode"
            ? "GAME OVER / ROLLOVER 2 / 2"
            : kind === "boost"
              ? "DOPA OVERDRIVE"
              : kind === "jump"
                ? "JET TAKEOFF / SKY OVERDRIVE"
                : kind === "near"
                  ? "NICE DODGE / KEEP GOING"
                  : kind === "finish"
                    ? "LEGENDARY DELIVERY"
                    : kind === "crash"
                      ? "GIGA ROLLOVER / AUTO RECOVERY"
                      : kind === "smash"
                        ? "SMASH CHAIN / KEEP GOING"
                        : kind === "recover"
                          ? "BACK IN BUSINESS"
                          : kind === "hit"
                            ? "まだ終わりじゃない。"
                            : "CHAIN REACTION";
    void impact.offsetWidth;
    impact.classList.add("show");
    const count = this.reduced ? 10 : big ? 64 : 30,
      cx = this.w * 0.5,
      cy = this.h * (kind === "explode" ? 0.66 : 0.43);
    this.burstCenter = kind === "explode" ? 0.66 : 0.43;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        v = big ? 120 + Math.random() * 450 : 80 + Math.random() * 230;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        size: 2 + Math.random() * 5,
        color: good ? COLORS[i % COLORS.length] : "#ff8b68",
        angle: Math.random() * 6,
      });
    }
    this.particles = this.particles.slice(-150);
    this.rings.push({ age: 0, color: good ? "#ffe88e" : "#ff946f", x: cx, y: cy });
    this.rings = this.rings.slice(-4);
    this.sound(kind, text, value);
  }
  update(run, dt, playing) {
    this.elapsed += dt;
    if (run) {
      for (const e of run.events) {
        if (e.id <= this.lastId) continue;
        this.lastId = e.id;
        if (e.kind !== "cooldown") this.burst(e.text, e.kind, e.value);
      }
      const combo = $("combo");
      combo.hidden = !playing || run.combo < 2;
      $("comboNumber").textContent = run.combo;
      $("combo").classList.toggle("fever", run.combo >= 5);
    }
    this.updateWind(run, playing);
    if (this.se) this.se.update(run, this.muted ? "off" : this.audioMode || (playing ? "drive" : "off"), dt);
    this.burstAge += dt;
    this.explosionAge += dt;
    if (this.burstAge > 1.15) $("impact").classList.remove("show");
    this.flash = Math.max(0, this.flash - dt);
    this.shake *= Math.exp(-dt * 13);
    this.energy *= Math.exp(-dt * 3.5);
    this.draw(run, dt, playing);
  }
  startEnding(perfect) {
    this.reset();
    this.ending = { perfect, time: 0 };
    this.sound(perfect ? "endingPerfect" : "ending");
  }
  drawEndingConfetti(dt) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    this.ending.time += dt;
    const t = this.reduced ? 0 : this.ending.time,
      count = this.reduced ? 45 : this.ending.perfect ? 190 : 140,
      colors = ["#ffe38a", "#fff5e6", "#8ce1cd", "#ffab89", "#a6bdf4"];
    for (let i = 0; i < count; i++) {
      const x = ((((i * 137.31 + Math.sin(t * 0.9 + i) * 28 + t * ((i % 3) - 1) * 7) % (w + 40)) + (w + 40)) % (w + 40)) - 20,
        y = ((i * 83.77 + t * (48 + (i % 7) * 7)) % (h + 60)) - 30,
        size = 3 + (i % 4);
      c.save();
      c.translate(x, y);
      c.rotate(i * 2.39996 + t * (i % 2 ? 1 : -1) * 1.4);
      c.scale(0.3 + Math.abs(Math.cos(i + t * 2)) * 0.7, 1);
      c.fillStyle = colors[i % colors.length];
      c.globalAlpha = 0.55 + (i % 3) * 0.2;
      c.fillRect(-size / 2, -size, size, size * 1.75);
      c.restore();
    }
    c.globalAlpha = 1;
  }
  drawWeather(run) {
    const weather = this.weather;
    if (!weather || !["rain", "storm", "snow"].includes(weather.kind)) return;
    const c = this.ctx,
      w = this.w,
      h = this.h,
      snow = weather.kind === "snow",
      count = this.reduced ? 25 : Math.min(130, Math.round((snow ? 70 : 85) + weather.intensity * 40)),
      time = this.elapsed,
      speed = snow ? 48 + (run?.speed || 0) * 0.7 : 430 + (run?.speed || 0) * 6;
    c.save();
    c.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const x =
          ((((i * 137.31 + time * (snow ? weather.wind * 9 : weather.wind * 15) + Math.sin(time * 0.7 + i) * (snow ? 15 : 0)) % (w + 60)) +
            (w + 60)) %
            (w + 60)) -
          30,
        y = ((i * 83.77 + time * speed * (0.65 + (i % 7) * 0.1)) % (h + 80)) - 40;
      if (snow) {
        c.fillStyle = `rgba(244,248,255,${0.28 + (i % 4) * 0.15})`;
        c.beginPath();
        c.arc(x, y, 0.8 + (i % 3) * 0.7, 0, Math.PI * 2);
        c.fill();
      } else {
        c.strokeStyle = `rgba(208,229,250,${0.12 + (i % 4) * 0.045})`;
        c.lineWidth = 0.65 + (i % 3) * 0.25;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + weather.wind * 0.6, y + 14 + weather.intensity * 19);
        c.stroke();
      }
    }
    c.restore();
  }
  draw(run, dt, playing) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, w, h);
    if (this.ending) {
      this.drawEndingConfetti(dt);
      return;
    }
    this.drawWeather(run);
    const boost = playing && run?.boostActive;
    const intensity = playing ? speedIntensity(run?.speed || 0) : 0;
    if (intensity > 0.07 && !this.reduced) {
      const cx = w * 0.5,
        cy = h * 0.4,
        count = Math.round(12 + intensity ** 0.8 * 150);
      c.save();
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996,
          r = (this.elapsed * (350 + intensity * 2300 + i * 11) + i * 91) % Math.max(w, h),
          len = 20 + intensity ** 1.4 * (160 + (i % 7) * 30),
          x = cx + Math.cos(a) * r,
          y = cy + Math.sin(a) * r;
        if (x > w * 0.3 && x < w * 0.7 && y > h * 0.24 && y < h * 0.8) continue;
        c.strokeStyle = i % 4 === 0 ? `rgba(255,183,77,${0.1 + intensity * 0.51})` : `rgba(243,236,226,${0.08 + intensity * 0.48})`;
        c.lineWidth = (i % 5 === 0 ? 1.8 : 0.65) * (0.6 + intensity);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        c.stroke();
      }
      for (let side of [-1, 1])
        for (let i = 0; i < 7; i++) {
          const phase = (this.elapsed * (1 + intensity * 3) + i / 7) % 1,
            x = w * 0.5 + side * w * (0.13 + phase * 0.46),
            y = h * (0.56 + phase * 0.55);
          c.strokeStyle = `rgba(255,220,180,${phase * intensity * 0.7})`;
          c.lineWidth = 1 + phase * 2;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + side * 30 * intensity, y + 70 * intensity);
          c.stroke();
        }
      const g = c.createRadialGradient(cx, cy, w * 0.18, cx, cy, Math.max(w, h) * 0.72);
      g.addColorStop(0, "#ffb74d00");
      g.addColorStop(1, `rgba(209,113,76,${intensity * 0.17})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.restore();
    }
    if (this.energy > 0.07 && !this.reduced) {
      const cx = w * 0.5,
        cy = h * (this.burstCenter || 0.43);
      c.save();
      c.globalAlpha = this.energy * 0.13;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6 + this.elapsed * 0.15;
        c.fillStyle = COLORS[i % COLORS.length];
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a - 0.06) * h, cy + Math.sin(a - 0.06) * h);
        c.lineTo(cx + Math.cos(a + 0.06) * h, cy + Math.sin(a + 0.06) * h);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    if (this.explosionAge < 1.6) {
      const age = this.explosionAge,
        cx = w * 0.5,
        cy = h * 0.66,
        progress = age / 1.6,
        radius = Math.min(w * 0.58, 54 + age * 250);
      c.save();
      c.globalCompositeOperation = "screen";
      c.globalAlpha = Math.max(0, 1 - progress);
      const fire = c.createRadialGradient(cx, cy, radius * 0.04, cx, cy, radius);
      fire.addColorStop(0, "#fff9d8");
      fire.addColorStop(0.24, "#ffed94");
      fire.addColorStop(0.53, "#ff982f");
      fire.addColorStop(0.78, "#e64d1d88");
      fire.addColorStop(1, "#e74c1d00");
      c.fillStyle = fire;
      c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39996,
          xx = cx + Math.cos(a) * radius * 0.5,
          yy = cy + Math.sin(a) * radius * 0.4 - age * 24,
          rr = radius * (0.26 + (i % 3) * 0.035),
          g = c.createRadialGradient(xx, yy, 0, xx, yy, rr);
        g.addColorStop(0, "#fff6bd");
        g.addColorStop(0.3, "#ffc05d");
        g.addColorStop(1, "#fb623500");
        c.fillStyle = g;
        c.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
      }
      c.globalCompositeOperation = "source-over";
      if (age > 0.45) {
        c.globalAlpha = (1 - progress) * 0.65;
        for (let i = 0; i < 5; i++) {
          const xx = cx + Math.sin(i * 7) * radius * 0.48,
            yy = cy - radius * 0.6 - age * 70 - i * 10,
            rr = radius * 0.3,
            g = c.createRadialGradient(xx, yy, 0, xx, yy, rr);
          g.addColorStop(0, "#3a3841bb");
          g.addColorStop(1, "#3a384100");
          c.fillStyle = g;
          c.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
        }
      }
      c.restore();
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(255,237,168,${this.flash * 1.6})`;
      c.fillRect(0, 0, w, h);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age > 0.7) {
        this.rings.splice(i, 1);
        continue;
      }
      c.globalAlpha = (1 - r.age / 0.7) * 0.7;
      c.strokeStyle = r.color;
      c.lineWidth = 2 * (1 - r.age / 0.7) + 0.7;
      c.shadowColor = r.color;
      c.shadowBlur = 10;
      c.beginPath();
      c.ellipse(r.x, r.y, 30 + r.age * w * 0.85, 20 + r.age * w * 0.43, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.vx *= Math.exp(-dt);
      c.globalAlpha = Math.min(1, p.life / 0.3);
      c.fillStyle = p.color;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.angle + p.life * 4);
      c.fillRect(-p.size / 2, -p.size / 2, p.size * 1.6, p.size * 0.65);
      c.restore();
    }
    c.globalAlpha = 1;
  }
}
