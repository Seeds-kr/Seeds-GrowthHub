# 설계 00 — GrowthHub 완성 형상

> **전부 만들면 어떤 모습이 되는가.** 이 문서는 개별 명세(01~05)를 하나의 그림으로 합친 목표 상태다.
> 선행: [`../baseline/`](../baseline/) 11종 · [`../visibility-policy.md`](../visibility-policy.md)
> 하위: [01 권한](01-role-permissions.md) · [02 멘토](02-mentor-workspace.md) · [03 성장증거](03-growth-evidence.md) · [04 Core 인프라](04-core-infra.md) · [05 제품 경험](05-product-experience.md)

---

## 1. 한 장 요약

| 축 | 현재 | 완성 | 증가 |
|---|---:|---:|---:|
| 데이터 테이블 | **40** | **41** | +1 |
| 화면(라우트) | **69** | **~78** | +9 |
| 빈 placeholder 화면 | **8** | **0** | −8 |
| 워크스페이스 | 4 | 4 | — |
| 운영진 기능 역할 | 7 | 7 | — |

**한 문장:** 운영진 7개 역할이 각자 필요한 것만 보면서 Seeds를 굴리고, 멘토는 담당 팀을 30초 만에 파악해 짧게 피드백하고, 학생은 자기 성장 흔적이 쌓이는 걸 스스로 본다 — 그리고 그 어느 것도 점수가 되지 않는다.

```mermaid
graph TB
    subgraph PUB["Public Site"]
        P1["소개 · 모집 · 지원 · 사람들"]
    end

    subgraph CORE["Core 기반 계층"]
        C1["사람 · 역할 · 권한"]
        C2["기수 · 프로그램 · 팀"]
        C3["문서 · 첨부 · 외부링크"]
        C4["가시성 · 감사"]
    end

    subgraph OPS["운영 시스템 (Ops)"]
        O1["회의 → 액션"]
        O2["모집 · 평가 · 면접"]
        O3["행사 · 출석"]
        O4["회계 · 정산"]
        O5["공지 · 발송이력"]
        O6["운영 대시보드"]
    end

    subgraph GROW["성장 시스템 (Growth)"]
        G1["프로젝트 · 마일스톤"]
        G2["스터디"]
        G3["산출물"]
        G4["피드백 · 팀 상태체크"]
        G5["회고"]
        G6["활동 타임라인"]
    end

    PUB --> CORE
    CORE --> OPS
    CORE --> GROW
    OPS -. "지원 요청 · 개입 타이밍" .-> GROW
    GROW -. "팀 상태 신호" .-> OPS

    style CORE fill:#e8f5e9,stroke:#2e7d32
    style OPS fill:#e3f2fd,stroke:#1565c0
    style GROW fill:#fff3e0,stroke:#ef6c00
    style PUB fill:#f5f5f5,stroke:#757575
```

Core는 Ops·Growth와 동급 하위 시스템이 아니라 **둘이 딛고 서는 바닥**이다. Ops와 Growth는 서로를 호출하지 않고 **신호만 주고받는다** — 팀 상태체크가 운영 대시보드에 뜨고, 운영진 지원이 팀으로 간다.

---

## 2. 완성 시 사용자 경험

### 2.1 학생

```mermaid
journey
    title 학생의 한 기수
    section 진입
      지원서 제출: 3: 학생
      합격 · 매직링크로 계정 활성화: 5: 학생
    section 활동
      세션 참여 · 출석: 4: 학생
      과제 제출: 3: 학생
      프로젝트 · 스터디 참여: 5: 학생
      산출물 등록: 4: 학생
    section 성찰
      회고 작성 (공개범위 직접 선택): 5: 학생
      멘토 피드백 확인: 5: 학생
      내 타임라인 · 리포트 확인: 4: 학생
```

**완성 시 학생이 갖는 것**

| 화면 | 무엇을 보는가 |
|---|---|
| Dashboard | 이번 주 세션·마감 과제·새 피드백 |
| My Projects / My Studies | 참여 중인 팀, 마일스톤, 팀 산출물 |
| My Artifacts | 내가 만든 것 전부 — 포트폴리오의 원자료 |
| **My Reflections** | 내 회고. **공개 범위를 내가 정하고 언제든 되돌린다** |
| **My Feedback** | 나에게 공개된 피드백만 |
| My Timeline / Report | 활동 요약 — **평가가 아니라 기록** |

