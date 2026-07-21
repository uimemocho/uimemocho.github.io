(() => {
  const ROWS = 7;
  const COLS = 7;
  const OIL_VALUE = 25;
  const START_MOVES = 30;
  const COLORS = [
    { id: "red", name: "赤" },
    { id: "blue", name: "青" },
    { id: "yellow", name: "黄" },
    { id: "green", name: "緑" },
    { id: "purple", name: "紫" },
  ];
  const PARTICLE_COLORS = {
    red: ["#ff5647", "#ffafa6", "#b91f1a"],
    blue: ["#27a7ff", "#9bddff", "#0751a0"],
    yellow: ["#ffd84a", "#fff0a3", "#c87f00"],
    green: ["#5be04a", "#b5ff9d", "#237915"],
    purple: ["#aa55ff", "#dfb4ff", "#5a20a0"],
    special: ["#fff1a3", "#ffffff", "#ff8b1f"],
  };
  const TARGETS = [
    { id: "nori", label: "ターゲット2", name: "のりしお" },
    { id: "salt", label: "ターゲット1", name: "うすしお" },
    { id: "consomme", label: "ターゲット3", name: "コンソメ" },
  ];
  const TARGET_POSITIONS = [
    { id: "left", label: "左", slot: 1 },
    { id: "center", label: "中央", slot: 2 },
    { id: "right", label: "右", slot: 3 },
  ];
  const DARK_SKILLS = {
    none: { label: "なし", status: "" },
    randomMono: { label: "ランダム", status: "ランダムピースをモノクロ化" },
    boardMono: { label: "全体", status: "全ピースをモノクロ化" },
  };
  const DEFAULT_TARGET_SETTINGS = {
    nori: {
      position: "left",
      aura: true,
      skills: [
        { type: "randomMono", charge: 3, duration: 2 },
        { type: "none", charge: 3, duration: 2 },
      ],
    },
    salt: {
      position: "center",
      aura: false,
      skills: [
        { type: "boardMono", charge: 4, duration: 1 },
        { type: "none", charge: 3, duration: 2 },
      ],
    },
    consomme: {
      position: "right",
      aura: false,
      skills: [
        { type: "randomMono", charge: 3, duration: 2 },
        { type: "boardMono", charge: 5, duration: 1 },
      ],
    },
  };
  const RANDOM_DARK_COUNT = 7;
  const BOOSTER_LABELS = {
    rocket: "ロケット",
    anchor: "アンカー",
    radar: "レーダー",
    bomb: "爆弾",
  };

  const boardEl = document.querySelector("#board");
  const targetsEl = document.querySelector("#targets");
  const moveCountEl = document.querySelector("#moveCount");
  const scoreTextEl = document.querySelector("#scoreText");
  const statusTextEl = document.querySelector("#statusText");
  const settingsButton = document.querySelector("#settingsButton");
  const titleSettingsButton = document.querySelector("#titleSettingsButton");
  const settingsModal = document.querySelector("#settingsModal");
  const closeSettingsButton = document.querySelector("#closeSettingsButton");
  const settingsResetButton = document.querySelector("#settingsResetButton");
  const settingsSoundButton = document.querySelector("#settingsSoundButton");
  const settingsTitleButton = document.querySelector("#settingsTitleButton");
  const targetSettingsEl = document.querySelector("#targetSettings");
  const moveLimitInput = document.querySelector("#moveLimitInput");
  const resultModal = document.querySelector("#resultModal");
  const resultPackages = document.querySelector("#resultPackages");
  const modalKicker = document.querySelector("#modalKicker");
  const modalTitle = document.querySelector("#modalTitle");
  const modalMessage = document.querySelector("#modalMessage");
  const playAgainButton = document.querySelector("#playAgainButton");
  const resultTitleButton = document.querySelector("#resultTitleButton");
  const fxLayer = document.querySelector("#fxLayer");
  const titleScreen = document.querySelector("#titleScreen");
  const titleStartButton = document.querySelector("#titleStartButton");

  const cells = [];
  let nextPieceId = 1;
  const audio = {
    enabled: true,
    ctx: null,
    master: null,
    sfx: null,
    bgm: null,
  };

  const state = {
    board: [],
    selected: null,
    selectedBooster: null,
    locked: false,
    clearing: new Set(),
    moves: START_MOVES,
    moveLimit: START_MOVES,
    score: 0,
    combo: 0,
    turn: 0,
    targetCount: 3,
    targets: TARGETS.map((target) => ({ ...target, progress: 0 })),
    targetSettings: cloneTargetSettings(),
    skillCooldowns: {},
    boardDarkTurns: 0,
    boosters: {
      rocket: 3,
      anchor: 3,
      radar: 3,
      bomb: 3,
    },
  };

  function boot() {
    createBoardCells();
    bindEvents();
    newGame();
  }

  function bindEvents() {
    titleStartButton?.addEventListener("click", startFromTitle);
    titleSettingsButton?.addEventListener("click", () => {
      playSfx("ui");
      openSettings();
    });
    settingsSoundButton?.addEventListener("click", toggleSound);
    settingsButton.addEventListener("click", () => {
      playSfx("ui");
      openSettings();
    });
    closeSettingsButton.addEventListener("click", () => {
      playSfx("ui");
      closeSettings();
    });
    settingsResetButton.addEventListener("click", () => {
      playSfx("start");
      closeSettings();
      newGame();
    });
    settingsTitleButton?.addEventListener("click", returnToTitle);
    settingsModal.addEventListener("click", (event) => {
      if (event.target === settingsModal) {
        closeSettings();
      }
    });
    document.querySelectorAll("[data-target-count]").forEach((button) => {
      button.addEventListener("click", () => {
        playSfx("ui");
        state.targetCount = Number(button.dataset.targetCount);
        normalizeTargetPositions();
        updateTargetCountControls();
        renderTargetSettings();
        closeSettings();
        newGame();
      });
    });
    targetSettingsEl?.addEventListener("change", onTargetSettingChange);
    moveLimitInput?.addEventListener("change", onMoveLimitChange);
    playAgainButton.addEventListener("click", () => {
      playSfx("start");
      newGame();
    });
    resultTitleButton?.addEventListener("click", returnToTitle);
    boardEl.addEventListener("pointerdown", onPointerDown);
    boardEl.addEventListener("pointermove", onPointerMove);
    boardEl.addEventListener("pointerup", onPointerUp);
    boardEl.addEventListener("pointercancel", cancelDrag);
    boardEl.addEventListener("dragstart", (event) => event.preventDefault());
    document.addEventListener("dragstart", (event) => {
      if (event.target?.tagName === "IMG") {
        event.preventDefault();
      }
    });
    document.querySelectorAll(".booster").forEach((button) => {
      button.addEventListener("click", () => selectBooster(button.dataset.booster));
    });
    updateSoundButton();
  }

  async function startFromTitle() {
    titleScreen?.classList.add("is-leaving");
    window.setTimeout(() => titleScreen?.classList.add("is-hidden"), 520);
    await startAudio();
    playSfx("start");
  }

  async function toggleSound() {
    audio.enabled = !audio.enabled;
    updateSoundButton();
    if (!audio.enabled) {
      stopBgm();
      return;
    }
    await startAudio();
    playSfx("ui");
  }

  function updateSoundButton() {
    if (!settingsSoundButton) return;
    settingsSoundButton.classList.toggle("is-muted", !audio.enabled);
    settingsSoundButton.setAttribute("aria-pressed", String(audio.enabled));
    settingsSoundButton.textContent = audio.enabled ? "サウンド ON" : "サウンド OFF";
  }

  function returnToTitle() {
    playSfx("ui");
    closeSettings();
    newGame();
    titleScreen?.classList.remove("is-hidden", "is-leaving");
  }

  function ensureAudio() {
    if (!audio.enabled) return null;
    if (!audio.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio.ctx = new AudioContext();
      audio.master = audio.ctx.createGain();
      audio.sfx = audio.ctx.createGain();
      audio.master.gain.value = 0.78;
      audio.sfx.gain.value = 0.56;
      audio.sfx.connect(audio.master);
      audio.master.connect(audio.ctx.destination);
    }
    return audio.ctx;
  }

  async function startAudio() {
    if (!audio.enabled) return;
    const ctx = ensureAudio();
    if (ctx?.state === "suspended") {
      await ctx.resume();
    }
    await startBgm();
  }

  function stopBgm() {
    if (audio.bgm) {
      audio.bgm.pause();
    }
  }

  function ensureBgmElement() {
    if (!audio.bgm) {
      audio.bgm = document.querySelector("#embeddedBgm");
      audio.bgm.volume = 0.58;
    }
    return audio.bgm;
  }

  async function startBgm() {
    if (!audio.enabled) return;
    const bgm = ensureBgmElement();
    if (!bgm.paused) return;
    try {
      await bgm.play();
    } catch {
      // Browser autoplay rules can still reject playback outside a user gesture.
    }
  }

  function playSfx(type) {
    if (!audio.enabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") return;

    if (type === "ui") {
      playMetalClang(0, 0.48);
      return;
    }
    if (type === "start") {
      playHardHit(0, 0.76);
      playMetalClang(0.035, 0.72);
      playArp([196, 294, 392, 587], 0.06, 0.034, "sawtooth");
      return;
    }
    if (type === "move") {
      playHardHit(0, 0.42);
      playMetalClang(0.015, 0.38);
      return;
    }
    if (type === "match") {
      playBlast(0, 0.68);
      playMetalClang(0.035, 0.54);
      return;
    }
    if (type === "oil") {
      playHardHit(0, 0.54);
      playNoise(0.18, 0.052, 420, 0.025);
      playTone(74, 0.22, "sawtooth", 0.04, 0.02);
      return;
    }
    if (type === "complete") {
      playBlast(0, 0.86);
      playArp([392, 494, 740, 988], 0.075, 0.038, "sawtooth");
      return;
    }
    if (type === "special") {
      playBlast(0, 1.08);
      playHardHit(0.08, 0.9);
      return;
    }
    if (type === "dark") {
      playTone(55, 0.48, "sawtooth", 0.07);
      playTone(82.4, 0.42, "square", 0.038, 0.035);
      playNoise(0.42, 0.054, 260, 0.02);
      playMetalClang(0.16, 0.48);
      return;
    }
    if (type === "clear") {
      playBlast(0, 0.72);
      playArp([196, 392, 587, 784, 1175], 0.105, 0.047, "sawtooth");
      playMetalClang(0.18, 0.72);
      return;
    }
    if (type === "timeup") {
      playHardHit(0, 0.92);
      playArp([196, 146.8, 98, 65.4], 0.13, 0.055, "sawtooth");
    }
  }

  function playHardHit(delay = 0, intensity = 1) {
    playTone(74, 0.14, "sawtooth", 0.09 * intensity, delay);
    playTone(48, 0.22, "square", 0.058 * intensity, delay + 0.012);
    playNoise(0.16, 0.072 * intensity, 760, delay);
    playNoise(0.06, 0.028 * intensity, 4200, delay + 0.02);
  }

  function playBlast(delay = 0, intensity = 1) {
    playHardHit(delay, intensity);
    playNoise(0.34, 0.078 * intensity, 250, delay + 0.015);
    playNoise(0.12, 0.048 * intensity, 2800, delay + 0.035);
    playTone(112, 0.24, "sawtooth", 0.052 * intensity, delay + 0.03);
  }

  function playMetalClang(delay = 0, intensity = 1) {
    [1180, 1670, 2380].forEach((note, index) => {
      playTone(note, 0.12 + index * 0.015, index % 2 ? "square" : "triangle", 0.018 * intensity, delay + index * 0.012);
    });
  }

  function playArp(notes, duration, gain, type) {
    notes.forEach((note, index) => playTone(note, duration, type, gain, index * duration * 0.72));
  }

  function playTone(frequency, duration, type = "sine", gainValue = 0.05, delay = 0, destination = audio.sfx) {
    const ctx = audio.ctx;
    if (!ctx || !destination) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playNoise(duration = 0.1, gainValue = 0.04, frequency = 2600, delay = 0, destination = audio.sfx) {
    const ctx = audio.ctx;
    if (!ctx || !destination) return;
    const start = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = 1.8;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function renderTargets() {
    normalizeTargetPositions();
    const visibleTargets = state.targets
      .map((target, index) => ({ target, index, settings: targetSettings(target.id) }))
      .sort((a, b) => targetSlot(a.settings.position) - targetSlot(b.settings.position));
    targetsEl.style.setProperty("--target-count", String(Math.max(1, visibleTargets.length)));
    targetsEl.style.setProperty(
      "--target-layout-width",
      visibleTargets.length === 1 ? "33.5%" : visibleTargets.length === 2 ? "68%" : "100%"
    );
    targetsEl.innerHTML = visibleTargets
      .map(
        ({ target, index }, visualIndex) => {
          return `
          <article class="target-card" data-target="${index}" data-target-id="${target.id}" style="--target-slot: ${visualIndex + 1}; --target-breathe-delay: ${visualIndex * -0.62}s;">
            <div class="package-stage">
              ${packageMarkup(target, 0)}
            </div>
            <div class="oil-meter" aria-label="${target.label}の原油ゲージ">
              <span class="meter-drum">
                <img src="image/oil-barrel.webp" alt="" aria-hidden="true" draggable="false" />
              </span>
              <span class="meter-track"><i></i><em class="meter-check" aria-hidden="true">✓</em></span>
            </div>
          </article>
        `;
        }
      )
      .join("");
  }

  function cloneTargetSettings() {
    return TARGETS.reduce((settings, target) => {
      settings[target.id] = normalizeTargetSettingObject(target.id, DEFAULT_TARGET_SETTINGS[target.id]);
      return settings;
    }, {});
  }

  function targetSettings(targetId) {
    if (!state.targetSettings[targetId]) {
      state.targetSettings[targetId] = normalizeTargetSettingObject(targetId, DEFAULT_TARGET_SETTINGS[targetId]);
      return state.targetSettings[targetId];
    }
    state.targetSettings[targetId] = normalizeTargetSettingObject(targetId, state.targetSettings[targetId]);
    return state.targetSettings[targetId];
  }

  function normalizeTargetSettingObject(targetId, source = {}) {
    const fallback = DEFAULT_TARGET_SETTINGS[targetId] ?? {
      position: "center",
      aura: false,
      skills: [],
    };
    const fallbackPosition = fallback.position ?? "center";
    const position = TARGET_POSITIONS.some((item) => item.id === source.position)
      ? source.position
      : fallbackPosition;
    const skills = [0, 1].map((index) => normalizeSkill(source.skills?.[index] ?? fallback.skills?.[index]));
    return {
      position,
      aura: Boolean(source.aura ?? fallback.aura),
      skills,
    };
  }

  function normalizeSkill(skill = {}) {
    const legacyTurns = Number(skill.turns);
    const type = DARK_SKILLS[skill.type] ? skill.type : "none";
    return {
      type,
      charge: clamp(Number(skill.charge) || legacyTurns || 3, 1, 6),
      duration: clamp(Number(skill.duration) || legacyTurns || 1, 1, 6),
    };
  }

  function skillDuration(skill) {
    return clamp(Number(skill.duration) || Number(skill.turns) || 1, 1, 6);
  }

  function skillCharge(skill) {
    return clamp(Number(skill.charge) || 3, 1, 6);
  }

  function targetSlot(position) {
    return TARGET_POSITIONS.find((item) => item.id === position)?.slot ?? 2;
  }

  function normalizeTargetPositions() {
    const used = new Set();
    activeTargetDefinitions().forEach((target) => {
      const settings = targetSettings(target.id);
      if (!TARGET_POSITIONS.some((item) => item.id === settings.position) || used.has(settings.position)) {
        const freePosition = TARGET_POSITIONS.find((item) => !used.has(item.id));
        settings.position = freePosition?.id ?? "center";
      }
      used.add(settings.position);
    });
  }

  function setTargetPosition(targetId, nextPosition) {
    if (!TARGET_POSITIONS.some((item) => item.id === nextPosition)) return;
    const settings = targetSettings(targetId);
    const previousPosition = settings.position;
    if (previousPosition === nextPosition) return;

    const activeIds = activeTargetDefinitions().map((target) => target.id);
    const occupantId = activeIds.find(
      (activeId) => activeId !== targetId && targetSettings(activeId).position === nextPosition
    );

    settings.position = nextPosition;
    if (occupantId) {
      targetSettings(occupantId).position = previousPosition;
    }
    normalizeTargetPositions();
  }

  function packageMarkup(target, reveal) {
    return `
      <div class="package-art ${target.id}" style="--reveal: ${reveal}%;">
        <img class="package-img package-color" src="image/package-${target.id}-color.webp" alt="" aria-hidden="true" draggable="false" />
        <img class="package-img package-mono" src="image/package-${target.id}-mono.webp" alt="" aria-hidden="true" draggable="false" />
        <div class="pack-copy">
          <span class="pack-name">${target.name}</span>
          <span class="pack-sub">ポテトチップス</span>
        </div>
        <div class="chips" aria-hidden="true">
          <span class="chip"><span class="chip-dot"></span></span>
          <span class="chip"><span class="chip-dot"></span></span>
          <span class="chip"><span class="chip-dot"></span></span>
        </div>
        <span class="color-wave" aria-hidden="true"></span>
        <span class="mono-mask" aria-hidden="true"></span>
      </div>
    `;
  }

  function createBoardCells() {
    boardEl.innerHTML = "";
    cells.length = 0;
    for (let index = 0; index < ROWS * COLS; index += 1) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", "空のマス");
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function newGame() {
    nextPieceId = 1;
    state.board = Array(ROWS * COLS).fill(null);
    for (let index = 0; index < state.board.length; index += 1) {
      state.board[index] = makeSafeRandomShip(index);
    }
    state.selected = null;
    state.selectedBooster = null;
    state.locked = false;
    state.clearing = new Set();
    normalizeTargetPositions();
    state.moves = state.moveLimit;
    state.score = 0;
    state.combo = 0;
    state.turn = 0;
    state.boardDarkTurns = 0;
    state.skillCooldowns = createSkillCooldowns();
    state.targets = activeTargetDefinitions().map((target) => ({ ...target, progress: 0 }));
    state.boosters = {
      rocket: 3,
      anchor: 3,
      radar: 3,
      bomb: 3,
    };
    placeOilBarrels(3);
    resultModal.classList.add("is-hidden");
    resultModal.classList.remove("is-win");
    resultModal.classList.remove("is-timeup");
    resultPackages.innerHTML = "";
    resultModal.querySelectorAll(".result-confetti").forEach((particle) => particle.remove());
    playAgainButton.textContent = "もう一度プレイ";
    renderTargets();
    setStatus("軍艦ピースを3つ以上そろえて、原油缶を下まで落としてください。");
    updateHud();
    updateTargets();
    updateBoosters();
    updateTargetCountControls();
    updateMoveLimitControl();
    renderTargetSettings();
    renderBoard();
  }

  function activeTargetDefinitions() {
    return TARGETS.slice(0, state.targetCount);
  }

  function createSkillCooldowns() {
    const cooldowns = {};
    activeTargetDefinitions().forEach((target) => {
      targetSettings(target.id).skills.forEach((skill, skillIndex) => {
        if (skill.type === "none") return;
        cooldowns[skillCooldownKey(target.id, skillIndex)] = skillCharge(skill);
      });
    });
    return cooldowns;
  }

  function skillCooldownKey(targetId, skillIndex) {
    return `${targetId}:${skillIndex}`;
  }

  function resetSkillCooldown(targetId, skillIndex) {
    const skill = targetSettings(targetId).skills[skillIndex];
    const key = skillCooldownKey(targetId, skillIndex);
    if (!skill || skill.type === "none") {
      delete state.skillCooldowns[key];
      return;
    }
    state.skillCooldowns[key] = skillCharge(skill);
  }

  function makeShip(colorId = randomColor().id) {
    return {
      id: nextPieceId++,
      kind: "ship",
      color: colorId,
    };
  }

  function makeOil() {
    return {
      id: nextPieceId++,
      kind: "oil",
    };
  }

  function makeSpecial(type, colorId = randomColor().id) {
    return {
      id: nextPieceId++,
      kind: "special",
      special: type,
      color: colorId,
    };
  }

  function makeSafeRandomShip(index) {
    const colors = shuffle([...COLORS]);
    for (const color of colors) {
      if (!wouldCreateMatch(index, color.id)) {
        return makeShip(color.id);
      }
    }
    return makeShip(colors[0].id);
  }

  function wouldCreateMatch(index, colorId) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    let horizontal = 1;
    let vertical = 1;

    for (let c = col - 1; c >= 0 && pieceColor(state.board[toIndex(row, c)]) === colorId; c -= 1) {
      horizontal += 1;
    }
    for (let c = col + 1; c < COLS && pieceColor(state.board[toIndex(row, c)]) === colorId; c += 1) {
      horizontal += 1;
    }
    for (let r = row - 1; r >= 0 && pieceColor(state.board[toIndex(r, col)]) === colorId; r -= 1) {
      vertical += 1;
    }
    for (let r = row + 1; r < ROWS && pieceColor(state.board[toIndex(r, col)]) === colorId; r += 1) {
      vertical += 1;
    }

    return horizontal >= 3 || vertical >= 3;
  }

  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }

  function onPointerDown(event) {
    const cell = event.target.closest(".cell");
    if (!cell || state.locked) {
      return;
    }
    event.preventDefault();
    const index = Number(cell.dataset.index);
    const piece = state.board[index];
    if (!piece) {
      return;
    }
    boardEl.dataset.dragIndex = String(index);
    boardEl.dataset.dragX = String(event.clientX);
    boardEl.dataset.dragY = String(event.clientY);
    cell.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const index = Number(boardEl.dataset.dragIndex);
    if (!Number.isInteger(index) || state.locked || state.selectedBooster) {
      return;
    }
    event.preventDefault();
    const piece = state.board[index];
    if (!piece || piece.kind === "oil") {
      return;
    }
    const startX = Number(boardEl.dataset.dragX);
    const startY = Number(boardEl.dataset.dragY);
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const dragDistance = Math.hypot(dx, dy);
    const cell = cells[index];
    if (dragDistance < 5) {
      cell.classList.remove("is-dragging");
      return;
    }

    const rect = cell.getBoundingClientRect();
    const limit = Math.min(rect.width, rect.height) * 0.42;
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    let dragX = 0;
    let dragY = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
      const direction = Math.sign(dx);
      if ((direction > 0 && col < COLS - 1) || (direction < 0 && col > 0)) {
        dragX = clamp(dx, -limit, limit);
      }
    } else {
      const direction = Math.sign(dy);
      if ((direction > 0 && row < ROWS - 1) || (direction < 0 && row > 0)) {
        dragY = clamp(dy, -limit, limit);
      }
    }

    cell.style.setProperty("--drag-x", `${dragX}px`);
    cell.style.setProperty("--drag-y", `${dragY}px`);
    cell.classList.toggle("is-dragging", dragX !== 0 || dragY !== 0);
  }

  function onPointerUp(event) {
    const startIndex = Number(boardEl.dataset.dragIndex);
    if (!Number.isInteger(startIndex) || state.locked) {
      cancelDrag();
      return;
    }
    event.preventDefault();
    const startX = Number(boardEl.dataset.dragX);
    const startY = Number(boardEl.dataset.dragY);
    delete boardEl.dataset.dragIndex;
    delete boardEl.dataset.dragX;
    delete boardEl.dataset.dragY;
    cleanupDragCell(startIndex);

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const dragDistance = Math.hypot(dx, dy);
    if (dragDistance > 26) {
      const neighbor = neighborFromDrag(startIndex, dx, dy);
      if (neighbor !== null) {
        trySwap(startIndex, neighbor);
      }
      return;
    }
    handleCellTap(startIndex);
  }

  function cancelDrag() {
    const index = Number(boardEl.dataset.dragIndex);
    if (Number.isInteger(index)) {
      cleanupDragCell(index);
    }
    delete boardEl.dataset.dragIndex;
    delete boardEl.dataset.dragX;
    delete boardEl.dataset.dragY;
  }

  function cleanupDragCell(index) {
    const cell = cells[index];
    if (!cell) return;
    cell.classList.remove("is-dragging");
    cell.style.removeProperty("--drag-x");
    cell.style.removeProperty("--drag-y");
  }

  function neighborFromDrag(index, dx, dy) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && col < COLS - 1) return index + 1;
      if (dx < 0 && col > 0) return index - 1;
    } else {
      if (dy > 0 && row < ROWS - 1) return index + COLS;
      if (dy < 0 && row > 0) return index - COLS;
    }
    return null;
  }

  function handleCellTap(index) {
    if (state.locked) return;
    const piece = state.board[index];
    if (!piece) return;

    if (state.selectedBooster) {
      activateBooster(index);
      return;
    }

    if (piece.kind === "oil") {
      state.selected = null;
      setStatus("原油缶は動かせません。下のピースを消して落とします。");
      renderBoard();
      return;
    }

    if (state.selected === index) {
      if (piece.kind === "special") {
        activateSpecialPiece(index);
      } else {
        state.selected = null;
        renderBoard();
      }
      return;
    }

    if (state.selected === null) {
      state.selected = index;
      renderBoard();
      return;
    }

    if (isAdjacent(state.selected, index)) {
      trySwap(state.selected, index);
      return;
    }

    state.selected = index;
    renderBoard();
  }

  async function trySwap(firstIndex, secondIndex) {
    if (state.locked || firstIndex === secondIndex) return;
    const first = state.board[firstIndex];
    const second = state.board[secondIndex];
    if (!first || !second || first.kind === "oil" || second.kind === "oil") {
      state.selected = null;
      setStatus("原油缶はスワップできません。軍艦ピースを消して道を作ります。");
      shakeBoard();
      renderBoard();
      return;
    }

    state.locked = true;
    state.selected = null;
    await animatePieceSwap(firstIndex, secondIndex, "commit");
    swapPieces(firstIndex, secondIndex);
    renderBoard();

    const specialIndex =
      state.board[secondIndex]?.kind === "special"
        ? secondIndex
        : state.board[firstIndex]?.kind === "special"
          ? firstIndex
          : null;

    if (specialIndex !== null) {
      spendMove();
      const partner = specialIndex === firstIndex ? state.board[secondIndex] : state.board[firstIndex];
      await triggerSpecial(specialIndex, partner);
      await finishPlayerAction();
      return;
    }

    const matches = findMatches();
    if (matches.groups.length === 0) {
      setStatus("マッチしません。別のルートで原油缶を落としてください。");
      shakeBoard();
      await animatePieceSwap(firstIndex, secondIndex, "reject");
      swapPieces(firstIndex, secondIndex);
      renderBoard();
      state.locked = false;
      return;
    }

    spendMove();
    await clearMatches(matches, [firstIndex, secondIndex]);
    await finishPlayerAction();
  }

  async function activateSpecialPiece(index) {
    if (state.locked) return;
    state.locked = true;
    state.selected = null;
    spendMove();
    await triggerSpecial(index, null);
    await finishPlayerAction();
  }

  async function activateBooster(index) {
    const booster = state.selectedBooster;
    if (!booster || state.locked || state.boosters[booster] <= 0) return;
    state.locked = true;
    state.selected = null;
    state.selectedBooster = null;
    state.boosters[booster] -= 1;
    spendMove();
    updateBoosters();
    setStatus(`${BOOSTER_LABELS[booster]}を起動しました。`);
    await animateSpecialFx(booster, index);
    await clearCells(blastIndices(booster, index, state.board[index]), {
      bonus: 1.35,
      source: booster,
    });
    await finishPlayerAction();
  }

  async function finishPlayerAction() {
    let recovered = false;
    try {
      state.turn += 1;
      await settleAndResolve();
      await repairBoardGaps();
      if (!isComplete() && countOilBarrels() < 3) {
        const placedOilIds = placeOilBarrels(3 - countOilBarrels());
        renderBoard();
        await animateBoardTransition(new Map(), new Set(placedOilIds));
        await repairBoardGaps();
      }
      tickDarkEffects();
      renderBoard();
      if (!isComplete() && state.moves > 0) {
        await maybeTriggerTargetAttack();
      }
    } catch (error) {
      recovered = true;
      console.error(error);
      state.clearing = new Set();
      state.selected = null;
      state.selectedBooster = null;
      await repairBoardGaps();
      setStatus("盤面を復旧しました。続けてプレイできます。");
    }
    updateHud();
    state.locked = false;
    updateBoosters();
    renderBoard();
    if (!recovered && isComplete()) {
      showResult(true);
      return;
    }
    if (!recovered && state.moves <= 0) {
      showResult(false);
    }
  }

  function tickDarkEffects() {
    state.boardDarkTurns = Math.max(0, state.boardDarkTurns - 1);
    state.board.forEach((piece) => {
      if (!piece?.darkTurns) return;
      piece.darkTurns = Math.max(0, piece.darkTurns - 1);
      if (piece.darkTurns === 0) {
        delete piece.darkTurns;
      }
    });
  }

  async function maybeTriggerTargetAttack() {
    const readySkills = [];
    state.targets.forEach((target, index) => {
      if (target.progress >= 100) return;
      targetSettings(target.id).skills.forEach((skill, skillIndex) => {
        if (skill.type === "none") return;
        const key = skillCooldownKey(target.id, skillIndex);
        const current = Number.isFinite(state.skillCooldowns[key])
          ? state.skillCooldowns[key]
          : skillCharge(skill);
        const next = Math.max(0, current - 1);
        state.skillCooldowns[key] = next;
        if (next === 0) {
          readySkills.push({ target, index, skill, skillIndex });
        }
      });
    });

    if (readySkills.length === 0) {
      return;
    }

    const attacker = readySkills[Math.floor(Math.random() * readySkills.length)];
    state.skillCooldowns[skillCooldownKey(attacker.target.id, attacker.skillIndex)] = skillCharge(attacker.skill);
    await triggerTargetAttack(attacker.index, attacker.skill);
  }

  async function triggerTargetAttack(targetIndex, skill) {
    const target = state.targets[targetIndex];
    const definition = DARK_SKILLS[skill.type];
    if (!target || !definition) return;
    playSfx("dark");
    setStatus("世界に色は不要…全てを無彩の深淵へ！");
    await delay(620);
    setStatus("モノクローム・ディメンション！");
    animateTargetAttack(targetIndex);
    await delay(480);
    const affectedIndices = applyDarkSkill(skill);
    setStatus(`${definition.status}（${skillDuration(skill)}ターン）`);
    renderBoard();
    spawnDarkImpact(affectedIndices.length > 0 ? affectedIndices : allOccupiedIndices());
    await delay(520);
  }

  function applyDarkSkill(skill) {
    const turns = skillDuration(skill);
    if (skill.type === "boardMono") {
      state.boardDarkTurns = Math.max(state.boardDarkTurns, turns);
      return allOccupiedIndices();
    }

    if (skill.type === "randomMono") {
      const targets = shuffle(
        state.board
          .map((piece, index) => ({ piece, index }))
          .filter((item) => item.piece && item.piece.kind !== "oil")
      ).slice(0, RANDOM_DARK_COUNT);
      targets.forEach(({ piece }) => {
        piece.darkTurns = Math.max(piece.darkTurns ?? 0, turns);
      });
      return targets.map((item) => item.index);
    }

    return [];
  }

  function allOccupiedIndices() {
    return state.board
      .map((piece, index) => (piece ? index : null))
      .filter((index) => index !== null);
  }

  async function settleAndResolve() {
    let safety = 0;
    while (safety < 24) {
      safety += 1;
      await dropOilAndPieces();
      const matches = findMatches();
      if (matches.groups.length === 0) {
        await repairBoardGaps();
        state.combo = 0;
        return;
      }
      state.combo += 1;
      if (state.combo > 1) {
        showComboBadge(state.combo);
      }
      await clearMatches(matches, null);
    }
    await dropOilAndPieces();
    await repairBoardGaps();
    state.combo = 0;
  }

  async function dropOilAndPieces() {
    let keepSettling = true;
    while (keepSettling) {
      keepSettling = false;
      const beforeGravity = capturePiecePositions();
      if (applyGravity()) {
        keepSettling = true;
        renderBoard();
        await animateBoardTransition(beforeGravity);
      }

      const bottomOil = collectBottomOilIndices();
      if (bottomOil.length > 0) {
        keepSettling = true;
        for (const oilIndex of bottomOil) {
          if (state.board[oilIndex]?.kind !== "oil") continue;
          await absorbOil(oilIndex);
        }
        renderBoard();
        await delay(80);
      }
    }

    const newPieceIds = fillEmptyCells();
    if (newPieceIds.length > 0) {
      renderBoard();
      await animateBoardTransition(new Map(), new Set(newPieceIds));
    }
  }

  function applyGravity() {
    let moved = false;
    for (let col = 0; col < COLS; col += 1) {
      let writeRow = ROWS - 1;
      for (let row = ROWS - 1; row >= 0; row -= 1) {
        const readIndex = toIndex(row, col);
        const piece = state.board[readIndex];
        if (!piece) continue;
        if (row !== writeRow) {
          state.board[toIndex(writeRow, col)] = piece;
          state.board[readIndex] = null;
          moved = true;
        }
        writeRow -= 1;
      }
      for (let row = writeRow; row >= 0; row -= 1) {
        state.board[toIndex(row, col)] = null;
      }
    }
    return moved;
  }

  function fillEmptyCells() {
    const newPieceIds = [];
    for (let index = 0; index < state.board.length; index += 1) {
      if (!state.board[index]) {
        state.board[index] = makeSafeRandomShip(index);
        newPieceIds.push(state.board[index].id);
      }
    }
    return newPieceIds;
  }

  async function repairBoardGaps() {
    const beforeGravity = capturePiecePositions();
    const moved = applyGravity();
    const newPieceIds = fillEmptyCells();
    if (!moved && newPieceIds.length === 0) {
      return;
    }
    renderBoard();
    await animateBoardTransition(beforeGravity, new Set(newPieceIds));
  }

  function placeOilBarrels(count) {
    const topSlots = shuffle(Array.from({ length: COLS }, (_, col) => col));
    let placed = 0;
    const placedIds = [];
    while (topSlots.length && placed < count) {
      const col = topSlots.pop();
      const index = toIndex(0, col);
      if (state.board[index]?.kind === "oil") continue;
      state.board[index] = makeOil();
      placedIds.push(state.board[index].id);
      placed += 1;
    }
    return placedIds;
  }

  async function absorbOil(index) {
    const targetIndex = state.targets.findIndex((target) => target.progress < 100);
    if (targetIndex === -1) {
      state.board[index] = null;
      return;
    }
    const target = state.targets[targetIndex];
    const wasComplete = target.progress >= 100;
    playSfx("oil");
    spawnOilLandingBurst(index);
    await delay(120);
    await animateOilTrail(index, targetIndex);
    state.board[index] = null;
    target.progress = Math.min(100, target.progress + OIL_VALUE);
    state.score += 250;
    updateTargets();
    pulseTarget(targetIndex);
    if (!wasComplete && target.progress >= 100) {
      playSfx("complete");
      spawnTargetCompleteBurst(targetIndex);
    }
    updateHud();
    setStatus(`${state.targets[targetIndex].label}に原油を充填しました。`);
  }

  function animateOilTrail(index, targetIndex) {
    const source = cells[index].getBoundingClientRect();
    const targetCard = targetsEl.querySelector(`[data-target="${targetIndex}"] .meter-track`);
    const target = targetCard.getBoundingClientRect();
    const orb = document.createElement("span");
    orb.className = "oil-trail";
    const startX = source.left + source.width / 2;
    const startY = source.top + source.height / 2;
    const endX = target.left + target.width * 0.88;
    const endY = target.top + target.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    const curveLift = Math.min(180, Math.max(82, distance * 0.28));
    const curveSide = Math.max(-90, Math.min(90, dx * -0.12));
    const midX = startX + dx * 0.48 + curveSide;
    const midY = startY + dy * 0.42 - curveLift;
    const arc = createOilArc(startX, startY, midX, midY, endX, endY);
    fxLayer.appendChild(arc);
    orb.style.setProperty("--x0", `${startX - 15}px`);
    orb.style.setProperty("--y0", `${startY - 15}px`);
    orb.style.setProperty("--xm", `${midX - 15}px`);
    orb.style.setProperty("--ym", `${midY - 15}px`);
    orb.style.setProperty("--x1", `${endX - 15}px`);
    orb.style.setProperty("--y1", `${endY - 15}px`);
    fxLayer.appendChild(orb);
    for (let sparkIndex = 0; sparkIndex < 10; sparkIndex += 1) {
      const spark = document.createElement("span");
      spark.className = "oil-spark";
      const progress = 0.12 + sparkIndex * 0.078 + Math.random() * 0.05;
      const point = quadraticPoint(startX, startY, midX, midY, endX, endY, progress);
      const drift = 10 + Math.random() * 18;
      spark.style.setProperty("--x0", `${point.x - 5}px`);
      spark.style.setProperty("--y0", `${point.y - 5}px`);
      spark.style.setProperty("--x1", `${point.x + (Math.random() - 0.5) * drift - 5}px`);
      spark.style.setProperty("--y1", `${point.y + (Math.random() - 0.5) * drift - 5}px`);
      spark.style.setProperty("--delay", `${sparkIndex * 54}ms`);
      spark.style.setProperty("--size", `${4 + Math.random() * 6}px`);
      fxLayer.appendChild(spark);
      window.setTimeout(() => spark.remove(), 980);
    }
    return new Promise((resolve) => {
      window.setTimeout(() => {
        arc.remove();
        orb.remove();
        resolve();
      }, 820);
    });
  }

  function createOilArc(startX, startY, midX, midY, endX, endY) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const path = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
    svg.classList.add("oil-arc");
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute("preserveAspectRatio", "none");
    glow.classList.add("oil-arc-glow");
    line.classList.add("oil-arc-line");
    glow.setAttribute("d", path);
    line.setAttribute("d", path);
    glow.setAttribute("pathLength", "1");
    line.setAttribute("pathLength", "1");
    svg.append(glow, line);
    return svg;
  }

  function quadraticPoint(startX, startY, midX, midY, endX, endY, progress) {
    const inverse = 1 - progress;
    return {
      x: inverse * inverse * startX + 2 * inverse * progress * midX + progress * progress * endX,
      y: inverse * inverse * startY + 2 * inverse * progress * midY + progress * progress * endY,
    };
  }

  function animatePieceSwap(firstIndex, secondIndex, mode) {
    const firstCell = cells[firstIndex];
    const secondCell = cells[secondIndex];
    if (!firstCell || !secondCell) {
      return delay(0);
    }

    const firstRect = firstCell.getBoundingClientRect();
    const secondRect = secondCell.getBoundingClientRect();
    const dx = secondRect.left - firstRect.left;
    const dy = secondRect.top - firstRect.top;
    const className = mode === "reject" ? "is-swap-reject" : "is-swapping";

    firstCell.style.setProperty("--swap-x", `${dx}px`);
    firstCell.style.setProperty("--swap-y", `${dy}px`);
    secondCell.style.setProperty("--swap-x", `${-dx}px`);
    secondCell.style.setProperty("--swap-y", `${-dy}px`);
    firstCell.classList.add(className);
    secondCell.classList.add(className);

    return new Promise((resolve) => {
      window.setTimeout(() => {
        [firstCell, secondCell].forEach((cell) => {
          cell.classList.remove(className);
          cell.style.removeProperty("--swap-x");
          cell.style.removeProperty("--swap-y");
        });
        resolve();
      }, mode === "reject" ? 210 : 170);
    });
  }

  function capturePiecePositions() {
    const positions = new Map();
    state.board.forEach((piece, index) => {
      if (!piece) return;
      const rect = cells[index].getBoundingClientRect();
      positions.set(piece.id, { index, rect });
    });
    return positions;
  }

  function animateBoardTransition(previousPositions, enteringIds = new Set()) {
    let longest = 0;
    state.board.forEach((piece, index) => {
      if (!piece) return;
      const cell = cells[index];
      const currentRect = cell.getBoundingClientRect();
      const previous = previousPositions.get(piece.id);
      const row = Math.floor(index / COLS);
      let dx = 0;
      let dy = 0;
      let distance = 0;
      let delay = 0;

      if (previous) {
        dx = previous.rect.left - currentRect.left;
        dy = previous.rect.top - currentRect.top;
        distance = Math.abs(index - previous.index) / COLS;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      } else if (enteringIds.has(piece.id)) {
        const cellStep = currentRect.height + parseFloat(getComputedStyle(boardEl).gap || "0");
        dx = 0;
        dy = -cellStep * (row + 1.25);
        distance = row + 1;
        delay = (index % COLS) * 16;
      } else {
        return;
      }

      const duration = Math.min(420, 210 + distance * 36);
      longest = Math.max(longest, duration + delay);
      cell.style.setProperty("--drop-x", `${dx}px`);
      cell.style.setProperty("--drop-y", `${dy}px`);
      cell.style.setProperty("--drop-delay", `${delay}ms`);
      cell.style.setProperty("--drop-duration", `${duration}ms`);
      cell.classList.add("is-dropping");
    });

    if (longest === 0) return delay(0);
    return new Promise((resolve) => {
      window.setTimeout(() => {
        cells.forEach((cell) => {
          cell.classList.remove("is-dropping");
          cell.style.removeProperty("--drop-x");
          cell.style.removeProperty("--drop-y");
          cell.style.removeProperty("--drop-delay");
          cell.style.removeProperty("--drop-duration");
        });
        resolve();
      }, longest + 40);
    });
  }

  function collectBottomOilIndices() {
    const indices = [];
    for (let col = 0; col < COLS; col += 1) {
      const index = toIndex(ROWS - 1, col);
      if (state.board[index]?.kind === "oil") {
        indices.push(index);
      }
    }
    return indices;
  }

  async function clearMatches(matches, preferredIndices) {
    const plan = planSpecial(matches.groups, preferredIndices);
    const clearSet = new Set(matches.indices);

    for (const index of [...clearSet]) {
      const piece = state.board[index];
      if (piece?.kind === "special" && (!plan || plan.index !== index)) {
        blastIndices(piece.special, index, piece).forEach((blastIndex) => clearSet.add(blastIndex));
      }
    }

    await clearCells([...clearSet], { plan, bonus: Math.max(1, state.combo * 0.35 + 1) });
  }

  async function clearCells(indices, options = {}) {
    const unique = [...new Set(indices)].filter((index) => {
      const piece = state.board[index];
      return piece && piece.kind !== "oil";
    });
    if (unique.length === 0) return;

    playSfx(options.source ? "special" : "match");
    state.clearing = new Set(unique);
    renderBoard();
    animateClearPuffs(unique);
    await delay(210);
    state.clearing = new Set();

    for (const index of unique) {
      state.board[index] = null;
    }

    if (options.plan) {
      state.board[options.plan.index] = makeSpecial(options.plan.type, options.plan.color);
      setStatus(`${specialName(options.plan.type)}が生成されました。`);
    } else if (options.source) {
      setStatus(`${BOOSTER_LABELS[options.source] ?? "特殊ピース"}で大量消ししました。`);
    } else {
      setStatus("マッチ成功。原油缶の通り道を作りました。");
    }

    const multiplier = options.bonus ?? 1;
    state.score += Math.round(unique.length * 10 * multiplier);
    updateHud();
    renderBoard();
    await repairBoardGaps();
    await delay(40);
  }

  async function triggerSpecial(index, partner) {
    const piece = state.board[index];
    if (!piece || piece.kind !== "special") return;
    playSfx("special");
    setStatus(`${specialName(piece.special)}を起動しました。`);
    await animateSpecialFx(piece.special, index);
    await clearCells(blastIndices(piece.special, index, partner ?? piece), {
      bonus: 1.5,
      source: piece.special,
    });
  }

  function blastIndices(type, originIndex, partner) {
    const row = Math.floor(originIndex / COLS);
    const col = originIndex % COLS;
    const indices = new Set([originIndex]);

    if (type === "rocketH" || type === "rocket") {
      for (let c = 0; c < COLS; c += 1) indices.add(toIndex(row, c));
    } else if (type === "rocketV") {
      for (let r = 0; r < ROWS; r += 1) indices.add(toIndex(r, col));
    } else if (type === "anchor") {
      for (let c = 0; c < COLS; c += 1) indices.add(toIndex(row, c));
      for (let r = 0; r < ROWS; r += 1) indices.add(toIndex(r, col));
    } else if (type === "bomb") {
      for (let r = row - 1; r <= row + 1; r += 1) {
        for (let c = col - 1; c <= col + 1; c += 1) {
          if (isInside(r, c)) indices.add(toIndex(r, c));
        }
      }
    } else if (type === "radar") {
      const targetColor = pieceColor(partner) ?? mostCommonColor();
      state.board.forEach((piece, index) => {
        if (pieceColor(piece) === targetColor) indices.add(index);
      });
    }

    return [...indices];
  }

  function planSpecial(groups, preferredIndices) {
    const preferred = preferredIndices ?? [];
    const cross = findCrossMatch(groups);
    if (cross !== null) {
      const piece = state.board[cross];
      return {
        index: cross,
        type: "bomb",
        color: pieceColor(piece) ?? randomColor().id,
      };
    }

    const eligible = [...groups]
      .filter((group) => group.indices.length >= 4)
      .sort((a, b) => b.indices.length - a.indices.length)[0];
    if (!eligible) return null;

    const index =
      preferred.find((candidate) => eligible.indices.includes(candidate)) ??
      eligible.indices[Math.floor(eligible.indices.length / 2)];
    const color = pieceColor(state.board[index]) ?? randomColor().id;
    if (eligible.indices.length >= 5) {
      return { index, type: "radar", color };
    }
    return {
      index,
      type: eligible.orientation === "row" ? "rocketH" : "rocketV",
      color,
    };
  }

  function findCrossMatch(groups) {
    const rows = groups.filter((group) => group.orientation === "row");
    const cols = groups.filter((group) => group.orientation === "col");
    for (const rowGroup of rows) {
      for (const colGroup of cols) {
        const cross = rowGroup.indices.find((index) => colGroup.indices.includes(index));
        if (cross !== undefined) return cross;
      }
    }
    return null;
  }

  function findMatches() {
    const groups = [];

    for (let row = 0; row < ROWS; row += 1) {
      let runColor = null;
      let run = [];
      for (let col = 0; col < COLS; col += 1) {
        const index = toIndex(row, col);
        const color = pieceColor(state.board[index]);
        if (color && color === runColor) {
          run.push(index);
        } else {
          if (run.length >= 3) groups.push({ orientation: "row", indices: run });
          runColor = color;
          run = color ? [index] : [];
        }
      }
      if (run.length >= 3) groups.push({ orientation: "row", indices: run });
    }

    for (let col = 0; col < COLS; col += 1) {
      let runColor = null;
      let run = [];
      for (let row = 0; row < ROWS; row += 1) {
        const index = toIndex(row, col);
        const color = pieceColor(state.board[index]);
        if (color && color === runColor) {
          run.push(index);
        } else {
          if (run.length >= 3) groups.push({ orientation: "col", indices: run });
          runColor = color;
          run = color ? [index] : [];
        }
      }
      if (run.length >= 3) groups.push({ orientation: "col", indices: run });
    }

    return {
      groups,
      indices: [...new Set(groups.flatMap((group) => group.indices))],
    };
  }

  function renderBoard() {
    boardEl.classList.toggle("is-board-darkened", state.boardDarkTurns > 0);
    state.board.forEach((piece, index) => {
      const cell = cells[index];
      cell.classList.toggle("is-selected", state.selected === index);
      cell.classList.toggle("is-clearing", state.clearing.has(index));
      cell.classList.toggle("is-blocked", piece?.kind === "oil");
      cell.classList.toggle("is-darkened", isPieceDarkened(piece));
      cell.innerHTML = piece ? pieceHtml(piece) : "";
      cell.setAttribute("aria-label", cellLabel(piece, index));
    });
  }

  function isPieceDarkened(piece) {
    return Boolean(piece && (state.boardDarkTurns > 0 || piece.darkTurns > 0));
  }

  function pieceHtml(piece) {
    if (piece.kind === "oil") {
      return `<span class="piece oil-piece"><img class="piece-img" src="image/oil-barrel.webp" alt="" aria-hidden="true" draggable="false" /></span>`;
    }

    if (piece.kind === "special") {
      return `
        <span class="piece special-piece special-${specialClass(piece.special)} ship-${piece.color}">
          <img class="piece-img" src="image/special-${specialClass(piece.special)}.webp" alt="" aria-hidden="true" draggable="false" />
        </span>
      `;
    }

    return `
      <span class="piece ship-piece ship-${piece.color}">
        <img class="piece-img" src="image/ship-${piece.color}.webp" alt="" aria-hidden="true" draggable="false" />
      </span>
    `;
  }

  function cellLabel(piece, index) {
    const row = Math.floor(index / COLS) + 1;
    const col = (index % COLS) + 1;
    if (!piece) return `${row}行${col}列、空`;
    const darkLabel = isPieceDarkened(piece) ? "、闇落ち中" : "";
    if (piece.kind === "oil") return `${row}行${col}列、原油缶${darkLabel}`;
    if (piece.kind === "special") {
      return `${row}行${col}列、${specialName(piece.special)}${darkLabel}`;
    }
    const color = COLORS.find((item) => item.id === piece.color)?.name ?? "";
    return `${row}行${col}列、${color}の軍艦${darkLabel}`;
  }

  function specialName(type) {
    if (type === "rocketH" || type === "rocketV" || type === "rocket") return "ロケット";
    if (type === "anchor") return "アンカー";
    if (type === "radar") return "レーダー";
    if (type === "bomb") return "爆弾";
    return "特殊ピース";
  }

  function specialClass(type) {
    if (type === "rocketH" || type === "rocketV" || type === "rocket") return "rocket";
    return type;
  }

  function updateTargets() {
    state.targets.forEach((target, index) => {
      const card = targetsEl.querySelector(`[data-target="${index}"]`);
      if (!card) return;
      const progress = target.progress;
      const packageArt = card.querySelector(".package-art");
      const meter = card.querySelector(".meter-track i");
      const percent = card.querySelector(".oil-meter strong");
      packageArt.style.setProperty("--reveal", `${progress}%`);
      meter.style.setProperty("--meter", `${progress}%`);
      if (percent) percent.textContent = `${progress}%`;
      card.classList.toggle("is-complete", progress >= 100);
    });
  }

  function updateHud() {
    moveCountEl.textContent = String(Math.max(0, state.moves));
    scoreTextEl.textContent = state.score.toLocaleString("ja-JP");
  }

  function updateBoosters() {
    document.querySelectorAll(".booster").forEach((button) => {
      const booster = button.dataset.booster;
      const count = state.boosters[booster];
      button.classList.toggle("is-active", state.selectedBooster === booster);
      button.disabled = count <= 0 || state.locked;
      const countEl = button.querySelector(`[data-count="${booster}"]`);
      if (countEl) countEl.textContent = String(count);
    });
  }

  function selectBooster(booster) {
    if (state.locked || state.boosters[booster] <= 0) return;
    playSfx("ui");
    state.selected = null;
    state.selectedBooster = state.selectedBooster === booster ? null : booster;
    setStatus(
      state.selectedBooster
        ? `${BOOSTER_LABELS[booster]}を置くマスを選んでください。`
        : "特殊ピースの選択を解除しました。"
    );
    updateBoosters();
    renderBoard();
  }

  function spendMove() {
    playSfx("move");
    state.moves = Math.max(0, state.moves - 1);
    updateHud();
  }

  function setStatus(message) {
    statusTextEl.textContent = message;
    const length = [...message].length;
    statusTextEl.classList.toggle("is-long", length > 25);
    statusTextEl.classList.toggle("is-very-long", length > 30);
  }

  function openSettings() {
    updateTargetCountControls();
    updateMoveLimitControl();
    renderTargetSettings();
    settingsModal.classList.remove("is-hidden");
  }

  function closeSettings() {
    settingsModal.classList.add("is-hidden");
  }

  function updateTargetCountControls() {
    document.querySelectorAll("[data-target-count]").forEach((button) => {
      const isActive = Number(button.dataset.targetCount) === state.targetCount;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateMoveLimitControl() {
    if (!moveLimitInput) return;
    moveLimitInput.value = String(state.moveLimit);
  }

  function onMoveLimitChange() {
    if (!moveLimitInput) return;
    state.moveLimit = clamp(Number(moveLimitInput.value) || START_MOVES, 1, 99);
    state.moves = state.moveLimit;
    updateMoveLimitControl();
    updateHud();
  }

  function renderTargetSettings() {
    if (!targetSettingsEl) return;
    normalizeTargetPositions();
    targetSettingsEl.innerHTML = TARGETS.map((target, index) => {
      const settings = targetSettings(target.id);
      const inactive = index >= state.targetCount;
      return `
        <section class="target-setting-card ${inactive ? "is-inactive" : ""}">
          <div class="target-setting-head">
            <strong>${target.name}</strong>
          </div>
          <label class="setting-control">
            <span>配置</span>
            <select data-setting-target="${target.id}" data-setting-field="position">
              ${TARGET_POSITIONS.map(
                (position) =>
                  `<option value="${position.id}" ${settings.position === position.id ? "selected" : ""}>${position.label}</option>`
              ).join("")}
            </select>
          </label>
          ${settings.skills
            .map((skill, skillIndex) => skillSettingMarkup(target.id, skill, skillIndex))
            .join("")}
        </section>
      `;
    }).join("");
  }

  function skillSettingMarkup(targetId, skill, skillIndex) {
    return `
      <div class="skill-setting-row">
        <label class="setting-control">
          <span>スキル${skillIndex + 1}</span>
          <select data-setting-target="${targetId}" data-setting-field="skill" data-skill-index="${skillIndex}">
            ${Object.entries(DARK_SKILLS)
              .map(
                ([type, definition]) =>
                  `<option value="${type}" ${skill.type === type ? "selected" : ""}>${definition.label}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="setting-control turn-control">
          <span>発動</span>
          <select data-setting-target="${targetId}" data-setting-field="charge" data-skill-index="${skillIndex}">
            ${[1, 2, 3, 4, 5, 6].map((turns) => `<option value="${turns}" ${skillCharge(skill) === turns ? "selected" : ""}>${turns}</option>`).join("")}
          </select>
        </label>
        <label class="setting-control turn-control">
          <span>持続</span>
          <select data-setting-target="${targetId}" data-setting-field="duration" data-skill-index="${skillIndex}">
            ${[1, 2, 3, 4, 5, 6].map((turns) => `<option value="${turns}" ${skillDuration(skill) === turns ? "selected" : ""}>${turns}</option>`).join("")}
          </select>
        </label>
      </div>
    `;
  }

  function onTargetSettingChange(event) {
    const control = event.target.closest("[data-setting-target]");
    if (!control) return;
    const settings = targetSettings(control.dataset.settingTarget);
    const field = control.dataset.settingField;

    if (field === "aura") {
      settings.aura = control.checked;
      renderTargets();
      updateTargets();
      return;
    }

    if (field === "position") {
      setTargetPosition(control.dataset.settingTarget, control.value);
      renderTargetSettings();
      renderTargets();
      updateTargets();
      return;
    }

    const skillIndex = Number(control.dataset.skillIndex);
    if (!Number.isInteger(skillIndex) || !settings.skills[skillIndex]) return;

    if (field === "skill") {
      settings.skills[skillIndex].type = control.value;
      settings.skills[skillIndex] = normalizeSkill(settings.skills[skillIndex]);
      resetSkillCooldown(control.dataset.settingTarget, skillIndex);
      return;
    }

    if (field === "charge") {
      settings.skills[skillIndex].charge = clamp(Number(control.value), 1, 6);
      resetSkillCooldown(control.dataset.settingTarget, skillIndex);
      return;
    }

    if (field === "duration") {
      settings.skills[skillIndex].duration = clamp(Number(control.value), 1, 6);
    }
  }

  function showResult(won) {
    state.locked = true;
    state.selected = null;
    state.selectedBooster = null;
    updateBoosters();
    resultModal.classList.toggle("is-win", won);
    resultModal.classList.toggle("is-timeup", !won);
    resultPackages.style.setProperty("--target-count", String(state.targets.length));
    modalKicker.textContent = won ? "" : "";
    modalTitle.textContent = won ? "CLEAR" : "TIME UP";
    resultPackages.innerHTML = won
      ? state.targets
          .map(
            (target) => `
              <div class="result-package-wrap">
                ${packageMarkup({ ...target, progress: 100 }, 100)}
              </div>
            `
          )
          .join("")
      : "";
    modalMessage.textContent = won
      ? "ナフカ供給完了！\nパッケージがフルカラーになったよ♪"
      : "";
    playAgainButton.textContent = won ? "もう一度プレイ" : "リスタート";
    resultModal.classList.remove("is-hidden");
    if (won) {
      playSfx("clear");
      spawnResultConfetti();
    } else {
      playSfx("timeup");
    }
  }

  function spawnResultConfetti() {
    resultModal.querySelectorAll(".result-confetti").forEach((particle) => particle.remove());
    const palette = ["#fff1a3", "#ff5b5b", "#37cfff", "#62f07a", "#b765ff", "#ffffff"];
    for (let index = 0; index < 96; index += 1) {
      const particle = document.createElement("span");
      particle.className = "result-confetti";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${-18 - Math.random() * 28}%`;
      particle.style.setProperty("--confetti-color", palette[index % palette.length]);
      particle.style.setProperty("--fall", `${118 + Math.random() * 42}vh`);
      particle.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
      particle.style.setProperty("--spin", `${220 + Math.random() * 520}deg`);
      particle.style.setProperty("--delay", `${Math.random() * -4200}ms`);
      particle.style.setProperty("--duration", `${3100 + Math.random() * 1800}ms`);
      particle.style.setProperty("--size", `${6 + Math.random() * 7}px`);
      particle.style.borderRadius = index % 4 === 0 ? "50%" : "2px";
      resultModal.appendChild(particle);
    }
  }

  function spawnOilLandingBurst(index) {
    const rect = cells[index]?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.62;
    const ring = document.createElement("span");
    ring.className = "oil-landing-ring";
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
    ring.style.setProperty("--ring-size", `${rect.width * 0.82}px`);
    fxLayer.appendChild(ring);
    window.setTimeout(() => ring.remove(), 640);

    for (let particleIndex = 0; particleIndex < 18; particleIndex += 1) {
      const angle = (Math.PI * 2 * particleIndex) / 18 + Math.random() * 0.3;
      const distance = rect.width * (0.34 + Math.random() * 0.76);
      const particle = document.createElement("span");
      particle.className = "oil-landing-spark";
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty("--px", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--py", `${Math.sin(angle) * distance - rect.height * 0.22}px`);
      particle.style.setProperty("--rot", `${-180 + Math.random() * 360}deg`);
      particle.style.setProperty("--delay", `${Math.random() * 80}ms`);
      particle.style.setProperty("--size", `${5 + Math.random() * 8}px`);
      fxLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 780);
    }
  }

  function spawnTargetCompleteBurst(targetIndex) {
    const card = targetsEl.querySelector(`[data-target="${targetIndex}"]`);
    const meter = card?.querySelector(".meter-track");
    if (!card || !meter) return;
    const cardRect = card.getBoundingClientRect();
    const meterRect = meter.getBoundingClientRect();
    const cx = meterRect.right - meterRect.height * 0.35;
    const cy = meterRect.top + meterRect.height / 2;
    const ring = document.createElement("span");
    ring.className = "target-complete-ring";
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
    ring.style.setProperty("--ring-size", `${Math.max(42, meterRect.height * 2.9)}px`);
    fxLayer.appendChild(ring);
    window.setTimeout(() => ring.remove(), 780);

    for (let sparkIndex = 0; sparkIndex < 22; sparkIndex += 1) {
      const angle = (Math.PI * 2 * sparkIndex) / 22 + Math.random() * 0.38;
      const distance = Math.min(cardRect.width, 190) * (0.18 + Math.random() * 0.34);
      const spark = document.createElement("span");
      spark.className = "target-complete-sparkle";
      spark.style.left = `${cx}px`;
      spark.style.top = `${cy}px`;
      spark.style.setProperty("--px", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--py", `${Math.sin(angle) * distance}px`);
      spark.style.setProperty("--rot", `${-160 + Math.random() * 320}deg`);
      spark.style.setProperty("--delay", `${sparkIndex * 18 + Math.random() * 42}ms`);
      spark.style.setProperty("--size", `${6 + Math.random() * 9}px`);
      fxLayer.appendChild(spark);
      window.setTimeout(() => spark.remove(), 980);
    }
  }

  function animateClearPuffs(indices) {
    const sample = shuffle([...indices]).slice(0, 28);
    for (const [sequence, index] of sample.entries()) {
      const piece = state.board[index];
      const palette = PARTICLE_COLORS[pieceColor(piece)] ?? PARTICLE_COLORS.special;
      const rect = cells[index].getBoundingClientRect();
      const puff = document.createElement("span");
      puff.className = "match-pop";
      puff.style.setProperty("--pop-color", palette[0]);
      puff.style.setProperty("--pop-glow", palette[1]);
      puff.style.left = `${rect.left + rect.width / 2}px`;
      puff.style.top = `${rect.top + rect.height / 2}px`;
      fxLayer.appendChild(puff);
      window.setTimeout(() => puff.remove(), 420);
      spawnParticleBurst(rect, palette, sequence);
    }
  }

  function spawnParticleBurst(rect, palette, sequence) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const particleCount = 10;
    for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
      const angle = (Math.PI * 2 * particleIndex) / particleCount + Math.random() * 0.65;
      const distance = rect.width * (0.32 + Math.random() * 0.62);
      const particle = document.createElement("span");
      particle.className = "piece-particle";
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty("--px", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--py", `${Math.sin(angle) * distance - rect.height * 0.16}px`);
      particle.style.setProperty("--rot", `${-160 + Math.random() * 320}deg`);
      particle.style.setProperty("--particle", palette[particleIndex % palette.length]);
      particle.style.setProperty("--delay", `${Math.min(sequence * 4, 48) + Math.random() * 28}ms`);
      particle.style.setProperty("--size", `${5 + Math.random() * 7}px`);
      particle.style.borderRadius = particleIndex % 3 === 0 ? "2px" : "50%";
      fxLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 720);
    }

    if (sequence < 8) {
      const label = document.createElement("span");
      label.className = "score-pop";
      label.textContent = `+${Math.max(1, state.combo + 1)}`;
      label.style.left = `${cx + (Math.random() - 0.5) * rect.width * 0.5}px`;
      label.style.top = `${cy - rect.height * 0.15}px`;
      label.style.setProperty("--score-color", palette[1]);
      fxLayer.appendChild(label);
      window.setTimeout(() => label.remove(), 720);
    }
  }

  function animateTargetAttack(targetIndex) {
    const card = targetsEl.querySelector(`[data-target="${targetIndex}"]`);
    const boardFrame = boardEl.closest(".board-frame");
    if (!card || !boardFrame) return;

    card.classList.remove("is-dark-attacking");
    void card.offsetWidth;
    card.classList.add("is-dark-attacking");
    window.setTimeout(() => card.classList.remove("is-dark-attacking"), 840);
    shakeBoard();

    const targetRect = card.getBoundingClientRect();
    const boardRect = boardFrame.getBoundingClientRect();
    const startX = targetRect.left + targetRect.width / 2;
    const startY = targetRect.top + targetRect.height / 2;
    const endX = boardRect.left + boardRect.width / 2;
    const endY = boardRect.top + boardRect.height / 2;
    const distance = Math.hypot(endX - startX, endY - startY);
    const angle = Math.atan2(endY - startY, endX - startX);
    const link = document.createElement("span");
    link.className = "dark-attack-link";
    link.style.left = `${startX}px`;
    link.style.top = `${startY}px`;
    link.style.width = `${distance}px`;
    link.style.setProperty("--attack-angle", `${angle}rad`);
    fxLayer.appendChild(link);

    const burst = document.createElement("span");
    burst.className = "dark-target-burst";
    burst.style.left = `${startX}px`;
    burst.style.top = `${startY}px`;
    burst.style.setProperty("--burst-size", `${Math.max(targetRect.width, targetRect.height) * 1.15}px`);
    fxLayer.appendChild(burst);

    const boardFlash = document.createElement("span");
    boardFlash.className = "dark-board-flash";
    boardFlash.style.left = `${boardRect.left}px`;
    boardFlash.style.top = `${boardRect.top}px`;
    boardFlash.style.width = `${boardRect.width}px`;
    boardFlash.style.height = `${boardRect.height}px`;
    fxLayer.appendChild(boardFlash);

    window.setTimeout(() => {
      link.remove();
      burst.remove();
      boardFlash.remove();
    }, 900);
  }

  function spawnDarkImpact(indices) {
    const sample = shuffle([...indices]).slice(0, 18);
    for (const [sequence, index] of sample.entries()) {
      const rect = cells[index]?.getBoundingClientRect();
      if (!rect) continue;
      const particle = document.createElement("span");
      particle.className = "dark-impact-particle";
      particle.style.left = `${rect.left + rect.width / 2}px`;
      particle.style.top = `${rect.top + rect.height / 2}px`;
      particle.style.setProperty("--delay", `${sequence * 12 + Math.random() * 30}ms`);
      particle.style.setProperty("--size", `${rect.width * (0.2 + Math.random() * 0.12)}px`);
      fxLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 760);
    }
  }

  function animateSpecialFx(type, index) {
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cells[index].getBoundingClientRect();
    const centerX = cellRect.left + cellRect.width / 2;
    const centerY = cellRect.top + cellRect.height / 2;
    const nodes = [];

    const add = (className, styles) => {
      const node = document.createElement("span");
      node.className = className;
      for (const [key, value] of Object.entries(styles)) {
        node.style[key] = value;
      }
      fxLayer.appendChild(node);
      nodes.push(node);
    };

    if (type === "rocketH" || type === "rocket") {
      add("special-beam beam-rocket", {
        left: `${boardRect.left}px`,
        top: `${centerY - 6}px`,
        width: `${boardRect.width}px`,
        height: "12px",
      });
    } else if (type === "rocketV") {
      add("special-beam beam-rocket beam-vertical", {
        left: `${centerX - 6}px`,
        top: `${boardRect.top}px`,
        width: "12px",
        height: `${boardRect.height}px`,
      });
    } else if (type === "anchor") {
      add("special-beam beam-anchor", {
        left: `${boardRect.left}px`,
        top: `${centerY - 5}px`,
        width: `${boardRect.width}px`,
        height: "10px",
      });
      add("special-beam beam-anchor beam-vertical", {
        left: `${centerX - 5}px`,
        top: `${boardRect.top}px`,
        width: "10px",
        height: `${boardRect.height}px`,
      });
    } else if (type === "radar") {
      add("special-ring ring-radar", {
        left: `${centerX - boardRect.width * 0.58}px`,
        top: `${centerY - boardRect.width * 0.58}px`,
        width: `${boardRect.width * 1.16}px`,
        height: `${boardRect.width * 1.16}px`,
      });
    } else if (type === "bomb") {
      add("special-ring ring-bomb", {
        left: `${centerX - cellRect.width * 1.58}px`,
        top: `${centerY - cellRect.width * 1.58}px`,
        width: `${cellRect.width * 3.16}px`,
        height: `${cellRect.width * 3.16}px`,
      });
      shakeBoard();
    }

    if (nodes.length === 0) {
      add("special-ring ring-bomb", {
        left: `${centerX - cellRect.width}px`,
        top: `${centerY - cellRect.width}px`,
        width: `${cellRect.width * 2}px`,
        height: `${cellRect.width * 2}px`,
      });
    }

    return new Promise((resolve) => {
      window.setTimeout(() => {
        nodes.forEach((node) => node.remove());
        resolve();
      }, 430);
    });
  }

  function pulseTarget(index) {
    const card = targetsEl.querySelector(`[data-target="${index}"]`);
    if (!card) return;
    card.classList.remove("is-hit");
    void card.offsetWidth;
    card.classList.add("is-hit");
    window.setTimeout(() => card.classList.remove("is-hit"), 760);
  }

  function shakeBoard() {
    const frame = boardEl.closest(".board-frame");
    if (!frame) return;
    frame.classList.remove("is-shaking");
    void frame.offsetWidth;
    frame.classList.add("is-shaking");
    window.setTimeout(() => frame.classList.remove("is-shaking"), 280);
  }

  function showComboBadge(combo) {
    const rect = boardEl.getBoundingClientRect();
    const badge = document.createElement("span");
    badge.className = "combo-badge";
    badge.textContent = `${combo} COMBO`;
    badge.style.left = `${rect.left + rect.width / 2}px`;
    badge.style.top = `${rect.top + rect.height * 0.18}px`;
    fxLayer.appendChild(badge);
    window.setTimeout(() => badge.remove(), 820);
  }

  function isComplete() {
    return state.targets.every((target) => target.progress >= 100);
  }

  function countOilBarrels() {
    return state.board.filter((piece) => piece?.kind === "oil").length;
  }

  function mostCommonColor() {
    const counts = new Map();
    for (const piece of state.board) {
      const color = pieceColor(piece);
      if (!color) continue;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? randomColor().id;
  }

  function pieceColor(piece) {
    if (!piece || piece.kind === "oil") return null;
    return piece.color;
  }

  function swapPieces(firstIndex, secondIndex) {
    [state.board[firstIndex], state.board[secondIndex]] = [
      state.board[secondIndex],
      state.board[firstIndex],
    ];
  }

  function isAdjacent(firstIndex, secondIndex) {
    const firstRow = Math.floor(firstIndex / COLS);
    const firstCol = firstIndex % COLS;
    const secondRow = Math.floor(secondIndex / COLS);
    const secondCol = secondIndex % COLS;
    return Math.abs(firstRow - secondRow) + Math.abs(firstCol - secondCol) === 1;
  }

  function isInside(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
  }

  function toIndex(row, col) {
    return row * COLS + col;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  boot();
})();
