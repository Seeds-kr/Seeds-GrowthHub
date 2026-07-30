# Seeds GrowthHub - Core 기반 구조 명세 v2

## 1. 문서 목적

이 문서는 GrowthHub Core의 공통 기반 구조를 정의한다. Core는 운영 시스템과 성장 시스템이 공유하는 기반 계층이며, 사람, 역할, 권한, 기수, 팀, 문서, 데이터 객체, 외부 연동, 가시성, 저장 전략을 포함한다.

이 문서는 현재 Replit 구현을 완전히 대체하는 이상적 설계가 아니라, 현재 구현을 기준선으로 삼아 유지할 것, 보완할 것, 추가할 것을 정리한다.

## 2. 현재 구현 기준선

현재 구현에는 다음 Core 관련 구조가 이미 존재한다.

| 구현 요소 | 현재 판단 |
|---|---|
| users.role + users.extra_roles[] | 유지. 다중 역할 구조와 부합 |
| effective roles | 유지. role과 extra_roles를 합산한 접근 제어에 적합 |
| admin / mentor / student 역할 | 유지. 단, 운영진 세부 역할은 확장 필요 |
| evaluator surface | 유지. 별도 역할이 아니라 접근 제어된 서브 태스크로 보는 것이 적절 |
| people_profiles | 유지. 공개 디렉터리와 개인 프로필 기반 |
| cohorts / programs / students | 유지. 다만 programs의 의미는 향후 재정의 가능 |
| visibility 기반 접근 제어 | 유지. 산출물/피드백/회고로 확장 필요 |

## 3. Core의 책임

GrowthHub Core는 다음을 책임진다.

- 사용자와 프로필 관리
- 다중 역할 관리
- 역할 기반 권한과 범위 기반 권한 관리
- 기수, 프로그램, 팀, 프로젝트의 기본 연결 구조
- 운영 시스템과 성장 시스템이 공유하는 객체 구조
- 문서와 템플릿 관리의 기반
- 외부 도구 링크와 파일 저장 전략
- 민감정보 가시성 정책
- 활동 로그와 감사 이력

## 4. 핵심 설계 원칙

### 4.1 Core는 공통 기반 계층이다

Core는 운영 시스템과 성장 시스템과 동급의 하위 시스템이 아니라, 두 시스템이 공유하는 기반 계층이다.

```text
Seeds GrowthHub
├─ Core 기반 계층
├─ 운영 시스템
└─ 성장 시스템
```

### 4.2 한 사람은 여러 역할을 가질 수 있다

Seeds에서는 한 사람이 학생이면서 운영진일 수 있고, 멘토가 평가자로 참여할 수 있으며, 학생 출신이 운영진이 될 수 있다.

따라서 사용자 구조는 다음 관점을 유지한다.

```text
User
→ primary role
→ extra roles
→ effective roles
→ scope-based permissions
```

### 4.3 Role-Based Access + Scope-Based Access를 함께 사용한다

단순히 role만으로 접근 권한을 판단하면 부족하다. Seeds에서는 “어떤 역할인가”뿐 아니라 “어떤 범위에서 그 역할을 갖는가”가 중요하다.

예시:

- 멘토는 모든 학생이 아니라 담당 팀/프로젝트/학생만 본다.
- 평가자는 자신에게 배정된 지원자만 본다.
- 운영진은 전체 운영진일 수 있지만, 회계나 평가정보는 담당자 중심으로 제한한다.
- 학생은 본인 데이터와 공개된 팀/기수 정보를 중심으로 본다.

## 5. 핵심 객체 관계 요약

### 5.1 사용자/역할 관계

```text
users
  ├─ primary role
  ├─ extra_roles[]
  └─ people_profiles

users / people_profiles
  → role assignments or effective roles
  → scoped access
```

현재 구현에는 별도 role_assignments 테이블은 없다. 단기적으로는 `role + extra_roles`를 유지하되, 장기적으로는 기수/팀/프로젝트/운영 역할 범위를 표현하기 위해 scope 기반 role assignment 확장을 검토한다.

### 5.2 기수/프로그램/학생 관계

```text
cohorts
  ├─ programs
  ├─ student_cohorts
  ├─ sessions
  ├─ assignments
  └─ projects

students
  ├─ student_cohorts
  ├─ student_programs
  ├─ attendance_records
  ├─ assignment_submissions
  ├─ activity_records
  └─ project_members
```

