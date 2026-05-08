# Seeds — Student Program Operations Platform

A Korean-language web platform for the **Seeds** student program: public site + application form (MVP 1), evaluator selection workflow (MVP 2), activity operation management (MVP 3), and **student activity record & utilization (MVP 4)** — activity timeline, projects, artifacts, feedback, and skill-tag-driven reports.

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

### Admin MVP 3 (role=admin)
- `/admin/students`, `/admin/students/:id` — Students list + detail (cohort/program assignments, attendance summary, submissions); convert accepted applicants → student
- `/admin/cohorts`, `/admin/programs` — CRUD
- `/admin/sessions`, `/admin/sessions/:id/attendance` — Sessions CRUD + per-session roster attendance editor
- `/admin/assignments`, `/admin/assignments/:id` — Homework CRUD + submission review/feedback
- `/admin/announcements` — Announcements CRUD (target = all / cohort / program), publish toggle

### Student (session-protected, role=student)
- `/student/login` — Reuses shared login form; role drives redirect
- `/student` — Dashboard (cohort, upcoming sessions, active assignments, latest announcements)
- `/student/sessions`, `/student/attendance`
- `/student/assignments`, `/student/assignments/:id` — Submit / re-submit (text + URL); status auto-flips to `late` past the due date
- `/student/announcements`

### Admin MVP 4 (role=admin)
- `/admin/activity-records` — searchable/filterable manual activity log (student/cohort/program/source/tag); CRUD + tag mappings
- `/admin/projects`, `/admin/projects/:id` — CRUD; per-project members, artifacts, feedback, tag mappings, and status updates from one screen
- `/admin/artifacts` — site-wide artifact CRUD (any type, any visibility, project- or student-scoped)
- `/admin/feedback` — site-wide feedback CRUD (target = student / project / submission / activity / session; visibility = student_visible | admin_only)
- `/admin/tags` — skill-tag CRUD (used to characterise activity records, projects, artifacts, feedback, and students)
- `/admin/students/:id/timeline` — admin view of a student's full activity stream with inline tag attach/detach
- `/admin/students/:id/report` — printable per-student report (cohorts, attendance, submissions, projects, artifacts, feedback highlights, tag summary, timeline)
- `/admin/cohorts/:id/summary` — cohort-level analytics (counts, attendance distribution, submission distribution, tag distribution, students missing activity)

### Student MVP 4 (role=student)
- `/student/timeline` — own activity stream (`studentId = me` AND `visibility = student_visible`)
- `/student/projects`, `/student/projects/:id` — projects I'm a member of, with members, artifacts, feedback, tags, and my role
- `/student/artifacts` — artifacts visible to me (own non-admin_only ∪ project-member with `student_visible`/`cohort_visible` ∪ same-cohort projects with `cohort_visible`)
- `/student/report` — printable own activity report (same shape as admin report but scoped to me; admin_only feedback excluded)

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

Admin MVP 3 (role=admin):
- `GET/POST/PATCH /admin/cohorts[/:id]`, `GET/POST/PATCH /admin/programs[/:id]`
- `GET/POST/PATCH /admin/students[/:id]`; `POST/DELETE /admin/students/:id/cohorts[/:cohortId]`; `POST/DELETE /admin/students/:id/programs[/:programId]`
- `GET /admin/applications-accepted-pending` — finalDecision=accepted but not yet a student
- `POST /admin/applications/:id/convert-to-student` — atomic: creates user(role=student) + students row; rejects if already converted (409) or not accepted (400)
- `GET/POST/PATCH /admin/sessions[/:id]`; `GET/PUT /admin/sessions/:id/attendance` — bulk roster upsert
- `GET/POST/PATCH /admin/assignments[/:id]` (MVP 3 homework); `PATCH /admin/submissions/:id` — feedback + status
- `GET/POST/PATCH /admin/announcements[/:id]`

Student (role=student via `requireStudent`):
- `GET /student/me` — student profile + cohorts + programs
- `GET /student/sessions`, `GET /student/attendance` — only sessions/records for my cohorts/programs
- `GET /student/assignments`, `GET /student/assignments/:id` — only published/closed in my cohorts/programs; `mySubmission` populated
- `POST /student/assignments/:id/submission` — upsert; status auto = `late` if past `dueAt`; rejected once assignment is `closed`
- `GET /student/announcements` — published only; `target=all` OR (cohort/program in mine)

Admin MVP 4 (role=admin):
- `GET/POST/PATCH/DELETE /admin/activity-records[/:id]` — filters: studentId, cohortId, programId, sourceType, tagId
- `GET/POST/PATCH/DELETE /admin/projects[/:id]`; `GET /admin/projects/:id` returns project + members + artifacts + feedback + tags
- `POST/DELETE /admin/projects/:id/members[/:memberId]` — `(project_id, student_id)` unique → 409
- `GET/POST/PATCH/DELETE /admin/artifacts[/:id]` — DB table is `artifacts`; route is `/admin/artifacts`; the file is `admin-mvp4-artifacts.ts` and the Drizzle export is `mvp4ArtifactsTable` to avoid the monorepo `artifacts/` directory clash
- `GET/POST/PATCH/DELETE /admin/feedback[/:id]` — visibility: `student_visible | admin_only`
- `GET/POST/PATCH/DELETE /admin/tags[/:id]` — unique tag name → 409 (matches pg `23505` or message contains `duplicate`)
- `GET/POST/DELETE /admin/tag-mappings[?targetType=&targetId=][/:id]` — `(tag_id, target_type, target_id)` unique → 409
- `GET /admin/students/:id/timeline` — full activity stream with tags joined
- `GET /admin/students/:id/report` — student profile, cohorts, programs, attendance summary, submissions, projects (+ my role), artifacts, feedback highlights, tag counts, full timeline
- `GET /admin/cohorts/:id/summary` — cohort, studentCount, attendanceOverview, submissionOverview, project/artifact counts, tag distribution, students missing activity

