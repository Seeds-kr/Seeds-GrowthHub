# 핸드오프 — Seeds GrowthHub

> 작성: 2026-07-30 · 로컬 세션 → 원격(Harvester) 인계용
> 이 문서만 읽고 이어받을 수 있게 쓴 것이다. 세부는 각 링크를 따라간다.
> 원격 에이전트에게 줄 킥오프 프롬프트는 [REMOTE-KICKOFF.md](REMOTE-KICKOFF.md)에 있다.

---

## 0. 30초 요약

설계 문서 세트를 만들고, **11개 Wave 전부 구현했다**(W1~W11). 전체 typecheck·빌드 통과.
빈 placeholder 화면은 **0개**다.

남은 것은 구현이 아니라 **검증**이다 — 아래 §6의 "아직 검증 안 된 것"을 볼 것.

**⚠️ 이어받자마자 해야 할 것**

1. **DB 스키마 푸시** — 신규 테이블 10개·컬럼 7개가 코드에는 있으나 DB에는 없다. 푸시 전에는 **로그인부터 실패**한다(§2).
   스크래치 DB에서는 통과를 확인했으나, **기존 데이터가 있는 DB에서는 아직 돌려본 적이 없다.**
2. **브라우저 검증** — API 표면은 실제 요청/응답으로 확인했다(§6 표). 다만 **화면을 브라우저로 연 적이 한 번도 없다.**
   특히 W11(반응형)은 375px 실측·드래그앤드롭·`DesktopOnly` 배너가 전부 미검증이다.

---

## 1. 지금 상태

| 축 | 시작 | 현재 |
|---|---:|---:|
| 데이터 테이블 | 31 | **41** (W7 `external_links` 포함, 스키마 푸시로 실측) |
| 화면(라우트) | 66 | **77** (`App.tsx` `<Route>` 81개 = 중복 경로 포함, placeholder 0) |
| 빈 placeholder 화면 | 11 | **0** |
| 반응형 등급이 선언된 라우트 | 0 | **81 / 81** |

### Wave 진행

```text
권한/인프라   W1 ✅ → W5 ✅ → W7 ✅
멘토/성장     W2 ✅ → W3 ✅ → W4 ✅ · W6 ✅
제품 경험     W9 ✅ → W10 ✅ → W11 ✅
마감          W8 ✅ (실체화 4 · 제거 4)
```

| Wave | 내용 | 상태 |
|---|---|---|
| W1 | `ops_roles` 기능 역할 + `requireOpsRole` 게이트 + 백필 | ✅ |
| W2 | `project_mentors` N:N + scope 헬퍼 + Admin 배정 UI | ✅ |
| W3 | `project_status_checks`·`project_milestones` + `projects` 확장 | ✅ |
| W4 | Mentor Workspace (My Teams · Project Detail · Feedback) | ✅ |
| W5 | `audit_logs` · `attachments` + 인증 게이트 다운로드 | ✅ |
| W6 | `studies`·`study_members`·`reflections` + 학생 화면 4종 | ✅ |
| W9 | MarkdownEditor 툴바 + 회의록 유형별 템플릿 + `bodyMd` 이관 | ✅ |
| W10 | Discord 웹훅 + 인앱 배지 + cron 요약 | ✅ |
| W11 | 반응형 A/B/C 등급 + `DesktopOnly` 가드 + 작업 보드 드래그 | ✅ |
| W7 | `external_links` (API·권한 완료, 화면 없음) | ✅ |
| W8 | placeholder 8개 → **실체화 4**(미디어·면접·출석·리포트) **제거 4**(회원·공개페이지·외부연동·설정) | ✅ |

Wave 정의는 [`design/README.md` §4](design/README.md), 완성 형상은 [`design/00-target-state.md`](design/00-target-state.md).

---

## 2. ⚠️ 먼저 실행: DB 스키마 푸시

코드가 신규 컬럼을 SELECT하므로, **푸시 전에는 `users` 조회가 실패해 로그인이 안 된다.**

```bash
pnpm --filter @workspace/db run push
```

### 신규 테이블 10개

