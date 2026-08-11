# 설계 03 — 성장증거 계층 (Growth Phase 3)

> 상태: **구현 완료** — 상태체크·마일스톤·`projects` 확장(W3), 스터디·회고·학생 3화면(W6) 전부 완료
>
> **ADR-001 구현 형태 (적대적 검증 후 확정):**
> - 소유자 경로 4개는 `studentId = 본인`으로 하드 스코프된다.
> - 학생이 고른 공개범위가 실제로 도달하도록 열람 경로 2개를 추가했다 —
>   `/student/reflections/shared`(팀원 `team_visible`↑ · 같은 기수 `cohort_visible`)와
>   `/mentor/reflections`(담당 팀 학생의 `mentor_visible`↑). 이게 없으면 공개범위 선택기가 거짓말이 된다.
> - **운영진 경로는 만들지 않았다.** `admin-reflections.ts`도 nav 항목도 없다.
> - 초기 구현에서는 `team_visible`/`mentor_visible`/`cohort_visible` 3개 값이
>   **읽는 쪽이 없어 죽은 값**이었다. 검증에서 드러나 위 2개 경로로 해소했다. · 결정: ADR-001 (회고 공개범위 = 학생 선택)
> 선행: [baseline/05-growth-v3.md](../baseline/05-growth-v3.md), [baseline/07-erd-v3.md](../baseline/07-erd-v3.md) §7, [visibility-policy.md](../visibility-policy.md) §4.2
> 대응: `gap-register.md` G1, G2, G3, S1

---

## 1. 범위

[Growth v3](../baseline/05-growth-v3.md)이 "성장모델 확정 전에도 유지될 가능성이 높다"고 판단한 계층만 만든다. 신규 테이블 5개다.

| 테이블 | 대응 baseline | 우선순위 |
|---|---|---|
| `project_status_checks` | Growth v3 §11.3, ERD v3 §7.9 | **최우선** — Mentor Workspace가 의존 |
| `project_milestones` | Growth v3 §7.1, ERD v3 §7.8 | 높음 |
| `studies` / `study_members` | Growth v3 §8 | 중간 |
| `reflections` | Growth v3 §12 | 중간 — 정책 민감 |

`projects` 본체는 **비파괴 확장**만 한다. 기존 컬럼·타입을 바꾸지 않는다.

### 하지 않을 것 (Growth v3 §3·§15 준수)

성장 점수, 역량별 정량 평가, 자동 성장 진단, 커밋 수 기반 기여도, 학생별 랭킹, 자동 성장 리포트. 이 설계의 어떤 필드도 점수로 집계되지 않는다.

---

## 2. `project_status_checks`

멘토·운영진이 **개입 타이밍을 잡기 위한** 신호다. 학생 평가가 아니다.

```ts
// lib/db/src/schema/project-status-checks.ts
export const TEAM_STATUSES = ["good", "watch", "risk", "blocked"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const STATUS_CHECK_VISIBILITIES = ["admin_only", "mentor_visible"] as const;
export type StatusCheckVisibility = (typeof STATUS_CHECK_VISIBILITIES)[number];

export const projectStatusChecksTable = pgTable(
  "project_status_checks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    teamStatus: text("team_status").notNull().$type<TeamStatus>(),
    blocker: text("blocker"),
    nextFocus: text("next_focus"),
    needsOpsSupport: boolean("needs_ops_support").notNull().default(false),
    opsSupportNote: text("ops_support_note"),
    /** Set when ops has picked the request up. Null = still open. */
    opsResolvedAt: timestamp("ops_resolved_at", { withTimezone: true }),
    opsResolvedBy: integer("ops_resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
    comment: text("comment"),
    visibility: text("visibility").notNull().default("mentor_visible").$type<StatusCheckVisibility>(),
    authorId: integer("author_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProject: index("project_status_checks_project_idx").on(t.projectId, t.checkedAt),
    byOpenSupport: index("project_status_checks_open_support_idx").on(t.needsOpsSupport, t.opsResolvedAt),
  }),
);
```

