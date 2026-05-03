# Seeds — Student Program Operations Platform

A Korean-language web platform for the **Seeds** student program: a public site to attract applicants, an application form that saves to PostgreSQL, and an admin dashboard to triage submissions.

## Stack

- **Monorepo**: pnpm workspaces (see `pnpm-workspace.yaml`)
- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn/ui (`artifacts/seeds`)
- **Backend**: Express 5 + TypeScript (`artifacts/api-server`)
- **Database**: Replit PostgreSQL via Drizzle ORM (`lib/db`)
- **API contract**: OpenAPI 3.1 → orval-generated React Query hooks + Zod validators (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)
- **Auth**: Signed HMAC session cookie for admin (no DB session table)

The shared proxy at `localhost:80` routes `/api/*` to the API server and everything else to the Vite dev server.

## Routes

### Public (Seeds web app, all Korean UI)
- `/` — Home: hero, intro, who should apply, program flow, schedule, FAQ teaser, CTA
- `/about` — About the program
- `/program` — Program details / curriculum / schedule
- `/faq` — Full FAQ
- `/apply` — Application form (zod-validated, calls `POST /api/applications`)
- `/apply/success` — Success page

### Admin (session-protected)
- `/admin/login` — Email + password login
- `/admin` — Stats dashboard
- `/admin/applications` — Searchable, filterable applications table + CSV export
- `/admin/applications/:id` — Detail view with editable status + admin note

## API endpoints (`/api/...`)

- `GET  /healthz`
- `POST /applications` — public submission
- `POST /admin/login` — checks `ADMIN_EMAIL` / `ADMIN_PASSWORD`, sets `seeds_admin` cookie
- `POST /admin/logout` — clears cookie
- `GET  /admin/me` — current session
- `GET  /admin/applications?q=&status=` — list (search + filter)
- `GET  /admin/applications/stats` — counts per status
- `GET  /admin/applications/export` — CSV download
- `GET  /admin/applications/:id`
- `PATCH /admin/applications/:id` — update status / adminNote

## Database schema

`applications` table (`lib/db/src/schema/applications.ts`):
`id`, `name`, `email`, `phone`, `school`, `grade`, `birth_year`, `interest_area`, `motivation`, `experience`, `problem_awareness`, `expectation`, `privacy_consent`, `status`, `admin_note`, `submitted_at`, `updated_at`.

Status enum: `submitted | reviewing | interview | accepted | rejected | waitlisted | withdrawn`.

## Required environment variables / secrets

- `DATABASE_URL` — provisioned automatically by Replit
- `SESSION_SECRET` — used to sign the admin session cookie
- `ADMIN_EMAIL` — the only email allowed to log in to /admin
- `ADMIN_PASSWORD` — the only password accepted
- `NODE_ENV` — `production` makes the session cookie `Secure`

## How to run locally

The Replit workflows handle this — you do not run `pnpm dev` at the root. Workflows:
- `artifacts/api-server: API Server` — runs the Express API on port 8080
- `artifacts/seeds: web` — runs the Vite dev server
- `artifacts/mockup-sandbox: Component Preview Server` — design sandbox (not used at runtime)

To restart, use `restart_workflow <name>`.

## How to push DB schema changes

After editing files in `lib/db/src/schema/`:

```
pnpm --filter @workspace/db run push
```

Use `pnpm --filter @workspace/db run push-force` only when you need to drop columns.

## How to update the API contract

Edit `lib/api-spec/openapi.yaml`, then:

```
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/src/generated/*` and `lib/api-zod/src/generated/*`, then runs `tsc --build` to verify types.

## How to deploy

When ready, suggest deploy. The `deployment` skill handles building both artifacts; the proxy automatically routes `/api/*` to the API server in production.

## Security notes

- Admin credentials are read from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars; never hardcoded or sent to the client.
- `verifyAdminCredentials` uses `crypto.timingSafeEqual` to avoid timing leaks.
- All `/api/admin/*` routes (except `login` and `logout`) require a valid session via `requireAdmin` middleware.
- Public form input is validated server-side with the generated `CreateApplicationBody` Zod schema and trimmed before insert.
- Session cookie is `httpOnly`, `sameSite=lax`, and `Secure` in production.
