# Seeds — Student Program Operations Platform

A Korean-language web platform for the **Seeds** student program: a public site to attract applicants, an application form that saves to PostgreSQL, an admin dashboard to triage submissions, and a selection management module (MVP 2) for evaluator assignment, document/interview evaluations, interview scheduling, and final decision tracking.

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

### Admin (session-protected, role=admin)
- `/admin/login` — Shared login for admin & evaluator (login redirects by role)
- `/admin` — Stats dashboard
- `/admin/applications` — Searchable, filterable applications table + CSV export
- `/admin/applications/:id` — Detail view: assignments, evaluations (avg), interview upsert, final decision + decision log timeline
- `/admin/evaluators` — Evaluator CRUD (create with bcrypt password, toggle active)

### Evaluator (session-protected, role=evaluator)
- `/evaluator` — My assigned applications
- `/evaluator/applications/:id` — Read application + submit evaluation form (per stage)

## API endpoints (`/api/...`)

Public + auth:
- `GET  /healthz`
- `POST /applications` — public submission
- `POST /admin/login` — bcrypt-verified against `users` table; sets `seeds_admin` cookie
- `POST /admin/logout` — clears cookie
- `GET  /admin/me` — current session (returns role)

Admin (role=admin via `requireAdmin`):
- `GET  /admin/applications?q=&status=&applicationStatus=&finalDecision=&interviewStatus=&evaluationCompletion=`
- `GET  /admin/applications/stats`
- `GET  /admin/applications/export` — CSV (now includes MVP2 columns)
- `GET  /admin/applications/:id` — joins assignments, evaluations, interview, decisionLogs, avgDocReviewScore
- `PATCH /admin/applications/:id` — legacy status / adminNote (MVP1 compatible)
- `POST  /admin/applications/:id/assignments` + `DELETE /:appId/assignments/:assignmentId`
- `PUT   /admin/applications/:id/interview` — upsert (one per app)
- `PATCH /admin/applications/:id/final-decision` — writes a `decision_logs` row, sets `applicationStatus`
- `GET   /admin/users?role=` · `POST /admin/users` · `PATCH /admin/users/:id`

Evaluator (role=evaluator via `requireEvaluator`):
- `GET  /evaluator/assignments` — own assigned applications + completion flag
- `GET  /evaluator/applications/:id` — only if assigned; returns app + own assignments/evaluations
- `POST /evaluator/applications/:id/evaluations` — upsert evaluation per (app, evaluator, stage); auto-marks assignment `completed`

## Database schema

- `applications` — MVP1 columns (incl. legacy `status` enum) + MVP2 `application_status` (lifecycle: submitted → document_review → interview → final_decision_made / withdrawn) and `final_decision` (pending | accepted | rejected | waitlisted | withdrawn).
- `users` — id, email (unique), name, password_hash (bcrypt), role (admin | evaluator), is_active, timestamps. Admin user is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on server startup (`bootstrapAdminFromEnv`).
- `evaluation_assignments` — (application_id, evaluator_id, stage) unique; status (assigned | in_progress | completed); assigned_by, assigned_at.
- `evaluations` — (application_id, evaluator_id, stage) unique; sub-scores (motivation, problem awareness, initiative, collaboration, fit) + overall_score (1-5) + recommendation + comment.
- `interviews` — (application_id) unique; scheduled_at, location_or_link, interviewer_note, status.
- `decision_logs` — append-only audit trail of `final_decision` changes (previous, new, reason, changed_by, created_at).

Legacy `applications.status` is preserved untouched so MVP 1 admin flows keep working.

## Required environment variables / secrets

- `DATABASE_URL` — provisioned automatically by Replit
- `SESSION_SECRET` — signs the `seeds_admin` HMAC session cookie (`{userId, role, exp}`, 7d TTL)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — bootstraps/refreshes the admin user in the `users` table on every server start
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

- Passwords are stored as bcrypt hashes in the `users` table; the bootstrapped admin user comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- `requireAdmin`, `requireEvaluator`, and `requireAuth` middleware gate every protected route. Evaluator endpoints additionally check that the caller is actually assigned to the requested application.
- The session cookie is HMAC-signed via `SESSION_SECRET`, `httpOnly`, `sameSite=lax`, and `Secure` in production. Payload contains `{userId, role, exp}` only.
- All public form input is validated server-side with generated Zod schemas and trimmed before insert.
- Final decision changes are append-only in `decision_logs` with the changing user recorded; CSV export still applies the formula-injection guard.
