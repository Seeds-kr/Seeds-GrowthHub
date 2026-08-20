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
- **DB**: PostgreSQL 16 (도커 `seeds_growthhub_pg`, `127.0.0.1:5434`) via Drizzle ORM (`lib/db`)
- **API contract**: OpenAPI 3.1 → orval React Query hooks + Zod (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)
- **Auth**: HMAC-signed session cookie (`seeds_admin`, no DB session table)

`ops/../seeds-preview/router.mjs`(`127.0.0.1:8088`)가 `/api/*` 는 API 서버(`:8087`)로,
나머지는 `artifacts/seeds/dist/public` 의 정적 파일로 보낸다. 공개 주소
`seeds.harvester.kr` 는 Cloudflare 터널로만 나간다 — 서비스 포트는 전부 루프백이다.

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
- Applications: `GET /admin/applications` (filters `q,applicationStatus,finalDecision,interviewStatus,evaluationCompletion`), `/stats`, `/export` (CSV w/ formula-injection guard), `GET|PATCH /admin/applications/:id`, `POST|DELETE /admin/applications/:id/assignments[/:assignmentId]`, `PUT /admin/applications/:id/interview` (one per app), `PATCH /admin/applications/:id/final-decision` (writes `decision_logs`).
- Users: `GET /admin/users?role=`, `POST /admin/users`, `PATCH /admin/users/:id` (incl. `extraRoles`).
- MVP3: full CRUD `/admin/{cohorts,programs,students,sessions,assignments,announcements}`; `/admin/students/:id/cohorts[/:cohortId]` and `/programs[/:programId]`; `/admin/sessions/:id/attendance` (bulk PUT); `PATCH /admin/submissions/:id`; `GET /admin/applications-accepted-pending`; `POST /admin/applications/:id/convert-to-student` (`{password?}` — omitted = create inactive user + issue activation token, response `{activationToken, activationPath, expiresAt}`); `POST /admin/users/:id/activation-token` (re-issue; marks prior unused tokens used, latest-wins).
- MVP4: full CRUD `/admin/{activity-records,projects,artifacts,feedback,tags,tag-mappings}`. `GET /admin/projects/:id` returns project + members + artifacts + feedback + tags. `POST|DELETE /admin/projects/:id/members[/:memberId]` (unique `(project,student)`). `GET /admin/students/:id/{timeline,report}`. `GET /admin/cohorts/:id/summary`.
- People: `GET /admin/people[?kind=]`, `POST`, `PATCH`, `DELETE`. `user_id`/`student_id` unique → 409. 프로필 사진은 **본인 업로드**다(ADR-017) — `POST|DELETE /{student,mentor}/profile/photo`(본인), `POST|DELETE /admin/people/:id/photo`(어드민). 서버 디스크의 공개 영역에 저장하고 `photoUrl` 은 `/api/uploads/public/<yyyy>/<mm>/<uuid>.<ext>`. 교체하면 옛 파일을 지운다.
- Uploads: 무인증 `GET /api/uploads/public/*` 는 **프로필 사진만** 내준다 — 공개 `/people` 이 비로그인 라우트라 브라우저가 그냥 받아야 한다. 회의록 본문 이미지는 같은 디스크의 **비공개 영역**에 있고 `GET /api/attachments/:id/download` 로만 나가며, 그 라우트가 행과 호출자를 다시 확인한다.
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
- `applications` — MVP1 cols + `application_status` (submitted → document_review → interview_scheduled → interview_completed → final_decision_made / withdrawn) + `final_decision` (pending|accepted|rejected|waitlisted|withdrawn). 옛 `status` 컬럼은 **제거됐다**(마이그레이션 `0004`) — 두 벌을 따로 갱신하다 어긋나던 자리였다.
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
- `attachments` — stores **`objectPath`, not a URL**. 파일은 업로드 루트의 **비공개 영역**에 있다 — 무인증으로 열리는 곳은 프로필 사진 전용 `uploads/public/` 뿐이라 주소를 알아도 그냥 열리지 않는다. The only read path is `GET /api/attachments/:id/download` (`requireAdmin`, streams after the check, never redirects). Receipts (`linkedObjectType='finance_record'`) additionally require the `finance` ops role and are force-set to `admin_only` regardless of what the client sends.
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

