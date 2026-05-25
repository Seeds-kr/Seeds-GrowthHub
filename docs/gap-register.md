# Seeds GrowthHub — Gap Register

> 본 문서는 현재 Replit 구현을 GrowthHub Baseline 문서(v3 기준)와 대조하여 **유지/변경/추가/보류** 항목을 식별한 감사 문서입니다.
> 본 단계에서는 코드 변경을 하지 않으며, 향후 작업 우선순위와 wave를 결정하기 위한 근거 자료입니다.
>
> Baseline: Overview v3, 문서체계/용어표준, Core v2, Ops v3, Growth v3, IA v2, ERD v3, 외부 도구 연계, 로드맵 v3.

---

## 1. 현재 구현 요약

### 1.1 구현 자산 (유지 가치 높음)

| 영역 | 현황 | Baseline 정렬 상태 |
|---|---|---|
| **인증/세션** | HMAC 서명 쿠키(`seeds_admin`), bcrypt, `ADMIN_EMAIL/PASSWORD` 부트스트랩, 매직링크 활성화 (14d, sha256, latest-wins) | Core v2와 정렬됨 |
| **역할 모델** | `users.role` (admin/mentor/student) + `extra_roles[]`, `getEffectiveRoles`, `canViewMemberContacts` | Core v2와 정렬됨 (scope-based는 보류) |
| **역할 스위처** | `/admin · /mentor · /student` 헤더 버튼, 세션 재발급 없이 라우팅 | IA v2와 정렬됨 |
| **Evaluation Surface** | `/evaluator/*`, 미들웨어 `requireAdminOrMentor` + assignment 소유권 재확인 | IA v2 / Core v2와 정렬됨 (별도 role 아님) |
| **Visibility 정책** | artifact 4단계 / feedback 2단계 / activity_record 3단계 (앱 레벨 강제) | ERD v3와 정렬됨, reflections는 미구현 |
| **People Profiles** | phone 게이팅, lazy-create (student만), kind=mentor 사전 생성 강제 | Core v2와 정렬됨 |
| **MVP1/2** 지원/평가 | applications 이중 상태머신, evaluation_assignments/evaluations (3-튜플 UNIQUE), interviews, decision_logs append-only | Ops v3과 정렬됨 |
| **MVP3** 운영 활동 | cohorts/programs/students(+멤버십), sessions/attendance, assignments/submissions, announcements | Ops v3 부분 정렬 (checklists 없음) |
| **MVP4** 성장증거 | activity_records, projects+members, mvp4ArtifactsTable, feedback, skill_tags+tag_mappings | Growth v3 부분 정렬 (studies/reflections/milestones/status_checks 미구현) |
| **사이트 콘텐츠** | site_contents (key whitelist 5), 부트스트랩, 레거시 마이그레이션 | Content 영역 정렬됨 |
| **API 계약** | OpenAPI 3.1 → orval(React Query) + Zod codegen | 아키텍처 자산으로 유지 |
| **Object Storage** | ACL 기반 (`visibility=public` 게이팅), 아바타 AI 생성(Gemini) | Core v2 파일 저장 전략과 정렬 |

### 1.2 구조적 누락 (Baseline 대비)

- **Core**: `role_assignments` (scope), `documents`/`document_versions`, `audit_logs`, `teams`(검토), `attachments`(범용), `external_links`
- **Ops**: `meetings`, `tasks`, `event_checklists`, `finance_records`, `communication_logs`, `calendar_events`, Markdown 문서 편집기, 운영 대시보드
- **Growth**: `studies`/`study_members`, `reflections`, `project_milestones`, `project_status_checks`, mentor↔project 명시 연결, blocker/next_focus 필드
- **IA**: Admin 메뉴의 Core/Ops/Growth/Content/System 그룹화 미적용
- **Mentor Workspace**: My Teams, Project Status, Feedback 화면 부재
- **Student Workspace**: My Studies, My Reflections, My Feedback 화면 부재
- **System**: Integrations, Audit Logs, Settings 메뉴 부재

---

## 2. Gap Register