**학생이 절대 보지 않는 것:** 팀 상태체크(`risk`/`blocked` 판정), 운영진 회의록, 회계, 다른 학생의 `private` 산출물, 지원자 평가 결과.

### 2.2 멘토

```mermaid
flowchart LR
    A["Dashboard<br/>담당 팀 3개<br/>상태체크 2건 필요"] --> B["My Teams"]
    B --> C["Project Detail"]
    C --> D["상태체크 30초<br/>버튼 1개 + 체크박스"]
    C --> E["피드백 작성"]
    D -->|needsOpsSupport| F["운영 대시보드<br/>지원 필요 위젯"]
    C --> G["이전 피드백 타임라인<br/>(전임 멘토 것 포함)"]
    style D fill:#fff3e0,stroke:#ef6c00
    style F fill:#e3f2fd,stroke:#1565c0
```

**핵심은 입력 최소화다.** 멘토에게 요구하는 정기 입력은 상태체크 하나뿐이고, 필수 항목은 상태 버튼 4개 중 1개 + 지원필요 체크박스뿐이다. 나머지는 전부 선택.

담당 팀에 달린 피드백은 **작성자·유형·visibility 무관 전부** 보인다(ADR-004). 멘토가 교체돼도 맥락이 끊기지 않는다.

### 2.3 운영진 — 7개 역할

```mermaid
graph TD
    PL["총괄 · program_lead<br/>아래 전부를 포함"]
    PL --> OPS["운영 · ops<br/>회의 · 작업 · 행사 · 문서"]
    PL --> REC["모집 · recruiting 🔒<br/>지원자 · 평가 · 면접 · 결정"]
    PL --> FIN["회계 · finance 🔒<br/>정산 · 증빙"]
    PL --> GRW["성장경험 · growth<br/>프로젝트 · 스터디 · 피드백"]
    PL --> COM["커뮤니티 · community<br/>공지 · 디렉터리 · 콘텐츠"]
    PL --> SYS["시스템 · system 🔒<br/>계정 · 역할 · 감사"]
    style PL fill:#e8f5e9,stroke:#2e7d32
    style REC fill:#ffebee,stroke:#c62828
    style FIN fill:#ffebee,stroke:#c62828
    style SYS fill:#ffebee,stroke:#c62828
```

🔒 = **제한 열람.** 담당자 + 총괄만. 그 외 관리자 화면은 모든 운영진이 읽는다(운영 투명성 우선).

**완성 시 실제 장면**

> 새로 합류한 회계 담당이 `/admin`에 로그인한다. 사이드바에 **재정**은 보이지만 **모집**과 **감사 로그**는 아예 없다. 회의록·작업·행사·프로젝트는 다 읽을 수 있어서 지금 Seeds가 어떻게 돌아가는지 파악할 수 있다. 정산 화면에서 영수증을 열면 인증 게이트를 지나 서명된 파일이 뜬다. 그가 지원자 명단을 보려 URL을 직접 쳐도 403이다.

**운영 대시보드**가 이 역할들의 접점이다 — 지연 작업, 행사 준비율, 미정산, 평가 진행률, 갱신 필요 문서, 그리고 **팀 지원 필요**(멘토가 올린 신호).

### 2.4 지원자 / 외부

공개 사이트는 지금과 같다. 지원 → 서류 평가 → 면접 → 최종 결정 → 매직링크 활성화 흐름이 그대로 유지되고, 각 단계 발송 이력이 `communication_logs`에 남는다.

---

## 3. 전체 IA

범례: ✅ 구현됨 · 🟡 설계 완료(미구현) · ⬜ 빈 placeholder(실체화 필요) · ❌ 만들지 않음

### 3.1 Public Site — 12 화면, 전부 완성

```text
✅ / · /about · /program · /faq · /recruit
✅ /apply · /apply/success
✅ /people · /people/:kind/:id  (레거시 /mentors · /staff · /members)
✅ /login · /admin/login · /student/login
✅ /activate/:token
```

### 3.2 Admin Workspace

