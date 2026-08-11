# Seeds GrowthHub — 세부 설계

> 세션을 이어받는다면 [`../HANDOFF.md`](../HANDOFF.md)를 먼저 읽는다.

> baseline 문서([`../baseline/`](../baseline/))가 **무엇을·왜**라면, 이 디렉터리는 **어떻게**다.
> 각 문서는 스키마·API·수용 기준까지 담은 구현 가능한 명세다.

---

## 1. 문서

| # | 문서 | 다루는 것 | 선행 조건 |
|---|---|---|---|
| **00** | [**00-target-state.md**](00-target-state.md) | **완성 형상 — 전부 만들면 어떤 모습인가.** 여기부터 읽는다 | — |
| — | [`../visibility-policy.md`](../visibility-policy.md) | 가시성 정책 표준 (모든 것의 기반) | 없음 |
| 01 | [01-role-permissions.md](01-role-permissions.md) | 운영진 기능 역할, `ops_roles`, 권한 게이트 | 없음 |
| 02 | [02-mentor-workspace.md](02-mentor-workspace.md) | `project_mentors`, 멘토 화면·API | visibility-policy |
| 03 | [03-growth-evidence.md](03-growth-evidence.md) | 상태체크·마일스톤·스터디·회고 | visibility-policy |
| 04 | [04-core-infra.md](04-core-infra.md) | 감사로그·외부링크·첨부·발송이력 | 01 |
| 05 | [05-product-experience.md](05-product-experience.md) | **UX 축** — 편집 경험·회의록 템플릿·알림·반응형 | 04(이미지 업로드만) |
| 06 | [06-team-meeting-notes.md](06-team-meeting-notes.md) | **팀 회의록** · 팀 참고링크 — 학생이 쓰는 첫 협업 문서 | visibility-policy · 03 |
| 07 | [07-activity-timeline.md](07-activity-timeline.md) | **활동 타임라인 자동 기록** — 무엇을 기록으로 칠 것인가 | 03 · 06 |

**00은 전경, 01~05는 실행 명세다.** 00이 "무엇이 될 것인가"를, 01~05가 "어떻게 만드는가"를 담는다.

01~04는 **데이터·권한·API 축**이고, 05는 **제품 경험 축**이다. 둘 다 있어야 한 기능이 완성된다 — 예: 회의록은 01~04에서 스키마·권한이, 05에서 템플릿·편집기·알림이 정의된다.

---

## 2. 결정 기록 (ADR)

이 4개는 baseline이 열어둔 항목이며, 설계 착수 시점에 확정했다. 뒤집으려면 영향 범위를 먼저 확인한다.

### ADR-001 — 회고 공개 범위는 학생이 정한다

**결정.** `reflections.visibility`를 학생이 작성 시 선택한다. 기본값 `private`. enum에 `admin_only`를 **두지 않는다.**

**근거.** [Growth v3 §12.2](../baseline/05-growth-v3.md)가 "회고가 평가에 사용되지 않는다는 원칙을 어떻게 보장할 것인가"를 열린 질문으로 남겼다. UI 문구가 아니라 **구조**로 보장한다 — 운영진 전체 조회 경로를 만들 수 없게 한다.

**대가.** 운영진이 회고에서 팀 리스크를 조기 감지할 수 없다. → `project_status_checks`가 그 역할을 맡는다([03 §2](03-growth-evidence.md)).

**영향.** [03 §5](03-growth-evidence.md), [visibility-policy §4.2](../visibility-policy.md)

---

### ADR-002 — 기능 역할은 `extra_roles`가 아니라 별도 축

**결정.** `users.ops_roles text[]` 신규 컬럼 + `OPS_ROLES` 7종. `extra_roles`와 `getEffectiveRoles`는 **건드리지 않는다.**

**근거.** `extra_roles`는 `UserRole[]`(admin/mentor/student)로 타입이 잠겨 있고, `getEffectiveRoles`가 화이트리스트로 필터링한다. `USER_ROLES`를 늘리면 primary `role` 컬럼과 역할 스위처 UI의 의미가 함께 오염된다.

**대가.** 권한 축이 2개가 되어 개념이 하나 는다. → "워크스페이스 접근"과 "운영 기능 권한"으로 UI에서 명확히 분리한다.

**영향.** [01](01-role-permissions.md) 전체, [04 §3](04-core-infra.md)

---

### ADR-003 — 멘토↔프로젝트는 N:N 별도 테이블

**결정.** `project_mentors(project_id, mentor_user_id)` UNIQUE. `project_members`(학생 전용)는 그대로 둔다. 배정 해제는 삭제가 아니라 `status='ended'`.

