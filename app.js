const fallbackProjects = [];

const grid = document.querySelector("#project-grid");
const visibleCount = document.querySelector("#visible-count");
const heroCount = document.querySelector("#hero-count");
const heroWatermark = document.querySelector("#hero-watermark");
const notice = document.querySelector("#catalog-notice");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let projects = fallbackProjects;
let activeFilter = "all";

function projectTitle(project) {
  return project.title || project.name || "Untitled";
}

function isPublishedProject(project) {
  return typeof project.url === "string" && project.url.startsWith("/apps/");
}

function sortProjectsByRecent(items) {
  return items
    .map((project, index) => {
      const value = project.updatedAt || project.publishedAt;
      const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
      return { project, index, timestamp };
    })
    .sort((left, right) => {
      const leftHasDate = Number.isFinite(left.timestamp);
      const rightHasDate = Number.isFinite(right.timestamp);
      if (leftHasDate && rightHasDate) return right.timestamp - left.timestamp || left.index - right.index;
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
    createTextElement("p", "description", project.description || "説明を準備中です。"),
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
  body.append(top, copy, action);
  card.append(visual, body);
  return card;
}

function render() {
  const visible = activeFilter === "all"
    ? projects
    : projects.filter((project) => project.kind === activeFilter);
  grid.replaceChildren(...visible.map((project, index) => createCard(project, index, projects.length)));
  visibleCount.textContent = String(visible.length).padStart(2, "0");
  const total = String(projects.length).padStart(2, "0");
  heroCount.textContent = total;
  heroWatermark.textContent = total;
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
    projects = sortProjectsByRecent(catalog.filter(isPublishedProject));
    notice.textContent = "";
  } catch (error) {
    projects = fallbackProjects;
    notice.textContent = "作品情報を読み込めませんでした。時間をおいて再読み込みしてください。";
    console.warn("Catalog could not be loaded.", error);
  }
  render();
}

loadProjects();