> Priority: **P0** = 즉시(다음 wave), **P1** = 단기(1~2 wave 내), **P2** = 중기, **P3** = 보류/검토.
> Risk: 회귀 위험 + 설계 리스크 (낮음/중간/높음).

### 2.1 Admin IA & Navigation

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| A1 | Admin 사이드바가 평탄(flat)한 단일 리스트 | Core/Ops/Growth/Content/System 5그룹 | 그룹화 미적용 | **P0** | `AdminLayout` 사이드바를 그룹 헤더 + 아코디언/섹션으로 재구성. **라우트 경로는 유지** (네비게이션만 재분류) | 낮음 (UI-only, route 무변경) | `artifacts/seeds/src/components/layouts/AdminLayout.tsx` (또는 동등) |
| A2 | `/admin/evaluators` 위치가 Ops와 Growth 사이 모호 | Ops > Evaluations로 명시 배치 | 그룹 라벨 누락 | **P0** | A1과 함께 처리 | 낮음 | 동일 |
| A3 | `/admin/students` 위치 (Core vs Growth) | IA v2는 둘 다 후보로 둠 | 결정 필요 | **P1** | 권장: Core > Members (가입/계정 관점), Growth는 student 활동 화면 (timeline/report) 중심 | 낮음 (라우트 무변경) | 동일 |
| A4 | System 메뉴 없음 | Integrations / Audit Logs / Settings | 메뉴 + 빈 페이지 부재 | **P2** | Wave 3 이후 Integrations 1개 정도부터 추가 | 낮음 | — |

### 2.2 Mentor Workspace

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| M1 | `/mentor` 대시보드, `/mentor/profile`, Evaluation Surface | + My Teams, Project Status, Feedback History, Add Feedback, Needs Ops Support | 4개 화면 부재 | **P1** | 신규 라우트 추가 (`/mentor/teams`, `/mentor/projects`, `/mentor/projects/:id`, `/mentor/feedback`). 백엔드: 기존 `projects`·`project_members`·`feedback` 재사용 + mentor 담당 필터링용 매핑 도입 (M2 참조) | 중간 (멘토-팀 매핑 미정의) | `artifacts/api-server/src/routes/mentor-*.ts`, `artifacts/seeds/src/pages/mentor/*` |
| M2 | mentor ↔ project/team 명시 연결 없음 | ERD v3: mentor linkage 명확화 | 데이터 모델 미비 | **P1** | `project_mentors(project_id, mentor_user_id)` UNIQUE 신규 테이블 권장 (기존 `project_members`는 학생 전용 유지) | 중간 (스키마 추가) | `lib/db/src/schema/projects.ts` 또는 신규 `project-mentors.ts` |

### 2.3 Student Workspace

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| S1 | timeline/projects/artifacts/report 있음 | + My Studies, My Reflections, My Feedback | 3개 화면 부재 | **P2** | studies/reflections는 신규 테이블 의존 → 후행. My Feedback은 즉시 추가 가능 (기존 `feedback` student-visible 필터) | 중간 (visibility 회귀 위험) | `artifacts/seeds/src/pages/student/*` |

### 2.4 Meetings (신규)

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| OM1 | 없음 | `meetings(title, type, date, participants, agenda_md, decisions_md, pending_md, visibility, created_by)` + 회의록 ↔ tasks 연결 | 전무 | **P0** | 신규 테이블 + `/admin/meetings[/:id]`. Markdown body 저장. 액션 아이템은 OT1과 함께. | 중간 (visibility 정책 신규 수립 필요) | 신규 `lib/db/src/schema/meetings.ts`, `routes/admin-meetings.ts` |
| OM2 | — | 회의록 → 후속 액션 생성 UX | OT1 의존 | **P0** | meeting detail에서 "+ Action Item" 버튼 → tasks insert with `source_type=meeting, source_id` | 낮음 (tasks 폴리모픽 source 설계로 흡수) | 동일 |

