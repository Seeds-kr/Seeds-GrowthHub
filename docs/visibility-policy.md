# Seeds GrowthHub — 가시성(Visibility) 정책 표준

> 상태: **확정** · 대응 항목: `gap-register.md` V1 (P0)
> 선행 문서: [baseline/02-core-v2.md](baseline/02-core-v2.md) §7, [baseline/07-erd-v3.md](baseline/07-erd-v3.md) §9, [baseline/05-growth-v3.md](baseline/05-growth-v3.md) §12
>
> 이 문서는 GrowthHub의 모든 객체에 대해 **누가 무엇을 볼 수 있는가**를 정의하는 단일 진실이다.
> 신규 객체를 추가할 때는 반드시 이 문서의 §4 매트릭스에 행을 추가한 뒤 구현한다.

---

## 1. 핵심 원칙

### 원칙 1 — 접근 = scope AND visibility

가시성은 **단독으로 접근을 결정하지 않는다.** 열람 가능 여부는 두 조건의 논리곱이다.

```text
열람 가능 = scope 통과 (관계가 성립하는가)
          AND visibility 통과 (그 관계까지 열려 있는가)
```

예: 멘토가 어떤 피드백을 보려면 → 그 피드백이 달린 프로젝트의 **담당 멘토여야 하고**(scope), 그 피드백의 visibility가 **mentor 관계까지 허용**해야 한다.

이 분리를 지키면 `visibility` 컬럼에 역할 이름을 무한정 추가하지 않아도 된다.

### 원칙 2 — 객체별 enum 독립 유지, 전역 통합 금지

각 객체는 **자기에게 의미 있는 단계만** enum으로 갖는다. 전역 단일 enum으로 통합하지 않는다.

이유:
- 객체마다 의미 있는 관계가 다르다. `meetings`에 `cohort_visible`은 무의미하고, `artifacts`에 `mentor_visible`만 있으면 부족하다.
- 전역 enum은 특정 객체에 무의미한 값을 허용해 런타임 분기를 늘린다.
- 기존 4개 enum을 통합하려면 데이터 마이그레이션이 필요하고, 학생 측 가시성 회귀 위험이 크다.

대신 **공통 어휘(§2)를 공유**한다. 같은 단어는 모든 객체에서 같은 의미를 갖는다.

### 원칙 3 — 기본값은 가장 닫힌 쪽

신규 객체의 `visibility` 기본값은 그 객체가 취할 수 있는 가장 좁은 값으로 둔다. 넓히는 것은 명시적 행위여야 한다.

### 원칙 4 — 학생 가시성은 회귀 금지 영역

학생에게 노출되는 경로가 늘어나는 변경은 반드시 §6 체크리스트를 통과해야 한다. 신규 객체가 학생 라우트에 등장하면 통합 테스트를 필수로 붙인다.

### 원칙 5 — 회고는 평가 자료가 아니다

`reflections`의 공개 범위는 **작성자인 학생이 정한다.** 운영진·멘토가 강제로 열람 범위를 넓힐 수 없다. 이 원칙은 구조로 보장한다 — 운영진용 "전체 회고 조회" API를 만들지 않는다.

팀 리스크 감지는 회고가 아니라 [`project_status_checks`](design/03-growth-evidence.md)가 담당한다.

---

## 2. 공통 어휘

`visibility` 값에 쓰는 단어는 아래 7개로 제한한다. 같은 단어는 모든 객체에서 같은 관계를 가리킨다.

| 값 | 허용하는 관계 | 의미 |
|---|---|---|
| `private` | self | 작성자/소유자 본인만 |
| `author_only` | self(작성자) | `private`와 동일하나 "소유자"가 아니라 "작성자" 기준일 때 사용 |
| `team_visible` | self + 같은 프로젝트/스터디 멤버 | 팀 내부 공유 |
| `mentor_visible` | 위 + 담당 멘토 | 담당 멘토까지 |
| `cohort_visible` | 위 + 같은 기수 학생 | 기수 내 공유 |
| `student_visible` | 대상 학생 본인이 볼 수 있음 | **주의: 아래 참고** |
| `admin_only` | 운영진만 | 학생·멘토에게 노출 안 됨 |

> **`student_visible`의 의미 차이 주의.**
> 이 값은 객체에 따라 두 가지로 쓰인다. 신규 객체에서는 반드시 어느 쪽인지 명시한다.
> - **소유형** (`artifacts`, `activity_records`): "학생들이 볼 수 있는 상태" — 소유자 + 관계된 학생
> - **대상형** (`feedback`): "이 피드백의 **대상 학생**이 볼 수 있음" — `studentId`가 가리키는 학생 1명
>
> 기존 구현이 이미 이렇게 갈라져 있으므로 통합하지 않는다. 대신 각 객체의 §4 행에 해석을 적는다.

