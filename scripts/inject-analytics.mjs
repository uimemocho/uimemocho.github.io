// Injects the Google Analytics 4 tag into every HTML file of an assembled site.
//
// Run after the site has been copied into its output directory, so the source
// HTML stays free of tracking code:
//
//   GA_MEASUREMENT_ID=G-XXXXXXXXXX node scripts/inject-analytics.mjs _site
//
// Without GA_MEASUREMENT_ID the script does nothing, which keeps local builds
// and forks out of the analytics data.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MARKER = "data-uimemocho-analytics";

const measurementId = (process.env.GA_MEASUREMENT_ID ?? "").trim();
const root = process.argv[2] ?? "_site";

if (!measurementId) {
  console.log("GA_MEASUREMENT_ID is not set — skipping analytics injection.");
  process.exit(0);
}

if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
  console.error(`"${measurementId}" is not a GA4 measurement ID (expected G-XXXXXXXXXX).`);
  process.exit(1);
}

const snippetLines = [
  `<script ${MARKER} async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`,
  `<script ${MARKER}>`,
  `  window.dataLayer = window.dataLayer || [];`,
  `  function gtag(){dataLayer.push(arguments);}`,
  `  gtag('js', new Date());`,
  `  gtag('config', '${measurementId}');`,
  `</script>`,
];

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

let injected = 0;
let skipped = 0;

for await (const file of htmlFiles(root)) {
  const html = await readFile(file, "utf8");

  if (html.includes(MARKER)) {
    skipped += 1;
    continue;
  }

  // The document head always precedes the body, so the first </head> is the
  // real one even in the single-file apps that build HTML at runtime.
  const closingHead = html.indexOf("</head>");
  if (closingHead === -1) {
    console.warn(`No </head> found, leaving untouched: ${file}`);
    skipped += 1;
    continue;
  }

  // Match the indentation of the </head> line so the generated markup stays
  // readable in view-source. Falls back to a bare insert when </head> shares a
  // line with other markup.
  const lineStart = html.lastIndexOf("\n", closingHead) + 1;
  const indent = html.slice(lineStart, closingHead);
  const indented = /^[ \t]*$/.test(indent);
  const at = indented ? lineStart : closingHead;
  const block = snippetLines.map((line) => (indented ? indent : "") + line).join("\n") + "\n";

  await writeFile(file, html.slice(0, at) + block + html.slice(at), "utf8");
  injected += 1;
}

console.log(`Analytics injected into ${injected} file(s), skipped ${skipped}.`);
