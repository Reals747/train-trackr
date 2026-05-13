# Training Tracker (Train Trackr)

**Training Tracker** is the repository and package name; the in-app product title is **Train Trackr**. It is a mobile-first full-stack app for quick-service style training: one store per tenant, role-based access, position checklists with optional section headers, trainee progress, team management, and a lightweight activity feed. The main shell **polls core data every five seconds** so trainers see updates without WebSockets.

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Route handlers** under `src/app/api` for auth, CRUD, and exports
- **PostgreSQL** + **Prisma 6**
- **JWT** sessions via HTTP-only cookies (`jsonwebtoken`, `bcryptjs`)
- **Zod** for request validation on API routes
- **@dnd-kit** for drag-and-drop in Settings → Position Setup (position and checklist item reordering)

## Roles and permissions

Prisma enum `Role`: `OWNER`, `ADMIN`, `TRAINER`.

Authoritative permission lists live in [`src/config/roles.json`](src/config/roles.json) and are enforced through [`src/lib/permissions.ts`](src/lib/permissions.ts) (safe to import from client code for UI gates; the API re-checks permissions server-side).

- **Owner** — Store creator: full training setup, members, workflow, store rename/delete, and store join code rotation. Cannot be demoted or removed through the app.
- **Admin** — Invited manager: same operational scope as owner except store rename/delete, store delete/code reset, and rules that protect the owner account (e.g. renaming the owner may be restricted to the owner or elevated roles per API).
- **Trainer** — Trainees, checklist completion, workflow, account/appearance, and related settings allowed by `roles.json`.

## Data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). All store-scoped entities use `storeId` for tenant isolation.

| Area | Models |
|------|--------|
| Core | `Store`, `User`, `StoreSetting` |
| Training | `Position` (`hidden`, manual `order`), `ChecklistItem` (`kind`: item vs section header), `Trainee`, `TraineePosition`, `TrainingProgress` |
| Workflow notes | `WorkflowGeneralComments` — per-trainee, per-position general comments for the live workflow UI (not a substitute for per-checklist progress) |
| Comms | `Announcement`, `AnnouncementComment` |
| Audit | `ActivityLog` |

`StoreSetting` includes store-level options (e.g. trainer visibility and default dark mode flags). `User.appearanceJson` stores **per-user appearance** (accent, font scale, theme preference, etc.) synced for that account across devices.

## App structure

| Path | Purpose |
|------|---------|
| [`src/app/page.tsx`](src/app/page.tsx) | Main client shell: **session bootstrap** (`/api/auth/me`) with a full-screen [`LoadingScreen`](src/components/LoadingScreen.tsx) until the session is known (then login or the signed-in app); auth modes (login, register store, register trainer, set password); **Dashboard** (trainee progress, search); **Live Training** tab linking into workflow; **Settings** (account, store, appearance, position setup, user management, trainee management); **Activity** when permitted; dashboard trainee modal |
| [`src/app/workflow/[traineeId]/`](src/app/workflow/[traineeId]/) | Dedicated per-trainee checklist workflow client |
| [`src/components/LoadingScreen.tsx`](src/components/LoadingScreen.tsx) | Shared spinner (accent-colored arc); default label **“Loading”**; workflow route passes **“Loading checklist”** where appropriate |
| [`src/lib/auth.ts`](src/lib/auth.ts) | Password hashing, JWT cookie helpers |
| [`src/lib/api.ts`](src/lib/api.ts) | Server-side auth, role checks, store scoping |
| [`src/lib/client-api.ts`](src/lib/client-api.ts) | Browser `fetch` helper for JSON APIs |
| [`src/lib/format-datetime.ts`](src/lib/format-datetime.ts) | Shared date/time formatting |
| [`src/lib/activity.ts`](src/lib/activity.ts) | Activity logging helpers |
| [`src/lib/prisma.ts`](src/lib/prisma.ts) | Prisma singleton |

### API routes (`src/app/api`)

- **Auth** — `auth/login`, `auth/logout`, `auth/me`, `auth/register`, `auth/register-trainer`, `auth/set-password`
- **Core** — `dashboard`, `trainees`, `trainees/[traineeId]`, `positions`, `positions/reorder`, `positions/[positionId]`, `positions/[positionId]/items`, `positions/[positionId]/items/reorder`, `checklist-items/[itemId]`, `progress`, `activity`, `users`
- **Workflow comments** — `workflow-general-comments`, `workflow-general-comments/for-trainee`
- **Announcements** — `announcements`, `announcements/[announcementId]`, `announcements/[announcementId]/comments`
- **Settings** — `settings`, `settings/account`, `settings/account/password`, `settings/appearance`, `settings/store-details`, `settings/reset-store-code`, `settings/trainers`, `settings/trainers/[trainerId]`, `settings/invite-code`
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

After `npm run prisma:seed`, sign in with **username** (per-store uniqueness) and password where applicable:

| Username | Password | Role in seed |
|----------|----------|----------------|
| `admin` | `Admin1234!` | **Owner** (demo operator account) |
| `trainer` | *(none in seed — trainer store-code login flow)* | Trainer |

The seed also creates a demo store (with **store join code** printed in the seed output), sample positions/checklists, and a trainee with partial progress for local testing.

## Product features (current)

- Multi-tenant store isolation and JWT cookie auth; **no login flash** on cold load—the shell shows a **loading** screen until `/api/auth/me` completes, then login or the main app; dashboard data continues loading in the background after sign-in.
- Permission matrix from `roles.json`, enforced on the server for mutations.
- **Dashboard**: trainee progress list (search, completion styling), **Manage trainees** entry to settings when permitted, trainee detail modal; **polling** every five seconds with the rest of the shell refresh.
- **Live Training / workflow**: per-trainee checklist route; progress and **workflow general comments** APIs; loading UI reused from `LoadingScreen`.
- **Settings → Account**: profile fields, **edit display name** (same flow as team rename), log out.
- **Settings → Store**: store metadata; **change store name** via modal when permitted; **security reset** (store join code rotation) and danger zone when permitted.
- **Settings → Appearance**: theme (light / follow system / dark), font size, **accent color** as four preset swatches (no free-form color picker), persisted in `appearanceJson`; CSS variables drive buttons and focus rings.
- **Settings → Position Setup**: drag-sort positions, hide/show, rename, delete; expandable rows; section headers and checklist items with drag reorder; add item/header via modals/actions at the bottom of each position.
- **Settings → User Management**: team list, roles, invites, name edits per permissions; assigning the **Owner** role is restricted by the API and `roles.json`.
- **Settings → Trainee Management**: create/delete trainees (as permitted).
- **Activity** tab when the role allows `activity.view`.
- **Announcements**: API routes and `refreshCore` still load announcement data for the shell, but the **dashboard announcements block is commented out** in `page.tsx` so it can be turned back on without losing wiring.
- CSV export per trainee.

## Scripts (`package.json`)

| Script | Command |
|--------|---------|
| `dev` | `next dev --hostname 0.0.0.0 --port 3000` |
| `build` | `prisma generate && next build` |
| `start` | `next start` |
| `lint` | ESLint |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:seed` | `tsx prisma/seed.ts` |

## Notes

- Polling keeps deployment simple and works well on store Wi‑Fi; WebSockets are not used.
- For production hardening, consider stricter rate limits, pagination on large lists, automated tests on critical routes, and operational monitoring around auth and exports.
