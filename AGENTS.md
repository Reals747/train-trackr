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
