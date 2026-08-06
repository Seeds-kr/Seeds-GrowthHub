# 설계 02 — Mentor Workspace와 담당 팀 연결

> 상태: **구현 완료** (DB push·런타임 검증 미완) · 결정: ADR-003 (`project_mentors` N:N), ADR-004 (담당 팀 피드백 전체 열람)
> 선행: [baseline/06-ia-v2.md](../baseline/06-ia-v2.md) §8, [baseline/05-growth-v3.md](../baseline/05-growth-v3.md) §11, [visibility-policy.md](../visibility-policy.md) §4.3
> 대응: `gap-register.md` M1, M2

---

## 1. 문제

Mentor Workspace는 [dashboard.tsx](../../artifacts/seeds/src/pages/mentor/dashboard.tsx)와 [profile.tsx](../../artifacts/seeds/src/pages/mentor/profile.tsx) 2개뿐이고, API는 `GET|PATCH /mentor/profile` 하나다([people.ts:330](../../artifacts/api-server/src/routes/people.ts:330)).

근본 원인은 화면 부재가 아니라 **데이터에 "담당 팀"이라는 개념이 없다는 것**이다. `project_members`는 `studentsTable`을 참조하므로 멘토를 넣을 수 없고, `projects`에도 멘토 컬럼이 없다.

멘토 부담 최소화([01 §6.2](../baseline/01-overview-v3.md))는 GrowthHub의 핵심 원칙인데, 정작 멘토가 담당 팀 상태를 볼 방법이 없는 상태다.

---

## 2. 데이터 모델

### 2.1 `project_mentors` (신규)

```ts
// lib/db/src/schema/project-mentors.ts
import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const MENTOR_ASSIGNMENT_STATUSES = ["active", "ended"] as const;
export type MentorAssignmentStatus = (typeof MENTOR_ASSIGNMENT_STATUSES)[number];

/**
 * Mentor ↔ project assignment. N:N — a project may have co-mentors and a
 * mentor may carry several teams. Deliberately separate from
 * `project_members`, which references `students` and stays student-only.
 *
 * Assignments are ENDED, not deleted: mentoring context must survive a
 * handover (see docs/design/02 §2.2).
 */
export const projectMentorsTable = pgTable(
  "project_mentors",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    mentorUserId: integer("mentor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Free-form note, e.g. "기술 멘토" / "프로덕트 멘토". */
    roleLabel: text("role_label"),
    status: text("status").notNull().default("active").$type<MentorAssignmentStatus>(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    assignedBy: integer("assigned_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("project_mentors_unique").on(t.projectId, t.mentorUserId),
    byMentor: index("project_mentors_mentor_idx").on(t.mentorUserId, t.status),
  }),
);
```

**설계 판단**

| 판단 | 근거 |
|---|---|
| `students`가 아니라 `users` 참조 | 멘토는 학생 계정이 아니다. `people_profiles(kind=mentor)`는 표시용이지 계정이 아니므로 `users`가 맞다 |
| N:N | 공동 멘토링과 멘토 교체를 표현해야 한다 |
| 삭제가 아니라 `status='ended'` | 담당이 끝나도 그 기간에 남긴 피드백의 맥락이 필요하다. ERD v3 §13 "삭제보다 archive" 원칙 |
| `(project_id, mentor_user_id)` UNIQUE | 같은 멘토 중복 배정 방지 |

### 2.2 담당 종료 시 접근

`status='ended'`가 되면 **그 프로젝트에 대한 멘토의 접근은 즉시 끊긴다.** `endedAt` 이후 데이터를 계속 보게 하지 않는다.

배정 이력 자체는 남으므로, 운영진은 `/admin/projects/:id`에서 "이전 담당 멘토"를 확인할 수 있다.

### 2.3 scope 해석 헬퍼

모든 멘토 라우트가 이 하나를 통과한다. 흩어진 조인 로직을 만들지 않는다.

