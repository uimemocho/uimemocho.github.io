import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import worker from '../likes-worker/worker.mjs';

async function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(new URL('../likes-worker/schema.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) { return { sql, args: [], bind(...args) { this.args = args; return this; } }; },
    async batch(queries) {
      db.exec('BEGIN');
      try {
        const results = queries.map(q => {
          const statement = db.prepare(q.sql);
          return { results: q.sql.startsWith('SELECT') ? statement.all(...q.args) : (statement.run(...q.args), []) };
        });
        db.exec('COMMIT');
        return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return {
    close: () => db.close(),
    call(route, body, origin = 'https://uimemocho.github.io') {
      return worker.fetch(new Request('https://likes.test' + route, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), { DB });
    },
  };
}

test('shared counts, duplicate requests and independent browser votes', async () => {
  const { call, close } = await setup();
  try {
    const a = crypto.randomUUID(), b = crypto.randomUUID(), slug = 'rubik-3d';
    for (let i = 0; i < 2; i++) assert.equal((await (await call('/likes', { visitor: a, slug, liked: true })).json()).count, 1);
    const state = await (await call('/state', { visitor: b })).json();
    assert.equal(state.counts[slug], 1);
    assert.deepEqual(state.liked, []);
    assert.equal((await (await call('/likes', { visitor: b, slug, liked: true })).json()).count, 2);
    assert.equal((await (await call('/likes', { visitor: a, slug, liked: false })).json()).count, 1);
    assert.deepEqual((await (await call('/state', { visitor: b })).json()).liked, [slug]);
    for (let i = 0; i < 2; i++) assert.equal((await (await call('/likes', { visitor: b, slug, liked: false })).json()).count, 0);
  } finally { close(); }
});

test('rejects invalid origin, unknown projects, invalid visitors and malformed votes', async () => {
  const { call, close } = await setup();
  try {
    const visitor = crypto.randomUUID();
    assert.equal((await call('/state', { visitor }, 'https://other.test')).status, 403);
    assert.equal((await call('/likes', { visitor, slug: 'missing', liked: true })).status, 400);
    assert.equal((await call('/likes', { visitor: 'invalid', slug: 'rubik-3d', liked: true })).status, 400);
    assert.equal((await call('/likes', { visitor, slug: 'rubik-3d', liked: 'yes' })).status, 400);
    assert.equal((await call('/unknown', { visitor })).status, 404);
  } finally { close(); }
});
