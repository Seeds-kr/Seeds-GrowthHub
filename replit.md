# Seeds — Student Developer Club Operations Platform

Korean web platform for the **Seeds** student developer club (학생 개발자 동아리). Public site positioned around study groups, side projects, hackathons, and senior dev mentorship — **not** "leadership program".

Scope:
- **MVP1** public site + application form
- **MVP2** evaluator selection workflow (assignments, evaluations, interview, final decision + audit log)
- **MVP3** activity ops (cohorts, programs, sessions, attendance, homework, announcements, students)
- **MVP4** student activity record & utilization (timeline, projects, artifacts, feedback, skill tags, reports, cohort summary)

## Stack

- **Monorepo**: pnpm workspaces (`pnpm-workspace.yaml`)
- **Frontend**: Vite + React + TS + Tailwind + shadcn/ui (`artifacts/seeds`)
- **Backend**: Express 5 + TS (`artifacts/api-server`)
- **DB**: Replit Postgres via Drizzle ORM (`lib/db`)
- **API contract**: OpenAPI 3.1 → orval React Query hooks + Zod (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)
- **Auth**: HMAC-signed session cookie (`seeds_admin`, no DB session table)

Shared proxy at `localhost:80` routes `/api/*` → API server, everything else → Vite.

## Routes (web)

Public (Korean UI): `/`, `/about`, `/program`, `/faq`, `/recruit`, `/apply`, `/apply/success`, `/people` (탭 멘토/운영진/학생, 레거시 `/mentors`·`/staff`·`/members` 동일 페이지로 진입 시 탭 자동 선택, 탭 전환 시 URL `replace` 동기화), `/activate/:token` (no layout).

Admin (`role=admin`): `/admin/login`, `/admin`, `/admin/applications[/:id]`, `/admin/evaluators` (nav label "평가 담당자" — pool of mentors/admins assignable as evaluators), `/admin/students[/:id]`, `/admin/cohorts`, `/admin/programs`, `/admin/sessions[/:id/attendance]`, `/admin/assignments[/:id]`, `/admin/announcements`, `/admin/people`, `/admin/site-content`, `/admin/activity-records`, `/admin/projects[/:id]`, `/admin/artifacts`, `/admin/feedback`, `/admin/tags`, `/admin/students/:id/timeline`, `/admin/students/:id/report`, `/admin/cohorts/:id/summary`.

Mentor (`role=mentor`): `/mentor`, `/mentor/profile` (edits own `people_profiles` row where `userId=me, kind=mentor`; admin must create the row first — no lazy create).

Evaluation surface (not a role, an access-controlled sub-task): `/evaluator`, `/evaluator/applications/:id` — open to any user whose effective roles include `admin` OR `mentor`. The `evaluator` role itself was removed (the club has no external evaluators); admins assign other admins/mentors to evaluate applications via `/admin/evaluators`.

Student (`role=student`): `/student/login` (shared form), `/student`, `/student/sessions`, `/student/attendance`, `/student/assignments[/:id]`, `/student/announcements`, `/student/profile`, `/student/timeline`, `/student/projects[/:id]`, `/student/artifacts`, `/student/report`.

Each role layout admits any user whose effective roles include its role and shows a header role-switcher (button row) to navigate between `/admin` · `/mentor` · `/student`. Switching does not re-issue the session — access is purely role-membership-based.

## API endpoints (`/api/...`)

Public: `GET /healthz`, `POST /applications`, `POST /admin/login`, `POST /admin/logout`, `GET /admin/me`, `GET /api/site-content[/:key]`, `GET /api/people/:kind` (kind ∈ `mentor|staff|member`, only `is_public=true`, sorted `display_order asc, id asc`; uses `optionalAuth` — `phone` field is `null` for anonymous viewers, populated for any logged-in member per `canViewMemberContacts`), `GET|POST /api/activation/:token`.