```ts
// artifacts/api-server/src/lib/mentor-scope.ts

/** Project ids this mentor currently carries. Empty array = no access anywhere. */
export async function getMentorProjectIds(mentorUserId: number): Promise<number[]> {
  const rows = await db
    .select({ projectId: projectMentorsTable.projectId })
    .from(projectMentorsTable)
    .where(and(
      eq(projectMentorsTable.mentorUserId, mentorUserId),
      eq(projectMentorsTable.status, "active"),
    ));
  return rows.map((r) => r.projectId);
}

/**
 * True only if the mentor holds an ACTIVE assignment. Callers respond 404
 * (not 403) so a mentor cannot probe which project ids exist.
 */
export async function mentorOwnsProject(mentorUserId: number, projectId: number): Promise<boolean>
```

> 평가 surface가 `requireAdminOrMentor` 통과 후에도 핸들러에서 assignment 소유권을 재확인하는 것과 **같은 패턴**이다. `requireMentor`만으로 열리는 팀 데이터는 없다.

---

## 3. API

모두 `requireMentor` + scope 재확인. 응답에 `projectId`가 담당 목록 밖이면 404(존재 은닉)를 반환한다.

| 메서드 | 경로 | 반환 | 비고 |
|---|---|---|---|
| GET | `/mentor/teams` | 담당 프로젝트 목록 + 요약 | 팀명, 기수, 상태, 멤버 수, 최근 산출물 시각, 최근 상태체크, 미해결 지원요청 수 |
| GET | `/mentor/projects/:id` | 프로젝트 상세 | 멤버·마일스톤·산출물(≠`private`)·피드백 전체·상태체크 이력을 **한 응답에** 담는다 |
| POST | `/mentor/projects/:id/feedback` | 생성 | `authorId=me`, `targetType='project'` 서버 강제 |
| POST | `/mentor/projects/:id/status-checks` | 상태체크 작성 | 멘토 입력 최소화(§4) |
| GET | `/mentor/feedback` | 내가 쓴 피드백 전체 | 담당 프로젝트 교차 필터 |
| GET | `/mentor/dashboard` | 대시보드 집계 | 담당 팀 수, 상태체크 필요 팀, 위험 팀 |

> 구현 시 조회용 서브 리소스(`/artifacts`·`/feedback`·`/status-checks` GET)를 별도 엔드포인트로 두지 않고 **상세 응답에 합쳤다.** 화면이 어차피 전부 함께 필요하고, scope 재확인을 한 번만 하면 되기 때문이다.

### 3.1 피드백 열람 범위 (ADR-004)

```sql
-- GET /mentor/projects/:id/feedback
SELECT * FROM feedback
WHERE target_type = 'project'
  AND target_id = :projectId          -- :projectId ∈ getMentorProjectIds(me) 사전 검증
ORDER BY created_at DESC;
-- visibility 필터 없음. admin_note 포함.
```

`feedback` enum에 `mentor_visible`을 추가하지 않는다. 근거와 부작용 완화는 [visibility-policy §4.3](../visibility-policy.md) 참조.

**운영진 규칙(온보딩 문서에 명시):** 학생 관련 민감한 내부 판단은 `feedback`의 `admin_note`가 아니라 `meetings`/`documents`(둘 다 `admin_only`)에 남긴다.

### 3.2 산출물 열람 범위

```sql
SELECT * FROM artifacts
WHERE project_id = :projectId
  AND visibility <> 'private';        -- 학생 개인 미완성물은 담당 멘토에게도 비공개
```

---

## 4. 멘토 입력 최소화

[Growth v3 §11.3](../baseline/05-growth-v3.md)이 요구하는 최소 입력을 **상태체크 1개 폼**으로 통합한다. 별도의 긴 보고 양식을 만들지 않는다.

`POST /mentor/projects/:id/status-checks` 본문:

| 필드 | 필수 | 형태 |
|---|---|---|
| `teamStatus` | ✅ | `good` / `watch` / `risk` / `blocked` 중 택 1 (버튼 4개) |
| `blocker` | — | 한 줄 텍스트 |
| `nextFocus` | — | 한 줄 텍스트 |
| `needsOpsSupport` | ✅ | boolean (기본 false) |
| `opsSupportNote` | — | `needsOpsSupport=true`일 때만 |
| `comment` | — | 자유 서술 |