### 2.5 Tasks / Action Items (신규)

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| OT1 | 없음. MVP3의 `assignments` (학생 과제)와 명백히 다름 | `tasks(title, description, source_type, source_id, assignee_id, due_date, priority, status, linked_object_type, linked_object_id)` 상태 6개 | 전무 | **P0** | 신규 테이블 + `/admin/tasks` 칸반. **명명 주의**: 학생 과제(`assignments`)와 충돌 방지 — 운영 작업은 `tasks` 고정, UI 라벨 "운영 작업/액션". 폴리모픽 `source_*` + `linked_object_*` 둘 다 채택 (회의→액션 vs 작업의 연결 객체 구분). | 중간 (학생과제 vs 운영작업 명명 혼동) | 신규 `lib/db/src/schema/tasks.ts`, `routes/admin-tasks-ops.ts` ⚠️ 기존 `admin-tasks.ts`는 MVP3 assignments용이므로 파일명 충돌 주의 |
| OT2 | — | 지연 작업 대시보드 표시 | OD1 의존 | **P0** | due_date < now AND status NOT IN (done, canceled) 쿼리 | 낮음 | 동일 |

### 2.6 Documents / Templates / Markdown Editor (신규)

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| OD1 | 없음. `site_contents`만 존재(공개 페이지 JSON) | `documents(title, doc_type, body_md, owner_id, linked_object_*, visibility, is_template, status)` + `document_versions` | 전무 | **P1** | 신규 테이블 2개. 클라이언트는 react-markdown + 간단 textarea 시작 (rich editor는 후행). 버전은 update 시 prior body snapshot insert 패턴. | 중간 (visibility 정책 신규) | 신규 `lib/db/src/schema/documents.ts` |
| OD2 | — | 템플릿 라이브러리, 체크리스트 문서 | OD1 의존 | **P1** | `is_template=true` 플래그 + 복제 API (`POST /admin/documents/:id/duplicate`) | 낮음 | 동일 |

### 2.7 Events / Sessions / Checklists

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| OE1 | `sessions` (cohort, program, scheduled_at, type, attendance) | 동일 + `event_checklists` 연결 + 후속 액션 생성 | 체크리스트/액션 연결 부재 | **P1** | `event_checklists(session_id, item_text, is_done, order)` 신규 OR documents의 체크리스트 문서를 session에 link하는 방식 검토. **권장**: 후자(OD1 활용) — 모델 비대화 회피 | 낮음 | `lib/db/src/schema/sessions.ts` (변경 X), 신규는 OD1로 흡수 |
| OE2 | session→tasks 연결 없음 | 행사 후속 액션 | OT1 의존 | **P1** | tasks의 `source_type=session, source_id` 활용 | 낮음 | OT1 |

### 2.8 Finance / Attachments (신규)

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| OF1 | 없음. object storage 인프라는 존재 | `finance_records(record_type, amount, category, date, description, receipt_url, requester_id, approver_id, status, linked_object_*)` 상태 7개 | 전무 | **P1** | 신규 테이블 + `/admin/finance`. **접근 제어**: 별도 미들웨어 `requireFinanceAccess` 필요 — admin 또는 `extra_roles`에 `finance` 같은 신규 role 추가 검토. 또는 단순화로 admin-only 시작. | 높음 (회계 권한 정책 신규, 감사 필요) | 신규 `lib/db/src/schema/finance-records.ts` |
| OF2 | object storage ACL 있음 | `attachments` 범용 메타 | partial | **P2** | `attachments(id, file_url, mime, size, owner_id, visibility, linked_object_*, created_at)` 신규. finance receipt도 여기 통합 가능. | 중간 | 신규 |

### 2.9 Ops Dashboard

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| DA1 | `/admin` 대시보드 (간단 카운트만) | 지연작업/모집/행사/회계/문서/팀 지원 6영역 | 5영역 미구현 | **P1** | tasks, meetings, finance, documents 추가 후 단계적 위젯 합산. 각 위젯은 단일 SQL 쿼리 + cache. | 낮음 | `routes/admin-dashboard.ts` (있다면) |

