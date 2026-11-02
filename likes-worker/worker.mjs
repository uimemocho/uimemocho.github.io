import projects from '../data/projects.json' with { type: 'json' };
const slugs = new Set(projects.map(p => p.slug));
const origin = 'https://uimemocho.github.io';
export default {
  async fetch(request, env) {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    };
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    if (request.headers.get('Origin') !== origin) return reply({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
    const route = new URL(request.url).pathname;
    if (route !== '/state' && route !== '/likes') return reply({ error: 'Not found' }, 404);
    if (Number(request.headers.get('Content-Length')) > 1024) return reply({ error: 'Request too large' }, 413);
    let body;
    try { const raw = await request.text(); if (raw.length > 1024) return reply({ error: 'Request too large' }, 413); body = JSON.parse(raw); }
    catch { return reply({ error: 'Invalid JSON' }, 400); }
    if (typeof body.visitor !== 'string' || !/^[0-9a-f-]{36}$/.test(body.visitor)) return reply({ error: 'Invalid visitor' }, 400);
    try {
      if (route === '/likes') {
        if (!slugs.has(body.slug) || typeof body.liked !== 'boolean') return reply({ error: 'Invalid vote' }, 400);
        const mutation = body.liked
          ? env.DB.prepare('INSERT OR IGNORE INTO likes (slug, visitor) VALUES (?, ?)').bind(body.slug, body.visitor)
          : env.DB.prepare('DELETE FROM likes WHERE slug = ? AND visitor = ?').bind(body.slug, body.visitor);
        const [, result] = await env.DB.batch([mutation, env.DB.prepare('SELECT COUNT(*) AS count FROM likes WHERE slug = ?').bind(body.slug)]);
        return reply({ slug: body.slug, count: result.results[0].count, liked: body.liked });
      }
      const [counts, mine] = await env.DB.batch([
        env.DB.prepare('SELECT slug, COUNT(*) AS count FROM likes GROUP BY slug'),
        env.DB.prepare('SELECT slug FROM likes WHERE visitor = ?').bind(body.visitor),
      ]);
      return reply({ counts: Object.fromEntries(counts.results.map(r => [r.slug, r.count])), liked: mine.results.map(r => r.slug) });
    } catch { return reply({ error: 'Likes unavailable' }, 503); }
  },
};
