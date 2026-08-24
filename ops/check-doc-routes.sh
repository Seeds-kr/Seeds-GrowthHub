#!/usr/bin/env bash
# 문서가 약속하는 API 라우트가 코드에 실제로 있는지 대조한다.
#
# 문서는 코드보다 앞서가기 쉽다(이 레포에서 여러 번 그랬다). 없어진 라우트를
# 계속 안내하는 문서는 없느니만 못하다 — 다음 사람이 그걸 믿고 404 를 만난다.
#
# **여러 줄로 쓰인 라우트를 놓치지 않는 것이 핵심이다.**
#
#   router.get("/a", h)              한 줄 — 단순 grep 으로 잡힌다
#   router.get(                      여러 줄 — grep 으로는 안 잡힌다
#     "/b",
#     h,
#   )
#
# 2026-08-24 에 한 줄짜리 정규식으로 훑었다가 멀쩡한 라우트 6개를 "없음" 으로
# 보고할 뻔했다. 그래서 `re.S` 로 줄바꿈을 건너뛰며 찾는다.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - "$@" <<'PY'
import pathlib, re, sys

pat = re.compile(r'router\.(get|post|put|patch|delete)\(\s*"([^"]+)"', re.S)
routes = set()
for f in pathlib.Path('artifacts/api-server/src/routes').glob('*.ts'):
    for m, p in pat.findall(f.read_text()):
        routes.add(f"{m.upper()} {p}")

docs = sys.argv[1:] or [str(p) for p in pathlib.Path('docs').rglob('*.md')]
doc_pat = re.compile(r'`(GET|POST|PATCH|PUT|DELETE) (/[a-z0-9/:_-]+)`')

missing = []
seen = 0
for d in docs:
    text = pathlib.Path(d).read_text()
    for m, p in doc_pat.findall(text):
        # 예시 경로는 건너뛴다. `GET /mentor/projects/2` 처럼 **실제 id 가 박힌**
        # 문장은 라우트 명세가 아니라 "이렇게 호출해 봤다" 는 기록이다. 이걸
        # 세면 멀쩡한 문서가 계속 불일치로 뜬다.
        if re.search(r'/\d+(/|$)', p):
            continue
        # 조각 경로도 건너뛴다(`PATCH /:id` 처럼 마운트 접두어가 생략된 것).
        if re.fullmatch(r'/:\w+', p):
            continue
        seen += 1
        # 문서는 `/api` 접두어를 붙이기도 한다. 라우터는 그 아래에 마운트된다.
        cands = {f"{m} {p}", f"{m} {p.replace('/api/', '/', 1)}"}
        if not (cands & routes):
            missing.append((d, m, p))

print(f"실제 라우트 {len(routes)}개 · 문서가 적은 것 {seen}건")
if missing:
    print("\n문서에 있는데 코드에 없는 라우트:")
    for d, m, p in missing:
        print(f"  {d}: {m} {p}")
    sys.exit(1)
print("문서가 적은 라우트가 전부 코드에 있다.")
PY
