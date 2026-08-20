#!/usr/bin/env bash
# 프리뷰에 둘러보기용 데이터를 채운다.
#
# 왜 필요한가: 41개 테이블 중 12개가 0행이라, 스터디·아티팩트·피드백 같은 화면이
# **빈 상태 경로만** 검증돼 있었다. 데이터가 있을 때 어떻게 보이는지는 아무도 못 봤다.
#
# 원칙
#   - 직접 INSERT 하지 않는다. 제품의 실제 API 만 쓴다. 그래야 화면이 기대하는
#     불변식(연결 행·기본값·감사 로그)이 같이 선다. 학생 계정을 `POST /admin/users`
#     로 만들었다가 `students` 행이 없어 모든 화면이 비었던 전례가 있다.
#   - 여러 번 돌려도 안전하다. 같은 제목(피드백은 본문)이 이미 있으면 건너뛴다.
#     2026-08-19 이전에는 이 줄이 **약속만 하고 지키지 않았다.** 여섯 번 돌린
#     프리뷰에서 회의록·아티팩트·피드백이 전부 6배로 불어 있었고, 목록 화면이
#     같은 줄로 도배돼 "데이터가 있을 때 어떻게 보이는지" 라는 목적이 흐려졌다.
#   - 프로덕션에서 돌리지 않는다. 아래 가드를 보라.
#
# 채우지 못하는 것 하나
#   communication_logs  internal-cron 만 쓴다. 손으로 만들 경로가 없다.
#
# (student_programs 는 한때 "쓰는 라우트가 없다" 고 적어 뒀는데 틀렸다 —
#  POST /admin/students/:id/programs 가 있다. 이 스크립트가 안 부른 것뿐이었다.)
#
#   ops/seed-demo-data.sh
set -uo pipefail

API="${SEED_API:-http://127.0.0.1:8088/api}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

# 프로덕션 방지. 이 스크립트는 가짜 데이터를 만든다.
case "$API" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "거부: $API 는 로컬이 아니다. 프리뷰에서만 돌린다." >&2; exit 2 ;;
esac

set -a; . "$HOME/.secrets/seeds-preview.env"; set +a

j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))" 2>/dev/null; }
post() { # post <경로> <본문> → 응답 본문
  # 상태 코드를 본다. 전에는 그냥 버려서, 본문이 깨져 400 이 나도 조용히 넘어갔다
  # — 활동기록 2건과 피드백 1건이 몇 달간 만들어지지 않고 있었는데 아무 표시가
  # 없었다(2026-08-20 발견). 시드가 "채웠다" 고 말하면 실제로 채워져야 한다.
  local out code
  out="$(curl -s -w '\n%{http_code}' -b "$JAR" -X POST "$API$1" \
         -H 'content-type: application/json' -d "$2")"
  code="${out##*$'\n'}"
  out="${out%$'\n'*}"
  case "$code" in
    2*) printf '%s' "$out" ;;
    # 409 는 서버가 스스로 중복을 막은 것이다(태그 이름·태그 연결·프로그램 등록).
    # 실패로 세면 재실행 때마다 경고가 뜨면서 진짜 실패가 묻힌다.
    409) tally skipped ;;
    *)  echo "  ⚠ 실패 $code  POST $1" >&2
        echo "    응답: $(printf '%s' "$out" | head -c 160)" >&2
        tally failed ;;
  esac
}

# 이미 같은 제목이 있으면 만들지 않는다.
#
# 머리말은 처음부터 "여러 번 돌려도 안전하다" 고 약속했지만 실제로는 어느 구간도
# 확인하지 않았다. 여섯 번 돌린 프리뷰에서 회의록·아티팩트·피드백이 **전부 6배**로
# 불어 있었다(2026-08-19 발견). 목록 화면이 같은 줄로 도배돼 "데이터가 있을 때
# 어떻게 보이는지" 라는 이 스크립트의 목적 자체가 흐려진다.
#
# 제목으로 판정한다. 이 스크립트가 넣는 것은 모두 제목이 고유하게 설계돼 있고,
# 서버가 돌려주는 id 를 추적하는 것보다 다시 돌렸을 때의 의미가 분명하다.
#
# 조회에 실패하면(엔드포인트 없음·권한 없음) **만드는 쪽으로 넘어간다.** 여기서
# 멈추면 시드가 통째로 비고, 중복은 눈에 보이지만 빈 화면은 원인을 찾기 어렵다.
has_title() { # has_title <목록경로> <제목>
  curl -s -b "$JAR" "$API$1" 2>/dev/null | python3 -c "
import sys, json
want = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)          # 못 읽으면 '없다' 로 보고 만든다
rows = d if isinstance(d, list) else d.get('items', [])
sys.exit(0 if any((r or {}).get('title') == want for r in rows) else 1)
" "$2"
}

