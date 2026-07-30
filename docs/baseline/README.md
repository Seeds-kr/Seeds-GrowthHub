# Seeds GrowthHub — Baseline 설계 문서 (기준본)

이 디렉터리는 Seeds GrowthHub 구현의 **기준본(source of truth) 설계 문서 11종**을 보관한다.
`docs/gap-register.md`가 참조하는 "Baseline"이 바로 이 문서 세트다.

문서 간 충돌이 발생하면 [`00-document-standards-and-glossary.md`](00-document-standards-and-glossary.md) §6 충돌 해결 원칙을 따른다.

---

## 1. 문서 목록

| # | 파일 | 원 제목 | 버전 | 다루는 것 |
|---|---|---|---|---|
| 00 | [00-document-standards-and-glossary.md](00-document-standards-and-glossary.md) | Seeds GrowthHub - 문서 체계 및 용어 표준 | — | 기준본 원칙, 문서별 책임 범위, 공통 용어 |
| 01 | [01-overview-v3.md](01-overview-v3.md) | Seeds GrowthHub - Overview | v3 | 목적, 문제 범위, 설계 원칙, 상위 구조 |
| 02 | [02-core-v2.md](02-core-v2.md) | Seeds GrowthHub - Core 기반 구조 명세 | v2 | 사람·역할·권한·문서·저장·가시성 |
| 03 | [03-external-integrations.md](03-external-integrations.md) | Seeds GrowthHub - 외부 도구 연계 설계 | — | GitHub, Discord, Drive, Calendar, Email/SMS |
| 04 | [04-ops-v3.md](04-ops-v3.md) | Seeds GrowthHub - 운영시스템 기능 명세 | v3 | 회의, 작업, 문서, 모집, 행사, 회계, 공지 |
| 05 | [05-growth-v3.md](05-growth-v3.md) | Seeds GrowthHub - 성장시스템 1차 판단 및 안정 선개발 기능 명세 | v3 | 성장증거 기록 계층 (선개발 범위) |
| 06 | [06-ia-v2.md](06-ia-v2.md) | Seeds GrowthHub - IA 및 화면 구조 설계 | v2 | 메뉴, 화면, 사용자 여정 |
| 07 | [07-erd-v3.md](07-erd-v3.md) | Seeds GrowthHub - 데이터 모델 및 ERD 상세 설계 | v3 | 엔티티, 관계, 제약, visibility, 삭제 정책 |
| 08 | [08-roadmap-v3.md](08-roadmap-v3.md) | Seeds GrowthHub - 구현 로드맵 및 Phase 계획 | v3 | Phase, 병렬 과제, 게이트, 의존관계 |
| 09 | [09-staff-structure-v3.md](09-staff-structure-v3.md) | Seeds 운영진 구조 | v3 | 조직 역할, 의사결정, escalation |
| 10 | [10-staff-recruiting-onboarding-v3.md](10-staff-recruiting-onboarding-v3.md) | Seeds 운영진 모집 및 온보딩 설계 | v3 | 모집 포지션, 기대 투입, 온보딩 |

> 09, 10은 GrowthHub 기능 명세가 아니라 **Seeds 조직 설계 문서**다. GrowthHub와 연결되지만 독립적으로 유지한다.

---

## 2. 문서 구조 지도

```text
00 문서 체계 및 용어 표준     ← 모든 문서의 용어 기준
 └─ 01 Overview              ← 목적/원칙/상위 구조
     ├─ 02 Core (기반 계층)
     │   └─ 03 외부 도구 연계
     ├─ 04 Ops (운영 시스템)
     ├─ 05 Growth (성장 시스템)
     ├─ 06 IA (화면)
     ├─ 07 ERD (데이터)
     └─ 08 Roadmap (구현 순서)

09 운영진 구조  ─┬─ Seeds 조직 축 (GrowthHub와 병렬)
10 모집/온보딩  ─┘
```

---

## 3. 핵심 개념 요약

### 3.1 3계층 구조

```text
Seeds GrowthHub
├─ Core 기반 계층     ← Ops/Growth가 공유하는 기반 (동급 하위 시스템 아님)
├─ 운영 시스템 (Ops)  ← 회의·작업·모집·행사·회계·공지·운영 문서
└─ 성장 시스템 (Growth) ← 프로젝트·스터디·산출물·피드백·회고·활동기록
```

### 3.2 관통하는 설계 원칙

1. **운영은 안정화, 성장은 성급히 점수화하지 않는다.** 성장모델 확정 전까지는 성장*증거*만 축적한다.
2. **멘토의 행정 부담을 최소화한다.** 멘토는 관리 대상이 아니라 지원 대상이다.
3. **기존 도구를 대체하지 않고 연결한다.** GitHub/Discord/Drive/Jira는 각자 source of truth로 두고, GrowthHub는 메타데이터·연결 맥락·권한을 관리한다.
4. **내부 운영 문서는 Markdown이 source of truth.** DOCX 편집기는 초기 범위 밖.
5. **확정된 것과 열린 것을 구분한다.** 확정 / 임시 구체화 / 선행 개발 가능 / 검토 필요 / 보류.

