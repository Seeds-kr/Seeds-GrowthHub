#!/usr/bin/env bash
# 프리뷰에 쌓인 테스트 데이터를 지운다.
#
# **실제 기수를 받기 시작하기 전에 한 번 돌린다.** 지금 DB 에는 스모크 테스트와
# 유저 스토리 주행(`e2e/stories.mjs`)이 만든 것이 섞여 있다. 주행은 돌릴 때마다
# 지원서·공지·과제·회고·상태체크를 새로 만들므로 그냥 두면 계속 쌓인다.
#
# 남기는 것:
#   - 실존 멘토 프로필 9명 (`people_profiles.kind='mentor'`) — 공개 사이트가 쓴다
#   - 운영 계정 `admin@seeds.local`
#   - 기수·프로그램 등 구조 데이터
#
# 지우는 것:
#   - 테스트 픽스처 계정과 거기 딸린 것
#     `smoke-*` `legacy-*` `mentor-z@` `student-z@` `mentor-kwangsun*` `mentor-test*` `*test*`
#     (`mentor-z` 는 지우는데 `student-z` 는 남기는 식으로 갈리지 않게 명시했다)
#   - 주행이 만든 지원서(`story…@example.com`), 공지·과제·회고·상태체크·평가
#
# 되돌릴 수 없다. 먼저 백업하고, 무엇이 지워지는지 보여준 뒤 확인을 받는다.
set -euo pipefail

CONTAINER=seeds_growthhub_pg
PSQL=(docker exec -i "$CONTAINER" psql -U growthhub -d growthhub)

echo "── 지워질 것 ──────────────────────────────────────────────"
"${PSQL[@]}" -tAF' | ' <<'SQL'
SELECT '테스트 계정', count(*)::text FROM users
  WHERE email ~ '^(smoke|legacy)-'          -- 스모크 테스트 픽스처
         OR email ~ '^(mentor|student)-z@'   -- 이전 세션의 픽스처
         OR email ~ '^mentor-(kwangsun|test)' -- 계정 생성 흐름 검증용
         OR email LIKE '%test%';
SELECT '주행 지원서', count(*)::text FROM applications WHERE email LIKE 'story%@example.com';
SELECT '주행 공지', count(*)::text FROM announcements WHERE title LIKE '주행%';
SELECT '주행 과제', count(*)::text FROM assignments WHERE title LIKE '주행%' OR title LIKE '초안 예시%';
SELECT '주행 회고', count(*)::text FROM reflections WHERE content_md LIKE '주행%';
SELECT '주행 상태체크', count(*)::text FROM project_status_checks WHERE comment LIKE '주행%';
SELECT '주행 평가', count(*)::text FROM evaluations WHERE comment LIKE '주행%';
SQL

echo
echo "── 남을 것 ────────────────────────────────────────────────"
"${PSQL[@]}" -tAF' | ' <<'SQL'
SELECT '실존 멘토 프로필', count(*)::text FROM people_profiles WHERE kind='mentor';
SELECT '운영 계정', email FROM users WHERE email='admin@seeds.local';
SELECT '기수', count(*)::text FROM cohorts;
SQL

echo
read -r -p "지웁니다. 되돌릴 수 없습니다. 계속하려면 'yes' 를 입력하세요: " ok
[ "$ok" = "yes" ] || { echo "취소했습니다."; exit 1; }

echo "백업 먼저…"
/home/harvester/seeds-preview/backup.sh

# 자식 → 부모 순서로 지운다. FK 때문에 순서가 틀리면 중간에 멈춘다.
"${PSQL[@]}" <<'SQL'
BEGIN;

DELETE FROM evaluations            WHERE comment LIKE '주행%';
DELETE FROM project_status_checks  WHERE comment LIKE '주행%';
DELETE FROM reflections            WHERE content_md LIKE '주행%';
DELETE FROM assignment_submissions WHERE assignment_id IN
  (SELECT id FROM assignments WHERE title LIKE '주행%' OR title LIKE '초안 예시%');
DELETE FROM assignments            WHERE title LIKE '주행%' OR title LIKE '초안 예시%';
DELETE FROM announcements          WHERE title LIKE '주행%';

-- 지원서는 평가 배정이 물려 있을 수 있다.
DELETE FROM evaluation_assignments WHERE application_id IN
  (SELECT id FROM applications WHERE email LIKE 'story%@example.com');
DELETE FROM interviews             WHERE application_id IN
  (SELECT id FROM applications WHERE email LIKE 'story%@example.com');
DELETE FROM applications           WHERE email LIKE 'story%@example.com';

-- 테스트 계정. 학생·멘토로 물려 있는 것을 먼저 끊는다.
CREATE TEMP TABLE _junk AS
  SELECT id FROM users WHERE email ~ '^(smoke|legacy)-'          -- 스모크 테스트 픽스처
         OR email ~ '^(mentor|student)-z@'   -- 이전 세션의 픽스처
         OR email ~ '^mentor-(kwangsun|test)' -- 계정 생성 흐름 검증용
         OR email LIKE '%test%';

DELETE FROM project_mentors        WHERE mentor_user_id IN (SELECT id FROM _junk);
DELETE FROM evaluation_assignments WHERE evaluator_id  IN (SELECT id FROM _junk);
DELETE FROM project_members        WHERE student_id IN
  (SELECT id FROM students WHERE user_id IN (SELECT id FROM _junk));
DELETE FROM student_cohorts        WHERE student_id IN
  (SELECT id FROM students WHERE user_id IN (SELECT id FROM _junk));
DELETE FROM students               WHERE user_id IN (SELECT id FROM _junk);
UPDATE people_profiles SET user_id = NULL WHERE user_id IN (SELECT id FROM _junk);
DELETE FROM account_activation_tokens WHERE user_id IN (SELECT id FROM _junk);
DELETE FROM users                  WHERE id IN (SELECT id FROM _junk);

COMMIT;
SQL

echo
echo "── 정리 후 ────────────────────────────────────────────────"
"${PSQL[@]}" -tAF' | ' -c "
SELECT '계정', count(*)::text FROM users
UNION ALL SELECT '지원서', count(*)::text FROM applications
UNION ALL SELECT '멘토 프로필', count(*)::text FROM people_profiles WHERE kind='mentor'
ORDER BY 1;"
echo
echo "주의: 테스트 계정을 지우면 e2e/stories.mjs 의 멘토·학생 축이 BLOCK 으로 떨어진다."
echo "      실제 계정으로 다시 돌리려면 환경변수를 바꿔 주면 된다."