**근거.** 공동 멘토링과 멘토 교체가 실제로 발생한다. `projects.mentor_user_id` 단일 FK로는 교체 이력이 사라져 이전 멘토링 맥락을 잃는다.

**대가.** 조인이 하나 늘어난다. → `getMentorProjectIds()` 헬퍼 하나로 통일해 흩어지지 않게 한다.

**영향.** [02 §2](02-mentor-workspace.md)

---

### ADR-005 ~ ADR-008 — 제품 경험 축

[05-product-experience.md §2](05-product-experience.md)에 상세히 있다. 요약:

| # | 결정 | 대가 |
|---|---|---|
| **005** | 마크다운 유지 + 툴바. 블록 에디터 도입 안 함 | 표 편집이 불편 → 서식 중요 문서는 Drive 링크 |
| **006** | 회의록은 유형별 템플릿, 결정·액션만 공통 강제 | 템플릿 7종 유지보수 → `documents` 템플릿으로 운영진이 직접 수정 |
| **007** | 알림은 Discord 웹훅 + 인앱 배지 (이메일 없음) | Discord 장애 시 알림 끊김 → 인앱 배지 병행 |
| **008** | 데스크톱 우선, 모바일은 읽기만 보장 | 멘토가 폰에서 상태체크 불가 → **007의 Discord 알림이 상쇄. 007이 빠지면 재검토** |

> ADR-007과 ADR-008은 **묶여 있다.** 알림을 도입하지 않으면서 모바일도 포기하면, 멘토는 담당 팀에 문제가 생긴 것을 알 방법도 알릴 방법도 없다.

---

### ADR-004 — 멘토는 담당 팀 피드백을 전부 본다 (scope 기반)

**결정.** 담당 프로젝트에 달린 `feedback`은 유형·작성자·visibility와 무관하게 전부 열람. `feedback` enum에 `mentor_visible`을 **추가하지 않는다.**

**근거.** 접근 판단을 `visibility`가 아니라 `scope`(담당 여부)로 한다. 기존 enum과 데이터를 건드리지 않으므로 학생 측 필터링 회귀 위험이 0이고, 담당 해제 시 접근이 자동으로 끊긴다.

**대가.** 운영진이 `admin_note`로 남긴 내부 메모가 담당 멘토에게 보인다. → 학생 관련 민감한 내부 판단은 `meetings`/`documents`(`admin_only`)에 기록하도록 운영진 온보딩에 명시한다.

**영향.** [visibility-policy §4.3](../visibility-policy.md), [02 §3.1](02-mentor-workspace.md)

---

## 3. 의존 그래프

```text
visibility-policy ─────┬─→ 02 Mentor Workspace ──→ 03 상태체크/마일스톤
                       └─→ 03 Growth 증거계층

01 권한 분리 ──────────┬─→ 04 Core 인프라 (audit_logs)
                       └─→ 운영진 모집/온보딩 (Parallel A)

02 project_mentors ────→ visibility-policy §3 mentor scope 실행 가능
```

**임계 경로:** `01 권한 분리` → `04 audit_logs` → 운영진 온보딩.
운영진 모집이 임박했다면 01이 먼저다. 나머지는 이 축과 독립적으로 병행 가능하다.

---

## 4. 구현 Wave

`gap-register.md`의 Wave 0~5를 현재 구현 상태에 맞춰 재배열했다. Wave 1·2·4 상당 부분은 **이미 완료**되었다(meetings, ops_tasks, documents, finance_records, ops-dashboard).

