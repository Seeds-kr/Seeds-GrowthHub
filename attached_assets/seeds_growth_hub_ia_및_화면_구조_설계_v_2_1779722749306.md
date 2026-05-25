# Seeds GrowthHub - IA 및 화면 구조 설계 v2

## 1. 문서 목적

이 문서는 Seeds GrowthHub의 정보구조(IA), 메뉴 구조, 사용자별 화면 구조, 화면 간 이동 흐름을 정의한다.

이 문서는 데이터 모델이나 ERD를 다루지 않는다. 데이터 구조와 엔티티 관계는 **Seeds GrowthHub - 데이터 모델 및 ERD 상세 설계**에서 다룬다.

## 2. IA와 ERD의 관계

IA의 메뉴 그룹은 사용자의 작업 맥락을 기준으로 한다. ERD의 도메인 분류는 데이터 소유와 관계 구조를 기준으로 한다. 두 구조는 유사하지만 반드시 1:1로 대응하지 않는다.

## 3. 현재 구현 기준선

| 영역 | 현재 구현 |
|---|---|
| Public | 홈, 소개, 프로그램, FAQ, 모집, 지원서, 사람들, 로그인, 계정 활성화 |
| Admin | 대시보드, 지원자, 평가자, 학생, 기수, 프로그램, 세션, 과제, 공지, 사람들, 사이트 콘텐츠, 활동기록, 프로젝트, 산출물, 피드백, 태그 |
| Mentor | 멘토 대시보드, 프로필, 평가 surface, 사람 디렉터리 |
| Student | 학생 대시보드, 세션, 출석, 과제, 공지, 프로필, 타임라인, 프로젝트, 산출물, 리포트 |
| Evaluator surface | 배정된 지원자 평가 목록과 평가 작성 |

현재 구현에는 역할 스위처가 있으며, `/admin · /mentor · /student` 간 이동은 세션 재발급이 아니라 effective roles 기반 라우팅으로 처리된다.

## 4. 목표 IA 원칙

1. 사용자별 작업 맥락을 우선한다.
2. Admin은 Core / Ops / Growth / Content / System으로 재분류한다.
3. Evaluator는 독립 role이 아니라 surface로 유지한다.
4. Mentor 화면은 평가보다 담당 팀/프로젝트 중심으로 확장한다.
5. Student 화면은 제출 중심에서 성장증거 확인 중심으로 확장한다.

## 5. 목표 IA 전체 구조

```text
Seeds GrowthHub
├─ Public Site
├─ Admin Workspace
├─ Mentor Workspace
├─ Student Workspace
└─ Evaluation Surface
```

## 6. Public Site

| 화면 | 현재 구현 | 목표 | 우선순위 |
|---|---|---|---|
| Home | 있음 | 유지 | 유지 |
| About | 있음 | 유지 | 유지 |
| Program | 있음 | 유지하되 Program 용어 재검토 | 유지/보완 |
| FAQ | 있음 | 유지 | 유지 |
| Recruit | 있음 | 유지 | 유지 |
| Apply | 있음 | 유지 | 유지 |
| People Directory | 있음 | 유지 | 유지 |
| Person Detail | 있음 | 유지 | 유지 |
| Login | 있음 | 유지 | 유지 |
| Activation | 있음 | 유지 | 유지 |

## 7. Admin Workspace

### 7.1 목표 메뉴

```text
Admin
├─ Home
│  └─ Dashboard
│
├─ Core
│  ├─ Users
│  ├─ People Profiles
│  ├─ Roles & Permissions
│  ├─ Cohorts
│  ├─ Programs
│  └─ Members
│
├─ Ops
│  ├─ Meetings
│  ├─ Tasks
│  ├─ Documents & Templates
│  ├─ Recruitment
│  ├─ Evaluations
│  ├─ Interviews
│  ├─ Events / Sessions
│  ├─ Attendance
│  ├─ Assignments
│  ├─ Announcements
│  ├─ Finance
│  └─ Operations Dashboard
│
├─ Growth
│  ├─ Students
│  ├─ Projects
│  ├─ Studies
│  ├─ Activity Records
│  ├─ Artifacts
│  ├─ Feedback
│  ├─ Reflections
│  ├─ Tags
│  └─ Reports
│
├─ Content
│  ├─ Site Content
│  ├─ Public Pages
│  └─ Media / Links
│
└─ System
   ├─ Integrations
   ├─ Audit Logs
   └─ Settings
```

