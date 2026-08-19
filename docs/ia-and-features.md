# Seeds — IA · 기능 명세 · 데이터 모델

> 학생 개발자 동아리 Seeds 운영 플랫폼. 현재 구현 기준 (MVP1~4 통합).
> 본 문서는 (1) 사용자 역할(role)별 접근 화면(IA)과 기능, (2) 데이터 모델 전체를 정리한 사양서입니다.

---

## 0. 역할 정의

`users.role` (primary) + `users.extra_roles[]` (추가 다중 역할).
**Effective roles** = `[role, ...extra_roles]`의 유일집합.

| 역할 | 코드값 | 설명 |
|---|---|---|
| 관리자 | `admin` | 전체 운영 권한. 모든 관리자 화면 접근. |
| 멘토 | `mentor` | 본인 프로필 편집 + 평가 surface 참여. 학생/회원 디렉터리 연락처 열람 가능. |
| 학생 | `student` | 본인 활동·과제·프로젝트 조회 및 제출. |
| 비로그인 | — | 공개 페이지만 접근. |

### 평가 surface (역할 아님)
- `/evaluator/*`는 별도의 역할이 아니라 **접근 제어된 서브 태스크**.
- `effective roles`에 `admin` 또는 `mentor`가 포함된 사용자만 진입 가능.
- 추가로 라우트 핸들러가 `evaluation_assignments` 소유 여부를 application 단위로 재확인.
- (구) `evaluator` 역할은 폐기됨 — 외부 평가자 없이 동아리 내부 admin/mentor가 평가를 담당.

### 역할 스위처
- 각 역할 레이아웃 헤더에 버튼 행으로 표시: `/admin · /mentor · /student`.
- 스위칭은 세션 재발급 없이 단순 라우팅 (effective roles 기반 접근 제어).

### 연락처 열람 규칙 (`canViewMemberContacts`)
- 비로그인: 공개 프로필의 `phone`은 항상 `null`로 마스킹.
- 로그인 회원(admin/mentor/student 중 하나): `phone` 노출.

---

## 1. 공개 영역 (비로그인 접근 가능)

### 1.1 화면 (IA)

| 경로 | 화면 | 비고 |
|---|---|---|
| `/` | 홈 | 동아리 소개, CTA |
| `/about` | 소개 | 미션, 가치, 활동 영역 |
| `/program` | 프로그램 | 스터디·사이드프로젝트·해커톤·멘토링 |
| `/faq` | FAQ | |
| `/recruit` | 모집 안내 | 일정/자격/절차 |
| `/apply` | 지원서 작성 | |
| `/apply/success` | 지원 완료 | |
| `/people` | 사람들 (탭) | 멘토·운영진·학생 통합 디렉터리 |
| `/mentors` · `/staff` · `/members` | 동일 `/people` (탭 자동 선택) | 레거시 호환, 탭 전환 시 URL `replace` |
| `/people/:kind/:id` | 사람 상세 | 카드 클릭 → 상세 페이지 |
| `/activate/:token` | 계정 활성화 | 매직링크 진입점 (레이아웃 없음) |
| `/admin/login` · `/login` · `/student/login` | 통합 로그인 폼 | 역할 따라 리다이렉트 |

### 1.2 공개 기능

- **지원서 제출**: `POST /api/applications` (Zod 검증, 트림).
- **사람 디렉터리**: 멘토/운영진/학생 중 `is_public=true`만 노출. `display_order` 정렬.
  - 비로그인 시 `phone` 필드는 `null`로 강제 마스킹 (서버 레벨).
- **사이트 콘텐츠**: `GET /api/site-content[/:key]` — `page.home | page.recruit | page.about | page.program | page.faq` 5개 키. 관리자가 편집한 JSON을 공개 페이지가 폴백 상수와 함께 표시.
- **계정 활성화**: `GET|POST /api/activation/:token` — 토큰으로 비밀번호 설정 → 계정 활성화. 사용/만료 시 410.

