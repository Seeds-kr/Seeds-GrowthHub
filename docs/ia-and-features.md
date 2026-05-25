# Seeds — Information Architecture & 기능 명세 (역할별)

> 학생 개발자 동아리 Seeds 운영 플랫폼. 현재 구현 기준 (MVP1~4 통합).
> 본 문서는 사용자 역할(role)별로 접근 가능한 화면(IA)과 기능을 정리한 사양서입니다.

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
| `/admin/people` | 사람들 (멘토/운영진/회원 프로필 CRUD + AI 아바타 생성) |
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
- **AI 아바타 생성**: Gemini로 미니멀 일러스트 자동 생성 → 오브젝트 스토리지 저장 (mint+white, 얼굴 디테일 없음).

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

## 7. 데이터 모델 핵심 요약

- **MVP1/2**: `applications`, `users(role, extra_roles)`, `evaluation_assignments`, `evaluations`, `interviews`, `decision_logs`.
- **MVP3**: `cohorts`, `programs`, `students`, `student_cohorts`, `student_programs`, `sessions`, `attendance_records`, `assignments`, `assignment_submissions`, `announcements`.
- **MVP4**: `activity_records`, `projects`, `project_members`, `artifacts` (Drizzle `mvp4ArtifactsTable`), `feedback`, `skill_tags`, `tag_mappings`.
- **공통**: `site_contents`, `account_activation_tokens`, `people_profiles (kind, user_id?, student_id?, phone?, ...)`.

자세한 컬럼/제약은 `replit.md`의 "Database schema" 섹션을 참조.
