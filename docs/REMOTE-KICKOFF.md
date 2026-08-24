# 원격 세션 킥오프 프롬프트

아래 블록을 원격(Harvester) 에이전트에게 그대로 붙여넣는다.
상황이 바뀌면 §2의 "이번에 할 일"만 갈아끼우면 된다.

---

## 1. 붙여넣을 프롬프트

```text
Seeds GrowthHub 작업을 이어받는다. 이전 세션이 설계 문서 세트를 만들고
11개 Wave 중 8개를 구현해 브랜치로 올려뒀다.

브랜치: feat/growthhub-design-and-waves
레포:   https://github.com/Seeds-kr/Seeds-GrowthHub

## 먼저 읽을 것 (이 순서대로)

1. docs/HANDOFF.md          ← 전체 인계 문서. 여기부터.
2. docs/design/00-target-state.md   완성 형상. 전경이 잡힌다.
3. docs/visibility-policy.md        가시성 정책. 누가 무엇을 보는가의 단일 진실.
4. docs/design/README.md            ADR 8건 + Wave 계획 + 회귀 금지선.
5. README.md                        런타임·스키마 구현 노트.

세부 명세가 필요할 때만 docs/design/01~05 를 펼친다.
docs/baseline/ 11종은 Seeds가 준 원본 기준본이다 — 설계 근거를 따질 때만 본다.

## 시작 전 반드시 확인할 두 가지

(1) DB 스키마가 코드보다 뒤처져 있다.
    신규 테이블 9개·컬럼 6개가 코드에만 있다. 푸시 전에는 users SELECT가
    실패해 로그인부터 안 된다.

        pnpm --filter @workspace/db run push

    푸시 후 검증:
        psql "$DATABASE_URL" -c "SELECT count(*) FROM users
          WHERE role='admin' AND NOT ('program_lead' = ANY(ops_roles))"
    → 0이어야 한다. 0이 아니면 기동 시 백필이 안 돌았거나 순서가 꼬인 것이다.
    (backfillOpsRolesOnce 가 bootstrapAdminFromEnv 보다 먼저 돌아야 한다.
     순서가 바뀌면 부트스트랩 계정만 권한을 받고 나머지 관리자가 잠긴다.)

(2) 이전 세션은 앱을 한 번도 실행하지 못했다.
    DATABASE_URL 이 없어서, 검증은 typecheck·빌드·정적 감사·순수함수 단위
    실행뿐이었다. 실제 HTTP 요청/응답, 403/404 동작, 마이그레이션, 백필,
    Discord 발송, 파일 업로드는 전부 런타임 미검증이다.

    그러니 "구현 완료"로 적힌 것도 실제로 도는지는 아직 모른다.
    DB 푸시 후 스모크 테스트를 먼저 하고, 결과를 사실대로 보고할 것.

## 이번에 할 일

먼저: DB 푸시 → 기동 → 스모크 테스트.
  - 관리자 로그인
  - /admin/ops-dashboard 로드
  - /admin/users 에서 기능 역할 편집
  - /mentor/teams (멘토 계정으로)
  - /student/reflections 작성 + 공개범위 변경

그 다음: W11 (반응형 등급 적용).
  명세는 docs/design/05-product-experience.md §6.
  A/B/C 3등급 분류 + DesktopOnly 가드 + 작업 보드 드래그앤드롭.
  규칙: 애매하면 C(데스크톱 전용)로 내린다. 어중간한 모바일 대응은
  깨진 화면을 보여주는 것보다 낫지 않다.

남은 Wave: W7(external_links) · W8(placeholder 8개) · W11(반응형).

## 작업 규칙

- 신규 객체를 추가할 때는 docs/visibility-policy.md §4 매트릭스에 행을
  먼저 추가한 뒤 구현한다 (§7.1이 절차).
- 신규 visibility 값을 만들면 대응하는 읽기 경로를 같은 변경에서 만든다.
  이전 세션에서 회고 enum 3개가 읽는 쪽이 없어 죽은 값이 된 적이 있다.
- docs/design/README.md §5 "전역 회귀 금지선" 8항목을 깨지 않는다.
- Wave를 끝내면 해당 design 문서의 상태 헤더를 갱신한다.
  이전 세션에도 문서와 구현이 갈라진 사례가 여러 건 나왔다.

## 함정 (HANDOFF.md §5에 상세)

- lib/mvp3-api.ts 의 api() 는 이미 /api 를 붙인다.
  api("/admin/users") 가 맞다. "/api/admin/users" 는 /api/api/... 로 나간다.
- 최근 기능(meetings·tasks·documents·finance·projects)은 OpenAPI 미등록,
  raw api() 호출이다. orval 생성 훅은 MVP1/2 표면만 쓴다. 이웃을 따를 것.
- attached_assets 는 건드리지 말 것. macOS NFC/NFD 때문에 14개가
  untracked 처럼 보이지만 이미 커밋된 같은 파일이다.
- /evaluator/* 에 requireOpsRole 을 붙이지 말 것. 별개 축이라
  recruiting 으로 게이트하면 배정받은 멘토가 평가를 못 하게 된다.
- 권한 밖 리소스는 403이 아니라 404. 403으로 갈리면 id 열거로 존재가 샌다.

## 보고 방식

검증되지 않은 것을 "완료"로 적지 말 것. 무엇을 실행해서 확인했고 무엇이
미검증인지 구분해서 보고한다. 테스트가 실패하면 출력과 함께 사실대로 적는다.
```

---

## 2. 상황별 대체 지시

`## 이번에 할 일` 블록만 아래로 바꿔 쓴다.

### W7 — `external_links`

```text
W7: external_links 구현.
명세는 docs/design/04-core-infra.md §4.
communication_logs 는 W10에서 이미 완료됐으니 external_links 만 하면 된다.
artifacts 와의 경계가 헷갈리기 쉬우니 §4의 대조표를 먼저 볼 것 —
artifacts 는 학생이 만든 성장증거, external_links 는 참조용 외부 자료다.
```

### W8 — placeholder 실체화

```text
W8: 빈 placeholder 8개를 실체화하거나 제거한다.
/admin/members · /admin/interviews · /admin/attendance · /admin/reports ·
/admin/public-pages · /admin/media · /admin/integrations · /admin/settings

각각 "만들 가치가 있는가"부터 판단할 것. /admin/reflections 는 ADR-001과
충돌해 이미 제거했다 — 같은 판단이 필요한 항목이 더 있는지 본다.
lib/admin-nav.ts 의 placeholder: true 플래그를 제거하고 실제 라우트를 붙인다.
```

### 검증 위주로 돌릴 때

```text
구현 말고 검증을 먼저 한다.
DB 푸시 후 앱을 기동하고, docs/visibility-policy.md §6 체크리스트로
학생 가시성 6규칙이 실제로 지켜지는지 요청을 보내 확인한다.

특히 확인할 것:
- 학생 A 가 /student/projects/:id 에서 팀원 B 대상 피드백을 못 보는가
- 멘토가 담당 아닌 프로젝트에 404 를 받는가 (403 아님)
- finance 역할만 가진 admin 이 /admin/applications 에 403 을 받는가
- 회고 private 이 어떤 경로로도 새지 않는가
- attachments 가 비인증으로 안 열리는가 (무인증은 프로필 사진 전용 /api/uploads/public/* 뿐)
```