---

## 2. Admin (`role=admin`)

### 2.1 화면 IA

| 경로 | 화면 |
|---|---|
| `/admin` | 대시보드 (지원자/멘토/학생/프로그램 카운트) |
| `/admin/applications` | 지원자 목록 (필터: q/status/applicationStatus/finalDecision/interviewStatus/evaluationCompletion) |
| `/admin/applications/:id` | 지원자 상세 — 상태 변경, 평가 배정, 면접, 최종 결정 |
| `/admin/evaluators` | 평가 담당자 — admin/mentor 풀, 신규 멘토 생성 |
| `/admin/students` | 학생 목록 |
| `/admin/students/:id` | 학생 상세 — 본인 정보, 코호트/프로그램 멤버십, 역할 토글(mentor extra-role 등) |
| `/admin/students/:id/timeline` | 학생 타임라인 (MVP4) |
| `/admin/students/:id/report` | 학생 활동 리포트 (MVP4) |
| `/admin/cohorts` | 기수 관리 |
| `/admin/cohorts/:id/summary` | 기수 요약 (출석/제출 통계) |
| `/admin/programs` | 프로그램 관리 |
| `/admin/sessions` | 세션 목록 |
| `/admin/sessions/:id/attendance` | 세션 출석 일괄 입력 |
| `/admin/assignments` | 과제 목록 |
| `/admin/assignments/:id` | 과제 상세 — 제출 검토 |
| `/admin/announcements` | 공지사항 |
| `/admin/people` | 사람들 (멘토/운영진/회원 프로필 CRUD + 프로필 사진 업로드) |
| `/admin/site-content` | 공개 사이트 콘텐츠 편집 |
| `/admin/activity-records` | 활동 기록 (MVP4) |
| `/admin/projects` · `/admin/projects/:id` | 프로젝트 관리 (멤버/산출물/피드백/태그) |
| `/admin/artifacts` | 산출물 |
| `/admin/feedback` | 피드백 |
| `/admin/tags` | 스킬 태그 |

### 2.2 기능 명세

#### 지원자 운영 (MVP1/2)
- 지원서 목록·필터·통계·CSV 내보내기 (formula injection 가드).
- 상태 전이: `submitted → document_review → interview → final_decision_made / withdrawn`.
- **평가 배정**: 지원서별로 admin/mentor를 stage(`document_review|interview|final`) 단위로 배정. `(application, evaluator, stage)` 유일.
- **면접 일정**: 지원서당 1건 (`PUT /admin/applications/:id/interview`).
- **최종 결정**: `pending|accepted|rejected|waitlisted|withdrawn`. 변경 시 `decision_logs`에 append-only 감사 로그.
- **학생 전환**: 합격자 → 학생 변환. 비밀번호 미지정 시 → 비활성 계정 생성 + 활성화 매직링크 발급.

#### 사용자 운영
- `GET /admin/users?role=` 조회, 생성, `extraRoles` 토글.
- 활성화 링크 재발급 (`POST /admin/users/:id/activation-token`, latest-wins).

#### 활동 운영 (MVP3)
- **기수(cohorts)**·**프로그램(programs)**·**세션(sessions)** CRUD.
- **세션 출석**: 일괄 PUT (`present|late|absent|excused`).
- **과제(assignments)**: 코호트/프로그램 단위, `draft|published|closed`. 제출 검토(`reviewed`/피드백 작성).
- **공지(announcements)**: `target_type ∈ all|cohort|program`, 게시 토글.
- 학생을 코호트/프로그램에 등록/탈퇴.

