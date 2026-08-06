#!/usr/bin/env bash
# Seeds GrowthHub DB 백업. systemd 타이머(seeds-backup.timer)가 매일 돌린다.
#
# 논리 덤프(pg_dump)를 쓴다. 파일 단위 복사보다 느리지만 버전이 달라도 복원되고,
# 무엇이 들어 있는지 사람이 읽을 수 있다.
set -euo pipefail

DIR=/home/harvester/seeds-preview/backups
CONTAINER=seeds_growthhub_pg
KEEP_DAYS=30

mkdir -p "$DIR"; chmod 700 "$DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/growthhub-$TS.sql.gz"

# --clean --if-exists: 복원할 때 기존 객체를 먼저 지운다. 없으면 복원이 중간에 멈춘다.
docker exec "$CONTAINER" pg_dump -U growthhub -d growthhub --clean --if-exists | gzip > "$OUT.part"

# 덤프가 중간에 끊겨도 .part 로 남아 있어 "성공한 백업"으로 오인하지 않는다.
# gzip 무결성과 최소 크기를 확인한 뒤에만 정식 이름을 준다.
gzip -t "$OUT.part"
SIZE=$(stat -c%s "$OUT.part")
if [ "$SIZE" -lt 2000 ]; then
  echo "백업이 너무 작다($SIZE B). 실패로 본다." >&2
  mv "$OUT.part" "$OUT.FAILED"
  exit 1
fi
mv "$OUT.part" "$OUT"
chmod 600 "$OUT"
echo "백업 완료: $OUT ($SIZE B)"

# 오래된 것 정리. 최소 3개는 항상 남긴다 — 보관 기간이 지나도 전부 사라지면 안 된다.
COUNT=$(ls -1 "$DIR"/growthhub-*.sql.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt 3 ]; then
  find "$DIR" -name 'growthhub-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete
fi