---

## 3. 뷰어 관계(scope) 정의

접근 판단에 쓰는 관계는 아래 6종이다. 코드에서는 `resolveViewerScope(user, object)` 형태로 판정한다.

| 관계 | 판정 기준 |
|---|---|
| `self` | 객체의 `studentId`/`ownerId`/`authorId`가 뷰어 본인 |
| `team` | 뷰어가 해당 `project`/`study`의 `project_members`/`study_members` |
| `cohort` | 뷰어의 `student_cohorts`에 객체의 `cohortId`가 포함 |
| `mentor` | 뷰어가 해당 프로젝트의 `project_mentors` (→ [design/02](design/02-mentor-workspace.md)) |
| `ops` | 뷰어가 `admin` role이고 해당 기능 역할 보유 (→ [design/01](design/01-role-permissions.md)) |
| `program_lead` | 전체 접근 기능 역할 |

**멘토는 담당 범위 밖에서는 아무 관계도 갖지 않는다.** `mentor` role 보유만으로 열리는 데이터는 없다 (공개 디렉터리 제외).

---

## 4. 객체별 채택 매트릭스

### 4.1 현행 유지 — 변경 없음

| 객체 | enum | 기본값 | `student_visible` 해석 | 비고 |
|---|---|---|---|---|
| `artifacts` | `private` / `student_visible` / `cohort_visible` / `admin_only` | `student_visible` | 소유형 | 4단계 유지. 멘토 접근은 scope로 처리(§4.3) |
| `activity_records` | `private` / `student_visible` / `admin_only` | `admin_only` | 소유형 | 유지 |
| `feedback` | `student_visible` / `admin_only` | `admin_only` | **대상형** | enum 유지. 멘토 접근은 scope로 처리(§4.3) |
| `meetings` | `admin_only` / `mentor_visible` | `admin_only` | — | 학생 라우트 없음 |
| `documents` | `admin_only` / `mentor_visible` | `admin_only` | — | 학생 라우트 없음 |
| `people_profiles` | `is_public` boolean + `canViewMemberContacts` | `is_public=false` | — | 별도 체계. 통합하지 않음 |
| `finance_records` | (없음) | — | — | 라우트 레벨 `finance` 기능 역할로만 게이트 |

### 4.2 신규 객체

| 객체 | enum | 기본값 | 근거 |
|---|---|---|---|
| `reflections` | `private` / `team_visible` / `mentor_visible` / `cohort_visible` | **`private`** | 학생이 작성 시 선택. `admin_only` 없음 — 운영진 전체 조회 경로를 만들지 않기 위함 |
| `studies` | (없음, 공개 활동) | — | 스터디 자체는 기수 내 공개. 산출물은 `artifacts` visibility 적용 |
| `project_milestones` | (없음) | — | 프로젝트 가시성을 상속 |
| `project_status_checks` | `admin_only` / `mentor_visible` | `mentor_visible` | 팀 상태·블로커·지원요청. **학생에게 노출 안 함** |
| `external_links` | `private` / `team_visible` / `cohort_visible` / `admin_only` | `admin_only` | `artifacts`와 동일 어휘 |
| `attachments` | `private` / `admin_only` | `admin_only` | 영수증·증빙 포함 → 보수적 기본값. **W7에서 `team_visible` 제거** — 읽는 쪽이 없었다(아래 주석) |
> `activity_records` 자동 기록은 **`student_visible` 로 넣는다**([설계 07 ADR-015](design/07-activity-timeline.md)).
> `/student/timeline` 이 그 값만 읽으므로 `private` 로 넣으면 본인도 못 보고, 그러면 "학생이 스스로 본다"가 사라진다.
> 운영진 전용 기록이 필요하면 수동(`manual`)으로 넣는다.

| `team_meetings` | **(없음)** | — | 청중 고정: 팀원 + 담당 멘토 + 운영진. 작성자가 고르지 않는다 — [설계 06 ADR-011](design/06-team-meeting-notes.md) |
| `audit_logs` | (없음) | — | `program_lead` + `system` 기능 역할만 |
| `communication_logs` | (없음) | — | 발송 담당 기능 역할(`recruiting`/`community`) + `program_lead` |