**학생에게 절대 노출하지 않는다.** `visibility`에 학생 값이 없고, 학생 라우트도 만들지 않는다. 팀이 `risk`로 표시된 것을 학생이 보면 신호가 아니라 낙인이 된다.

**append-only.** 수정·삭제 API를 만들지 않는다. 상태 변화 궤적 자체가 정보다. 유일한 예외는 `opsResolvedAt`/`opsResolvedBy` 스탬프.

작성 주체: 담당 멘토(→ [02 §4](02-mentor-workspace.md)) 또는 `growth`/`ops` 기능 역할 운영진.

---

## 3. `project_milestones`

```ts
export const MILESTONE_STATUSES = ["planned", "in_progress", "done", "dropped"] as const;

export const projectMilestonesTable = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: text("status").notNull().default("planned").$type<MilestoneStatus>(),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: /* ... */, updatedAt: /* ... */,
});
```

visibility 컬럼 없음 — **프로젝트 가시성을 상속**한다. 프로젝트를 볼 수 있으면 마일스톤도 본다.

`dropped`는 실패가 아니라 계획 변경이다. UI에서 부정적으로 표시하지 않는다.

## 3.1 `projects` 비파괴 확장

```ts
// projectsTable에 추가
githubUrl: text("github_url"),
demoUrl: text("demo_url"),
deckUrl: text("deck_url"),
targetUsers: text("target_users"),
```

[Growth v3 §7.2](../baseline/05-growth-v3.md)의 데이터 항목 중 누락된 것들이다. `현재 블로커`·`다음 액션`은 컬럼이 아니라 `project_status_checks`의 최신 행에서 읽는다 — 시점 정보이므로 이력이 필요하다.

> `external_links`(→[04](04-core-infra.md))와 중복되어 보이지만, 이 3개 URL은 프로젝트의 **정체성**에 해당하고 상세 화면 상단 고정 노출이 필요하므로 컬럼으로 둔다. 그 외 잡다한 링크가 `external_links`다.

---

## 4. `studies` / `study_members`

`projects` 패턴을 그대로 복제한다. 새 개념을 도입하지 않는다.

```ts
export const STUDY_STATUSES = ["planned", "active", "completed", "archived"] as const;

export const studiesTable = pgTable("studies", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohortsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => programsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  topic: text("topic"),
  description: text("description"),
  /** Study lead — a student, mirroring project_members semantics. */
  leaderStudentId: integer("leader_student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  weeklyPlanMd: text("weekly_plan_md").notNull().default(""),
  status: text("status").notNull().default("planned").$type<StudyStatus>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: /* ... */, updatedAt: /* ... */,
});

export const studyMembersTable = pgTable("study_members", {
  id: serial("id").primaryKey(),
  studyId: integer("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  role: text("role"),
  participationNote: text("participation_note"),
  createdAt: /* ... */, updatedAt: /* ... */,
}, (t) => ({ unq: uniqueIndex("study_members_unique").on(t.studyId, t.studentId) }));
```

- 스터디 자체에 visibility 없음 — 기수 내 공개가 기본이다. 자율 학습 활동을 숨길 이유가 없다.
- 주차별 계획은 별도 테이블이 아니라 `weeklyPlanMd` **Markdown 한 필드**다. [Growth v3 §8.3](../baseline/05-growth-v3.md)이 "세부 진도율 자동 평가"를 보류했으므로 구조화할 이유가 없다.
- 자료·산출물 링크는 `artifacts`에 `studyId`를 추가해 연결한다.

### 4.1 `artifacts` 확장

```ts
// mvp4ArtifactsTable에 추가
studyId: integer("study_id").references(() => studiesTable.id, { onDelete: "set null" }),
```

기존 `studentId` / `projectId` / `assignmentSubmissionId`와 같은 패턴. visibility enum은 그대로 4단계를 쓴다.

---

## 5. `reflections` — ADR-001

### 5.1 정책

**학생이 작성 시 공개 범위를 직접 고른다. 기본값은 `private`.**

