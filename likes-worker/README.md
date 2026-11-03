# Shared catalog likes

The catalog stays on GitHub Pages. This small Cloudflare Worker stores anonymous
per-browser votes in D1; the public endpoint is configured in `data/likes.json`.
No account or email address is collected from visitors. A random browser ID is
kept in localStorage. Clearing browser storage loses the ability to undo previous
votes. It is a per-browser counter, not an authenticated person count.

The primary key `(slug, visitor)` makes repeated requests idempotent. Removing a
like deletes that row. The Worker accepts requests from the catalog origin only,
validates the request body and allows only slugs present in the catalog.

New published catalog entries are recognized automatically (cached for up to 60 seconds).
Bundled projects remain available if the catalog cannot be reached. Unknown projects
are rejected, and catalog failures return 503 without writing a vote.

Worker changes deploy through `.github/workflows/likes.yml` after tests pass, once
`CLOUDFLARE_API_TOKEN` is configured as a repository Actions secret. Without that
secret the workflow runs tests and explicitly skips deployment. After configuring
the secret, run **Deploy shared likes** manually once to apply pending changes.
Use a token scoped to the existing Cloudflare account with only the permissions
needed to deploy this Worker and bind its existing D1 database. Do not put its
value in the repository or chat.

For an authenticated local deployment:

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