**목표 소요 시간 30초.** 4개 버튼 중 하나 + 체크박스만으로 제출 가능해야 한다. 나머지는 전부 선택 입력이다.

`needsOpsSupport=true`면 운영 대시보드의 "팀 지원 필요" 위젯에 즉시 뜬다([Ops v3 §12.1](../baseline/04-ops-v3.md)).

---

## 5. 화면

```text
Mentor
├─ Dashboard          (보완) 담당 팀 요약 + 상태체크 필요 알림 + 배정 평가
├─ My Teams           (신규) 담당 프로젝트 카드 목록
├─ Project Detail     (신규) 목표·멤버·마일스톤·산출물·피드백·상태체크
├─ Feedback           (신규) 내가 쓴 피드백 이력
├─ Evaluation         (유지) 기존 /evaluator surface로 링크
├─ Profile            (유지)
└─ People Directory   (유지)
```

### 5.1 My Teams 카드

한 장에 담을 것 — 멘토가 목록만 보고 **어디에 개입할지 판단**할 수 있어야 한다.

- 팀명 · 기수 · 프로젝트 상태
- 최근 상태체크: 상태 배지 + 경과일 (14일 초과 시 강조)
- 미해결 블로커 (있으면)
- 최근 산출물 등록 시각
- 바로가기: 상태체크 작성 · 피드백 작성

### 5.2 Project Detail 배치

```text
[프로젝트 목표 / 문제정의]        ← 읽기 전용
[현재 상태 · 마일스톤]
[상태체크 작성 폼]                ← 최상단 근처. 30초 입력
[최근 산출물 5건 + 전체보기]
[피드백 타임라인]                 ← 이전 멘토 것 포함 (ADR-004)
[팀 멤버 + 역할]
```

**피드백 타임라인에는 작성자·유형·작성일을 반드시 표시한다.** 이전 멘토가 남긴 것인지 운영진 노트인지 구분되지 않으면 맥락을 오해한다.

---

## 6. Admin 측 변경

- `/admin/projects/:id`에 **담당 멘토 배정 UI**를 추가한다. `POST|DELETE /admin/projects/:id/mentors`.
- 멘토 후보는 `users` 중 effective roles에 `mentor`를 포함한 사용자.
- 배정 해제는 삭제가 아니라 `status='ended'` + `endedAt` 스탬프.
- `GET /admin/projects/:id` 응답에 `mentors[]`를 추가한다 (기존 `members`/`artifacts`/`feedback`/`tags` 옆).

---

## 7. 수용 기준

- [ ] 담당 프로젝트가 없는 멘토가 `/mentor/teams`에서 빈 목록 + 안내 문구를 본다 (에러 아님).
- [ ] 담당하지 않는 프로젝트 id로 `/mentor/projects/:id` 요청 시 **404**를 받는다.
- [ ] 담당 팀의 `admin_note` 피드백이 멘토에게 보인다 (ADR-004).
- [ ] 담당 팀 학생의 `private` 산출물은 멘토에게 **보이지 않는다**.
- [ ] `status='ended'` 처리 즉시 해당 프로젝트 접근이 404가 된다.
- [ ] 상태체크를 상태 버튼 1개 + 제출로 작성할 수 있다 (다른 필드 미입력).
- [ ] `needsOpsSupport=true` 상태체크가 운영 대시보드에 나타난다.
- [ ] 한 프로젝트에 멘토 2명 배정이 가능하고, 양쪽 모두 접근된다.
- [ ] 학생 라우트 회귀 없음 — [visibility-policy §6](../visibility-policy.md) 체크리스트 통과.
- [ ] `admin`이면서 `mentor`인 사용자가 두 workspace를 오갈 때 각각의 규칙이 독립 적용된다.

## 8. 비목표

- 멘토의 학생 개인 회고 열람 — 학생이 `mentor_visible`로 공개한 경우에만. 별도 화면 없음.
- 멘토의 회계·모집 데이터 접근.
- 멘토 간 메시징 / 알림 발송.
- 멘토 활동량 집계 (감시로 읽힐 수 있음 — [외부연계 §11](../baseline/03-external-integrations.md) 원칙 준용).
