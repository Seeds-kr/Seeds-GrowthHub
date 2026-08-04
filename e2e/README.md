# e2e — 브라우저 검증

`design/05 §6`(반응형 등급)과 역할별 내비게이션은 **브라우저가 특정 폭에서 무엇을
하는가**에 대한 진술이라, 코드를 읽어서는 확인할 수 없다. 실제로 정적 검토가
통과라고 말하는 동안 두 건이 그대로 배포됐다.

- 헤더형 레이아웃 4개가 `md` 미만에서 내비게이션을 통째로 잃었다 — A 등급 위반인데
  등급표는 통과였다.
- `visibility` 값에 읽는 쪽이 없어 죽은 값이 됐다 — 소유권 검사는 전부 통과였다.

그래서 이 하네스는 **측정값**을 출력한다. `scrollWidth=375 clientWidth=375`처럼
숫자가 남아야 다음 사람이 결과를 의심할 수 있다.

## 실행

```bash
pnpm --filter @workspace/e2e exec playwright install chromium   # 최초 1회
BASE_URL=http://127.0.0.1:8088 pnpm --filter @workspace/e2e run verify
```

Playwright는 **자체 Chromium을 내려받는다.** 배포판 브라우저에 의존하지 않으므로
snap으로 격리된 환경(이 저장소를 검증한 머신이 그랬다)에서도 뜬다.

## 자격증명

파일에 비밀번호를 두지 않는다. 없으면 해당 구간을 **SKIP**하고 공개 화면만 돈다.

| 변수 | 없을 때 |
|---|---|
| `E2E_STUDENT_EMAIL` · `E2E_STUDENT_PASSWORD` | 학생 구간 건너뜀 |
| `E2E_ADMIN_EMAIL` · `E2E_ADMIN_PASSWORD` | C 등급 가드·드래그 구간 건너뜀 |

## 검사 항목

| 구간 | 확인하는 것 |
|---|---|
| A 등급 375px | 공개 6화면 + 학생 4화면에서 페이지 레벨 가로 스크롤 0. 실패 시 튀어나온 요소를 함께 출력 |
| 모바일 내비 | 375px에서 트리거 노출, 드로어에 항목 전부(공개 5 / 학생 13), 이동·Esc 시 닫힘 |
| 데스크톱 1440px | 헤더 nav 노출 + 트리거 숨김 (드로어가 데스크톱에 새지 않는지) |
| C 등급 가드 | 900px에서 안내가 뜨고 **보드 노드가 DOM에 없음**. 숨김이 아니라 미렌더여야 한다 |
| 드래그앤드롭 | 카드가 컬럼 간 이동하고, **새로고침 후에도 유지**되어 서버 반영을 증명 |

## 함정

- `isVisible()`·`count()`는 **자동 대기하지 않는다.** `networkidle` 직후에 물으면
  React가 역할 레이아웃을 마운트하기 전을 읽어 없는 실패를 만들어낸다. 로그인
  헬퍼가 `main`을 기다리는 이유이고, 실제로 이 함정에 한 번 걸렸다.
- `main`으로 기다리는 것도 이유가 있다. `header`는 AdminLayout에서 `lg:hidden`이라
  데스크톱 폭에서 영원히 보이지 않는다.
- 드래그 검사는 `ops_task`가 최소 하나 있어야 한다. 없으면 SKIP한다.

## stories.mjs — 역할별 유저 스토리 주행

`run.mjs` 는 화면이 뜨는지를 본다. `stories.mjs` 는 **한 역할이 일을 끝낼 수 있는지**를 본다
(쓰고, 저장되고, 새로고침해도 남는지까지). 목록과 결과는 `docs/user-stories.md`.

```bash
E2E_BASE_URL=https://seeds.harvester.kr \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
E2E_MENTOR_EMAIL=... E2E_MENTOR_PASSWORD=... \
E2E_STUDENT_EMAIL=... E2E_STUDENT_PASSWORD=... \
node stories.mjs
```

계정을 안 주면 그 역할은 `BLOCK` 으로 남는다. 통과로 세지 않는다.
쓰기 스토리는 실제 데이터를 만든다 — 운영 DB 를 향해 돌리지 말 것.