```text
Home
  ✅ /admin                          대시보드

Core · 코어
  ✅ /admin/users                    사용자 + 기능 역할 편집
  ✅ /admin/people                   사람들 프로필
  ✅ /admin/roles                    역할 & 권한 개요
  ✅ /admin/cohorts                  기수
  ✅ /admin/programs                 프로그램
  ⬜ /admin/members                  통합 회원 명부

Ops · 운영
  ✅ /admin/meetings[/:id]           회의록 → 액션 생성
  ✅ /admin/tasks                    운영 작업 칸반
  ✅ /admin/documents[/:id]          Markdown 문서 + 버전 + 템플릿
  ✅ /admin/applications[/:id]       🔒 모집
  ✅ /admin/evaluators               평가 담당자 풀
  ⬜ /admin/interviews               🔒 면접 일정 통합 뷰
  ✅ /admin/sessions[/:id][/attendance]  행사/세션
  ⬜ /admin/attendance               출석 집계
  ✅ /admin/assignments[/:id]        학생 과제
  ✅ /admin/announcements            공지
  ✅ /admin/finance                  🔒 회계
  ✅ /admin/ops-dashboard            운영 대시보드
  🟡 /admin/communications           🔒 발송 이력

Growth · 성장
  ✅ /admin/students[/:id][/timeline][/report]
  ✅ /admin/projects[/:id]           + 담당 멘토 · 마일스톤 · 상태체크 이력
  ✅ /admin/studies                  스터디
  🟡 /admin/team-status              전체 팀 상태 보드
  ✅ /admin/activity-records
  ✅ /admin/artifacts
  ✅ /admin/feedback
  ❌ /admin/reflections              ← 만들지 않음 · placeholder 제거 완료 (§3.6)
  ✅ /admin/tags                     임시 분류 태그
  ⬜ /admin/reports                  리포트 인덱스

Content · 콘텐츠
  ✅ /admin/site-content
  ⬜ /admin/public-pages
  🟡 /admin/media                    첨부 + 외부링크 통합

System · 시스템
  ⬜ /admin/integrations             외부 연동 링크 맵
  ✅ /admin/audit-logs               🔒 감사 로그
  ⬜ /admin/settings
```

### 3.3 Mentor Workspace — 현재 2 → 완성 7

```text
✅ /mentor                  Dashboard (담당 팀 요약으로 보완)
✅ /mentor/teams            My Teams
✅ /mentor/projects/:id     Project Detail + 상태체크 + 피드백
✅ /mentor/feedback         내 피드백 이력
✅ /evaluator[/applications/:id]   평가 표면 (별개 축)
✅ /mentor/profile
✅ /people                  디렉터리
```

### 3.4 Student Workspace — 현재 10 → 완성 14

```text
✅ /student                     Dashboard
✅ /student/sessions · /attendance · /assignments[/:id] · /announcements
✅ /student/projects[/:id] · /artifacts · /timeline · /report · /profile
✅ /student/studies             My Studies
✅ /student/reflections         My Reflections (공개범위 선택)
✅ /student/feedback            My Feedback
```

### 3.5 Evaluation Surface — 완성

역할이 아니라 **배정 기반 표면**이다. `requireAdminOrMentor` + 지원서 단위 소유권 재확인. `recruiting` 기능 역할과 **독립** — 배정받은 멘토는 기능 역할 없이 평가한다.

### 3.6 만들지 않기로 한 화면

| 화면 | 이유 |
|---|---|
| `/admin/reflections` | **ADR-001.** 운영진 회고 일괄 조회 경로를 만들지 않는 것이 "회고는 평가에 쓰이지 않는다"의 구조적 보장이다. **W6에서 nav placeholder를 제거 완료** — 이제 코드에 회고 관련 admin 경로가 존재하지 않는다 |
| 학생용 팀 상태 화면 | 팀이 `risk`로 표시된 것을 학생이 보면 신호가 아니라 낙인이 된다 |
| 멘토 활동량 집계 | 감시로 읽힌다 |
| DOCX 내장 편집기 | Markdown이 source of truth |

---

## 4. 전체 데이터 모델 — 41 테이블

### 4.1 도메인 분포

| 도메인 | 현재 | 신규 | 완성 |
|---|---:|---:|---:|
| Core (사용자·기수·문서·인프라) | 14 | +3 | 17 |
| Ops (모집·행사·회계·공지) | 10 | +1 | 11 |
| Growth (프로젝트·성장증거) | 7 | +6 | 13 |
| **합계** | **31** | **+10** | **41** |

### 4.2 Core