### 2.10 External Links & Integrations

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| EX1 | 산출물(`artifacts`)에 url 필드 있음 | `external_links(url, link_type, owner_id, linked_object_*, visibility, freshness_marked_at)` | 범용 외부링크 객체 부재 | **P2** | 신규 테이블. 또는 artifacts의 일부로 흡수 가능 → **결정 필요**. 권장: 별도 신설 (외부링크는 산출물이 아닌 운영 자료 포함). | 낮음 | 신규 |
| EX2 | `communication_logs` 없음 | 이메일/SMS 발송 이력 | 전무 | **P2** | 신규 테이블. 발송 도구 연동 전이라도 수동 기록용으로 시작 | 낮음 | 신규 |
| EX3 | GitHub/Discord/Drive 연동 없음 | 링크 기반 우선 | 미구현 | **P3** | EX1로 흡수. API 연동은 후행. | 낮음 | — |

### 2.11 Growth — Studies / Reflections / Project 보완

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| G1 | 없음 | `studies` + `study_members` | 전무 | **P2** | `projects` 패턴 복제. visibility는 artifacts 4단계 차용. | 낮음 (projects 패턴 재사용) | 신규 |
| G2 | 없음 | `reflections` (polymorphic target, visibility 5단계 검토) | 전무 | **P2** | 신규. **visibility 신규 추가 주의**: `mentor_visible`, `team_visible` 등은 기존 4단계와 정합성 필요 — Core 수준 visibility 정책 합의 선행 | 높음 (visibility 정책 확장) | 신규 |
| G3 | `projects`에 milestones/blocker/next_focus 없음 | 보완 필요 | partial | **P1** | `project_milestones(project_id, title, due_at, status)` + `project_status_checks(project_id, checked_at, team_status, blocker, next_focus, needs_ops_support, author_id)` 신규 — projects 본체는 비파괴 추가 | 중간 (projects detail UI 회귀 검증) | `lib/db/src/schema/projects.ts` 보완 + 신규 2개 |

### 2.12 Visibility 정책 통합

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| V1 | artifact 4 / feedback 2 / activity 3 — 각 테이블 자체 enum | reflection/document/finance/tasks 등 신규 객체에도 일관된 visibility 정책 | 정책 표준 부재 | **P0** (메타 작업) | 별도 `docs/visibility-policy.md` 작성: 5단계 표준 (`private`, `team_visible`, `cohort_visible`, `student_visible`, `admin_only`) 후보 vs 객체별 채택 매트릭스. 기존 객체는 무변경. | 높음 (학생 visibility 회귀 절대 금지) | docs |

### 2.13 Core 확장 (scope/audit)

| # | 현재 | Baseline 요구 | Gap | P | 구현 접근 | Risk | 관련 파일 |
|---|---|---|---|---|---|---|---|
| C1 | `role + extra_roles` 평면 | `role_assignments(user_id, role_code, scope_type, scope_id, start/end)` 검토 | 미구현 | **P3** (보류) | 운영진 세부 역할(Recruiting Lead 등)이 실제 권한 분리 요구 발생 시 도입. 그 전엔 `extra_roles`로 표현. | 높음 (auth 핵심 변경) | `lib/db/src/schema/users.ts` |
| C2 | `decision_logs` 외 감사로그 없음 | `audit_logs` (민감정보 변경) | 미구현 | **P2** | finance/role 변경/visibility 변경 등 도입 시 한 번에 추가 | 중간 | 신규 |

---

## 3. Recommended Implementation Waves

순서는 **로드맵 v3의 Phase 1 (Core) → Phase 2 (Ops) → Phase 3 (Growth 보완)**을 따르되, 현재 구현이 이미 MVP1~4를 커버하므로 **누락 위주**로 재배열합니다.

### Wave 0 — 정책·문서 (코드 변경 X, 1~2 sprint)
- **V1**: Visibility 정책 표준 문서화 (`docs/visibility-policy.md`)
- **A3**: Students 화면의 Core/Growth 위치 결정 (문서 합의)
- IA 그룹 라벨 한국어 컨벤션 확정

