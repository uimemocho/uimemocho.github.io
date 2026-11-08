// WebAudioによる手続き音。三味線（Karplus-Strong）・鼓・拍子木・回転の風切り。
export class Sound {
  constructor() { this.ctx = null; this.se = true; this.bgm = true; this.vib = true; this.bgmMode = null; this.whirl = []; this.plucks = new Map(); }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.seBus = ctx.createGain(); this.seBus.connect(this.master);
    this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0.42; this.bgmBus.connect(this.master);
    // 簡易リバーブ
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.25; this.verb.connect(vg); vg.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyToggles();
    if (this.pendingBgm) this.playBgm(this.pendingBgm);
  }
  applyToggles() { if (!this.ctx) return; this.seBus.gain.value = this.se ? 1 : 0; this.bgmBus.gain.value = this.bgm ? 0.42 : 0; }
  buzz(p) { if (this.vib && navigator.vibrate) try { navigator.vibrate(p); } catch {} }

  out(dest, wet = 0.2) { const g = this.ctx.createGain(); g.connect(dest); if (wet) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); } return g; }

  pluckBuffer(freq, bright = 0.5) {
    const key = freq.toFixed(1) + bright; if (this.plucks.has(key)) return this.plucks.get(key);
    const sr = this.ctx.sampleRate, n = Math.floor(sr * 1.4), buf = this.ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const p = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(p);
    for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const v = ring[idx], nx = ring[(idx + 1) % p];
      const s = (v + nx) * 0.5 * 0.996; ring[idx] = s * bright + v * (1 - bright) * 0.996;
      d[i] = v + (i < 60 ? (Math.random() - 0.5) * 0.6 : 0); // 撥の当たり
      last = v; idx = (idx + 1) % p;
    }
    this.plucks.set(key, buf); return buf;
  }
  shamisen(freq, t, vol = 0.5, dest = this.seBus, bright = 0.62) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.pluckBuffer(freq, bright);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
    // さわり（共鳴の唸り）
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = freq * 3.01; bp.Q.value = 6; bp.gain.value = 8;
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this.out(dest, 0.25)); src.start(t); src.stop(t + 1.3);
  }
  noiseHit(t, freq, q, dur, vol, dest = this.seBus, type = 'bandpass') {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(dest, 0.15)); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  tone(t, f0, f1, dur, vol, type = 'sine', dest = this.seBus, wet = 0.2) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(dest, wet)); o.start(t); o.stop(t + dur + 0.02);
  }
  // 鼓「ポン」
  tsuzumi(t, vol = 0.7, dest = this.seBus) { this.tone(t, 520, 230, 0.32, vol, 'sine', dest, 0.35); this.noiseHit(t, 1800, 2, 0.05, vol * 0.4, dest); }
  taiko(t, vol = 0.8, dest = this.seBus) { this.tone(t, 120, 55, 0.45, vol, 'sine', dest, 0.2); this.noiseHit(t, 300, 1, 0.08, vol * 0.5, dest, 'lowpass'); }
  hyoshigi(t, vol = 0.8) { for (const dt of [0, 0.012]) { this.tone(t + dt, 2400, 2100, 0.06, vol * 0.5, 'triangle'); this.noiseHit(t + dt, 3200, 8, 0.05, vol); } }
  bell(t, vol = 0.4) { for (const [m, d] of [[1, 1.4], [2.76, 0.9], [5.4, 0.5], [8.93, 0.3]]) this.tone(t, 1320 * m, 1320 * m, d, vol / m, 'sine', this.seBus, 0.4); }

  play(name, opt = {}) {
    if (!this.ctx || !this.se) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'tap': this.noiseHit(t, 2600, 4, 0.04, 0.25); this.tone(t, 900, 700, 0.05, 0.12, 'triangle'); break;
      case 'select': this.shamisen(587.3, t, 0.25); break;
      case 'pull': this.noiseHit(t, 600 + opt.p * 1400, 3, 0.08, 0.06 + opt.p * 0.1); break;
      case 'launch': this.hyoshigi(t, 0.9); this.noiseHit(t, 900, 0.6, 0.6, 0.45); this.tsuzumi(t + 0.14, 0.8); this.buzz(40); break;
      case 'maie': this.taiko(t, 1); this.tsuzumi(t + 0.05, 0.8); this.shamisen(293.7, t + 0.02, 0.55); this.shamisen(440, t + 0.1, 0.4); break;
      case 'hit': { const p = Math.min(1, opt.power / 6); this.noiseHit(t, 1400 + p * 1500, 2.5, 0.12, 0.3 + p * 0.5); this.tone(t, 300 + p * 200, 140, 0.15, 0.2 + p * 0.3, 'triangle'); this.buzz(15 + p * 25 | 0); break; }
      case 'crit': this.bell(t, 0.5); this.taiko(t, 1); this.noiseHit(t, 4200, 1.2, 0.35, 0.6); this.buzz([30, 20, 50]); break;
      case 'dash': this.noiseHit(t, 1200, 1, 0.22, 0.35); this.tone(t, 260, 520, 0.16, 0.18, 'sawtooth'); break;
      case 'rim': this.tone(t, 180, 120, 0.12, 0.3, 'triangle'); this.noiseHit(t, 700, 3, 0.08, 0.2); break;
      case 'out': this.tone(t, 700, 90, 0.9, 0.35, 'sine'); this.noiseHit(t + 0.5, 300, 1, 0.4, 0.5, this.seBus, 'lowpass'); this.buzz(80); break;
      case 'fall': this.taiko(t, 0.9); this.noiseHit(t, 500, 1, 0.3, 0.4); this.buzz(60); break;
      case 'win': [587.3, 659.3, 880, 987.8, 1174.7].forEach((f, i) => this.shamisen(f, t + i * 0.11, 0.45)); this.tsuzumi(t + 0.6, 0.8); break;
      case 'lose': [440, 392, 293.7].forEach((f, i) => this.shamisen(f, t + i * 0.22, 0.4, this.seBus, 0.45)); break;
      case 'rank': this.bell(t, 0.35); this.tsuzumi(t, 0.6); break;
      case 'snap': this.noiseHit(t, 5000, 1.5, 0.09, 0.9); this.tone(t, 300, 1800, 0.12, 0.35, 'sawtooth'); this.tsuzumi(t + 0.03, 0.9); this.buzz(50); break;
      case 'grind': this.noiseHit(t, 5200 + Math.random() * 2500, 6, 0.035, 0.05 + (opt.k || 0) * 0.08); break;
      case 'ko': this.taiko(t, 1); this.taiko(t + 0.09, 0.9); this.bell(t, 0.5); this.noiseHit(t, 2600, 0.7, 0.9, 0.8); this.tone(t, 900, 160, 0.7, 0.3, 'sawtooth'); this.buzz([60, 30, 120]); break;
      case 'splash': this.noiseHit(t, 900, 0.8, 0.7, 0.7, this.seBus, 'lowpass'); this.noiseHit(t + 0.05, 3200, 1, 0.4, 0.3); break;
      case 'koten': this.tone(t, 160, 70, 0.22, 0.6, 'sine'); this.noiseHit(t, 400, 1, 0.12, 0.35, this.seBus, 'lowpass'); this.shamisen(196, t + 0.05, 0.25); this.buzz(30); break;
      case 'critBig': this.tone(t, 2400, 2400, 1.2, 0.25, 'sine'); this.tone(t, 3610, 3610, 0.9, 0.12, 'sine'); this.taiko(t + 0.24, 1); this.taiko(t + 0.32, 0.9); this.noiseHit(t + 0.24, 1800, 0.6, 0.6, 0.6); this.buzz([80, 40, 120]); break;
      case 'found': this.hyoshigi(t, 0.7); this.hyoshigi(t + 0.25, 0.7); break;
    }
  }

  // 回転の風切り音（ω に追従）
  setWhirl(i, omega, pan = 0) {
    if (!this.ctx) return;
    let w = this.whirl[i];
    if (!w) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(this.seBus); } else g.connect(this.seBus);
      src.start(); w = this.whirl[i] = { f, g, p };
    }
    const t = this.ctx.currentTime, k = Math.min(1, omega / 90);
    w.f.frequency.setTargetAtTime(250 + k * 1600 + Math.sin(t * omega * 0.5) * 80 * k, t, 0.05);
    w.g.gain.setTargetAtTime(this.se ? k * k * 0.16 : 0, t, 0.08);
    if (w.p) w.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
  }
  stopWhirl() { if (!this.ctx) return; for (const w of this.whirl) if (w) w.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }

  // BGM：都節音階の三味線＋太鼓（menu / battle）
  playBgm(mode) {
    this.pendingBgm = mode;
    if (!this.ctx || this.bgmMode === mode) return;
    this.bgmMode = mode; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
  }
  stopBgm() { this.bgmMode = null; this.pendingBgm = null; }
  tick() {
    if (!this.ctx || !this.bgmMode) return;
    const battle = this.bgmMode === 'battle', bpm = battle ? 150 : 84, sp = 60 / bpm / 2;
    // D Eb G A Bb（都節）
    const scale = [146.8, 155.6, 196, 220, 233.1, 293.7, 311.1, 392, 440, 466.2, 587.3];
    const melA = battle ? [5, -1, 7, 5, 8, 7, 5, 4, 3, -1, 2, 3, 5, -1, 4, 2] : [5, -1, -1, 4, 3, -1, 2, -1, 3, -1, -1, 5, 7, -1, 5, -1];
    const melB = battle ? [7, 8, 10, 8, 7, -1, 5, 7, 8, 7, 5, 4, 5, -1, -1, -1] : [8, -1, 7, -1, 5, -1, 4, 5, 3, -1, -1, -1, 2, -1, -1, -1];
    while (this.nextT < this.ctx.currentTime + 0.25) {
      const s = this.step, bar = (s >> 4) % 4, i = s % 16, mel = bar === 3 ? melB : melA;
      const n = mel[i];
      if (n >= 0) this.shamisen(scale[n], this.nextT, battle ? 0.32 : 0.26, this.bgmBus, battle ? 0.66 : 0.55);
      if (battle) {
        if (i % 4 === 0) this.taiko(this.nextT, i === 0 ? 0.75 : 0.45, this.bgmBus);
        if (i === 6 || i === 14) this.tsuzumi(this.nextT, 0.4, this.bgmBus);
        if (i % 2 === 1) this.noiseHit(this.nextT, 5200, 6, 0.03, 0.08, this.bgmBus);
      } else {
        if (i === 0) this.tsuzumi(this.nextT, 0.35, this.bgmBus);
        if (i === 0 && bar === 0) this.shamisen(scale[0], this.nextT, 0.2, this.bgmBus, 0.4);
      }
      this.step++; this.nextT += sp;
    }
  }
}