### 5.3 운영 객체 관계

```text
meetings
  └─ tasks / action items

tasks
  → source_type / source_id
  → linked_object_type / linked_object_id

sessions / events
  ├─ attendance_records
  ├─ documents / checklists
  └─ finance_records
```

회의록, 작업관리, 회계, 운영 문서는 현재 구현에 부족하므로 추가가 필요하다.

### 5.4 성장 객체 관계

```text
projects
  ├─ project_members
  ├─ artifacts
  ├─ feedback
  ├─ activity_records
  ├─ project_milestones
  └─ project_status_checks

students
  ├─ artifacts
  ├─ feedback
  ├─ reflections
  └─ activity_records
```

현재 구현의 projects, project_members, artifacts, feedback, activity_records, skill_tags, tag_mappings는 유지할 가치가 있다. 다만 reflections, studies, project_status_checks, project_milestones는 추가 필요성이 있다.

## 6. 권한 구조

### 6.1 기본 역할

| 역할 | 설명 |
|---|---|
| admin | 전체 관리자 권한. 현재 구현에 존재 |
| mentor | 멘토. 프로필 관리와 평가 surface 참여 가능 |
| student | 학생. 본인 활동과 제출 중심 접근 |
| 운영진 세부 역할 | Program Lead, Ops, Recruiting, Finance, Growth, System 등. 현재 구현에서는 admin 또는 extra role로 확장 필요 |
| evaluator surface | 별도 role이 아니라 배정 기반 접근 surface |

### 6.2 권한 원칙

| 원칙 | 설명 |
|---|---|
| 최소 필요 접근 | 역할 수행에 필요한 정보만 접근 |
| scope 기반 제한 | 담당 기수, 팀, 프로젝트, 평가 배정 범위 기준 접근 |
| 민감정보 제한 | 평가, 회계, 멘토 피드백, 회고는 기본 제한 |
| 감사 가능성 | 민감정보 변경과 주요 상태 변경은 로그화 |
| 학생 자기정보 접근 | 학생은 본인 관련 공개 가능 정보 중심 접근 |

### 6.3 권한 매트릭스 초안

| 정보/기능 | Admin | 운영진 | 회계담당 | 멘토 | 학생 | 평가 surface |
|---|---:|---:|---:|---:|---:|---:|
| 사용자 기본정보 | 전체 | 제한 | 제한 | 담당 범위 | 본인 | 배정 범위 |
| 기수/프로그램 | 전체 | 역할 범위 | 조회 | 담당 범위 | 본인 기수 | 제한 |
| 지원서 | 전체 | 모집 담당 | 없음 | 배정 시 | 없음 | 배정 대상 |
| 평가 결과 | 전체 | 모집 담당 | 없음 | 본인 평가 | 없음 | 본인 평가 |
| 회계 정보 | 전체 | 제한 | 전체 | 없음 | 없음 | 없음 |
| 회의록 | 전체 | 역할 범위 | 회계 관련 | 제한 | 없음 | 없음 |
| 작업 | 전체 | 역할 범위 | 회계 관련 | 담당 팀 관련 | 본인 관련 | 없음 |
| 프로젝트 | 전체 | 전체/역할 범위 | 제한 | 담당 팀 | 본인 팀 | 없음 |
| 피드백 | 전체/제한 | 성장 담당 | 없음 | 담당 범위 | 공개된 본인 피드백 | 없음 |
| 회고 | 전체/제한 | 성장 담당 | 없음 | 공개 범위 내 | 본인 | 없음 |

## 7. 민감정보와 가시성 정책

### 7.1 민감정보 유형

| 정보 | 민감도 | 기본 접근 원칙 |
|---|---|---|
| 지원서 | 높음 | 모집 담당과 배정 평가자 중심 |
| 서류/면접 평가 | 높음 | 모집 담당, 운영 총괄, 해당 평가자 |
| 불합격 사유 | 높음 | 최소 접근 |
| 회계 증빙 | 높음 | 회계담당자, 운영 총괄 중심 |
| 멘토 피드백 | 중~높음 | 담당 멘토, 성장 담당 중심 |
| 학생 개인 회고 | 중~높음 | 학생 선택 또는 정책 기반 공개 |
| 팀 리스크 | 중~높음 | 담당 멘토, Growth/Ops 담당 중심 |
| 운영진 내부 회의록 | 중~높음 | 운영진 내부 중심 |

