# 설계 04 — Core 인프라 (감사·링크·첨부·발송)

> 상태: **구현 완료** — `audit_logs`·`attachments`(W5), `communication_logs`(W10), `external_links`(W7) 전부 완료
>
> 구현 중 확정한 사항: `attachments`는 `fileUrl` 대신 **`objectPath`** 를 저장한다. 공개 URL 컬럼을 두면 실수로 노출될 여지가 남기 때문에, 저장 경로는 서버 내부에만 두고 다운로드는 `GET /api/attachments/:id/download`만 통과시킨다.
>
> **W7에서 확정한 두 가지.**
> ① `external_links` 읽기는 자체 `visibility`만 보지 않고 **부모 도달 가능성과 교집합**을 취한다
> ([visibility-policy §5.1](../visibility-policy.md)). 자체 값만 보면 `admin_only` 회의록에 붙은 링크를
> `cohort_visible`로 바꿔 회의 존재와 자료 URL을 기수 전체에 흘릴 수 있다. 판정은 전부
> `artifacts/api-server/src/lib/external-link-scope.ts` 한 곳을 지난다.
> ② 부모에 청중이 없는 visibility는 **쓰기 시점에 422로 거부**한다 — `meeting`에 `cohort_visible`을
> 저장하면 읽기에서 걸러져 아무 효과 없는 값이 남고, 그게 §4.2가 말하는 죽은 값이다.
> `attachments`의 `team_visible`은 같은 이유로 **제거**했다(읽는 쪽이 없었다).
> 선행: [baseline/02-core-v2.md](../baseline/02-core-v2.md) §9~11, [baseline/03-external-integrations.md](../baseline/03-external-integrations.md) §13, [visibility-policy.md](../visibility-policy.md) §4.2
> 대응: `gap-register.md` C2, EX1, EX2, OF2

---

## 1. 범위

운영·성장 시스템이 공유하는 횡단 객체 4개. 어느 도메인에도 속하지 않고 **모든 도메인이 참조**한다.

| 테이블 | 목적 | 우선순위 |
|---|---|---|
| `audit_logs` | 민감정보·권한 변경 추적 | 높음 — [01 권한 분리](01-role-permissions.md)가 요구 |
| `external_links` | 외부 URL + 연결 맥락 | 중간 |
| `attachments` | 업로드 파일 메타데이터 | 중간 — 회계 증빙이 의존 |
| `communication_logs` | Email/SMS 발송 이력 | 낮음 — 수동 기록부터 |

`calendar_events`는 이번 범위에서 제외한다. [외부연계 §7.5](../baseline/03-external-integrations.md)가 "초기에는 GrowthHub 내부 일정이 source of truth"라 했고, 현재 `sessions`+`ops_tasks.dueDate`가 그 역할을 하고 있다. 별도 일정 객체가 필요해지는 시점까지 미룬다.

---

## 2. 폴리모픽 연결 규약

세 객체 모두 `linked_object_type` + `linked_object_id`로 임의 객체에 붙는다. ERD v3 §12가 지적한 무결성 약점을 아래 규약으로 보완한다.

```ts
// lib/db/src/schema/_linkable.ts — 단일 화이트리스트
export const LINKABLE_TYPES = [
  "cohort", "program", "session", "project", "study", "meeting",
  "ops_task", "document", "application", "finance_record", "student", "user",
  "meeting_type",   // 회의록 템플릿 (ADR-006)
  "channel",        // communication_logs 의 Discord 채널
] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];
```

**규약 4가지**

1. `linked_object_type`은 위 화이트리스트로만 제한한다 (`$type<LinkableType>()`).
2. 생성 시 앱 레벨에서 **대상 객체 존재를 검증**한다. 없으면 422.
3. FK를 걸지 않으므로 orphan이 생길 수 있다 → 조회 시 대상 부재를 **에러가 아니라 빈 값으로 처리**한다 (기존 `finance_records`가 이미 이 방식).
4. 삭제된 대상을 참조하는 행은 정리하지 않고 남긴다. `audit_logs`는 특히 그렇다.