#### 활동 기록 & 활용 (MVP4)
- **활동기록(activity_records)** CRUD: 세션/과제/프로젝트/피드백/수동.
- **프로젝트(projects)**: 멤버 추가/제거, 산출물, 피드백, 태그를 한 화면에서 관리.
- **산출물(artifacts)**: `link|document|presentation|video|code|image|report|other`. 가시성: `private|student_visible|cohort_visible|admin_only`.
- **피드백(feedback)**: `general|strength|improvement|review|mentor_note|admin_note`. 가시성: `student_visible|admin_only`.
- **스킬 태그**: 활동기록·프로젝트·산출물·피드백·학생에 매핑.
- **학생 리포트**: 타임라인, 누적 활동, 피드백 하이라이트.
- **기수 요약**: 학생 수, 출석 개요, 제출 개요.

#### 사람들(People) 운영
- `kind ∈ mentor|staff|member` 프로필 CRUD.
- 항목: 이름, 직함, 소속, 소개, 사진URL, **전화번호 (로그인 회원에게만 노출)**, 태그, 표시순서, 공개여부.
- `user_id`/`student_id` 유일 — 중복 시 409.
- **프로필 사진 업로드**: 본인(학생·멘토) 또는 어드민이 파일을 올린다. 서버 디스크의 공개 영역에 저장하고 `/api/uploads/public/...` 로 무인증 서빙한다 — 공개 `/people` 목록에 그대로 뜬다. 주소 직접 입력도 함께 지원한다(ADR-017).

#### 사이트 콘텐츠 운영
- 공개 페이지 5개 키의 JSON 편집. 빈 키도 항상 응답에 포함.
- 서버 시작 시 디폴트 부트스트랩 (`onConflictDoNothing`, 1회성 "leadership" 레거시 복사 이관).

---

## 3. Mentor (`role=mentor`)

### 3.1 화면 IA

| 경로 | 화면 |
|---|---|
| `/mentor` | 멘토 대시보드 |
| `/mentor/profile` | 본인 멘토 프로필 편집 |
| `/evaluator` | (평가 surface) 내 평가 배정 목록 |
| `/evaluator/applications/:id` | (평가 surface) 지원서 평가 작성 |
| `/people`, `/people/:kind/:id` | 회원 디렉터리 — 로그인 상태이므로 phone 노출 |

### 3.2 기능 명세

#### 멘토 프로필
- `GET|PATCH /mentor/profile` — `people_profiles` 중 `userId=me, kind=mentor` 행.
- **Lazy create 없음**: admin이 사전에 `/admin/people`에서 row 생성 후 `userId` 링크해야 함.
- 미설정 시 404 + 친절 메시지 ("관리자에게 프로필 설정 요청").
- 본인이 변경 가능한 필드: 이름, 직함, 소속, 소개, 사진, 전화, 태그, 공개여부.

#### 평가 참여 (with admin)
- `GET /evaluator/assignments` — 본인에게 배정된 평가 목록.
- `GET /evaluator/applications/:id` — 본인이 배정된 지원서만 조회 가능 (라우트 핸들러가 assignment 소유권 재확인; admin/mentor 역할만으로는 불충분).
- `POST /evaluator/applications/:id/evaluations` — `(app, evaluator, stage)` upsert. 자동으로 해당 assignment `completed` 처리.
- 평가 항목: motivation / problem_awareness / initiative / collaboration / fit (각 1~5) + overall + recommendation + comment.

---

## 4. Student (`role=student`)

### 4.1 화면 IA

| 경로 | 화면 |
|---|---|
| `/student/login` | 로그인 (공용 폼) |
| `/student` | 학생 대시보드 |
| `/student/sessions` | 내 세션 |
| `/student/attendance` | 내 출석 기록 |
| `/student/assignments` | 내 과제 목록 (published/closed만) |
| `/student/assignments/:id` | 과제 상세 + 제출 |
| `/student/announcements` | 공지 (전체 OR 내 코호트/프로그램) |
| `/student/profile` | 본인 회원 프로필 편집 |
| `/student/timeline` | 내 활동 타임라인 |
| `/student/projects` | 내 프로젝트 목록 |
| `/student/projects/:id` | 프로젝트 상세 (멤버 한정) |
| `/student/artifacts` | 내 산출물 |
| `/student/report` | 내 활동 리포트 |
| `/people`, `/people/:kind/:id` | 회원 디렉터리 — 로그인 상태이므로 phone 노출 |

