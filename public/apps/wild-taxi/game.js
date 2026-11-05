import { TaxiView, paperStyleEnabled } from "./render.js";
import { bindDrivingControls } from "./driving-controls.js";
import { StartDash } from "./start-dash.js";
import { Boarding, DOOR_CLOSE_TIME } from "./boarding.js";
import { passengerForStage } from "./passengers.js";
import { recordTourLeg, summarizeTour } from "./tour-results.js";
import { populateEnding, previewTour } from "./ending-ui.js";
import { routeFor, createRun, dragSteer, holdAccelerator, useItem, tick } from "./simulation.js";
import { buildTrack } from "./track.js";
import { TaxiFX } from "./fx.js";
import { receipt, settlement, money } from "./settlement.js";
import { CityWorld } from "./city-world.js";
import { ArcadePhysics } from "./physics.js";
import { missionAt, targetTime, rankRun } from "./tour.js";
import { TokyoWeather, weatherState, weatherLabel } from "./weather.js";
import { ResultShare } from "./result-actions.js";
import { DebugOptions, CAMERA_NAMES, adjacentCorner } from "./debug.js";
import { courseTimeLimit } from "./run-rules.js";
import { ITEMS, ITEM_KINDS, normalizeItem, itemIcon } from "./items.js";
import { SaveStore, resumeCheckpoint } from "./saves.js";

const $ = (id) => document.getElementById(id),
  share = new ResultShare();
let data, view, fx, physics, track, run, previewRun, route, weather;
let mode = "menu",
  paused = false,
  last = 0,
  startDash = null,
  boarding = null,
  miniTime = 0,
  from = 0,
  to = 1,
  legIndex = 0,
  deliveries = 0,
  visited = [],
  best = {},
  missionSeed = 41,
  lastWorldPaint = -Infinity,
  restoreAfterModal = false;
let currentWeather = weatherState(null),
  liveWeather = currentWeather,
  wreckTimer = 0;
const debug = new DebugOptions(),
  debugTracks = new Map();
