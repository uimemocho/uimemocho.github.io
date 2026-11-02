const fallbackProjects = [];

const grid = document.querySelector("#project-grid");
const visibleCount = document.querySelector("#visible-count");
const notice = document.querySelector("#catalog-notice");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let projects = fallbackProjects;
let activeFilter = "all";
let activeSort = "newest";
const sortSelect = document.querySelector("#project-sort");

function projectTitle(project) {
  return project.title || project.name || "Untitled";
}

function isPublishedProject(project) {
  return typeof project.url === "string" && project.url.startsWith("/apps/");
}

function sortProjects(items) {
  return items
    .map((project, index) => {
      const value = project.publishedAt || project.updatedAt;
      const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
      return { project, index, timestamp };
    })
    .sort((left, right) => {
      if (activeSort === "popular") {
        const difference = (likeState.get(right.project.slug)?.count || 0)
          - (likeState.get(left.project.slug)?.count || 0);
        if (difference) return difference;
      }
      const leftHasDate = Number.isFinite(left.timestamp);
      const rightHasDate = Number.isFinite(right.timestamp);
      if (leftHasDate && rightHasDate) {
        const difference = activeSort === "oldest"
          ? left.timestamp - right.timestamp
          : right.timestamp - left.timestamp;
        return difference || left.index - right.index;
      }
      if (leftHasDate) return -1;
      if (rightHasDate) return 1;
      return left.index - right.index;
    })
    .map(({ project }) => project);
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createCard(project, index, total) {
  const title = projectTitle(project);
  const card = document.createElement("article");
  card.className = "project-card";
  card.id = `project-${project.slug}`;

  const top = document.createElement("div");
  top.className = "card-top";
  top.append(
    createTextElement("span", "number", `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`),
    createTextElement("span", `type type-${project.kind}`, project.kind === "game" ? "ゲーム" : "ツール"),
  );

  const copy = document.createElement("div");
  copy.className = "card-copy";
  copy.append(
    createTextElement("h3", "", title),
  );

  const action = document.createElement("a");
  action.className = "open-project";
  action.href = project.url;
  action.setAttribute("aria-label", `${title} を開く`);
  action.append(
    createTextElement("span", "", project.kind === "game" ? "あそぶ" : "つかう"),
    createTextElement("span", "arrow", "↗"),
  );
  action.lastElementChild.setAttribute("aria-hidden", "true");

  const visual = document.createElement("div");
  visual.className = "card-visual";
  const image = document.createElement("img");
  image.alt = "";
  image.width = 640;
  image.height = 400;
  image.loading = index < 4 ? "eager" : "lazy";
  image.decoding = "async";
  function showThumbnailFallback() {
    visual.classList.add("image-unavailable");
    image.hidden = true;
    visual.append(createTextElement("span", "visual-fallback", title));
  }
  image.addEventListener("error", showThumbnailFallback, { once: true });
  if (project.thumbnail) image.src = project.thumbnail;
  else showThumbnailFallback();
  visual.append(image);
  const body = document.createElement("div");
  body.className = "card-body";
  const controls = document.createElement("div");
  controls.className = "card-controls";
  const details = document.createElement("details");
  details.className = "project-details";
  const summary = createTextElement("summary", "", "詳細");
  summary.setAttribute("aria-label", `${title} の説明`);
  details.append(summary, createTextElement("p", "full-description", project.description || "説明を準備中です。"));
  const like = document.createElement("button");
  like.type = "button";
  like.className = "like-project";
  like.dataset.slug = project.slug;
  like.setAttribute("aria-label", `${title} にいいね`);
  like.setAttribute("aria-pressed", "false");
  like.append(createTextElement("span", "like-heart", "♡"), createTextElement("span", "like-count", "—"));
  like.firstElementChild.setAttribute("aria-hidden", "true");
  like.disabled = true;
  like.title = "いいね数を読み込み中";
  like.addEventListener("click", () => toggleLike(project.slug));
  controls.append(details, like);
  body.append(top, copy, controls, action);
  card.append(visual, body);
  return card;
}

function render() {
  const visible = sortProjects(activeFilter === "all"
    ? projects
    : projects.filter((project) => project.kind === activeFilter));
  grid.replaceChildren(...visible.map((project, index) => createCard(project, index, projects.length)));
  visibleCount.textContent = String(visible.length).padStart(2, "0");
  updateLikeButtons();

}

sortSelect.addEventListener("change", () => {
  activeSort = sortSelect.value;
  render();
});

// Move existing cards after count updates so expanded descriptions and button
// focus survive a change in popularity.
function refreshPopularOrder() {
  if (activeSort !== "popular") return;
  const focused = document.activeElement;
  const visible = sortProjects(projects.filter(project => document.getElementById(`project-${project.slug}`)));
  visible.forEach((project, index) => {
    const card = document.getElementById(`project-${project.slug}`);
    grid.append(card);
    card.querySelector('.number').textContent = `${String(index + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}`;
  });
  if (focused && grid.contains(focused)) focused.focus({ preventScroll: true });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  });
});