Admin (`requireAdmin`):
- Applications: `GET /admin/applications` (filters `q,status,applicationStatus,finalDecision,interviewStatus,evaluationCompletion`), `/stats`, `/export` (CSV w/ formula-injection guard), `GET|PATCH /admin/applications/:id`, `POST|DELETE /admin/applications/:id/assignments[/:assignmentId]`, `PUT /admin/applications/:id/interview` (one per app), `PATCH /admin/applications/:id/final-decision` (writes `decision_logs`).
- Users: `GET /admin/users?role=`, `POST /admin/users`, `PATCH /admin/users/:id` (incl. `extraRoles`).
- MVP3: full CRUD `/admin/{cohorts,programs,students,sessions,assignments,announcements}`; `/admin/students/:id/cohorts[/:cohortId]` and `/programs[/:programId]`; `/admin/sessions/:id/attendance` (bulk PUT); `PATCH /admin/submissions/:id`; `GET /admin/applications-accepted-pending`; `POST /admin/applications/:id/convert-to-student` (`{password?}` — omitted = create inactive user + issue activation token, response `{activationToken, activationPath, expiresAt}`); `POST /admin/users/:id/activation-token` (re-issue; marks prior unused tokens used, latest-wins).
- MVP4: full CRUD `/admin/{activity-records,projects,artifacts,feedback,tags,tag-mappings}`. `GET /admin/projects/:id` returns project + members + artifacts + feedback + tags. `POST|DELETE /admin/projects/:id/members[/:memberId]` (unique `(project,student)`). `GET /admin/students/:id/{timeline,report}`. `GET /admin/cohorts/:id/summary`.
- People: `GET /admin/people[?kind=]`, `POST`, `PATCH`, `DELETE`. `user_id`/`student_id` unique → 409. `POST /admin/people/:id/generate-avatar` — Gemini-generated minimalist illustration avatar (no text, mint+white palette, abstract head silhouette, no facial features). Saves PNG to object storage with ACL `visibility=public`, stores `photoUrl = /api/storage/objects/uploads/<uuid>`. Deletes prior avatar object on replacement; cleans up uploaded object on later failure.
- Storage: unauthenticated `GET /api/storage/objects/*` serves only objects stamped `visibility=public` via `objectAcl.canAccessObject` (private objects → 404). All other storage uploads go through admin-gated routes.
- Site content: `GET /admin/site-content` (always returns all known keys, blanks included), `PUT /admin/site-content/:key`.

Evaluator surface (`requireAdminOrMentor`): `GET /evaluator/assignments`, `GET /evaluator/applications/:id` (only if assigned), `POST /evaluator/applications/:id/evaluations` (upsert per `(app,evaluator,stage)`, auto-marks assignment `completed`). The route handler additionally enforces per-application assignment ownership — having admin/mentor role alone is not enough.

Mentor (`requireMentor`): `GET|PATCH /mentor/profile` — fetches/updates the `people_profiles` row with `kind=mentor, userId=me`. Returns 404 if no such row exists (mentor profiles are NOT lazy-created; admin sets them up via `/admin/people` and links `userId`).

Student (`requireStudent`): `GET /student/me`, `/sessions`, `/attendance`, `/assignments[/:id]` (only published/closed in my cohorts/programs; `mySubmission` populated), `POST /student/assignments/:id/submission` (upsert; auto `late` past `dueAt`; rejected once `closed`), `/announcements` (published only; `target=all` OR my cohort/program), `/timeline` (own + `student_visible` only), `/projects[/:id]` (only if member; artifacts ≠ admin_only, feedback `student_visible`), `/artifacts` (own non-admin_only ∪ project-member `student_visible`/`cohort_visible` ∪ same-cohort projects with `cohort_visible`), `/report` (admin_only feedback excluded), `GET|PATCH /student/profile` (lazy-creates `people_profiles` row `kind=member, isPublic=false` on first GET; student cannot change `kind`/`studentId`/`userId`/`displayOrder`).

Naming notes:
- DB table is `artifacts`, route is `/admin/artifacts`, file is `admin-mvp4-artifacts.ts`, Drizzle export is `mvp4ArtifactsTable` — to avoid clash with monorepo `artifacts/` dir.
- `evaluation_assignments` (MVP2 evaluator routing) and `assignments` (MVP3 homework) are distinct tables/routes (`admin-assignments.ts` vs `admin-tasks.ts`).
- Site content key whitelist: `page.home | page.recruit | page.about | page.program | page.faq`. Defaults bootstrapped from `artifacts/api-server/src/lib/site-content-defaults.ts` on every server start (`onConflictDoNothing` + label refresh + one-time legacy "leadership" copy migration). Frontend has matching fallback constants in `artifacts/seeds/src/lib/site-content.ts` validated by `isShapeCompatible`.