post_once() { # post_once <목록경로> <제목> <생성경로> <본문>
  if has_title "$1" "$2"; then
    tally skipped
    return 0
  fi
  post "$3" "$4" >/dev/null
  tally created
}

# 피드백에는 제목이 없다. 같은 자리를 하는 것은 본문이다.
has_content() { # has_content <목록경로> <본문>
  curl -s -b "$JAR" "$API$1" 2>/dev/null | python3 -c "
import sys, json
want = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
rows = d if isinstance(d, list) else d.get('items', [])
sys.exit(0 if any((r or {}).get('content') == want for r in rows) else 1)
" "$2"
}

post_once_content() { # post_once_content <목록경로> <본문값> <생성경로> <본문>
  if has_content "$1" "$2"; then
    tally skipped
    return 0
  fi
  post "$3" "$4" >/dev/null
  tally created
}

# 마일스톤에는 목록 엔드포인트가 없다(POST 만 있다). 프로젝트 상세 응답 안에
# 배열로 실려 오므로 거기서 찾는다. 이걸 모르고 없는 경로를 조회했더니 매번
# 실패 → 매번 생성이 돼서 32건까지 불어 있었다(2026-08-19).
has_title_in() { # has_title_in <상세경로> <필드명> <제목>
  curl -s -b "$JAR" "$API$1" 2>/dev/null | python3 -c "
import sys, json
field, want = sys.argv[1], sys.argv[2]
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
rows = (d or {}).get(field) or []
sys.exit(0 if any((r or {}).get('title') == want for r in rows) else 1)
" "$2" "$3"
}

post_once_nested() { # post_once_nested <상세경로> <필드명> <제목> <생성경로> <본문>
  if has_title_in "$1" "$2" "$3"; then
    tally skipped
    return 0
  fi
  post "$4" "$5" >/dev/null
  tally created
}

# 스터디·프로그램은 만든 뒤 **id 를 받아 쓴다.** 그래서 "건너뛰기" 로는 부족하고
# 이미 있으면 그 id 를 도로 찾아와야 한다. 안 그러면 뒤 구간이 빈 id 를 물고
# 통째로 실패한다.
find_id() { # find_id <목록경로> <필드명> <값> → id 또는 빈 문자열
  curl -s -b "$JAR" "$API$1" 2>/dev/null | python3 -c "
import sys, json
field, want = sys.argv[1], sys.argv[2]
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
rows = d if isinstance(d, list) else d.get('items', [])
for r in rows:
    if (r or {}).get(field) == want:
        print(r.get('id', '')); break
" "$2" "$3"
}

id_once() { # id_once <목록경로> <필드명> <값> <생성경로> <본문> → id
  local found
  found="$(find_id "$1" "$2" "$3")"
  if [ -n "$found" ]; then
    tally skipped; printf '%s' "$found"; return 0
  fi
  tally created
  post "$4" "$5" | j id
}

# 카운터는 **파일**에 센다. `id_once` 는 `$( )` 안에서 돌아 서브셸이므로 변수
# 증가가 부모로 올라오지 않는다 — 그렇게 뒀더니 실제 삽입이 0인데 "2건 만들었다"
# 고 보고했다. 틀린 계기판은 없느니만 못하다.
TALLY="$(mktemp -d)"
trap 'rm -f "$JAR"; rm -rf "$TALLY"' EXIT
: >"$TALLY/created"; : >"$TALLY/skipped"; : >"$TALLY/failed"
tally() { echo x >>"$TALLY/$1"; }
count_of() { wc -l <"$TALLY/$1" | tr -d " "; }
say() { printf '  %-22s %s\n' "$1" "$2"; }

echo "로그인"
curl -s -c "$JAR" -X POST "$API/admin/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

