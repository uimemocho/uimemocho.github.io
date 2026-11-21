// マイクで息を検知する。息は「広い帯域にわたる風切りノイズ」、声は「倍音のある山の多いスペクトル」。
// 周囲の音を最初に測り、その上にどれだけ息のノイズが乗ったかを 0〜1 の息圧にする。
export class Breath {
  constructor(ctx) {
    this.ctx = ctx; this.stream = null; this.an = null; this.floor = -70; this.level = 0; this.flat = 0; this.p = 0; this.raw = 0;
    this.buf = null; this.mode = 'mic';
  }
  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext; }
  async start() {
    if (this.stream) return true;
    // 雑音除去・自動音量・エコー除去は息のノイズを消してしまうので切る
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    this.stream = stream;
    const src = this.ctx.createMediaStreamSource(stream);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const an = this.ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0;
    src.connect(hp); hp.connect(an);
    // Safari は出力につながっていないノードを処理しないことがあるので、無音でつないでおく
    const mute = this.ctx.createGain(); mute.gain.value = 0; an.connect(mute); mute.connect(this.ctx.destination); this.mute = mute;
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch {} }
    this.src = src; this.an = an; this.buf = new Float32Array(an.frequencyBinCount);
    return true;
  }
  stop() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); }
    try { this.src && this.src.disconnect(); this.mute && this.mute.disconnect(); } catch {}
    this.stream = null; this.an = null; this.src = null;
  }
  // 1フレーム分の解析
  read() {
    if (!this.an) return { level: -100, flat: 0 };
    this.an.getFloatFrequencyData(this.buf);
    const hz = this.ctx.sampleRate / this.an.fftSize;
    const i0 = Math.max(1, Math.round(150 / hz)), i1 = Math.min(this.buf.length - 1, Math.round(3000 / hz));
    let sum = 0, logSum = 0, n = 0;
    for (let i = i0; i <= i1; i++) {
      const db = Math.max(-140, this.buf[i]);
      const pw = Math.pow(10, db / 10);
      sum += pw; logSum += Math.log(pw + 1e-14); n++;
    }
    const mean = sum / n;
    const flat = Math.exp(logSum / n) / (mean + 1e-14); // スペクトル平坦度（0=純音, 1=白色雑音）
    const level = 10 * Math.log10(sum + 1e-14);
    return { level, flat };
  }
  // 周囲音の測定（ms）
  async calibrate(ms, onProgress) {
    const vals = []; const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await new Promise(r => setTimeout(r, 30));
      vals.push(this.read().level); onProgress && onProgress((performance.now() - t0) / ms);
    }
    vals.sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length * 0.6)] ?? -70;
    this.floor = Math.max(-95, Math.min(-25, med));
    return this.floor;
  }
  // 息圧 0〜1（なめらかに追従）
  update(dt) {
    const { level, flat } = this.read();
    this.level = level; this.flat = flat;
    const over = level - this.floor;
    let raw = Math.max(0, Math.min(1.15, (over - 7) / 34));
    // 声・口笛（平坦度が低い）は大きく減らす
    const gate = smooth(0.05, 0.16, flat);
    raw *= 0.12 + 0.88 * gate;
    this.raw = raw;
    const k = raw > this.p ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 7);
    this.p += (raw - this.p) * k;
    return Math.min(1, this.p);
  }
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
