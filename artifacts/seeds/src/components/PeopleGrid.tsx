import { useQuery } from "@tanstack/react-query";
import {
  api,
  PEOPLE_KIND_LABEL,
  PEOPLE_KINDS,
  type PeopleKind,
  type PublicPeopleProfile,
} from "@/lib/mvp3-api";
import {
  Portrait,
  RosterRow,
  hasPortraits,
  annualRule,
  annualSeal,
} from "@/components/annual";

/**
 * 사람들 — 기수 연감(DESIGN.md)의 인물 판.
 *
 * 이 화면은 다른 공개 페이지를 연감으로 옮길 때 빠져 있었다. eyebrow("Seeds
 * People")·카드 격자·`font-serif`·📞 이모지가 그대로 남아 홈과 다른 세계처럼
 * 보였고, 사용자가 지적한 "전체적으로 별로"의 상당 부분이 여기서 나왔다.
 *
 * 연감에서 인물 판은 부록이 아니라 본체다. 그래서 다른 판보다 밀도를 높게
 * 잡는다 — 판번호, 초상, 이름, 직함, 소속, 소개, 분류가 한 칸에 다 들어간다.
 */

const KIND_SUBTITLE: Record<PeopleKind, string> = {
  mentor: "Seeds 학생들의 성장을 함께하는 분야별 멘토를 소개합니다.",
  staff: "Seeds 프로그램을 기획·운영하는 운영진입니다.",
  member:
    "Seeds에서 함께 배우고 만드는 학생들입니다. 본인이 공개에 동의한 경우에만 표시됩니다.",
};
const KIND_EMPTY: Record<PeopleKind, string> = {
  mentor: "아직 공개된 멘토가 없습니다.",
  staff: "아직 공개된 운영진이 없습니다.",
  member: "아직 공개에 동의한 학생이 없습니다.",
};

export function PeopleGrid({
  kind,
  onKindChange,
}: {
  kind: PeopleKind;
  onKindChange: (k: PeopleKind) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-people", kind],
    queryFn: () => api<{ items: PublicPeopleProfile[] }>(`/people/${kind}`),
  });

  const items = data?.items ?? [];

  return (
    <>
      {/* ── 표제 ─────────────────────────────────────────────────────────
          가운데 정렬을 버린다. 연감의 판면은 왼쪽 정렬이고, 가운데 정렬 표제 +
          가운데 정렬 부제는 이 카테고리의 기본 랜딩 문법이다. */}
      <section className="border-b" style={annualRule}>
        <div className="container mx-auto max-w-6xl px-4 pb-10 pt-16 md:pb-12 md:pt-24">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <h1
              className="press-in ink-press font-bold leading-[0.9] tracking-[-0.045em]"
              style={{ fontSize: "clamp(3rem, 8vw, 6rem)" }}
            >
              사람들
            </h1>
            {/* 총원은 연감의 판권 정보처럼 작게 붙는다. 로딩 중에는 자리만
                지켜 숫자가 튀어 들어오지 않게 한다. */}
            <dl className="pb-2 text-right">
              <dt className="plate-no text-[11px] uppercase">수록 인원</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums tracking-[-0.02em]">
                {isLoading ? "—" : items.length}
              </dd>
            </dl>
          </div>
          <p className="mt-6 max-w-[62ch] text-base leading-[1.7] text-muted-foreground">
            Seeds를 함께 만드는 멘토·운영진·학생을 소개합니다.
          </p>
        </div>
      </section>

      {/* ── 색인 탭 ──────────────────────────────────────────────────────
          연감의 책등 색인처럼 왼쪽에 붙는다. 선택된 항목은 도장 색 밑줄과
          굵기로 함께 말한다 — 색만으로 상태를 전하지 않는다. */}
      <section className="border-b" style={annualRule}>
        <div className="container mx-auto max-w-6xl px-4">
          <div role="tablist" className="-mb-px flex flex-wrap gap-x-8">
            {PEOPLE_KINDS.map((k) => {
              const on = k === kind;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onKindChange(k)}
                  className={`cursor-pointer border-b-2 py-4 text-sm tracking-[-0.01em] transition-colors ${
                    on
                      ? "font-bold"
                      : "border-transparent font-medium text-muted-foreground hover:text-foreground"
                  }`}
                  style={
                    on ? { borderColor: "hsl(var(--seal))", ...annualSeal } : undefined
                  }
                >
                  {PEOPLE_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="mb-10 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            {KIND_SUBTITLE[kind]}
          </p>

          {isLoading ? (
            /* 스피너 대신 판 자리를 미리 잡는다. 초상 격자냐 명부냐는 데이터가
               와야 정해지므로, 어느 쪽으로 확정되든 덜 튀는 괘선 줄로 채운다. */
            <ul className="grid border-b md:grid-cols-2 md:gap-x-14" style={annualRule} aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="border-t py-6" style={annualRule}>
                  <div className="h-6 w-40" style={{ backgroundColor: "hsl(var(--paper-2))" }} />
                  <div className="mt-3 h-3 w-24" style={{ backgroundColor: "hsl(var(--paper-2))" }} />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <p className="border-t py-16 text-muted-foreground" style={annualRule}>
              {KIND_EMPTY[kind]}
            </p>
          ) : hasPortraits(items) ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4">
              {items.map((p, i) => (
                <Portrait
                  key={p.id}
                  no={String(i + 1).padStart(2, "0")}
                  name={p.name}
                  roleTitle={p.roleTitle}
                  affiliation={p.affiliation}
                  bio={p.bio}
                  photoUrl={p.photoUrl}
                  tags={p.tags}
                  href={`/people/${p.kind}/${p.id}`}
                />
              ))}
            </div>
          ) : (
            /* 명부 판형 — 두 단으로 흘려 세로로 늘어지지 않게 한다. */
            <ul className="grid border-b md:grid-cols-2 md:gap-x-14" style={annualRule}>
              {items.map((p, i) => (
                <RosterRow
                  key={p.id}
                  no={String(i + 1).padStart(2, "0")}
                  name={p.name}
                  roleTitle={p.roleTitle}
                  affiliation={p.affiliation}
                  bio={p.bio}
                  tags={p.tags}
                  href={`/people/${p.kind}/${p.id}`}
                />
              ))}
            </ul>
          )}

          {/* 연락처는 인증된 회원에게만 내려온다(서버가 비회원에겐 null을 준다).
              하나라도 있으면 판 아래 각주로 모아 붙인다 — 초상마다 전화 아이콘을
              달면 연감이 아니라 주소록이 된다. */}
          {items.some((p) => p.phone) ? (
            <dl className="mt-14 border-t pt-6" style={annualRule}>
              <dt className="plate-no text-[11px] uppercase">연락처</dt>
              <dd className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {items
                  .filter((p) => p.phone)
                  .map((p) => (
                    <a
                      key={p.id}
                      href={`tel:${p.phone!.replace(/[^0-9+]/g, "")}`}
                      className="underline-offset-4 hover:underline"
                    >
                      <span className="font-semibold">{p.name}</span>{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {p.phone}
                      </span>
                    </a>
                  ))}
              </dd>
            </dl>
          ) : null}
        </div>
      </section>
    </>
  );
}