### 7.2 현재 구현 visibility 반영

현재 구현의 visibility 정책은 유지하되 확장한다.

| 객체 | 현재/권장 visibility |
|---|---|
| artifacts | private / student_visible / cohort_visible / admin_only |
| feedback | student_visible / admin_only |
| activity_records | private / student_visible / admin_only |
| reflections | private / mentor_visible / student_visible / admin_only 검토 |
| documents | private / team_visible / cohort_visible / admin_only / public 검토 |

## 8. 문서/템플릿 관리 기반

### 8.1 기본 판단

GrowthHub 내부 운영 문서는 Markdown 기반으로 관리한다.

Markdown을 source of truth로 두는 이유:

- 운영진이 빠르게 작성·수정 가능
- 버전 이력 관리가 쉬움
- 템플릿화가 쉬움
- 체크리스트와 결합 가능
- 시스템 내부 렌더링이 쉬움
- 필요 시 PDF/DOCX export 가능

### 8.2 Core에서 관리할 문서 객체

Core는 문서 기능의 기반을 제공한다.

필요 객체:

- documents
- document_versions
- document_templates
- document_links
- attachments

필드 예시:

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

### 8.3 DOCX 원칙

DOCX 편집기를 MVP에 포함하지 않는다.

- 내부 운영 문서: Markdown
- 외부 제출용 문서: DOCX/PDF 첨부 또는 export
- 공식 서식 문서: Google Drive 또는 파일 첨부 가능

## 9. 파일 저장 전략

### 9.1 권장 구조

초기에는 Hybrid 전략이 적절하다.

| 자료 유형 | 저장 위치 |
|---|---|
| 운영 문서 본문 | GrowthHub DB, Markdown |
| 문서 버전 | GrowthHub 내부 version history |
| 체크리스트/템플릿 | GrowthHub 내부 |
| 영수증/이미지/첨부파일 | object storage |
| 기존 Google Drive 자료 | GrowthHub에 링크로 연결 |
| 외부 제출용 공식 문서 | Google Drive 또는 DOCX/PDF 첨부 |

### 9.2 핵심 원칙

GrowthHub가 관리해야 하는 것은 파일 자체만이 아니라 맥락이다.

모든 파일/외부 문서에는 다음 메타데이터가 필요하다.

- 문서명
- 문서 유형
- 연결 객체: 기수, 행사, 회의, 프로젝트, 모집, 회계 등
- 소유자
- 공개 범위
- 최신 여부
- 파일 URL 또는 외부 링크

## 10. 외부 연동 기본 원칙

| 도구 | Core 차원의 원칙 |
|---|---|
| GitHub | repo, PR, release, demo 링크 중심. 지표는 평가가 아니라 대화 신호 |
| Discord | 실시간 대화는 외부 유지. 공지/채널 링크와 주요 맥락만 연결 |
| Google Drive | 기존 자료와 외부 공유용 문서 보관. GrowthHub에는 링크와 메타데이터 저장 |
| Calendar | 주요 운영 일정 export/연동 가능성 열어둠 |
| Email/SMS | 모집, 평가, 행사, 중요 공지의 발송 이력 관리 |

## 11. 추가 필요 데이터 객체

Core 관점에서 추가 또는 확장 검토가 필요한 객체는 다음이다.

| 객체 | 성격 |
|---|---|
| role_assignments | 장기적으로 scope 기반 역할 부여를 위해 검토 |
| documents | Markdown 문서 본문 |
| document_versions | 문서 버전 이력 |
| attachments | 파일 첨부 메타데이터 |
| audit_logs | 민감정보 변경과 주요 상태 변경 기록 |
| teams | 현재 project_members는 있으나, 팀 자체 객체가 필요한지 검토 |

## 12. 현재 판단

Core v2의 핵심 판단은 다음이다.

1. 현재 구현의 users.role + extra_roles 구조는 유지한다.
2. 장기적으로 scope 기반 role assignment를 검토한다.
3. Core는 운영·성장 시스템의 공통 기반 계층이다.
4. visibility와 민감정보 접근 정책은 초기부터 명확히 해야 한다.
5. 문서 본문은 Markdown을 GrowthHub 내부 source of truth로 둔다.
6. Google Drive는 대체하지 않고, 기존 자료와 외부 공유용 저장소로 활용한다.
7. 파일 자체보다 연결 맥락과 권한 메타데이터를 관리한다.