COHORT=1
STUDENTS="$(curl -s -b "$JAR" "$API/admin/students" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(' '.join(str(s['id']) for s in (d if isinstance(d,list) else d.get('items',[]))))")"
S1="$(echo "$STUDENTS" | awk '{print $1}')"
S2="$(echo "$STUDENTS" | awk '{print $2}')"

# 학생이 하나뿐이면 S2 가 빈 문자열이 되고, 그걸 그대로 넣은 본문은
# `"studentId":,` 가 돼 JSON 파서에서 400 이 난다. 예전에는 그 실패를 버려서
# 활동기록 2건·피드백 1건이 조용히 안 만들어졌다.
#
# 둘째 학생 몫을 첫째에게 몰아준다. "두 사람에게 갈렸을 때 어떻게 보이는지" 는
# 못 보지만, 아무것도 없는 것보다는 낫다. 갈린 모습을 보려면 학생을 하나 더
# 만들고 다시 돌리면 된다.
if [ -z "$S2" ]; then
  echo "  ⚠ 학생이 1명뿐이라 둘째 몫을 첫째($S1)에게 몰아넣는다." >&2
  echo "    두 사람으로 갈린 화면을 보려면 학생을 하나 더 만들고 다시 돌려라." >&2
  S2="$S1"
fi
if [ -z "$S1" ]; then
  echo "학생이 없다. 지원서→합격→학생 전환을 먼저 해야 한다." >&2
  exit 1
fi
echo "학생 [$STUDENTS] · 코호트 $COHORT"

echo
echo "프로그램"
PROG="$(id_once /admin/programs name "2026 정규 프로그램" /admin/programs "{\"cohortId\":$COHORT,\"name\":\"2026 정규 프로그램\",\"description\":\"2월 팀빌딩부터 11월 공유회까지, 열 달 과정.\",\"status\":\"active\"}")"
say "programs" "id=$PROG"

echo
echo "프로그램 등록"
# 학생을 프로그램에 넣지 않으면 /student/report·/admin/reports 의 프로그램 축이 빈다.
for s in $STUDENTS; do
  post "/admin/students/$s/programs" "{\"programId\":$PROG}" >/dev/null
done
say "student_programs" "$(echo "$STUDENTS" | wc -w)명"

echo
echo "스터디 · 스터디원"
ST="$(id_once /admin/studies title "타입스크립트 기초" /admin/studies "{\"cohortId\":$COHORT,\"programId\":$PROG,\"title\":\"타입스크립트 기초\",\"topic\":\"언어\",\"description\":\"타입 시스템을 처음부터. 매주 한 챕터씩 읽고 각자 예제를 만들어 옵니다.\",\"leaderStudentId\":$S1,\"status\":\"active\",\"weeklyPlanMd\":\"1주 타입 기본\\n2주 제네릭\\n3주 유틸리티 타입\\n4주 선언 파일\"}")"
say "studies" "id=$ST 타입스크립트 기초"
ST2="$(id_once /admin/studies title "코드 리뷰 읽기 모임" /admin/studies "{\"cohortId\":$COHORT,\"title\":\"코드 리뷰 읽기 모임\",\"topic\":\"협업\",\"description\":\"공개된 오픈소스 PR 을 하나씩 같이 읽습니다.\",\"status\":\"planned\"}")"
say "studies" "id=$ST2 코드 리뷰 읽기 모임"
for s in $STUDENTS; do
  post "/admin/studies/$ST/members" "{\"studentId\":$s,\"role\":\"member\"}" >/dev/null
done
say "study_members" "$(echo "$STUDENTS" | wc -w)명"

echo
echo "회의록"
# 가시성은 admin_only / mentor_visible 둘뿐이다(학생에게는 안 보인다).
post_once /admin/meetings "8월 운영 회의" /admin/meetings "{\"title\":\"8월 운영 회의\",\"meetingType\":\"ops\",\"meetingDate\":\"2026-08-04T19:00:00.000Z\",\"participants\":[\"운영진 전원\"],\"bodyMd\":\"모집 일정과 9월 세미나 주제를 정했습니다.\",\"decisionsMd\":\"- 정기모집 12월 유지\\n- 9월 세미나: 배포 자동화\",\"visibility\":\"admin_only\"}"
post_once /admin/meetings "멘토 정기 싱크" /admin/meetings "{\"title\":\"멘토 정기 싱크\",\"meetingType\":\"general\",\"meetingDate\":\"2026-07-28T12:00:00.000Z\",\"participants\":[\"멘토진\",\"운영진\"],\"bodyMd\":\"팀별 진행 상황을 공유했습니다.\",\"visibility\":\"mentor_visible\"}"
say "meetings" "2건"

