# HotSchedules (Fourth) integration docs

Drop publicly available HotSchedules / Fourth API documentation here (PDF, Markdown, HTML export, etc.).

**Start here:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — integration plan, mapping to Train Trackr stores/profiles, and implementation phases.

## What to add

- Official integration guides for third-party websites
- API reference (auth, endpoints, request/response examples)
- Location / store ID mapping notes
- Any public diagrams or onboarding checklists from Fourth

## What not to add

- API keys, client secrets, or OAuth tokens
- Production credentials or `.env` values
- Customer or employee PII from live systems

## Related code

When implementing the live schedule feed, start from:

- `src/lib/schedule-server.ts` — server boundary (`loadScheduleDay`)
- `src/app/api/schedule/route.ts` — authenticated API route
- `src/lib/schedule.ts` — shared types and break rules
- `src/components/ScheduleDayList.tsx` — schedule UI

Credentials belong in environment variables (e.g. Vercel), not in this folder.
