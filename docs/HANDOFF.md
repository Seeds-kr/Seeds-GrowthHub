# 핸드오프 — Seeds GrowthHub

> 작성: 2026-07-30 · 로컬 세션 → 원격(Harvester) 인계용
> 이 문서만 읽고 이어받을 수 있게 쓴 것이다. 세부는 각 링크를 따라간다.

---

## 0. 30초 요약

설계 문서 세트를 만들고, 11개 Wave 중 **8개를 구현**했다. 전체 typecheck·빌드 통과.

**⚠️ 이어받자마자 해야 할 것 두 가지**

1. **DB 스키마 푸시** — 신규 테이블 9개·컬럼 6개가 코드에는 있으나 DB에는 없다. 푸시 전에는 **로그인부터 실패**한다(§2).
2. **런타임 검증** — 이 세션은 `DATABASE_URL`이 없어 **앱을 한 번도 실행하지 못했다.** 모든 검증은 typecheck·빌드·정적 감사·순수함수 단위 실행뿐이다. 실제 요청/응답은 미검증이다(§6).

---

## 1. 지금 상태

| 축 | 시작 | 현재 |
|---|---:|---:|
| 데이터 테이블 | 31 | **40** |
| 화면(라우트) | 66 | **76** |
| 빈 placeholder 화면 | 11 | **8** |

### Wave 진행

```text
권한/인프라   W1 ✅ → W5 ✅ → W7 (communication_logs만 완료, external_links 남음)
멘토/성장     W2 ✅ → W3 ✅ → W4 ✅ · W6 ✅
제품 경험     W9 ✅ → W10 ✅ → W11 ⬜
마감          W8 ⬜ (placeholder 8개 실체화/제거)
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
| **W7** | `external_links` | ⬜ 남음 |
| **W8** | placeholder 8개 실체화 또는 제거 | ⬜ 남음 |
| **W11** | 반응형 A/B/C 등급 + `DesktopOnly` 가드 + 작업 보드 드래그 | ⬜ 남음 |

Wave 정의는 [`design/README.md` §4](design/README.md), 완성 형상은 [`design/00-target-state.md`](design/00-target-state.md).

---

## 2. ⚠️ 먼저 실행: DB 스키마 푸시

코드가 신규 컬럼을 SELECT하므로, **푸시 전에는 `users` 조회가 실패해 로그인이 안 된다.**

```bash
pnpm --filter @workspace/db run push
```

### 신규 테이블 9개

`project_mentors` · `project_status_checks` · `project_milestones` · `studies` · `study_members` · `reflections` · `audit_logs` · `attachments` · `communication_logs`

### 기존 테이블 신규 컬럼

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
3. `bootstrapMeetingTemplates()` — 회의 유형별 템플릿 6종을 `documents` 행으로 시딩
4. `backfillMeetingBodies()` — 구 `agenda/pending/notes` → `body_md` 병합 (빈 행만)

### 푸시 후 확인

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM users WHERE role='admin' AND NOT ('program_lead' = ANY(ops_roles))"
```

**0이어야 한다.** 0이 아니면 백필이 안 돌았거나 순서가 꼬인 것이다.

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

### 검증 **안** 된 것

- **앱을 실행하지 못했다.** `DATABASE_URL` 없음. 실제 HTTP 요청/응답, 403/404 동작, 백필 실행, 409 가드, Discord 발송, 파일 업로드 전부 미검증.
- 마이그레이션이 실제로 통과하는지 미확인.
- 프론트 화면을 브라우저로 한 번도 열어보지 않았다.

**원격에서 첫 할 일은 DB 푸시 후 실제 기동과 스모크 테스트다.**

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

### W7 — `external_links`

명세: [design/04 §4](design/04-core-infra.md). `communication_logs`는 W10에서 이미 완료.
`artifacts`와의 경계가 헷갈리기 쉬우니 §4의 대조표를 먼저 볼 것.

### W8 — placeholder 8개

`/admin/members` · `/admin/interviews` · `/admin/attendance` · `/admin/reports` · `/admin/public-pages` · `/admin/media` · `/admin/integrations` · `/admin/settings`

각각 실체화하거나 **제거**한다. `/admin/reflections`는 ADR-001과 충돌해 이미 제거했다 — 같은 판단이 필요한 항목이 더 있는지 볼 것.

### W11 — 반응형

명세: [design/05 §6](design/05-product-experience.md). A/B/C 3등급 분류 + `DesktopOnly` 가드 + 작업 보드 드래그.
**규칙: 애매하면 C(데스크톱 전용)로 내린다.** 어중간한 모바일 대응은 깨진 화면보다 낫지 않다.

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