echo
echo "마일스톤"
for p in 1 2; do
  post_once_nested "/admin/projects/$p" milestones "MVP 배포" "/admin/projects/$p/milestones" "{\"title\":\"MVP 배포\",\"description\":\"첫 사용자가 실제로 써볼 수 있는 상태.\",\"dueAt\":\"2026-09-30T15:00:00.000Z\",\"status\":\"in_progress\",\"sortOrder\":0}"
  post_once_nested "/admin/projects/$p" milestones "사용자 테스트" "/admin/projects/$p/milestones" "{\"title\":\"사용자 테스트\",\"description\":\"바깥 사람 5명에게 붙여보고 고칩니다.\",\"dueAt\":\"2026-10-31T15:00:00.000Z\",\"status\":\"planned\",\"sortOrder\":1}"
done
say "project_milestones" "4건"

echo
echo "아티팩트"
post_once /admin/artifacts "Team Alpha 기획서" /admin/artifacts "{\"projectId\":1,\"title\":\"Team Alpha 기획서\",\"description\":\"문제 정의와 초기 화면 흐름.\",\"artifactType\":\"document\",\"url\":\"https://example.com/alpha-plan\",\"visibility\":\"cohort_visible\"}"
post_once /admin/artifacts "Team Beta 데모 영상" /admin/artifacts "{\"projectId\":2,\"title\":\"Team Beta 데모 영상\",\"description\":\"3분 시연.\",\"artifactType\":\"video\",\"url\":\"https://example.com/beta-demo\",\"visibility\":\"cohort_visible\"}"
post_once /admin/artifacts "타입 정리 노트" /admin/artifacts "{\"studentId\":$S1,\"studyId\":$ST,\"title\":\"타입 정리 노트\",\"artifactType\":\"link\",\"url\":\"https://example.com/ts-notes\",\"visibility\":\"student_visible\"}"
say "artifacts" "3건"

echo
echo "피드백"
# 한 학생에게만 주면 다른 계정으로 로그인했을 때 화면이 빈다(처음에 그렇게 만들어
# /student/feedback 이 계속 비어 있었다). 학생 전원에게 하나씩 준다.
for s in $STUDENTS; do
  post_once_content /admin/feedback "문제 정의가 또렷합니다. 사용자를 좁게 잡은 게 특히 좋았어요." /admin/feedback "{\"targetType\":\"student\",\"targetId\":$s,\"studentId\":$s,\"feedbackType\":\"strength\",\"content\":\"문제 정의가 또렷합니다. 사용자를 좁게 잡은 게 특히 좋았어요.\",\"visibility\":\"student_visible\"}"
done
post_once_content /admin/feedback "배포를 뒤로 미루지 마세요. 지금 상태로 한 번 올려두면 남은 일정이 훨씬 편합니다." /admin/feedback "{\"targetType\":\"project\",\"targetId\":2,\"studentId\":$S2,\"feedbackType\":\"improvement\",\"content\":\"배포를 뒤로 미루지 마세요. 지금 상태로 한 번 올려두면 남은 일정이 훨씬 편합니다.\",\"visibility\":\"student_visible\"}"
post_once_content /admin/feedback "운영진 내부 메모입니다." /admin/feedback "{\"targetType\":\"student\",\"targetId\":$S1,\"studentId\":$S1,\"feedbackType\":\"review\",\"content\":\"운영진 내부 메모입니다.\",\"visibility\":\"admin_only\"}"
say "feedback" "학생당 1건 + 프로젝트 1 + 내부 1"

