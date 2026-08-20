#!/usr/bin/env bash
# 알림 다이제스트를 깨운다.
#
# `POST /internal/cron/*` 는 **부르는 주체가 없으면 아무 일도 안 한다.** 알림
# 계층(ADR-007: Discord 웹훅 + 인앱 배지)은 만들어져 배선까지 돼 있는데,
# 두 다이제스트를 호출할 스케줄이 없어서 영영 안 나갈 상태였다.
#
#   daily-digest         매일  그날 볼 것 (운영 채널)
#   weekly-mentor-nudge  주 1회 멘토에게 상태체크 넛지 (멘토 채널)
#
# Seeds 는 채널을 나누지 않고 공용 웹훅 하나로 받는다(사용자 결정).
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
# 공용 웹훅 하나로도 동작한다(lib/notify.ts 와 같은 규칙). 채널을 나누고
# 싶으면 채널별 변수를 넣으면 되고, 그쪽이 먼저 적용된다.
#
# 여기 조건이 코드와 어긋나면 **설정을 넣었는데 아무 일도 안 일어난다.**
# 실제로 공용 변수만 넣었을 때 이 줄이 몰라서 조용히 건너뛰었다(2026-08-20).
if [ -z "${SEEDS_DISCORD_OPS_WEBHOOK_URL:-}${SEEDS_DISCORD_MENTOR_WEBHOOK_URL:-}${SEEDS_DISCORD_WEBHOOK_URL:-}" ]; then
  echo "Discord 웹훅 URL 미설정 — 건너뜁니다(보낼 곳이 없습니다)."
  exit 0
fi

code="$(curl -s -o /tmp/cron-tick-out.json -w '%{http_code}' -m 60 \
  -X POST "$BASE/api/internal/cron/$JOB" -H "x-cron-secret: $CRON_SECRET")"
body="$(head -c 300 /tmp/cron-tick-out.json 2>/dev/null)"
echo "$JOB → HTTP $code $body"
[ "$code" = "200" ] || exit 1
