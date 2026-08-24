# 설계 01 — 운영진 기능 역할과 권한 분리

> 상태: **구현 완료 (Phase A)** · 결정: ADR-002 (`extra_roles` 기능 분리)
>
> 구현 중 초안과 달라진 점 3가지:
> 1. **세션 토큰에 `opsRoles`를 넣지 않는다.** §4.2 초안은 포함하도록 했으나, 모든 게이트가 `getCurrentUser()`로 DB를 다시 읽으므로 쿠키 사본은 권한 회수를 지연시키는 stale grant일 뿐이다. `/admin/me`가 최신값을 준다.
> 2. **`admin-students.ts`의 라우트 2개를 추가로 게이트했다** (§4.3 표 참조).
> 3. **`/admin/evaluators`는 사이드바에서 숨기지 않는다.** 지원자가 아니라 멘토 *계정* 목록이고, 생성·수정은 `system` 게이트다.
> 선행: [baseline/02-core-v2.md](../baseline/02-core-v2.md) §6, [baseline/09-staff-structure-v3.md](../baseline/09-staff-structure-v3.md) §5, [visibility-policy.md](../visibility-policy.md) §3
> 대응: `gap-register.md` C1(부분 해소) · Parallel A 선행 조건

---

## 1. 문제

Seeds 운영진은 7개 기능 역할로 나뉘지만([09](../baseline/09-staff-structure-v3.md) §5), 시스템에는 `admin` 하나뿐이다.

운영진 모집(Parallel A)에서 회계/행정 담당을 새로 뽑으면, 현재 구조에서는 그 사람에게 `admin`을 줘야 하고 그 순간 **지원자 평가 결과와 불합격 사유까지 전부 열람**하게 된다. Core v2 §6.2의 "최소 필요 접근"·"민감정보 제한" 원칙과 정면으로 충돌한다.

## 2. 제약 — `extra_roles`는 재사용할 수 없다

`extra_roles`는 이미 타입이 잠겨 있다.

```ts
// lib/db/src/schema/users.ts
export const USER_ROLES = ["admin", "mentor", "student"] as const;

extraRoles: text("extra_roles").array().notNull().$type<UserRole[]>()

export function getEffectiveRoles(u): UserRole[] {
  const set = new Set<UserRole>([u.role]);
  for (const r of u.extraRoles ?? []) {
    if ((USER_ROLES as readonly string[]).includes(r)) set.add(r);  // ← 화이트리스트 필터
  }
  return Array.from(set);
}
```

`USER_ROLES`에 `finance`를 추가하면:
- `role`(primary) 컬럼에도 `finance`가 들어갈 수 있게 된다 — 의미상 틀림
- 역할 스위처 UI가 `/finance` 워크스페이스를 그리려 한다
- `requireAuth = makeRequireRole(["admin","mentor","student"])`의 의미가 흐려진다

→ **기능 역할은 별도 축으로 분리한다.**

## 3. 설계 — 2축 권한 모델

```text
축 1. 워크스페이스 접근   role + extra_roles   (admin | mentor | student)
      → "어느 workspace에 들어갈 수 있는가"     ※ 변경 없음

축 2. 기능 권한           ops_roles            (program_lead | ops | recruiting |
      → "admin workspace 안에서 무엇을 할 수      finance | growth | community | system)
         있는가"                                  ※ 신규
```

두 축은 독립이다. `ops_roles`는 `admin`을 이미 가진 사용자에게만 의미가 있다.

### 3.1 기능 역할 정의

[09 §5](../baseline/09-staff-structure-v3.md)의 운영진 역할과 1:1 대응한다.

| 코드 | 운영진 역할 | 주 담당 영역 |
|---|---|---|
| `program_lead` | Program Lead | **전체 접근.** 다른 모든 기능 역할을 포함 |
| `ops` | Ops Manager | 회의, 작업, 행사/세션, 운영 문서, 운영 대시보드 |
| `recruiting` | Recruiting Lead | 모집, 지원자, 평가, 면접, 최종 결정 |
| `finance` | Finance/Admin Lead | 회계, 정산, 증빙 |
| `growth` | Growth/Experience Lead | 프로젝트, 스터디, 피드백, 활동기록, 회고 |
| `community` | Community/Comm Lead | 공지, 사람 디렉터리, 사이트 콘텐츠, 발송 이력 |
| `system` | System/Product Lead | 사용자·기수·프로그램, 연동, 감사 로그 |

`program_lead`는 **superuser**다. 모든 `requireOpsRole(x)` 검사를 통과한다.

### 3.2 접근 정책 — read-wide, write-narrow

운영진 문화([10 §14](../baseline/10-staff-recruiting-onboarding-v3.md))는 "투명하게 공유한다"이다. 반면 Core v2 §6.2는 "민감정보 제한"을 요구한다. 둘을 이렇게 조화시킨다.

| 구분 | 대상 | 정책 |
|---|---|---|
| **제한 열람** | 회계, 모집/평가, 감사 로그, 발송 이력 | 담당 기능 역할 + `program_lead`만 **읽기·쓰기** |
| **공통 열람** | 그 외 모든 admin 라우트 | `admin` role이면 **읽기 가능** |
| **쓰기** | 그 외 모든 admin 라우트 | 담당 기능 역할 + `program_lead` (→ Phase B) |

