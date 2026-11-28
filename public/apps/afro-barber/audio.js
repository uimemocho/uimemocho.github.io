// WebAudio だけで鳴らす効果音とBGM
export class Sound {
  constructor() { this.ctx = null; this.se = true; this.bgm = true; this._snipT = 0; this._thudT = 0; this.musicOn = false; this.musicLevel = 1; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = 0.9; this.out.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.out);
    this.mus = c.createGain(); this.mus.gain.value = 0; this.mus.connect(this.out);
    // 美術館っぽい残響（ディレイの重ね）
    const dl = c.createDelay(1); dl.delayTime.value = 0.23; const fb = c.createGain(); fb.gain.value = 0.36; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.rev = c.createGain(); this.rev.gain.value = 0.3; this.rev.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.out);
    const n = c.sampleRate * 1.2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    this._sched();
  }
  _burst(dur, f, q, vol, type = 'bandpass', dest) {
    if (!this.ctx || !this.se) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05);
  }
  _tone(f, dur, vol, type = 'sine', delay = 0, slide = 0, dest) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.sfx); if (dest !== this.mus) g.connect(this.rev); o.start(t); o.stop(t + dur + 0.05);
  }
  // ハサミ：シャキッ
  snip(n = 1) {
    if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._snipT < 0.055) return; this._snipT = now;
    this._burst(0.05, 5200 + Math.random() * 1600, 3, 0.32 * Math.min(1.3, 0.7 + n * 0.05));
    setTimeout(() => this._burst(0.07, 3300 + Math.random() * 800, 4, 0.22), 28);
  }
  puff() { if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._snipT < 0.07) return; this._snipT = now; this._burst(0.16, 700, 1.2, 0.35, 'lowpass'); this._tone(220, 0.12, 0.05, 'sine', 0, 330); }
  brush() { if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._snipT < 0.09) return; this._snipT = now; this._burst(0.18, 2600, 0.7, 0.16); }
  thud(big) { if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._thudT < 0.08) return; this._thudT = now; this._burst(big ? 0.5 : 0.22, big ? 380 : 900, 0.8, big ? 0.5 : 0.18, 'lowpass'); if (big) this._tone(70, 0.4, 0.3, 'sine', 0, 40); }

  // バリカンの連続音
  buzz(on) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    if (on && this.se) {
      if (this._bz) return;
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 118; o2.type = 'square'; o2.frequency.value = 236.5;
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); o.start(); o2.start();
      this._bz = { o, o2, g };
    } else if (this._bz) {
      const b = this._bz; this._bz = null; b.g.gain.cancelScheduledValues(t); b.g.gain.setTargetAtTime(0, t, 0.03); b.o.stop(t + 0.2); b.o2.stop(t + 0.2);
    }
  }
  cutHair() { if (this._bz) { const t = this.ctx.currentTime; this._bz.g.gain.setTargetAtTime(0.11, t, 0.01); this._bz.g.gain.setTargetAtTime(0.06, t + 0.06, 0.05); } }
  thinSnip() { if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._snipT < 0.07) return; this._snipT = now; this._burst(0.04, 6800, 2, 0.16); setTimeout(() => this._burst(0.05, 4200, 2, 0.12), 24); setTimeout(() => this._burst(0.04, 5600, 2, 0.08), 46); }
  scrape() { if (!this.ctx || !this.se) return; const now = this.ctx.currentTime; if (now - this._snipT < 0.08) return; this._snipT = now; this._burst(0.12, 3800, 1.4, 0.16, 'bandpass'); }
  // しゃべり声（もごもご）
  mumble() { if (!this.ctx || !this.se) return; const f = 120 + Math.random() * 40; this._tone(f, 0.07, 0.09, 'triangle', 0, f * 0.85); this._burst(0.05, 900 + Math.random() * 500, 3, 0.05); }
  click() { if (!this.se) return; this._tone(880, 0.06, 0.07, 'triangle'); }
  tick(hi) { if (!this.se) return; this._tone(hi ? 1320 : 990, 0.08, hi ? 0.14 : 0.08, 'square'); }
  cut() { if (!this.se) return; this._burst(0.5, 4200, 0.6, 0.45, 'highpass'); [523.3, 659.3, 784, 1046.5].forEach((f, i) => this._tone(f, 0.7, 0.07, 'triangle', i * 0.04)); }
  end() { if (!this.se) return; this._tone(196, 1.4, 0.18, 'triangle'); this._tone(293.7, 1.4, 0.12, 'triangle', 0.05); this._burst(0.8, 300, 0.6, 0.3, 'lowpass'); }
  sting(idx) {
    if (!this.se) return;
    const base = [196, 220, 246.9, 261.6, 293.7, 329.6, 349.2, 392][idx] || 261.6;
    [1, 1.26, 1.5, 2].forEach((m, i) => this._tone(base * m, 1.8 - i * 0.2, 0.08, 'triangle', i * 0.1));
    if (idx >= 6) [2.52, 3, 4].forEach((m, i) => this._tone(base * m, 1.5, 0.05, 'sine', 0.45 + i * 0.09));
  }
  setMusic(on, level = 1) {
    this.musicOn = on; this.musicLevel = level;
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.mus.gain.cancelScheduledValues(t); this.mus.gain.setTargetAtTime(on && this.bgm ? 0.5 * level : 0, t, 0.6);
  }
  // 3拍子のゆったりしたピアノ風アルペジオ（自作の進行）
  _sched() {
    const c = this.ctx; const prog = [[146.8, 220, 293.7, 370], [130.8, 196, 261.6, 329.6], [123.5, 185, 246.9, 293.7], [110, 164.8, 220, 277.2], [98, 146.8, 196, 246.9], [110, 164.8, 220, 277.2], [123.5, 185, 246.9, 311.1], [146.8, 220, 293.7, 370]];
    const mel = [740, 659.3, 587.3, 554.4, 587.3, 659.3, 554.4, 587.3];
    let bar = 0; const beat = 0.62;
    const play = () => {
      if (!this.ctx) return;
      if (this.musicOn && this.bgm) {
        const ch = prog[bar % prog.length];
        this._pno(ch[0], beat * 3, 0.16, 0);
        this._pno(ch[1], beat * 2, 0.07, beat); this._pno(ch[2], beat * 2, 0.07, beat);
        this._pno(ch[1], beat * 1.5, 0.06, beat * 2); this._pno(ch[3], beat * 1.5, 0.06, beat * 2);
        if (bar % 2 === 0) this._pno(mel[(bar / 2) % mel.length] * (bar % 16 < 8 ? 1 : 0.75), beat * 4, 0.075, beat * 0.02);
      }
      bar++;
      this._timer = setTimeout(play, beat * 3 * 1000);
    };
    play();
  }
  _pno(f, dur, vol, delay) {
    const c = this.ctx, t = c.currentTime + delay + 0.05;
    [[1, vol], [2, vol * 0.18], [3, vol * 0.05]].forEach(([m, v]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0006, t + dur * 1.4);
      o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + dur * 1.5);
    });
  }
}
