/*
 * 世紀末ジャン拳 — DOM ID contract
 *
 * Required:
 *   #game, #enemy-character, #streak, #dopa,
 *   #best-streak, #best-dopa, [data-choice="rock|scissors|paper"]
 * Recommended:
 *   #enemy-name, #enemy-title, #enemy-quote, #result-text, #round-text,
 *   #player-choice, #enemy-choice, #player-round-wins, #enemy-round-wins,
 *   #title-screen, #start-button, #round-cutin, #round-number,
 *   #chant-overlay, #chant-image, #sound-toggle, #bgm,
 *   #shake-toggle, #entry-cut, #entry-title, #entry-name, #entry-quote,
 *   #rush-emblem, #particle-layer, #screen-flash.
 *
 * The character element receives data-character/data-pose and the classes
 * character--{id}/pose--{pose}. The game root receives state/result/RUSH
 * classes so all mutable text and numbers can remain real HTML.
 */
(function dopaJanken(global) {
  'use strict';

  const HANDS = Object.freeze(['rock', 'scissors', 'paper']);
  const WINS_AGAINST = Object.freeze({
    rock: 'scissors',
    scissors: 'paper',
    paper: 'rock'
  });

  const GameRules = Object.freeze({
    HANDS,
    MATCH_TARGET: 3,

    outcome(player, enemy) {
      if (!HANDS.includes(player) || !HANDS.includes(enemy)) {
        throw new RangeError('Invalid janken hand');
      }
      if (player === enemy) return 'draw';
      return WINS_AGAINST[player] === enemy ? 'win' : 'loss';
    },

    calculateDopa(streak) {
      const safeStreak = Math.max(0, Math.floor(Number(streak) || 0));
      return safeStreak * 100;
    },

    isRush(streak) {
      return (Number(streak) || 0) >= 10;
    },

    isMatchWon(wins) {
      return (Number(wins) || 0) >= 3;
    },

    randomHand(rng = Math.random) {
      const sample = Number(rng());
      const normalized = Number.isFinite(sample)
        ? Math.min(0.999999999999, Math.max(0, sample))
        : 0;
      return HANDS[Math.floor(normalized * HANDS.length)];
    }
  });

  global.GameRules = GameRules;
  if (typeof document === 'undefined') return;

  const STORAGE = Object.freeze({
    bestStreak: 'dohagaki.bestStreak',
    bestDopa: 'dohagaki.bestDopa',
    sound: 'dohagaki.sound',
    reduceShake: 'dohagaki.reduceShake',
    difficulty: 'dohagaki.debugDifficulty',
    forceWin: 'dohagaki.debugForceWin'
  });

  const HAND_LABELS = Object.freeze({
    rock: 'グー',
    scissors: 'チョキ',
    paper: 'パー'
  });

  const CHARACTERS = Object.freeze([
    {
      id: 'boris',
      atlas: '../assets/images/characters/boris-atlas.webp?v=4',
      name: '爆拳のボリス',
      title: '北方鉄獄の破城槌',
      intro: '「鉄仮面の下で、拳が飢えている」',
      idle: ['早く出せ！ 拳が飢えている！', '三つ全部まとめて砕いてやる！'],
      win: ['見たか！ これが爆拳だ！', '足りん！ もっと運を燃やせ！'],
      loss: ['ぐおおおっ！ ……強い。認める。', '俺の怒りを越えたか……！']
    },
    {
      id: 'mira',
      atlas: '../assets/images/characters/mira-atlas.webp?v=4',
      name: '砂塵のミラ',
      title: '黄砂回廊の無音兵',
      intro: '「風は、勝者の名だけを運ぶ」',
      idle: ['言葉は要らない。手を出して。', '砂嵐の先まで、もう見えている。'],
      win: ['……予測どおり。', '砂に残るのは、あなたの迷い。'],
      loss: ['ふっ……風向きが変わった。', 'その選択、覚えておく。']
    },
    {
      id: 'genza',
      atlas: '../assets/images/characters/genza-atlas.webp?v=4',
      name: '老拳士ゲンザ',
      title: '忘却寺最後の門番',
      intro: '「老いたのは肉体だけじゃよ」',
      idle: ['さて……昼寝の前に一手。', 'ほっほ。指先に迷いが見えるぞ。'],
      win: ['勝負は急がぬ者に微笑む。', 'まだ拳が心に追いついておらん。'],
      loss: ['お見事。老骨に響いたわい。', '深く、一礼。よい一手じゃった。']
    },
    {
      id: 'galdo',
      atlas: '../assets/images/characters/galdo-atlas.webp?v=4',
      name: '拳王ガルド',
      title: '世紀末覇者・黄金獅子',
      intro: '「最後の三択だ。時代ごとひざまずけ」',
      idle: ['膝をつけ。天は俺だけを見ている。', '三択だと？ 俺には勝利しか見えん。'],
      win: ['弱者の運命は、砂より軽い。', 'その拳では時代を掴めん。'],
      loss: ['……この拳が、震えているだと。', '見事だ。新たな覇者よ。']
    }
  ]);

  const RESULT_LINES = Object.freeze({
    win: [
      '勝者、生存。敗者、砂。',
      '確率よ、頭を垂れろ。',
      '読んだのではない。未来を決めた。',
      'お前の未来、三択すべて死。'
    ],
    rush: [
      '勝つたび、人間ではなくなっていく。',
      '世界は滅びる。だが我だけは勝ち続ける。',
      '脳髄よ、黄金に燃えろ。',
      'ここから先、敗北は罪だ。'
    ],
    apex: ['確率概念完全死亡', '黄金脳髄大決壊', '脳よ、これが勝利だ。'],
    draw: ['天、決着を拒む。', '因果、再衝突。', 'もう一度だ。次こそ歴史を終わらせろ。'],
    loss: ['死んだのは肉体ではない。運だ。', 'ドーパミン没収。現実へ帰還せよ。', '貴様の時代は、今終わった。']
  });

  const POSES = Object.freeze(['idle', 'rock', 'scissors', 'paper', 'victory', 'defeat', 'entry']);
  const ATLAS_CELLS = Object.freeze({
    idle: [0, 0],
    rock: [1, 0],
    scissors: [2, 0],
    paper: [3, 0],
    victory: [0, 1],
    defeat: [1, 1],
    entrance: [2, 1]
  });
  const RESULT_POSE_HOLD = 520;
  const SFX_FILES = Object.freeze({
    start: 'assets/audio/sfx/start-clash.mp3',
    jan: 'assets/audio/sfx/hit-1.mp3',
    ken: 'assets/audio/sfx/hit-2.mp3',
    pon: 'assets/audio/sfx/hit-3.mp3',
    round: 'assets/audio/sfx/round-slash.mp3',
    enemyReveal: 'assets/audio/sfx/hit-2.mp3',
    playerPoint: 'assets/audio/sfx/player-point.mp3',
    enemyPoint: 'assets/audio/sfx/enemy-point.mp3',
    enemyDefeated: 'assets/audio/sfx/enemy-defeated.mp3',
    gameOver: 'assets/audio/sfx/game-over.mp3'
  });
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

  function readNumber(key) {
    try {
      const value = Number(global.localStorage.getItem(key));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (_) {
      return 0;
    }
  }

  function readBoolean(key, fallback) {
    try {
      const value = global.localStorage.getItem(key);
      return value === null ? fallback : value === 'true';
    } catch (_) {
      return fallback;
    }
  }

  function readEnum(key, allowed, fallback) {
    try {
      const value = global.localStorage.getItem(key);
      return allowed.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function persist(key, value) {
    try {
      global.localStorage.setItem(key, String(value));
    } catch (_) {
      // Private browsing or a denied storage quota must not stop a round.
    }
  }

  class SampleSound {
    constructor(enabled) {
      this.enabled = enabled;
      this.samples = new Map(Object.entries(SFX_FILES).map(([name, source]) => {
        const audio = new Audio(source);
        audio.preload = 'auto';
        return [name, audio];
      }));
    }

    setEnabled(enabled) {
      this.enabled = enabled;
    }

    play(name, volume = 0.82) {
      if (!this.enabled) return;
      const source = this.samples.get(name);
      if (!source) return;
      const voice = source.cloneNode(true);
      voice.volume = Math.min(1, Math.max(0, volume));
      const playback = voice.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    }
  }

  class SynthSound {
    constructor(enabled) {
      this.enabled = enabled;
      this.context = null;
      this.master = null;
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) this.unlock();
    }

    unlock() {
      if (!this.enabled) return;
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }

    tone(frequency, duration, options = {}) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.context || !this.master) return;
      const now = this.context.currentTime + (options.delay || 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = options.type || 'sawtooth';
      oscillator.frequency.setValueAtTime(Math.max(25, frequency), now);
      if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, options.to), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(options.volume || 0.35, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
    }

    heartbeat(delay = 0) {
      this.tone(58, 0.13, { type: 'sine', volume: 0.7, to: 42, delay });
      this.tone(45, 0.16, { type: 'sine', volume: 0.45, to: 34, delay: delay + 0.16 });
    }

    charge() {
      this.tone(70, 0.65, { volume: 0.18, to: 250 });
      this.heartbeat(0.25);
    }

    reveal() {
      this.tone(150, 0.12, { type: 'square', volume: 0.25, to: 70 });
    }

    win(rush) {
      [196, 294, 392, rush ? 784 : 588].forEach((frequency, index) => {
        this.tone(frequency, 0.32, { type: index > 1 ? 'square' : 'sawtooth', volume: 0.3, delay: index * 0.075 });
      });
    }

    draw() {
      this.tone(125, 0.2, { type: 'square', volume: 0.26, to: 95 });
      this.tone(125, 0.2, { type: 'square', volume: 0.2, delay: 0.18, to: 95 });
    }

    loss() {
      this.tone(180, 0.7, { type: 'sawtooth', volume: 0.28, to: 38 });
    }

    rush() {
      [98, 147, 196, 294, 392, 588].forEach((frequency, index) => {
        this.tone(frequency, 0.45, { volume: 0.25, delay: index * 0.07, to: frequency * 1.25 });
      });
    }
  }

  class DopaGame {
    constructor() {
      this.el = {
        game: $('#game') || $('.game'),
        character: $('#enemy-character') || $('#enemy-sprite') || $('.enemy-sprite'),
        enemyName: $('#enemy-name'),
        enemyTitle: $('#enemy-title'),
        enemyQuote: $('#enemy-quote') || $('#enemy-dialogue'),
        result: $('#result-text') || $('#result-message'),
        resultBanner: $('#result-banner') || $('.result-banner'),
        resultTitle: $('#result-title') || $('.result-title'),
        round: $('#round-text') || $('#status-text'),
        playerChoice: $('#player-choice'),
        enemyChoice: $('#enemy-choice'),
        playerRoundWins: $('#player-round-wins'),
        enemyRoundWins: $('#enemy-round-wins'),
        streak: $('#streak'),
        dopa: $('#dopa'),
        bestStreak: $('#best-streak'),
        bestDopa: $('#best-dopa'),
        titleScreen: $('#title-screen'),
        start: $('#start-button'),
        titleSettings: $('#title-settings-button'),
        debugSettings: $('#debug-settings'),
        debugClose: $('#debug-settings-close'),
        difficulty: $('#difficulty-select'),
        forceWin: $('#force-win-toggle'),
        endingScreen: $('#ending-screen'),
        endingReturn: $('#ending-return'),
        endingStreak: $('#ending-streak'),
        endingDopa: $('#ending-dopa'),
        roundCutin: $('#round-cutin'),
        roundNumber: $('#round-number'),
        chant: $('#chant-overlay'),
        chantImage: $('#chant-image'),
        sound: $('#sound-toggle') || $('#sound-btn'),
        shake: $('#shake-toggle') || $('#shake-btn') || $('#motion-btn'),
        rush: $('#rush-emblem'),
        entry: $('#entry-cut') || $('#enemy-intro') || $('.intro-cutin'),
        entryTitle: $('#entry-title') || $('.intro-kicker'),
        entryName: $('#entry-name') || $('.intro-name'),
        entryQuote: $('#entry-quote') || $('.intro-quote'),
        particleLayer: $('#particle-layer'),
        flash: $('#screen-flash'),
        bgm: $('#bgm')
      };
      this.buttons = $$('[data-choice]');
      this.state = 'boot';
      this.streak = 0;
      this.dopa = 0;
      this.playerRoundWins = 0;
      this.enemyRoundWins = 0;
      this.roundNumber = 1;
      this.bestStreak = readNumber(STORAGE.bestStreak);
      this.bestDopa = readNumber(STORAGE.bestDopa);
      this.soundEnabled = readBoolean(STORAGE.sound, true);
      this.reduceShake = readBoolean(STORAGE.reduceShake, false);
      this.difficulty = readEnum(STORAGE.difficulty, ['easy', 'normal', 'hard'], 'normal');
      this.forceWin = readBoolean(STORAGE.forceWin, false);
      this.characterIndex = 0;
      this.defeatedCount = 0;
      this.roundSerial = 0;
      this.timers = new Set();
      this.atlasImages = new Map();
      this.currentPose = 'idle';
      this.audio = new SynthSound(this.soundEnabled);
      this.sfx = new SampleSound(this.soundEnabled);
    }

    init() {
      if (!this.el.game || !this.buttons.length) return;
      this.ensureParticleLayer();
      this.bindEvents();
      this.applySettings();
      this.updateStats(false);
      this.updateMatchScore();
      this.setResult('', '');
      this.setPose('idle');
      this.updateCharacterText();
      this.showTitleScreen();
    }

    ensureParticleLayer() {
      const layer = this.el.particleLayer || document.createElement('div');
      if (!this.el.particleLayer) {
        layer.id = 'particle-layer';
        layer.className = 'particle-layer';
        layer.setAttribute('aria-hidden', 'true');
      }
      Object.assign(layer.style, {
        position: 'absolute',
        zIndex: '75',
        inset: '0',
        overflow: 'hidden',
        pointerEvents: 'none'
      });
      if (!this.el.particleLayer) this.el.game.appendChild(layer);
      this.el.particleLayer = layer;
    }

    bindEvents() {
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.choose(button.dataset.choice));
      });
      if (this.el.start) this.el.start.addEventListener('click', () => this.startCampaign());
      if (this.el.titleSettings) this.el.titleSettings.addEventListener('click', () => this.openDebugSettings());
      if (this.el.debugClose) this.el.debugClose.addEventListener('click', () => this.closeDebugSettings());
      if (this.el.difficulty) this.el.difficulty.addEventListener('change', () => this.saveDebugSettings());
      if (this.el.forceWin) this.el.forceWin.addEventListener('change', () => this.saveDebugSettings());
      if (this.el.endingReturn) this.el.endingReturn.addEventListener('click', () => this.showTitleScreen());
      if (this.el.sound) this.el.sound.addEventListener('click', () => this.toggleSound());
      if (this.el.shake) this.el.shake.addEventListener('click', () => this.toggleShake());
      document.addEventListener('keydown', (event) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        const choice = { '1': 'rock', '2': 'scissors', '3': 'paper' }[event.key];
        if (choice) {
          event.preventDefault();
          this.choose(choice);
        }
      });
      document.addEventListener('pointerdown', () => {
        this.audio.unlock();
        this.playBgm();
      }, { once: true, passive: true });
      global.addEventListener('resize', () => {
        const character = this.currentCharacter();
        if (character) this.drawCharacterPose(character.atlas, this.currentPose);
      }, { passive: true });
    }

    later(callback, delay) {
      const timer = global.setTimeout(() => {
        this.timers.delete(timer);
        callback();
      }, delay);
      this.timers.add(timer);
      return timer;
    }

    setState(state) {
      this.state = state;
      if (this.el.game) {
        this.el.game.dataset.state = state;
        ['title', 'entry', 'round', 'charging', 'revealing', 'result', 'defeat', 'ending'].forEach((knownState) => {
          this.el.game.classList.toggle(`is-${knownState}`, knownState === state);
          this.el.game.classList.toggle(knownState, knownState === state);
        });
      }
      document.body.classList.toggle('defeat', state === 'defeat');
      const locked = state !== 'ready';
      this.buttons.forEach((button) => {
        button.disabled = locked;
        button.setAttribute('aria-disabled', String(locked));
      });
    }

    setPose(pose) {
      const character = CHARACTERS[this.characterIndex];
      if (!this.el.character || !character) return;
      this.el.character.dataset.character = character.id;
      this.el.character.style.setProperty('--character-image', `url("${character.atlas}")`);
      const cssPose = pose === 'entry' ? 'entrance' : pose;
      this.currentPose = cssPose;
      this.el.character.dataset.pose = cssPose;
      POSES.forEach((knownPose) => this.el.character.classList.remove(`pose--${knownPose}`));
      ['pose-idle', 'pose-rock', 'pose-scissors', 'pose-paper', 'pose-victory', 'pose-defeat', 'pose-entrance'].forEach((className) => {
        this.el.character.classList.remove(className);
      });
      CHARACTERS.forEach((knownCharacter) => this.el.character.classList.remove(`character--${knownCharacter.id}`));
      this.el.character.classList.add(`character--${character.id}`, `pose--${pose}`, `pose-${cssPose}`);
      this.drawCharacterPose(character.atlas, cssPose);
    }

    drawCharacterPose(atlasPath, pose) {
      const canvas = this.el.character;
      if (!canvas || canvas.tagName !== 'CANVAS' || !ATLAS_CELLS[pose]) return;
      const source = atlasPath.replace(/^\.\.\//, '');
      let image = this.atlasImages.get(source);
      if (!image) {
        image = new Image();
        this.atlasImages.set(source, image);
        image.addEventListener('load', () => this.drawCharacterPose(atlasPath, this.currentPose), { once: true });
        image.src = source;
        return;
      }
      if (!image.complete || !image.naturalWidth) return;

      const stage = canvas.parentElement;
      const stageRect = stage ? stage.getBoundingClientRect() : canvas.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) {
        global.requestAnimationFrame(() => this.drawCharacterPose(atlasPath, pose));
        return;
      }
      Object.assign(canvas.style, {
        position: 'absolute',
        top: '0px',
        right: 'auto',
        bottom: 'auto',
        left: '0px',
        width: `${stageRect.width}px`,
        height: `${stageRect.height}px`,
        maxWidth: 'none',
        margin: '0px',
        background: 'none',
        transformOrigin: '50% 50%'
      });
      const rect = { width: stageRect.width, height: stageRect.height };
      const ratio = Math.min(2, Math.max(1, global.devicePixelRatio || 1));
      const pixelWidth = Math.round(rect.width * ratio);
      const pixelHeight = Math.round(rect.height * ratio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const [column, row] = ATLAS_CELLS[pose];
      const fighterSize = Math.min(rect.width * 1.12, 600, global.innerHeight * 0.72);
      const drawX = (rect.width - fighterSize) / 2;
      const drawY = rect.height - fighterSize + 18;
      context.drawImage(
        image,
        column * 800, row * 800, 800, 800,
        drawX, drawY, fighterSize, fighterSize
      );
    }

    setText(element, value) {
      if (element) element.textContent = value;
    }

    currentCharacter() {
      return CHARACTERS[this.characterIndex];
    }

    updateCharacterText() {
      const character = this.currentCharacter();
      this.setText(this.el.enemyName, character.name);
      this.setText(this.el.enemyTitle, character.title);
      this.setText(this.el.enemyQuote, randomItem(character.idle));
    }

    clearTimers() {
      this.timers.forEach((timer) => global.clearTimeout(timer));
      this.timers.clear();
    }

    openDebugSettings() {
      if (!this.el.debugSettings) return;
      if (this.el.difficulty) this.el.difficulty.value = this.difficulty;
      if (this.el.forceWin) this.el.forceWin.checked = this.forceWin;
      this.el.debugSettings.hidden = false;
      if (this.el.debugClose) this.el.debugClose.focus({ preventScroll: true });
    }

    closeDebugSettings() {
      this.saveDebugSettings();
      if (this.el.debugSettings) this.el.debugSettings.hidden = true;
      if (this.el.titleSettings) this.el.titleSettings.focus({ preventScroll: true });
    }

    saveDebugSettings() {
      if (this.el.difficulty) this.difficulty = this.el.difficulty.value;
      if (this.el.forceWin) this.forceWin = this.el.forceWin.checked;
      persist(STORAGE.difficulty, this.difficulty);
      persist(STORAGE.forceWin, this.forceWin);
      if (this.el.game) {
        this.el.game.dataset.difficulty = this.difficulty;
        this.el.game.dataset.forceWin = String(this.forceWin);
      }
    }

    selectEnemyHand(playerHand, rng = Math.random) {
      const losingHand = WINS_AGAINST[playerHand];
      const winningHand = HANDS.find((hand) => WINS_AGAINST[hand] === playerHand);
      if (this.forceWin) return losingHand;
      const biasRoll = rng();
      if (this.difficulty === 'easy' && biasRoll < 0.46) return losingHand;
      if (this.difficulty === 'hard' && biasRoll < 0.46) return winningHand;
      return GameRules.randomHand(rng);
    }

    showTitleScreen() {
      this.clearTimers();
      this.roundSerial += 1;
      this.setState('title');
      this.characterIndex = 0;
      this.defeatedCount = 0;
      this.roundNumber = 1;
      this.resetMatchScore();
      this.el.game.classList.remove(
        'result--win', 'result--draw', 'result--loss',
        'result-win', 'result-draw', 'result-lose', 'is-shattering', 'is-entering'
      );
      this.hideChant();
      if (this.el.entry) this.el.entry.hidden = true;
      if (this.el.roundCutin) this.el.roundCutin.hidden = true;
      if (this.el.titleScreen) this.el.titleScreen.hidden = false;
      if (this.el.endingScreen) this.el.endingScreen.hidden = true;
      if (this.el.debugSettings) this.el.debugSettings.hidden = true;
      this.buttons.forEach((button) => button.classList.remove('is-selected'));
      this.setPose('idle');
      this.updateCharacterText();
      this.setText(this.el.playerChoice, '—');
      this.setText(this.el.enemyChoice, '—');
      this.setText(this.el.round, '三本先取');
      this.setResult('', '');
      if (this.el.start) this.el.start.blur();
    }

    startCampaign() {
      if (this.state !== 'title') return;
      this.playBgm();
      this.sfx.play('start', 0.9);
      if (this.el.titleScreen) this.el.titleScreen.hidden = true;
      if (this.el.endingScreen) this.el.endingScreen.hidden = true;
      this.characterIndex = 0;
      this.defeatedCount = 0;
      this.roundNumber = 1;
      this.resetMatchScore();
      this.showEntry(true);
    }

    showEntry(initial = false) {
      const character = this.currentCharacter();
      this.roundSerial += 1;
      const serial = this.roundSerial;
      this.setState('entry');
      this.setResult('', '');
      this.el.game.classList.remove(
        'result--win', 'result--draw', 'result--loss',
        'result-win', 'result-draw', 'result-lose', 'is-shattering'
      );
      this.setPose('entry');
      this.updateCharacterText();
      this.setText(this.el.entryTitle, character.title);
      this.setText(this.el.entryName, character.name);
      this.setText(this.el.entryQuote, character.intro);
      if (this.el.entry) {
        this.el.entry.hidden = false;
        this.el.entry.classList.remove('is-leaving');
        // Restart the CSS animation even when enemies switch quickly.
        void this.el.entry.offsetWidth;
        this.el.entry.classList.add('is-active');
      }
      this.el.game.classList.add('is-entering');
      this.setText(this.el.round, initial ? '死合、開始。' : '次なる暴虐、来襲。');
      this.audio.tone(52, 0.8, { volume: 0.25, to: 95 });
      this.later(() => {
        if (serial !== this.roundSerial) return;
        if (this.el.entry) this.el.entry.classList.add('is-leaving');
      }, 900);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        if (this.el.entry) {
          this.el.entry.hidden = true;
          this.el.entry.classList.remove('is-active', 'is-leaving');
        }
        this.el.game.classList.remove('is-entering');
        this.setPose('idle');
        this.showRoundCutin();
      }, 1300);
    }

    showRoundCutin() {
      const serial = ++this.roundSerial;
      this.setState('round');
      this.setText(this.el.roundNumber, `ROUND ${this.roundNumber}`);
      this.setText(this.el.round, `ROUND ${this.roundNumber}`);
      if (this.el.roundCutin) {
        this.el.roundCutin.hidden = false;
        this.el.roundCutin.classList.remove('is-active');
        void this.el.roundCutin.offsetWidth;
        this.el.roundCutin.classList.add('is-active');
      }
      this.sfx.play('round', 0.86);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        if (this.el.roundCutin) {
          this.el.roundCutin.hidden = true;
          this.el.roundCutin.classList.remove('is-active');
        }
        this.setText(this.el.round, GameRules.isRush(this.streak) ? 'RUSH継続　拳を選べ' : '拳を選べ');
        this.setState('ready');
      }, 680);
    }

    showChant(name) {
      const labels = { jan: 'ジャン', ken: 'ケン', pon: 'ポン' };
      if (!this.el.chant || !this.el.chantImage || !labels[name]) return;
      this.el.chantImage.src = `assets/images/ui/chant-${name}.webp`;
      this.el.chantImage.alt = labels[name];
      this.el.chant.hidden = false;
      this.el.chant.dataset.chant = name;
      this.el.chant.classList.remove('is-slamming');
      void this.el.chant.offsetWidth;
      this.el.chant.classList.add('is-slamming');
      this.sfx.play(name, name === 'pon' ? 0.92 : 0.82);
      this.shake(name === 'pon' ? 'medium' : 'light');
    }

    hideChant() {
      if (!this.el.chant) return;
      this.el.chant.hidden = true;
      this.el.chant.classList.remove('is-slamming');
    }

    choose(playerHand) {
      if (this.state !== 'ready' || !HANDS.includes(playerHand)) return;
      this.playBgm();
      const enemyHand = this.selectEnemyHand(playerHand);
      const serial = ++this.roundSerial;
      this.setState('charging');
      this.el.game.dataset.playerHand = playerHand;
      this.el.game.dataset.enemyHand = 'hidden';
      this.el.game.classList.remove(
        'result--win', 'result--draw', 'result--loss',
        'result-win', 'result-draw', 'result-lose', 'is-shattering'
      );
      this.buttons.forEach((button) => button.classList.toggle('is-selected', button.dataset.choice === playerHand));
      this.setText(this.el.playerChoice, HAND_LABELS[playerHand]);
      this.setText(this.el.enemyChoice, '？？？');
      this.setText(this.el.round, '因果圧縮中…');
      // Keep the fighter unobstructed while charging and revealing the hand.
      this.setResult('', '');
      this.audio.charge();

      this.showChant('jan');
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.showChant('ken');
      }, 420);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.showChant('pon');
      }, 840);

      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.hideChant();
        this.setState('revealing');
        this.setPose(enemyHand);
        this.el.game.dataset.enemyHand = enemyHand;
        this.setText(this.el.enemyChoice, HAND_LABELS[enemyHand]);
        this.setText(this.el.round, '開拳');
        this.sfx.play('enemyReveal', 0.86);
        this.pulse('reveal');
      }, 1320);

      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.resolve(playerHand, enemyHand, serial);
      }, 1850);
    }

    resolve(playerHand, enemyHand, serial) {
      const outcome = GameRules.outcome(playerHand, enemyHand);
      this.setState('result');
      this.el.game.classList.add(`result--${outcome}`, `result-${outcome === 'loss' ? 'lose' : outcome}`);
      if (outcome === 'win') {
        this.playerRoundWins += 1;
        this.updateMatchScore();
        if (GameRules.isMatchWon(this.playerRoundWins)) this.handleWin(serial);
        else this.handlePlayerPoint(serial);
      }
      if (outcome === 'draw') this.handleDraw(serial);
      if (outcome === 'loss') {
        this.enemyRoundWins += 1;
        this.updateMatchScore();
        if (GameRules.isMatchWon(this.enemyRoundWins)) this.handleLoss(serial);
        else this.handleEnemyPoint(serial);
      }
      this.el.game.dispatchEvent(new CustomEvent('dopa:round', {
        detail: {
          player: playerHand,
          enemy: enemyHand,
          outcome,
          playerWins: this.playerRoundWins,
          enemyWins: this.enemyRoundWins,
          streak: this.streak,
          dopa: this.dopa
        }
      }));
    }

    handlePlayerPoint(serial) {
      const remaining = GameRules.MATCH_TARGET - this.playerRoundWins;
      this.setPose('defeat');
      this.setText(this.el.enemyQuote, randomItem(this.currentCharacter().loss));
      this.setResult('', '');
      this.setText(this.el.round, `先取　${this.playerRoundWins} / ${GameRules.MATCH_TARGET}`);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.setResult(`あと${remaining}勝で敵を葬る。`, 'win', '一本');
        this.sfx.play('playerPoint', 0.92);
        this.burst(10, 'win');
        this.shake('light');
      }, RESULT_POSE_HOLD);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.roundNumber += 1;
        this.prepareNextRound(true);
      }, RESULT_POSE_HOLD + 760);
    }

    handleEnemyPoint(serial) {
      const remaining = GameRules.MATCH_TARGET - this.enemyRoundWins;
      this.setPose('victory');
      this.setText(this.el.enemyQuote, randomItem(this.currentCharacter().win));
      this.setResult('', '');
      this.setText(this.el.round, `敵先取　${this.enemyRoundWins} / ${GameRules.MATCH_TARGET}`);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.setResult(`敵はあと${remaining}勝。まだ終わらん。`, 'loss', '被弾');
        this.sfx.play('enemyPoint', 0.88);
        this.burst(8, 'loss');
        this.shake('light');
      }, RESULT_POSE_HOLD);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.roundNumber += 1;
        this.prepareNextRound(true);
      }, RESULT_POSE_HOLD + 760);
    }

    handleWin(serial) {
      this.streak += 1;
      this.defeatedCount += 1;
      const gained = GameRules.calculateDopa(this.streak);
      this.dopa += gained;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.bestDopa = Math.max(this.bestDopa, this.dopa);
      persist(STORAGE.bestStreak, this.bestStreak);
      persist(STORAGE.bestDopa, this.bestDopa);
      const rush = GameRules.isRush(this.streak);
      const enteredRush = this.streak === 10;
      this.setPose('defeat');
      this.setText(this.el.enemyQuote, randomItem(this.currentCharacter().loss));
      let line = randomItem(rush ? RESULT_LINES.rush : RESULT_LINES.win);
      if (this.streak > 0 && this.streak % 20 === 0) line = randomItem(RESULT_LINES.apex);
      this.setResult('', '');
      this.setText(this.el.round, '敵、崩落。');
      this.updateStats(true);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.setResult(line, 'win');
        this.setText(this.el.round, `勝利　DOPA +${gained.toLocaleString('ja-JP')}`);
        this.sfx.play('enemyDefeated', 0.94);
        if (enteredRush) this.audio.rush();
        this.flash(rush ? 'gold' : 'white');
        this.burst(rush ? 42 : Math.min(30, 14 + this.streak), rush ? 'rush' : 'win');
        this.shake(rush ? 'heavy' : this.streak >= 5 ? 'medium' : 'light');
        this.pulse('impact');
      }, RESULT_POSE_HOLD);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.resetMatchScore();
        this.roundNumber = 1;
        if (this.defeatedCount >= CHARACTERS.length) this.showEnding();
        else {
          this.characterIndex += 1;
          this.showEntry(false);
        }
      }, RESULT_POSE_HOLD + (rush ? 1200 : 1000));
    }

    showEnding() {
      this.roundSerial += 1;
      this.setState('ending');
      if (this.el.titleScreen) this.el.titleScreen.hidden = true;
      if (this.el.debugSettings) this.el.debugSettings.hidden = true;
      if (this.el.endingScreen) this.el.endingScreen.hidden = false;
      this.setText(this.el.endingStreak, this.streak.toLocaleString('ja-JP'));
      this.setText(this.el.endingDopa, this.dopa.toLocaleString('ja-JP'));
      this.flash('gold');
      this.burst(48, 'rush');
      this.audio.win(true);
      if (this.el.endingReturn) this.el.endingReturn.focus({ preventScroll: true });
    }

    handleDraw(serial) {
      this.setText(this.el.enemyQuote, '……同じ因果を選んだか。');
      const line = randomItem(RESULT_LINES.draw);
      this.setResult('', '');
      this.setText(this.el.round, '因果、拮抗。');
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.setResult(line, 'draw');
        this.setText(this.el.round, '相殺　連勝維持');
        this.audio.draw();
        this.burst(12, 'draw');
        this.shake('light');
      }, 360);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.prepareNextRound(false);
      }, 1120);
    }

    handleLoss(serial) {
      const shatteredStreak = this.streak;
      this.setPose('victory');
      this.setText(this.el.enemyQuote, randomItem(this.currentCharacter().win));
      const line = randomItem(RESULT_LINES.loss);
      this.setResult('', '');
      this.setText(this.el.round, '敵、勝鬨。');
      if (this.el.streak) this.el.streak.dataset.shatteredValue = String(shatteredStreak);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.setResult(line, 'loss');
        this.setText(this.el.round, shatteredStreak > 0 ? `${shatteredStreak}連勝、粉砕。` : '敗北');
        this.el.game.classList.add('is-shattering');
        this.sfx.play('gameOver', 0.94);
        this.burst(Math.min(24, 9 + shatteredStreak), 'loss');
        this.flash('red');
      }, RESULT_POSE_HOLD);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.streak = 0;
        this.updateStats(true);
        this.el.game.classList.remove('is-rush');
        this.setState('defeat');
      }, RESULT_POSE_HOLD + 940);
      this.later(() => {
        if (serial !== this.roundSerial) return;
        this.showTitleScreen();
      }, RESULT_POSE_HOLD + 1780);
    }

    updateMatchScore() {
      this.setText(this.el.playerRoundWins, String(this.playerRoundWins));
      this.setText(this.el.enemyRoundWins, String(this.enemyRoundWins));
      if (this.el.game) {
        this.el.game.dataset.playerWins = String(this.playerRoundWins);
        this.el.game.dataset.enemyWins = String(this.enemyRoundWins);
      }
    }

    resetMatchScore() {
      this.playerRoundWins = 0;
      this.enemyRoundWins = 0;
      this.updateMatchScore();
    }

    prepareNextRound(showRound = false) {
      this.buttons.forEach((button) => button.classList.remove('is-selected'));
      this.el.game.classList.remove(
        'result--win', 'result--draw', 'result--loss',
        'result-win', 'result-draw', 'result-lose'
      );
      this.setPose('idle');
      this.setText(this.el.enemyQuote, randomItem(this.currentCharacter().idle));
      this.setText(this.el.playerChoice, '—');
      this.setText(this.el.enemyChoice, '—');
      this.setText(this.el.round, GameRules.isRush(this.streak) ? 'RUSH継続　拳を選べ' : '拳を選べ');
      this.setResult('', '');
      if (showRound) this.showRoundCutin();
      else this.setState('ready');
    }

    updateStats(animate) {
      this.setText(this.el.streak, String(this.streak));
      this.setText(this.el.dopa, this.dopa.toLocaleString('ja-JP'));
      this.setText(this.el.bestStreak, String(this.bestStreak));
      this.setText(this.el.bestDopa, this.bestDopa.toLocaleString('ja-JP'));
      const rush = GameRules.isRush(this.streak);
      this.el.game.classList.toggle('is-rush', rush);
      this.el.game.classList.toggle('rush', rush);
      document.body.classList.toggle('rush', rush);
      if (this.el.rush) {
        this.el.rush.hidden = !rush;
        this.el.rush.classList.toggle('is-active', rush);
      }
      if (animate) {
        [this.el.streak, this.el.dopa].forEach((element) => {
          if (!element) return;
          element.classList.remove('is-popping');
          void element.offsetWidth;
          element.classList.add('is-popping');
        });
      }
    }

    setResult(text, kind, titleOverride = '') {
      this.setText(this.el.result, text);
      const resultTitle = titleOverride || { win: '勝利', draw: '相殺', loss: '敗北', charging: '勝負' }[kind] || '';
      this.setText(this.el.resultTitle, resultTitle);
      if (this.el.resultBanner) {
        this.el.resultBanner.hidden = !text;
        this.el.resultBanner.classList.remove('win', 'draw', 'lose', 'is-win', 'is-draw', 'is-lose');
        if (kind && kind !== 'charging') {
          const cssKind = kind === 'loss' ? 'lose' : kind;
          this.el.resultBanner.classList.add(cssKind, `is-${cssKind}`);
        }
      }
      if (this.el.result) {
        this.el.result.dataset.result = kind;
        this.el.result.classList.remove('is-active');
        if (text) {
          void this.el.result.offsetWidth;
          this.el.result.classList.add('is-active');
        }
      }
    }

    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      persist(STORAGE.sound, this.soundEnabled);
      this.audio.setEnabled(this.soundEnabled);
      this.sfx.setEnabled(this.soundEnabled);
      this.applySettings();
      if (this.soundEnabled) {
        this.playBgm();
        this.audio.tone(440, 0.12, { type: 'sine', volume: 0.2, to: 660 });
      } else if (this.el.bgm) {
        this.el.bgm.pause();
      }
    }

    playBgm() {
      if (!this.el.bgm) return;
      this.el.bgm.loop = true;
      this.el.bgm.volume = 0.34;
      if (!this.soundEnabled) {
        this.el.bgm.pause();
        return;
      }
      const playback = this.el.bgm.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    }

    toggleShake() {
      this.reduceShake = !this.reduceShake;
      persist(STORAGE.reduceShake, this.reduceShake);
      this.applySettings();
    }

    applySettings() {
      this.el.game.classList.toggle('is-muted', !this.soundEnabled);
      this.el.game.classList.toggle('reduce-shake', this.reduceShake);
      document.documentElement.classList.toggle('reduce-shake', this.reduceShake);
      document.body.classList.toggle('reduce-shake', this.reduceShake);
      if (this.el.bgm) {
        this.el.bgm.volume = 0.34;
        if (!this.soundEnabled) this.el.bgm.pause();
      }
      if (this.el.difficulty) this.el.difficulty.value = this.difficulty;
      if (this.el.forceWin) this.el.forceWin.checked = this.forceWin;
      this.saveDebugSettings();
      this.updateToggle(this.el.sound, this.soundEnabled, this.soundEnabled ? '音量 ON' : '音量 OFF');
      this.updateToggle(this.el.shake, this.reduceShake, this.reduceShake ? '揺れ 軽減' : '揺れ 標準');
    }

    updateToggle(element, pressed, label) {
      if (!element) return;
      element.setAttribute('aria-pressed', String(pressed));
      element.dataset.enabled = String(pressed);
      const labelElement = $('[data-setting-label]', element);
      if (labelElement) labelElement.textContent = label;
      else if (element.dataset.autoLabel === 'true') element.textContent = label;
      element.setAttribute('aria-label', label);
    }

    flash(color) {
      const temporary = !this.el.flash;
      const target = this.el.flash || document.createElement('div');
      if (temporary) {
        target.className = 'screen-flash';
        target.setAttribute('aria-hidden', 'true');
        this.el.game.appendChild(target);
      }
      target.hidden = false;
      target.style.background = color === 'red'
        ? 'radial-gradient(circle, rgba(255,230,210,.96), rgba(255,25,8,.62) 35%, transparent 72%)'
        : color === 'gold'
          ? 'radial-gradient(circle, #fff, rgba(255,210,55,.82) 34%, transparent 74%)'
          : 'radial-gradient(circle, #fff, rgba(255,255,235,.76) 30%, transparent 72%)';
      target.classList.remove('flash--white', 'flash--gold', 'flash--red');
      void target.offsetWidth;
      target.classList.add(`flash--${color}`);
      if (typeof target.animate === 'function') {
        target.animate(
          [{ opacity: 0 }, { opacity: 0.92, offset: 0.12 }, { opacity: 0 }],
          { duration: 420, easing: 'ease-out' }
        );
      }
      this.later(() => {
        target.classList.remove(`flash--${color}`);
        target.hidden = true;
        if (temporary) target.remove();
      }, 480);
    }

    shake(strength) {
      if (this.reduceShake) return;
      const className = `shake--${strength}`;
      this.el.game.classList.remove('shake--light', 'shake--medium', 'shake--heavy');
      this.el.game.classList.remove('shake', 'shake-hard');
      void this.el.game.offsetWidth;
      this.el.game.classList.add(className, strength === 'light' ? 'shake' : 'shake-hard');
      this.later(() => {
        this.el.game.classList.remove(className, 'shake', 'shake-hard');
      }, strength === 'heavy' ? 620 : 400);
    }

    pulse(kind) {
      const className = `pulse--${kind}`;
      this.el.game.classList.remove(className);
      void this.el.game.offsetWidth;
      this.el.game.classList.add(className);
      const wave = document.createElement('i');
      wave.className = 'shockwave';
      wave.setAttribute('aria-hidden', 'true');
      if (kind === 'reveal') wave.style.setProperty('--gold-hot', '#fff');
      this.el.game.appendChild(wave);
      this.later(() => this.el.game.classList.remove(className), 550);
      this.later(() => wave.remove(), 700);
    }

    burst(count, kind) {
      const layer = this.el.particleLayer;
      if (!layer) return;
      const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const total = reduced || this.reduceShake ? Math.min(count, 8) : count;
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < total; index += 1) {
        const particle = document.createElement('i');
        const angle = Math.random() * Math.PI * 2;
        const distance = 45 + Math.random() * 145;
        particle.className = `fx-particle fx-particle--${kind}`;
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
        particle.style.setProperty('--delay', `${Math.random() * 90}ms`);
        particle.style.setProperty('--size', `${3 + Math.random() * 7}px`);
        particle.style.position = 'absolute';
        particle.style.zIndex = '1';
        particle.style.left = `${45 + Math.random() * 10}%`;
        particle.style.top = `${36 + Math.random() * 18}%`;
        particle.style.width = 'var(--size)';
        particle.style.height = kind === 'rush' ? 'calc(var(--size) * 2.4)' : 'var(--size)';
        particle.style.borderRadius = kind === 'draw' ? '50%' : '1px';
        particle.style.background = kind === 'loss'
          ? '#981b16'
          : kind === 'draw' ? '#ff3028' : index % 3 === 0 ? '#fffbd0' : index % 3 === 1 ? '#ffb51b' : '#ff3a12';
        particle.style.boxShadow = `0 0 7px ${kind === 'draw' ? '#ff1208' : '#ff9c17'}`;
        particle.style.pointerEvents = 'none';
        fragment.appendChild(particle);
        this.later(() => {
          if (typeof particle.animate === 'function') {
            particle.animate(
              [
                { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
                { transform: 'translate(var(--dx), var(--dy)) rotate(var(--spin)) scale(.2)', opacity: 0 }
              ],
              { duration: 760 + Math.random() * 260, delay: Math.random() * 90, easing: 'cubic-bezier(.1,.7,.2,1)', fill: 'forwards' }
            );
          }
        }, 0);
        this.later(() => particle.remove(), 1200);
      }
      layer.appendChild(fragment);
    }
  }

  function boot() {
    const game = new DopaGame();
    game.init();
    // Useful for smoke tests and harmless to leave available for devtools QA.
    global.DopaJanken = game;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
