# Training Tracker

Training Tracker is a mobile-first full-stack app for quick-service style training: one store per tenant, role-based access, position checklists, trainee progress, team announcements, and a lightweight activity feed. Updates on the main dashboard refresh on a short polling interval so trainers see changes without WebSockets.

## Stack

- **Next.js 16** (App Router, Turbopack in dev) + **React 19** + **Tailwind CSS 4**
- **Route handlers** under `src/app/api` for auth, CRUD, and exports
- **PostgreSQL** + **Prisma 6**
- **JWT** sessions via HTTP-only cookies (`jsonwebtoken`, `bcryptjs`)
- **Zod** for request validation where used in API routes

## Roles and permissions

Prisma enum `Role`: `OWNER`, `ADMIN`, `TRAINER`, `VIEWER`.

Authoritative permission lists live in [`src/config/roles.json`](src/config/roles.json) and are read through [`src/lib/permissions.ts`](src/lib/permissions.ts) (safe to import from client code).

- **Owner** — Store creator: full training setup, members, announcements, workflow, and store rename/delete. Cannot be demoted or removed through the app.
- **Admin** — Invited manager: same operational scope as owner except store rename/delete and owner-specific member rules.
- **Trainer** — Trainees, checklist completion, announcements (comment), account/appearance.
- **Viewer** — Read-only progress and activity where exposed, plus account/appearance.

## Data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). All store-scoped entities use `storeId` for tenant isolation.

| Area | Models |
|------|--------|
| Core | `Store`, `User`, `StoreSetting` |
| Training | `Position` (optional `hidden`), `ChecklistItem`, `Trainee`, `TraineePosition`, `TrainingProgress` |
| Comms | `Announcement`, `AnnouncementComment` |
| Audit | `ActivityLog` |

`StoreSetting` includes store-level options (for example trainer visibility and optional **trainer invite code** + expiry). `User` may store **appearance** preferences in `appearanceJson` (synced for that account).

## App structure

| Path | Purpose |
|------|---------|
| [`src/app/page.tsx`](src/app/page.tsx) | Main shell: auth (login / register store / register with trainer invite), dashboard, settings, announcements, activity |
| [`src/app/workflow/[traineeId]/`](src/app/workflow/[traineeId]/) | Dedicated per-trainee training workflow |
| [`src/lib/auth.ts`](src/lib/auth.ts) | Password hashing, JWT cookie helpers |
| [`src/lib/api.ts`](src/lib/api.ts) | Server-side auth, role checks, store scoping |
| [`src/lib/client-api.ts`](src/lib/client-api.ts) | Client fetch helpers |
| [`src/lib/format-datetime.ts`](src/lib/format-datetime.ts) | Shared date/time formatting |
| [`src/lib/activity.ts`](src/lib/activity.ts) | Activity logging helpers |
| [`src/lib/prisma.ts`](src/lib/prisma.ts) | Prisma singleton |

### API routes (`src/app/api`)

- **Auth** — `auth/login`, `auth/logout`, `auth/me`, `auth/register`, `auth/register-trainer`
- **Core** — `dashboard`, `trainees`, `trainees/[traineeId]`, `positions`, `positions/[positionId]`, `positions/[positionId]/items`, `checklist-items/[itemId]`, `progress`, `activity`, `users`
- **Announcements** — `announcements`, `announcements/[announcementId]`, `announcements/[announcementId]/comments`
- **Settings** — `settings` (store toggles such as trainer visibility and default dark mode), `settings/account`, `settings/appearance`, `settings/store-details`, `settings/trainers`, `settings/trainers/[trainerId]`, `settings/invite-code`
- **Export** — `export/trainee/[traineeId]` (CSV)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy [`.env.example`](.env.example) to `.env` and set:

   - `DATABASE_URL` — PostgreSQL connection string
   - `JWT_SECRET` — long random secret

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. **Prisma**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   npm run prisma:seed
   ```

4. **Run dev server** (listens on `0.0.0.0:3000`)

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Optional: legacy database migration

If you upgraded from an older schema where the first user was `ADMIN` instead of `OWNER`, you can run:

```bash
npx tsx scripts/promote-owners.ts
```

That promotes the oldest `ADMIN` per store to `OWNER` when no owner exists. Review output before relying on it in production.

## Seeded demo accounts

After `npm run prisma:seed`:

| Email | Password | Role in seed |
|-------|----------|----------------|
| `admin@store.com` | `Admin1234!` | **Owner** (demo “operator” account) |
| `trainer@store.com` | `Trainer1234!` | Trainer |
| `viewer@store.com` | `Viewer1234!` | Viewer |

## Product features (current)

- Multi-tenant store isolation and JWT cookie auth
- Permission matrix driven by `roles.json` (owner/admin/trainer/viewer)
- Trainee dashboard with search, position assignment, and progress detail
- Per-trainee workflow route for checklist completion
- Store registration plus **trainer self-registration** via invite code (when configured)
- Team / member management and trainer list settings for privileged roles
- **Announcements** with threaded **comments**
- Per-user **appearance** (including dark mode) stored server-side
- CSV export per trainee
- Slack-style **activity** feed on the dashboard
- Dashboard **polling** every 5 seconds for fresher data without WebSockets

## Scripts (`package.json`)

| Script | Command |
|--------|---------|
| `dev` | `next dev --hostname 0.0.0.0 --port 3000` |
| `build` / `start` | Production build and server |
| `lint` | ESLint |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:seed` | `tsx prisma/seed.ts` |

## Notes

- Polling keeps deployment simple and works well on store Wi‑Fi; WebSockets are not used.
- For production hardening, consider stricter rate limits, pagination on large lists, automated tests on critical routes, and operational monitoring around auth and exports.