제한 열람 대상이 곧 [02 Core v2 §7.1](../baseline/02-core-v2.md)의 "민감도 높음" 항목이다.

### 3.3 단계적 적용

한 번에 20여 개 라우트 파일을 바꾸지 않는다.

| 단계 | 범위 | 이유 |
|---|---|---|
| **Phase A** | 제한 열람 4종만 게이트 (`finance`, `recruiting`, `system`/audit, `community`/comm-logs) | 운영진 모집 전에 반드시 필요한 최소 분리 |
| **Phase B** | 나머지 admin 라우트의 쓰기 게이트 | 실제 운영진이 배치되고 역할이 안정된 뒤 |

Phase A만으로 §1의 문제(회계 담당이 평가정보를 봄)는 완전히 해소된다.

---

## 4. 구현

### 4.1 스키마

`lib/db/src/schema/users.ts`에 추가한다. 기존 export는 건드리지 않는다.

```ts
/**
 * Functional ops roles. Orthogonal to USER_ROLES (workspace access).
 * Only meaningful for users whose effective roles include "admin".
 * `program_lead` is a superuser: it satisfies every requireOpsRole check.
 */
export const OPS_ROLES = [
  "program_lead",
  "ops",
  "recruiting",
  "finance",
  "growth",
  "community",
  "system",
] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

// in usersTable:
opsRoles: text("ops_roles")
  .array()
  .notNull()
  .$type<OpsRole[]>()
  .default(sql`'{}'::text[]`),
```

헬퍼는 `getEffectiveRoles`와 같은 파일, 같은 패턴으로 둔다.

```ts
/** Ops roles, whitelist-filtered. Empty for non-admins. */
export function getOpsRoles(u: {
  role: UserRole;
  extraRoles?: UserRole[] | null;
  opsRoles?: OpsRole[] | null;
}): OpsRole[] {
  if (!getEffectiveRoles(u).includes("admin")) return [];
  const out = new Set<OpsRole>();
  for (const r of u.opsRoles ?? []) {
    if ((OPS_ROLES as readonly string[]).includes(r)) out.add(r as OpsRole);
  }
  return Array.from(out);
}

/** program_lead satisfies every functional check. */
export function hasOpsRole(u: Parameters<typeof getOpsRoles>[0], code: OpsRole): boolean {
  const roles = getOpsRoles(u);
  return roles.includes("program_lead") || roles.includes(code);
}
```

### 4.2 미들웨어

`artifacts/api-server/src/lib/auth.ts`에 추가한다. `makeRequireRole`과 동일한 응답 규약(401/403)을 따른다.

```ts
/**
 * Gate a route on a functional ops role. Implies requireAdmin.
 * `program_lead` passes every check.
 */
export function requireOpsRole(code: OpsRole): RequestHandler {
  return async (req, res, next) => {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!getEffectiveRoles(user).includes("admin")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!hasOpsRole(user, code)) {
      res.status(403).json({ error: "Forbidden", requiredOpsRole: code });
      return;
    }
    req.sessionUser = user;
    next();
  };
}
```

세션 페이로드에도 실어 프론트가 메뉴를 그릴 수 있게 한다.

```ts
// 세션: {userId, role, roles, opsRoles, exp}
// verifySessionToken은 opsRoles 부재 시 [] 로 폴백 (구 토큰 호환)
```

`GET /admin/me` 응답에 `opsRoles`를 포함한다.

### 4.3 라우트 매핑 (Phase A)

