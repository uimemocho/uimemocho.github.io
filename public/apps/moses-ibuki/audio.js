// 波音・地鳴り・効果音・BGMをWebAudioで合成（音源ファイルなし）
export class Sound {
  constructor() { this.ctx = null; this.se = true; this.bgm = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const C = window.AudioContext || window.webkitAudioContext; const ctx = new C(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 3, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 * 0.5 + w * 0.5; }
    this.noise = nb;
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this._ambience(); this._rumble(); this._pad();
    return ctx;
  }
  _src(loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop; return s; }
  _ambience() {
    const c = this.ctx, s = this._src();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.6;
    const g1 = c.createGain(), g2 = c.createGain(); g1.gain.value = 0.22; g2.gain.value = 0.035;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.14; lfo.connect(lg); lg.connect(g1.gain);
    const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = 0.09; lfo2.phase = 1; lg2.gain.value = 0.03; lfo2.connect(lg2); lg2.connect(g2.gain);
    this.amb = c.createGain(); this.amb.gain.value = 0;
    s.connect(lp); lp.connect(g1); g1.connect(this.amb); s.connect(hp); hp.connect(g2); g2.connect(this.amb); this.amb.connect(this.sfx);
    s.start(); lfo.start(); lfo2.start();
  }
  _rumble() {
    const c = this.ctx, s = this._src();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 42;
    const og = c.createGain(); og.gain.value = 0.5;
    this.rum = c.createGain(); this.rum.gain.value = 0; this.rumLp = lp;
    s.connect(lp); lp.connect(this.rum); o.connect(og); og.connect(this.rum); this.rum.connect(this.sfx);
    s.start(); o.start();
  }
  _pad() {
    const c = this.ctx; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.4; f.connect(this.music);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    [73.42, 110, 146.83, 174.61, 220].forEach((hz, i) => {
      for (const det of [-6, 5]) { const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = hz; o.detune.value = det; const g = c.createGain(); g.gain.value = i < 2 ? 0.03 : 0.045; o.connect(g); g.connect(f); o.start(); }
    });
  }
  ramp(param, v, t = 0.4) { if (!this.ctx) return; const n = this.ctx.currentTime; param.cancelScheduledValues(n); param.setValueAtTime(param.value, n); param.linearRampToValueAtTime(v, n + t); }
  setAmb(v) { if (this.ctx) this.ramp(this.amb.gain, this.se ? v : 0, 0.6); }
  setMusic(on) { if (this.ctx) this.ramp(this.music.gain, on && this.bgm ? 0.5 : 0, 1.2); }
  // 息の最中は低音だけ（マイクに拾われにくい帯域）
  setRumble(p) { if (!this.ctx) return; const n = this.ctx.currentTime; this.rum.gain.setTargetAtTime(this.se ? p * 0.9 : 0, n, 0.08); this.rumLp.frequency.setTargetAtTime(90 + p * 70, n, 0.1); }
  _burst(dur, f0, f1, vol, q = 0.7, type = 'lowpass') {
    if (!this.ctx || !this.se) return; const c = this.ctx, n = c.currentTime, s = this._src(false);
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(f1, n + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.25, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(n, Math.random() * 2); s.stop(n + dur + 0.1);
  }
  _tone(hz, dur, vol, type = 'sine', at = 0, glide = 0) {
    if (!this.ctx || !this.se) return; const c = this.ctx, n = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(hz, n); if (glide) o.frequency.exponentialRampToValueAtTime(glide, n + dur);
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g); g.connect(this.sfx); o.start(n); o.stop(n + dur + 0.05);
  }
  click() { this._tone(880, 0.06, 0.08, 'triangle'); }
  tick(last) { this._tone(last ? 1320 : 660, last ? 0.35 : 0.12, 0.14, 'sine'); }
  cut() { this._burst(0.7, 400, 4000, 0.5, 0.8, 'bandpass'); this._tone(55, 0.8, 0.5, 'sine', 0, 30); }
  roar() { this._burst(3.2, 200, 1800, 0.9, 0.6); this._burst(2.6, 2500, 600, 0.25, 0.5, 'bandpass'); this._tone(38, 2.4, 0.7, 'sine', 0, 28); }
  crash() { this._burst(3.4, 2400, 160, 1.0, 0.5); this._tone(48, 2.2, 0.8, 'sine', 0.05, 26); }
  sting(idx) {
    const base = [196, 220, 246.9, 261.6, 293.7, 329.6, 349.2, 392][idx] || 261.6;
    [1, 1.26, 1.5, 2].forEach((m, i) => this._tone(base * m, 1.6 - i * 0.2, 0.09, 'triangle', i * 0.09));
    if (idx >= 6) [2.52, 3, 4].forEach((m, i) => this._tone(base * m, 1.4, 0.05, 'sine', 0.4 + i * 0.08));
  }
}
