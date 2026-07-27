(function () {
  "use strict";

  const { NS, patterns, colorPresets, get: getPattern } = window.TilePlayPatterns;
  const STORAGE_KEYS = {
    favorites: "tile-play-favorites-v1",
    guide: "tile-play-guide-hidden-v1",
    language: "tile-play-language-v1",
  };
  const HISTORY_LIMIT = 40;
  const FAVORITES_LIMIT = 100;
  const PRESETS = [
    ["random", "Random"],
    ["alternate", "Alternate"],
    ["checker", "Checker"],
    ["wave", "Wave"],
    ["vertical-wave", "Vertical Wave"],
    ["mirror", "Mirror"],
    ["radial", "Radial"],
    ["spiral", "Spiral"],
  ];
  const BRUSHES = [
    ["rotate", "Rotate"],
    ["reverse", "Reverse"],
    ["flip", "Flip"],
    ["random", "Random"],
    ["reset", "Reset"],
  ];
  const SHOWCASES = {
    "diagonal-line": { grid: 8, seed: 19073, preset: "wave", color: "mono", lineWidth: 6, flipRate: 0 },
    "diagonal-split": { grid: 8, seed: 51677, preset: "checker", color: "mono", lineWidth: 6, flipRate: 0 },
    "quarter-arc": { grid: 9, seed: 42137, preset: "alternate", color: "mono", lineWidth: 6, flipRate: 0 },
    "double-arc": { grid: 8, seed: 73511, preset: "vertical-wave", color: "mono", lineWidth: 4, flipRate: 0 },
    "thick-curve": { grid: 8, seed: 83449, preset: "alternate", color: "mono", lineWidth: 7, flipRate: 0 },
    "s-connection": { grid: 8, seed: 29567, preset: "alternate", color: "japanese", lineWidth: 5, flipRate: 25 },
    "half-circle": { grid: 8, seed: 64891, preset: "alternate", color: "mono", lineWidth: 6, flipRate: 35 },
    "corner-dot": { grid: 8, seed: 17389, preset: "wave", color: "paper", lineWidth: 6, flipRate: 30 },
    "triangle-split": { grid: 8, seed: 91357, preset: "checker", color: "retro", lineWidth: 6, flipRate: 0 },
    "cross-connection": { grid: 9, seed: 36451, preset: "radial", color: "game-ui", lineWidth: 5, flipRate: 30 },
    "wave-connector": { grid: 7, seed: 58763, preset: "alternate", color: "retro", lineWidth: 6, flipRate: 0 },
    "organic-split": { grid: 8, seed: 76913, preset: "mirror", color: "mono", lineWidth: 6, flipRate: 35 },
    "bauhaus-quarters": { grid: 8, seed: 24683, preset: "random", color: "bauhaus-primary", lineWidth: 6, flipRate: 0 },
    "bauhaus-steps": { grid: 4, seed: 87139, preset: "radial", color: "poster-green", lineWidth: 3, lineCount: 7, flipRate: 0 },
    "bauhaus-double-disc": { grid: 5, seed: 46327, preset: "wave", color: "bauhaus-primary", lineWidth: 6, flipRate: 0 },
    "bauhaus-arch-stack": { grid: 5, seed: 72851, preset: "wave", color: "mono", lineWidth: 6, flipRate: 0 },
  };
  const I18N = {
    ja: {
      skipLink: "メインへ移動",
      baseTiles: "基本タイル",
      searchPlaceholder: "名前・タグで検索",
      viewAll: "すべてを大きく見る",
      canvasHint: "タイルをクリックして回転",
      newSeed: "新しいSeed",
      copyUrl: "URLをコピー",
      moreVariations: "さらに生成",
      settings: "設定",
      basicSettings: "基本設定",
      grid: "グリッド",
      lineWidth: "線幅",
      lineCount: "線数",
      flipRate: "反転率",
      rotationRate: "回転率",
      mirrorX: "左右対称",
      mirrorY: "上下対称",
      background: "背景",
      foreground: "前景",
      accent: "差し色",
      secondary: "補助色1",
      tertiary: "補助色2",
      invertColors: "前景と背景を反転",
      brushHelp: "ドラッグで連続操作。Shift＋クリックで逆回転、ダブルクリックで反転します。",
      structureView: "構造表示",
      gridLines: "グリッド線",
      tileNumbers: "タイル番号",
      rotationDirection: "回転方向",
      shapes: "図形",
      rotation: "回転",
      fourDirections: "4方向",
      flip: "反転",
      layout: "配置",
      exploreHeading: "基本タイルから、<br />無限のリズムへ。",
      exploreDescription: "正方形の中の線や面を回転・反転させることで、予想外の連続模様が生まれます。これは主に「Truchet Tiles」と呼ばれる考え方です。",
      favoritesDescription: "保存したレシピはこのブラウザの中だけに保管されます。",
      noFavorites: "まだ保存はありません",
      noFavoritesHelp: "Play画面の「保存」から、気に入った組み合わせを残せます。",
      makePattern: "パターンを作る",
      tiles: "タイル",
      rotate: "回転",
      flipBrush: "反転",
      exportIntro: "現在のパターンだけを書き出します。UIやグリッド表示は含まれません。",
      pngSize: "PNGサイズ",
      transparentBackground: "背景を透明にする",
      highResImage: "高解像度画像",
      editableVector: "編集可能なベクター",
      reproRecipe: "再現用レシピ",
      guideHeading: "ひとつのタイルから、<br />模様を発見しよう。",
      guideStep1: "タイルをタップして90°回転",
      guideStep2: "Randomで新しい配置を生成",
      guideStep3: "配色・並び方・密度を調整",
      guideStep4: "PNG / SVG / JSONで保存",
      dontShowAgain: "次回から表示しない",
      startPlaying: "遊んでみる",
      disassemble: "分解して見る",
      structureLevel: "構造 {level}/4",
      supported: "対応",
      unsupported: "なし",
      save: "保存",
      saved: "保存済み",
      tryTile: "このタイルを試す →",
      favoritePattern: "{name}をお気に入りに保存",
      randomized: "Seed {seed} で新しい配置を生成しました",
      resetDone: "見本レシピに戻しました。Undoで元に戻せます",
      favoriteRemoved: "お気に入りから削除しました",
      favoriteSaved: "お気に入りに保存しました",
      storageUnavailable: "ブラウザの保存領域を使用できませんでした",
      copyFailed: "コピーできませんでした。ブラウザの権限を確認してください",
      svgDone: "SVGを書き出しました",
      svgFailed: "SVGの生成に失敗しました",
      jsonDone: "再現用JSONを書き出しました",
      pngDone: "{size}px PNGを書き出しました",
      pngFailed: "PNGの生成に失敗しました",
      pngLoadFailed: "PNG用のSVGを読み込めませんでした",
      cssCopied: "CSS backgroundコードをコピーしました",
      seedCopied: "Seedをコピーしました",
      urlCopied: "再現URLをコピーしました",
      exportUnsupported: "このブラウザは書き出しダイアログに対応していません",
      fullscreenFailed: "フルスクリーン表示を開始できませんでした",
      flipBrushSelected: "Flip Brushを選択しました",
    },
    en: {
      skipLink: "Skip to main content",
      baseTiles: "Base Tiles",
      searchPlaceholder: "Search names or tags",
      viewAll: "View full library",
      canvasHint: "Click a tile to rotate",
      newSeed: "New Seed",
      copyUrl: "Copy URL",
      moreVariations: "Generate more",
      settings: "Settings",
      basicSettings: "Core controls",
      grid: "Grid",
      lineWidth: "Line width",
      lineCount: "Line count",
      flipRate: "Flip rate",
      rotationRate: "Rotation rate",
      mirrorX: "Mirror horizontally",
      mirrorY: "Mirror vertically",
      background: "Background",
      foreground: "Foreground",
      accent: "Accent",
      secondary: "Secondary",
      tertiary: "Tertiary",
      invertColors: "Swap foreground and background",
      brushHelp: "Drag to edit continuously. Shift-click rotates backward; double-click flips.",
      structureView: "Structure view",
      gridLines: "Grid lines",
      tileNumbers: "Tile numbers",
      rotationDirection: "Rotation direction",
      shapes: "Shapes",
      rotation: "Rotation",
      fourDirections: "4 directions",
      flip: "Flip",
      layout: "Layout",
      exploreHeading: "One base tile.<br />Infinite rhythms.",
      exploreDescription: "Rotate and flip lines or shapes inside a square to reveal unexpected continuous patterns. This system is commonly known as Truchet Tiles.",
      favoritesDescription: "Saved recipes stay in this browser only.",
      noFavorites: "Nothing saved yet",
      noFavoritesHelp: "Use Save in Play to keep combinations you like.",
      makePattern: "Create a pattern",
      tiles: "Tiles",
      rotate: "Rotate",
      flipBrush: "Flip",
      exportIntro: "Export the current pattern only. Interface and guide overlays are excluded.",
      pngSize: "PNG size",
      transparentBackground: "Transparent background",
      highResImage: "High-resolution image",
      editableVector: "Editable vector",
      reproRecipe: "Reproducible recipe",
      guideHeading: "Start with one tile.<br />Discover a pattern.",
      guideStep1: "Tap a tile to rotate it 90°",
      guideStep2: "Use Random to generate a new layout",
      guideStep3: "Adjust color, layout, and density",
      guideStep4: "Save as PNG, SVG, or JSON",
      dontShowAgain: "Do not show again",
      startPlaying: "Start playing",
      disassemble: "Show structure",
      structureLevel: "Structure {level}/4",
      supported: "Supported",
      unsupported: "No",
      save: "Save",
      saved: "Saved",
      tryTile: "Try this tile →",
      favoritePattern: "Save {name} to favorites",
      randomized: "Generated a new layout with Seed {seed}",
      resetDone: "Restored the showcase recipe. You can undo this change.",
      favoriteRemoved: "Removed from favorites",
      favoriteSaved: "Saved to favorites",
      storageUnavailable: "Browser storage is unavailable",
      copyFailed: "Could not copy. Check your browser permissions.",
      svgDone: "SVG exported",
      svgFailed: "Could not generate the SVG",
      jsonDone: "Recipe JSON exported",
      pngDone: "{size}px PNG exported",
      pngFailed: "Could not generate the PNG",
      pngLoadFailed: "Could not load the SVG for PNG export",
      cssCopied: "CSS background code copied",
      seedCopied: "Seed copied",
      urlCopied: "Reproducible URL copied",
      exportUnsupported: "This browser does not support the export dialog",
      fullscreenFailed: "Could not enter full screen",
      flipBrushSelected: "Flip Brush selected",
    },
  };

  const DEFAULTS = {
    patternId: "quarter-arc",
    grid: 9,
    seed: 42137,
    preset: "alternate",
    colors: {
      background: "#F2E6CF",
      foreground: "#2B2118",
      accent: "#B7402C",
      secondary: "#6F7D59",
      tertiary: "#D99A37",
    },
    lineWidth: 6,
    lineCount: 7,
    flipRate: 0,
    rotationRate: 100,
    gap: 0,
    mirrorX: false,
    mirrorY: false,
    showGrid: false,
    showNumbers: false,
    showDirections: false,
    structureLevel: 0,
    brush: "rotate",
    brushSize: 1,
  };

  const state = {
    ...structuredCloneSafe(DEFAULTS),
    tiles: [],
    view: "play",
    variations: [],
    variationRound: 0,
    favorites: [],
    exploreFilter: "All",
  };

  const undoStack = [];
  const redoStack = [];
  let controlStartSnapshot = null;
  let renderScheduled = false;
  let activePointer = null;
  let longPressTimer = null;
  let longPressIndex = null;
  let lastTouch = { index: -1, time: 0 };
  let language = "ja";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function svgNode(name, attrs) {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) el.setAttribute(key, String(value));
    });
    return el;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(seed, salt) {
    let h = (Number(seed) || DEFAULTS.seed) ^ (salt * 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function snapshot() {
    const keys = Object.keys(DEFAULTS);
    const data = {};
    keys.forEach((key) => {
      data[key] = structuredCloneSafe(state[key]);
    });
    data.tiles = structuredCloneSafe(state.tiles);
    return data;
  }

  function restore(data) {
    Object.keys(DEFAULTS).forEach((key) => {
      if (data[key] !== undefined) state[key] = structuredCloneSafe(data[key]);
    });
    state.tiles = Array.isArray(data.tiles) ? structuredCloneSafe(data.tiles) : generateTiles(state);
    normalizeState();
    renderAll();
  }

  function pushHistory(previous) {
    undoStack.push(previous || snapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    $("#undoButton").disabled = !undoStack.length;
    $("#redoButton").disabled = !redoStack.length;
  }

  function normalizeState() {
    state.patternId = getPattern(state.patternId).id;
    const pattern = getPattern(state.patternId);
    state.grid = clampInt(state.grid, 3, 30, DEFAULTS.grid);
    state.seed = clampInt(state.seed, 1, 999999999, DEFAULTS.seed);
    state.lineCount = clampInt(state.lineCount, 3, 12, DEFAULTS.lineCount);
    const minimumLineWidth = pattern.usesLineCount ? 1 : 2;
    const maximumLineWidth = pattern.usesLineCount ? safeRibbonLineWidth(state.lineCount) : 24;
    state.lineWidth = clampInt(state.lineWidth, minimumLineWidth, maximumLineWidth, Math.min(DEFAULTS.lineWidth, maximumLineWidth));
    state.flipRate = clampInt(state.flipRate, 0, 100, DEFAULTS.flipRate);
    state.rotationRate = clampInt(state.rotationRate, 0, 100, DEFAULTS.rotationRate);
    state.gap = 0;
    if (!PRESETS.some(([id]) => id === state.preset)) state.preset = DEFAULTS.preset;
    if ((pattern.disabledPresets || []).includes(state.preset)) state.preset = "alternate";
    if (!BRUSHES.some(([id]) => id === state.brush)) state.brush = DEFAULTS.brush;
    if (!pattern.supportsFlip) {
      state.flipRate = 0;
      if (state.brush === "flip") state.brush = "rotate";
    }
    if (![1, 3, 5].includes(Number(state.brushSize))) state.brushSize = 1;
    state.colors = {
      background: validColor(state.colors && state.colors.background, DEFAULTS.colors.background),
      foreground: validColor(state.colors && state.colors.foreground, DEFAULTS.colors.foreground),
      accent: validColor(state.colors && state.colors.accent, DEFAULTS.colors.accent),
      secondary: validColor(state.colors && state.colors.secondary, DEFAULTS.colors.secondary),
      tertiary: validColor(state.colors && state.colors.tertiary, DEFAULTS.colors.tertiary),
    };
    const expected = state.grid * state.grid;
    if (!Array.isArray(state.tiles) || state.tiles.length !== expected) state.tiles = generateTiles(state);
  }

  function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function safeRibbonLineWidth(lineCount) {
    const count = clampInt(lineCount, 3, 12, DEFAULTS.lineCount);
    const spacing = 36 / (count - 1);
    return Math.max(1, Math.min(4, Math.floor(spacing - 1)));
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : fallback;
  }

  function t(key, variables) {
    const dictionary = I18N[language] || I18N.ja;
    let value = dictionary[key] || I18N.ja[key] || key;
    Object.entries(variables || {}).forEach(([name, replacement]) => {
      value = value.replace(`{${name}}`, String(replacement));
    });
    return value;
  }

  function loadLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.language);
      language = stored === "en" ? "en" : "ja";
    } catch (error) {
      language = "ja";
    }
  }

  function applyLanguage() {
    document.documentElement.lang = language;
    $("#languageSelect").value = language;
    $$("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    $$("[data-i18n-html]").forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml);
    });
    $$("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    updatePatternInfo();
    updateControls();
  }

  function showcaseConfig(patternId) {
    const pattern = getPattern(patternId);
    const showcase = SHOWCASES[pattern.id] || SHOWCASES["quarter-arc"];
    const color = colorPresets.find((preset) => preset.id === showcase.color) || colorPresets[0];
    return {
      ...structuredCloneSafe(DEFAULTS),
      ...structuredCloneSafe(showcase),
      patternId: pattern.id,
      colors: {
        background: color.background,
        foreground: color.foreground,
        accent: color.accent,
        secondary: color.secondary,
        tertiary: color.tertiary,
      },
    };
  }

  function generateTiles(config) {
    const n = config.grid;
    const rng = mulberry32(config.seed);
    const tiles = new Array(n * n);
    const randomTile = () => ({
      rotation: rng() * 100 <= config.rotationRate ? Math.floor(rng() * 4) : 0,
      flip: rng() * 100 < config.flipRate,
    });

    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        let tile;
        switch (config.preset) {
          case "alternate":
            tile = { rotation: (x + y) % 4, flip: (x + y) % 2 === 0 && config.flipRate > 0 };
            break;
          case "checker":
            tile = { rotation: ((x + y) % 2) * 2, flip: (x + y) % 2 === 1 && config.flipRate > 0 };
            break;
          case "wave":
            tile = { rotation: ((x + Math.round(Math.sin(y * 0.82) * 1.5)) % 4 + 4) % 4, flip: rng() * 100 < config.flipRate };
            break;
          case "vertical-wave":
            tile = { rotation: ((y + Math.round(Math.sin(x * 0.82) * 1.5)) % 4 + 4) % 4, flip: rng() * 100 < config.flipRate };
            break;
          case "mirror": {
            const mx = Math.min(x, n - 1 - x);
            const local = mulberry32(hashSeed(config.seed, mx + y * n));
            tile = { rotation: Math.floor(local() * 4), flip: local() * 100 < config.flipRate };
            if (x >= n / 2) tile.rotation = (4 - tile.rotation) % 4;
            break;
          }
          case "radial": {
            const angle = Math.atan2(y - (n - 1) / 2, x - (n - 1) / 2);
            tile = { rotation: ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4, flip: rng() * 100 < config.flipRate };
            break;
          }
          case "spiral": {
            const dx = x - (n - 1) / 2;
            const dy = y - (n - 1) / 2;
            const angle = Math.atan2(dy, dx);
            const radius = Math.hypot(dx, dy);
            tile = { rotation: ((Math.floor((angle + radius * 0.72) / (Math.PI / 2)) % 4) + 4) % 4, flip: rng() * 100 < config.flipRate };
            break;
          }
          default:
            tile = randomTile();
        }
        tiles[y * n + x] = tile;
      }
    }

    if (config.mirrorX || config.mirrorY) {
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const sourceX = config.mirrorX ? Math.min(x, n - 1 - x) : x;
          const sourceY = config.mirrorY ? Math.min(y, n - 1 - y) : y;
          const source = tiles[sourceY * n + sourceX];
          const mirrored = { ...source };
          if (config.mirrorX && x >= n / 2) mirrored.rotation = (4 - mirrored.rotation) % 4;
          if (config.mirrorY && y >= n / 2) mirrored.rotation = (2 - mirrored.rotation + 4) % 4;
          tiles[y * n + x] = mirrored;
        }
      }
    }
    return tiles;
  }

  function renderPatternSvg(config, tileData, options) {
    const opts = Object.assign({ size: 1000, interactive: false, clean: false }, options || {});
    const svg = svgNode("svg", {
      viewBox: `0 0 ${opts.size} ${opts.size}`,
      xmlns: NS,
      role: opts.interactive ? "img" : null,
      "aria-label": opts.interactive ? "編集可能なモジュラーパターン" : null,
      preserveAspectRatio: "xMidYMid meet",
      "shape-rendering": "geometricPrecision",
    });
    const structureTile = config.structureLevel === 4 && opts.interactive;
    const n = structureTile ? 1 : config.grid;
    const tiles = structureTile ? [tileData[0] || { rotation: 0, flip: false }] : tileData;
    const cell = opts.size / n;
    const pattern = getPattern(config.patternId);

    if (!opts.transparent) {
      svg.appendChild(svgNode("rect", { class: "export-background", width: opts.size, height: opts.size, fill: config.colors.background }));
    }

    const tileLayer = svgNode("g", { class: "tile-layer" });
    svg.appendChild(tileLayer);
    tiles.forEach((tile, index) => {
      const x = index % n;
      const y = Math.floor(index / n);
      const cellGroup = svgNode("g", {
        class: "tile-cell",
        "data-index": opts.interactive ? index : null,
        transform: `translate(${x * cell} ${y * cell}) scale(${cell / 100})`,
      });
      const visual = svgNode("g", { class: "tile-visual" });
      const transforms = [];
      transforms.push(`rotate(${tile.rotation * 90} 50 50)`);
      if (tile.flip && pattern.supportsFlip) transforms.push("translate(100 0) scale(-1 1)");
      visual.setAttribute("transform", transforms.join(" "));
      pattern.render(visual, config.colors, {
        lineWidth: config.lineWidth,
        lineCount: config.lineCount,
        roundness: 8,
        seed: config.seed,
        index,
        x,
        y,
        rotation: tile.rotation,
        flip: tile.flip,
      });
      cellGroup.appendChild(visual);

      if (opts.interactive) {
        cellGroup.appendChild(svgNode("rect", {
          class: "tile-hit",
          width: 100,
          height: 100,
          "data-index": index,
        }));
      }
      if (config.showNumbers && !opts.clean) {
        const label = svgNode("text", {
          class: "tile-meta",
          x: 50,
          y: config.showDirections ? 42 : 50,
          "font-size": Math.min(24, Math.max(7, 70 / n)),
        });
        label.textContent = String(index + 1);
        cellGroup.appendChild(label);
      }
      if (config.showDirections && !opts.clean) {
        const direction = svgNode("text", {
          class: "tile-meta",
          x: 50,
          y: config.showNumbers ? 62 : 50,
          "font-size": Math.min(20, Math.max(7, 60 / n)),
        });
        direction.textContent = `${tile.rotation * 90}°${tile.flip ? " F" : ""}`;
        cellGroup.appendChild(direction);
      }
      tileLayer.appendChild(cellGroup);
    });

    if (config.showGrid && !opts.clean && !structureTile) {
      const gridLayer = svgNode("g", { class: "grid-layer" });
      for (let i = 1; i < n; i += 1) {
        const position = i * cell;
        gridLayer.appendChild(svgNode("line", { class: "grid-line", x1: position, y1: 0, x2: position, y2: opts.size }));
        gridLayer.appendChild(svgNode("line", { class: "grid-line", x1: 0, y1: position, x2: opts.size, y2: position }));
      }
      svg.appendChild(gridLayer);
    }
    return svg;
  }

  function scheduleCanvasRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderCanvas();
    });
  }

  function renderCanvas() {
    const target = $("#patternCanvas");
    const rendered = renderPatternSvg(state, state.tiles, { size: 1000, interactive: true });
    target.replaceChildren(...Array.from(rendered.childNodes));
    target.setAttribute("viewBox", "0 0 1000 1000");
    target.setAttribute("shape-rendering", "geometricPrecision");
    target.style.background = state.colors.background;
    updatePatternInfo();
  }

  function renderAll() {
    renderCanvas();
    updateControls();
    renderPatternList($("#patternSearch").value || "");
    renderBaseTile();
    renderVariations();
    updateUrl(false);
    updateHistoryButtons();
  }

  function createPreview(config, grid, seedOffset) {
    const previewConfig = {
      ...structuredCloneSafe(config),
      grid: grid || 6,
      seed: seedOffset === undefined || seedOffset === null ? config.seed : hashSeed(config.seed, seedOffset),
      showGrid: false,
      showNumbers: false,
      showDirections: false,
      structureLevel: 0,
      gap: Math.min(config.gap || 0, 5),
    };
    return renderPatternSvg(previewConfig, generateTiles(previewConfig), { size: 600 });
  }

  function updatePatternInfo() {
    const pattern = getPattern(state.patternId);
    $("#patternTitle").textContent = pattern.name;
    $("#categoryLabel").textContent = pattern.category;
    $("#shapeInfo").textContent = language === "en" ? pattern.shapesEn : pattern.shapes;
    $("#flipInfo").textContent = pattern.supportsFlip ? t("supported") : t("unsupported");
    $("#presetInfo").textContent = presetName(state.preset);
    $("#activePresetLabel").textContent = presetName(state.preset);
  }

  function updateControls() {
    const pattern = getPattern(state.patternId);
    if (!pattern.supportsFlip && state.brush === "flip") state.brush = "rotate";
    $("#seedInput").value = state.seed;
    setRange("gridRange", state.grid, "gridOutput", `${state.grid} × ${state.grid}`);
    const lineWidthRange = $("#lineWidthRange");
    lineWidthRange.min = pattern.usesLineCount ? "1" : "2";
    lineWidthRange.max = String(pattern.usesLineCount ? safeRibbonLineWidth(state.lineCount) : 24);
    if (pattern.usesLineCount) state.lineWidth = Math.min(state.lineWidth, Number(lineWidthRange.max));
    setRange("lineWidthRange", state.lineWidth, "lineWidthOutput", state.lineWidth);
    setRange("lineCountRange", state.lineCount, "lineCountOutput", state.lineCount);
    setRange("flipRateRange", state.flipRate, "flipRateOutput", `${state.flipRate}%`);
    setRange("rotationRateRange", state.rotationRate, "rotationRateOutput", `${state.rotationRate}%`);
    $("#backgroundColor").value = state.colors.background;
    $("#foregroundColor").value = state.colors.foreground;
    $("#accentColor").value = state.colors.accent;
    $("#secondaryColor").value = state.colors.secondary;
    $("#tertiaryColor").value = state.colors.tertiary;
    $("#mirrorXToggle").checked = state.mirrorX;
    $("#mirrorYToggle").checked = state.mirrorY;
    $("#showGridToggle").checked = state.showGrid;
    $("#showNumbersToggle").checked = state.showNumbers;
    $("#showDirectionsToggle").checked = state.showDirections;
    $("#lineWidthControl").hidden = pattern.usesLineWidth === false;
    $("#lineCountControl").hidden = !pattern.usesLineCount;
    $("#flipRateControl").hidden = !pattern.supportsFlip;
    $("#colorControls").hidden = pattern.usesColorControls === false;
    $("#secondaryColorControl").hidden = !pattern.usesFiveColors;
    $("#tertiaryColorControl").hidden = !pattern.usesFiveColors;
    $("#colorCountLabel").textContent = pattern.usesFiveColors ? "5 colors" : "3 colors";
    $$(".preset-button").forEach((button) => {
      button.hidden = (pattern.disabledPresets || []).includes(button.dataset.preset);
    });
    $$('[data-brush="flip"], [data-tile-action="flip"]').forEach((button) => {
      button.hidden = !pattern.supportsFlip;
    });
    $("#gridButton").setAttribute("aria-pressed", String(state.showGrid));
    $("#structureButton").setAttribute("aria-pressed", String(state.structureLevel > 0));
    $("#structureButton").lastChild.textContent = state.structureLevel ? ` ${t("structureLevel", { level: state.structureLevel })}` : ` ${t("disassemble")}`;
    $$(".preset-button").forEach((button) => button.classList.toggle("is-active", button.dataset.preset === state.preset));
    $$("#brushModes button").forEach((button) => button.classList.toggle("is-active", button.dataset.brush === state.brush));
    $$("#brushSizes button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.size) === state.brushSize));
    $("#brushLabel").textContent = `${brushName(state.brush)} / ${state.brushSize}×${state.brushSize}`;
    $("#mobileRotateButton").innerHTML = state.brush === "flip"
      ? `<span aria-hidden="true">⇋</span><span>${t("flipBrush")}</span>`
      : `<span aria-hidden="true">↻</span><span>${t("rotate")}</span>`;
    $$(".color-preset").forEach((button) => {
      const preset = colorPresets.find((item) => item.id === button.dataset.colorPreset);
      button.classList.toggle("is-active", !!preset && colorsEqual(preset, state.colors));
    });
    const isSaved = state.favorites.some((item) => recipeSignature(item) === recipeSignature(state));
    $("#favoriteButton").setAttribute("aria-pressed", String(isSaved));
    $("#favoriteButton").innerHTML = `<span aria-hidden="true">${isSaved ? "♥" : "♡"}</span> ${isSaved ? t("saved") : t("save")}`;
    $("#favoriteCount").textContent = String(state.favorites.length);
  }

  function setRange(id, value, outputId, outputValue) {
    const input = $(`#${id}`);
    input.value = value;
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
    $(`#${outputId}`).value = outputValue;
  }

  function colorsEqual(preset, colors) {
    return preset.background.toUpperCase() === colors.background &&
      preset.foreground.toUpperCase() === colors.foreground &&
      preset.accent.toUpperCase() === colors.accent &&
      preset.secondary.toUpperCase() === colors.secondary &&
      preset.tertiary.toUpperCase() === colors.tertiary;
  }

  function presetName(id) {
    const preset = PRESETS.find((item) => item[0] === id);
    return preset ? preset[1] : "Random";
  }

  function presetsForPattern(patternId) {
    const disabled = getPattern(patternId).disabledPresets || [];
    return PRESETS.filter(([id]) => !disabled.includes(id));
  }

  function brushName(id) {
    const brush = BRUSHES.find((item) => item[0] === id);
    return brush ? brush[1] : "Rotate";
  }

  function buildStaticUi() {
    $("#libraryCount").textContent = `LIBRARY / ${patterns.length}`;
    $("#systemCount").textContent = `${patterns.length} MODULAR SYSTEMS`;
    buildPatternList();
    buildPresets();
    buildColors();
    buildBrushes();
    buildExploreFilters();
    buildExploreCards();
    bindEvents();
  }

  function buildPatternList() {
    renderPatternList("");
  }

  function renderPatternList(query) {
    const list = $("#patternList");
    const normalized = String(query).trim().toLowerCase();
    const filtered = patterns.filter((pattern) => {
      const haystack = [pattern.name, pattern.category, ...pattern.tags].join(" ").toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
    const fragment = document.createDocumentFragment();
    filtered.forEach((pattern) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pattern-item${pattern.id === state.patternId ? " is-active" : ""}`;
      button.dataset.patternId = pattern.id;
      button.setAttribute("aria-pressed", String(pattern.id === state.patternId));
      const preview = document.createElement("span");
      preview.className = "mini-preview";
      const config = showcaseConfig(pattern.id);
      preview.appendChild(createPreview(config, 3));
      const text = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = pattern.name;
      const small = document.createElement("small");
      small.textContent = pattern.category;
      text.append(strong, small);
      button.append(preview, text);
      fragment.appendChild(button);
    });
    list.replaceChildren(fragment);
  }

  function buildPresets() {
    const fragment = document.createDocumentFragment();
    PRESETS.forEach(([id, name]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-button";
      button.dataset.preset = id;
      button.textContent = name;
      fragment.appendChild(button);
    });
    $("#presetGrid").appendChild(fragment);
  }

  function buildColors() {
    const fragment = document.createDocumentFragment();
    colorPresets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-preset";
      button.dataset.colorPreset = preset.id;
      button.title = preset.name;
      button.setAttribute("aria-label", `${preset.name} 配色を適用`);
      button.style.setProperty("--preset-bg", preset.background);
      button.style.setProperty("--preset-fg", preset.foreground);
      button.style.setProperty("--preset-accent", preset.accent);
      button.style.setProperty("--preset-secondary", preset.secondary);
      button.style.setProperty("--preset-tertiary", preset.tertiary);
      fragment.appendChild(button);
    });
    $("#colorPresetList").appendChild(fragment);
  }

  function buildBrushes() {
    const modes = document.createDocumentFragment();
    BRUSHES.forEach(([id, name]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.brush = id;
      button.textContent = name;
      modes.appendChild(button);
    });
    $("#brushModes").appendChild(modes);
    [1, 3, 5].forEach((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.size = size;
      button.textContent = `${size}×${size}`;
      $("#brushSizes").appendChild(button);
    });
  }

  function buildExploreFilters() {
    const categories = ["All", ...new Set(patterns.map((pattern) => pattern.category))];
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.filter = category;
      button.textContent = category;
      button.classList.toggle("is-active", category === state.exploreFilter);
      $("#exploreFilters").appendChild(button);
    });
  }

  function buildExploreCards() {
    const grid = $("#exploreGrid");
    const fragment = document.createDocumentFragment();
    patterns
      .filter((pattern) => state.exploreFilter === "All" || pattern.category === state.exploreFilter)
      .forEach((pattern) => {
        const article = document.createElement("article");
        article.className = "explore-card";
        const preview = document.createElement("div");
        preview.className = "explore-preview";
        preview.dataset.openPattern = pattern.id;
        const config = showcaseConfig(pattern.id);
        preview.appendChild(createPreview(config, config.grid));
        const tryButton = document.createElement("button");
        tryButton.type = "button";
        tryButton.className = "try-overlay";
        tryButton.dataset.openPattern = pattern.id;
        tryButton.textContent = t("tryTile");
        preview.appendChild(tryButton);
        const info = document.createElement("div");
        info.className = "explore-info";
        const text = document.createElement("div");
        const title = document.createElement("h2");
        title.textContent = pattern.name;
        const meta = document.createElement("p");
        meta.textContent = `${pattern.category} · ${pattern.tags.slice(0, 2).join(" / ")}`;
        text.append(title, meta);
        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "card-favorite";
        favorite.dataset.quickFavorite = pattern.id;
        favorite.setAttribute("aria-label", t("favoritePattern", { name: pattern.name }));
        favorite.textContent = "♡";
        info.append(text, favorite);
        article.append(preview, info);
        fragment.appendChild(article);
      });
    grid.replaceChildren(fragment);
  }

  function generateVariations() {
    state.variationRound += 1;
    const availablePresets = presetsForPattern(state.patternId);
    const pattern = getPattern(state.patternId);
    state.variations = Array.from({ length: 12 }, (_, index) => {
      const rng = mulberry32(hashSeed(state.seed + state.variationRound * 997, index + 1));
      const color = index % 4 === 3 ? colorPresets[Math.floor(rng() * colorPresets.length)] : state.colors;
      const lineCount = pattern.usesLineCount
        ? Math.min(12, Math.max(3, state.lineCount + Math.floor(rng() * 5) - 2))
        : state.lineCount;
      const candidateLineWidth = Math.min(18, Math.max(pattern.usesLineCount ? 1 : 3, state.lineWidth + Math.floor(rng() * 7) - 3));
      return {
        ...structuredCloneSafe(state),
        seed: Math.max(1, hashSeed(state.seed, index + state.variationRound * 17) % 999999999),
        preset: availablePresets[Math.floor(rng() * availablePresets.length)][0],
        grid: Math.min(18, Math.max(5, state.grid + Math.floor(rng() * 7) - 3)),
        lineCount,
        lineWidth: pattern.usesLineCount ? Math.min(candidateLineWidth, safeRibbonLineWidth(lineCount)) : candidateLineWidth,
        flipRate: pattern.supportsFlip ? Math.floor(rng() * 66) : 0,
        colors: {
          background: color.background,
          foreground: color.foreground,
          accent: color.accent,
          secondary: color.secondary,
          tertiary: color.tertiary,
        },
      };
    });
  }

  function renderVariations() {
    if (!state.variations.length) generateVariations();
    const fragment = document.createDocumentFragment();
    state.variations.forEach((variation, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "variation-card";
      button.dataset.variationIndex = index;
      button.appendChild(createPreview(variation, 6, index + 10));
      const label = document.createElement("span");
      label.textContent = `${presetName(variation.preset)} · ${variation.seed}`;
      button.appendChild(label);
      fragment.appendChild(button);
    });
    $("#variationsList").replaceChildren(fragment);
  }

  function renderBaseTile() {
    const config = {
      ...structuredCloneSafe(state),
      grid: 1,
      gap: 0,
      showGrid: false,
      showNumbers: false,
      showDirections: false,
      structureLevel: 0,
    };
    $("#baseTilePreview").replaceChildren(renderPatternSvg(config, [{ rotation: 0, flip: false }], { size: 100 }));
  }

  function selectPattern(id) {
    pushHistory();
    const display = {
      showGrid: false,
      showNumbers: false,
      showDirections: false,
      brush: state.brush,
      brushSize: state.brushSize,
    };
    Object.assign(state, showcaseConfig(id), display);
    state.tiles = generateTiles(state);
    state.variations = [];
    renderAll();
    closeMobilePanels();
  }

  function applyPreset(id) {
    if (!presetsForPattern(state.patternId).some(([presetId]) => presetId === id)) return;
    pushHistory();
    state.preset = id;
    state.tiles = generateTiles(state);
    state.variations = [];
    renderAll();
  }

  function randomize(newSeed) {
    pushHistory();
    state.seed = newSeed ? Math.floor(1 + Math.random() * 999999998) : hashSeed(state.seed, Date.now() & 0xffff);
    state.preset = "random";
    state.tiles = generateTiles(state);
    state.variations = [];
    renderAll();
    toast(t("randomized", { seed: state.seed }));
  }

  function reset() {
    pushHistory();
    const currentPattern = state.patternId;
    Object.assign(state, showcaseConfig(currentPattern));
    state.tiles = generateTiles(state);
    state.variations = [];
    renderAll();
    toast(t("resetDone"));
  }

  function brushIndices(index) {
    const n = state.grid;
    const centerX = index % n;
    const centerY = Math.floor(index / n);
    const radius = Math.floor(state.brushSize / 2);
    const indices = [];
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x >= 0 && x < n && y >= 0 && y < n) indices.push(y * n + x);
      }
    }
    return indices;
  }

  function applyBrush(index, override) {
    const mode = override || state.brush;
    if (mode === "flip" && !getPattern(state.patternId).supportsFlip) return;
    const rng = mulberry32(hashSeed(state.seed, index + Date.now()));
    brushIndices(index).forEach((tileIndex) => {
      const tile = state.tiles[tileIndex];
      if (!tile) return;
      if (mode === "rotate") tile.rotation = (tile.rotation + 1) % 4;
      if (mode === "reverse") tile.rotation = (tile.rotation + 3) % 4;
      if (mode === "flip") tile.flip = !tile.flip;
      if (mode === "random") {
        tile.rotation = Math.floor(rng() * 4);
        tile.flip = rng() > 0.5;
      }
      if (mode === "reset") {
        tile.rotation = 0;
        tile.flip = false;
      }
    });
    scheduleCanvasRender();
  }

  function setView(view) {
    if (!["play", "explore", "favorites"].includes(view)) return;
    state.view = view;
    $$(".view").forEach((section) => section.classList.toggle("is-active", section.id === `${view}View`));
    $$(".main-nav button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
    if (view === "favorites") renderFavorites();
    if (view === "explore") buildExploreCards();
    closeMobilePanels();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function recipeFromState(source) {
    const recipe = source || state;
    return {
      patternId: recipe.patternId,
      grid: recipe.grid,
      seed: recipe.seed,
      preset: recipe.preset,
      colors: structuredCloneSafe(recipe.colors),
      lineWidth: recipe.lineWidth,
      lineCount: recipe.lineCount,
      flipRate: recipe.flipRate,
      rotationRate: recipe.rotationRate,
      gap: recipe.gap,
      mirrorX: !!recipe.mirrorX,
      mirrorY: !!recipe.mirrorY,
      tiles: structuredCloneSafe(recipe.tiles || generateTiles(recipe)),
      savedAt: Date.now(),
    };
  }

  function recipeSignature(recipe) {
    return [
      recipe.patternId,
      recipe.seed,
      recipe.grid,
      recipe.preset,
      recipe.colors && recipe.colors.background,
      recipe.colors && recipe.colors.foreground,
      recipe.colors && recipe.colors.accent,
      recipe.colors && recipe.colors.secondary,
      recipe.colors && recipe.colors.tertiary,
      recipe.lineWidth,
      recipe.lineCount,
    ].join("|");
  }

  function saveFavorite(recipe) {
    const item = recipeFromState(recipe);
    const signature = recipeSignature(item);
    const existing = state.favorites.findIndex((favorite) => recipeSignature(favorite) === signature);
    if (existing >= 0) {
      state.favorites.splice(existing, 1);
      toast(t("favoriteRemoved"));
    } else {
      state.favorites.unshift(item);
      if (state.favorites.length > FAVORITES_LIMIT) state.favorites.length = FAVORITES_LIMIT;
      toast(t("favoriteSaved"));
    }
    persistFavorites();
    updateControls();
    if (state.view === "favorites") renderFavorites();
  }

  function persistFavorites() {
    try {
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
    } catch (error) {
      toast(t("storageUnavailable"));
    }
  }

  function loadFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || "[]");
      state.favorites = Array.isArray(stored) ? stored.slice(0, FAVORITES_LIMIT) : [];
    } catch (error) {
      state.favorites = [];
    }
  }

  function renderFavorites() {
    const grid = $("#favoritesGrid");
    const fragment = document.createDocumentFragment();
    state.favorites.forEach((favorite, index) => {
      const article = document.createElement("article");
      article.className = "explore-card favorite-card";
      const preview = document.createElement("div");
      preview.className = "explore-preview";
      preview.dataset.favoriteIndex = index;
      preview.appendChild(renderPatternSvg(favorite, favorite.tiles || generateTiles(favorite), { size: 600 }));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-favorite";
      remove.dataset.deleteFavorite = index;
      remove.setAttribute("aria-label", "お気に入りを削除");
      remove.textContent = "×";
      preview.appendChild(remove);
      const info = document.createElement("div");
      info.className = "explore-info";
      const text = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = getPattern(favorite.patternId).name;
      const meta = document.createElement("p");
      meta.textContent = `${presetName(favorite.preset)} · Seed ${favorite.seed}`;
      text.append(title, meta);
      info.appendChild(text);
      article.append(preview, info);
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
    $("#favoritesEmpty").classList.toggle("is-visible", !state.favorites.length);
  }

  function applyRecipe(recipe) {
    pushHistory();
    Object.keys(DEFAULTS).forEach((key) => {
      if (recipe[key] !== undefined) state[key] = structuredCloneSafe(recipe[key]);
    });
    state.tiles = recipe.tiles ? structuredCloneSafe(recipe.tiles) : generateTiles(state);
    normalizeState();
    state.variations = [];
    setView("play");
    renderAll();
  }

  function getShareParams() {
    const params = new URLSearchParams();
    params.set("pattern", state.patternId);
    params.set("seed", state.seed);
    params.set("grid", state.grid);
    params.set("preset", state.preset);
    params.set("bg", state.colors.background.slice(1));
    params.set("fg", state.colors.foreground.slice(1));
    params.set("ac", state.colors.accent.slice(1));
    params.set("s2", state.colors.secondary.slice(1));
    params.set("s3", state.colors.tertiary.slice(1));
    params.set("line", state.lineWidth);
    params.set("count", state.lineCount);
    params.set("flip", state.flipRate);
    if (state.gap) params.set("gap", state.gap);
    return params;
  }

  function updateUrl(commit) {
    try {
      const query = getShareParams().toString();
      const next = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
      if (commit) history.pushState(null, "", next);
      else history.replaceState(null, "", next);
    } catch (error) {
      // file:// and privacy modes may reject History API writes.
    }
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.size) return;
    const parsed = structuredCloneSafe(DEFAULTS);
    const integerParam = (name, min, max) => {
      if (!params.has(name)) return null;
      const raw = params.get(name);
      if (!/^\d+$/.test(raw || "")) return undefined;
      const value = Number(raw);
      return value >= min && value <= max ? value : undefined;
    };
    const colorParam = (name) => {
      if (!params.has(name)) return null;
      const raw = params.get(name);
      return /^[0-9a-f]{6}$/i.test(raw || "") ? `#${raw}`.toUpperCase() : undefined;
    };

    const pattern = params.get("pattern");
    const seed = integerParam("seed", 1, 999999999);
    const grid = integerParam("grid", 3, 30);
    const lineWidth = integerParam("line", 1, 24);
    const lineCount = integerParam("count", 3, 12);
    const flipRate = integerParam("flip", 0, 100);
    const gap = integerParam("gap", 0, 12);
    const background = colorParam("bg");
    const foreground = colorParam("fg");
    const accent = colorParam("ac");
    const secondary = colorParam("s2");
    const tertiary = colorParam("s3");
    const preset = params.get("preset");
    const invalid =
      (pattern !== null && !patterns.some((item) => item.id === pattern)) ||
      (preset !== null && !PRESETS.some(([id]) => id === preset)) ||
      [seed, grid, lineWidth, lineCount, flipRate, gap, background, foreground, accent, secondary, tertiary].some((value) => value === undefined);

    if (invalid) {
      Object.assign(state, structuredCloneSafe(DEFAULTS));
      return;
    }

    if (pattern !== null) parsed.patternId = pattern;
    if (seed !== null) parsed.seed = seed;
    if (grid !== null) parsed.grid = grid;
    if (preset !== null) parsed.preset = preset;
    if (background !== null) parsed.colors.background = background;
    if (foreground !== null) parsed.colors.foreground = foreground;
    if (accent !== null) parsed.colors.accent = accent;
    if (secondary !== null) parsed.colors.secondary = secondary;
    if (tertiary !== null) parsed.colors.tertiary = tertiary;
    if (lineWidth !== null) parsed.lineWidth = lineWidth;
    if (lineCount !== null) parsed.lineCount = lineCount;
    if (flipRate !== null) parsed.flipRate = flipRate;
    if (gap !== null) parsed.gap = gap;
    Object.assign(state, parsed);
  }

  async function copyText(text, success) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      toast(success);
    } catch (error) {
      toast(t("copyFailed"));
    }
  }

  function serializeCleanSvg(transparent) {
    const config = {
      ...structuredCloneSafe(state),
      showGrid: false,
      showNumbers: false,
      showDirections: false,
      structureLevel: 0,
    };
    const svg = renderPatternSvg(config, state.tiles, { size: 1000, clean: true, transparent });
    svg.setAttribute("width", "1000");
    svg.setAttribute("height", "1000");
    return new XMLSerializer().serializeToString(svg);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSvg() {
    try {
      const markup = serializeCleanSvg($("#transparentExport").checked);
      downloadBlob(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `tile-play-${state.patternId}-${state.seed}.svg`);
      toast(t("svgDone"));
    } catch (error) {
      toast(t("svgFailed"));
    }
  }

  function downloadJson() {
    const data = JSON.stringify(recipeFromState(), null, 2);
    downloadBlob(new Blob([data], { type: "application/json" }), `tile-play-${state.patternId}-${state.seed}.json`);
    toast(t("jsonDone"));
  }

  function downloadPng() {
    const size = clampInt($("#pngSize").value, 1024, 4096, 1024);
    const transparent = $("#transparentExport").checked;
    const markup = serializeCleanSvg(transparent);
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!transparent) {
          context.fillStyle = state.colors.background;
          context.fillRect(0, 0, size, size);
        }
        context.drawImage(image, 0, 0, size, size);
        canvas.toBlob((png) => {
          if (!png) {
            toast(t("pngFailed"));
            return;
          }
          downloadBlob(png, `tile-play-${state.patternId}-${state.seed}-${size}.png`);
          toast(t("pngDone", { size }));
        }, "image/png");
      } catch (error) {
        toast(t("pngFailed"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast(t("pngLoadFailed"));
    };
    image.src = url;
  }

  function copyCss() {
    const markup = serializeCleanSvg(false)
      .replace(/\s+/g, " ")
      .replace(/#/g, "%23")
      .replace(/"/g, "'");
    const css = `background-image: url("data:image/svg+xml,${encodeURIComponent(markup).replace(/%2523/g, "%23")}");\nbackground-size: cover;`;
    copyText(css, t("cssCopied"));
  }

  function toast(message) {
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    $("#toastRegion").appendChild(item);
    setTimeout(() => {
      item.style.opacity = "0";
      setTimeout(() => item.remove(), 180);
    }, 2600);
  }

  function showMobilePanel(panel) {
    closeMobilePanels();
    panel.classList.add("is-open");
    $("#mobileBackdrop").classList.add("is-visible");
  }

  function closeMobilePanels() {
    $(".pattern-rail").classList.remove("is-open");
    $(".settings-panel").classList.remove("is-open");
    $("#mobileBackdrop").classList.remove("is-visible");
  }

  function openExport() {
    if (typeof $("#exportDialog").showModal === "function") $("#exportDialog").showModal();
    else toast(t("exportUnsupported"));
  }

  function setStructureLevel(level) {
    state.structureLevel = ((level % 5) + 5) % 5;
    state.showGrid = state.structureLevel >= 1 && state.structureLevel <= 3;
    state.showNumbers = state.structureLevel >= 3;
    state.showDirections = state.structureLevel >= 2;
    renderAll();
  }

  function openTileMenu(index, x, y) {
    longPressIndex = index;
    const menu = $("#tileMenu");
    menu.hidden = false;
    menu.style.left = `${Math.min(window.innerWidth - 160, Math.max(8, x))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 190, Math.max(8, y))}px`;
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) setView(viewButton.dataset.view);

      const patternButton = event.target.closest("[data-pattern-id]");
      if (patternButton) selectPattern(patternButton.dataset.patternId);

      const openPattern = event.target.closest("[data-open-pattern]");
      if (openPattern) {
        selectPattern(openPattern.dataset.openPattern);
        setView("play");
      }

      const presetButton = event.target.closest("[data-preset]");
      if (presetButton) applyPreset(presetButton.dataset.preset);

      const colorButton = event.target.closest("[data-color-preset]");
      if (colorButton) {
        const preset = colorPresets.find((item) => item.id === colorButton.dataset.colorPreset);
        if (preset) {
          pushHistory();
          state.colors = {
            background: preset.background,
            foreground: preset.foreground,
            accent: preset.accent,
            secondary: preset.secondary,
            tertiary: preset.tertiary,
          };
          renderAll();
        }
      }

      const brushButton = event.target.closest("[data-brush]");
      if (brushButton) {
        state.brush = brushButton.dataset.brush;
        updateControls();
      }

      const sizeButton = event.target.closest("[data-size]");
      if (sizeButton) {
        state.brushSize = Number(sizeButton.dataset.size);
        updateControls();
      }

      const variation = event.target.closest("[data-variation-index]");
      if (variation) applyRecipe(state.variations[Number(variation.dataset.variationIndex)]);

      const quickFavorite = event.target.closest("[data-quick-favorite]");
      if (quickFavorite) {
        event.stopPropagation();
        const recipe = showcaseConfig(quickFavorite.dataset.quickFavorite);
        recipe.tiles = generateTiles(recipe);
        saveFavorite(recipe);
      }

      const favorite = event.target.closest("[data-favorite-index]");
      if (favorite && !event.target.closest("[data-delete-favorite]")) applyRecipe(state.favorites[Number(favorite.dataset.favoriteIndex)]);

      const deleteFavorite = event.target.closest("[data-delete-favorite]");
      if (deleteFavorite) {
        event.stopPropagation();
        state.favorites.splice(Number(deleteFavorite.dataset.deleteFavorite), 1);
        persistFavorites();
        renderFavorites();
        updateControls();
        toast(t("favoriteRemoved"));
      }

      const tileAction = event.target.closest("[data-tile-action]");
      if (tileAction && longPressIndex !== null) {
        pushHistory();
        applyBrush(longPressIndex, tileAction.dataset.tileAction);
        $("#tileMenu").hidden = true;
      } else if (!event.target.closest("#tileMenu")) {
        $("#tileMenu").hidden = true;
      }
    });

    $("#patternSearch").addEventListener("input", (event) => renderPatternList(event.target.value));
    $("#openExploreButton").addEventListener("click", () => setView("explore"));
    $("#randomButton").addEventListener("click", () => randomize(true));
    $("#mobileRandomButton").addEventListener("click", () => randomize(true));
    $("#newSeedButton").addEventListener("click", () => randomize(true));
    $("#resetButton").addEventListener("click", reset);
    $("#undoButton").addEventListener("click", undo);
    $("#redoButton").addEventListener("click", redo);
    $("#exportButton").addEventListener("click", openExport);
    $("#moreVariationsButton").addEventListener("click", () => {
      generateVariations();
      renderVariations();
    });
    $("#favoriteButton").addEventListener("click", () => saveFavorite());
    $("#copySeedButton").addEventListener("click", () => copyText(String(state.seed), t("seedCopied")));
    $("#shareButton").addEventListener("click", () => {
      updateUrl(true);
      copyText(location.href, t("urlCopied"));
    });
    $("#invertColorButton").addEventListener("click", () => {
      pushHistory();
      [state.colors.background, state.colors.foreground] = [state.colors.foreground, state.colors.background];
      renderAll();
    });
    $("#structureButton").addEventListener("click", () => {
      pushHistory();
      setStructureLevel(state.structureLevel + 1);
    });
    $("#gridButton").addEventListener("click", () => {
      pushHistory();
      state.showGrid = !state.showGrid;
      state.structureLevel = 0;
      renderAll();
    });
    $("#fullscreenButton").addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await $("#canvasStage").requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) {
        toast(t("fullscreenFailed"));
      }
    });

    $("#mobilePatternsButton").addEventListener("click", () => showMobilePanel($(".pattern-rail")));
    $("#mobileSettingsButton").addEventListener("click", () => showMobilePanel($(".settings-panel")));
    $("#mobileRotateButton").addEventListener("click", () => {
      if (getPattern(state.patternId).supportsFlip) {
        state.brush = state.brush === "rotate" ? "flip" : "rotate";
      } else {
        state.brush = "rotate";
      }
      updateControls();
    });
    $("#languageSelect").addEventListener("change", (event) => {
      language = event.target.value === "en" ? "en" : "ja";
      try {
        localStorage.setItem(STORAGE_KEYS.language, language);
      } catch (error) {
        // Language still changes for this session when storage is unavailable.
      }
      applyLanguage();
      renderPatternList($("#patternSearch").value || "");
      buildExploreCards();
      if (state.view === "favorites") renderFavorites();
    });
    $("#mobileBackdrop").addEventListener("click", closeMobilePanels);
    $$("[data-close-panel]").forEach((button) => button.addEventListener("click", closeMobilePanels));

    $("#exploreFilters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.exploreFilter = button.dataset.filter;
      $$("#exploreFilters button").forEach((item) => item.classList.toggle("is-active", item === button));
      buildExploreCards();
    });

    [
      ["gridRange", "grid"],
      ["lineWidthRange", "lineWidth"],
      ["lineCountRange", "lineCount"],
      ["flipRateRange", "flipRate"],
      ["rotationRateRange", "rotationRate"],
    ].forEach(([id, key]) => {
      const input = $(`#${id}`);
      input.addEventListener("pointerdown", () => {
        controlStartSnapshot = snapshot();
      });
      input.addEventListener("input", () => {
        state[key] = Number(input.value);
        if (key === "lineCount") state.lineWidth = Math.min(state.lineWidth, safeRibbonLineWidth(state.lineCount));
        if (key === "grid") state.tiles = generateTiles(state);
        if (key === "flipRate" || key === "rotationRate") state.tiles = generateTiles(state);
        updateControls();
        scheduleCanvasRender();
      });
      input.addEventListener("change", () => {
        if (controlStartSnapshot) pushHistory(controlStartSnapshot);
        controlStartSnapshot = null;
        state.variations = [];
        renderAll();
      });
    });

    ["mirrorXToggle", "mirrorYToggle"].forEach((id) => {
      $(`#${id}`).addEventListener("change", (event) => {
        pushHistory();
        state[id === "mirrorXToggle" ? "mirrorX" : "mirrorY"] = event.target.checked;
        state.tiles = generateTiles(state);
        renderAll();
      });
    });

    [
      ["showGridToggle", "showGrid"],
      ["showNumbersToggle", "showNumbers"],
      ["showDirectionsToggle", "showDirections"],
    ].forEach(([id, key]) => {
      $(`#${id}`).addEventListener("change", (event) => {
        pushHistory();
        state[key] = event.target.checked;
        state.structureLevel = 0;
        renderAll();
      });
    });

    [
      ["backgroundColor", "background"],
      ["foregroundColor", "foreground"],
      ["accentColor", "accent"],
      ["secondaryColor", "secondary"],
      ["tertiaryColor", "tertiary"],
    ].forEach(([id, key]) => {
      const input = $(`#${id}`);
      input.addEventListener("focus", () => {
        controlStartSnapshot = snapshot();
      });
      input.addEventListener("input", () => {
        state.colors[key] = input.value.toUpperCase();
        scheduleCanvasRender();
        renderBaseTile();
      });
      input.addEventListener("change", () => {
        if (controlStartSnapshot) pushHistory(controlStartSnapshot);
        controlStartSnapshot = null;
        renderAll();
      });
    });

    $("#seedInput").addEventListener("change", (event) => {
      pushHistory();
      state.seed = clampInt(event.target.value, 1, 999999999, DEFAULTS.seed);
      state.tiles = generateTiles(state);
      state.variations = [];
      renderAll();
    });

    const canvas = $("#patternCanvas");
    canvas.addEventListener("pointerdown", (event) => {
      const tile = event.target.closest(".tile-cell");
      if (!tile) return;
      event.preventDefault();
      const index = Number(tile.dataset.index);
      const now = Date.now();
      const touchDouble = event.pointerType === "touch" && lastTouch.index === index && now - lastTouch.time < 330;
      lastTouch = { index, time: now };
      pushHistory();
      activePointer = { id: event.pointerId, visited: new Set([index]) };
      canvas.setPointerCapture(event.pointerId);
      applyBrush(index, touchDouble ? "flip" : event.shiftKey ? "reverse" : null);
      tile.classList.add("is-touched");
      longPressIndex = index;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (activePointer && activePointer.visited.size === 1) openTileMenu(index, event.clientX, event.clientY);
      }, 560);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!activePointer || activePointer.id !== event.pointerId) return;
      event.preventDefault();
      const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile-cell");
      if (!tile || !canvas.contains(tile)) return;
      const index = Number(tile.dataset.index);
      if (activePointer.visited.has(index)) return;
      activePointer.visited.add(index);
      clearTimeout(longPressTimer);
      applyBrush(index, event.shiftKey ? "reverse" : null);
    });

    const endPointer = () => {
      clearTimeout(longPressTimer);
      activePointer = null;
      updateUrl(false);
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("dblclick", (event) => {
      const tile = event.target.closest(".tile-cell");
      if (!tile) return;
      event.preventDefault();
      applyBrush(Number(tile.dataset.index), "flip");
    });

    $("#downloadPngButton").addEventListener("click", downloadPng);
    $("#downloadSvgButton").addEventListener("click", downloadSvg);
    $("#downloadJsonButton").addEventListener("click", downloadJson);
    $("#copyCssButton").addEventListener("click", copyCss);
    $("#guideDialog").addEventListener("close", () => {
      if ($("#hideGuideToggle").checked) {
        try {
          localStorage.setItem(STORAGE_KEYS.guide, "1");
        } catch (error) {
          // Ignore private mode storage errors.
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      const tag = event.target.tagName;
      const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if (event.key === "Escape") {
        closeMobilePanels();
        $("#tileMenu").hidden = true;
        $$(".modal[open]").forEach((dialog) => dialog.close());
        return;
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (key === "r") randomize(true);
      if (key === "f") {
        state.brush = "flip";
        updateControls();
        toast(t("flipBrushSelected"));
      }
      if (key === "g") {
        pushHistory();
        state.showGrid = !state.showGrid;
        renderAll();
      }
      if (key === "s") {
        pushHistory();
        setStructureLevel(state.structureLevel + 1);
      }
      if (key === "e") openExport();
      if (["1", "2", "3"].includes(key)) {
        state.brushSize = [1, 3, 5][Number(key) - 1];
        updateControls();
      }
    });

    window.addEventListener("popstate", () => {
      loadFromUrl();
      state.tiles = generateTiles(state);
      renderAll();
    });
  }

  function showGuideIfNeeded() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.guide)) setTimeout(() => $("#guideDialog").showModal(), 420);
    } catch (error) {
      // The app remains usable without localStorage.
    }
  }

  function init() {
    loadLanguage();
    loadFavorites();
    loadFromUrl();
    normalizeState();
    state.tiles = generateTiles(state);
    buildStaticUi();
    generateVariations();
    renderAll();
    applyLanguage();
    showGuideIfNeeded();
  }

  init();
})();