| 라우트 파일 | 현재 | 변경 후 |
|---|---|---|
| `admin-finance.ts` | `requireAdmin` | `requireOpsRole("finance")` |
| `admin.ts` (applications 계열) | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-interview.ts` | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-decision.ts` | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-assignments.ts` (평가자 배정 관리) | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-students.ts` — `POST /admin/applications/:id/convert-to-student` | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-students.ts` — `GET /admin/applications-accepted-pending` | `requireAdmin` | `requireOpsRole("recruiting")` |
| `admin-users.ts` (`POST`, `PATCH /:id`) | `requireAdmin` | `requireOpsRole("system")` |
| `admin-users.ts` (`GET`) | `requireAdmin` | **변경 없음** — 평가자 선택 UI가 의존 |
| (신규) `admin-audit-logs.ts` | — | `requireOpsRole("system")` |
| (신규) `admin-communication-logs.ts` | — | `requireOpsRole("community")` |
| **그 외 전부** | `requireAdmin` | **변경 없음** |

> `admin-students.ts`의 두 라우트는 초안에 없었으나 구현 중 발견했다. 지원자 이름·이메일·학교·합격여부를 반환하므로 `/admin/applications`와 동일한 데이터 등급이다. 나머지 학생 CRUD는 `requireAdmin`으로 남는다.

> ⚠️ `/evaluator/*`는 바꾸지 않는다. 평가 surface는 `requireAdminOrMentor` + application 단위 assignment 소유권 확인이라는 **별개의 검증 축**이다. `recruiting` 기능 역할과 혼동하면 배정받은 멘토가 평가를 못 하게 된다.

### 4.4 마이그레이션 (순서 엄수)

게이트를 먼저 켜면 기존 관리자가 잠긴다. **반드시 이 순서로 한다.**

1. 컬럼 추가 (`ops_roles`, 기본값 `{}`) — 이 시점엔 아무 동작도 바뀌지 않음
2. **백필**: 기존 `role='admin'` 또는 `extra_roles @> '{admin}'` 사용자 전원에게 `ops_roles = '{program_lead}'`
3. 부트스트랩 admin(`ADMIN_EMAIL`)이 `program_lead`를 갖도록 기동 로직 보강 — 매 기동 시 `onConflict` 갱신
4. 백필 검증: `SELECT count(*) FROM users WHERE role='admin' AND NOT ('program_lead' = ANY(ops_roles))` → **0** 확인
5. 그 다음에 라우트 게이트 적용 (4.3)

### 4.5 잠금 방지 가드

- `PATCH /admin/users/:id`에서 마지막 `program_lead`의 해당 역할 제거를 거부한다 (409 + 명확한 메시지).
- 자기 자신의 `program_lead` 제거도 동일하게 거부한다.
- `ops_roles` 변경은 `audit_logs`에 기록한다 (→ [04](04-core-infra.md)).

### 4.6 Admin UI

- `/admin/users` (또는 `/admin/students/:id`)의 역할 편집에 **기능 역할 체크박스 7개**를 추가한다. 기존 `extraRoles` 토글과 시각적으로 분리하고, "워크스페이스 접근" / "운영 기능 권한" 두 그룹으로 라벨링한다.
- Admin 사이드바는 `opsRoles`에 따라 **제한 열람 메뉴만 숨긴다.** 나머지는 전원에게 보인다(read-wide).
  - 숨김 대상: 회계, 모집/지원자, 감사 로그, 발송 이력
- 신규 화면 `/admin/roles` — 누가 어떤 기능 역할을 갖는지 한눈에 보는 표. [09 §8](../baseline/09-staff-structure-v3.md) 인수인계 구조를 지원한다.

---

## 5. 수용 기준

2026-08-24 실측. `finance` 기능 역할만 가진 임시 계정을 만들어 확인한 뒤 비활성화했다.

- [x] `finance` 기능 역할만 가진 admin이 `/admin/finance`에 접근 가능하다.
      → `GET /admin/finance-records` **200**. (경로는 `/admin/finance` 가 아니라
      `/admin/finance-records` 다 — 문서의 옛 표기를 그대로 믿으면 404 를 본다.)
- [x] 같은 사용자가 `GET /admin/applications`에 **403**을 받는다. → 403
- [x] `program_lead`는 모든 admin 라우트에 접근 가능하다.
      → applications · students · finance-records · audit-logs · people 전부 200.
- [x] `mentor`/`student`는 `ops_roles`가 무엇이든 admin 라우트에서 403을 받는다.
      → 멘토 403 · 학생 403.
- [ ] 마이그레이션 후 기존 관리자 전원이 이전과 동일하게 동작한다 (회귀 0).
      → **일회성 이행 확인이라 지금은 재현할 수 없다.** 그 마이그레이션은 이미 지났고,
      현재 활성 어드민은 `admin@seeds.local`(`program_lead`) 하나뿐이라 "전원" 을 볼
      모집단 자체가 없다. 매일 도는 검증 33/33 이 그 계정으로 통과하는 것이 지금
      확인 가능한 전부다. 실기수에서 어드민이 여럿 생기면 그때 다시 본다.
- [x] 마지막 `program_lead` 제거 시도가 409로 거부된다.
      → 2026-08-24 실측. 409 + "마지막 총괄(program_lead) 권한은 해제할 수 없습니다".
- [x] 배정받은 멘토가 `/evaluator/*`에서 평가를 계속 수행할 수 있다 (`recruiting` 없이도).
      → 스토리 E1~E4 가 매 검증에서 통과한다(멘토 계정으로 배정 조회·평가 작성·
      배정 밖 404). 라우트는 `/evaluator/assignments` 다 — `/evaluator/applications`
      가 아니다.
- [x] 구 세션 토큰(`opsRoles` 없음)으로 요청 시 500이 아니라 정상 폴백된다.
      → `GET /admin/me` 가 `opsRoles: ["program_lead"]` 를 정상 반환.
- [x] typecheck 통과. → `artifacts/api-server`·`artifacts/seeds` 양쪽 `tsc --noEmit` 0건.
      스키마는 `db push` 가 아니라 **마이그레이션 파일**로 관리한다(infrastructure.md).

## 6. 비목표

- `role_assignments`(scope 기반 역할) 도입 — 여전히 보류(P3). `ops_roles`는 **scope가 없는 기능 단위 분리**이며, "3기 담당 회계"는 표현하지 못한다. 그 요구가 실제로 발생하면 그때 도입한다.
- Phase B(쓰기 게이트 확대) — 별도 작업.
- 멘토·학생 권한 구조 변경 — 이 설계는 admin workspace 내부만 다룬다.