## Database schema

Core (MVP1/2):
- `applications` — MVP1 cols + `application_status` (submitted → document_review → interview → final_decision_made / withdrawn) + `final_decision` (pending|accepted|rejected|waitlisted|withdrawn). Legacy `status` enum preserved.
- `users` — email unique, name, password_hash (bcrypt), role primary (`admin|mentor|student`), `extra_roles text[] not null default '{}'` (multi-role), `is_active`, timestamps. Bootstrapped from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on startup. Effective roles = unique union of `[role, ...extraRoles]`; helpers `getEffectiveRoles(user)` and `canViewMemberContacts(user)` from `@workspace/db`. Session payload `{userId, role, roles, exp}`; `verifySessionToken` falls back to `[role]` for older tokens. `/admin/login` and `/admin/me` return `{...user, role, roles}`. Admins toggle extra roles from `/admin/students/:id` via `PATCH /admin/users/:id { extraRoles }`. The legacy `evaluator` role was removed — evaluation work is performed by users with `admin` or `mentor` in their effective roles, assigned per-application via `/admin/evaluators`.
- `evaluation_assignments` — `(application_id, evaluator_id, stage)` unique; status `assigned|in_progress|completed`.
- `evaluations` — `(application_id, evaluator_id, stage)` unique; sub-scores (motivation, problem_awareness, initiative, collaboration, fit) + overall (1-5) + recommendation + comment.
- `interviews` — `(application_id)` unique.
- `decision_logs` — append-only audit trail of `final_decision` changes.

MVP3 (additive):
- `cohorts`, `programs(cohort_id)`, `students(user_id unique, application_id unique, profile cache, is_active)`
- `student_cohorts`, `student_programs` (both `(student_id, X_id)` unique)
- `sessions(cohort_id, program_id?, scheduled_at, duration, type, status)`
- `attendance_records(session_id, student_id)` unique; status `present|late|absent|excused`
- `assignments(cohort_id, program_id?, due_at, status: draft|published|closed, created_by)`
- `assignment_submissions(assignment_id, student_id)` unique; status `not_submitted|submitted|late|reviewed`; content/file_url/external_url; feedback, reviewed_by
- `announcements(target_type: all|cohort|program, target_id, is_published, published_at, created_by)`

MVP4 (additive):
- `activity_records` — student_id, cohort_id, program_id?, source_type `session|assignment|project|feedback|manual`, source_id?, title, description, activity_date, visibility `private|student_visible|admin_only` (default `admin_only`).
- `projects` — cohort_id, program_id?, title, description, problem_statement, solution_summary, status `ideation|in_progress|submitted|presented|completed|archived`, started_at, ended_at.
- `project_members(project_id, student_id)` unique; role, contribution_summary.
- `artifacts` (Drizzle `mvp4ArtifactsTable`, file `lib/db/src/schema/mvp4-artifacts.ts`) — student_id?, project_id?, assignment_submission_id?, title, description, artifact_type `link|document|presentation|video|code|image|report|other`, url, visibility `private|student_visible|cohort_visible|admin_only` (default `student_visible`).
- `feedback` — target_type `student|project|assignment_submission|activity_record|session`, target_id, student_id?, author_id, feedback_type `general|strength|improvement|review|mentor_note|admin_note`, content, visibility `student_visible|admin_only` (default `admin_only`).
- `skill_tags` — name unique.
- `tag_mappings(tag_id, target_type, target_id)` unique; target_type ∈ `{activity_record, project, artifact, feedback, student}`.
- `site_contents(key unique, label, value jsonb, updated_by, timestamps)` — one row per public page.
- `account_activation_tokens` — user_id (FK→users cascade), token_hash (sha256; plaintext only in response at issue time), expires_at (default 14d), used_at?, created_by, created_at. Indexes on `token_hash`, `user_id`. Drives the magic-link activation flow.
- `people_profiles` — kind `mentor|staff|member`, user_id? (FK set null, unique), student_id? (FK set null, unique), name, role_title?, affiliation?, bio?, photo_url?, **phone?** (text, ≤30 chars; only surfaced to logged-in members on the public `/people` endpoint), tags `text[] default '{}'`, display_order int default 0, is_public bool default false. Index `(kind, display_order)`. Max one row per student/user.