# /mentor/feedback 은 "내가 남긴 것"만 보여준다. 운영진이 쓴 건 안 뜬다 —
# 멘토로 로그인해서 직접 써야 그 화면이 채워진다.
if [ -n "${SEED_MENTOR_EMAIL:-}" ] && [ -n "${SEED_MENTOR_PASSWORD:-}" ]; then
  MJAR="$(mktemp)"
  curl -s -c "$MJAR" -X POST "$API/admin/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$SEED_MENTOR_EMAIL\",\"password\":\"$SEED_MENTOR_PASSWORD\"}" >/dev/null
  curl -s -b "$MJAR" -X POST "$API/mentor/projects/2/feedback" -H 'content-type: application/json' \
    -d "{\"content\":\"이번 주 배포 파이프라인 붙인 것 잘 봤습니다. 다음은 롤백을 한 번 연습해 보세요.\",\"feedbackType\":\"review\",\"visibility\":\"student_visible\"}" >/dev/null
  rm -f "$MJAR"
  say "mentor feedback" "1건 (멘토 본인 작성)"
else
  say "mentor feedback" "건너뜀 — SEED_MENTOR_EMAIL/PASSWORD 미설정"
fi

echo
echo "활동 기록"
post_once /admin/activity-records "Team Alpha 중간 발표" /admin/activity-records "{\"studentId\":$S1,\"cohortId\":$COHORT,\"programId\":$PROG,\"sourceType\":\"project\",\"sourceId\":1,\"title\":\"Team Alpha 중간 발표\",\"description\":\"기획과 초기 구현을 공유했습니다.\",\"activityDate\":\"2026-07-15\",\"visibility\":\"student_visible\"}"
post_once /admin/activity-records "1주차 모임 참석" /admin/activity-records "{\"studentId\":$S2,\"cohortId\":$COHORT,\"programId\":$PROG,\"sourceType\":\"session\",\"title\":\"1주차 모임 참석\",\"activityDate\":\"2026-07-10\",\"visibility\":\"student_visible\"}"
post_once /admin/activity-records "멘토 피드백 반영" /admin/activity-records "{\"studentId\":$S2,\"cohortId\":$COHORT,\"sourceType\":\"feedback\",\"title\":\"멘토 피드백 반영\",\"description\":\"배포 파이프라인을 먼저 세웠습니다.\",\"activityDate\":\"2026-08-01\",\"visibility\":\"student_visible\"}"
say "activity_records" "3건"

echo
echo "출석"
# 세션에 출석 기록이 없으면 /student/attendance 와 /admin/attendance 가 빈 상태만 검증된다.
SESSION="$(curl -s -b "$JAR" "$API/admin/sessions" | python3 -c "
import sys,json;d=json.load(sys.stdin);r=d if isinstance(d,list) else d.get('items',[]);print(r[0]['id'] if r else '')")"
if [ -n "$SESSION" ]; then
  # present/late/excused 를 돌려 가며 붙인다. absent 는 넣지 않는다 —
  # 활동 기록에 결석을 안 남기는 것과 같은 이유(설계 07 ADR-013).
  RECS=""; i=0
  for s in $STUDENTS; do
    # `ST` 를 쓰면 안 된다 — 위에서 스터디 id 를 담은 변수다(덮어쓰면
    # 이후 스터디 경로가 //members 로 깨진다).
    case $((i % 3)) in 0) ATT=present;; 1) ATT=late;; *) ATT=excused;; esac
    [ -n "$RECS" ] && RECS="$RECS,"
    RECS="$RECS{\"studentId\":$s,\"status\":\"$ATT\"}"
    i=$((i+1))
  done
  curl -s -b "$JAR" -X PUT "$API/admin/sessions/$SESSION/attendance" \
    -H 'content-type: application/json' -d "{\"records\":[$RECS]}" >/dev/null
  say "attendance_records" "모임 $SESSION · $(echo "$STUDENTS" | wc -w)명"
else
  say "attendance_records" "건너뜀 — 모임이 없다"
fi

echo
echo "팀 회의록 (설계 06)"
# 팀원 본인만 쓸 수 있다 — 운영진 계정으로는 못 만든다.
if [ -n "${SEED_STUDENT_EMAIL:-}" ] && [ -n "${SEED_STUDENT_PASSWORD:-}" ]; then
  SJAR="$(mktemp)"
  curl -s -c "$SJAR" -X POST "$API/admin/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$SEED_STUDENT_EMAIL\",\"password\":\"$SEED_STUDENT_PASSWORD\"}" >/dev/null
  MYPROJ="$(curl -s -b "$SJAR" "$API/student/projects" | python3 -c "
