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
- `users` — email unique, name, password_hash (bcrypt), role primary (`admin|mentor|student`), `extra_roles text[] not null default '{}'` (multi-role), `is_active`, timestamps. Bootstrapped from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on startup. Effective roles = unique union of `[role, ...extraRoles]`; helpers `getEffectiveRoles(user)` and `canViewMemberContacts(user)` from `@workspace/db`. Session payload `{userId, role, roles, exp}`; `verifySessionToken` falls back to `[role]` for older tokens. `/admin/login` and `/admin/me` return `{...user, role, roles, opsRoles}`. Admins toggle extra roles from `/admin/students/:id` via `PATCH /admin/users/:id { extraRoles }`. The legacy `evaluator` role was removed — evaluation work is performed by users with `admin` or `mentor` in their effective roles, assigned per-application via `/admin/evaluators`.
  - **`ops_roles text[] not null default '{}'`** (ADR-002) — functional ops roles, ORTHOGONAL to `role`/`extra_roles`. Values: `program_lead|ops|recruiting|finance|growth|community|system`. `getOpsRoles(user)` returns `[]` unless effective roles include `admin`, so a mentor/student cannot gain capability from this column. `hasOpsRole(user, code)` is satisfied by `program_lead` (superuser). Edited at `/admin/users` via `PATCH /admin/users/:id { opsRoles }` (needs `system`); the last active `program_lead` cannot be removed or deactivated (409). **Not carried in the session cookie** — every gate re-reads the DB, so revocation is immediate. `backfillOpsRolesOnce()` runs at startup BEFORE `bootstrapAdminFromEnv()` and grants `program_lead` to all existing admins; it self-disables once any user holds any ops role.
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
- **Optional (notifications, W10)** — all absent-safe; a missing value disables the feature without erroring:
  - `SEEDS_DISCORD_OPS_WEBHOOK_URL`, `SEEDS_DISCORD_MENTOR_WEBHOOK_URL` — public channel webhooks.
  - `APP_BASE_URL` — used to build deep links in notifications. Without it, messages ship without a link.
  - `CRON_SECRET` — shared secret for `POST /internal/cron/*`. Unset ⇒ those routes return 503.

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
- `requireOpsRole(code)` (ADR-002) gates the restricted-read areas on top of admin. Current mapping:
  - `recruiting` — `admin.ts` (all `/admin/applications*`), `admin-assignments.ts`, `admin-interview.ts`, `admin-decision.ts`, and in `admin-students.ts` only `POST /admin/applications/:id/convert-to-student` + `GET /admin/applications-accepted-pending`.
  - `finance` — all of `admin-finance.ts`.
  - `system` — `POST /admin/users`, `PATCH /admin/users/:id`. `GET /admin/users` stays `requireAdmin` (the evaluator picker needs it).
  - Everything else stays `requireAdmin` (read-wide) — dashboards expose counts only, no applicant PII.
  - ⚠️ **`/evaluator/*` must NOT be gated on `recruiting`** — it is a separate axis (`requireAdminOrMentor` + per-application assignment ownership). Gating it would lock out assigned mentors.
- Admin sidebar hides restricted-read menus via `visibleNavSections(opsRoles)`; this is cosmetic only, the server gate is the boundary.
- Session cookie HMAC-signed via `SESSION_SECRET`, `httpOnly`, `sameSite=lax`, `Secure` in prod.
- All public form input server-side validated with generated Zod schemas + trimmed.
- `decision_logs` append-only with changing user. CSV export has formula-injection guard.

## Mentor Workspace & team signals (W2–W4)

- `project_mentors` — N:N mentor↔project (ADR-003). References `users` (not `students`); `(project_id, mentor_user_id)` UNIQUE. Unassigning sets `status='ended'` + `endedAt` rather than deleting, so feedback written during the assignment keeps its context. Re-assigning a former mentor REACTIVATES the row. Access is cut the moment status flips to `ended`.
- `project_status_checks` — **append-only**, no PATCH/DELETE route. `team_status` ∈ good|watch|risk|blocked, plus `blocker`, `next_focus`, `needs_ops_support`/`ops_support_note`, and an `ops_resolved_at`/`ops_resolved_by` stamp (the only permitted mutation, via `POST /admin/status-checks/:id/resolve`, guarded on `IS NULL`). Visibility enum is `admin_only|mentor_visible` — **there is deliberately no student value and no student route**.
- `project_milestones` — no visibility column; inherits the project's. `dropped` means plan change, not failure (UI must stay neutral).
- `projects` gained `github_url`, `demo_url`, `deck_url`, `target_users` (non-destructive). Blocker/next-action are NOT columns — they are read from the latest status check, since they are point-in-time.
- Mentor routes (`artifacts/api-server/src/routes/mentor-teams.ts`): `GET /mentor/teams`, `GET /mentor/projects/:id`, `POST /mentor/projects/:id/{status-checks,feedback}`, `GET /mentor/feedback`, `GET /mentor/dashboard`.
  - `requireMentor` is necessary but NOT sufficient — every handler re-checks an ACTIVE assignment via `lib/mentor-scope.ts` (`getMentorProjectIds` / `mentorOwnsProject`), mirroring the evaluator surface's per-application ownership check. Unowned ids return **404, not 403**, to avoid leaking which projects exist.
  - **ADR-004**: feedback on an owned project is returned in full — any author, any type, any visibility, including `admin_note`. Access is gated by ASSIGNMENT, not visibility; `feedback`'s enum was NOT extended. Consequence: keep sensitive ops-internal notes about students in `meetings`/`documents` (both `admin_only`), not in `feedback`.
  - Artifacts exclude `visibility='private'` — a student's unfinished personal draft stays private even from their mentor.
