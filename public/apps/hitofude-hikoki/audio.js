// WebAudio 手続き音（外部音源なし）
export class Sound {
  constructor() { this.se = true; this.bgm = true; this.vib = true; this.ctx = null; this._bgmOn = false; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
      // 残響
      this.verb = c.createConvolver(); this.verb.buffer = this._impulse(2.4); const vg = c.createGain(); vg.gain.value = 0.32; this.verb.connect(vg); vg.connect(this.master);
      // 風のノイズ（常時）
      const n = c.createBufferSource(); n.buffer = this._noise(4); n.loop = true;
      this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.7;
      this.windG = c.createGain(); this.windG.gain.value = 0;
      n.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.sfx); n.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.bgm && !this._bgmOn) this.startBgm();
  }
  _noise(sec) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * 0.97 + w * 0.03; d[i] = w * 0.35 + last * 3; } return b; }
  _impulse(sec) { const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } return b; }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  setSe(v) { this.se = v; if (this.sfx) this.sfx.gain.value = v ? 1 : 0; }
  setBgm(v) { this.bgm = v; if (v) this.startBgm(); else this.stopBgm(); }
  buzz(p) { if (this.vib && navigator.vibrate) try { navigator.vibrate(p); } catch {} }
  wind() { return; } // 風の環境音は鳴らさない
  _windOld(level, speed = 0) {
    if (!this.ctx) return;
    const t = this.t, l = Math.max(0, Math.min(1, level));
    this.windG.gain.setTargetAtTime(this.se ? 0.04 + l * 0.32 : 0, t, 0.25);
    this.windF.frequency.setTargetAtTime(300 + l * 900 + speed * 30, t, 0.3);
  }
  _env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  _noiseHit(t, f, q, peak, dec, type = 'bandpass', dest) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this._nb || (this._nb = this._noise(1));
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); this._env(g, t, 0.005, peak, dec);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); s.start(t); s.stop(t + dec + 0.1); return fl;
  }
  _tone(t, f, type, peak, dec, dest, glide) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dec);
    this._env(g, t, 0.008, peak, dec); o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dec + 0.1); return g;
  }
  ui() { if (!this.ctx || !this.se) return; this._tone(this.t, 1320, 'triangle', 0.08, 0.08); }
  paper() { // 紙のこすれ
    if (!this.ctx || !this.se) return; const t = this.t;
    for (let i = 0; i < 3; i++) this._noiseHit(t + i * 0.035, 2600 + Math.random() * 2400, 1.2, 0.09, 0.05, 'bandpass');
  }
  pen(v) { if (!this.ctx || !this.se) return; this._noiseHit(this.t, 3800 + v * 1500, 3, 0.02 + v * 0.03, 0.03, 'bandpass'); }
  stretch(p) { if (!this.ctx || !this.se) return; this._tone(this.t, 220 + p * 380, 'sine', 0.03, 0.06); }
  throw(power) {
    if (!this.ctx || !this.se) return; const t = this.t;
    this._tone(t, 260, 'sine', 0.16, 0.16 + power * 0.05, null, 980);
    this._tone(t + 0.02, 1900, 'triangle', 0.04, 0.09, this.verb, 2600);
    this._noiseHit(t, 5200, 1.5, 0.05, 0.035, 'highpass');
    this.buzz(18);
  }
  catchWind() {
    if (!this.ctx || !this.se) return; const t = this.t, v = this.verb;
    [784, 988, 1175, 1568].forEach((f, i) => this._tone(t + i * 0.055, f, 'triangle', 0.13, 0.7, v));
    this._tone(t, 392, 'sine', 0.1, 0.35, null, 1568);
    this.buzz([20, 40, 30]);
  }
  tick() { if (!this.ctx || !this.se) return; this._tone(this.t, 1760, 'triangle', 0.05, 0.05); }
  mile(n) { if (!this.ctx || !this.se) return; const t = this.t, f = 660 * Math.pow(2, (n % 8) * 2 / 12); this._tone(t, f, 'sine', 0.06, 0.25, this.verb); this._tone(t + 0.07, f * 1.5, 'sine', 0.05, 0.35, this.verb); }
  thermal() { if (!this.ctx || !this.se) return; const t = this.t; [523, 659, 784].forEach((f, i) => this._tone(t + i * 0.08, f, 'sine', 0.08, 0.6, this.verb)); }
  stall() { if (!this.ctx || !this.se) return; this._tone(this.t, 440, 'sawtooth', 0.05, 0.4, null, 140); }
  land(kind) {
    if (!this.ctx || !this.se) return; const t = this.t;
    if (kind === 'sea' || kind === 'river') { const f = this._noiseHit(t, 1400, 0.6, 0.45, 0.6, 'lowpass'); f.frequency.exponentialRampToValueAtTime(200, t + 0.5); this._noiseHit(t + 0.05, 3000, 1, 0.12, 0.3); }
    else if (kind === 'forest') { for (let i = 0; i < 6; i++) this._noiseHit(t + i * 0.04, 2000 + Math.random() * 3000, 2, 0.12, 0.06); }
    else { this._noiseHit(t, 700, 1, 0.3, 0.12); this._noiseHit(t + 0.08, 1800, 1.5, 0.15, 0.1); }
    this.buzz(30);
  }
  fanfare(good) {
    if (!this.ctx || !this.se) return; const t = this.t + 0.05;
    const seq = good ? [523, 659, 784, 1047, 1319] : [392, 440, 523];
    seq.forEach((f, i) => { this._tone(t + i * 0.09, f, 'triangle', 0.12, 0.5, this.verb); this._tone(t + i * 0.09, f / 2, 'sine', 0.06, 0.4); });
  }
  // ゆったりしたBGM（ペンタトニックのアルペジオとパッド）
  startBgm() {
    if (!this.ctx || this._bgmOn) return; this._bgmOn = true;
    this.music.gain.setTargetAtTime(this.bgm ? 0.5 : 0, this.t, 0.8);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21], chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
    let step = 0, bar = 0; const bpm = 84, sp = 60 / bpm / 2;
    let next = this.t + 0.1;
    const tick = () => {
      if (!this._bgmOn) return;
      while (next < this.t + 0.4) {
        const root = 62 + chords[bar % 4][0];
        if (step % 16 === 0) {
          chords[bar % 4].forEach(n => {
            const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (50 + n - 69) / 12); o.detune.value = (Math.random() - 0.5) * 12;
            f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, next); g.gain.linearRampToValueAtTime(0.028, next + 1.2); g.gain.linearRampToValueAtTime(0.0001, next + sp * 16);
            o.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb); o.start(next); o.stop(next + sp * 16 + 0.1);
          });
        }
        const pattern = [0, 2, 4, 3, 5, 4, 2, 6];
        if (step % 2 === 0 || Math.random() < 0.25) {
          const deg = pattern[(step / 2 | 0) % 8] + (bar % 2 ? 1 : 0);
          const midi = root + scale[deg % scale.length] - 2;
          const c = this.ctx, o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
          g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.05, next + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.9);
          o.connect(g); g.connect(this.music); g.connect(this.verb); o.start(next); o.stop(next + 1);
        }
        next += sp; step++; if (step % 16 === 0) bar++;
      }
      this._bgmTimer = setTimeout(tick, 120);
    };
    tick();
  }
  stopBgm() { this._bgmOn = false; clearTimeout(this._bgmTimer); if (this.music) this.music.gain.setTargetAtTime(0, this.t, 0.3); }
  duck(on) { if (this.music) this.music.gain.setTargetAtTime(this.bgm ? (on ? 0.18 : 0.5) : 0, this.t, 0.4); }
}