### 4.2 기능 명세

#### 출결·과제
- **세션·출석**: 내 코호트/프로그램 범위만 조회.
- **과제 제출**: `POST /student/assignments/:id/submission` (upsert). 마감 후 자동 `late`. `closed` 상태에서는 거부.
- **공지**: `is_published=true` AND (`target=all` OR 내 코호트/프로그램).

#### 프로필
- `GET /student/profile`: 첫 호출 시 `people_profiles` 행 lazy-create (`kind=member, isPublic=false`).
- `PATCH`로 본인 정보 수정 — `kind`/`studentId`/`userId`/`displayOrder`는 변경 불가.
- 공개 토글로 `/people` 멤버 탭 노출 여부 결정.

#### 활동 기록 (MVP4) — 가시성 규칙
| 영역 | 규칙 |
|---|---|
| `/student/timeline` | `studentId=me` AND `visibility=student_visible`만 |
| `/student/artifacts` | 내 산출물(≠admin_only) ∪ 내가 멤버인 프로젝트의 (`student_visible`/`cohort_visible`) ∪ 같은 코호트 프로젝트의 `cohort_visible` |
| `/student/projects/:id` | 멤버만 진입. 타 멤버의 `private` 산출물은 절대 노출 안 함. |
| `/student/report` | `admin_only` 피드백 제외, `student_visible`만 |

---

## 5. 인증 & 세션

