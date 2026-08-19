#!/usr/bin/env bash
# Seeds GrowthHub DB 백업. systemd 타이머(seeds-backup.timer)가 매일 돌린다.
#
# 논리 덤프(pg_dump)를 쓴다. 파일 단위 복사보다 느리지만 버전이 달라도 복원되고,
# 무엇이 들어 있는지 사람이 읽을 수 있다.
#
# **업로드 파일도 함께 뜬다.** 프로필 사진과 회의록 본문 이미지는 디스크에 있고
# DB 에는 경로만 있다. 덤프만 복원하면 주소는 살아나는데 그림이 전부 깨진다.
set -euo pipefail

DIR=/home/harvester/seeds-preview/backups
CONTAINER=seeds_growthhub_pg
UPLOADS=${UPLOAD_DIR:-/home/harvester/seeds-preview/uploads}
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

# ── 업로드 파일 ──────────────────────────────────────────────────────────────
# 회의록 본문 이미지와 프로필 사진은 DB 가 아니라 디스크에 있다(ADR-010·ADR-017:
# 자료 파일은 드라이브, 본문 이미지·사진만 우리 쪽). pg_dump 만 뜨면 경로는
# 살아나고 그림이 전부 깨진 백업이 된다.
#
# 이름을 덤프와 같은 타임스탬프로 맞춘다 — 목록에서 어느 덤프와 짝인지 한눈에
# 보이고, 보관 정리 규칙도 하나로 끝난다.
#
# 파일이 하나도 없으면 tar 를 만들지 않는다 — 빈 아카이브가 매일 쌓일 이유가 없다.
UP_OUT="${OUT%.sql.gz}-uploads.tar.gz"
if [ -d "$UPLOADS" ] && [ -n "$(find "$UPLOADS" -type f -print -quit 2>/dev/null)" ]; then
  tar -czf "$UP_OUT.part" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
  if gzip -t "$UP_OUT.part"; then
    mv "$UP_OUT.part" "$UP_OUT"
    # 덤프와 같은 600. 사람 얼굴 사진이 들어 있으므로 덤프보다 느슨할 이유가 없다.
    chmod 600 "$UP_OUT"
    echo "업로드 백업: $UP_OUT ($(stat -c%s "$UP_OUT") B, $(find "$UPLOADS" -type f | wc -l)개)"
  else
    rm -f "$UP_OUT.part"
    echo "업로드 백업 실패" >&2
  fi
else
  echo "업로드 파일이 없어 파일 백업은 건너뛴다."
fi

# 외부로 보낼 사본은 암호화해 둔다. 지금은 같은 디스크에 남지만, 이 디스크가
# 통째로 죽으면 백업도 같이 죽는다 — 밖으로 내보내는 것이 다음 단계이고,
# 그때 평문을 올리지 않으려면 여기서 미리 잠가 두어야 한다.
# 대칭키를 쓴다. 이 서버 혼자 만들고 혼자 푸는 용도라 공개키 쌍이 필요 없다.
PASS_FILE="$HOME/.secrets/seeds-backup-passphrase"
if [ -f "$PASS_FILE" ]; then
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase-file "$PASS_FILE" -o "$OUT.gpg.part" "$OUT"
  # 복호화가 실제로 되는지 확인하고 나서만 정식 이름을 준다.
  # 풀 수 없는 암호문은 백업이 아니라 그냥 쓰레기다.
  if gpg --batch --yes --decrypt --passphrase-file "$PASS_FILE" \
         -o /dev/null "$OUT.gpg.part" 2>/dev/null; then
    mv "$OUT.gpg.part" "$OUT.gpg"
    chmod 600 "$OUT.gpg"
    echo "암호화본: $OUT.gpg"
  else
    rm -f "$OUT.gpg.part"
    echo "암호화본 복호화 검증 실패 — 암호화본은 만들지 않았다." >&2
  fi
else
  echo "경고: $PASS_FILE 이 없어 암호화본을 만들지 않았다." >&2
fi

# 오래된 것 정리. 최소 3개는 항상 남긴다 — 보관 기간이 지나도 전부 사라지면 안 된다.
COUNT=$(ls -1 "$DIR"/growthhub-*.sql.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt 3 ]; then
  find "$DIR" -name 'growthhub-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete
  find "$DIR" -name 'growthhub-*.sql.gz.gpg' -mtime "+$KEEP_DAYS" -print -delete
  # 업로드 tar 도 함께 지운다. 빠져 있어 8-15 이후 것이 그대로 쌓여 있었다.
  find "$DIR" -name 'growthhub-*-uploads.tar.gz' -mtime "+$KEEP_DAYS" -print -delete
fi