- Ops dashboard gained `teamSupport` (open `needs_ops_support` requests) and `staleStatusChecks` (active projects with no check in 14d). The former is the mentor→ops signal that makes the 30-second status check worth filling in.

## Studies & reflections (W6)

- `studies` / `study_members` — a clone of the `projects` shape. **No visibility column**: a study is open within its cohort (adding a 4th visibility enum would violate visibility-policy §1 원칙 2). Weekly plan is one `weekly_plan_md` field, not a table — Growth v3 §8.3 deferred progress tracking. Outputs attach via the new `artifacts.study_id` and keep artifacts' own 4-level visibility.
- `reflections` — **ADR-001 is enforced structurally, not by convention.**
  - The enum is `private | team_visible | mentor_visible | cohort_visible`. **`admin_only` is absent and must never be added** — with no ops-facing value there is nothing an ops-wide screen could select on.
  - There is **no `admin-reflections.ts`** and the `/admin/reflections` nav placeholder was removed. The only file referencing `reflectionsTable` is `routes/student-growth.ts`.
  - All four handlers resolve the student from the session (`getStudentForUser(req.sessionUser!.id)`) and scope on `studentId = me` **in the WHERE clause** (INSERT sets it from the session in VALUES). The Zod body does not accept `studentId`, so a student cannot author or read as someone else.
  - Narrowing visibility is always allowed — a student may take a reflection back. Hard delete is allowed too: a reflection is the student's, not an audit record, and reflections are on the audit denylist.
  - **Ops has NO reflections read path at all** — not even for `cohort_visible`. The two reader endpoints are `/student/reflections/shared` (teammates see `team_visible`↑, same-cohort sees `cohort_visible`) and `/mentor/reflections` (assigned mentor sees `mentor_visible`↑). Without those the visibility picker would name audiences that cannot exist. Team-risk detection is `project_status_checks`' job.
  - `project_status_checks.visibility` is now actually enforced: mentors only receive `mentor_visible` rows, and ops can create `admin_only` ones via `POST /admin/projects/:id/status-checks`. Previously the column was written-never, read-never.
  - `GET /student/projects/:id` feedback is scoped to `studentId IS NULL OR studentId = me` — without it, feedback naming one teammate was returned to the whole project.
  - `/student/assignments/:id` returns 404 (not 403) for out-of-scope or draft assignments, matching the mentor-scope rule: a differing status code lets a student enumerate which assignments exist.
- Student screens: `/student/studies`, `/student/reflections`, `/student/feedback`. Reflections are NOT auto-included in `student/report` or `/student/timeline` — that would make the report read like an assessment.

## Audit & attachments (W5)

- `audit_logs` — **append-only**, no write/update/delete API; rows come only from `lib/audit.ts` at mutation sites. Read is gated on the `system` ops role. `decision_logs` stays separate (recruitment-domain) and is NOT absorbed.
- `diffFields()` reduces before/after to **only the keys that actually changed** and drops a denylist of free-text fields (`content`, `contentMd`, `bodyMd`, `decisionsMd`, `comment`, `blocker`, `nextFocus`, `opsSupportNote`, `description`, `passwordHash`, `receiptUrl`). Enforced in the helper, not trusted to call sites — the audit trail must not itself become a leak. Reflections are never audited (ADR-001).
- Write sites: `role_change` (PATCH /admin/users/:id), `finance_status` (status transitions only), `data_export` (applications CSV — row count only), `account_activation` (token re-issue — never the token), `permission_denied` (every `requireOpsRole` 403; repeated hits usually mean a mis-assigned role).
- IP is stored as a truncated HMAC keyed on `SESSION_SECRET`, never raw.
- `attachments` — stores **`objectPath`, not a URL**. Objects get ACL `visibility=private` at registration, so they are unreachable via the unauthenticated `GET /api/storage/objects/*` path that serves avatars. The only read path is `GET /api/attachments/:id/download` (`requireAdmin`, streams after the check, never redirects). Receipts (`linkedObjectType='finance_record'`) additionally require the `finance` ops role and are force-set to `admin_only` regardless of what the client sends.
- Link targets are validated on write (422 if the target row is missing); `linkedObjectType` is constrained by the shared `LINKABLE_TYPES` whitelist in `lib/db/src/schema/_linkable.ts`.
- Markdown image paste/drop uploads through this pipeline, inserting `![name](/api/attachments/:id/download)` — an authenticated URL, not a storage path.