`project_mentors` · `project_status_checks` · `project_milestones` · `studies` · `study_members` · `reflections` · `audit_logs` · `attachments` · `communication_logs` · `external_links`(W7)

### 기존 테이블 신규 컬럼 (7개)

| 테이블 | 컬럼 |
|---|---|
| `users` | `ops_roles text[]` |
| `projects` | `github_url` · `demo_url` · `deck_url` · `target_users` |
| `meetings` | `body_md` |
| `artifacts` | `study_id` |

### 기동 시 자동 실행되는 것 (순서 중요)

`artifacts/api-server/src/index.ts`가 순서대로 돌린다.

1. **`backfillOpsRolesOnce()`** — 기존 admin 전원에게 `program_lead` 부여.
   **반드시 `bootstrapAdminFromEnv()`보다 먼저** 돈다. 순서가 바뀌면 부트스트랩 계정만 권한을 받고 나머지 관리자가 잠긴다. 이 가드는 "아무도 ops role을 안 가진 상태"에서만 동작하므로 한 번만 실행된다.
2. `bootstrapAdminFromEnv()` — 부트스트랩 admin에 `program_lead` 보장
3. `bootstrapMeetingTemplates()` — 회의 유형별 템플릿 **7종**을 `documents` 행으로 시딩
   (기동 로그 `created: 7` 실측. `MEETING_TYPES` 7종 = 일반·운영·기획·회고·멘토·외부·기타.
   문서에 "6종"으로 적혀 있던 것을 바로잡았다.)
4. `backfillMeetingBodies()` — 구 `agenda/pending/notes` → `body_md` 병합 (빈 행만)