운영진·멘토는 학생이 공개한 범위 안에서만 본다. **운영진용 전체 회고 조회 API를 만들지 않는다** — 이것이 "회고는 평가에 쓰이지 않는다"([Growth v3 §12.2](../baseline/05-growth-v3.md))는 원칙의 구조적 보장이다.

```ts
export const REFLECTION_VISIBILITIES = [
  "private",         // 본인만
  "team_visible",    // + 같은 프로젝트/스터디 멤버
  "mentor_visible",  // + 담당 멘토
  "cohort_visible",  // + 같은 기수 (운영진이 볼 수 있는 유일한 경로)
] as const;
```

`admin_only`가 **없는 것은 의도적이다.** enum에 없으므로 운영진 전용 회고를 만들 수도, 강제로 열람할 수도 없다.

### 5.2 스키마

```ts
export const REFLECTION_TYPES = [
  "personal", "team", "project", "study", "event", "cohort_end",
] as const;

export const reflectionsTable = pgTable("reflections", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  reflectionType: text("reflection_type").notNull().default("personal").$type<ReflectionType>(),
  /** Polymorphic target: project | study | session | cohort. Null for standalone personal notes. */
  targetType: text("target_type"),
  targetId: integer("target_id"),
  title: text("title"),
  contentMd: text("content_md").notNull(),
  visibility: text("visibility").notNull().default("private").$type<ReflectionVisibility>(),
  reflectedOn: date("reflected_on"),
  createdAt: /* ... */, updatedAt: /* ... */,
}, (t) => ({
  byStudent: index("reflections_student_idx").on(t.studentId, t.createdAt),
  byTarget: index("reflections_target_idx").on(t.targetType, t.targetId),
}));
```

### 5.3 학생 권한

학생은 자기 회고를 **수정·삭제·공개범위 변경**할 수 있다. ERD v3 §13의 "작성자 삭제/비공개 권한 검토 필요"에 대한 답이다.

- 공개범위는 **언제든 좁힐 수 있다.** 넓혔다가 되돌리는 것을 막지 않는다.
- 삭제는 hard delete를 허용한다. 회고는 감사 대상이 아니다.
- 운영진의 `audit_logs`에 회고 본문을 기록하지 않는다.

### 5.4 UI 문구

공개범위 선택 UI에 다음을 명시한다.

> 회고는 평가에 사용되지 않습니다. 공개 범위는 언제든 바꿀 수 있습니다.

`private`이 기본 선택이며, 선택지는 좁은 순서로 배열한다.

---

## 6. Student Workspace 추가

| 화면 | 경로 | 내용 |
|---|---|---|
| My Studies | `/student/studies` | 참여 스터디 목록 + 상세 |
| My Reflections | `/student/reflections` | 작성·조회·공개범위 변경 |
| My Feedback | `/student/feedback` | `studentId=me AND visibility='student_visible'` |

`My Feedback`은 신규 테이블 없이 **지금 바로 만들 수 있다** — 기존 `feedback` 테이블의 학생 필터만 재사용한다. 나머지 둘은 위 테이블에 의존한다.

### 6.1 학생 API

| 메서드 | 경로 | 규칙 |
|---|---|---|
| GET | `/student/studies` | `study_members`에 본인 ∪ 같은 기수 스터디 |
| GET | `/student/studies/:id` | 멤버이거나 같은 기수인 경우만 |
| GET | `/student/reflections` | `studentId = me` (전 범위) |
| POST/PATCH/DELETE | `/student/reflections[/:id]` | `studentId = me` 강제. `studentId` 변경 불가 |
| GET | `/student/feedback` | `studentId = me AND visibility='student_visible'` |

`student/report`·`student/timeline`에 회고를 **자동 포함시키지 않는다.** 리포트가 평가표처럼 읽힐 위험([로드맵 v3 §9.5](../baseline/08-roadmap-v3.md))을 키운다.

---

## 7. 운영진 화면