Student MVP 4 (role=student via `requireStudent`):
- `GET /student/timeline` — own records (`studentId = me`) with `visibility = student_visible` only; tags joined. `private` and `admin_only` records are not exposed to the student (admins flip visibility to `student_visible` to share)
- `GET /student/projects` — projects I'm a member of (via `project_members`)
- `GET /student/projects/:id` — only if I'm a member; returns project + members + my membership + artifacts (visibility ≠ admin_only) + feedback (visibility=student_visible) + tags
- `GET /student/artifacts` — own non-admin_only ∪ project-member with `student_visible`/`cohort_visible` ∪ same-cohort projects with `cohort_visible`
- `GET /student/report` — same shape as admin report but scoped to me; admin_only feedback excluded

## Database schema

- `applications` — MVP1 columns (incl. legacy `status` enum) + MVP2 `application_status` (lifecycle: submitted → document_review → interview → final_decision_made / withdrawn) and `final_decision` (pending | accepted | rejected | waitlisted | withdrawn).
- `users` — id, email (unique), name, password_hash (bcrypt), role (admin | evaluator), is_active, timestamps. Admin user is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on server startup (`bootstrapAdminFromEnv`).
- `evaluation_assignments` — (application_id, evaluator_id, stage) unique; status (assigned | in_progress | completed); assigned_by, assigned_at.
- `evaluations` — (application_id, evaluator_id, stage) unique; sub-scores (motivation, problem awareness, initiative, collaboration, fit) + overall_score (1-5) + recommendation + comment.
- `interviews` — (application_id) unique; scheduled_at, location_or_link, interviewer_note, status.
- `decision_logs` — append-only audit trail of `final_decision` changes (previous, new, reason, changed_by, created_at).

MVP 3 tables (additive, no destructive migrations):
- `cohorts` (name, dates, status), `programs` (cohort_id, name, status)
- `students` (user_id unique, application_id unique, profile cache, is_active)
- `student_cohorts` (student_id, cohort_id) unique; `student_programs` (student_id, program_id) unique
- `sessions` (cohort_id, program_id?, scheduled_at, duration, type, status)
- `attendance_records` (session_id, student_id) unique; status (present | late | absent | excused), marked_by
- `assignments` (cohort_id, program_id?, due_at, status: draft | published | closed, created_by) — homework table
- `assignment_submissions` (assignment_id, student_id) unique; status (not_submitted | submitted | late | reviewed); content / file_url / external_url; feedback, reviewed_by
- `announcements` (target_type: all | cohort | program, target_id, is_published, published_at, created_by)

Note: `evaluation_assignments` (MVP 2 evaluator→app routing) and `assignments` (MVP 3 homework) are distinct tables with distinct routes (`admin-assignments.ts` vs `admin-tasks.ts`).

MVP 4 tables (additive, non-destructive):
- `activity_records` — student_id, cohort_id, program_id?, source_type (session | assignment | project | feedback | manual), source_id?, title, description, activity_date, visibility (private | student_visible | admin_only — default `admin_only`).
- `projects` — cohort_id, program_id?, title, description, problem_statement, solution_summary, status (ideation | in_progress | submitted | presented | completed | archived), started_at, ended_at.
- `project_members` — (project_id, student_id) unique; role, contribution_summary.
- `artifacts` (Drizzle export `mvp4ArtifactsTable`, file `lib/db/src/schema/mvp4-artifacts.ts`) — student_id?, project_id?, assignment_submission_id?, title, description, artifact_type (link | document | presentation | video | code | image | report | other), url, visibility (private | student_visible | cohort_visible | admin_only — default `student_visible`).
- `feedback` — target_type (student | project | assignment_submission | activity_record | session), target_id, student_id?, author_id, feedback_type (general | strength | improvement | review | mentor_note | admin_note), content, visibility (student_visible | admin_only — default `admin_only`).
- `skill_tags` — name unique, description.
- `tag_mappings` — (tag_id, target_type, target_id) unique; target_type ∈ {activity_record, project, artifact, feedback, student}.

Student-side visibility rules in code:
- `student/timeline` = `studentId = me` AND `visibility = student_visible`.
- `student/artifacts` = own (any except admin_only) ∪ project-member with visibility ∈ {student_visible, cohort_visible} ∪ same-cohort projects with cohort_visible.
- `student/projects/:id` artifacts: own (any except admin_only) ∪ other members' (student_visible | cohort_visible). Never expose another member's `private` artifact.
- `student/report.feedbackHighlights` filters `visibility = student_visible` and `studentId = me`.

`users.role` widened to `admin | evaluator | student` (text column, no enum widening). Legacy `applications.status` is preserved untouched so MVP 1 admin flows keep working.

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