> `reflections`에 `admin_only`가 **없는 것은 의도적이다.** 운영진이 회고를 일괄 열람하는 화면을 만들 수 없게 만드는 구조적 장치다.
> 구현에서는 여기서 한 걸음 더 나아가 **운영진 열람 경로를 아예 두지 않았다** — §5 하단 주석 참조.
>
> 다만 `private` 외 3개 값은 **읽는 쪽이 있어야 의미가 있다.** 초기 구현에서 소유자 경로만 만들어
> 3개 값이 죽은 값이 된 적이 있고, 그 상태에서 공개범위 선택기는 존재하지 않는 청중을 약속하게 된다.
> 신규 visibility 값을 추가할 때는 **대응하는 읽기 경로를 같은 변경에서 만든다.**

### 4.3 멘토 접근 — visibility가 아니라 scope로 처리

Q4 결정(**담당 팀 전체 열람**)의 구현 방식이다. `feedback`에 `mentor_visible` 값을 추가하지 **않는다.**

```text
멘토가 feedback을 볼 수 있음
  ⟺ feedback.targetType='project'
      AND feedback.targetId ∈ (내가 담당한 project_ids)
```

**결과: 담당 프로젝트에 달린 피드백은 유형·작성자·visibility와 무관하게 전부 열람 가능하다** (`admin_note` 포함).

이 방식을 택한 이유:
- `feedback.visibility` enum과 데이터를 건드리지 않는다 → 학생 측 필터링 회귀 위험 0
- "담당"이라는 관계가 접근의 근거가 되어, 담당 해제 시 접근도 자동으로 끊긴다
- 멘토 교체 시 이전 멘토링 맥락이 보존된다 (Q4의 목적)

**부작용과 완화:** 운영진이 `admin_note`로 남긴 내부 메모도 담당 멘토에게 보인다.
→ 완화: 학생 관련 민감한 운영진 내부 판단은 `feedback`이 아니라 **`meetings`(admin_only) 또는 `documents`(admin_only)** 에 기록한다. 이 규칙을 운영진 온보딩 문서에 명시한다.

동일 원칙을 `artifacts`에도 적용한다:

```text
멘토가 artifact를 볼 수 있음
  ⟺ artifact.projectId ∈ (내가 담당한 project_ids)
      AND artifact.visibility ≠ 'private'
```

`private`은 학생 개인의 미완성 자료이므로 담당 멘토에게도 열지 않는다.

---

## 5. 5축 접근 매트릭스

행 = 객체, 열 = 뷰어. `—` = 접근 경로 없음.

| 객체 | 비로그인 | 학생(본인/팀) | 학생(같은 기수) | 멘토(담당) | 멘토(비담당) | 운영진(기능역할) | program_lead |
|---|---|---|---|---|---|---|---|
| `people_profiles` | `is_public`만, phone 마스킹 | 전체(phone 포함) | 전체 | 전체 | 전체 | 전체 | 전체 |
| `artifacts` | — | 본인 ≠`admin_only`, 팀원 `student_visible`/`cohort_visible` | `cohort_visible` | 담당 팀 ≠`private` | — | 전체 | 전체 |
| `feedback` | — | 대상=본인 AND `student_visible` | — | **담당 팀 전체** | — | 전체 | 전체 |
| `activity_records` | — | 본인 AND `student_visible` | — | 담당 팀 학생분 | — | 전체 | 전체 |
| `reflections` | — | 본인 전부 / 팀원 `team_visible`↑ | `cohort_visible` | `mentor_visible`↑ | — | **—** | **—** |
| `projects` | — | 멤버인 경우 | — | 담당 | — | 전체 | 전체 |
| `studies` | — | 멤버 + 같은 기수 | 같은 기수 | 담당 기수 | — | 전체 | 전체 |
| `project_status_checks` | — | **—** | — | 담당 | — | 전체 | 전체 |
| `project_milestones` | — | 멤버인 경우 | — | 담당 | — | 전체 | 전체 |
| `meetings` | — | — | — | `mentor_visible` | `mentor_visible` | 전체 | 전체 |
| `documents` | — | — | — | `mentor_visible` | `mentor_visible` | 전체 | 전체 |
| `ops_tasks` | — | — | — | — | — | 전체 | 전체 |
| `finance_records` | — | — | — | — | — | `finance`만 | 전체 |
| `applications` / `evaluations` | — | — | — | 배정분만 | 배정분만 | `recruiting`만 | 전체 |
| `audit_logs` | — | — | — | — | — | `system`만 | 전체 |
| `communication_logs` | — | — | — | — | — | `recruiting`/`community` | 전체 |
| `external_links` | — | 부모 멤버십 ∩ `team_visible`/`cohort_visible` | 부모 기수 ∩ `cohort_visible` | 담당 프로젝트 ∩ `team_visible`/`cohort_visible` | — | 도달 가능 부모만 | 전체 |
| `attachments` | — | **—** | — | **—** | — | `private`=소유자 본인만, 그 외 전체 | 전체 |