### Wave 1 — Admin IA 재정렬 + Ops 핵심 1차 (UI + 신규 테이블 2개)
- **A1, A2**: Admin 사이드바 그룹화 (UI-only, 라우트 무변경)
- **OM1, OM2**: Meetings 테이블 + `/admin/meetings`
- **OT1, OT2**: Tasks(운영) 테이블 + `/admin/tasks` (학생 assignments와 명명 충돌 방지)
- **DA1 부분**: 대시보드에 "지연 작업" 위젯만 추가

### Wave 2 — Documents + Events 보완 + Growth 1차 보완
- **OD1, OD2**: Documents/Templates + Markdown editor
- **OE1, OE2**: 세션 ↔ 체크리스트(=document) + 세션 후속 액션(=tasks)
- **G3**: project_milestones + project_status_checks
- **M2**: project_mentors 테이블 + 멘토-팀 매핑

### Wave 3 — Mentor/Student Workspace 보완
- **M1**: Mentor 화면 4종 (My Teams, Project Status, Feedback, Needs Ops Support)
- **S1 부분**: Student My Feedback (즉시 가능)

### Wave 4 — Finance + Attachments + 대시보드 완성
- **OF1, OF2**: finance_records + attachments
- **DA1 완성**: 6영역 대시보드 위젯
- **C2**: audit_logs (finance 변경 추적부터 시작)

### Wave 5 — Growth 2차 + External (검토 후 진행)
- **G1**: studies + study_members
- **G2**: reflections (단, V1 정책 합의 후)
- **EX1, EX2**: external_links + communication_logs
- **S1 완성**: My Studies, My Reflections

### 보류 (Wave 미배정)
- **C1** (role_assignments): 실제 권한 분리 요구가 발생할 때까지 보류
- **EX3** (API 연동): 링크 기반 운영이 안정화된 후 검토
- **A4** (System 메뉴): EX/C2/Settings가 어느 정도 모일 때 추가

---

## 4. High-Risk Areas (회귀 절대 금지)

| 영역 | 리스크 | 가드레일 |
|---|---|---|
| **학생 visibility 규칙** | reflections/documents 등 신규 객체 도입 시 학생 측 필터링 정합성 깨지면 사적 정보 노출 위험 | 신규 객체마다 student 라우트 통합 테스트 필수. `replit.md` 가시성 매트릭스 + 신규 visibility-policy.md를 단일 진실로. |
| **Evaluator Surface 소유권 재확인** | 미들웨어 통과 후 핸들러에서 `evaluation_assignments` 재확인 패턴이 신규 평가 관련 변경 시 누락될 수 있음 | 기존 패턴 보존, 평가 관련 PR은 evaluator surface 회귀 체크리스트 적용 |
| **Tasks 명명 충돌** | 운영 `tasks`와 학생 `assignments`(MVP3 homework)가 둘 다 "과제/작업" 의미. 코드 베이스에 이미 `admin-tasks.ts`가 MVP3 assignments용으로 존재 가능 | 신규 운영 tasks 파일/라우트는 `admin-ops-tasks.ts` / `/admin/ops/tasks` 등 prefix 분리 또는 기존 파일 rename 검토 |
| **Visibility 확장** | reflections의 `mentor_visible`/`team_visible` 신규 단계는 기존 enum과 충돌 가능 | Wave 5 진입 전 V1 정책 합의. enum은 객체별 독립 유지 권장 (전역 통합 금지) |
| **Role 변경** | `role_assignments` 도입은 미들웨어 전반 영향. **현재 보류 (P3)** | `getEffectiveRoles` API 표면을 깨지 않는 어댑터 패턴으로만 진행 |
| **finance 권한** | admin-only로 시작해도 회계담당자 분리 시 권한 재설계 필요. 영수증 URL은 ACL 필수 | object storage `visibility=private` + 인증 게이트 라우트 사용 |
| **mvp4ArtifactsTable 명명** | DB 테이블명 `artifacts` vs 모노레포 `artifacts/` 디렉터리 vs 신규 `external_links`/`attachments` | 기존 컨벤션(`mvp4ArtifactsTable`) 준수. 신규 객체도 prefix/suffix로 디렉터리명 충돌 회피 |
| **이중 상태 (applications)** | legacy `status` + `application_status` 동시 유지 — 신규 화면이 한쪽만 업데이트 시 정합성 깨짐 | 변경 시 두 컬럼 동시 set하는 헬퍼 함수 도입 검토 |

