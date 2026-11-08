// オンライン対戦（公開MQTTブローカー経由）。ホストが物理を計算し、ゲストは状態を受け取って描画する。
const DEFAULT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
// テスト用：?broker=ws://... で差し替え
const BROKERS = (() => { const b = new URLSearchParams(location.search).get('broker'); return b && /^wss?:\/\//.test(b) ? [b] : DEFAULT_BROKERS; })();
const ROOT = 'uimemocho/maiko-tatsujin/v1/';

function loadMqtt() {
  if (window.mqtt) return Promise.resolve(window.mqtt);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/mqtt.min.js';
    s.onload = () => res(window.mqtt); s.onerror = () => rej(new Error('mqtt load failed'));
    document.head.appendChild(s);
  });
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export class Net {
  constructor() { this.id = uid(); this.client = null; this.handlers = {}; this.room = null; this.role = null; this.lastSeen = 0; this.closed = false; }
  on(type, fn) { this.handlers[type] = fn; }
  emit(type, data) { const h = this.handlers[type]; if (h) h(data); }

  async connect() {
    const mqtt = await loadMqtt();
    for (const url of BROKERS) {
      try {
        this.client = await new Promise((res, rej) => {
          const c = mqtt.connect(url, { clientId: 'mk_' + this.id, clean: true, connectTimeout: 5000, reconnectPeriod: 0, keepalive: 20 });
          const to = setTimeout(() => { c.end(true); rej(new Error('timeout')); }, 6000);
          c.once('connect', () => { clearTimeout(to); res(c); });
          c.once('error', (e) => { clearTimeout(to); c.end(true); rej(e); });
        });
        this.client.on('message', (topic, buf) => this.onMessage(topic, buf));
        this.client.on('close', () => { if (!this.closed) this.emit('drop'); });
        this.client.subscribe(ROOT + 'u/' + this.id);
        return true;
      } catch (e) { /* 次のブローカーへ */ }
    }
    throw new Error('no broker');
  }
  pub(topic, obj) { if (this.client && this.client.connected) this.client.publish(ROOT + topic, JSON.stringify(obj)); }
  send(obj) { if (this.room) this.pub('r/' + this.room + '/' + (this.role === 'host' ? 'h' : 'g'), obj); }

  onMessage(topic, buf) {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    if (m.from === this.id) return;
    const t = topic.slice(ROOT.length);
    if (t === 'lobby') return this.onLobby(m);
    if (t.startsWith('u/')) return this.onDirect(m);
    if (t.startsWith('code/')) return this.onCode(m);
    if (this.room && t.startsWith('r/' + this.room + '/')) { this.lastSeen = performance.now(); this.emit('msg', m); }
  }

  // ランダムマッチ：ロビーで探して、IDの小さい方がホスト
  seek(profile) {
    this.mode = 'seek'; this.profile = profile; this.pending = null;
    this.client.subscribe(ROOT + 'lobby');
    const ping = () => { if (this.mode === 'seek') this.pub('lobby', { type: 'seek', from: this.id, name: profile.name, t: Date.now() }); };
    ping(); this.seekTimer = setInterval(ping, 1200);
  }
  onLobby(m) {
    if (this.mode !== 'seek' || m.type !== 'seek' || Date.now() - m.t > 8000) return;
    if (this.id < m.from && !this.pending) {
      this.pending = m.from;
      this.pub('u/' + m.from, { type: 'offer', from: this.id, room: this.id + m.from.slice(0, 4), profile: this.profile });
      clearTimeout(this.pendTimer); this.pendTimer = setTimeout(() => { this.pending = null; }, 3000);
    }
  }
  onDirect(m) {
    if (m.type === 'offer' && this.mode === 'seek') {
      this.mode = 'room'; clearInterval(this.seekTimer);
      this.enterRoom(m.room, 'guest');
      this.pub('u/' + m.from, { type: 'accept', from: this.id, room: m.room, profile: this.profile });
      this.emit('matched', { role: 'guest', peer: m.profile });
    } else if (m.type === 'accept' && this.mode === 'seek' && m.from === this.pending) {
      this.mode = 'room'; clearInterval(this.seekTimer);
      this.enterRoom(m.room, 'host');
      this.emit('matched', { role: 'host', peer: m.profile });
    }
  }

  // 部屋番号
  createRoom(profile) {
    this.mode = 'code-host'; this.profile = profile;
    this.code = String(1000 + Math.floor(Math.random() * 9000));
    this.client.subscribe(ROOT + 'code/' + this.code);
    return this.code;
  }
  joinRoom(code, profile) {
    this.mode = 'code-guest'; this.profile = profile; this.code = code;
    this.client.subscribe(ROOT + 'code/' + code);
    const knock = () => { if (this.mode === 'code-guest') this.pub('code/' + code, { type: 'knock', from: this.id, profile }); };
    knock(); this.seekTimer = setInterval(knock, 1500);
  }
  onCode(m) {
    if (this.mode === 'code-host' && m.type === 'knock') {
      this.mode = 'room'; const room = 'c' + this.code + this.id.slice(0, 4);
      this.enterRoom(room, 'host');
      this.pub('code/' + this.code, { type: 'welcome', from: this.id, to: m.from, room, profile: this.profile });
      this.emit('matched', { role: 'host', peer: m.profile });
    } else if (this.mode === 'code-guest' && m.type === 'welcome' && m.to === this.id) {
      this.mode = 'room'; clearInterval(this.seekTimer);
      this.enterRoom(m.room, 'guest');
      this.emit('matched', { role: 'guest', peer: m.profile });
    }
  }

  enterRoom(room, role) {
    this.room = room; this.role = role; this.lastSeen = performance.now();
    this.client.subscribe(ROOT + 'r/' + room + '/' + (role === 'host' ? 'g' : 'h'));
  }
  silentFor() { return performance.now() - this.lastSeen; }
  close() {
    this.closed = true; this.mode = null; clearInterval(this.seekTimer); clearTimeout(this.pendTimer);
    if (this.room) this.send({ type: 'bye', from: this.id });
    if (this.client) { const c = this.client; setTimeout(() => c.end(true), 150); }
    this.client = null; this.room = null;
  }
}