## Responsive tiers (W11)

- Every route carries an A/B/C tier. `artifacts/seeds/src/lib/responsive-tiers.ts` is the register — all 85 `<Route>` paths in `App.tsx` (incl. the 8 W8 placeholders and the pathless 404) have a row, verified both directions with no gaps. **A new screen adds a row here**; that is what ADR-008 / design/05 §6.1 means by "등급을 명시한다".
- `A` mobile-read guaranteed (public site, all `/student/*`, mentor read screens, and every login/activation entry point). `B` mobile-viewable (admin lists + detail reads, ops-dashboard, `/evaluator/*`). `C` desktop-only.
- `useIsDesktop()` (`hooks/use-desktop.tsx`) gates at **1024px** = Tailwind `lg`. Deliberately NOT `useIsMobile()` (768px) — that one drives the sidebar drawer and §6.4 keeps the drawer where it is, so sharing a hook would drag the drawer breakpoint with it. State is seeded synchronously from `window.innerWidth` (client-only SPA, no SSR) so desktop does not flash the blocked-notice on first paint.
- `<DesktopOnly feature="...">` **does not render its children** below `lg` — it is not a CSS hide. `display:none` would leave the blocked tree focusable and still able to produce the horizontal overflow §6.4 forbids; a 6-column kanban is exactly that tree. The label is interpolated with an em dash, not a topic particle: 는/은 depends on a 받침 ("작업 보드는" vs "일괄 출석 입력은") so a fixed particle would be ungrammatical for half the call sites.
- C surfaces: `/admin/tasks` (kanban), `/admin/sessions/:id/attendance` (bulk entry), `/admin/documents/:id` (split editor), `/admin/meetings/:id` (edit mode), and the status-check form on `/mentor/projects/:id`.
- **Two screens are mixed** (`MIXED_TIER_SCREENS`): `/mentor/projects/:id` is A to read but C to submit a status check, and `/admin/meetings/:id` keeps its rendered note readable while only edit mode is C. The guard wraps the *section*, not the route. Their entry buttons (문서 `편집`, 회의록 `편집`) are **hidden** below `lg` rather than disabled — a button that only ever yields a notice promises an audience that isn't there.
- Task board drag-and-drop is **native HTML5 DnD, no new dependency**: the board is C, so pointer dragging is the entire requirement (design/05 §7) and a DnD library for one desktop-only screen isn't worth the weight. `dragstart` bails out inside `[data-no-drag]` so the status `Select` still opens, a drop onto the origin column is a no-op rather than a PATCH, and **the `Select` stays** as the only keyboard-reachable way to move a task (native drag has no keyboard affordance).
- ADR-008's accepted cost is "멘토가 폰에서 상태체크 불가", offset by ADR-007's Discord notifications. design/05 §9 leaves mentor input rate open — if it comes in low for the first cohort, ADR-008 is what gets revisited, not this guard alone.
- **Unverified: no browser was available in the implementing session.** 375px measurement, drag behaviour and the banner rendering are all static/build-level only.

## External links & attachments (W7 / W5)

