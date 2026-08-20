#!/usr/bin/env bash
# 백업이 **정말 복원되는지** 확인한다.
#
# 백업이 매일 뜨는 것과 그게 쓸모 있는 것은 다른 얘기다. 덤프 파일이 있다는 사실은
# 아무것도 보장하지 않는다 — 복원해서 내용이 같아야 백업이다. 그전까지는 "백업이
# 있다" 가 검증되지 않은 약속이다.
#
# 세 갈래를 다 본다. 하나라도 안 되면 그 갈래는 없는 것과 같다.
#
#   ① 평문 덤프    zcat → psql. 빠른 복원용
#   ② 암호화본     gpg → zcat → psql. 밖으로 내보낼 때 쓰는 것
#   ③ 업로드 tar   프로필 사진·본문 이미지. DB 에는 경로만 있어서
#                  덤프만 복원하면 주소는 살아나고 그림이 전부 깨진다
#
# **라이브를 건드리지 않는다.** 사본 DB 를 만들어 거기에 복원하고, 끝나면 지운다.
# 그래서 아무 때나 돌려도 된다.
set -uo pipefail

CONTAINER="${RESTORE_CONTAINER:-seeds_growthhub_pg}"
LIVE_DB="${RESTORE_LIVE_DB:-growthhub}"
DIR="${RESTORE_BACKUP_DIR:-/home/harvester/seeds-preview/backups}"
PASS_FILE="$HOME/.secrets/seeds-backup-passphrase"
PROBE=restore_probe_$$
GPROBE=gpg_probe_$$
FAIL=0

psql_() { docker exec -i "$CONTAINER" psql -U growthhub -d "$1" "${@:2}"; }
drop_() { psql_ postgres -tAc "DROP DATABASE IF EXISTS $1;" >/dev/null 2>&1; }
trap 'drop_ "$PROBE"; drop_ "$GPROBE"' EXIT

ok()   { printf '  ✔ %s\n' "$1"; }
bad()  { printf '  ✘ %s\n' "$1"; FAIL=$((FAIL+1)); }

DUMP="$(ls -1t "$DIR"/growthhub-*.sql.gz 2>/dev/null | head -1)"
[ -n "$DUMP" ] || { echo "백업이 없다: $DIR" >&2; exit 1; }
STAMP="$(basename "$DUMP" .sql.gz)"
echo "대상: $STAMP"
echo

echo "① 평문 덤프"
drop_ "$PROBE"; psql_ postgres -tAc "CREATE DATABASE $PROBE;" >/dev/null 2>&1
if zcat "$DUMP" | psql_ "$PROBE" >/dev/null 2>&1; then ok "복원됨"; else bad "복원 실패"; fi

# 행수를 실제 count(*) 로 센다. pg_stat 의 n_live_tup 은 근사값이라 대조에 못 쓴다.
TABS="$(psql_ "$LIVE_DB" -tAc "select tablename from pg_tables where schemaname='public' order by 1")"
Q=""
for t in $TABS; do
  [ -n "$Q" ] && Q="$Q union all "
  Q="$Q select '$t' t, count(*) n from $t"
done
A="$(psql_ "$LIVE_DB" -tAF: -c "$Q" | sort)"
B="$(psql_ "$PROBE"   -tAF: -c "$Q" 2>/dev/null | sort)"
N="$(echo "$TABS" | wc -w)"
if [ "$A" = "$B" ]; then
  ok "$N개 테이블 행수가 라이브와 일치"
else
  # 백업 시각 이후에 라이브가 바뀌었으면 여기서 갈린다. 그건 고장이 아니다.
  bad "행수 불일치 — 백업 이후 라이브가 바뀌었는지 확인하라"
  diff <(echo "$A") <(echo "$B") | head -10 | sed 's/^/      /'
fi

echo
echo "② 암호화본"
GPG="$DIR/$STAMP.sql.gz.gpg"
if [ ! -f "$GPG" ]; then
  bad "암호화본이 없다 ($STAMP.sql.gz.gpg)"
elif [ ! -f "$PASS_FILE" ]; then
  bad "패스프레이즈가 없다 ($PASS_FILE)"
else
  drop_ "$GPROBE"; psql_ postgres -tAc "CREATE DATABASE $GPROBE;" >/dev/null 2>&1
  if gpg --batch --quiet --decrypt --passphrase-file "$PASS_FILE" "$GPG" 2>/dev/null \
       | zcat | psql_ "$GPROBE" >/dev/null 2>&1; then
    G_N="$(psql_ "$GPROBE" -tAc "select count(*) from information_schema.tables where table_schema='public';")"
    [ "$G_N" = "$N" ] && ok "복호화·복원됨 ($G_N개 테이블)" || bad "테이블 수가 다르다 ($G_N ≠ $N)"
  else
    bad "복호화 또는 복원 실패"
  fi
fi

echo
echo "③ 업로드 파일"
TAR="$DIR/$STAMP-uploads.tar.gz"
UPLOADS="${UPLOAD_DIR:-/home/harvester/seeds-preview/uploads}"
if [ ! -f "$TAR" ]; then
  # 파일이 하나도 없으면 backup.sh 가 tar 를 안 만든다. 그건 정상이다.
  if [ -n "$(find "$UPLOADS" -type f -print -quit 2>/dev/null)" ]; then
    bad "업로드 파일이 있는데 tar 가 없다"
  else
    ok "업로드 파일이 없어 tar 도 없다 (정상)"
  fi
else
  TMP="$(mktemp -d)"
  if tar -xzf "$TAR" -C "$TMP" 2>/dev/null; then
    SAME=0; DIFF=0
    while IFS= read -r f; do
      rel="${f#$TMP/uploads/}"
      if cmp -s "$f" "$UPLOADS/$rel"; then SAME=$((SAME+1)); else DIFF=$((DIFF+1)); fi
    done < <(find "$TMP/uploads" -type f 2>/dev/null)
    [ "$DIFF" = 0 ] && ok "$SAME개 파일이 바이트까지 동일" || bad "$DIFF개 파일이 다르다"
  else
    bad "tar 를 풀지 못했다"
  fi
  rm -rf "$TMP"
fi

echo
if [ "$FAIL" = 0 ]; then
  echo "복원 검증 통과 — 이 백업은 실제로 되돌릴 수 있다."
else
  echo "복원 검증 실패 $FAIL건. 백업이 있다는 말을 믿으면 안 된다." >&2
fi
exit "$FAIL"
