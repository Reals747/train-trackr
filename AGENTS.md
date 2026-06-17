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

**First**, give a brief summary of what changed in the update (2–5 bullets or a short paragraph) so the user can judge the semver level — e.g. bug fixes → patch, new features → minor, breaking changes → major. Mention anything user-facing, API/schema changes, or deploy-only/no-op releases when relevant.

When asking about the version, include the current `package.json` version, that change summary, and a short reminder of what changes on deploy (base semver vs. auto-generated `+` suffix). Typical options to offer:

- **No change** — keep `package.json` version as-is (the `+` suffix still updates per build/commit).
- **Patch / minor / major bump** — update `package.json` `version` (and only other version files if the user requests).
- **Custom version** — use whatever semver string the user specifies.

Only update `package.json` (or related version config) after the user confirms. If they ask you to commit and push in the same request, provide the change summary and resolve the version question first, then commit and push.

## HotSchedules (Fourth) schedule integration

Public HotSchedules / Fourth API documentation lives in **`docs/integrations/hotschedules/`**. Before designing or implementing schedule sync, auth, or mapping:

1. **Read the files in that folder** — start with **`docs/integrations/hotschedules/ARCHITECTURE.md`**, then the [Fourth Schedules API Guide](https://developer.fourth.com/en-gb/docs/schedules-api/guide); treat them as the source of truth over generic HotSchedules knowledge. The SOAP PDF in that folder is **legacy** only.
2. **Do not commit secrets** — API keys and tokens stay in environment variables only.
3. **Keep the integration boundary** — external API calls belong in `src/lib/schedule-server.ts` (or new server-only modules it imports). The route `src/app/api/schedule/route.ts` stays thin; UI types stay in `src/lib/schedule.ts`.
4. **Preserve existing behavior during rollout** — mock data in `src/lib/schedule-mock.ts` can remain until live sync is verified; prefer feature flags or gradual profile-by-profile enablement when connecting production stores.
5. **Map Fourth concepts to Train Trackr** — document how HotSchedules location/store IDs align with `StoreProfile` keys (`profileKey`) per store; breaks and shift display should still flow through `computeShiftBreakSlots()` unless the API exposes break data that should override rules.

If the folder is empty, ask the user to add the public doc before guessing endpoint or auth details.