- `external_links` — reference material hung off an arbitrary object (design/04 §4). NOT `artifacts`: those are student-produced growth evidence, these keep operational context (a Discord channel, a Drive folder, a spec). A project's three headline URLs (github/demo/deck) are **columns on `projects`**, not rows here.
- **Reads are an INTERSECTION, never the `visibility` column alone** (visibility-policy §5.1): `readable ⟺ viewer can reach the linked object AND link.visibility allows them`. Checking only `visibility` leaks — flipping a link on an `admin_only` meeting to `cohort_visible` would publish that meeting's existence and material URL to a whole cohort via the link title. Every decision goes through `src/lib/external-link-scope.ts` so no single route can forget it.
- Parent types that grant a student/mentor audience (`project`, `study`, `session`, `cohort`, `program`) have **no `visibility` column at all** — only `meetings`/`documents` do, and students have no access to those. So "inherit the parent's visibility" resolves to **the parent's own access rule** (membership/scope), which is what the resolver implements.
- **Visibility values that the parent has no audience for are rejected at write time with 422** (`meeting`+`cohort_visible`, `cohort`+`team_visible`). Storing them would leave a value that reads filter out anyway — a dead value by another route.
- `linked_object_type` is narrower than `LINKABLE_TYPES`: `meeting_type` keys off a type string and `channel` has no table, so neither can satisfy the design/04 §2 rule-2 existence check. Both are 422.
- Parent ops gate re-checked on read, same shape as the receipt gate: `finance_record` needs `finance`, `application` needs `recruiting`. A `community`-only admin gets **404** (not 403) on those — a denied filter must not confirm the type is gated.
- `private` is **owner-only and that beats being an admin.** Another admin does not see it, cannot download it, cannot delete it (404 each). This is what keeps `private` distinguishable from `admin_only` instead of a dead synonym.
- **`attachments.visibility` lost `team_visible` in W7.** It was a dead value: every attachment route is `requireAdmin`, `attachmentsTable` is referenced in no other file, and no student/mentor surface read it — yet visibility-policy §5 promised `team_visible`=팀 and 멘토=담당 팀. Removed rather than given a reader, because attachments only ever come from MarkdownEditor paste (meeting/document context) and finance receipts, both ops-only; a student download route would have built a reader for an audience the product does not have. Restore it together with that route when students actually own attachments.
- Writes are ops-only for both tables. No student write path exists or is planned.
- **No frontend yet for `external_links`** — API only. Ships with W8 when the placeholder screens are settled.

## Placeholder cleanup (W8)

Eight informational placeholder screens existed so the IA v2 tree was fully navigable. All are gone: four became real, four were removed. **Empty screens: 0.** The machinery is gone too (`ADMIN_PLACEHOLDER_ITEMS`, `findPlaceholderItem`, `_placeholder.tsx`, `NavItem.placeholder`) — a nav entry now requires a working screen, because an entry without one promises a feature that does not exist.

Built:
- `/admin/media` — `external_links` management; this is where W7's missing UI landed. Attachments deliberately get no flat index: every attachment route is admin-scoped and reached from the object it hangs off, and `private` ones are owner-only, so a browse-all surface would imply access the permission model does not grant. The visibility dropdown offers only what the parent can serve (same table the server enforces), so it cannot offer an audience that would 422.
- `/admin/interviews` — new `GET /admin/interviews` (`recruiting`-gated, joins applicant name). Read-only: writes stay on `PUT /admin/applications/:id/interview` so one row has one write path. The row and its upsert already existed; only a way to see the schedule as a whole was missing.
- `/admin/attendance` — new `GET /admin/attendance?cohortId=` rollup. Rate = (present + late) / (sessions − excused): `excused` leaves the denominator rather than scoring as an absence. The denominator counts **sessions**, not attendance rows, so a session nobody marked still counts — otherwise a forgotten roll call silently inflates everyone's rate. Sorted lowest-first because the screen exists to surface who is slipping. `requireAdmin`, not an ops role — attendance is general operations and gating it on `recruiting` would hide it from the people running sessions.
- `/admin/reports` — thin index into the existing `/admin/students/:id/report` and `/admin/cohorts/:id/summary`. No new endpoint; building one would duplicate two working aggregations.

Removed (rationale lives at each site in `lib/admin-nav.ts`):
- `/admin/integrations` — design/04 §8 makes automatic sync (`sync_logs`, `integration_accounts`) an **explicit non-goal**, and the baseline is "links first, API integration only once the need is proven". An integration *status* screen needs the sync layer that was deliberately not built. Same shape as `/admin/reflections` vs ADR-001. Link-based integration is real and lives in `/admin/media`.
- `/admin/settings` — the promised items are env vars (`SESSION_SECRET`, `ADMIN_EMAIL`); exposing them in a UI is a regression. And making "default visibility policy" runtime-editable would dissolve the structural guarantee ADR-001 rests on.
- `/admin/members` — `/admin/people` is already the person-level directory across kinds. IA v2 §7.2 flagged an unresolved **placement** for `/admin/students`, not a missing fourth people list.
- `/admin/public-pages` — publish state and SEO meta have no schema; `site_contents` is a key→body map. Restore alongside that schema extension, not before.

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