| 화면 | 내용 |
|---|---|
| `/admin/studies` | 스터디 CRUD, 멤버 관리 |
| `/admin/projects/:id` | 마일스톤 · 상태체크 이력 · 담당 멘토 섹션 추가 |
| `/admin/ops-dashboard` | "팀 지원 필요" 위젯 추가 — `needsOpsSupport=true AND opsResolvedAt IS NULL` |
| `/admin/team-status` | 전체 팀 상태 보드 (`good`/`watch`/`risk`/`blocked` 열) |

**회고 관리 화면은 만들지 않는다.** §5.1 참조.

---

## 8. 수용 기준

> **2026-08-11 검증.** 아래 항목을 하나씩 확인했다. 근거를 각 줄에 적는다 —
> 체크만 하고 근거를 안 남기면 다음 사람이 처음부터 다시 봐야 한다.

- [x] 멘토가 상태체크를 작성하면 `/admin/ops-dashboard`의 지원 필요 위젯에 반영된다.
      → **실측.** `POST /mentor/projects/2/status-checks`(`needsOpsSupport:true`) 직후
      `summary.teamSupport.openCount` 가 `0 → 1`, `items` 에 해당 팀이 들어왔다.
- [x] `project_status_checks`에 대한 학생 라우트가 **존재하지 않는다** (코드 검색으로 확인).
      → `routes/*.ts` 의 `router.*("/student…")` 중 상태체크를 다루는 것 0건.
- [x] 상태체크 수정·삭제 API가 없다 (`opsResolved*` 스탬프 제외).
      → `router.(patch|put|delete)` 중 상태체크 대상 0건. `opsResolvedAt` 은 읽기에만 쓰인다.
- [x] 학생이 `private` 회고를 작성하면 admin·mentor 어떤 경로로도 조회되지 않는다.
      → `reflectionsTable` 을 읽는 라우트 파일은 `mentor-teams.ts` · `student-growth.ts` **둘뿐**이다.
      **admin 라우트는 아예 읽지 않는다.** 멘토 경로는
      `inArray(visibility, ["mentor_visible","cohort_visible"])` 로 `private` 을 뺀다.
- [x] 운영진 라우트 전체에 `reflections` 목록 조회가 없다.
      → `router.get("/admin/…")` 중 reflection 0건, `routes/admin*.ts` 에 `reflectionsTable` 참조 0건.
- [x] 학생이 회고 공개범위를 `cohort_visible` → `private`으로 되돌릴 수 있다.
      → **실측.** 회고 #38 을 `cohort_visible` 로 만들자 `/mentor/reflections` 에 1건 보였고,
      `PATCH {visibility:"private"}` 뒤 **0건**이 됐다. 본인 목록에는 그대로 남는다.
- [x] 스터디 산출물이 `artifacts.studyId`로 연결되고 기존 visibility 규칙을 따른다.
      → `mvp4-artifacts.ts` 에 `studyId` FK, 학생 조회는 `studyMembersTable` 멤버십 조인 +
      `inArray(visibility, …)` 를 **쿼리 안에서** 건다.
- [x] `projects` 확장 후 기존 `/admin/projects/:id`와 `/student/projects/:id`가 회귀 없이 동작한다.
      → 전 라우트 훑기(`e2e/routes.mjs`) ✗ 0.
- [x] 마일스톤 `dropped` 상태가 부정적으로 표시되지 않는다.
      → 라벨 `"계획 변경"`, 색 `text-muted-foreground`(중립). 파괴적 톤 없음.
- [~] [visibility-policy §6](../visibility-policy.md) 체크리스트.
      → **개수 누수 항목만 확인했다.** `/student/studies` 의 `total` 은 `rows.length` 라
      필터와 같은 쿼리에서 나온다 — 별도 count 쿼리가 없어 `proposed`/`rejected` 가
      개수로 새지 않는다. 나머지 항목은 라우트를 새로 만들 때마다 그 변경에서 본다.

## 9. 미결 (Parallel B 이후)

- 회고와 성장해석의 연결 방식 — Phase 4
- `skill_tags` 재정의 — 현재는 임시 분류 태그 유지
- 스터디 참여도의 성장증거 해석 — 보류
- 학생 리포트에 어떤 증거를 노출할지 — 성장모델 정렬 후
