#!/usr/bin/env bash
# 마이그레이션만으로 지금 DB 를 재현할 수 있는지 확인한다.
#
# 왜: 마이그레이션 파일은 "이 순서대로 실행하면 그 스키마가 나온다" 는 약속이다.
# 그 약속이 깨지면 새 환경에 배포했을 때 **다른 DB** 가 나오고, 그건 배포하고
# 나서야 알게 된다. `drizzle-kit generate` 는 스키마 정의와 마이그레이션이
# 맞는지만 보고, **실제 DB 가 그 정의대로인지는 안 본다.** 그 간극을 여기서 본다.
#
# 라이브를 건드리지 않는다. 빈 DB 를 만들어 마이그레이션을 순서대로 붓고,
# 컬럼 단위로 라이브와 대조한 뒤 지운다.
set -uo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${DRIFT_CONTAINER:-seeds_growthhub_pg}"
LIVE="${DRIFT_LIVE_DB:-growthhub}"
PROBE="schema_probe_$$"
psql_() { docker exec -i "$CONTAINER" psql -U growthhub -d "$1" "${@:2}"; }
trap 'psql_ postgres -tAc "DROP DATABASE IF EXISTS $PROBE;" >/dev/null 2>&1' EXIT

psql_ postgres -tAc "CREATE DATABASE $PROBE;" >/dev/null 2>&1 || { echo "사본 DB 생성 실패" >&2; exit 1; }

n=0
for f in lib/db/drizzle/0*.sql; do
  # drizzle 이 넣는 구분자는 psql 이 모른다. 지우고 붓는다.
  if ! sed 's/--> statement-breakpoint//' "$f" | psql_ "$PROBE" -v ON_ERROR_STOP=1 >/dev/null 2>&1; then
    echo "✘ 적용 실패: $(basename "$f")" >&2
    exit 1
  fi
  n=$((n + 1))
done
echo "마이그레이션 ${n}개 적용됨"

Q="select table_name||'.'||column_name||':'||data_type||
   case when is_nullable='NO' then '!' else '' end
   from information_schema.columns where table_schema='public' order by 1"
A="$(psql_ "$LIVE" -tAc "$Q")"
B="$(psql_ "$PROBE" -tAc "$Q")"

if [ "$A" = "$B" ]; then
  echo "✔ 컬럼 $(echo "$A" | wc -l)개가 완전히 일치 — 마이그레이션만으로 지금 DB 를 재현할 수 있다"
  exit 0
fi

echo "✘ 스키마가 어긋났다. 마이그레이션만으로는 지금 DB 가 나오지 않는다." >&2
diff <(echo "$A") <(echo "$B") | head -30 >&2
exit 1
