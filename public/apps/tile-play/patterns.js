(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function node(name, attrs) {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) el.setAttribute(key, String(value));
    });
    return el;
  }

  function append(parent, name, attrs) {
    const el = node(name, attrs);
    parent.appendChild(el);
    return el;
  }

  function baseStroke(colors, options, extra) {
    return Object.assign(
      {
        fill: "none",
        stroke: colors.foreground,
        "stroke-width": options.lineWidth,
        "stroke-linecap": "butt",
        "stroke-linejoin": "round",
        "vector-effect": "non-scaling-stroke",
      },
      extra || {}
    );
  }

  const patterns = [
    {
      id: "diagonal-line",
      name: "Swiss Elbow",
      category: "Geometric Repeat",
      tags: ["swiss", "line", "rhythm"],
      shapes: "面取りされた連続線",
      shapesEn: "Chamfered continuous lines",
      supportsFlip: false,
      usesLineWidth: true,
      disabledPresets: ["checker"],
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, {
          d: "M -1 50 C 12 50 19 48 26 41 L 41 26 C 48 19 50 12 50 -1 M 50 101 C 50 88 52 81 59 74 L 74 59 C 81 52 88 50 101 50",
        }));
      },
    },
    {
      id: "diagonal-split",
      name: "Swiss Wedge",
      category: "Figure–Ground",
      tags: ["swiss", "wedge", "asymmetric"],
      shapes: "三角形 + 円",
      shapesEn: "Triangle and circle",
      supportsFlip: true,
      usesLineWidth: false,
      render(g, c) {
        append(g, "polygon", { points: "12,12 88,12 88,88", fill: c.foreground });
        append(g, "circle", { cx: 34, cy: 66, r: 15, fill: c.accent });
        append(g, "circle", { cx: 34, cy: 66, r: 5, fill: c.background });
      },
    },
    {
      id: "quarter-arc",
      name: "Quarter Arc",
      category: "Truchet Tiles",
      tags: ["curve", "maze", "classic"],
      shapes: "1/4円弧 × 2",
      shapesEn: "Two quarter arcs",
      supportsFlip: false,
      usesLineWidth: true,
      disabledPresets: ["checker"],
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, {
          d: "M -1 50 C 27.17 50 50 27.17 50 -1 M 50 101 C 50 72.83 72.83 50 101 50",
        }));
      },
    },
    {
      id: "double-arc",
      name: "Parallel Loop",
      category: "Truchet Tiles",
      tags: ["swiss", "parallel", "loop"],
      shapes: "平行角丸ループ × 4",
      shapesEn: "Four rounded parallel loops",
      supportsFlip: false,
      usesLineWidth: true,
      disabledPresets: ["checker"],
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, {
          d: "M -3 34 L 2 34 C 19.67 34 34 19.67 34 2 L 34 -3 M -3 66 L 2 66 C 37.35 66 66 37.35 66 2 L 66 -3 M 34 103 L 34 98 C 34 62.65 62.65 34 98 34 L 103 34 M 66 103 L 66 98 C 66 80.33 80.33 66 98 66 L 103 66",
        }));
      },
    },
    {
      id: "thick-curve",
      name: "Bauhaus Ribbon",
      category: "Optical Pattern",
      tags: ["bauhaus", "bold", "ribbon"],
      shapes: "太いリボン状円弧",
      shapesEn: "Broad ribbon arcs",
      supportsFlip: false,
      usesLineWidth: true,
      disabledPresets: ["checker"],
      render(g, c, o) {
        const width = Math.min(15, Math.max(8, o.lineWidth * 1.45));
        append(g, "path", baseStroke(c, o, {
          d: "M -1 50 C 27.17 50 50 27.17 50 -1",
          "stroke-width": width,
        }));
        append(g, "path", baseStroke(c, o, {
          d: "M 50 101 C 50 72.83 72.83 50 101 50",
          "stroke-width": width,
        }));
        append(g, "rect", { x: 45, y: 45, width: 10, height: 10, fill: c.accent });
      },
    },
    {
      id: "s-connection",
      name: "Swiss Switch",
      category: "Maze Pattern",
      tags: ["swiss", "switch", "axis"],
      shapes: "直線軸 + S字線",
      shapesEn: "Straight axis and S-curve",
      supportsFlip: true,
      usesLineWidth: true,
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, { d: "M 50 -1 L 50 101" }));
        append(g, "path", baseStroke(c, o, {
          d: "M -1 50 C 18 50 32 30 50 50 C 68 70 82 50 101 50",
        }));
        append(g, "circle", { cx: 50, cy: 50, r: Math.max(4, o.lineWidth * 0.68), fill: c.accent });
      },
    },
    {
      id: "half-circle",
      name: "Bauhaus Disc",
      category: "Modular Pattern",
      tags: ["bauhaus", "disc", "semicircle"],
      shapes: "円 + 半円 + 中心円",
      shapesEn: "Disc, semicircle, and core",
      supportsFlip: true,
      usesLineWidth: false,
      render(g, c) {
        append(g, "circle", { cx: 50, cy: 50, r: 36, fill: c.foreground });
        append(g, "path", { d: "M 50 14 A 36 36 0 0 1 50 86 Z", fill: c.accent });
        append(g, "circle", { cx: 50, cy: 50, r: 9, fill: c.background });
      },
    },
    {
      id: "corner-dot",
      name: "Swiss Dots",
      category: "Geometric Repeat",
      tags: ["swiss", "dot", "bar"],
      shapes: "円 × 2 + バー",
      shapesEn: "Two dots and a bar",
      supportsFlip: true,
      usesLineWidth: false,
      render(g, c) {
        append(g, "circle", { cx: 26, cy: 26, r: 15, fill: c.foreground });
        append(g, "circle", { cx: 73, cy: 34, r: 8, fill: c.accent });
        append(g, "rect", { x: 28, y: 66, width: 48, height: 12, fill: c.foreground });
      },
    },
    {
      id: "triangle-split",
      name: "Bauhaus Wedge",
      category: "Tessellation",
      tags: ["bauhaus", "triangle", "direction"],
      shapes: "三角形 + 円",
      shapesEn: "Directional wedge and disc",
      supportsFlip: true,
      usesLineWidth: false,
      render(g, c) {
        append(g, "polygon", { points: "12,18 90,50 12,82", fill: c.foreground });
        append(g, "circle", { cx: 33, cy: 50, r: 15, fill: c.accent });
        append(g, "rect", { x: 28, y: 45, width: 10, height: 10, fill: c.background });
      },
    },
    {
      id: "cross-connection",
      name: "Offset Cross",
      category: "Maze Pattern",
      tags: ["swiss", "cross", "offset"],
      shapes: "十字 + オフセット正方形",
      shapesEn: "Cross and offset square",
      supportsFlip: true,
      usesLineWidth: true,
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, { d: "M 50 -1 L 50 101 M -1 50 L 101 50" }));
        append(g, "rect", { x: 57, y: 19, width: 22, height: 22, fill: c.accent });
        append(g, "circle", { cx: 50, cy: 50, r: Math.max(5, o.lineWidth * 0.72), fill: c.foreground });
      },
    },
    {
      id: "wave-connector",
      name: "Bauhaus Gate",
      category: "Modular Pattern",
      tags: ["bauhaus", "gate", "arch"],
      shapes: "アーチ + バー",
      shapesEn: "Arch and baseline",
      supportsFlip: false,
      usesLineWidth: true,
      render(g, c, o) {
        append(g, "path", baseStroke(c, o, {
          d: "M 20 82 L 20 49 C 20 27 33 17 50 17 C 67 17 80 27 80 49 L 80 82",
        }));
        append(g, "line", baseStroke(c, o, {
          x1: 20,
          y1: 82,
          x2: 80,
          y2: 82,
          stroke: c.accent,
        }));
        append(g, "circle", { cx: 50, cy: 49, r: Math.max(4, o.lineWidth * 0.68), fill: c.accent });
      },
    },
    {
      id: "organic-split",
      name: "Swiss Flow",
      category: "Figure–Ground",
      tags: ["swiss", "flow", "figure-ground"],
      shapes: "非対称の四方向面",
      shapesEn: "Asymmetric four-way form",
      supportsFlip: true,
      usesLineWidth: false,
      render(g, c) {
        append(g, "path", {
          d: "M 40 -1 L 60 -1 C 60 16 68 24 76 32 C 84 40 91 40 101 40 L 101 60 C 84 60 75 64 68 74 C 61 84 60 91 60 101 L 40 101 C 40 84 34 78 24 70 C 14 62 8 60 -1 60 L -1 40 C 14 40 22 36 30 26 C 38 16 40 8 40 -1 Z",
          fill: c.foreground,
        });
        append(g, "circle", { cx: 65, cy: 36, r: 13, fill: c.background });
        append(g, "circle", { cx: 65, cy: 36, r: 4.5, fill: c.accent });
      },
    },
    {
      id: "bauhaus-quarters",
      name: "Primary Quarters",
      category: "Bauhaus Forms",
      tags: ["bauhaus", "quarter", "color-field", "primary"],
      shapes: "1/4円 + ストライプ + ドット",
      shapesEn: "Quarter-circles, stripes, and dots",
      supportsFlip: false,
      usesLineWidth: false,
      usesFiveColors: true,
      render(g, c, o) {
        const palette = {
          paper: c.background,
          black: c.foreground,
          yellow: c.tertiary,
          blue: c.secondary,
          red: c.accent,
        };
        const tileIndex = Math.abs(Number(o.index) || 0);
        const seed = Number(o.seed) || 0;
        let hash = Math.imul(tileIndex + 1, 0x9e3779b1) ^ Math.imul(seed + 97, 0x85ebca6b);
        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x7feb352d);
        hash ^= hash >>> 15;
        const variant = (hash >>> 0) % 8;
        const baseColors = [
          palette.paper,
          palette.yellow,
          palette.paper,
          palette.blue,
          palette.red,
          palette.paper,
          palette.paper,
          palette.paper,
        ];
        append(g, "rect", {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: baseColors[variant],
          "shape-rendering": "crispEdges",
        });
        if (variant === 6) {
          for (let radius = 12; radius <= 96; radius += 12) {
            append(g, "path", {
              d: `M ${radius} 0 A ${radius} ${radius} 0 0 1 0 ${radius}`,
              fill: "none",
              stroke: palette.black,
              "stroke-width": 4,
              "stroke-linecap": "butt",
              "vector-effect": "non-scaling-stroke",
            });
          }
          return;
        }
        if (variant === 7) {
          for (let y = 12; y < 100; y += 14) {
            for (let x = 12; x < 100; x += 14) {
              append(g, "circle", { cx: x, cy: y, r: 3.2, fill: palette.black });
            }
          }
          return;
        }
        const quarterColors = [
          palette.black,
          palette.blue,
          palette.red,
          palette.black,
          palette.black,
          palette.yellow,
        ];
        append(g, "path", {
          d: "M 0 0 H 100 A 100 100 0 0 1 0 100 Z",
          fill: quarterColors[variant],
        });
        if (variant === 5) {
          append(g, "path", {
            d: "M 0 0 H 50 A 50 50 0 0 1 0 50 Z",
            fill: palette.black,
          });
        }
      },
    },
    {
      id: "bauhaus-steps",
      name: "Ribbon Arch",
      category: "Bauhaus Forms",
      tags: ["bauhaus", "arch", "stripe", "poster"],
      shapes: "同心U字ストライプ",
      shapesEn: "Concentric U-shaped stripes",
      supportsFlip: false,
      usesLineWidth: true,
      usesLineCount: true,
      render(g, c, o) {
        const count = Math.max(3, Math.min(12, Math.round(o.lineCount || 7)));
        const spacing = 36 / (count - 1);
        const safeWidth = Math.max(1, Math.min(Number(o.lineWidth) || 3, Math.floor(spacing - 1), 4));
        const radii = Array.from({ length: count }, (_, index) => 32 + spacing * index);
        radii.forEach((radius, index) => {
          const stroke = index === Math.floor(count / 2) ? c.accent : c.foreground;
          append(g, "path", {
            d: `M ${radius} -1 L ${radius} 0 A ${radius} ${radius} 0 0 1 0 ${radius} L -1 ${radius}`,
            fill: "none",
            stroke,
            "stroke-width": safeWidth,
            "stroke-linecap": "butt",
            "stroke-linejoin": "round",
            "vector-effect": "non-scaling-stroke",
          });
          append(g, "path", {
            d: `M ${100 - radius} 101 L ${100 - radius} 100 A ${radius} ${radius} 0 0 1 100 ${100 - radius} L 101 ${100 - radius}`,
            fill: "none",
            stroke,
            "stroke-width": safeWidth,
            "stroke-linecap": "butt",
            "stroke-linejoin": "round",
            "vector-effect": "non-scaling-stroke",
          });
        });
      },
    },
    {
      id: "bauhaus-double-disc",
      name: "Split Orbit",
      category: "Bauhaus Forms",
      tags: ["bauhaus", "disc", "semicircle", "primary"],
      shapes: "左右半円 + 中央窓",
      shapesEn: "Split disc and central window",
      supportsFlip: false,
      usesLineWidth: false,
      render(g, c) {
        append(g, "path", { d: "M 50 0 A 50 50 0 0 0 50 100 Z", fill: c.foreground });
        append(g, "path", { d: "M 50 0 A 50 50 0 0 1 50 100 Z", fill: c.accent });
        append(g, "rect", { x: 37, y: 37, width: 26, height: 26, fill: c.background });
      },
    },
    {
      id: "bauhaus-arch-stack",
      name: "Four Petals",
      category: "Bauhaus Forms",
      tags: ["bauhaus", "petal", "figure-ground", "mono"],
      shapes: "曲線花弁 × 4",
      shapesEn: "Four curved petals",
      supportsFlip: false,
      usesLineWidth: false,
      render(g, c) {
        append(g, "rect", { x: -1, y: -1, width: 102, height: 102, fill: c.foreground });
        append(g, "path", { d: "M 50 50 C 22 50 -1 28 -1 -1 C 28 -1 50 22 50 50 Z", fill: c.background });
        append(g, "path", { d: "M 50 50 C 50 22 72 -1 101 -1 C 101 28 78 50 50 50 Z", fill: c.background });
        append(g, "path", { d: "M 50 50 C 78 50 101 72 101 101 C 72 101 50 78 50 50 Z", fill: c.background });
        append(g, "path", { d: "M 50 50 C 50 78 28 101 -1 101 C -1 72 22 50 50 50 Z", fill: c.accent });
      },
    },
  ];

  const colorPresets = [
    { id: "mono", name: "Mono", background: "#F4F3EF", foreground: "#111111", accent: "#FF5A36", secondary: "#8D8A83", tertiary: "#D6D2C8" },
    { id: "bauhaus-primary", name: "Bauhaus Primary", background: "#F7F3E8", foreground: "#111111", accent: "#E5252A", secondary: "#236FA8", tertiary: "#F7BD17" },
    { id: "bauhaus-yellow", name: "Bauhaus Yellow", background: "#F4C21D", foreground: "#111111", accent: "#236BA5", secondary: "#E5252A", tertiary: "#F7F3E8" },
    { id: "poster-green", name: "Poster Green", background: "#EEE4D2", foreground: "#087A3E", accent: "#F03B28", secondary: "#F2B134", tertiary: "#1F4F46" },
    { id: "modern-cyan", name: "Modern Cyan", background: "#87CDD3", foreground: "#334B57", accent: "#FFE500", secondary: "#F26A4B", tertiary: "#F4F0E6" },
    { id: "invert", name: "Invert", background: "#111111", foreground: "#F4F3EF", accent: "#FF5A36", secondary: "#0057FF", tertiary: "#FFD400" },
    { id: "paper", name: "Paper", background: "#F2E6CF", foreground: "#2B2118", accent: "#B7402C", secondary: "#6F7D59", tertiary: "#D99A37" },
    { id: "neon", name: "Neon", background: "#0D0D12", foreground: "#D8FF3E", accent: "#9D5CFF", secondary: "#FF4FA3", tertiary: "#35D0FF" },
    { id: "retro", name: "Retro", background: "#F0C987", foreground: "#2E294E", accent: "#D1495B", secondary: "#4E8098", tertiary: "#F4E285" },
    { id: "japanese", name: "Japanese", background: "#F3EFE4", foreground: "#173F5F", accent: "#C44536", secondary: "#D6A84B", tertiary: "#758E4F" },
    { id: "pastel", name: "Pastel", background: "#FFF3F5", foreground: "#665C84", accent: "#F3A6B8", secondary: "#A7C7E7", tertiary: "#F6D6AD" },
    { id: "dark", name: "Dark", background: "#171717", foreground: "#EAE8E2", accent: "#FF7556", secondary: "#53C8B6", tertiary: "#FFD166" },
    { id: "game-ui", name: "Game UI", background: "#151A2D", foreground: "#57E3C2", accent: "#F7C548", secondary: "#F25F5C", tertiary: "#7B61FF" },
    { id: "contrast", name: "High Contrast", background: "#FFFFFF", foreground: "#000000", accent: "#0057FF", secondary: "#FF0033", tertiary: "#FFE600" },
  ];

  window.TilePlayPatterns = {
    NS,
    patterns,
    colorPresets,
    get(id) {
      return patterns.find((pattern) => pattern.id === id) || patterns[2];
    },
  };
})();