### 3.3 권한 모델

```text
users.role (primary) + users.extra_roles[] → effective roles
                                            + scope (cohort/project/application/…)
```

- `admin`은 **시스템 권한 role**이며 Seeds 운영진 전체를 의미하지 않는다.
- Evaluator는 별도 role이 아니라 **배정 기반 접근 surface**다.
- scope 기반 `role_assignments`는 장기 검토 대상(현재 보류).

### 3.4 구현 순서 (Roadmap v3)

| 단계 | 목표 |
|---|---|
| Phase 1 | Core 기반 완성 (사람·역할·권한·문서·가시성·저장) |
| Phase 2 | Ops 운영 시스템 완성 (회의·작업·문서·모집·행사·회계·대시보드) |
| Parallel A | 신규 운영진 모집 및 온보딩 (Phase 2와 병렬) |
| Phase 3 | Growth 안정 선개발 (성장증거 계층) |
| Parallel B | 성장모델·커리큘럼·운영모델 정렬 (별도 논의 축) |
| Phase 4 | 정렬 결과의 GrowthHub 반영 (성장해석 계층) |

---

## 4. 명시적으로 **확정하지 않는 것**

이 baseline은 다음을 의도적으로 열어둔다. 구현이 이를 조기에 고정하지 않도록 주의한다.

- Seeds 성장모델 / 인재상 / 성장 단계
- 커리큘럼 구조 (현재 `programs`의 최종 의미 포함)
- 학생 성장 점수·역량 정량 평가·랭킹·자동 진단
- GitHub 활동량 기반 기여도 판정
- 최종 역량 태그 체계 (현재 `skill_tags`는 **임시 분류 태그**)

---

## 5. 작업 시 참조 매핑

| 작업 영역 | 1차 참조 |
|---|---|
| 용어 충돌 (tasks vs assignments 등) | 00 §5 |
| 메뉴 재분류 | 06 §7.1 |
| Meetings / Tasks / Documents / Finance | 04 §4~9, 07 §6 |
| Studies / Reflections / Milestones | 05 §7~12, 07 §7 |
| Mentor 화면 | 06 §8 |
| Student 화면 | 06 §9 |
| External Links | 03 §13 |
| Visibility 정책 | 02 §7, 07 §9 |
| Role / Scope | 02 §6, 07 §5.6, §8 |
| 구현 순서·게이트 | 08 §3~9 |
| 운영진 R&R / escalation | 09 §5~7 |
| 운영진 모집 포지션 / 온보딩 | 10 §4~11 |

---

## 6. 관련 문서 (이 디렉터리 밖)

| 문서 | 성격 |
|---|---|
| [`../ia-and-features.md`](../ia-and-features.md) | **현재 구현** 기준 IA·기능·데이터 모델 사양 (MVP1~4) |
| [`../gap-register.md`](../gap-register.md) | 현재 구현 ↔ 이 baseline 대조 감사, Gap 목록 |
| [`../visibility-policy.md`](../visibility-policy.md) | 가시성 정책 표준 — 누가 무엇을 보는가의 단일 진실 |
| [`../design/`](../design/) | **세부 설계.** 스키마·API·수용 기준까지의 구현 명세 |
| [`../../replit.md`](../../replit.md) | 런타임/스키마 등 구현 노트 |

**관계**

```text
baseline/          무엇을·왜        (목표 상태)
   ↓
ia-and-features    현재 상태
   ↓
gap-register       격차 식별
   ↓
visibility-policy  전제 정책
   ↓
design/            어떻게          (구현 명세 + ADR + Wave)
```

---

## 7. `attached_assets/`와의 관계

동일한 11개 문서가 `attached_assets/`에도 존재한다 (타임스탬프 접미사 파일명, 예: `seeds_growth_hub_overview_v_3_1779722749307.md`).
현재 두 위치의 내용은 **바이트 단위로 동일**하다.

| 위치 | 성격 |
|---|---|
| `docs/baseline/` | **정본.** 큐레이션된 기준본. 참조·인용은 여기를 쓴다. |
| `attached_assets/` | Replit 업로드 원본 덤프. 이력 보존용. 편집하지 않는다. |

문서 버전이 올라가면 `docs/baseline/`만 갱신한다. `attached_assets/`는 업로드 시점 스냅샷으로 남긴다.

---

## 8. 갱신 원칙

- 이 디렉터리의 파일은 **기준본 스냅샷**이다. 버전이 올라가면 파일을 교체하고 §1 표의 버전 열을 갱신한다.
- 파일명은 `NN-<주제>-v<버전>.md` 규칙을 따른다. 원 제목은 §1 표에서 추적한다.
- baseline이 바뀌면 `gap-register.md`의 대조 결과도 함께 재검토한다.