| Wave | 범위 | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| **W1** | 권한 분리 Phase A | `ops_roles` 컬럼 + `requireOpsRole` + 백필 + 역할 관리 UI | `finance` 담당이 모집 데이터에 403 | ✅ 구현 완료<br/>(런타임 실측: 403 확인) |
| **W2** | 멘토 담당 팀 | `project_mentors` + `getMentorProjectIds` + Admin 배정 UI | 멘토가 담당 팀 목록을 본다 | ✅ 구현 완료 |
| **W3** | 상태체크·마일스톤 | `project_status_checks` + `project_milestones` + `projects` 확장 | 30초 상태체크 → 운영 대시보드 반영 | ✅ 구현 완료 |
| **W4** | Mentor Workspace 화면 | My Teams · Project Detail · Feedback | ADR-004 동작 확인 | ✅ 구현 완료 |
| **W5** | 감사·첨부 | `audit_logs` + `attachments` + 인증 게이트 다운로드 | 영수증이 비인증으로 안 열림 | ✅ 구현 완료 |
| **W6** | Growth 2차 | `studies` · `study_members` · `reflections` + 학생 화면 3종 | ADR-001 구조 보장 확인 | ✅ 구현 완료 |
| **W7** | 외부링크·발송이력 | `external_links` · ~~`communication_logs`~~(W10에서 완료) | 부모 가시성과 교집합으로만 열람 | ✅ 구현 완료<br/>(API·런타임 검증 완료, 화면 없음) |
| **W8** | placeholder 실체화 | 8개 → 실체화 4(미디어·면접·출석·리포트) / 제거 4(회원·공개페이지·외부연동·설정) | 빈 화면 0개 | ✅ 구현 완료<br/>(빈 화면 0개 달성) |
| **W9** | 편집 경험 | `MarkdownEditor` 툴바 + 회의록 유형별 템플릿 + `meetings.bodyMd` 이관 | 마크다운 몰라도 체크리스트 작성 가능 | ✅ 구현 완료 |
| **W10** | 알림 | Discord 웹훅 디스패처 + 인앱 배지 + 일일 요약 cron | 팀 지원 요청이 즉시 운영진 채널에 뜸 | ✅ 구현 완료 |
| **W11** | 반응형 등급 적용 | A/B/C 등급 분류 + `DesktopOnly` 가드 + 작업 보드 드래그 | 375px에서 학생 화면 가로 스크롤 0 | ✅ 구현 완료<br/>(브라우저 검증 미완) |

**세 축이 대체로 독립**이다.

```text
권한/인프라   W1 ✅ → W5 ✅ → W7 ✅ ─┐
멘토/성장     W2 ✅ → W3 ✅ → W4·W6 ✅ ─┼→ W8 ✅ placeholder 정리
제품 경험     W9 ✅ → W10 ✅ → W11 ✅ ──┘
```

- **11개 Wave 전부 완료.** W7의 화면은 예정대로 W8의 `/admin/media`에 들어갔다.
  남은 것은 구현이 아니라 **브라우저 검증**이다([HANDOFF §6](../HANDOFF.md)).
- W9의 이미지 붙여넣기만 W5(`attachments`)에 의존한다. 툴바 자체는 선행 없이 가능하다.
- **W10(알림)은 W3 이후가 자연스럽다** — 알릴 가장 중요한 이벤트(팀 지원 요청)가 W3에서 생기기 때문이다. 다만 지연 작업 알림은 지금도 보낼 수 있다.

`My Feedback`(학생)은 신규 테이블 없이 지금 바로 가능하므로, 어느 Wave에든 끼워 넣을 수 있다.

전체 형상과 Wave 의존 그래프는 [00-target-state.md §7](00-target-state.md)에 있다.

---

## 5. 전역 회귀 금지선

모든 Wave에 공통 적용한다. 이 중 하나라도 깨지면 롤백한다.

| 영역 | 금지선 |
|---|---|
| 학생 가시성 | [visibility-policy §6](../visibility-policy.md)의 기존 6개 규칙 변경 금지 |
| 평가 surface | `requireAdminOrMentor` + application 단위 assignment 소유권 재확인 패턴 유지. `recruiting` 기능 역할로 대체 금지 |
| `getEffectiveRoles` | API 표면 변경 금지. `ops_roles`는 별도 함수로 |
| 기존 visibility enum | `artifacts` 4 / `feedback` 2 / `activity_records` 3 값 추가·변경 금지.<br/>`attachments`는 W7에서 `team_visible`을 **의도적으로 제거**했다(읽는 쪽이 없었다) — 되살릴 때는 읽기 경로와 같은 변경에서 |
| `decision_logs` | append-only 유지. `audit_logs`가 흡수하지 않음 |
| 아바타 서빙 | `visibility=public` 비인증 경로 유지 (attachments와 분리) |
| 명명 | `ops_tasks`(운영) vs `assignments`(학생 과제), `mvp4ArtifactsTable` 컨벤션 유지 |
| 이중 상태 | `applications.status`(legacy) + `application_status` 동시 갱신 |

---

## 6. 이 설계가 확정하지 않는 것

baseline이 열어둔 항목은 여기서도 열어둔다. 구현이 이를 고정하지 않도록 주의한다.

- Seeds 성장모델·인재상·성장 단계
- 커리큘럼 구조와 `programs`의 최종 의미
- 성장 점수·역량 정량 평가·랭킹
- `skill_tags`의 최종 역량 태그 체계 (현재는 임시 분류 태그)
- `role_assignments`(scope 기반 역할) — `ops_roles`는 scope가 없는 기능 분리이며, "3기 담당 회계"는 표현하지 못한다
- 알럼나이 접근, 졸업 후 아카이브 정책, 학생 산출물의 외부 공개
