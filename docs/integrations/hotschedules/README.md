# HotSchedules (Fourth) integration docs

Documentation for integrating Train Trackr's Schedule tab with **Fourth Workforce Management** (HotSchedules).

**Start here:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — integration plan, REST API mapping, and implementation phases.

**Live API reference:** [Fourth Schedules API Guide](https://developer.fourth.com/en-gb/docs/schedules-api/guide)

## What to add

- Official Fourth integration guides (Schedules, UK Employee, etc.)
- API reference notes (auth, endpoints, request/response examples)
- Location / department mapping notes for Train Trackr profiles
- Any public diagrams or onboarding checklists from Fourth

## What not to add

- API keys, client secrets, or OAuth tokens
- Production credentials or `.env` values
- Customer or employee PII from live systems

## Legacy

- [`SOAP+Web+Services+API+Documentation.pdf`](./SOAP+Web+Services+API+Documentation.pdf) — superseded by the REST Schedules API; kept for historical reference only.

## Related code

When implementing or debugging the live schedule feed, start from:

- `src/lib/schedule-server.ts` — server boundary (`loadScheduleDay`)
- `src/lib/hotschedules/` — Fourth REST client, config, mapper
- `src/app/api/schedule/route.ts` — authenticated API route
- `src/lib/schedule.ts` — shared types and break rules
- `src/components/ScheduleDayList.tsx` — schedule UI

Credentials belong in environment variables (e.g. Vercel), not in this folder.