> `reflections`의 운영진 열은 **접근 경로 자체가 없다.** 초안은 `cohort_visible`만 열어두려 했으나,
> 구현 단계에서 운영진용 조회 엔드포인트를 만들지 않기로 확정했다 — ADR-001의 "일괄 조회 경로를
> 만들 수 없게 한다"를 가장 좁게 해석한 결과다. 열람 경로는 **학생 동료**(`/student/reflections/shared`)와
> **담당 멘토**(`/mentor/reflections`) 둘뿐이며, 운영진은 어느 화면에서도 회고를 볼 수 없다.
> `meetings`/`documents`의 `mentor_visible`은 담당 여부와 무관하다 — 멘토 안내문·공지성 문서를 위한 값이기 때문이다.
>
> **`attachments`의 학생·멘토 열은 W7에서 `—`로 정정했다.** 초안은 `private`=본인 / `team_visible`=팀 /
> 멘토=담당 팀으로 적었으나, 구현에는 그 경로가 **존재한 적이 없다** — 모든 라우트가 `requireAdmin`이고
> `attachmentsTable`은 다른 파일에서 참조되지 않는다. 즉 §4.2가 금지한 "읽는 쪽 없는 값"이 그대로 남아
> 있었다. 없는 경로를 새로 만드는 대신 **열을 현실에 맞췄다**: 첨부의 실제 출처는 MarkdownEditor
> 붙여넣기(회의·문서 맥락)와 회계 영수증이며 **둘 다 운영진 전용**이라, 학생 다운로드 경로를 만드는 것은
> 제품에 없는 청중을 위해 읽는 쪽을 만드는 — 같은 실수의 반대 방향이었다.
> 학생이 실제로 첨부를 소유하게 되면 `team_visible`과 그 읽기 경로를 **같은 변경에서** 되살린다.
> 대신 `private`은 이제 **소유자 본인만**으로 집행된다(다른 운영진도 못 본다) — 그래야 `admin_only`와
> 구별되는 값이 된다.

### 5.1 폴리모픽 객체의 유효 가시성 = 교집합

`external_links`·`attachments`는 §4.2에서 **자체 `visibility` enum**을 갖는데, §5 표는 학생·멘토 열에
**"연결 객체 가시성 상속"**이라고 적는다. 이 둘은 모순이 아니라 **둘 다 통과해야 한다**는 뜻이다.
§6 체크리스트의 "폴리모픽 `linkedObjectId` 조회 시 대상 객체의 가시성까지 확인하는가?"가 같은 규칙이다.

```text
열람 가능 ⟺ (연결 객체 자체에 접근 가능)  AND  (링크의 visibility가 이 뷰어를 허용)
```

**자체 visibility만 보면 새는 이유.** `admin_only` 회의록에 붙은 링크의 visibility를 누군가
`cohort_visible`로 바꾸면, 그 회의의 존재와 자료 URL이 기수 전체에 노출된다. 회의록 본문은 막혀 있는데
링크 제목으로 내용이 새는 **측면 경로**가 된다. 그래서 교집합이다.

**"상속"의 실제 의미는 타입마다 다르다.** 구현 시 확인한 사실 — 학생·멘토 청중이 있는 부모 타입
(`project`·`study`·`session`·`cohort`·`program`)에는 **`visibility` 컬럼이 아예 없다.**
`visibility`를 가진 것은 `meetings`·`documents` 둘뿐이고, 이 둘은 §5에서 학생 접근이 `—`다.
따라서 "상속"은 **부모의 접근 규칙을 그대로 따른다**는 뜻으로 읽어야 한다:

| 부모 `linked_object_type` | 부모 접근 규칙 (§5) | 링크에서 도달 가능한 최대 청중 |
|---|---|---|
| `project` | 학생=멤버, 멘토=담당 | 팀원 · 담당 멘토 · 운영진 |
| `study` | 학생=멤버+같은 기수, 멘토=담당 기수 | 팀원 · 같은 기수 · 담당 멘토 · 운영진 |
| `session` · `cohort` · `program` | 학생=본인 기수 | 같은 기수 · 운영진 |
| `meeting` · `document` | 학생=**—**, 멘토=`mentor_visible` | 멘토(`mentor_visible`일 때) · 운영진 |
| `application` | `recruiting`만 | `recruiting` · `program_lead` |
| `finance_record` | `finance`만 | `finance` · `program_lead` |
| `ops_task` · `student` · `user` · `meeting_type` · `channel` | 운영진 전용 | 운영진 |