let driving;
const keys = { left: false, right: false };
const accelerator = $("accelerator"),
  saves = new SaveStore({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
let journey = null,
  saveIntent = "load",
  shownItem;
let endingPreview = false,
  endingClock = 0;
for (const kind of ITEM_KINDS) {
  const guide = document.createElement("div");
  guide.style.setProperty("--item-color", ITEMS[kind].color);
  guide.innerHTML = itemIcon(kind) + "<b></b><small></small>";
  guide.querySelector("b").textContent = ITEMS[kind].name;
  guide.querySelector("small").textContent = ITEMS[kind].effect;
  $("itemGuide").append(guide);
}
try {
  const save = JSON.parse(localStorage.getItem("tokyo-taxi-v2") || "{}");
  deliveries = save.deliveries || 0;
  visited = save.visited || [];
  best = save.best || {};
} catch {}
function persist() {
  try {
    localStorage.setItem("tokyo-taxi-v2", JSON.stringify({ deliveries, visited, best }));
  } catch {}
}
function sample(d) {
  return track.sample(d);
}
function setScreen(screen) {
  for (const name of ["title", "mission", "result", "ending"]) $(name + "Screen").hidden = name !== screen;
  $("hud").hidden = screen !== "playing";
  if (screen !== "playing") {
    $("launchHint").hidden = true;
    $("boardingCue").hidden = true;
  }
  $("inspectHud").hidden = screen !== "inspect";
  document.body.dataset.screen = screen;
  document.body.classList.toggle("playing", screen === "playing");
  document.body.classList.toggle("result", screen === "result");
  lastWorldPaint = -Infinity;
}
function updateWeatherLabel() {
  const state = currentWeather,
    text = (state.source === "debug" ? "DEBUG · " : "") + weatherLabel(state) + (state.lights ? " · ライトON" : "");
  if ($("weather").textContent !== text) $("weather").textContent = text;
}
function applyWeather(incoming) {
  liveWeather = incoming;
  currentWeather = debug.weather(liveWeather);
  const state = currentWeather;
  if (mode !== "ending") view?.setWeather(state);
  if (fx) {
    fx.weather = state;
    fx.setBgmPhase(state.phase);
  }
  // 走り出す前（タイトル・ミッション画面）に時間帯が変わったら、その時間帯の配置で作り直す
  if (data && run && run.phase !== state.phase && ["menu", "briefing"].includes(mode) && !view?.inspection) {
    setupRoute();
  }
  updateWeatherLabel();
  $("weather").title =
    state.source === "debug"
      ? "デバッグの天気を表示中"
      : state.source === "live"
        ? "東京の最新天気に連動（15分ごと更新）"
        : state.source === "cached"
          ? "通信できないため、前回取得した天気を表示中"
          : "天気を取得できません。東京の時刻で明るさを切り替えます。";
  lastWorldPaint = -Infinity;
}
function setupRoute() {
  const stage = missionAt(legIndex, data.stations.length);
  from = stage.from;
  to = stage.to;
  route = routeFor(data, from, to);
  track = buildTrack(route.points);
  route.points = track.points;
  // 昼・夕・夜でコース配置が変わる（同じ時間帯なら同じ配置）
  run = createRun(track.length, missionSeed + from * 31 + to, currentWeather?.phase || "day");
  run.passenger = passengerForStage(legIndex, missionSeed);
  run.limit = run.remaining = courseTimeLimit(track);
  run.debug = debug.enabled;
  if (debug.enabled) {
    run.crashes = debug.damage;
    run.item = debug.item;
  }
  view.inspection = null;
  run.environment = new CityWorld(track, run.seed);
  physics.reset(run.environment, run);
  view.setRoute(track.points, sample, run);
  fx.reset();
  previewRun = { ...run };
  $("missionStage").textContent = `山手線 ${stage.number} / ${stage.total}`;
  $("missionNumber").textContent = stage.number;
  $("missionHeading").setAttribute("aria-label", "Mission " + stage.number);
  $("autoSaveState").textContent = "";
  $("tourProgress").style.width = (stage.number / stage.total) * 100 + "%";
  $("missionFrom").textContent = data.stations[from].name;
  $("missionTo").textContent = data.stations[to].name;
  $("missionScreen").style.setProperty("--route-chars", data.stations[from].name.length + data.stations[to].name.length + 3.5);
  $("tripDistance").textContent = (run.length / 1000).toFixed(2) + " km";
  $("tripTime").textContent = run.limit;
  $("missionTarget").textContent = `無事故 ＋ ${targetTime(run.length).toFixed(1)}秒以内で SSS`;
  $("hudStage").textContent = `山手線 ${stage.number} / ${stage.total}`;
  $("fromLabel").textContent = data.stations[from].name;
  $("toLabel").textContent = data.stations[to].name;
}
function closeDialogs() {
  restoreAfterModal = false;
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
}
function showTitle() {
  leaveEnding();
  if (view) view.inspection = null;
  if (previewRun) previewRun.distance = 0;
  releaseControls();
  closeDialogs();
  mode = "menu";
  paused = false;
  $("count").textContent = "";
  share.clear();
  setScreen("title");
  updateContinue();
}
function showMission() {
  leaveEnding();
  releaseControls();
  closeDialogs();
  mode = "briefing";
  paused = false;
  $("count").textContent = "";
  share.clear();
  setupRoute();
  setScreen("mission");
}
function newTour() {
  debug.reset();
  applyWeather(liveWeather);
  legIndex = 0;
  missionSeed = (missionSeed + 97) % 0x80000000;
  journey = { nextStage: 0, seed: missionSeed };
  showMission();
}
function start(startProgress = 0) {
  leaveEnding();
  releaseControls();
  closeDialogs();
  share.clear();
  setupRoute();
  if (!run.debug)
    journey = {
      nextStage: legIndex,
      seed: missionSeed,
      ...(journey?.seed === missionSeed && journey.results ? { results: journey.results } : {}),
    };
  if (typeof startProgress === "number" && startProgress > 0) {
    run.distance = Math.min(run.length - 8, (run.length * startProgress) / 100);
    physics.sync(run.distance);
  }
  fx.unlock();
  boarding = new Boarding();
  run.boarding = 0;
  startDash = null;
  mode = "boarding";
  paused = false;
  last = performance.now();
  $("pause").textContent = "Ⅱ";
  $("pause").setAttribute("aria-label", "一時停止");
  setScreen("playing");
  $("count").textContent = "";
  $("boardingDestination").textContent = data.stations[to].name + "まで！";
  $("count").style.fontSize = "90px";
  updateHud();
  drawMap();
}
async function init() {
  const initial = await Promise.all([
    fetch("tokyo.json").then((r) => {
      if (!r.ok) throw Error("地図を読み込めません");
      return r.json();
    }),
    ArcadePhysics.init(),
  ]);
  data = initial[0];
  physics = initial[1];
  await document.fonts.load(
    '900 24px "Cityline Noto JP"',
    data.stations.map((s) => s.name).join(" → ") + " スタートダッシュ！エンスト！そのまま長押し！早すぎ！",
  );
  view = new TaxiView($("world"));
  // 自動確認用フック（URLに ?qa を付けた時だけ）
  if (/[?&]qa\b/.test(location.search))
    window.__wildTaxi = {
      view,
      get fx() {
        return fx;
      },
      get run() {
        return run;
      },
      get mode() {
        return mode;
      },
    };
  fx = new TaxiFX();
  view.onLost = () => {
    paused = true;
    $("error").hidden = false;
    $("error").textContent = "描画が中断されました。再読み込みしてください。";
  };
  driving = bindDrivingControls({
    surface: view.canvas,
    accelerator,
    item: $("item"),
    root: document,
    enabled: () => ["count", "play"].includes(mode) && !paused && !document.querySelector("dialog[open]"),
    onAccelerate: (held) => {
      if (mode === "count") startDash?.setHeld(held);
      if (run) holdAccelerator(run, held);
      accelerator.classList.toggle("pressed", held);
    },
    onSteer: (pixels) => dragSteer(run, pixels, innerWidth),
    onItem: () => useItem(run),
    onUnlock: () => fx.unlock(),
  });
  applyWeather(currentWeather);
  setupRoute();
  for (let i = 0; i < data.stations.length; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i + 1}. ${data.stations[i].name} → ${data.stations[(i + 1) % 30].name}`;
    $("debugCourse").append(option);
  }
  $("debugOpen").disabled = false;
  $("debugQuick").disabled = false;
  $("saveOpen").disabled = false;
  updateContinue();
  weather = new TokyoWeather(applyWeather);
  weather.start();
  $("depart").textContent = "出発";
  $("depart").disabled = false;
  window.addEventListener("resize", () => {
    view.resize();
    fx.resize();
    lastWorldPaint = -Infinity;
  });
  // 画面のリフレッシュに同期した30fps（60/90/120Hzどれでも等間隔に間引く）。
  // setIntervalより描画タイミングが揃い、非表示タブでは自動で止まる。
  let lastTick = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (now - lastTick < 1000 / 30 - 3) return;
    lastTick = now;
    frame(now);
  };
  requestAnimationFrame(loop);
  setInterval(updateWeatherLabel, 1000);
}
// 最初のタップでオーディオを解禁（タイトルからBGMを流す）
for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => fx?.unlock(), { capture: true, passive: true });
$("depart").onclick = newTour;
$("start").onclick = start;
$("retry").onclick = start;
$("missionBack").onclick = showTitle;
$("backTitle").onclick = showTitle;
$("nextTrip").onclick = () => {
  if (run.status === "delivered") {
    if (legIndex === data.stations.length - 1) {
      showEnding();
      return;
    }
    legIndex++;
  }
  showMission();
};

function openDialog(id) {
  if (!document.querySelector("dialog[open]")) {
    restoreAfterModal = ["boarding", "count", "play", "wreck"].includes(mode) && !paused;
    if (restoreAfterModal) pause();
  }
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  $(id).showModal();
  releaseControls();
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("close", () => {
    if (document.querySelector("dialog[open]")) return;
    if (restoreAfterModal) {
      restoreAfterModal = false;
      if (paused && ["boarding", "count", "play", "wreck"].includes(mode)) pause();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    }
  });
  for (const button of dialog.querySelectorAll(".close-dialog")) button.onclick = () => dialog.close();
}
function updateContinue() {
  $("continueOpen").disabled = !data || !saves.hasAny;
  $("continueOpen").title = saves.hasAny ? "セーブしたミッションから再開" : "セーブデータはまだありません";
}
function checkpointLabel(value) {
  if (value.nextStage === 30) return { mission: "全30区間クリア", route: "エンディングを見る" };
  const stage = missionAt(value.nextStage, data.stations.length);
  return { mission: "Mission " + stage.number, route: data.stations[stage.from].name + " → " + data.stations[stage.to].name };
}
function currentCheckpoint() {
  return debug.enabled || run?.debug ? null : journey || saves.get("auto");
}
function saveFeedback(message, error = false) {
  $("saveStatus").textContent = message;
  $("saveStatus").classList.toggle("error", error);
}
function renderSaves() {
  const checkpoint = currentCheckpoint();
  $("saveHeading").textContent = saveIntent === "load" ? "つづきから" : "セーブ／ロード";
  $("saveCurrent").textContent =
    saveIntent === "load"
      ? "再開するデータを選んでください。"
      : checkpoint
        ? "現在：" + checkpointLabel(checkpoint).mission + " · " + checkpointLabel(checkpoint).route
        : debug.enabled
          ? "デバッグ中は保存しません。"
          : "ミッションを始めると手動保存できます。";
  $("saveList").replaceChildren();
  for (const slot of ["auto", 0, 1, 2]) {
    const saved = saves.get(slot),
      row = document.createElement("div");
    row.className = "save-entry" + (slot === "auto" ? " auto" : "");
    row.dataset.slot = slot;
    const info = document.createElement("div");
    info.className = "save-info";
    const caption = document.createElement("span");
    caption.textContent = slot === "auto" ? "AUTO SAVE" : "SLOT " + (slot + 1);
    const title = document.createElement("strong"),
      route = document.createElement("small");
    info.append(caption, title, route);
    if (saved) {
      const label = checkpointLabel(saved);
      title.textContent = label.mission;
      route.textContent = label.route;
      const time = document.createElement("time");
      time.dateTime = new Date(saved.updatedAt).toISOString();
      time.textContent = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
        saved.updatedAt,
      );
      info.append(time);
    } else {
      title.textContent = slot === "auto" ? "まだ記録はありません" : "空きスロット";
      route.textContent = slot === "auto" ? "区間クリア時に自動保存" : "—";
    }
    const actions = document.createElement("div");
    actions.className = "save-actions";
    if (slot !== "auto" && saveIntent === "manage") {
      const button = document.createElement("button");
      button.className = "ghost save-slot";
      button.textContent = "保存";
      button.disabled = !checkpoint;
      button.setAttribute("aria-label", "スロット" + (slot + 1) + "に保存");
      button.onclick = () => {
        if (!currentCheckpoint()) return;
        const ok = saves.write(slot, currentCheckpoint());
        renderSaves();
        updateContinue();
        saveFeedback(
          ok ? "スロット " + (slot + 1) + " に保存しました。" : "保存できませんでした。ブラウザの保存設定を確認してください。",
          !ok,
        );
      };
      actions.append(button);
    }
    const load = document.createElement("button");
    load.className = "primary load-save";
    load.textContent = saved?.nextStage === 30 ? "見る" : "再開";
    load.disabled = !saved;
    load.setAttribute("aria-label", (slot === "auto" ? "オートセーブ" : "スロット" + (slot + 1)) + "から再開");
    load.onclick = () => {
      const value = saves.get(slot);
      if (!value) return;
      debug.reset();
      applyWeather(liveWeather);
      if (value.nextStage === 30) {
        journey = { ...value };
        legIndex = 29;
        missionSeed = value.seed;
        setupRoute();
        showEnding();
        return;
      }
      const progress = resumeCheckpoint(value);
      journey = progress;
      legIndex = progress.nextStage;
      missionSeed = progress.seed;
      showMission();
    };
    actions.append(load);
    row.append(info, actions);
    $("saveList").append(row);
  }
}
function openSaves(intent) {
  if (!data) return;
  saveIntent = intent;
  renderSaves();
  saveFeedback(saves.error === "read" ? "保存データを読み込めませんでした。" : "", saves.error === "read");
  openDialog("saveDialog");
}
$("continueOpen").onclick = () => openSaves("load");
$("saveOpen").onclick = () => openSaves("manage");
$("howtoOpen").onclick = () => openDialog("howtoDialog");
$("settingsQuick").onclick = () => openDialog("settingsDialog");
function selectedDebugTrack() {
  const i = Number($("debugCourse").value) || 0;
  if (!debugTracks.has(i)) {
    const stage = missionAt(i, data.stations.length);
    debugTracks.set(i, buildTrack(routeFor(data, stage.from, stage.to).points));
    if (debugTracks.size > 4) debugTracks.delete(debugTracks.keys().next().value);
  }
  return debugTracks.get(i);
}
function readDebug() {
  debug.course = Number($("debugCourse").value) || 0;
  debug.position = Number($("debugPosition").value) || 0;
  debug.phase = $("debugPhase").value;
  debug.kind = $("debugWeather").value;
  debug.lights = $("debugLights").value;
  debug.camera = $("debugCamera").value;
  debug.damage = Number($("debugDamage").value) || 0;
  debug.item = normalizeItem($("debugItem").value);
}
function updateInspection() {
  if (!data) return;
  const chosen = selectedDebugTrack(),
    distance = Math.min(chosen.length - 8, (chosen.length * debug.position) / 100),
    text = Math.round(distance) + " / " + Math.round(chosen.length) + " m";
  $("debugPosition").value = $("inspectPosition").value = debug.position;
  $("debugPositionValue").textContent = $("inspectPositionValue").textContent = text;
  $("inspectCamera").textContent = "視点：" + CAMERA_NAMES[debug.camera];
  if (mode === "inspect" && debug.course === legIndex) {
    run.distance = distance;
    previewRun.distance = distance;
    previewRun.crashes = debug.damage;
    previewRun.item = debug.item;
    view.inspection = { distance, camera: debug.camera };
    lastWorldPaint = -Infinity;
  }
}
function openDebugger() {
  if (!data) return;
  if (!debug.enabled) {
    debug.course = legIndex;
    debug.position = (run.distance / run.length) * 100;
    debug.damage = run.crashes ? 1 : 0;
  }
  $("debugCourse").value = debug.course;
  $("debugPhase").value = debug.phase;
  $("debugWeather").value = debug.kind;
  $("debugLights").value = debug.lights;
  $("debugCamera").value = debug.camera;
  $("debugDamage").value = debug.damage;
  $("debugItem").value = debug.item || "none";
  updateInspection();
  openDialog("debugDialog");
}
$("debugOpen").onclick = $("debugQuick").onclick = $("inspectSettings").onclick = openDebugger;
for (const id of ["debugPhase", "debugWeather", "debugLights", "debugCamera", "debugDamage", "debugItem"])
  $(id).onchange = () => {
    readDebug();
    if (debug.enabled) {
      applyWeather(liveWeather);
      if (run) run.debug = true;
      updateInspection();
    }
  };
$("debugCourse").onchange = () => {
  readDebug();
  debug.position = 0;
  updateInspection();
};
$("debugPosition").oninput = () => {
  readDebug();
  updateInspection();
};
$("inspectPosition").oninput = () => {
  debug.position = Number($("inspectPosition").value);
  updateInspection();
};
function jumpDebug(direction) {
  readDebug();
  const t = selectedDebugTrack();
  debug.position = (adjacentCorner(t, (t.length * debug.position) / 100, direction) / t.length) * 100;
  updateInspection();
}
$("debugPrev").onclick = $("inspectPrev").onclick = () => jumpDebug(-1);
$("debugNext").onclick = $("inspectNext").onclick = () => jumpDebug(1);
$("inspectCamera").onclick = () => {
  const names = Object.keys(CAMERA_NAMES);
  debug.camera = names[(names.indexOf(debug.camera) + 1) % names.length];
  $("debugCamera").value = debug.camera;
  updateInspection();
};
$("debugPreview").onclick = async () => {
  if (!data) return;
  readDebug();
  $("debugPreview").disabled = true;
  try {
    await new Promise(requestAnimationFrame);
    debug.enabled = true;
    legIndex = debug.course;
    closeDialogs();
    mode = "inspect";
    paused = false;
    $("count").textContent = "";
    setupRoute();
    setScreen("inspect");
    applyWeather(liveWeather);
    $("inspectRoute").textContent = `${data.stations[from].name} → ${data.stations[to].name}`;
    updateInspection();
  } finally {
    $("debugPreview").disabled = false;
  }
};
function driveDebug() {
  readDebug();
  debug.enabled = true;
  legIndex = debug.course;
  applyWeather(liveWeather);
  start(debug.position);
}
$("debugDrive").onclick = $("inspectDrive").onclick = driveDebug;
$("inspectTitle").onclick = showTitle;
$("debugReset").onclick = () => {
  debug.reset();
  if (journey) {
    const p = resumeCheckpoint(journey);
    legIndex = p.nextStage;
    missionSeed = p.seed;
  } else legIndex = 0;
  closeDialogs();
  setupRoute();
  applyWeather(liveWeather);
  showTitle();
};
$("sound").onchange = () => fx?.setMuted(!$("sound").checked);
$("bgm").onchange = () => fx?.setBgm($("bgm").checked);
$("paperStyle").checked = paperStyleEnabled();
$("paperStyle").onchange = () => {
  const on = $("paperStyle").checked;
  try {
    localStorage.setItem("taxi-paper-style", on ? "on" : "off");
  } catch {}
  view?.setPaperStyle(on);
  lastWorldPaint = -Infinity;
};
$("volume").oninput = () => {
  fx?.setVolume(Number($("volume").value) / 100);
  $("volumeValue").textContent = $("volume").value + "%";
};
$("volume").onchange = () => {
  fx?.unlock();
  fx?.sound("bonus");
};
$("detailsOpen").onclick = () => {
  $("detailsHeading").textContent = "営業の内訳";
  $("detailBody").replaceChildren(receipt(run));
  openDialog("detailsDialog");
};
$("creditsOpen").onclick = () => {
  $("detailsHeading").textContent = "地図・クレジット";
  $("detailBody").innerHTML =
    '<p>道路はOpenStreetMap由来の実道路ルートです。道幅・高低差・通行方向はゲーム用に簡略化しています。街の建物やプロップは手続き生成です。</p><p>天気は東京駅付近のOpen-Meteo最新データに連動し、15分ごとに更新。取得できない場合は前回値、または東京の時刻による昼夜表示になります。</p><p>Three.js / Rapier / Clipper<br>Dela Gothic One / Zen Kaku Gothic New / Oswald / Noto Sans JP</p><p><a href="tokyo.json" download>道路データ（ODbL）</a> · <a href="vendor/CLIPPER-LICENSE.txt" target="_blank" rel="noopener">Clipper license</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>';
  openDialog("detailsDialog");
};
function shareFallback(message = downloadsApi ? "「画像を保存」→共有シートでXを選ぶと画像付きで投稿できます。" : "「Xで投稿」で画像をコピーして投稿画面を開きます。投稿欄にペーストして添付してください。") {
  $("shareStatus").textContent = "";
  $("shareHint").textContent = message;
  $("openX").href = share.intent;
  if (share.url) {
    $("shareImage").src = share.url;
    $("saveImage").href = share.url;
    $("saveImage").download = share.filename || "wild-taxi-result.png";
    $("saveImage").hidden = false;
  } else {
    $("shareImage").removeAttribute("src");
    $("saveImage").hidden = true;
    $("shareHint").textContent = "この端末では画像を作成できませんでした。投稿文はXへ渡せます。";
  }
  openDialog("shareDialog");
}
// claude.ai の公開ページ内では Web Share が使えないため、downloads 機能（iPhoneアプリでは共有シート）で画像を渡す。
let downloadsApi = null;
window.claude?.use?.("downloads").then((d) => (downloadsApi = d)).catch(() => {});
async function shareBlob() {
  if (share.file) return share.file;
  if (!share.url) return null;
  return (await fetch(share.url)).blob();
}
function copyImageToClipboard() {
  // タップ処理の中で同期的に呼ぶ（Safari はユーザー操作中の Promise 付き ClipboardItem だけ許可）
  try {
    if (!share.url || !window.ClipboardItem || !navigator.clipboard?.write) return Promise.reject();
    const item = new ClipboardItem({ "image/png": shareBlob().then((b) => new Blob([b], { type: "image/png" })) });
    return navigator.clipboard.write([item]);
  } catch (e) {
    return Promise.reject(e);
  }
}
$("shareX").onclick = $("endingShare").onclick = () => {
  if (share.canShare())
    share.nativeShare().catch((error) => {
      if (error.name !== "AbortError") shareFallback("共有を開けませんでした。画像保存とX投稿を個別に行えます。");
    });
  else shareFallback();
};
$("saveImage").onclick = (e) => {
  if (downloadsApi && share.url) {
    e.preventDefault();
    const filename = share.filename || "wild-taxi-result.png";
    shareBlob()
      .then((data) => downloadsApi.save({ filename, data }))
      .then(() => ($("shareStatus").textContent = "画像を書き出しました。共有シートからXを選ぶと画像付きで投稿できます"))
      .catch((err) => {
        if (err?.code === "declined") return;
        $("shareStatus").textContent = "画像は長押しでも保存できます";
      });
    return;
  }
  $("shareStatus").textContent = "画像は長押しでも保存できます";
};
// Xで投稿：投稿画面を開く前に画像をクリップボードへ（投稿欄で長押し→ペーストで添付できる）
$("openX").onclick = () => {
  copyImageToClipboard()
    .then(() => ($("shareStatus").textContent = "画像をコピーしました。Xの投稿欄で長押し→ペーストで添付できます"))
    .catch(() => {});
};
$("copyResult").onclick = async () => {
  try {
    await navigator.clipboard.writeText(share.text);
    $("shareStatus").textContent = "投稿文をコピーしました";
  } catch {
    $("shareStatus").textContent = "コピーに対応していません。「Xで投稿」を使ってください";
  }
};

function pause() {
  if (!["boarding", "count", "play", "wreck"].includes(mode)) return;
  paused = !paused;
  releaseControls();
  updateHud();
  $("pause").textContent = paused ? "▶" : "Ⅱ";
  $("pause").setAttribute("aria-label", paused ? "再開" : "一時停止");
  $("count").style.fontSize = paused ? "36px" : "90px";
  $("count").textContent = paused ? "PAUSE" : "";
  last = performance.now();
}
$("pause").onclick = pause;
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !paused && ["boarding", "count", "play", "wreck"].includes(mode)) pause();
  else if (!document.hidden && weather) {
    if (Date.now() - (weather.payload?.current?.time || 0) * 1000 > 15 * 60000) weather.refresh();
    else weather.emit();
  }
});
window.addEventListener("blur", () => {
  if (!paused && ["boarding", "count", "play", "wreck"].includes(mode)) pause();
});
function releaseControls() {
  driving?.release();
  keys.left = keys.right = false;
  if (run) {
    run.steer = 0;
    holdAccelerator(run, false);
  }
  accelerator.classList.remove("pressed");
}
window.addEventListener("keydown", (e) => {
  if (!["count", "play"].includes(mode) || paused || document.querySelector("dialog[open]")) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "w", "W"].includes(e.key)) e.preventDefault();
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  run.steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") driving.setKeyboardAccelerator(true);
  if (e.key === " " && !e.repeat && mode === "play") useItem(run);
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
  if (run) run.steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") driving?.setKeyboardAccelerator(false);
});
function updateHud() {
  $("boardingCue").hidden = mode !== "boarding" || paused;
  accelerator.disabled = paused || !["count", "play"].includes(mode);
  accelerator.classList.toggle("launch-ready", mode === "count" && startDash?.outcome === "dash");
  accelerator.classList.toggle("launch-early", mode === "count" && startDash?.outcome === "stall");
  $("launchHint").hidden = mode !== "count" || paused;
  $("launchHint").textContent = startDash?.held
    ? startDash.outcome === "dash"
      ? "そのまま長押し！"
      : startDash.outcome === "stall"
        ? "早すぎ！"
        : ""
    : "「3→2」で長押し！";
  $("count").classList.toggle("dash-window", mode === "count" && startDash?.windowOpen);
  accelerator.classList.toggle("pressed", run.gasHeld && !paused);
  $("acceleratorHelp").textContent = run.gasHeld ? "加速中" : "長押し";
  document.querySelector(".speed").classList.toggle("boosting", run.boostActive);
  document.querySelector(".speed").classList.toggle("accelerating", run.gasHeld);
  Object.assign(view.canvas.dataset, {
    phase: mode,
    boarding: Number.isFinite(run.boarding) ? run.boarding.toFixed(3) : "",
    accelerating: String(run.gasHeld),
    speed: run.speed.toFixed(2),
    boosting: String(run.boostActive),
    start: run.startType,
    stall: run.stall.toFixed(2),
    item: run.item || "",
    lateral: run.x.toFixed(3),
    target: run.targetX.toFixed(3),
    rolling: run.rollTime.toFixed(2),
    smashes: String(run.smashes),
    crashes: String(run.crashes),
  });
  $("remaining").textContent = run.remaining.toFixed(1);
  document.querySelector(".clock").classList.toggle("urgent", run.remaining < 10);
  $("progressBar").style.width = (run.distance / run.length) * 100 + "%";
  $("distanceLabel").textContent = "あと " + Math.max(0, Math.ceil(run.length - run.distance)) + " m";
  $("speed").textContent = Math.round(run.speed * 3.6);
  $("message").textContent = run.eventTime > 0 ? run.event : "";
  const kind = normalizeItem(run.item),
    item = ITEMS[kind];
  $("item").disabled = !item || paused || mode !== "play" || run.stall > 0;
  if (shownItem !== kind) {
    shownItem = kind;
    $("item").dataset.kind = kind || "";
    $("item").style.setProperty("--item-color", item?.color || "#c2cfdb");
    $("itemIcon").innerHTML = itemIcon(kind);
    $("itemName").textContent = item?.name || "ITEM";
    $("itemHelp").textContent = item?.effect || "拾って使おう";
    $("item").setAttribute("aria-label", item ? item.name + "、" + item.effect + "、タップで使用" : "アイテム未所持");
  }
  $("hudStage").textContent = (run.debug ? "DEBUG · " : "") + `山手線 ${legIndex + 1}/30 · 転倒 ${run.crashes}/2`;
  // 効果中のものを残り秒数つきで並べて表示（アイテムは即時発動なので、ここが「いま何が効いているか」の表示）
  const active = [];
  if (run.star > 0) active.push("無敵 " + run.star.toFixed(1) + "秒");
  if (run.shield > 0) active.push("バリア " + run.shield.toFixed(1) + "秒");
  if (run.boostActive) active.push("ブースト " + run.boost.toFixed(1) + "秒");
  if (run.magnet > 0) active.push("マグネット " + run.magnet.toFixed(1) + "秒");
  $("effectLabel").textContent = run.totalled
    ? "GAME OVER"
    : run.stall > 0
      ? "エンスト"
      : run.rollTime > 0
        ? "自動復帰中"
        : active.length
          ? (run.air > 0 ? "JET FLIGHT · " : "") + active.join(" · ")
          : run.air > 0
            ? "JET FLIGHT"
            : run.crashes
              ? "損傷：あと1回で大破"
              : "";
  $("effectLabel").classList.toggle("star", run.star > 0);
}
function leaveEnding() {
  if (view?.endingScene) {
    view.clearEnding();
    view.setWeather(currentWeather);
  }
  if (fx) fx.ending = null;
  endingPreview = false;
}
function showEnding(previewPerfect) {
  releaseControls();
  closeDialogs();
  share.clear();
  endingPreview = typeof previewPerfect === "boolean";
  const progress = endingPreview ? previewTour(previewPerfect, missionSeed) : journey || { nextStage: 30, seed: missionSeed },
    summary = summarizeTour(progress);
  mode = "ending";
  paused = false;
  endingClock = 0;
  $("count").textContent = "";
  setScreen("ending");
  populateEnding(summary, endingPreview);
  $("endingDetails").hidden = endingPreview || run.status !== "delivered";
  view.setWeather({ ...currentWeather, phase: "evening", kind: "clear", cloud: 0.12, lights: true });
  view.startEnding(summary.perfect, progress.seed, run, fx.reduced);
  fx.unlock();
  fx.startEnding(summary.perfect);
  fx.lastId = run.eventId;
  last = performance.now();
  $("endingShare").disabled = true;
  $("endingShareLabel").textContent = "画像を準備中…";
  share.prepareEnding(summary, endingPreview, view.captureEnding(0.65)).then(() => {
    if (mode !== "ending") return;
    $("endingShare").disabled = false;
    $("endingShareLabel").textContent = "Xでシェア";
  });
}
$("endingReplay").onclick = () => {
  if (endingPreview) {
    showTitle();
    openDebugger();
  } else newTour();
};
$("endingTitle").onclick = showTitle;
$("endingDetails").onclick = () => {
  leaveEnding();
  mode = "result";
  paused = false;
  setScreen("result");
  $("nextTrip").textContent = "エンディングへ →";
  prepareResultShare();
};
$("debugEndingNormal").onclick = () => showEnding(false);
$("debugEndingPerfect").onclick = () => showEnding(true);
function paintEnding(dt) {
  endingClock += dt;
  fx.update(null, dt, false);
  view.shake = 0;
  const rect = $("endingStage").getBoundingClientRect();
  view.renderEnding(endingClock, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
}
function end() {
  mode = "result";
  releaseControls();
  $("count").textContent = "";
  setScreen("result");
  const ok = run.status === "delivered",
    stage = missionAt(legIndex, data.stations.length),
    bill = settlement(run),
    rank = rankRun(run);
  $("resultStage").textContent = (run.debug ? "DEBUG · " : "") + `山手線 ${stage.number} / ${stage.total}`;
  $("resultHeading").textContent = ok
    ? stage.last
      ? "山手線、一周達成！"
      : "お届け完了！"
    : run.status === "wrecked"
      ? "大破・ゲームオーバー"
      : "タイムアップ";
  $("resultRoute").textContent = data.stations[from].name + " → " + data.stations[to].name;
  $("rank").textContent = rank.grade;
  $("rankHero").dataset.rank = rank.grade;
  $("rankMessage").textContent = rank.message;
  $("resultTime").textContent = run.elapsed.toFixed(2);
  $("safetyScore").textContent = rank.safety + "%";
  $("speedScore").textContent = rank.speed + "%";
  $("safetyBar").style.width = rank.safety + "%";
  $("speedBar").style.width = rank.speed + "%";
  $("fare").textContent = money(bill.fare);
  $("damage").textContent = money(-bill.damage);
  $("reward").textContent = money(bill.net);
  $("reward").parentElement.classList.toggle("negative", bill.net < 0);
  $("nextTrip").textContent = ok ? (stage.last ? "エンディングへ →" : "次へ →") : "ミッションへ →";
  if (ok && !run.debug) {
    deliveries++;
    if (!visited.includes(to)) visited.push(to);
    const key = from + "-" + to;
    if (!best[key] || best[key] > run.elapsed) best[key] = run.elapsed;
    persist();
    journey = recordTourLeg(journey?.seed === missionSeed ? journey : { nextStage: legIndex, seed: missionSeed }, legIndex, run);
    const saved = saves.write("auto", journey);
    $("autoSaveState").textContent = saved ? "AUTO SAVED" : "保存できませんでした";
    $("autoSaveState").classList.toggle("failed", !saved);
    updateContinue();
  } else $("autoSaveState").textContent = "";
  previewRun = { ...run, x: 0, air: 0, boostActive: false, physicsPose: null, shield: 0 };
  if (ok && stage.last) {
    showEnding();
    return;
  }
  prepareResultShare();
}
function prepareResultShare() {
  const stage = missionAt(legIndex, data.stations.length);
  $("shareX").disabled = true;
  $("shareLabel").textContent = "画像を準備中…";
  share.prepare(run, data.stations[from].name, data.stations[to].name, stage.number, view.captureShare(run)).then(() => {
    if (mode !== "result") return;
    $("shareX").disabled = false;
    $("shareLabel").textContent = "Xでシェア";
  });
}
function drawMap() {
  const c = $("minimap").getContext("2d");
  c.clearRect(0, 0, 180, 180);
  const p = sample(run.distance),
    scale = 90 / 330;
  c.save();
  c.translate(90, 90);
  c.strokeStyle = "#f3dfb4";
  c.lineWidth = 2;
  c.beginPath();
  route.points.forEach((v, i) => {
    i ? c.lineTo((v[0] - p.x) * scale, (v[1] - p.z) * scale) : c.moveTo((v[0] - p.x) * scale, (v[1] - p.z) * scale);
  });
  c.stroke();
  c.fillStyle = "#ffd24b";
  c.beginPath();
  c.arc(0, 0, 5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function frame(now) {
  if (!view || !run) return;
  const dt = Math.min((now - last) / 1000 || 0, 0.1);
  last = now;
  // エンジン音のモード：乗車・カウント中はアイドリング（空ぶかし可）、走行中は走行音
  fx.audioMode = paused ? "off" : ["boarding", "count"].includes(mode) ? "idle" : mode === "play" ? "drive" : mode === "wreck" ? "wreck" : "off";
  fx.setBgmMood(
    mode === "ending"
      ? "ending"
      : paused
        ? "pause"
        : mode === "play" && run.star > 0
          ? "star"
          : ["boarding", "count", "play", "wreck"].includes(mode)
            ? "play"
            : mode === "result"
              ? "result"
              : "menu",
  );
  if (mode === "ending") {
    paintEnding(dt);
    return;
  }
  if (!paused) {
    if (mode === "boarding") {
      const before = boarding.elapsed;
      boarding.advance(dt);
      run.boarding = boarding.progress;
      if (before < DOOR_CLOSE_TIME && boarding.elapsed >= DOOR_CLOSE_TIME) fx.sound("door");
      if (boarding.done) {
        run.boarding = null;
        boarding = null;
        releaseControls();
        startDash = new StartDash();
        mode = "count";
        fx.sound("count3");
        $("count").textContent = "3";
      }
      updateHud();
    } else if (mode === "count") {
      const digit = startDash.digit;
      startDash.advance(dt);
      $("count").textContent = startDash.digit || "GO!";
      if (startDash.digit && startDash.digit !== digit) fx.sound("count" + startDash.digit);
      if (startDash.remaining === 0) {
        startDash.commit(run);
        if (run.item) useItem(run); // デバッグで指定したアイテムはGOと同時に発動
        mode = "play";
        $("count").textContent = "";
      }
      updateHud();
    }
    if (mode === "play") {
      holdAccelerator(run, driving.accelerating);
      const before = { distance: run.distance, x: run.x };
      tick(run, dt);
      physics.update(run, track, before, dt);
      updateHud();
      miniTime += dt;
      if (miniTime > 0.12) {
        drawMap();
        miniTime = 0;
      }
      if (run.status === "wrecked") {
        mode = "wreck";
        wreckTimer = 1.8;
        releaseControls();
        updateHud();
      } else if (run.status !== "running") end();
    }
  }
  if (mode === "ending") {
    paintEnding(0);
    return;
  }
  if (!paused && mode === "wreck") {
    physics.update(run, track, null, dt);
    wreckTimer -= dt;
    if (wreckTimer <= 0) end();
  }
  fx.update(run, paused ? 0 : dt, ["play", "wreck"].includes(mode) && !paused);
  view.shake = fx.shake;
  const menu = ["menu", "briefing", "result", "inspect"].includes(mode),
    idle = menu || paused;
  if (!idle || now - lastWorldPaint > 160) {
    view.render(menu ? previewRun : run, now / 1000, menu);
    lastWorldPaint = now;
  }
}
init().catch((e) => {
  $("error").hidden = false;
  $("error").textContent = "起動できませんでした。再読み込みしてください。 " + e.message;
  console.error(e);
});
