<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Production data (CRITICAL)

This app is a **live website** with real production data. Treat every database and deployment change accordingly.

- **Never delete production data** — no bulk `DELETE`, truncates, `DROP TABLE` / `DROP COLUMN`, or migrations that wipe or rewrite existing rows.
- **Migrations must be additive** — prefer new nullable columns, new tables, and backfills over destructive schema changes.
- **Do not run seed, reset, or “clean slate” scripts against production** — those are for local/dev only.
- **When in doubt**, choose the path that preserves existing data and allows gradual rollout (nullable fields, defaults, dual-write/backfill, feature flags).

Local development may use fresh databases; production must always remain intact.

## Version number before commit & push

The on-screen version is shown in the site footer (`SiteFooter` → `APP_VERSION`). It is built at compile time from `package.json`’s `version` field plus build metadata in `next.config.ts` (e.g. `2.1.0+847` locally, or `2.1.0+abc1234` on Vercel).

**Before committing and pushing any update to GitHub**, always ask the user how they want to handle the version number. Do not bump, skip, or assume a versioning scheme on your own.

When asking, include the current `package.json` version and a short reminder of what changes on deploy (base semver vs. auto-generated `+` suffix). Typical options to offer:

- **No change** — keep `package.json` version as-is (the `+` suffix still updates per build/commit).
- **Patch / minor / major bump** — update `package.json` `version` (and only other version files if the user requests).
- **Custom version** — use whatever semver string the user specifies.

Only update `package.json` (or related version config) after the user confirms. If they ask you to commit and push in the same request, resolve the version question first, then commit and push.
