"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectKind = "tool" | "game";
type Filter = "all" | ProjectKind;

const projects = [
  {
    name: "Palette Lab",
    kind: "tool" as const,
    description: "配色を試して共有できるカラーツール",
    detail: "色を並べ、比べ、保存するための小さな実験室。",
  },
  {
    name: "Focus Timer",
    kind: "tool" as const,
    description: "集中と休憩を気持ちよく切り替える",
    detail: "作業のリズムだけを静かに整えるタイマー。",
  },
  {
    name: "Pixel Runner",
    kind: "game" as const,
    description: "60秒で遊べるミニランゲーム",
    detail: "短い時間で記録更新を目指すワンボタンゲーム。",
  },
  {
    name: "Sound Blocks",
    kind: "game" as const,
    description: "音を重ねてループを作る",
    detail: "ブロックを置くだけで小さな曲ができる音遊び。",
  },
  {
    name: "Layout Quiz",
    kind: "game" as const,
    description: "UIレイアウトの感覚を試すクイズ",
    detail: "余白と整列を見る目を、問題を通して確かめる。",
  },
  {
    name: "Tiny Calculator",
    kind: "tool" as const,
    description: "迷わず使える小さな計算機",
    detail: "よく使う計算だけを、すぐ終わらせるための道具。",
  },
];

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "tool", label: "ツール" },
  { value: "game", label: "ゲーム" },
];

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState(
    "掲載内容は仮データです。公開URLはあとから差し替えられます。",
  );

  const visibleProjects = useMemo(
    () =>
      filter === "all"
        ? projects
        : projects.filter((project) => project.kind === filter),
    [filter],
  );

  useEffect(() => {
    document.documentElement.classList.add("js");
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
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

    items.forEach((item) => observer.observe(item));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js");
    };
  }, []);

  const openPlaceholder = (name: string) => {
    setNotice(`${name} は仮データです。実際の公開URLを設定すると、ここから開けます。`);
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="uimemocho ホーム">
          <span className="brand-mark" aria-hidden="true" />
          uimemocho
        </a>
        <span className="header-label">Independent digital playground</span>
        <span className="header-index">Tokyo / 2026</span>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="headline" data-reveal>
          <div className="hero-copy">
            <p className="eyebrow">Tools, games &amp; small experiments</p>
            <h1 id="headline">
              つくったものを、
              <br />
              いつでも遊べる場所に。
            </h1>
          </div>
          <div className="hero-aside">
            <span className="vertical-rule" aria-hidden="true" />
            <div>
              <p className="intro">
                小さなツールとゲームを集めた、個人制作のプレイグラウンド。
              </p>
              <p className="aside-meta">Open catalog — 06 projects</p>
            </div>
          </div>
          <span className="hero-watermark" aria-hidden="true">
            06
          </span>
        </section>

        <section className="catalog" aria-labelledby="catalog-title">
          <div className="catalog-bar" data-reveal>
            <div>
              <p className="catalog-kicker">Collection / 2026</p>
              <h2 className="section-title" id="catalog-title">
                Project index
                <span>{String(visibleProjects.length).padStart(2, "0")}</span>
              </h2>
            </div>
            <div className="filters" role="group" aria-label="作品を種類で絞り込む">
              {filters.map((item) => (
                <button
                  className="filter"
                  type="button"
                  key={item.value}
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="project-grid" aria-live="polite">
            {visibleProjects.map((project, index) => (
              <article
                className="project-card"
                data-reveal
                style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}
                key={project.name}
              >
                <div className="card-top">
                  <span className="number">
                    {String(projects.indexOf(project) + 1).padStart(2, "0")} / 06
                  </span>
                  <span className={`type type-${project.kind}`}>
                    {project.kind === "tool" ? "ツール" : "ゲーム"}
                  </span>
                </div>
                <div className="card-copy">
                  <h3>{project.name}</h3>
                  <p className="description">{project.description}</p>
                  <p className="detail">{project.detail}</p>
                </div>
                <button
                  className="open-project"
                  type="button"
                  onClick={() => openPlaceholder(project.name)}
                  aria-label={`${project.name} の公開情報を確認`}
                >
                  <span>Open</span>
                  <span className="arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              </article>
            ))}
          </div>

          <p className="catalog-notice" role="status" aria-live="polite">
            {notice}
          </p>
        </section>
      </main>

      <footer>
        <span>© uimemocho</span>
        <span>Made with curiosity in Japan</span>
      </footer>
    </div>
  );
}
