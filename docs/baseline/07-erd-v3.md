# Seeds GrowthHub - 데이터 모델 및 ERD 상세 설계 v3

## 1. 문서 목적

이 문서는 Seeds GrowthHub의 데이터 모델, 도메인별 엔티티 구조, 엔티티 관계, 권한 scope, visibility, 상태값, 제약조건, 삭제/보관 정책, 추가 필요 테이블을 정의한다.

이 문서는 화면 구조나 사용자 여정을 다루지 않는다. 화면 구조는 **Seeds GrowthHub - IA 및 화면 구조 설계**에서 다룬다.

## 2. 현재 구현 기준선

현재 구현은 24개 테이블과 1개 헬퍼 함수를 가진다.

### 2.1 현재 구현 테이블 목록

| 도메인 | 테이블 |
|---|---|
| 사용자/인증 | users, account_activation_tokens, people_profiles |
| 지원/평가 | applications, evaluation_assignments, evaluations, interviews, decision_logs |
| 학생/기수/프로그램 | students, cohorts, programs, student_cohorts, student_programs |
| 활동 운영 | sessions, attendance_records, assignments, assignment_submissions, announcements |
| 활동 기록/성장증거 | activity_records, projects, project_members, artifacts, feedback, skill_tags, tag_mappings |
| 콘텐츠 | site_contents |

헬퍼:

- getEffectiveRoles
- canViewMemberContacts

## 3. 도메인 재분류

### 3.1 Core

현재 포함:

- users
- account_activation_tokens
- people_profiles
- students
- cohorts
- programs
- student_cohorts
- student_programs

추가 검토:

- role_assignments
- teams
- documents
- document_versions
- attachments
- audit_logs
- external_links

### 3.2 Ops

현재 포함:

- applications
- evaluation_assignments
- evaluations
- interviews
- decision_logs
- sessions
- attendance_records
- assignments
- assignment_submissions
- announcements
- site_contents

추가 필요:

- meetings
- tasks
- event_checklists
- finance_records
- communication_logs
- calendar_events

### 3.3 Growth

현재 포함:

- projects
- project_members
- artifacts
- feedback
- activity_records
- skill_tags
- tag_mappings

추가 필요:

- studies
- study_members
- reflections
- project_milestones
- project_status_checks

## 4. ERD 개관

```text
사용자 / 인증
  users ── (1:1 optional) ── people_profiles
   │
   └── (1:N) account_activation_tokens

지원 / 평가
  applications
   ├── (1:N) evaluation_assignments ── (N:1) users [evaluator]
   ├── (1:N) evaluations ── (N:1) users [evaluator]
   ├── (1:1) interviews
   └── (1:N) decision_logs

학생 / 기수 / 프로그램
  users ── (0..1:1) students
  students ── student_cohorts ── cohorts
  students ── student_programs ── programs
  cohorts ── (1:N) programs

운영 활동
  cohorts ── sessions ── attendance_records ── students
  cohorts ── assignments ── assignment_submissions ── students
  announcements → target_type / target_id

성장증거
  cohorts ── projects ── project_members ── students
  projects ── artifacts
  projects ── feedback
  students ── activity_records
  skill_tags ── tag_mappings ── polymorphic targets

추가 예정
  meetings ── tasks
  documents ── document_versions
  events/sessions ── event_checklists
  finance_records → linked_object
  external_links → linked_object
  communication_logs → linked_object
  studies ── study_members ── students
  reflections → polymorphic targets
  project_milestones ── projects
  project_status_checks ── projects
```

## 5. Core 엔티티

### 5.1 users

현재 유지.

주요 필드:

- id
- name
- email
- password_hash
- role
- extra_roles[]
- is_active
- created_at
- updated_at

정책:

- primary role + extra_roles를 합쳐 effective roles로 사용한다.
- 현재 구현의 admin은 시스템 권한 role이며 운영진 전체를 의미하지 않는다.
- 장기적으로 scope 기반 role_assignments 확장을 검토한다.

