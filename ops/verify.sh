#!/usr/bin/env bash
# 전 검증을 한 번에 돌린다. systemd 타이머(seeds-verify.timer)가 매일 돌리고,
# 손으로도 같은 명령으로 돌릴 수 있다.
#
#   run.mjs      화면이 뜨는가 (반응형·내비·드래그)
#   stories.mjs  역할이 일을 끝낼 수 있는가 (쓰고 저장되고 다시 읽히는가)
#   routes.mjs   전 라우트가 여전히 렌더되는가
#   공개 주소    바깥(Cloudflare·터널)에서 첫 화면과 번들이 받아지는가
#
# 세 브라우저 검증은 같은 기계의 라우터(localhost:8088)를 직접 본다. 공개 주소로
# 돌리면 Cloudflare 가 이 서버를 LAX 가장자리로 보내, 첫 화면이 회마다 4~11초, 번들
# 하나가 6~20초로 흔들려 networkidle 30초 제한에 걸린다(2026-11-11 실측, 메인 서버·
# 송도서버 둘 다 LAX). 앱 고장이 아니다. 바깥 경로는 마지막 「공개 주소」 단계가 본다.
#
# 실패하면 종료 코드가 0이 아니다. 타이머가 그걸 보고 journal 에 남긴다.
set -uo pipefail

REPO=/home/harvester/Seeds-GrowthHub
LOG=/home/harvester/seeds-preview/verify.log
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
set -a; . "$HOME/.secrets/seeds-preview.env"; set +a

# 127.0.0.1 이 아니라 localhost 여야 한다. 운영 API 의 세션 쿠키는 Secure 인데,
# 스토리의 p.request.fetch(Playwright 자체 네트워크)는 https: 아니면 호스트 이름이
# localhost 일 때만 그 쿠키를 싣는다. 127.0.0.1 이면 O11·S7·S8·S9 가 401 로 떨어진다
# (2026-11-11 실측). docs/gotchas.md 참고.
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:8088}"
PUBLIC_URL="${SEEDS_PUBLIC_URL:-https://seeds.harvester.kr}"
export E2E_ADMIN_EMAIL="$ADMIN_EMAIL"
export E2E_ADMIN_PASSWORD="$ADMIN_PASSWORD"

# 멘토·학생 축 자격증명은 여기 적지 않는다.
#
# 전에는 `${E2E_MENTOR_PASSWORD:-<픽스처 비밀번호>}` 처럼 기본값을 박아뒀다. 이 리포는
# 공개다 — 즉 라이브 호스트 주소(위 PUBLIC_URL)와 거기서 통하는 비밀번호를 나란히
# 게시한 셈이었다. 게다가 이 스크립트는 systemd 타이머가 매일 돌리므로, 검증이
# 통과한다는 것 자체가 "그 계정이 지금 살아 있다"는 뜻이었다.
#
# 그 값이 무엇이었는지는 여기 옮겨 적지 않는다 — 주석도 똑같이 공개된다.
# 지운 이력은 git 에 남아 있으므로, 실제 해결은 비밀번호 교체다(아래 참고).
#
# 이제 ~/.secrets/seeds-preview.env 에서만 온다(맨 위 `set -a; . …` 에서 이미 읽었다).
# 없으면 검증을 건너뛰지 말고 즉시 멈춘다 — 조용히 SKIP 으로 떨어지면
# 멘토·학생 축이 몇 달간 검증되지 않고 있어도 아무도 모른다.
for v in E2E_MENTOR_EMAIL E2E_MENTOR_PASSWORD E2E_STUDENT_EMAIL E2E_STUDENT_PASSWORD; do
  if [ -z "${!v:-}" ]; then
    echo "설정 오류: $v 가 비어 있습니다. ~/.secrets/seeds-preview.env 에 넣어 주세요." >&2
    echo "(ops/reset-test-data.sh 로 픽스처 계정을 지웠다면 실제 계정으로 바꿔야 합니다.)" >&2
    exit 78   # EX_CONFIG
  fi
done

# 공개 주소로 / 를 받고, 그 HTML 이 가리키는 JS 번들까지 받는다. 둘 다 받아져야 통과.
# 송도서버 1분 점검(~/apps/_ops/checks.d/seeds.conf)은 로컬 포트만 보므로,
# 공개 주소가 끊긴 걸 잡는 곳은 여기뿐이다.
check_public() {
  local html bundle code
  html=$(curl -fsS --compressed --max-time 60 "$PUBLIC_URL/" 2>&1) || { echo "/ 실패: $html"; return 1; }
  bundle=$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' <<<"$html" | head -n1)
  [ -n "$bundle" ] || { echo "/ 응답에 번들 경로가 없다"; return 1; }
  code=$(curl -sS --compressed --max-time 60 -o /dev/null -w '%{http_code}' "$PUBLIC_URL$bundle" 2>&1)
  [ "$code" = 200 ] || { echo "$bundle → $code"; return 1; }
  echo "/ 와 $bundle 둘 다 받음"
}

cd "$REPO/e2e"
fail=0
{
  echo "════════════════════════════════════════════════════════"
  echo "검증 시작  $(date '+%Y-%m-%d %H:%M:%S')"

  for s in run stories routes; do
    echo
    echo "── $s.mjs ──"
    if timeout 900 node "$s.mjs" 2>&1; then
      echo "[$s] 종료 0"
    else
      code=$?
      echo "[$s] 종료 $code  ← 실패"
      fail=1
    fi
  done

  echo
  echo "── 공개 주소 $PUBLIC_URL ──"
  if check_public; then
    echo "[public] 통과"
  else
    echo "[public] ← 실패"
    fail=1
  fi

  echo
  if [ "$fail" = 0 ]; then echo "결과: 전부 통과"; else echo "결과: 실패 있음"; fi
  # 블록 자신의 종료코드로 결과를 밖에 넘긴다. 아래 설명 참고.
  exit "$fail"
} | tee -a "$LOG"

# `{ … } | tee` 의 왼쪽은 **서브셸**이다. 그 안에서 `fail=1` 을 해도 바깥의
# `fail` 은 끝까지 0 이라, 전에는 `exit "$fail"` 이 언제나 0 을 돌려줬다.
# 머리주석은 "실패하면 종료 코드가 0 이 아니다" 라고 약속했지만 처음부터 지켜진
# 적이 없다. 2026-11-04 송도서버로 옮긴 뒤 브라우저가 없어 검증이 7일 연속
# 실패했는데, systemd 는 매번 성공으로 기록해 아무도 몰랐다.
#
# 그래서 블록이 스스로 `exit` 하고, 그 값을 PIPESTATUS 로 받는다. `tee` 쪽
# 종료코드(PIPESTATUS[1])는 보지 않는다 — 로그를 못 써도 검증 결과는 검증 결과다.
fail="${PIPESTATUS[0]}"

# 로그가 무한정 자라지 않게 최근 2000줄만 남긴다.
tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
exit "$fail"