```mermaid
erDiagram
    users ||--o| people_profiles : "1:1 optional"
    users ||--o{ account_activation_tokens : issues
    users ||--o| students : "0..1"
    students }o--o{ cohorts : student_cohorts
    students }o--o{ programs : student_programs
    cohorts ||--o{ programs : contains
    documents ||--o{ document_versions : "append-only"
    users ||--o{ audit_logs : "actor"

    users {
        text role "admin|mentor|student"
        text_array extra_roles "워크스페이스 축"
        text_array ops_roles "기능 축 NEW"
    }
    documents {
        text content_md "source of truth"
        bool is_template
        text visibility
    }
    audit_logs {
        text action "NEW"
        jsonb before_json "변경 필드만"
    }
    attachments {
        text file_url "NEW 인증 게이트"
        text linked_object_type
    }
    external_links {
        text url "NEW"
        text link_type
    }
```

신규 3: `audit_logs`, `attachments`, `external_links`.

### 4.3 Ops

```mermaid
erDiagram
    applications ||--o{ evaluation_assignments : "배정"
    applications ||--o{ evaluations : "평가"
    applications ||--o| interviews : "1:1"
    applications ||--o{ decision_logs : "append-only"
    applications ||--o| students : "합격 전환"
    meetings ||--o{ ops_tasks : "회의 → 액션"
    cohorts ||--o{ sessions : "행사"
    sessions ||--o{ attendance_records : "출석"
    cohorts ||--o{ assignments : "과제"
    assignments ||--o{ assignment_submissions : "제출"
    users ||--o{ communication_logs : "발송"

    ops_tasks {
        text status "6단계"
        int source_meeting_id
        text linked_object_type
    }
    finance_records {
        text status "7단계"
        text receipt_url "→ attachments 이관"
    }
    communication_logs {
        text channel "NEW email|sms|discord|manual"
        text status
    }
```

신규 1: `communication_logs`.

### 4.4 Growth

```mermaid
erDiagram
    projects ||--o{ project_members : "학생"
    projects ||--o{ project_mentors : "멘토 NEW"
    projects ||--o{ project_milestones : "NEW"
    projects ||--o{ project_status_checks : "NEW append-only"
    projects ||--o{ artifacts : "산출물"
    studies ||--o{ study_members : "NEW"
    studies ||--o{ artifacts : "NEW study_id"
    students ||--o{ reflections : "NEW 본인 소유"
    students ||--o{ activity_records : "타임라인"
    skill_tags ||--o{ tag_mappings : "임시 분류"

    project_mentors {
        int mentor_user_id "users 참조"
        text status "active|ended"
    }
    project_status_checks {
        text team_status "good|watch|risk|blocked"
        bool needs_ops_support "→ 운영 대시보드"
        text visibility "학생 노출 없음"
    }
    reflections {
        text visibility "학생이 선택"
        text content_md
    }
```

신규 6: `project_mentors`, `project_milestones`, `project_status_checks`, `studies`, `study_members`, `reflections`.

### 4.5 완성 후에도 만들지 않는 테이블

| 테이블 | 판단 |
|---|---|
| `role_assignments` | 보류. `ops_roles`는 scope가 없어 "3기 담당 회계"를 표현 못 한다. 그 요구가 실제로 생기면 도입 |
| `calendar_events` | 범위 제외. `sessions` + `ops_tasks.dueDate`가 이미 그 역할 |
| `teams` | `projects` + `project_members` 조합으로 충분 |
| `event_checklists` | `documents`(체크리스트 문서)를 세션에 연결해 흡수 |
| `sync_logs` / `integration_accounts` | 링크 기반 연동 유지. API 연동 확정 시 |

---

## 5. 권한 최종 형상

### 5.1 2축 모델

```mermaid
graph TB
    U["계정 (users)"]
    U --> AX1["축 1 · 워크스페이스 접근<br/>role + extra_roles<br/><b>어디에 들어가는가</b>"]
    U --> AX2["축 2 · 운영 기능 권한<br/>ops_roles<br/><b>admin 안에서 무엇을 하는가</b>"]
    AX1 --> W1["/admin"] & W2["/mentor"] & W3["/student"]
    W1 --> AX2
    AX2 --> SCOPE["축 3 · scope<br/>담당 프로젝트 · 배정 지원서 · 본인 데이터<br/><b>어느 범위인가</b>"]
    style AX2 fill:#e8f5e9,stroke:#2e7d32
    style SCOPE fill:#fff3e0,stroke:#ef6c00
```

**접근 = 워크스페이스 AND 기능역할 AND scope AND visibility.** 네 관문 전부를 통과해야 한다.

