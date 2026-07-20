"use client";

import { useEffect, useMemo, useState } from "react";
import catalogProjects from "../data/projects.json";

type ProjectKind = "tool" | "game";
type Filter = "all" | ProjectKind;

const projects = catalogProjects
  .filter((project) => project.url.startsWith("/apps/"))
  .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  .map((project) => ({
    name: project.title,
    kind: project.kind as ProjectKind,
    description: project.description,
    detail: "ブラウザですぐ使える、小さな作品です。",
    url: project.url,
  }));

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "tool", label: "ツール" },
  { value: "game", label: "ゲーム" },
];

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");

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
              <p className="aside-meta">
                Open catalog — {String(projects.length).padStart(2, "0")} projects
              </p>
            </div>
          </div>
          <span className="hero-watermark" aria-hidden="true">
            {String(projects.length).padStart(2, "0")}
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
                    {String(projects.indexOf(project) + 1).padStart(2, "0")} /{" "}
                    {String(projects.length).padStart(2, "0")}
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
                <a
                  className="open-project"
                  href={project.url}
                  aria-label={`${project.name} を開く`}
                >
                  <span>Open</span>
                  <span className="arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </article>
            ))}
          </div>

        </section>
      </main>

      <footer>
        <span>© uimemocho</span>
        <span>Made with curiosity in Japan</span>
      </footer>
    </div>
  );
}