### 7.2 현재 구현 대비 매핑

| 현재 화면 | 목표 위치 | 현재 구현 | 우선순위 |
|---|---|---|---|
| `/admin` | Home > Dashboard | 있음 | 보완 |
| `/admin/applications` | Ops > Recruitment | 있음 | 유지/보완 |
| `/admin/evaluators` | Ops > Evaluations | 있음 | 유지/재분류 |
| `/admin/students` | Growth > Students 또는 Core > Members | 있음 | 위치 정리 필요 |
| `/admin/cohorts` | Core > Cohorts | 있음 | 유지 |
| `/admin/programs` | Core > Programs | 있음 | 의미 재정의 필요 |
| `/admin/sessions` | Ops > Events / Sessions | 있음 | Event 개념으로 보완 |
| `/admin/assignments` | Ops > Assignments | 있음 | 유지/재해석 |
| `/admin/announcements` | Ops > Announcements | 있음 | 유지 |
| `/admin/people` | Core > People Profiles | 있음 | 유지 |
| `/admin/site-content` | Content > Site Content | 있음 | 유지 |
| `/admin/activity-records` | Growth > Activity Records | 있음 | 유지 |
| `/admin/projects` | Growth > Projects | 있음 | 유지/보완 |
| `/admin/artifacts` | Growth > Artifacts | 있음 | 유지 |
| `/admin/feedback` | Growth > Feedback | 있음 | 유지 |
| `/admin/tags` | Growth > Tags | 있음 | 임시 태그로 재해석 |
| Meetings | Ops > Meetings | 없음 | 추가 |
| Tasks | Ops > Tasks | 없음 | 추가 |
| Documents & Templates | Ops/Core | 없음 | 추가 |
| Finance | Ops > Finance | 없음 | 추가 |
| Studies | Growth > Studies | 없음 | 추가 |
| Reflections | Growth > Reflections | 없음 | 추가 |
| Audit Logs | System > Audit Logs | 없음/부분 | 추가 |
| Integrations | System > Integrations | 없음 | 추가 |

## 8. Mentor Workspace

### 8.1 목표 메뉴

```text
Mentor
├─ Dashboard
├─ My Teams
├─ Projects
├─ Team Status
├─ Feedback
├─ Evaluation Assignments
├─ Profile
└─ People Directory
```

### 8.2 화면별 목적과 우선순위

| 화면 | 현재 구현 | 목적 | 우선순위 |
|---|---|---|---|
| Dashboard | 있음 | 담당 팀/평가/일정 요약 | 보완 |
| Profile | 있음 | 본인 멘토 프로필 수정 | 유지 |
| Evaluation Assignments | 있음 | 배정 평가 수행 | 유지 |
| People Directory | 있음 | 회원 디렉터리 확인 | 유지 |
| My Teams | 없음 | 담당 팀 목록과 상태 확인 | 추가 최우선 |
| Projects | 없음/간접 | 담당 프로젝트 목표, 산출물, 블로커 확인 | 추가 최우선 |
| Team Status | 없음 | 팀 상태와 운영진 지원 필요 확인 | 추가 |
| Feedback | 없음/관리자 중심 | 이전 피드백 조회와 신규 피드백 작성 | 추가 |

### 8.3 Mentor MVP

- My Teams
- Project Status
- Recent Artifacts
- Feedback History
- Add Feedback
- Needs Ops Support

## 9. Student Workspace

### 9.1 목표 메뉴

```text
Student
├─ Dashboard
├─ My Sessions
├─ My Attendance
├─ My Assignments
├─ My Projects
├─ My Studies
├─ My Artifacts
├─ My Reflections
├─ My Feedback
├─ My Timeline
├─ My Report
└─ Profile
```