### 5.2 최종 접근 매트릭스

| 데이터 | 비로그인 | 학생 | 멘토(담당) | 멘토(비담당) | 운영진 일반 | 담당 기능역할 | 총괄 |
|---|---|---|---|---|---|---|---|
| 공개 프로필 | 일부 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 본인 활동·산출물 | — | ✅ | — | — | ✅ | ✅ | ✅ |
| 팀 산출물 | — | 팀·기수 공개분 | ≠`private` | — | ✅ | ✅ | ✅ |
| 피드백 | — | 본인 공개분 | **담당 팀 전체** | — | ✅ | ✅ | ✅ |
| 회고 | — | 본인 전부 | 학생 공개 시 | — | `cohort_visible`만 | 동일 | 동일 |
| 팀 상태체크 | — | **—** | ✅ | — | ✅ | ✅ | ✅ |
| 회의록·문서 | — | — | `mentor_visible` | `mentor_visible` | ✅ | ✅ | ✅ |
| 운영 작업 | — | — | — | — | ✅ | ✅ | ✅ |
| 회계 | — | — | — | — | **—** | `finance` | ✅ |
| 지원자·평가 | — | — | 배정분 | 배정분 | **—** | `recruiting` | ✅ |
| 감사 로그 | — | — | — | — | **—** | `system` | ✅ |

**굵은 `—` 3개가 이 설계의 핵심**이다. 운영진이라고 다 보지 않는다.

---

## 6. 시스템 경계

```mermaid
graph LR
    subgraph GH["GrowthHub — source of truth"]
        D1["운영 문서 Markdown"]
        D2["회의 결정 · 액션"]
        D3["성장증거 메타데이터"]
        D4["권한 · 가시성"]
        D5["발송 이력"]
    end
    subgraph EXT["외부 도구 — 각자 source of truth"]
        E1["GitHub<br/>코드 · PR · Release"]
        E2["Discord<br/>실시간 대화"]
        E3["Drive / Notion<br/>기존 자료 · 공식 문서"]
        E4["Jira / Linear<br/>팀 개발 이슈"]
        E5["Calendar"]
    end
    GH -->|"링크 + 맥락 저장"| EXT
    EXT -.->|"대화 신호로만"| GH
    style GH fill:#e8f5e9,stroke:#2e7d32
    style EXT fill:#f5f5f5,stroke:#757575
```

**GrowthHub는 외부 도구를 대체하지 않는다.** 링크와 메타데이터, 그리고 "이게 왜 여기 붙어 있는지"라는 맥락만 관리한다.

점선이 **한 방향인 것이 중요하다** — 외부에서 들어오는 것은 대화 신호이지 판정 근거가 아니다. 커밋 수로 기여도를 매기지 않고, Discord 메시지 수로 참여도를 재지 않는다.

---

## 7. 완성까지 남은 작업

```mermaid
graph LR
    W1["W1 · 권한 분리<br/>ops_roles"] --> W5["W5 · 감사 · 첨부"]
    W5 --> W7["W7 · 외부링크 · 발송이력"]
    W2["W2 · project_mentors"] --> W3["W3 · 상태체크 · 마일스톤"]
    W3 --> W4["W4 · Mentor Workspace"]
    W3 --> W6["W6 · 스터디 · 회고"]
    W9["W9 · 편집기 툴바<br/>회의록 템플릿"] --> W10["W10 · Discord 알림<br/>인앱 배지"]
    W10 --> W11["W11 · 반응형 등급<br/>보드 드래그"]
    W5 -. "이미지 업로드" .-> W9
    W3 -. "팀 지원 요청 이벤트" .-> W10
    W7 --> W8["W8 · placeholder 실체화"]
    W4 --> W8
    W6 --> W8
    W11 --> W8
    style W1 fill:#e8f5e9,stroke:#2e7d32
    style W5 fill:#e8f5e9,stroke:#2e7d32
    style W6 fill:#e8f5e9,stroke:#2e7d32
    style W2 fill:#e8f5e9,stroke:#2e7d32
    style W3 fill:#e8f5e9,stroke:#2e7d32
    style W4 fill:#e8f5e9,stroke:#2e7d32
    style W9 fill:#e8f5e9,stroke:#2e7d32
    style W10 fill:#e8f5e9,stroke:#2e7d32
    style W11 fill:#fff3e0,stroke:#ef6c00
```