---

## 5. 제안: 첫 구현 작업

**작업명: Wave 0 — Visibility 정책 표준화 + Wave 1 시작 (Admin IA 재정렬 — UI only)**

### 5.1 Acceptance Criteria

#### Part A: `docs/visibility-policy.md` 작성 (코드 X)
- [ ] 현재 모든 visibility enum 인벤토리 (artifacts 4 / feedback 2 / activity_records 3 / people_profiles is_public boolean) 표로 정리
- [ ] 표준 후보 5단계 (`private`, `team_visible`, `cohort_visible`, `student_visible`, `admin_only`) 정의
- [ ] 신규 객체(meetings, tasks, documents, reflections, finance_records, external_links) 각각의 권장 visibility 매트릭스
- [ ] 비-회원/회원/멘토/학생/운영진 5축 × 객체별 접근 매트릭스
- [ ] "객체별 enum 독립 유지, 전역 enum 통합 금지" 원칙 명시
- [ ] 학생 측 회귀 방지 체크리스트 (기존 `replit.md` 매트릭스 그대로 인용)

#### Part B: Admin Sidebar 그룹화 (UI only, 라우트 무변경)
- [ ] `AdminLayout` 사이드바를 다음 5그룹으로 재구성:
  - **Core**: Users, People Profiles, Cohorts, Programs, Members(=Students 위치 결정에 따라)
  - **Ops**: Recruitment(Applications), Evaluations, Interviews, Sessions, Attendance, Assignments, Announcements
  - **Growth**: Students(또는 Core), Projects, Activity Records, Artifacts, Feedback, Tags, Reports
  - **Content**: Site Content
  - **System**: (이번엔 빈 그룹 또는 미노출)
- [ ] 그룹 헤더는 한국어 라벨 (예: "코어", "운영", "성장", "콘텐츠")
- [ ] **모든 기존 경로는 그대로**: `/admin/applications`, `/admin/people` 등 변경 없음 — 메뉴 재배치만
- [ ] 모바일/접힘 상태 보존
- [ ] 활성 그룹 자동 펼침 (현재 라우트 기준)

### 5.2 비목표 (이번 작업에서 하지 않음)
- 신규 테이블/라우트 추가 (Wave 1 후반)
- Mentor/Student 화면 변경
- Visibility enum 코드 변경
- Tasks/Meetings/Documents 구현
- 라우트 경로 변경 또는 리다이렉트

### 5.3 검증
- [ ] `pnpm --filter @workspace/seeds run typecheck` 통과
- [ ] 모든 admin 경로 수동 클릭 — 라우팅 회귀 없음
- [ ] 학생/멘토/평가 surface 로그인 → 회귀 없음 (UI 변경 admin-only)
- [ ] `replit.md`의 Database schema/visibility 섹션 변경 없음

### 5.4 예상 소요
- Part A: 1 sprint (문서 작업)
- Part B: 1~2 sprint (사이드바 컴포넌트 1개 수정 + nav 데이터 구조)

---

## 6. 부록 — 작업 시 참조 문서 매핑

| 작업 영역 | 1차 참조 |
|---|---|
| 메뉴 재분류 | IA v2 §7.1 |
| Meetings/Tasks/Documents/Finance | Ops v3 §4~9, ERD v3 §6 |
| Studies/Reflections/Milestones | Growth v3 §7~12, ERD v3 §7 |
| Mentor 화면 | IA v2 §8 |
| Student 화면 | IA v2 §9 |
| External Links | 외부 도구 연계 §13 |
| Visibility 정책 | Core v2 §7, ERD v3 §7 |
| Role/Scope | Core v2 §6, ERD v3 §5.6 |
| 용어 충돌 (tasks vs assignments 등) | 문서체계/용어 표준 §5 |