async function loadProjects() {
  try {
    const response = await fetch("/data/projects.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog)) throw new Error("Catalog is not an array");
    projects = catalog.filter(isPublishedProject);
    notice.textContent = "";
  } catch (error) {
    projects = fallbackProjects;
    notice.textContent = "作品情報を読み込めませんでした。時間をおいて再読み込みしてください。";
    console.warn("Catalog could not be loaded.", error);
  }
  render();
  const target = document.getElementById(location.hash.slice(1));
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "center" }));
  await loadLikes();
}


// Counts and pressed state come from the shared service. Only an anonymous
// browser identifier is kept locally so repeated taps do not add more votes.
const likeState = new Map();
const pendingLikes = new Set();
let likesEndpoint;
let visitor;
let likesReady = false;
let likesFailed = false;
const likesStatus = document.querySelector('#likes-status');

function updateLikeButtons() {
  document.querySelectorAll('.like-project').forEach(button => {
    const state = likeState.get(button.dataset.slug);
    const liked = Boolean(state?.liked);
    button.setAttribute('aria-pressed', String(liked));
    button.querySelector('.like-heart').textContent = liked ? '♥' : '♡';
    button.querySelector('.like-count').textContent = state ? String(state.count) : '—';
    button.toggleAttribute('data-unavailable', likesFailed);
    button.disabled = pendingLikes.has(button.dataset.slug) || (!likesReady && !likesFailed);
    button.title = likesReady ? (liked ? 'いいねを取り消す' : 'いいね') : 'いいねを再読み込み';
  });
}

async function likesRequest(route, body) {
  const response = await fetch(likesEndpoint + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor, ...body }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Likes unavailable');
  return response.json();
}

async function loadLikes() {
  try {
    if (!visitor) {
      try { visitor = localStorage.getItem('uimemocho-like-visitor'); } catch { /* Storage may be disabled. */ }
      if (!visitor || !/^[0-9a-f-]{36}$/.test(visitor)) {
        visitor = crypto.randomUUID();
        try { localStorage.setItem('uimemocho-like-visitor', visitor); } catch { /* Keep it in this session. */ }
      }
    }
    if (!likesEndpoint) {
      const configResponse = await fetch('/data/likes.json');
      if (!configResponse.ok) throw new Error('Likes configuration unavailable');
      const config = await configResponse.json();
      const endpoint = new URL(config.endpoint);
      if (endpoint.protocol !== 'https:') throw new Error('Invalid likes endpoint');
      likesEndpoint = endpoint.origin;
    }
    const state = await likesRequest('/state', {});
    projects.forEach(project => likeState.set(project.slug, {
      count: state.counts[project.slug] || 0,
      liked: state.liked.includes(project.slug),
    }));
    likesReady = true;
    likesFailed = false;
    likesStatus.textContent = '';
    document.querySelectorAll('.like-project').forEach(b => b.removeAttribute('data-unavailable'));
  } catch {
    likesReady = false;
    likesFailed = true;
    likesStatus.textContent = 'いいねを読み込めませんでした。♡ を押すと再読み込みします。';
    document.querySelectorAll('.like-project').forEach(b => b.setAttribute('data-unavailable', ''));
  }
  updateLikeButtons();
  refreshPopularOrder();
}

async function toggleLike(slug) {
  if (!likesReady) { await loadLikes(); return; }
  if (pendingLikes.has(slug)) return;
  const previous = likeState.get(slug) || { count: 0, liked: false };
  pendingLikes.add(slug);
  updateLikeButtons();
  try {
    const state = await likesRequest('/likes', { slug, liked: !previous.liked });
    likeState.set(slug, { count: state.count, liked: state.liked });
    likesStatus.textContent = '';
  } catch {
    likesStatus.textContent = 'いいねを保存できませんでした。もう一度お試しください。';
  } finally {
    pendingLikes.delete(slug);
    updateLikeButtons();
    refreshPopularOrder();
  }
}

loadProjects();
