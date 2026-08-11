#!/usr/bin/env bash
# 알림 다이제스트를 깨운다.
#
# `POST /internal/cron/*` 는 **부르는 주체가 없으면 아무 일도 안 한다.** 알림
# 계층(ADR-007: Discord 웹훅 + 인앱 배지)은 만들어져 배선까지 돼 있는데,
# 두 다이제스트를 호출할 스케줄이 없어서 영영 안 나갈 상태였다.
#
#   daily-digest         매일  운영진 채널에 그날 볼 것
#   weekly-mentor-nudge  주 1회 멘토에게 상태체크 넛지
#
# 설정이 없으면 **조용히 넘어간다.** 웹훅 URL 이나 CRON_SECRET 이 없는 것은
# 고장이 아니라 "아직 안 켰다" 이고, 매일 실패 메일을 쌓을 이유가 없다.
# 반대로 설정이 있는데 실패하면 종료 코드를 남겨 타이머가 기록하게 한다.
#
#   ops/cron-tick.sh daily-digest
#   ops/cron-tick.sh weekly-mentor-nudge
set -uo pipefail

JOB="${1:?daily-digest | weekly-mentor-nudge}"
BASE="${SEEDS_API_BASE:-http://127.0.0.1:8088}"

set -a; . "$HOME/.secrets/seeds-preview.env"; set +a

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET 미설정 — 건너뜁니다(고장 아님)."
  exit 0
fi
if [ -z "${SEEDS_DISCORD_OPS_WEBHOOK_URL:-}${SEEDS_DISCORD_MENTOR_WEBHOOK_URL:-}" ]; then
  echo "Discord 웹훅 URL 미설정 — 건너뜁니다(보낼 곳이 없습니다)."
  exit 0
fi

code="$(curl -s -o /tmp/cron-tick-out.json -w '%{http_code}' -m 60 \
  -X POST "$BASE/api/internal/cron/$JOB" -H "x-cron-secret: $CRON_SECRET")"
body="$(head -c 300 /tmp/cron-tick-out.json 2>/dev/null)"
echo "$JOB → HTTP $code $body"
[ "$code" = "200" ] || exit 1