### 9.2 화면별 목적과 우선순위

| 화면 | 현재 구현 | 목적 | 우선순위 |
|---|---|---|---|
| Dashboard | 있음 | 내 활동 요약 | 보완 |
| My Sessions | 있음 | 내 기수/프로그램 세션 확인 | 유지 |
| My Attendance | 있음 | 출석 기록 확인 | 유지 |
| My Assignments | 있음 | 과제 확인과 제출 | 유지 |
| My Projects | 있음 | 내가 참여한 프로젝트 확인 | 유지/보완 |
| My Artifacts | 있음 | 내 산출물 관리 | 유지 |
| My Timeline | 있음 | 내 활동 타임라인 | 유지 |
| My Report | 있음 | 활동 요약 리포트 | 유지/보완 |
| Profile | 있음 | 본인 프로필 수정 | 유지 |
| My Studies | 없음 | 내가 참여한 스터디 확인 | 추가 |
| My Reflections | 없음 | 회고 작성과 조회 | 추가 |
| My Feedback | 없음/리포트 일부 | 공개된 피드백 확인 | 추가 |

### 9.3 Student MVP 보완

- My Reflections
- My Feedback
- My Studies
- Project artifact visibility 명확화
- Student report는 성장평가가 아니라 활동 요약으로 유지

## 10. Evaluation Surface

| 화면 | 현재 구현 | 목적 | 우선순위 |
|---|---|---|---|
| My Evaluation Assignments | 있음 | 본인에게 배정된 평가 목록 | 유지 |
| Application Evaluation | 있음 | 배정된 지원자 평가 작성 | 유지 |

접근 원칙:

- effective roles에 admin 또는 mentor가 있어야 한다.
- application 단위로 evaluation_assignments 소유권을 추가 확인한다.
- 배정되지 않은 지원자는 볼 수 없다.

## 11. 주요 사용자 여정

### 11.1 운영진: 회의 후 실행 관리

```text
회의 생성
→ 회의록 작성
→ 결정사항 기록
→ Action Item 생성
→ 담당자/마감일 지정
→ 작업 보드에서 추적
→ 완료/지연 상태 대시보드 확인
```

### 11.2 운영진: 행사 운영

```text
행사 생성
→ 체크리스트 적용
→ 담당자 배정
→ 참석자 관리
→ 출석 기록
→ 후속 액션 생성
→ 회계/정산 연결
```

### 11.3 멘토: 담당 팀 확인과 피드백

```text
Mentor Dashboard
→ My Teams
→ Project Status 확인
→ 최근 산출물 확인
→ 이전 피드백 확인
→ 짧은 피드백 작성
→ 운영진 지원 필요 시 요청
```

### 11.4 학생: 성장증거 확인

```text
Student Dashboard
→ My Projects / My Studies
→ 산출물 등록
→ 회고 작성
→ 공개된 피드백 확인
→ Timeline / Report에서 활동 요약 확인
```

## 12. Navigation 원칙

- 사용자별 workspace를 명확히 분리한다.
- Admin은 Core / Ops / Growth / Content / System으로 그룹화한다.
- Mentor는 평가보다 담당 팀/프로젝트 중심으로 설계한다.
- Student는 제출보다 성장증거 확인 중심으로 확장한다.
- 화면명은 기능명보다 사용자의 작업 목적을 반영한다.
- 세부 기능이 많아지는 Admin 영역은 좌측 메뉴 그룹화를 적용한다.

## 13. 현재 판단

현재 구현된 IA는 GrowthHub의 기반으로 활용 가능하다. 다만 Admin 기능이 한데 모여 있으므로 업무 영역별 재분류가 필요하고, Mentor와 Student 화면은 GrowthHub 관점에서 보완되어야 한다.

우선 보완할 화면은 다음이다.

1. Admin: Meetings, Tasks, Documents & Templates, Finance, Integrations, Audit Logs
2. Mentor: My Teams, Project Status, Feedback
3. Student: My Studies, My Reflections, My Feedback
4. Admin: Core/Ops/Growth/Content/System 메뉴 재분류