### 5.2 account_activation_tokens

현재 유지.

정책:

- plaintext token은 발급 시점에만 노출한다.
- DB에는 sha256 hash를 저장한다.
- 토큰은 기본 14일 유효하다.
- 재발급 시 기존 미사용 토큰은 사용 처리하는 latest-wins 정책을 따른다.

### 5.3 people_profiles

현재 유지.

정책:

- 공개 디렉터리와 개인 프로필의 기반이다.
- 비로그인 사용자는 phone이 null로 마스킹된다.
- 로그인 회원은 canViewMemberContacts 규칙에 따라 phone을 볼 수 있다.
- 학생 프로필은 student/profile 첫 GET 시 lazy-create된다.
- 멘토 프로필은 lazy-create하지 않고 admin이 사전 생성 후 user_id를 연결한다.

### 5.4 cohorts / programs

현재 유지.

주의:

- cohorts는 기수 단위다.
- programs는 현재 구현상 기수에 종속된 활동/트랙 단위다.
- 향후 성장모델·커리큘럼 정렬 과정에서 Curriculum Module, Track, Program 중 어떤 개념으로 재정의할지 검토한다.

### 5.5 students / student_cohorts / student_programs

현재 유지.

역할:

- 학생 계정과 지원서 전환 추적
- 기수/프로그램 소속 관리
- 출석, 과제, 프로젝트, 활동기록 연결의 기준

### 5.6 role_assignments

추가 검토.

목적:

현재 role + extra_roles만으로는 담당 기수, 담당 팀, 담당 프로젝트, 담당 회계 영역을 표현하기 어렵다.

필드 예시:

- id
- user_id
- role_code
- scope_type
- scope_id
- start_date
- end_date
- status

## 6. Ops 엔티티

### 6.1 applications

현재 유지.

주의:

- legacy status와 application_status의 이중 상태머신은 현재 구현 호환을 위해 유지한다.
- 장기적으로 단일화 검토 가능하다.

### 6.2 evaluation_assignments / evaluations

현재 유지.

정책:

- evaluator는 별도 role이 아니라 admin/mentor 중 배정된 사람이다.
- `(application_id, evaluator_id, stage)`는 unique해야 한다.
- 평가 조회는 role뿐 아니라 assignment 소유권을 확인해야 한다.
- evaluation upsert 시 해당 assignment를 completed 처리한다.

### 6.3 interviews

현재 유지.

확장 가능:

- 면접 슬롯
- 복수 면접자
- 캘린더 연동
- 안내 이력

### 6.4 decision_logs

현재 유지.

정책:

- append-only 감사 로그
- 삭제/수정 API 없음

### 6.5 sessions / attendance_records

현재 유지.

재해석:

- sessions는 정기모임, 워크숍, 멘토링, 발표회 등 Event 개념으로 확장 가능하다.

### 6.6 assignments / assignment_submissions

현재 유지.

정책:

- 학생은 published/closed 과제만 조회한다.
- closed 상태에서는 제출을 거부한다.
- 마감 후 제출은 late로 처리한다.

### 6.7 announcements

현재 유지.

정책:

- 학생은 published 상태이고 target이 all이거나 본인 cohort/program에 해당하는 공지만 본다.

### 6.8 meetings

추가 필요.

필드 예시:

- id
- title
- meeting_type
- meeting_date
- participants
- agenda_markdown
- decisions_markdown
- pending_items_markdown
- visibility
- created_by
- created_at
- updated_at

### 6.9 tasks

추가 필요.

필드 예시:

- id
- title
- description
- source_type
- source_id
- assignee_id
- due_date
- priority
- status
- linked_object_type
- linked_object_id
- created_by

상태값:

- todo
- in_progress
- review
- blocked
- done
- canceled

### 6.10 documents / document_versions

추가 필요.

필드 예시:

- id
- title
- document_type
- body_markdown
- owner_id
- linked_object_type
- linked_object_id
- visibility
- is_template
- status
- created_at
- updated_at

