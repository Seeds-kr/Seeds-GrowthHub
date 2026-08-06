#!/usr/bin/env bash
# 전 검증을 한 번에 돌린다. systemd 타이머(seeds-verify.timer)가 매일 돌리고,
# 손으로도 같은 명령으로 돌릴 수 있다.
#
#   run.mjs      화면이 뜨는가 (반응형·내비·드래그)
#   stories.mjs  역할이 일을 끝낼 수 있는가 (쓰고 저장되고 다시 읽히는가)
#   routes.mjs   전 라우트가 여전히 렌더되는가
#
# 실패하면 종료 코드가 0이 아니다. 타이머가 그걸 보고 journal 에 남긴다.
set -uo pipefail

REPO=/home/harvester/Seeds-GrowthHub
LOG=/home/harvester/seeds-preview/verify.log
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
set -a; . "$HOME/.secrets/seeds-preview.env"; set +a

export E2E_BASE_URL=https://seeds.harvester.kr
export E2E_ADMIN_EMAIL="$ADMIN_EMAIL"
export E2E_ADMIN_PASSWORD="$ADMIN_PASSWORD"
# 픽스처 계정. ops/reset-test-data.sh 를 돌린 뒤에는 실제 계정으로 바꿔야 한다.
export E2E_MENTOR_EMAIL="${E2E_MENTOR_EMAIL:-smoke-mentor@seeds.local}"
export E2E_MENTOR_PASSWORD="${E2E_MENTOR_PASSWORD:-Story!2026test}"
export E2E_STUDENT_EMAIL="${E2E_STUDENT_EMAIL:-smoke-student@seeds.local}"
export E2E_STUDENT_PASSWORD="${E2E_STUDENT_PASSWORD:-Story!2026test}"

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
  if [ "$fail" = 0 ]; then echo "결과: 전부 통과"; else echo "결과: 실패 있음"; fi
} | tee -a "$LOG"

# 로그가 무한정 자라지 않게 최근 2000줄만 남긴다.
tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
exit "$fail"
