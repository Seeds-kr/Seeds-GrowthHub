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

### Public — People pages
- `/mentors`, `/staff`, `/members` — 카드 그리드(이름·직함·소속·소개·태그·사진). 같은 `PeopleGrid` 컴포넌트 재사용. 각 페이지 상단 탭으로 세 페이지를 함께 묶음. **공개(`is_public=true`)된 항목만** 노출, `displayOrder asc, id asc` 정렬. 데이터는 `GET /api/people/:kind` (kind ∈ `mentor|staff|member`).

### Admin — Site content CMS (role=admin)
- `/admin/people` — 멘토/운영진/학생 프로필 통합 CRUD. 탭으로 kind 전환, 표시 순서·공개 토글·태그(쉼표 입력)·사진 URL·소개 필드. 학생 본인이 만든 행은 학생 본인이 `/student/profile`에서 편집 가능하지만 어드민도 항상 모든 행을 편집·삭제 가능.
- `/admin/site-content` — JSON editor for the four public pages (`page.home`, `page.about`, `page.program`, `page.faq`); changes are live immediately. Defaults are bootstrapped from `artifacts/api-server/src/lib/site-content-defaults.ts` on every server start (insert `onConflictDoNothing` + label refresh). Public pages fetch via `GET /api/site-content/:key` with hardcoded fallback constants in `artifacts/seeds/src/lib/site-content.ts` so they render even if the API is unreachable.

### Admin MVP 4 (role=admin)
- `/admin/activity-records` — searchable/filterable manual activity log (student/cohort/program/source/tag); CRUD + tag mappings
- `/admin/projects`, `/admin/projects/:id` — CRUD; per-project members, artifacts, feedback, tag mappings, and status updates from one screen
- `/admin/artifacts` — site-wide artifact CRUD (any type, any visibility, project- or student-scoped)
- `/admin/feedback` — site-wide feedback CRUD (target = student / project / submission / activity / session; visibility = student_visible | admin_only)
- `/admin/tags` — skill-tag CRUD (used to characterise activity records, projects, artifacts, feedback, and students)
- `/admin/students/:id/timeline` — admin view of a student's full activity stream with inline tag attach/detach
- `/admin/students/:id/report` — printable per-student report (cohorts, attendance, submissions, projects, artifacts, feedback highlights, tag summary, timeline)
- `/admin/cohorts/:id/summary` — cohort-level analytics (counts, attendance distribution, submission distribution, tag distribution, students missing activity)

### Student — Profile (role=student)
- `/student/profile` — 본인의 공개 프로필(`people_profiles` member 행) 편집. GET 시 행이 없으면 자동 생성(기본 비공개). 학생 본인이 표시 이름·직함·소속·사진 URL·소개·태그·**공개 여부 토글**을 직접 편집. 공개 ON일 때만 `/members`에 카드 노출.

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
- `POST /admin/applications/:id/convert-to-student` — atomic: creates user(role=student) + students row; rejects if already converted (409) or not accepted (400). Body `{password?}`: when omitted (default) the user is created **inactive** with a random unguessable hash and a one-time **activation token** (magic link) is issued; the response includes `{activationToken, activationPath: "/activate/<token>", expiresAt}` (token shown only at issue time). When `password` is provided (legacy path) the user is created active and no token is issued.
- `POST /admin/users/:id/activation-token` — admin-only re-issue of an activation magic link for any user (e.g. expired or lost). Returns `{activationToken, activationPath, expiresAt}`. Issuing a new token marks any prior unused tokens for that user as used (latest-wins).
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

People profiles:
- `GET  /api/people/:kind` — 공개 라우트. kind ∈ `mentor | staff | member`(그 외 404). `is_public=true`만, `display_order asc, id asc`. 응답은 공개 안전 필드만(id/kind/name/roleTitle/affiliation/bio/photoUrl/tags/displayOrder).
- `GET    /admin/people[?kind=]` · `POST /admin/people` · `PATCH /admin/people/:id` · `DELETE /admin/people/:id` — 어드민 전용. 모든 kind, 모든 필드(`userId`/`studentId` 연결 포함). user_id/student_id 유니크 충돌 시 409.
- `GET   /student/profile` · `PATCH /student/profile` — 학생 본인 전용. GET 시 본인 학생 행에 매칭되는 `people_profiles` row가 없으면 lazy-create(`kind='member', studentId=me, userId=me, isPublic=false`). PATCH는 자기 행만 수정 가능(`kind`/`studentId`/`userId`/`displayOrder`는 학생이 변경 불가, 어드민만).