versions:

- id
- document_id
- version_number
- body_markdown
- changed_by
- change_note
- created_at

### 6.11 finance_records

추가 필요.

필드 예시:

- id
- record_type
- amount
- category
- date
- description
- receipt_url
- requester_id
- approver_id
- status
- linked_object_type
- linked_object_id
- created_at

상태값:

- draft
- requested
- under_review
- approved
- paid
- rejected
- canceled

### 6.12 communication_logs

추가 필요.

필드 예시:

- id
- recipient_type
- recipient_id
- channel
- template_id
- related_object_type
- related_object_id
- sent_at
- status
- failure_reason
- created_by

## 7. Growth 엔티티

### 7.1 projects / project_members

현재 유지.

추가 필요:

- project_milestones
- project_status_checks
- mentor linkage 명확화
- blocker / next_focus 관리

### 7.2 artifacts

현재 유지.

visibility:

- private
- student_visible
- cohort_visible
- admin_only

### 7.3 feedback

현재 유지.

visibility:

- student_visible
- admin_only

추가 검토:

- mentor_visible
- team_visible
- author_only

### 7.4 activity_records

현재 유지.

정책:

- 자동 생성 기록과 수동 기록의 기준을 정해야 한다.
- 성장평가가 아니라 활동 타임라인과 증거 기록으로 사용한다.

### 7.5 skill_tags / tag_mappings

현재 유지하되 재해석.

정책:

- 최종 역량 태그가 아니라 임시 분류 태그로 사용한다.
- 성장모델 확정 후 태그 체계를 재정의할 수 있다.

### 7.6 studies / study_members

추가 필요.

### 7.7 reflections

추가 필요.

visibility 검토:

- private
- mentor_visible
- team_visible
- student_visible
- admin_only

### 7.8 project_milestones

추가 필요.

### 7.9 project_status_checks

추가 필요.

상태값:

- good
- watch
- risk
- blocked

## 8. 권한 Scope 정책

권한은 role만으로 충분하지 않다. role + scope로 접근을 판단한다.

예시:

```text
mentor + project_id
recruiting_lead + recruitment_id
finance_lead + cohort_id
student + own_student_id
admin + global
```

Scope 유형 후보:

- global
- cohort
- program
- project
- study
- recruitment
- application
- finance_record
- document

## 9. Visibility 및 학생 접근 규칙

| 객체 | visibility 후보 |
|---|---|
| artifact | private / student_visible / cohort_visible / admin_only |
| feedback | student_visible / admin_only / mentor_visible 검토 |
| reflection | private / mentor_visible / team_visible / admin_only 검토 |
| document | private / team_visible / cohort_visible / admin_only / public 검토 |
| activity_record | private / student_visible / admin_only |
| finance_record | finance_only / admin_only 검토 |

학생 접근 규칙:

| 영역 | 조건 |
|---|---|
| student/timeline | studentId=me AND visibility=student_visible |
| student/artifacts | 본인 산출물 중 admin_only 제외 + 참여 프로젝트의 student_visible/cohort_visible + 같은 cohort 프로젝트의 cohort_visible |
| student/projects/:id | project_members에 포함된 경우만 |
| student/projects/:id artifacts | 본인 소유 중 admin_only 제외 + 타 멤버의 student_visible/cohort_visible. private은 노출하지 않음 |
| student/report.feedbackHighlights | visibility=student_visible AND studentId=me |
| student/assignments | published 또는 closed이고 본인 cohort/program 범위 |
| student/announcements | published이고 target이 all 또는 본인 cohort/program |

## 10. 유일제약 및 인덱스 요약