- **로그인**: 이메일+비밀번호 (bcrypt).
- **세션**: `seeds_admin` 쿠키, HMAC 서명(`SESSION_SECRET`), `httpOnly`, `sameSite=lax`, 프로덕션 `Secure`. 페이로드 `{userId, role, roles, exp}`.
- **부트스트랩**: 서버 시작 시 `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 초기 admin 생성/갱신.
- **활성화 매직링크**: 비밀번호 없는 inactive 계정 → 토큰 발급(14일 유효, sha256 해시 저장) → `/activate/<token>`에서 비밀번호 설정 + `is_active=true`. 토큰 plaintext는 발급 시점에만 노출.

---

## 6. API 미들웨어 매트릭스

| 미들웨어 | 허용 effective roles | 비고 |
|---|---|---|
| `requireAdmin` | admin | |
| `requireMentor` | mentor | 본인 프로필 전용 |
| `requireAdminOrMentor` | admin OR mentor | 평가 surface |
| `requireStudent` | student | |
| `requireAuth` | 로그인된 모든 사용자 | |
| `optionalAuth` | (옵셔널) | 로그인 시 `req.sessionUser` 채움, 미로그인도 통과 — `/api/people/*`에서 phone 게이팅에 사용 |

평가 라우트는 미들웨어 통과 후에도 `evaluation_assignments` 소유권을 추가 확인.

---

## 7. 데이터 모델 (전체)

총 **24개 테이블** + 1 헬퍼 함수. PostgreSQL, Drizzle ORM. 모든 `enum` 값은 `text` 컬럼 + 앱-레벨 상수 화이트리스트로 강제(`$type<...>()`).

### 7.0 도메인 클러스터 ER 개관 (요약)

```
사용자 / 인증
  users ── (1:1) ── people_profiles
   │   └── (1:N) ─ account_activation_tokens
   │
지원·평가 (MVP1/2)
  applications ──(1:N)── evaluation_assignments ──(N:1)── users [evaluator]
       │       ──(1:N)── evaluations               (stage별 1건/평가자)
       │       ──(1:1)── interviews
       │       ──(1:N)── decision_logs            (감사로그)
       │
학생 (MVP3)
  applications ──(0..1:1)── students ──(N:1)── users
                              │
                              ├── student_cohorts ── cohorts ── programs
                              ├── student_programs ── programs
                              │
활동 (MVP3)
  cohorts ─── sessions ─── attendance_records ─── students
  cohorts ─── assignments ─── assignment_submissions ─── students
  cohorts ─── announcements   (target_type=all|cohort|program)
  programs (cohort_id FK)
  
활동 기록·활용 (MVP4)
  students ── activity_records (source_type=session|assignment|project|feedback|manual)
  cohorts  ── projects ── project_members ── students
                │
                ├── artifacts        (= mvp4ArtifactsTable, 가시성 4단계)
                └── feedback         (가시성 2단계, target_type=...)
  skill_tags ── tag_mappings ── (activity_record|project|artifact|feedback|student)

콘텐츠
  site_contents (key whitelist 5개)
```

---

### 7.1 사용자 & 인증

#### `users`
| 컬럼 | 타입 | 기본 / 제약 |
|---|---|---|
| `id` | serial PK | |
| `name`, `email`, `password_hash` | text | `email` UNIQUE |
| `role` | text | `admin\|mentor\|student` (앱-레벨 enum) |
| `extra_roles` | text[] | `'{}'::text[]` — 다중 역할 |
| `is_active` | bool | true |
| `created_at`, `updated_at` | timestamptz | now() |

**헬퍼 함수** (`lib/db/src/schema/users.ts`):
- `getEffectiveRoles(u)` → `[role, ...extraRoles]` 유일집합
- `canViewMemberContacts(u)` → admin∪mentor∪student 중 하나라도 포함 시 true (현재 = 모든 로그인 사용자)

#### `account_activation_tokens`
매직링크 활성화 토큰. plaintext는 발급 시점에만 응답, DB에는 `sha256` 해시만 저장.
- `user_id` FK→users CASCADE, `token_hash` text + INDEX, `expires_at` (기본 14d), `used_at?`, `created_by`, INDEX `(user_id)`.
- "Latest-wins": 재발급 시 기존 미사용 토큰은 used 처리.

#### `people_profiles` — 공개 디렉터리 + 본인 프로필
| 컬럼 | 비고 |
|---|---|
| `kind` | `mentor\|staff\|member` |
| `user_id?` (FK set null) | **UNIQUE** — 1유저당 1프로필 |
| `student_id?` (FK set null) | **UNIQUE** — 1학생당 1프로필 |
| `name`, `role_title?`, `affiliation?`, `bio?`, `photo_url?` | 프로필 본문 |
| `phone?` | text — 로그인 회원에게만 노출 |
| `tags` | text[] (기본 `[]`) |
| `display_order` | int (기본 0, INDEX `(kind, display_order)`) |
| `is_public` | bool (기본 false) — true만 공개 노출 |

생성 규칙:
- 학생 본인 프로필은 `/student/profile` 첫 GET 시 lazy-create (race-safe upsert).
- 멘토 프로필은 lazy-create 없음 — admin이 사전에 row 생성 + `user_id` 링크.

---

### 7.2 지원·평가 (MVP1/2)

#### `applications` — 지원서 1건
- 본문 필드: `name, email, phone, school, grade, birth_year, interest_area, motivation, experience, problem_awareness, expectation, privacy_consent`.
- **이중 상태머신**:
  - `status` (legacy MVP1): `submitted\|reviewing\|interview\|accepted\|rejected\|waitlisted\|withdrawn`
  - `application_status` (MVP2 lifecycle): `submitted → document_review → document_review_completed → interview → interview_scheduled → interview_completed → final_decision_made / withdrawn`
- `final_decision`: `pending\|accepted\|rejected\|waitlisted\|withdrawn`
- `admin_note`, `submitted_at`, `updated_at`.

#### `evaluation_assignments` — 누가 누구를 평가하는가
- `(application_id, evaluator_id, stage)` **UNIQUE**.
- `stage`: `document_review\|interview`.
- `status`: `assigned\|in_progress\|completed`.
- `assigned_by` (users FK), `assigned_at`.
- 핸들러는 미들웨어(`requireAdminOrMentor`) 통과 후에도 본 테이블 소유권을 application 단위로 재확인.

#### `evaluations` — 평가 본문 (upsert)
- `(application_id, evaluator_id, stage)` **UNIQUE**.
- 서브 점수 (1~5): `motivation_score, problem_awareness_score, initiative_score, collaboration_score, fit_score`.
- `overall_score` (1~5, NOT NULL), `recommendation`: `strong_accept\|accept\|hold\|reject\|strong_reject`, `comment?`.
- upsert 시 해당 assignment 자동 `completed`.

#### `interviews` — 지원서당 1건
- `(application_id)` **UNIQUE**.
- `scheduled_at?`, `location_or_link?`, `interviewer_note?`, `status`: `not_scheduled\|scheduled\|completed\|no_show\|cancelled`.

#### `decision_logs` — append-only 감사 로그
- `application_id` FK CASCADE.
- `previous_decision?`, `new_decision`, `changed_by` (users FK set null), `reason?`, `created_at`.
- 변경 이력만 기록. 수정/삭제 API 없음.

---

### 7.3 활동 운영 (MVP3)

#### `cohorts` — 기수
- `name`, `description?`, `start_date?`, `end_date?`, `status`: `draft\|active\|completed\|archived`.

#### `programs` — 기수 내 트랙
- `cohort_id` FK CASCADE.
- `name`, `description?`, `status`: `draft\|active\|completed\|archived`.

#### `students` — 활성 학생 (≠ applications)
- `user_id` (FK CASCADE) **UNIQUE** — 1유저당 1학생.
- `application_id?` (FK set null) **UNIQUE** — 합격 변환 추적용.
- 캐시 필드: `name, email, phone?, school?` + `is_active`.

#### `student_cohorts`, `student_programs` — N:M 멤버십
- 각각 `(student_id, cohort_id)`, `(student_id, program_id)` **UNIQUE**.
- `joined_at`.

#### `sessions` — 일정/모임
- `cohort_id` FK CASCADE, `program_id?` (FK set null).
- `title`, `description?`, `scheduled_at` (NOT NULL), `duration_minutes` (기본 60), `location_or_link?`.
- `session_type`: `orientation\|workshop\|mentoring\|project_work\|presentation\|review\|other` (기본 `workshop`).
- `status`: `scheduled\|completed\|cancelled`.

#### `attendance_records`
- `(session_id, student_id)` **UNIQUE**.
- `status`: `present\|late\|absent\|excused`, `note?`, `marked_by` (users FK set null), `marked_at`.

#### `assignments` — 과제
- `cohort_id` FK CASCADE, `program_id?` (FK set null).
- `title`, `description?`, `due_at?`, `status`: `draft\|published\|closed`, `created_by`.

#### `assignment_submissions` — 제출 (upsert)
- `(assignment_id, student_id)` **UNIQUE**.
- 제출 본문: `content?`, `file_url?`, `external_url?` 중 자유.
- `status`: `not_submitted\|submitted\|late\|reviewed` (기본 `submitted`, 마감 후 자동 `late`).
- `submitted_at?`, `reviewed_by?` (users FK set null), `feedback?`.

#### `announcements` — 공지
- `title`, `content`, `target_type`: `all\|cohort\|program` (기본 `all`), `target_id?`.
- `is_published`, `published_at?`, `created_by`.

---

### 7.4 활동 기록·활용 (MVP4)

핵심: 각 테이블이 **자체 visibility 필드**를 갖고, 학생/관리자 쿼리에서 코드 레벨로 필터.

#### `activity_records` — 학생별 활동 타임라인 항목
- `student_id` FK CASCADE, `cohort_id` FK CASCADE, `program_id?` (FK set null).
- `source_type`: `session\|assignment\|project\|feedback\|manual`, `source_id?` (원본 entity의 id 참조).
- `title`, `description?`, `activity_date` (기본 now).
- `visibility`: `private\|student_visible\|admin_only` (기본 `admin_only`).
- `created_by` (users FK set null).

#### `projects` — 사이드프로젝트
- `cohort_id` FK CASCADE, `program_id?` (FK set null).
- `title`, `description?`, `problem_statement?`, `solution_summary?`.
- `status`: `ideation\|in_progress\|submitted\|presented\|completed\|archived`.
- `started_at?`, `ended_at?`.

#### `project_members`
- `(project_id, student_id)` **UNIQUE**.
- `role?` (e.g. "Lead", "Designer"), `contribution_summary?`.

#### `artifacts` (Drizzle export `mvp4ArtifactsTable`)
> ⚠️ DB 테이블명은 `artifacts`. 모노레포 `artifacts/` 디렉터리와 충돌 방지를 위해 JS 심볼은 `mvp4ArtifactsTable`.

- `student_id?` (FK set null), `project_id?` (FK set null), `assignment_submission_id?` (FK set null) — 셋 중 하나 이상으로 출처 표현.
- `title`, `description?`, `url` (NOT NULL).
- `artifact_type`: `link\|document\|presentation\|video\|code\|image\|report\|other` (기본 `link`).
- `visibility`: `private\|student_visible\|cohort_visible\|admin_only` (기본 `student_visible`) — **4단계**.
- `created_by`.

#### `feedback`
- `target_type`: `student\|project\|assignment_submission\|activity_record\|session`.
- `target_id`: polymorphic id (FK 없음 — 앱-레벨 정합성).
- `student_id?`: 피드백이 누구에 관한 것인지 별도 기록 (target이 project인 경우에도 학생-필터링 가능하게).
- `author_id?` (users FK set null).
- `feedback_type`: `general\|strength\|improvement\|review\|mentor_note\|admin_note` (기본 `general`).
- `content` (NOT NULL).
- `visibility`: `student_visible\|admin_only` (기본 `admin_only`) — **2단계**.

#### `skill_tags`
- `name` UNIQUE, `description?`.

#### `tag_mappings`
- `(tag_id, target_type, target_id)` **UNIQUE**.
- `target_type`: `activity_record\|project\|artifact\|feedback\|student` (polymorphic).
- `tag_id` FK CASCADE, `created_by` (users FK set null).

---

### 7.5 사이트 콘텐츠

#### `site_contents`
- `key` UNIQUE (whitelist: `page.home\|page.recruit\|page.about\|page.program\|page.faq`).
- `label`, `value jsonb`, `updated_by?`, `created_at`, `updated_at`.
- 서버 시작 시 디폴트 부트스트랩 (`onConflictDoNothing` + label refresh + 1회 "leadership" → 현 카피 마이그레이션).

---

### 7.6 가시성·접근 규칙 매트릭스 (학생 측)

| 영역 | 조건 |
|---|---|
| `student/timeline` (activity_records) | `studentId=me` AND `visibility=student_visible` |
| `student/artifacts` | (소유 ≠ admin_only) ∪ (멤버인 프로젝트의 student_visible/cohort_visible) ∪ (같은 코호트 프로젝트의 cohort_visible) |
| `student/projects/:id` 진입 | `project_members`에 포함된 경우만 |
| `student/projects/:id` artifacts | 본인 소유(≠admin_only) ∪ 타 멤버의 (student_visible/cohort_visible). `private`은 절대 미노출. |
| `student/report.feedbackHighlights` | `visibility=student_visible` AND `studentId=me` |

비-MVP4 가시성:
- 학생 과제: `status ∈ {published, closed}` AND 본인이 속한 코호트/프로그램만.
- 학생 공지: `is_published=true` AND (`target=all` OR 본인 코호트/프로그램).

---

### 7.7 인덱스 & 유일제약 요약

| 테이블 | 제약 |
|---|---|
| `users` | `email` UNIQUE |
| `students` | `user_id` UNIQUE, `application_id` UNIQUE |
| `people_profiles` | `user_id` UNIQUE, `student_id` UNIQUE, INDEX `(kind, display_order)` |
| `student_cohorts` | `(student_id, cohort_id)` UNIQUE |
| `student_programs` | `(student_id, program_id)` UNIQUE |
| `attendance_records` | `(session_id, student_id)` UNIQUE |
| `assignment_submissions` | `(assignment_id, student_id)` UNIQUE |
| `evaluation_assignments` | `(application_id, evaluator_id, stage)` UNIQUE |
| `evaluations` | `(application_id, evaluator_id, stage)` UNIQUE |
| `interviews` | `(application_id)` UNIQUE |
| `project_members` | `(project_id, student_id)` UNIQUE |
| `skill_tags` | `name` UNIQUE |
| `tag_mappings` | `(tag_id, target_type, target_id)` UNIQUE |
| `site_contents` | `key` UNIQUE |
| `account_activation_tokens` | INDEX `(token_hash)`, INDEX `(user_id)` |

---

### 7.8 ON DELETE 정책 요약

| 부모 → 자식 | 동작 |
|---|---|
| `users` → `students` | CASCADE (학생은 유저 종속) |
| `users` → `people_profiles.user_id` | SET NULL |
| `users` → `evaluation_assignments.evaluator_id` | CASCADE |
| `users` → `*.created_by / marked_by / assigned_by / reviewed_by / changed_by / author_id` | SET NULL (감사 흔적만 유지) |
| `applications` → `students.application_id` | SET NULL (학생 변환 후 지원서 삭제 시 학생은 살아남음) |
| `applications` → `evaluation_assignments, evaluations, interviews, decision_logs` | CASCADE |
| `cohorts` → `programs, sessions, assignments, students_*, activity_records, projects` | CASCADE |
| `programs` → `sessions.program_id 등` | SET NULL (코호트만 살리고 프로그램 분리 가능) |
| `students` → `attendance_records, assignment_submissions, activity_records, project_members` | CASCADE |
| `projects` → `project_members` | CASCADE; `artifacts.project_id` SET NULL |
| `skill_tags` → `tag_mappings` | CASCADE |
| `feedback.target_id, tag_mappings.target_id, activity_records.source_id` | FK 없음 (polymorphic, 앱 레벨에서 정합성 보장) |

---

### 7.9 설계 메모

- ~~**이중 status (applications)**~~ **2026-08-15 해소.** legacy `status` 를 제거했다. 두 축(단계 `application_status` / 결과 `final_decision`)만 남고 각각 쓰는 주체가 하나다. 보존해 둔 대가가 실제로 나타났었다 — `/final-decision` 이 `status` 를 갱신하지 않아 합격자가 목록·대시보드에서 `submitted` 로 남았다(이슈 #4).
- **Polymorphic id**: `feedback`, `tag_mappings`, `activity_records.source_id`는 FK 없이 `(target_type, target_id)` 페어로 다형성. DB-레벨 무결성 대신 어플리케이션 레벨에서 강제 (성능·유연성 ↔ 정합성 트레이드오프).
- **Visibility 단계화**: 4단계(artifact) vs 2단계(feedback) — 산출물은 코호트 단위 가시성이 의미 있지만, 피드백은 본인/관리자 외 공개 의미가 없어 단순화.
- **`canViewMemberContacts` 중앙화**: alumni·정지 등 정책 변경 시 한 곳만 수정.
- **`mvp4ArtifactsTable` 이름 규약**: DB 테이블명 `artifacts`이지만 JS 심볼은 명시적으로 prefix해 모노레포 `artifacts/` 디렉터리와 혼동 방지.