import sys,json;d=json.load(sys.stdin);r=d if isinstance(d,list) else d.get('items',[]);print(r[0]['id'] if r else '')")"
  if [ -n "$MYPROJ" ]; then
    post_s() { curl -s -b "$SJAR" -X POST "$API$1" -H 'content-type: application/json' -d "$2" >/dev/null; }
    # 참여자를 안 넣으면 team_meeting_participants 가 계속 0행이라 그 경로가
    # 검증되지 않는다. 팀 명단(meta.roster)에서 그대로 가져다 붙인다 —
    # 명단 밖 id 를 넣으면 서버가 422 로 거부하므로 지어내면 안 된다.
    ROSTER="$(curl -s -b "$SJAR" "$API/student/team-meetings/meta?ownerType=project&ownerId=$MYPROJ" | python3 -c "
import sys,json;d=json.load(sys.stdin);print(','.join(str(r['id']) for r in d.get('roster',[])))")"
    # 학생 세션($SJAR)으로 자기 팀 회의록을 먼저 본다. 어드민 목록과 경로가 다르다.
    HAVE="$(curl -s -b "$SJAR" "$API/student/team-meetings" 2>/dev/null || true)"
    case "$HAVE" in
      *"8월 2주차 팀 회의"*) tally skipped; tally skipped; MYPROJ="" ;;
    esac
    [ -n "$MYPROJ" ] && post_s /student/team-meetings "{\"ownerType\":\"project\",\"ownerId\":$MYPROJ,\"title\":\"8월 2주차 팀 회의\",\"contentMd\":\"## 정한 것\\n- 배포 파이프라인을 먼저 세운다\\n- 다음 주까지 롤백을 한 번 연습한다\\n\\n## 막힌 것\\n- 오브젝트 스토리지 설정 권한이 없다\",\"tags\":[\"배포\",\"주간\"],\"participantUserIds\":[$ROSTER]}"
    [ -n "$MYPROJ" ] && post_s /student/team-meetings "{\"ownerType\":\"project\",\"ownerId\":$MYPROJ,\"title\":\"8월 1주차 팀 회의\",\"contentMd\":\"## 정한 것\\n- 화면 흐름을 셋으로 줄인다\\n- 각자 맡을 화면을 나눴다\",\"tags\":[\"기획\"]}"
    say "team_meetings" "프로젝트 $MYPROJ · 2건"
  else
    say "team_meetings" "건너뜀 — 이 학생의 프로젝트가 없다"
  fi
  rm -f "$SJAR"
else
  say "team_meetings" "건너뜀 — SEED_STUDENT_EMAIL/PASSWORD 미설정"
fi

echo
echo "태그 · 태그 연결"
for t in 백엔드 프론트엔드 배포 기획; do
  TID="$(post /admin/tags "{\"name\":\"$t\"}" | j id)"
  [ -n "$TID" ] && eval "TAG_$(echo "$t" | md5sum | cut -c1-6)=$TID"
  [ -n "$TID" ] && LAST_TAG="$TID"
done
say "skill_tags" "4건"
FIRST_TAG="$(curl -s -b "$JAR" "$API/admin/tags" | python3 -c "import sys,json;d=json.load(sys.stdin);r=d if isinstance(d,list) else d.get('items',[]);print(r[0]['id'] if r else '')")"
if [ -n "$FIRST_TAG" ]; then
  post /admin/tag-mappings "{\"tagId\":$FIRST_TAG,\"targetType\":\"project\",\"targetId\":1}" >/dev/null
  post /admin/tag-mappings "{\"tagId\":${LAST_TAG:-$FIRST_TAG},\"targetType\":\"project\",\"targetId\":2}" >/dev/null
  say "tag_mappings" "2건"
fi

echo
echo
# 두 번째 실행부터는 만든 것이 0이어야 한다. 아니면 어딘가 판정이 새고 있다.
printf '  %-22s %s\n' "새로 만든 것" "$(count_of created)건"
printf '  %-22s %s\n' "이미 있어 건너뜀" "$(count_of skipped)건"
FAILED="$(count_of failed)"
if [ "$FAILED" != "0" ]; then
  printf '  %-22s %s\n' "실패" "${FAILED}건  ← 위 ⚠ 를 보라"
fi
echo
echo "끝. 남은 빈 테이블은 엔드포인트가 없어서다 — 위 주석 참고."
