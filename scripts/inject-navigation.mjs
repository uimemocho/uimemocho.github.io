import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.argv[2] || '_site';
const projects = JSON.parse(await readFile(join(root, 'data/projects.json'), 'utf8'));
let count = 0;
for (const project of projects) {
  if (!/^\/apps\/[a-z0-9-]+\/$/.test(project.url)) throw new Error('Invalid app route');
  const file = join(root, project.url, 'index.html');
  const html = await readFile(file, 'utf8');
  if (html.includes('data-uimemocho-navigation')) continue;
  if (!html.includes('</head>')) throw new Error(`Missing </head>: ${file}`);
  await writeFile(file, html.replace('</head>', '<script defer data-uimemocho-navigation src="/app-navigation.js?v=20261102-2"></script>\n</head>'));
  count++;
}
console.log(`Catalog navigation added to ${count} app entry points.`);
