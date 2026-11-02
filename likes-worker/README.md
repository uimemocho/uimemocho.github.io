# Shared catalog likes

The catalog stays on GitHub Pages. This small Cloudflare Worker stores anonymous
per-browser votes in D1; the public endpoint is configured in `data/likes.json`.
No account or email address is collected from visitors. A random browser ID is
kept in localStorage. Clearing browser storage loses the ability to undo previous
votes. It is a per-browser counter, not an authenticated person count.

The primary key `(slug, visitor)` makes repeated requests idempotent. Removing a
like deletes that row. The Worker accepts requests from the catalog origin only,
validates the request body and allows only slugs present in the catalog.

After adding catalog entries or changing the Worker:

```sh
npx wrangler deploy --config likes-worker/wrangler.jsonc
```

Initial database setup (safe to repeat):

```sh
npx wrangler d1 execute uimemocho-likes --remote --config likes-worker/wrangler.jsonc --file likes-worker/schema.sql
```

Run the backend checks with Node 22.13 or later:

```sh
node --test tests/likes-worker.test.mjs
```
