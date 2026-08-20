#!/usr/bin/env bash
# 시드가 여러 번 돌면서 생긴 **완전 중복 행**을 걷어낸다.
#
# 왜 필요한가: `seed-demo-data.sh` 는 2026-08-19 까지 "같은 제목이면 건너뛴다" 고
# 약속만 하고 지키지 않았다. 여섯 번 돌린 프리뷰에서 회의록·아티팩트·피드백·
# 마일스톤이 전부 6배로 불어 목록 화면이 같은 줄로 도배됐다. 스크립트는 고쳤지만
# 이미 쌓인 것은 남는다 — 이 스크립트가 그걸 치운다.
#
# **판정 키에 날짜·본문을 반드시 넣는다.** 처음엔 `(title, student_id)` 로 묶으려
# 했는데, `활동기록` 의 "회고 작성" 33행은 **날짜가 33개 다 다른 진짜 기록**이었다.
# 그대로 돌았으면 32건을 지웠을 것이다. 제목이 같다고 같은 행이 아니다.
#
# 각 그룹에서 **가장 낮은 id 하나만 남긴다** — 먼저 만들어진 것이 원본이고,
# 뒤엣것이 재실행이 만든 사본이다.
#
# 되돌릴 수 없다. 무엇이 지워질지 보여준 뒤 확인을 받는다.
set -euo pipefail

CONTAINER="${DEDUPE_CONTAINER:-seeds_growthhub_pg}"
DB="${DEDUPE_DB:-growthhub}"
PSQL=(docker exec -i "$CONTAINER" psql -U growthhub -d "$DB")

# 테이블 | 같음을 판정하는 키
#
# 변수명이 `GROUPS` 면 안 된다 — bash 예약 변수(현재 사용자의 그룹 ID 배열)라
# 대입이 조용히 무시되고 루프가 gid(1000)를 순회한다. 실제로 그렇게 짰다가
# `SELECT ... FROM 1000` 이 나왔다.
DEDUPE_GROUPS=(
  "meetings|title, meeting_date, meeting_type, body_md"
  "artifacts|title, artifact_type, url, coalesce(project_id,-1), coalesce(student_id,-1)"
  "feedback|content, target_type, target_id, feedback_type"
  "activity_records|title, student_id, activity_date, source_type, coalesce(source_id,-1)"
  "project_milestones|title, project_id, due_at"
  "team_meetings|title, owner_id, content_md"
  "studies|title, cohort_id, topic"
  "sessions|title, cohort_id, scheduled_at"
  # 프로그램은 학생 등록(student_programs)이 물려 있다. 아래에서 먼저 끊는다.
  "programs|name, cohort_id"
)

echo "── 지워질 것 ──────────────────────────────────────────────"
TOTAL=0
for g in "${DEDUPE_GROUPS[@]}"; do
  t="${g%%|*}"; k="${g#*|}"
  n="$("${PSQL[@]}" -tAc "SELECT count(*) - count(DISTINCT ($k)) FROM $t;")"
  printf '  %-20s %s행 중 %s행\n' "$t" "$("${PSQL[@]}" -tAc "SELECT count(*) FROM $t;")" "$n"
  TOTAL=$((TOTAL + n))
done
echo "  ────────────────────────────────────────────────────────"
echo "  합계 $TOTAL 행"

if [ "$TOTAL" -eq 0 ]; then
  echo "지울 것이 없다."
  exit 0
fi

if [ "${DEDUPE_YES:-}" != "1" ]; then
  printf '\n정말 지울까? (yes 를 입력) '
  read -r ans
  [ "$ans" = "yes" ] || { echo "취소."; exit 1; }
fi

for g in "${DEDUPE_GROUPS[@]}"; do
  t="${g%%|*}"; k="${g#*|}"
  # 참석자처럼 물려 있는 행을 먼저 끊는다. 없는 테이블이면 조용히 넘어간다.
  if [ "$t" = "programs" ]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      DELETE FROM student_programs WHERE program_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      UPDATE studies SET program_id = NULL WHERE program_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      UPDATE sessions SET program_id = NULL WHERE program_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      UPDATE activity_records SET program_id = NULL WHERE program_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
  fi
  if [ "$t" = "studies" ]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      DELETE FROM study_members WHERE study_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      UPDATE artifacts SET study_id = NULL WHERE study_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
  fi
  if [ "$t" = "team_meetings" ]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
      DELETE FROM team_meeting_participants WHERE meeting_id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
        ) x WHERE rn > 1);" >/dev/null
  fi
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "
    DELETE FROM $t WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY $k ORDER BY id) rn FROM $t
      ) x WHERE rn > 1);" | sed "s/^/  $t: /"
done

echo
echo "── 남은 것 ──"
for g in "${DEDUPE_GROUPS[@]}"; do
  t="${g%%|*}"
  printf '  %-20s %s행\n' "$t" "$("${PSQL[@]}" -tAc "SELECT count(*) FROM $t;")"
done
