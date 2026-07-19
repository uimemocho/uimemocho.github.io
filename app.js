const fallbackProjects = [
  { title: "Palette Lab", kind: "tool", description: "配色を試して共有できるカラーツール", detail: "色を並べ、比べ、保存するための小さな実験室。" },
  { title: "Focus Timer", kind: "tool", description: "集中と休憩を気持ちよく切り替える", detail: "作業のリズムだけを静かに整えるタイマー。" },
  { title: "Pixel Runner", kind: "game", description: "60秒で遊べるミニランゲーム", detail: "短い時間で記録更新を目指すワンボタンゲーム。" },
  { title: "Sound Blocks", kind: "game", description: "音を重ねてループを作る", detail: "ブロックを置くだけで小さな曲ができる音遊び。" },
  { title: "Layout Quiz", kind: "game", description: "UIレイアウトの感覚を試すクイズ", detail: "余白と整列を見る目を、問題を通して確かめる。" },
  { title: "Tiny Calculator", kind: "tool", description: "迷わず使える小さな計算機", detail: "よく使う計算だけを、すぐ終わらせるための道具。" },
];

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

  const isPublished = typeof project.url === "string" && project.url.startsWith("/");
  const action = document.createElement(isPublished ? "a" : "button");
  action.className = "open-project";
  if (isPublished) {
    action.href = project.url;
    action.setAttribute("aria-label", `${title} を開く`);
  } else {
    action.type = "button";
    action.setAttribute("aria-label", `${title} の公開情報を確認`);
    action.addEventListener("click", () => {
      notice.textContent = `${title} は仮データです。実作品を追加すると、ここから開けます。`;
    });
  }
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
    projects = catalog;
  } catch (error) {
    console.warn("Using the built-in catalog fallback.", error);
  }
  render();
}

observeReveals();
loadProjects();
