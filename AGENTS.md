# Publishing apps to uimemocho.github.io

## Standing user preference

When the user asks to publish or register a new game/tool on this site, complete
the entire workflow without repeating deployment confirmation questions:
implementation, catalog registration, thumbnail, commit/push, deployment and live
verification. Use existing authorized connections. If authentication has expired
or a genuinely new permission is required, explain the specific blocker. Never
claim completion while authentication or production deployment is pending.
This preference does not authorize posting to X or sending other messages.

## Production layout

- Repository: `uimemocho/uimemocho.github.io`, branch `main`.
- Public site: `https://uimemocho.github.io/`.
- Put static apps in `public/apps/<slug>/`; the live URL is `/apps/<slug>/`.
- Register apps in `data/projects.json`, following the current entry schema and
  preserving existing entries. Use a unique stable slug.
- Store catalog thumbnails in `public/project-thumbnails/catalog/`, following
  current entry conventions for the referenced URL.
- `.github/workflows/pages.yml` assembles the root site and `public/` into `_site`
  and deploys Pages on main pushes. A root `apps/` directory is not the source path.

## End-to-end publication

1. Inspect current repository instructions, catalog schema and workflows.
2. Prepare the complete app, catalog entry and thumbnail. Check asset paths under
   `/apps/<slug>/`, mobile portrait layout and iPhone Safari-compatible interactions.
3. Run checks relevant to the change, then commit/push using an available GitHub
   integration or authenticated git. GitHub browser editing is also authorized as
   fallback if integration writes are unavailable. Do not repeatedly retry an
   integration after an established authorization error.
4. Verify the Pages workflow for the actual commit and its production deployment.
5. Open the live app and catalog. Check loading, thumbnail, launch link and key
   controls. Test the new app's catalog like button, reload to check persistence,
   undo the test vote and confirm that the undo also persists.
6. Report the live URL and actual verification outcome. A source commit alone is
   not publication completion.

## Shared likes and the existing deployment connection

- Production uses the existing Cloudflare Worker `uimemocho-likes` and its existing
  D1 database. Config: `likes-worker/wrangler.jsonc`; frontend: `data/likes.json`.
- The Worker recognizes newly published catalog slugs automatically, cached for
  up to 60 seconds. Adding a catalog entry does not require redeploying the Worker.
- Worker source changes are tested/deployed by `.github/workflows/likes.yml` using
  the existing Actions repository secret `CLOUDFLARE_API_TOKEN`. This connection
  successfully deployed to production on 2026-11-03.
- Do not ask for token creation/registration again unless actual deployment
  evidence shows that the existing connection is missing, expired or insufficient.
- If an earlier workflow skipped deployment for missing credentials, rerun the
  latest applicable workflow after connection. A successful job with a skipped
  deploy step is not proof of a production update.
- Backend checks: `node --test tests/likes-worker.test.mjs`.
- Never retrieve, print or commit secret values; use the Actions secret in place.
- Preserve existing votes and the D1 binding. Do not replace shared counts with
  local-only likes or use another app's slug for a new app.

## Product preferences

- Mobile portrait, lightweight, intuitive UI and minimal explanatory text.
- No emoji icons; use the established icon system or SVG.
- Preserve app-specific requirements and existing behavior during publication.
- Do not add paid services or upgrade plans during routine publication.