Account activation (public, no auth):
- `GET  /api/activation/:token` — inspect a token; returns `{status:"ok", email, name, expiresAt}` or 404 (not_found) / 410 (`{status:"expired"|"used"}`)
- `POST /api/activation/:token` — body `{password}` (≥8 chars); atomically consumes the token, sets `users.password_hash` (bcrypt), flips `users.is_active=true`, returns `{ok:true}`. Returns 410 if the token was just used by a concurrent request.

Frontend: public route `/activate/:token` (no layout). Admin UI surfaces the link in two places: (1) `/admin/students` "합격자 → 학생 전환" dialog now has no password field — on success it shows a one-time copyable activation URL built from `window.location.origin + activationPath`; (2) `/admin/students/:id` has a "계정 활성화 링크" card with a "새 활성화 링크 발급" button for re-issuing.

Site content (public + admin):
- `GET /api/site-content` · `GET /api/site-content/:key` — public; key whitelisted to `page.home | page.about | page.program | page.faq`
- `GET /admin/site-content` — admin list (always returns all known keys, blanks included)
- `PUT /admin/site-content/:key` — upsert JSON value; sets `updated_by` from session

Student MVP 4 (role=student via `requireStudent`):
- `GET /student/timeline` — own records (`studentId = me`) with `visibility = student_visible` only; tags joined. `private` and `admin_only` records are not exposed to the student (admins flip visibility to `student_visible` to share)
- `GET /student/projects` — projects I'm a member of (via `project_members`)
- `GET /student/projects/:id` — only if I'm a member; returns project + members + my membership + artifacts (visibility ≠ admin_only) + feedback (visibility=student_visible) + tags
- `GET /student/artifacts` — own non-admin_only ∪ project-member with `student_visible`/`cohort_visible` ∪ same-cohort projects with `cohort_visible`
- `GET /student/report` — same shape as admin report but scoped to me; admin_only feedback excluded

## Database schema

- `applications` — MVP1 columns (incl. legacy `status` enum) + MVP2 `application_status` (lifecycle: submitted → document_review → interview → final_decision_made / withdrawn) and `final_decision` (pending | accepted | rejected | waitlisted | withdrawn).
- `users` — id, email (unique), name, password_hash (bcrypt), role (admin | evaluator | student) primary, **`extra_roles text[]` not null default `'{}'`** for multi-role accounts, is_active, timestamps. Admin user is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on server startup (`bootstrapAdminFromEnv`). Effective roles = unique union of `[role, ...extraRoles]`; helper `getEffectiveRoles(user)` exported from `@workspace/db`. Backend middleware `requireAdmin/requireEvaluator/requireStudent` admit if effective roles intersect the allowed set, so a single account can hold e.g. `student + admin`. Session cookie payload now carries `{userId, role, roles, exp}`; `verifySessionToken` falls back to `[role]` when older tokens lack `roles`. `/admin/login` and `/admin/me` return `{...user, role, roles}`. Admins manage extra roles from `/admin/students/:id` (운영진/평가위원 토글) via `PATCH /admin/users/:id { extraRoles }`. Each role-specific layout (Admin/Student/Evaluator) admits if the user's effective roles include the layout's role and shows a header role-switcher button-row to navigate to the user's other role homes (`/admin`, `/student`, `/evaluator`); the session itself is unchanged when switching since access is purely role-membership-based.
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
- `site_contents` — `(key unique, label, value jsonb, updated_by, timestamps)`. One row per public page; admin edits the JSON blob directly.
- `tag_mappings` — (tag_id, target_type, target_id) unique; target_type ∈ {activity_record, project, artifact, feedback, student}.
- `account_activation_tokens` — id, user_id (FK→users, cascade delete), token_hash (sha256 of plaintext token; plaintext stored only in the response at issue time), expires_at (default 14d), used_at?, created_by (FK→users), created_at. Indexes on `token_hash` and `user_id`. Used by the public magic-link account activation flow (`/activate/:token` ↔ `/api/activation/:token`).
- `people_profiles` — id, kind (`mentor|staff|member`), user_id? (FK→users set null, unique), student_id? (FK→students set null, unique), name, role_title?, affiliation?, bio?, photo_url?, tags `text[]` not null default `'{}'`, display_order int not null default 0, is_public bool not null default false, timestamps. Index `(kind, display_order)`. 한 명의 학생/유저당 최대 한 개의 프로필 행. 공개 라우트(`/api/people/:kind`)는 `is_public=true`만, 정렬 `display_order asc, id asc`.

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