Student-side visibility rules in code:
- `student/timeline`: `studentId = me` AND `visibility = student_visible`.
- `student/artifacts`: own (≠ admin_only) ∪ project-member with `student_visible`/`cohort_visible` ∪ same-cohort projects with `cohort_visible`.
- `student/projects/:id` artifacts: own (≠ admin_only) ∪ other members' (`student_visible`/`cohort_visible`). Never expose another member's `private`.
- `student/report.feedbackHighlights`: `visibility = student_visible` AND `studentId = me`.

`users.role` is a text column (not pg enum), enforced by app-level `USER_ROLES = ['admin','mentor','student']`.

## Activation magic-link flow

1. Admin creates inactive user via `POST /admin/applications/:id/convert-to-student` (no password) or `POST /admin/users/:id/activation-token` for existing users.
2. Response: `{activationToken, activationPath: "/activate/<token>", expiresAt}` (token plaintext shown **only at issue time**).
3. Admin UI surfaces this in two places: `/admin/students` "합격자 → 학생 전환" dialog (one-time copyable URL = `window.location.origin + activationPath`) and `/admin/students/:id` "계정 활성화 링크" card with re-issue button.
4. User opens `/activate/:token`, sets password (≥8 chars). `POST /api/activation/:token` atomically consumes the token, sets `password_hash`, flips `is_active=true`. Returns 410 on used/expired.

## Required env / secrets

- `DATABASE_URL` (provisioned), `SESSION_SECRET`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`, `NODE_ENV`.

## Local run / commands

Workflows handle running — do not `pnpm dev` at root.
- `artifacts/api-server: API Server` (Express, port 8080)
- `artifacts/seeds: web` (Vite dev server)
- `artifacts/mockup-sandbox: Component Preview Server` (design sandbox, not runtime)

Use `restart_workflow <name>` to restart.

DB schema changes: `pnpm --filter @workspace/db run push` (or `push-force` to drop columns).

API contract changes: edit `lib/api-spec/openapi.yaml`, then `pnpm --filter @workspace/api-spec run codegen` (regenerates `lib/api-client-react/src/generated/*` + `lib/api-zod/src/generated/*`, runs `tsc --build`).

Deploy: `suggest_deploy`. Proxy auto-routes `/api/*` to API server in production.

## Security

- bcrypt password hashing; admin bootstrapped from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- `requireAdmin`/`requireEvaluator`/`requireStudent`/`requireAuth` gate every protected route. Evaluator endpoints additionally check assignment ownership.
- Session cookie HMAC-signed via `SESSION_SECRET`, `httpOnly`, `sameSite=lax`, `Secure` in prod.
- All public form input server-side validated with generated Zod schemas + trimmed.
- `decision_logs` append-only with changing user. CSV export has formula-injection guard.

## Finance (GrowthHub Ops)

`finance_records` — admin-only, lightweight reimbursement/expense ledger.
- Cols: `record_type` (income|expense|reimbursement), `title`, `description`, `category`, `amount` numeric(14,2), `currency` (default KRW), `occurred_on` date, `status` (draft|requested|under_review|approved|paid|rejected|canceled), `requester_id`/`approver_id` (FK→users set null), `approved_at`/`paid_at`, `receipt_url` (text URL), polymorphic `linked_object_type` ∈ {session,cohort,project,document} + `linked_object_id` (no FK, UI tolerates missing).
- Routes (all `requireAdmin`): `GET|POST /admin/finance-records`, `GET /admin/finance-records/summary` (dashboard hooks: pendingReimbursements/awaitingApproval/approvedUnpaid), `GET|PATCH /admin/finance-records/:id`, `POST /admin/finance-records/:id/cancel` (no hard delete — audit preservation). PATCH auto-stamps `approved_at`+`approver_id` on transition to approved, `paid_at` on transition to paid.
- Admin UI: `/admin/finance` (table + create dialog + inline status select). Students/mentors: 403. Anonymous: 401.

## User preferences

- Korean UI for all student/public-facing copy.
- Brand tone: 학생 개발자 동아리 (study groups, side projects, hackathons, senior dev mentorship). Avoid leadership/calligraphy/literary aesthetics.
- Visual: Pretendard everywhere (incl. headings via `font-serif` aliased to sans), pure white bg, single vivid green accent, modern startup tone.