기존 `finance_records.linked_object_type`(session/cohort/project/document)도 이 상수를 쓰도록 통일한다. 값은 부분집합이므로 데이터 마이그레이션이 필요 없다.

---

## 3. `audit_logs`

민감정보 변경과 주요 상태 변경만 기록한다. 전체 감사 로그가 아니다.

```ts
export const AUDIT_ACTIONS = [
  "role_change",        // extra_roles / ops_roles 변경
  "visibility_change",  // 객체 공개범위 변경
  "finance_status",     // 회계 상태 전이
  "decision_change",    // 최종 합격 결정 (기존 decision_logs와 병행)
  "permission_denied",  // 반복 403 — 권한 오배정 탐지
  "data_export",        // CSV 내보내기
  "account_activation", // 계정 활성화 / 토큰 재발급
] as const;

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull().$type<AuditAction>(),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetType: text("target_type").$type<LinkableType>(),
  targetId: integer("target_id"),
  /** Before/after snapshot of the CHANGED FIELDS ONLY. Never full rows. */
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  note: text("note"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byAction: index("audit_logs_action_idx").on(t.action, t.createdAt),
  byTarget: index("audit_logs_target_idx").on(t.targetType, t.targetId),
  byActor: index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
}));
```

**원칙**

- **Append-only.** UPDATE/DELETE API 없음. `decision_logs`와 동일한 취급.
- **본문을 남기지 않는다.** `beforeJson`/`afterJson`에는 **변경된 필드만** 담는다. 피드백·회고·회의록 본문은 절대 기록하지 않는다.
- `reflections`는 감사 대상이 아니다 — [03 §5.3](03-growth-evidence.md).
- 접근: `system` 기능 역할 + `program_lead`만 ([visibility-policy §5](../visibility-policy.md)).
- IP는 해시로만 저장한다.
- 기존 `decision_logs`는 **유지한다.** 모집 도메인 전용 로그로 두고 `audit_logs`가 흡수하지 않는다 (기존 API 호환).

### 3.1 기록 지점 (Phase A)

| 지점 | action |
|---|---|
| `PATCH /admin/users/:id` — `extraRoles`/`opsRoles` 변경 | `role_change` |
| `PATCH /admin/finance-records/:id` — status 전이 | `finance_status` |
| `GET /admin/applications/export` | `data_export` |
| `POST /admin/users/:id/activation-token` | `account_activation` |
| 모든 `requireOpsRole` 403 | `permission_denied` |

`visibility_change`는 Phase B — 대상 객체가 많아 일괄 도입이 낫다.

---

## 4. `external_links`

```ts
export const LINK_TYPES = [
  "github_repo", "github_pr", "github_issue", "readme", "release",
  "demo", "deck", "drive", "notion", "discord", "figma",
  "issue_board", "blog", "other",
] as const;

export const EXTERNAL_LINK_VISIBILITIES = [
  "private", "team_visible", "cohort_visible", "admin_only",
] as const;

export const externalLinksTable = pgTable("external_links", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  linkType: text("link_type").notNull().default("other").$type<LinkType>(),
  description: text("description"),
  linkedObjectType: text("linked_object_type").notNull().$type<LinkableType>(),
  linkedObjectId: integer("linked_object_id").notNull(),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  visibility: text("visibility").notNull().default("admin_only").$type<ExternalLinkVisibility>(),
  /** Manual freshness marker — "이 링크 아직 유효함" 확인 시각. */
  freshnessCheckedAt: timestamp("freshness_checked_at", { withTimezone: true }),
  createdAt: /* ... */, updatedAt: /* ... */,
}, (t) => ({
  byLinked: index("external_links_linked_idx").on(t.linkedObjectType, t.linkedObjectId),
}));
```

