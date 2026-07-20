const fallbackProjects = [];

const grid = document.querySelector("#project-grid");
const visibleCount = document.querySelector("#visible-count");
const heroCount = document.querySelector("#hero-count");
const heroWatermark = document.querySelector("#hero-watermark");
const notice = document.querySelector("#catalog-notice");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let projects = fallbackProjects;
let activeFilter = "all";

document.documentElement.classList.add("js");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

function observeReveals() {
  document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((item) => observer.observe(item));
}

function projectTitle(project) {
  return project.title || project.name || "Untitled";
}

function projectDetail(project) {
  return project.detail || "ブラウザですぐ使える、小さな作品です。";
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
  card.dataset.reveal = "";
  card.style.setProperty("--delay", `${index * 70}ms`);

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
    createTextElement("p", "detail", projectDetail(project)),
  );

  const action = document.createElement("a");
  action.className = "open-project";
  action.href = project.url;
  action.setAttribute("aria-label", `${title} を開く`);
  action.append(
    createTextElement("span", "", "Open"),
    createTextElement("span", "arrow", "↗"),
  );
  action.lastElementChild.setAttribute("aria-hidden", "true");

  card.append(top, copy, action);
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
  observeReveals();
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

observeReveals();
loadProjects();