| 테이블 | 제약 |
|---|---|
| users | email UNIQUE |
| students | user_id UNIQUE, application_id UNIQUE |
| people_profiles | user_id UNIQUE, student_id UNIQUE, INDEX(kind, display_order) |
| student_cohorts | (student_id, cohort_id) UNIQUE |
| student_programs | (student_id, program_id) UNIQUE |
| attendance_records | (session_id, student_id) UNIQUE |
| assignment_submissions | (assignment_id, student_id) UNIQUE |
| evaluation_assignments | (application_id, evaluator_id, stage) UNIQUE |
| evaluations | (application_id, evaluator_id, stage) UNIQUE |
| interviews | application_id UNIQUE |
| project_members | (project_id, student_id) UNIQUE |
| skill_tags | name UNIQUE |
| tag_mappings | (tag_id, target_type, target_id) UNIQUE |
| site_contents | key UNIQUE |
| account_activation_tokens | INDEX(token_hash), INDEX(user_id) |

## 11. ON DELETE 정책 요약

| 부모 → 자식 | 동작 |
|---|---|
| users → students | CASCADE |
| users → people_profiles.user_id | SET NULL |
| users → evaluation_assignments.evaluator_id | CASCADE |
| users → created_by / marked_by / assigned_by / reviewed_by / changed_by / author_id | SET NULL |
| applications → students.application_id | SET NULL |
| applications → evaluation_assignments, evaluations, interviews, decision_logs | CASCADE |
| cohorts → programs, sessions, assignments, student memberships, activity_records, projects | CASCADE |
| programs → sessions.program_id 등 | SET NULL |
| students → attendance_records, assignment_submissions, activity_records, project_members | CASCADE |
| projects → project_members | CASCADE |
| projects → artifacts.project_id | SET NULL |
| skill_tags → tag_mappings | CASCADE |
| feedback.target_id / tag_mappings.target_id / activity_records.source_id | FK 없음. 앱 레벨 정합성 보장 |

## 12. Polymorphic 관계 정책

현재 구현에는 feedback.target_id, tag_mappings.target_id, activity_records.source_id처럼 polymorphic id가 있다.

장점:

- 유연함
- 다양한 객체에 피드백/태그/활동기록 연결 가능

약점:

- DB 레벨 FK 무결성 보장이 어려움
- 앱 레벨 검증 필요
- 삭제 시 orphan 데이터 발생 가능성

정책:

- target_type 화이트리스트를 유지한다.
- 생성 시 앱 레벨에서 대상 객체 존재를 검증한다.
- 삭제/보관 정책을 명확히 한다.
- 중요 객체는 soft delete 또는 archive를 우선 검토한다.

## 13. 삭제/보관 정책

| 객체 | 권장 정책 |
|---|---|
| users | 비활성화 우선 |
| applications | 삭제보다 archive 권장 |
| evaluations | 삭제 금지 또는 관리자 제한 |
| decision_logs | 삭제 금지 |
| finance_records | 삭제보다 취소/반려 상태 권장 |
| documents | archive + version 유지 |
| projects | archive |
| artifacts | visibility 변경 또는 archive |
| feedback | 삭제 제한, 필요 시 archive |
| reflections | 작성자 삭제/비공개 권한 검토 필요 |

## 14. 외부 연계 관련 데이터 객체 후보

| 객체 | 목적 |
|---|---|
| external_links | 외부 URL과 연결 객체 관리 |
| attachments | 업로드 파일 메타데이터 |
| integration_accounts | 외부 계정 연동 정보 |
| communication_logs | Email/SMS 발송 이력 |
| sync_logs | API sync 성공/실패 이력 |
| calendar_events | GrowthHub 내부 일정 |

## 15. 현재 판단

현재 구현의 데이터 모델은 GrowthHub 기반으로 활용 가능성이 높다.

유지할 핵심:

1. users.role + extra_roles
2. evaluator surface의 assignment 기반 접근
3. cohorts / programs / students
4. sessions / attendance / assignments / announcements
5. projects / artifacts / feedback / activity_records / tags
6. visibility 기반 접근 제어

추가할 핵심:

1. meetings
2. tasks
3. documents / document_versions
4. finance_records
5. studies / study_members
6. reflections
7. project_milestones
8. project_status_checks
9. audit_logs
10. external_links / attachments / communication_logs
11. 장기적으로 role_assignments