## Editing & meeting templates (W9)

- `MarkdownEditor` (`artifacts/seeds/src/components/markdown/`) — a thin toolbar over the existing `Textarea`; markdown stays the stored format (ADR-005). No editor library was added: `@uiw/react-md-editor` et al. bring their own theme and would fight shadcn/ui + Pretendard. Selection maths lives in `markdown-insert.ts` (pure, unit-verified). Checklist (`- [ ]`) is a first-class button because event/recruitment checklists depend on it.
- `meetings.body_md` (new) holds the template-seeded free-form body. `decisions_md` stays a SEPARATE column across every template — dashboards, handover and audit all extract decisions alone (ADR-006). Legacy `agenda_md`/`notes_md`/`pending_md` are retained but no longer written; `backfillMeetingBodies()` folded their content into `body_md` on rows where it was still empty, and the detail page shows them read-only under "이전 형식 기록". Drop them after a cohort.
- Meeting-note templates are `documents` rows (`is_template=true`, `linked_object_type='meeting_type'`), NOT hardcoded — ops edit them at `/admin/documents` and the next meeting picks up the change with no deploy. `bootstrapMeetingTemplates()` seeds only what is missing.
- Meeting notes previously had **no edit path at all** (create-only). W9 added per-section inline editing via `PATCH /admin/meetings/:id`.

## Notifications (W10)

- Discord webhook + in-app badges. **No email, no new table** — every dispatch is logged to `communication_logs` with `channel='discord'` (ADR-007).
- `lib/notify.ts` — `notifySafely()` is fire-and-forget; a webhook failure can never surface to the caller or block the mutation. One retry, 5s timeout, then logged as `failed`.
- **Payload rules (enforced, not stylistic):** public channels only (never a DM), and NEVER student names / evaluation content / reflections / raw blocker text. The message is "what happened + link"; the content is read inside GrowthHub behind permission checks. No student-addressed notifications exist.
- Immediate: team-support requests (`needsOpsSupport`) fire from the mentor status-check route. Scheduled: `POST /internal/cron/daily-digest` and `/weekly-mentor-nudge`, authed by `x-cron-secret` (a machine caller, not a session), guarded against double-fire by a per-template per-day check, and silent when there is nothing to report.
- In-app badges reuse `GET /admin/ops-dashboard/summary` — they show what is currently OPEN, not unread. There is deliberately no read state and no `notifications` table.

## Finance (GrowthHub Ops)

`finance_records` — admin-only, lightweight reimbursement/expense ledger.
- Cols: `record_type` (income|expense|reimbursement), `title`, `description`, `category`, `amount` numeric(14,2), `currency` (default KRW), `occurred_on` date, `status` (draft|requested|under_review|approved|paid|rejected|canceled), `requester_id`/`approver_id` (FK→users set null), `approved_at`/`paid_at`, `receipt_url` (text URL), polymorphic `linked_object_type` ∈ {session,cohort,project,document} + `linked_object_id` (no FK, UI tolerates missing).
- Routes (all `requireAdmin`): `GET|POST /admin/finance-records`, `GET /admin/finance-records/summary` (dashboard hooks: pendingReimbursements/awaitingApproval/approvedUnpaid), `GET|PATCH /admin/finance-records/:id`, `POST /admin/finance-records/:id/cancel` (no hard delete — audit preservation). PATCH auto-stamps `approved_at`+`approver_id` on transition to approved, `paid_at` on transition to paid.
- Admin UI: `/admin/finance` (table + create dialog + inline status select). Students/mentors: 403. Anonymous: 401.

## Ops Dashboard

Admin-only operational overview at `/admin/ops-dashboard`. Read-only aggregator — no writes.
- Endpoint: `GET /admin/ops-dashboard/summary` (`requireAdmin`). Single payload with independent sections; an empty data source returns `[]` rather than erroring the whole response.
- Sections: overdue tasks (`ops_tasks.dueDate < today` AND status ∉ {done,canceled}), blocked tasks (status=blocked), upcoming sessions (next 14d, `isPublished=true`), checklist breakdown (`prepStatus` group over future sessions), evaluation progress (assignments grouped by status, restricted to apps in submitted/document_review/interview), pending finance (`status ∈ {requested, under_review, approved}` — exposes hooks + top-10 items), recently updated docs (non-archived, top 10), stale docs (non-archived, `updatedAt < now-90d`, top 10).
- Frontend: `/admin/ops-dashboard` with section cards that deep-link to `/admin/tasks`, `/admin/sessions`, `/admin/applications`, `/admin/finance`, `/admin/documents`.
- Students/mentors: 403. Anonymous: 401.

## User preferences

- Korean UI for all student/public-facing copy.
- Brand tone: 학생 개발자 동아리 (study groups, side projects, hackathons, senior dev mentorship). Avoid leadership/calligraphy/literary aesthetics.
- Visual: Pretendard everywhere (incl. headings via `font-serif` aliased to sans), pure white bg, single vivid green accent, modern startup tone.