### 푸시 후 확인

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM users WHERE role='admin' AND NOT ('program_lead' = ANY(ops_roles))"
```

**0이어야 한다.** 0이 아니면 백필이 안 돌았거나 순서가 꼬인 것이다.

> ⚠️ **이건 "푸시 직후 첫 기동" 1회용 검사다. 상시 헬스체크가 아니다.**
> 이후 누군가 기능 역할을 정상적으로 편집하면 값이 0이 아니게 되고, 그건 버그가 아니다.
> 예: `finance` 전용 관리자를 만들면(`role='admin'` + `ops_roles={finance}`) 이 쿼리에 잡힌다 —
> 오히려 W1 권한 분리가 의도대로 동작한다는 증거다.
> 실제로 이 세션에서 409 가드를 시험하며 권한을 벗긴 계정 + finance 전용 계정 때문에
> 나중에 `2`가 나왔고, 백필과는 무관했다. **0이 아닐 때는 백필을 의심하기 전에
> `SELECT id,email,role,ops_roles FROM users`로 누가 왜 걸렸는지 먼저 볼 것.**
>
> 백필이 실제로 안 돈 것인지 구분하는 방법: **기동 로그에
> `backfilled ops_roles=program_lead for existing admins`가 있는지** 본다.
> 2회차 이후 기동에는 이 줄이 **없는 게 정상**이다(가드가 조기 반환).
> 재부팅 후 재기동으로 확인했다 — 가드는 멱등이고, **의도적으로 벗긴 권한을 되돌리지 않는다.**

---

## 3. 신규 환경변수 — 전부 선택

없으면 해당 기능만 조용히 꺼지고, 앱은 정상 동작한다.

| 변수 | 용도 | 없을 때 |
|---|---|---|
| `SEEDS_DISCORD_OPS_WEBHOOK_URL` | 운영진 채널 알림 | 알림 스킵 (`logger.debug`) |
| `SEEDS_DISCORD_MENTOR_WEBHOOK_URL` | 멘토 채널 알림 | 동일 |
| `APP_BASE_URL` | 알림 딥링크 생성 | 링크 없이 발송 |
| `CRON_SECRET` | `POST /internal/cron/*` 인증 | 해당 라우트 503 |

---

## 4. 설계 문서 지도

읽는 순서가 정해져 있다.

```text
docs/baseline/          원본 11종 — 무엇을·왜 (Seeds가 준 기준본)
  ↓
docs/gap-register.md    현재 구현 ↔ baseline 대조 감사
  ↓
docs/visibility-policy.md   ★ 가시성 정책 — 누가 무엇을 보는가의 단일 진실
  ↓
docs/design/00-target-state.md   ★ 완성 형상 (여기부터 읽으면 전경이 잡힌다)
docs/design/01~05                 실행 명세 (스키마·API·수용기준)
```

**신규 객체를 추가할 때는 `visibility-policy.md` §4 매트릭스에 행을 먼저 추가한 뒤 구현한다.** §7.1이 절차다.

### 결정 기록 (ADR) — 뒤집으려면 영향 범위부터

| # | 결정 | 문서 |
|---|---|---|
| 001 | 회고 공개범위는 학생이 정한다. enum에 `admin_only` 없음 | [design/README §2](design/README.md) |
| 002 | 기능 역할은 `extra_roles`가 아니라 별도 축(`ops_roles`) | 동일 |
| 003 | 멘토↔프로젝트는 N:N 별도 테이블, 해제는 `status='ended'` | 동일 |
| 004 | 멘토는 담당 팀 피드백 전부 열람 (scope 기반, enum 확장 아님) | 동일 |
| 005 | 마크다운 유지 + 툴바. 블록 에디터 도입 안 함 | [design/05 §2](design/05-product-experience.md) |
| 006 | 회의록은 유형별 템플릿, 결정·액션만 공통 강제 | 동일 |
| 007 | 알림은 Discord 웹훅 + 인앱 배지 (이메일 없음) | 동일 |
| 008 | 데스크톱 우선, 모바일은 읽기만 보장 | 동일 |

> **007과 008은 묶여 있다.** 알림을 빼면서 모바일도 포기하면 멘토는 담당 팀 문제를 알 방법도 알릴 방법도 없다.

---

## 5. 넘겨받을 때 알아야 할 함정

### 5.1 `api()` 헬퍼 경로 규약

`lib/mvp3-api.ts`의 `api()`는 **이미 `/api`를 붙인다.** `api("/admin/users")`가 맞고 `api("/api/admin/users")`는 `/api/api/...`로 나간다. 이 버그가 있어 `/admin/users` 화면과 운영 대시보드 요약이 로드되지 않던 것을 고쳤다. 신규 호출 시 주의.

### 5.2 최근 기능은 OpenAPI에 없다

`meetings`·`ops_tasks`·`documents`·`finance`·`projects` 등 최근 추가분은 **raw `api()` 호출**이고 `openapi.yaml`에 등록돼 있지 않다. orval 생성 훅을 쓰는 것은 MVP1/2 표면(users·applications·login)뿐이다. 신규 기능은 이웃 코드(raw `api()`)를 따르는 게 일관적이다.

### 5.3 `attached_assets`의 NFC/NFD 중복

macOS 체크아웃 때문에 한글 파일명이 NFD로 커밋돼 있고 NFC로 보인다. `git status`에 14개가 untracked로 뜨지만 **같은 파일이다.** `git add -A` 하면 중복이 커밋되므로 **`attached_assets`는 건드리지 말 것.** 이번 커밋도 제외했다.

### 5.4 `requireOpsRole`을 `/evaluator/*`에 붙이지 말 것

평가 표면은 `requireAdminOrMentor` + 지원서 단위 assignment 소유권 재확인이라는 **별개 축**이다. `recruiting` 기능 역할로 게이트하면 배정받은 멘토가 평가를 못 하게 된다. `auth.ts`와 `design/01 §4.3`에 경고를 달아뒀다.

### 5.5 404 vs 403

멘토 scope와 학생 과제 라우트는 **권한 밖이어도 404**를 준다. 403으로 갈리면 id 열거로 존재가 샌다. 신규 scope 라우트도 이 규칙을 따를 것.

### 5.6 멘토 **프로필**과 멘토 **계정**은 별개다 (첫 설치 함정)

`mentor-seed.ts`는 기동할 때마다 실제 멘토 로스터 9명을 `people_profiles`에
넣는데 **`user_id`가 비어 있다.** 그래서 갓 설치한 시스템은 이렇게 된다.

```text
/admin/people        멘토 9명 보임
/admin/users?role=mentor   0명
→ 프로젝트 상세의 "멘토 선택…" 드롭다운이 빈 채로 열린다
→ 상태체크·ADR-004 피드백·Mentor Workspace 전체가 조용히 막힌다
```

배정은 **계정**(`project_mentors.mentor_user_id`) 기준이지 프로필 기준이 아니다.
서버는 `해당 계정은 멘토 역할이 없습니다.`(422)로 거부한다.

여는 방법은 두 단계다 — `/admin/users`에서 `role=mentor` 계정을 만들고,
`/admin/people`에서 그 계정을 프로필에 연결한다.
W8 이후 두 화면 모두 이 상태를 표시한다(빈 드롭다운 자리의 안내, 프로필 목록의
`계정 미연결` 배지). **자동 생성하지 않는 것은 의도적이다** — 실제 사람 9명에게
동의 없이 로그인 계정을 만들어줄 수는 없다.

### 5.7 루트 `pnpm run build`는 `PORT`·`BASE_PATH`를 요구한다

`mockup-sandbox`의 `vite.config.ts`에는 `seeds`에 있는 `isServe` 가드가 **없어서**, 빌드에도
두 변수를 요구한다. 없으면 이렇게 죽는데, 원인이 코드처럼 보여서 헷갈린다.

```text
failed to load config from artifacts/mockup-sandbox/vite.config.ts
Error: BASE_PATH environment variable is required but was not provided.
```

```bash
PORT=8080 BASE_PATH=/ pnpm run build
```

`pnpm run typecheck`과 `--filter @workspace/seeds run build`는 영향을 받지 않는다.
(`seeds`는 `serve`/`dev`/`preview`일 때만 요구하도록 가드가 있다. 언젠가 `mockup-sandbox`에도
같은 가드를 넣는 게 맞다.)

---

## 6. 검증 상태 — 무엇이 검증됐고 무엇이 아닌가

### 검증된 것

| 항목 | 방법 |
|---|---|
| 전체 typecheck (4개 워크스페이스) | `pnpm run typecheck` |
| api-server 빌드 | `pnpm --filter @workspace/api-server run build` |
| 권한 경계 20 케이스 | `getOpsRoles`/`hasOpsRole` 번들 후 node 실행 |
| 마크다운 삽입 14 케이스 | `applyEdit` 순수함수 실행 |
| 감사 필드 필터 18 케이스 | `diffFields` 실행 — 본문 denylist 12종 차단 확인 |
| 멘토 라우트 scope 6/6 | 정적 감사 |
| 회고 소유권 4/4 | 정적 감사 |
| ADR 준수 15 + 21 + 12 항목 | 정적 감사 |

### 런타임 검증 (2026-07-30, 원격 세션에서 추가)

로컬 스크래치 Postgres 16(도커, 포트 5434 — 기존 `lala_postgres`와 무관)에 푸시하고
api-server를 실제로 띄워 확인했다. **아래는 HTTP 요청/응답으로 확인한 것이다.**

| 항목 | 결과 |
|---|---|
| `drizzle-kit push` | 통과. 테이블 **41개** · 신규 10개 · 신규 컬럼 7개 실측 |
| 백필 순서 (ADR-002) | **실측.** 빈 DB로는 공허하게 통과하므로 `ops_roles={}`인 기존 admin 3명(`role='admin'` 2 + `extra_roles={admin}` 1)을 먼저 심고 기동 → `count:3` 백필, 학생·일반 멘토는 미부여. 검증 쿼리 **0** |
| 백필 멱등성 | **실측.** 재부팅 후 재기동 시 백필 로그 없음 = 조기 반환. 의도적으로 벗긴 권한을 되돌리지 않는다 |
| 관리자 로그인 · 세션 쿠키 | 200, `seeds_admin` 쿠키 발급, `/admin/me` 200 |
| `/admin/ops-dashboard/summary` | 200 |
| `/admin/users` 목록 · 기능 역할 편집 | 200 / `PATCH opsRoles` 200 |
| `requireOpsRole` 403 게이트 (W1 게이트) | `finance` 담당 → `/admin/applications` **403**, 자기 표면 `/admin/finance-records` **200** |
| 권한 상승 차단 | `finance` 담당이 자신에게 `program_lead` 부여 시도 → **403**, DB 미반영 확인 |
| 마지막 `program_lead` 409 가드 | 해제 **409** · 비활성화 **409** 양쪽 |
| 멘토 scope · 404 vs 403 (§5.5) | 담당 팀 200, 미담당 팀 **404**, 없는 id **404** — 응답 본문까지 동일해 열거 누출 없음 |
| 회고 4개 visibility 읽기 경로 | **전부 살아 있음.** `private` 소유자 전용 → `mentor_visible` 멘토 O · `team_visible` 멘토 X · `cohort_visible` 멘토 O, 팀원은 3개 값 전부 열람 = §2 확장 사다리와 일치 |
| ADR-001 구조 보장 | `/admin/reflections` 류 **404**, `reflectionsTable` 참조가 `student-growth.ts`·`mentor-teams.ts` 두 파일뿐 |
| 회고 소유권 | 타 학생 `PATCH`/`DELETE` **404** |
| `audit_logs` | `permission_denied`·`role_change` 기록 확인 |
| 작업 상태 PATCH (드래그 대상) | 6개 컬럼 전부 200, 잘못된 status **400** |
| W7 `external_links` 교집합 | **실측.** 담당 팀 학생·멘토만 `team_visible` 링크 열람, 미소속 프로젝트 링크는 같은 값이어도 안 보임 |
| W7 부모 청중 검증 | `document`+`cohort_visible` **422**, `cohort`+`team_visible` **422**, 없는 대상 **422**, `channel` 타입 **422** |
| W7 부모 ops 게이트 | `community` 전용 admin → `finance_record` 링크 목록·생성·수정 전부 **404**. `finance`·`program_lead`는 접근 |
| W7 `private` ≠ `admin_only` | 소유자만 열람, **다른 운영진은 못 봄**. 4개 값 전부 읽는 쪽 있음 |
| `attachments` 소유자 전용화 | 남의 `private`은 목록 제외 · 다운로드 **404** · 삭제 **404**(행 보존 확인) |
| W8 출석 집계 산식 | **실측.** 4회 모임 기준 (출석2+지각1)/4=**75%**, 인정결석 보유 학생은 분모에서 제외돼 1/(4−1)=**33.3%**. 낮은 순 정렬·미기록 수 확인 |
| W8 면접 목록 | 2건 조회, `status=scheduled` 필터 1건, 잘못된 status **400** |
| W8 권한 경계 | `/admin/interviews`는 `recruiting` 게이트 — finance·community 모두 **403**. `/admin/attendance`는 일반 운영이라 둘 다 **200**. 학생은 신규 3개 라우트 전부 **403** |
| typecheck 4개 워크스페이스 · api-server 빌드 · seeds 빌드 | 전부 통과 |

### 아직 검증 **안** 된 것

- **브라우저로 화면을 연 적이 없다.** 이 환경에 연결된 브라우저가 없고, firefox 헤드리스는
  snap 격리로 뜨지 않았다. 따라서 실제 렌더, **375px 가로 스크롤 실측, 드래그앤드롭 동작,
  `DesktopOnly` 배너 표시**는 전부 미검증이다. W11의 §8 수용 기준 마지막 두 항목이 여기 걸린다.
- Discord 발송 (웹훅 URL 미설정 — 미설정 시 스킵 경로만 확인).
- 파일 업로드 / 첨부 다운로드 게이트.
- cron 라우트 (`CRON_SECRET` 미설정).
- **기존 데이터가 있는 실 DB에서의 마이그레이션.** 빈 DB 푸시는 파괴적 변경 프롬프트를
  띄우지 않으므로, 실 DB 푸시 전에는 `drizzle-kit push` 출력을 반드시 눈으로 볼 것.
- 프로덕션 `DATABASE_URL`은 이 세션에 없었다. 위 결과는 전부 **빈 스크래치 DB + 직접 심은 픽스처** 기준이다.

### 재현 가능한 검증 스크립트

세션 중 쓴 검증 스크립트는 scratchpad에 있었고 커밋하지 않았다. 필요하면 아래 패턴으로 재작성한다.

```bash
# 순수함수 단위 실행 (workspace 빌드가 .d.ts만 내므로 esbuild 번들 필요)
./artifacts/api-server/node_modules/.bin/esbuild <파일>.ts \
  --bundle --format=esm --platform=node --outfile=/tmp/x.mjs
node -e 'import("/tmp/x.mjs").then(m => ...)'
```

---

## 7. 남은 작업

### ~~W7 — `external_links`~~ (API 완료, **화면만 남음**)

스키마·권한·읽기 경로는 끝났고 런타임 검증까지 했다(§6). **프론트 화면이 없다** —
`/admin`에 링크 관리 UI도, 학생·멘토 목록 화면도 붙이지 않았다. W8에서 placeholder를
정리할 때 같이 배치하는 것이 자연스럽다.

읽기 규칙이 단순하지 않으니 화면을 붙이기 전에 [visibility-policy §5.1](visibility-policy.md)을 볼 것 —
**자체 `visibility`만 보면 안 되고 부모 도달 가능성과 교집합**이다. 판정은
`artifacts/api-server/src/lib/external-link-scope.ts` 한 곳에 모여 있으니 새 라우트도 거기를 지나게 한다.
부모에 청중이 없는 visibility는 쓰기 시점에 422로 거부된다(`meeting`+`cohort_visible` 등).

### ~~W8 — placeholder 8개~~ (완료)

**실체화 4** — `/admin/media`(W7 링크 관리가 여기 들어감) · `/admin/interviews`(목록 API 신규) ·
`/admin/attendance`(기수 집계 API 신규) · `/admin/reports`(기존 화면 2개로 가는 인덱스, 신규 API 없음).

**제거 4** — 사유는 각각 `lib/admin-nav.ts`의 해당 위치 주석에 남겼다. 되살리려면 그 근거부터 뒤집어야 한다.

| 제거 | 사유 |
|---|---|
| `/admin/integrations` | design/04 §8이 자동 sync를 **명시적 비목표**로 못박았다. 연동 *상태* 화면은 그 상태를 만드는 sync 계층이 있어야 성립하는데, 그 계층을 안 만들기로 한 것이다. `/admin/reflections` ↔ ADR-001과 같은 형태 |
| `/admin/settings` | 약속 항목이 `SESSION_SECRET`·`ADMIN_EMAIL` 등 환경변수라 UI 노출은 보안 후퇴다. 또 "기본 가시성 정책"을 런타임에 바꾸게 하면 ADR-001이 **구조로** 보장한 것이 무너진다 |
| `/admin/members` | `/admin/people`이 이미 kind(mentor/staff/member) 통합 인물 디렉터리다. IA v2 §7.2는 신규 화면이 아니라 `/admin/students` **배치 미결**을 지적한 것이었다 |
| `/admin/public-pages` | 게시/숨김·SEO 메타는 **스키마가 없다**. `site_contents`는 키→본문 맵이다. 되살릴 때는 그 확장과 같은 변경에서 |

placeholder 기반 코드(`ADMIN_PLACEHOLDER_ITEMS`·`findPlaceholderItem`·`_placeholder.tsx`·
`NavItem.placeholder`)는 전부 제거했다. **nav 항목은 이제 반드시 동작하는 화면과 함께 추가한다.**

### ~~W11 — 반응형~~ (완료)

등급 대장은 [`artifacts/seeds/src/lib/responsive-tiers.ts`](../artifacts/seeds/src/lib/responsive-tiers.ts) —
라우트 85개 전량이 A/B/C를 선언한다. **신규 화면은 여기에 행을 먼저 추가한다.**
가드는 `components/DesktopOnly.tsx`(children을 렌더하지 않음) + `hooks/use-desktop.tsx`(1024px,
`useIsMobile` 768px과 **별개** — 사이드바 드로어를 끌고 가지 않기 위함).
작업 보드 드래그는 **네이티브 HTML5 DnD·신규 의존성 없음**이고, 상태 `Select`는
키보드 경로로 남겨뒀다(네이티브 드래그는 키보드 접근 불가).
등급이 갈리는 2개 화면(`/mentor/projects/:id`·`/admin/meetings/:id`)은 `MIXED_TIER_SCREENS` 참조.
`/evaluator/*`는 §6.2가 분류하지 않아 **B로 정했다** — 근거는 design/05 §6.2 표. 브라우저 검증만 남았다(§6).

### 미결 항목

[design/00 §9](design/00-target-state.md)에 정리돼 있다. 주요한 것:

- `programs`를 Curriculum Module / Track / Program 중 무엇으로 재정의할지 → Parallel B
- 알럼나이 접근 범위, 졸업 후 아카이브 정책
- 멘토 상태체크 입력률이 데스크톱 전용으로 충분한지 → 첫 기수 운영 후 ADR-008 재검토

---

## 8. 이번 세션에서 배운 것 (반복하지 말 것)

### 8.1 적대적 검증이 실제로 결함을 잡았다

W6 구현 후 5개 독립 렌즈로 감사를 돌렸더니 **6건이 나왔고 전부 실제 결함**이었다. 내가 직접 한 정적 감사는 **0건**을 잡았다. 이유: 나는 "이게 맞는지"만 확인했고 "이게 무의미하지 않은지"는 보지 않았다.

대표 사례 — 회고 visibility 4개 값 중 3개가 **읽는 쪽이 없어 죽은 값**이었다. 내 감사는 "4개 핸들러 전부 `studentId=본인` 스코프 통과"를 성공으로 읽었는데, 같은 사실이 실은 "소유자 말고 아무도 못 본다"는 뜻이었다. 그 상태에서 UI는 존재하지 않는 청중을 약속하고 있었다.

→ `visibility-policy.md` §4.2에 규칙을 박아뒀다: **신규 visibility 값은 대응하는 읽기 경로를 같은 변경에서 만든다.**

### 8.2 검증 스크립트 자체를 의심할 것

- 첫 워크플로가 `CLEAN`을 반환했으나 **거짓이었다.** 내부 `parallel()`에 thunk 대신 promise를 넘겨 반증 단계가 전부 에러났고, 발견 12건이 조용히 버려졌다. 실패 로그를 안 봤으면 통과로 착각했을 것이다.
- 정적 감사에서 4건이 FAIL로 나왔는데 전부 **주석 텍스트를 잡은 오탐**이었다(`"dm" in "admin"` 등). 주석·문자열을 제거하고 다시 돌려야 한다.
- INSERT 핸들러를 "WHERE 절 없음"으로 FAIL 처리한 적도 있다. 검사 로직이 연산 종류를 구분해야 한다.

**결론: 감사 결과가 통과든 실패든, 검사기가 실제로 무엇을 봤는지 확인할 것.**

### 8.3 문서와 구현이 갈라진다

구현이 `gap-register.md`를 이미 추월해 있었고(meetings·tasks·documents·finance가 "전무"로 적혀 있었다), 이번 세션에도 `/admin/team-status`가 문서엔 있고 코드엔 없는 상태가 생겼다. 검증이 이걸 잡아냈다.

→ Wave를 끝낼 때마다 해당 design 문서의 **상태 헤더**를 갱신할 것.

---

## 9. 커밋 구성

이 세션의 작업은 브랜치 하나로 올라간다. 상세는 커밋 메시지 참조.

포함: `docs/` 전체(baseline 11종 + design 6종 + visibility-policy + 이 문서), `lib/db` 스키마 9종 신규 + 4종 확장, `lib/api-spec`·생성 코드, `artifacts/api-server` 라우트·lib, `artifacts/seeds` 화면·컴포넌트, `replit.md`.

제외: `attached_assets` (§5.3).