**결과적으로 자체 visibility 4개 값의 역할**은 "부모가 허용하는 청중을 더 좁히는 것"뿐이다.
넓히지는 못한다. `private`는 부모와 무관하게 **소유자 전용**이고, `admin_only`는 부모와 무관하게
**운영진 전용**이다. `team_visible`·`cohort_visible`은 부모가 그 청중을 갖고 있을 때만 의미가 있다.

---

## 6. 학생 가시성 회귀 방지 체크리스트

학생 라우트를 추가·수정하는 모든 변경에 적용한다.

- [ ] 새 쿼리에 `studentId = me` 또는 멤버십 조인이 **WHERE 절에** 있는가? (앱 레벨 필터링 후처리 금지)
- [ ] `visibility` 필터가 **DB 쿼리 안에** 있는가? 전체 조회 후 JS에서 거르지 않는가?
- [ ] 다른 학생의 `private` 데이터가 팀/기수 경로로 새지 않는가?
- [ ] `admin_only` 데이터가 학생 응답에 포함되지 않는가?
- [ ] 폴리모픽 `targetId`/`linkedObjectId` 조회 시 대상 객체의 가시성까지 확인하는가?
- [ ] 목록 API의 카운트·집계에 숨겨야 할 행이 반영되지 않는가? (개수로 존재가 새는 경우)
- [ ] `reflections`를 반환한다면, 운영진용 전체 조회 경로가 생기지 않았는가?

### 기존 구현의 학생 가시성 규칙 (변경 금지)

`replit.md`에 기록된 현행 규칙을 그대로 유지한다.

| 경로 | 규칙 |
|---|---|
| `student/timeline` | `studentId = me` AND `visibility = student_visible` |
| `student/artifacts` | 본인(≠`admin_only`) ∪ 팀원(`student_visible`/`cohort_visible`) ∪ 같은 기수 프로젝트(`cohort_visible`) |
| `student/projects/:id` artifacts | 본인(≠`admin_only`) ∪ 타 멤버(`student_visible`/`cohort_visible`). 타인 `private` 절대 노출 금지 |
| `student/report.feedbackHighlights` | `visibility = student_visible` AND `studentId = me` |
| `student/assignments` | `published`/`closed` AND 본인 cohort/program |
| `student/announcements` | `published` AND (`target=all` OR 본인 cohort/program) |

---

## 7. 구현 규약

### 7.1 신규 객체 추가 절차

1. 이 문서 §4에 행을 추가하고 enum·기본값·근거를 적는다.
2. §5 매트릭스에 행을 추가한다.
3. Drizzle 스키마에 `XXX_VISIBILITIES` 상수를 정의하고 `$type<>()`로 좁힌다 (기존 컨벤션).
4. 학생 라우트에 노출된다면 §6 체크리스트를 통과시키고 통합 테스트를 추가한다.

### 7.2 코드 컨벤션

기존 스키마 파일 패턴을 따른다.

```ts
export const REFLECTION_VISIBILITIES = [
  "private",
  "team_visible",
  "mentor_visible",
  "cohort_visible",
] as const;
export type ReflectionVisibility = (typeof REFLECTION_VISIBILITIES)[number];
```

- enum은 **pg enum이 아니라 text + 앱 레벨 상수**로 강제한다 (`users.role`과 동일한 방식).
- 기본값은 스키마 `.default()`에 박아 라우트가 빠뜨려도 안전하게 한다.
- visibility가 없는 객체는 라우트 미들웨어로만 게이트하고, 그 사실을 §4에 명시한다.

### 7.3 하지 않을 것

- 전역 `VISIBILITY` enum으로 통합
- 기존 4개 enum의 값 이름 변경 또는 값 추가 (`feedback`에 `mentor_visible` 추가 등)
- `reflections`에 대한 운영진 일괄 조회 API
- visibility를 역할 이름으로 무한 확장 (관계는 scope로 표현)

---

## 8. 미해결 항목

| 항목 | 상태 | 결정 시점 |
|---|---|---|
| `cohort_visible` 회고를 알럼나이가 볼 수 있는가 | 열림 | 알럼나이 기능 검토 시 |
| 졸업/기수 종료 후 가시성이 바뀌는가 (아카이브 정책) | 열림 | Phase 4 |
| 학생이 자기 `artifacts`를 외부 공개(포트폴리오)할 수 있는가 | 열림 | 성장모델 정렬(Parallel B) 이후 |
| ~~`attachments`의 서명 URL 만료 정책~~ | **해당 없음(2026-08-15)** | 서명 URL 을 쓰지 않는다. 서버 디스크에 두고 매 요청마다 권한을 확인한다 |