W1~W6 및 W9~W10 완료. **세 축(권한/인프라 · 멘토/성장 · 제품 경험)이 대체로 독립**이다. 남은 것은 W5~W8과 경험 축 W9~W11이다. 점선은 약한 의존이다.

| Wave | 산출물 | 축 | 상태 |
|---|---|---|---|
| W1 | `ops_roles` + 게이트 + 백필 + 역할 UI | 권한 | ✅ 구현 완료 (DB push·런타임 검증 미완) |
| W2 | `project_mentors` + scope 헬퍼 + Admin 배정 UI | 성장 | ✅ 구현 완료 |
| W3 | `project_status_checks` · `project_milestones` · `projects` 확장 | 성장 | ✅ 구현 완료 |
| W4 | Mentor Workspace 4화면 | 성장 | ✅ 구현 완료 |
| W5 | `audit_logs` · `attachments` + 인증 게이트 다운로드 | 인프라 | ✅ 구현 완료 |
| W6 | `studies` · `study_members` · `reflections` + 학생 3화면 | 성장 | ✅ 구현 완료 |
| W7 | `external_links` (`communication_logs`는 W10에서 완료) | 인프라 | 부분 완료 |
| W8 | placeholder 11개 실체화 또는 제거 | 마감 | 미착수 |
| **W9** | `MarkdownEditor` 툴바 + 회의록 유형별 템플릿 + `bodyMd` 이관 | **경험** | ✅ 구현 완료 |
| **W10** | Discord 웹훅 + 인앱 배지 + 일일 요약 cron | **경험** | ✅ 구현 완료 |
| **W11** | 반응형 A/B/C 등급 + `DesktopOnly` 가드 + 작업 보드 드래그 | **경험** | 미착수 |

**병렬 가능:** 권한/인프라 축, 멘토/성장 축, 제품 경험 축이 서로 대체로 독립이다. W9의 이미지 붙여넣기만 W5에 의존한다.

**W10은 W3 이후가 자연스럽다** — 알릴 가장 중요한 이벤트(팀 지원 요청)가 W3에서 생긴다.

**즉시 가능한 것:** `/student/feedback`은 신규 테이블 없이 기존 `feedback` 필터만으로 만들 수 있다. 어느 Wave에든 끼워 넣을 수 있다.

---

## 8. 완성해도 하지 않는 것

이건 미완성이 아니라 **의도적 경계**다. baseline이 열어둔 것을 구현이 닫지 않는다.

| 영역 | 이유 |
|---|---|
| 학생 성장 점수 · 역량 정량평가 · 랭킹 | 성장모델 미확정. 확정 전 점수화는 방향을 잘못 고정한다 |
| 자동 성장 진단 · 자동 리포트 | 위와 동일 |
| GitHub 커밋 기반 기여도 판정 | 활동량은 대화 신호이지 평가가 아니다 |
| 커리큘럼 구조 확정 (`programs`의 최종 의미) | Parallel B 정렬 이후 |
| `skill_tags`의 최종 역량 체계 | 현재는 **임시 분류 태그** |
| Jira 대체 · 스프린트 관리 | 팀이 쓰는 도구를 뺏지 않는다 |
| ERP 수준 회계 | 동아리 규모에 과하다 |
| Discord 메시지 수집 · 활동량 추적 | 감시가 된다 |

이것들은 **Parallel B(성장모델·커리큘럼·운영모델 정렬)** 이후 Phase 4에서 다룬다. 그때 성장증거 계층이 성장해석 계층과 연결된다.

---

## 9. 미결 항목

완성 형상에서도 아직 답하지 않은 것들이다.

| 항목 | 언제 결정 |
|---|---|
| `/admin/reflections` placeholder를 제거할지, 정책 안내 페이지로 바꿀지 | W8 이전 |
| `programs`를 Curriculum Module / Track / Program 중 무엇으로 재정의할지 | Parallel B |
| 알럼나이 접근 범위 | 알럼나이 기능 검토 시 |
| 졸업·기수 종료 후 가시성 변화 (아카이브 정책) | Phase 4 |
| 학생이 자기 산출물을 외부 공개(포트폴리오)할 수 있는가 | Parallel B 이후 |
| `attachments` 서명 URL 만료 정책 | Object Storage 확장 시 |
| 운영진 담당 범위(scope) 표현이 필요해지는 시점 | 실제 요구 발생 시 |