**`artifacts`와의 경계** — 자주 헷갈리므로 명시한다.

| | `artifacts` | `external_links` |
|---|---|---|
| 성격 | **학생이 만든 성장증거** | 참조용 외부 자료 |
| 소유 | 학생/프로젝트/스터디 | 임의 객체 (회의, 모집, 기수, 회계…) |
| 용도 | 포트폴리오화, 성장 해석의 원자료 | 운영 맥락 유지 |
| 예 | 팀이 만든 데모, 발표자료, repo | Discord 채널, Drive 운영자료, 참고 문서 |

프로젝트의 GitHub/데모/발표자료 **대표 URL 3개는 `projects` 컬럼**이다(→ [03 §3.1](03-growth-evidence.md)). 그 외 부가 링크가 `external_links`다.

**하지 않을 것** ([외부연계 §4.4·§5.4](../baseline/03-external-integrations.md)): 링크 대상의 활동량 자동 수집, 커밋 수 집계, 학생별 랭킹. `freshnessCheckedAt`도 **수동 확인**이며 자동 크롤링하지 않는다.

---

## 5. `attachments`

```ts
export const ATTACHMENT_VISIBILITIES = ["private", "team_visible", "admin_only"] as const;

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  /** Storage object path, NOT a public URL — see §5 note below. */
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  linkedObjectType: text("linked_object_type").notNull().$type<LinkableType>(),
  linkedObjectId: integer("linked_object_id").notNull(),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  visibility: text("visibility").notNull().default("admin_only").$type<AttachmentVisibility>(),
  createdAt: /* ... */,
}, (t) => ({
  byLinked: index("attachments_linked_idx").on(t.linkedObjectType, t.linkedObjectId),
}));
```

**Object Storage ACL과의 관계**

현재 `GET /api/storage/objects/*`는 **인증 없이** `visibility=public` 오브젝트만 서빙한다(아바타용). `attachments`는 그 경로를 쓰지 않는다.

```text
아바타          → ACL visibility=public  → 비인증 서빙 (현행 유지)
attachments     → ACL visibility=private → 인증 게이트 라우트로만 서빙
```

신규 라우트 `GET /api/attachments/:id/download`가 DB의 `visibility` + scope를 확인한 뒤 스트리밍한다. **영수증 URL이 인증 없이 열리는 경로를 절대 만들지 않는다.**

> **구현 시 변경:** 초안의 `fileUrl` 대신 **`objectPath`** 를 저장한다. URL 형태의 컬럼을 두면 어딘가에서 그대로 렌더되어 노출될 여지가 남는다. 저장 경로는 서버 내부에만 두고, 클라이언트에는 `/api/attachments/:id/download`만 준다. 리다이렉트도 하지 않고 확인 후 스트리밍한다.
>
> `linkedObjectType='finance_record'`인 첨부는 클라이언트가 무엇을 보내든 서버가 `admin_only`로 **덮어쓴다.**

`finance_records.receipt_url`은 당분간 유지하되, 신규 증빙은 `attachments`(`linkedObjectType='finance_record'`)로 등록한다. 회계 증빙 attachment는 `admin_only` 고정이며 `finance` 기능 역할로 게이트한다.

---

## 6. `communication_logs`

[외부연계 §8.5](../baseline/03-external-integrations.md)의 필드를 그대로 채택한다.

```ts
export const COMM_CHANNELS = ["email", "sms", "discord", "manual"] as const;
export const COMM_STATUSES = ["queued", "sent", "failed", "bounced"] as const;

export const communicationLogsTable = pgTable("communication_logs", {
  id: serial("id").primaryKey(),
  recipientType: text("recipient_type").$type<LinkableType>(),  // application | student | user
  recipientId: integer("recipient_id"),
  recipientAddress: text("recipient_address"),   // 이메일/번호 (감사 목적)
  channel: text("channel").notNull().$type<CommChannel>(),
  templateId: text("template_id"),
  subject: text("subject"),
  relatedObjectType: text("related_object_type").$type<LinkableType>(),
  relatedObjectId: integer("related_object_id"),
  status: text("status").notNull().default("queued").$type<CommStatus>(),
  failureReason: text("failure_reason"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: /* ... */,
});
```

**발송 도구 연동 전에도 수동 기록용으로 먼저 만든다.** `channel='manual'`로 "누구에게 무엇을 안내했는지"를 남기는 것만으로도 모집 운영에서 값이 있다.

**본문을 저장하지 않는다** — `subject`와 `templateId`까지만. 개인정보 노출면을 줄인다.

접근: `recruiting` 또는 `community` 기능 역할 + `program_lead`.

---

## 7. 수용 기준

- [ ] `ops_roles` 변경 시 `audit_logs`에 `role_change`가 남고, before/after에 **변경된 필드만** 담긴다.
- [ ] `audit_logs`에 UPDATE/DELETE API가 없다.
- [ ] `system` 기능 역할이 없는 admin이 `/admin/audit-logs`에서 403을 받는다.
- [ ] 존재하지 않는 `linked_object_id`로 링크/첨부 생성 시 422를 받는다.
- [ ] 삭제된 대상을 참조하는 링크 조회 시 500이 아니라 대상 없음 표시로 처리된다.
- [ ] `attachments` 파일이 비인증 `GET /api/storage/objects/*`로 열리지 않는다 (404).
- [ ] 회계 증빙 attachment가 `finance` 기능 역할 없이 다운로드되지 않는다.
- [ ] 아바타 서빙(`visibility=public`)이 회귀 없이 동작한다.
- [ ] `communication_logs`에 본문 컬럼이 없다.
- [ ] `finance_records`의 기존 `linked_object_type` 값이 마이그레이션 없이 계속 유효하다.

### W7 `external_links` — 런타임 확인 완료 (2026-07-30)

스크래치 DB + 실제 HTTP 요청으로 확인한 것. 응답 코드는 실측값이다.

- [x] 없는 대상 id → **422**, 화이트리스트 밖 타입(`channel`) → **422**.
- [x] 부모에 청중 없는 visibility 거부: `document`+`cohort_visible` → **422**, `cohort`+`team_visible` → **422**.
- [x] 교집합 동작: `project 1`의 `team_visible` 링크를 그 팀 학생과 담당 멘토만 봄.
      같은 값이라도 **미소속 `project 2`** 링크는 안 보임.
- [x] `private`이 `admin_only`와 구별됨: 소유자만 보고 **다른 운영진은 못 본다**. 4개 값 전부 읽는 쪽 있음.
- [x] 부모 ops 게이트: `community` 전용 admin은 `finance_record` 링크를 목록·생성·수정 전부 **404**.
      `finance` 보유자와 `program_lead`는 접근 가능.
- [x] 권한 밖은 **404**(§5.5): 남의 `private` PATCH → 404. 학생이 ops 라우트 → 403.
- [x] `attachments` 소유자 전용화: 목록에서 남의 `private` 제외, 다운로드·삭제 **404** + 행 보존 확인.

**남은 것: 프론트 화면이 없다.** API만 존재하며 `/admin/*`에 링크 관리 UI를 붙이지 않았다
(W8 placeholder 정리와 함께 배치하는 것이 자연스럽다). 학생·멘토 목록 화면도 없다.

## 8. 비목표

- 자동 sync (`sync_logs`, `integration_accounts`) — [외부연계 §14](../baseline/03-external-integrations.md)의 "링크 기반 우선" 유지
- 링크 유효성 자동 검사 / 크롤링
- `calendar_events` — §1 참조
- 전체 요청 감사 로그 (민감 액션만)
- 파일 바이러스 검사·만료 URL — Object Storage 확장 시
