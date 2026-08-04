import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type PublicPeopleProfile } from "@/lib/mvp3-api";
import {
  Portrait,
  RosterRow,
  hasPortraits,
  annualRule,
  annualSeal,
} from "@/components/annual";

/**
 * 홈의 멘토 판.
 *
 * 이 동아리가 가진 가장 강한 실물 자산은 실존 멘토진인데 1차 연감 개편에서
 * 공개 홈 어디에도 나오지 않았다. 지원자가 가장 알고 싶은 것("누가 가르치나")이
 * 홈에 없고 별도 페이지에 숨어 있던 셈이다.
 *
 * 사람을 지어내지 않는다(PRODUCT.md의 근거 항목). 전부 `/people/mentor`가
 * 실제로 내려주는 것만 그린다. 아직 아무도 등록되지 않은 설치본에서는 판 자체를
 * 렌더하지 않는다 — 빈 자리를 "곧 공개"로 채우면 없는 것을 있는 것처럼 말하게 된다.
 */
export function MentorRoster({ limit = 8 }: { limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-people", "mentor"],
    queryFn: () => api<{ items: PublicPeopleProfile[] }>("/people/mentor"),
  });

  const all = data?.items ?? [];
  // 로딩 중과 0명을 똑같이 취급한다. 판이 나타났다 사라지면 아래 판들이
  // 통째로 밀려 올라가므로, 확정될 때까지 자리를 만들지 않는다.
  if (isLoading || all.length === 0) return null;

  const shown = all.slice(0, limit);
  const rest = all.length - shown.length;

  return (
    <section className="border-t" style={annualRule}>
      <div className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <div className="plate-no text-[11px] uppercase">03</div>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] md:text-4xl">
              가르치는 사람들
            </h2>
          </div>
          {/* 인원은 자랑이 아니라 기록이라 작게 놓인다. */}
          <dl className="pb-1">
            <dt className="plate-no text-[11px] uppercase">멘토</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums tracking-[-0.02em]">
              {all.length}
            </dd>
          </dl>
        </div>

        <p className="mt-4 max-w-[62ch] text-base leading-[1.75] text-muted-foreground">
          현업에서 일하는 멘토가 기수 내내 팀에 붙습니다. 특강 한 번이 아니라,
          만드는 동안 같이 봅니다.
        </p>

        {hasPortraits(shown) ? (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 md:gap-x-8">
            {shown.map((p, i) => (
              <Portrait
                key={p.id}
                no={String(i + 1).padStart(2, "0")}
                name={p.name}
                roleTitle={p.roleTitle}
                affiliation={p.affiliation}
                photoUrl={p.photoUrl}
                href={`/people/mentor/${p.id}`}
              />
            ))}
          </div>
        ) : (
          /* 홈에서는 소개문(bio)과 기술 태그를 뺀다 — 여기서 필요한 것은
             "누가 있는가"까지고, 상세는 사람들 페이지가 맡는다. */
          <ul className="mt-8 grid border-b md:grid-cols-2 md:gap-x-14" style={annualRule}>
            {shown.map((p, i) => (
              <RosterRow
                key={p.id}
                no={String(i + 1).padStart(2, "0")}
                name={p.name}
                roleTitle={p.roleTitle}
                affiliation={p.affiliation}
                href={`/people/mentor/${p.id}`}
              />
            ))}
          </ul>
        )}

        <Link
          href="/people"
          className="mt-10 inline-flex border-b-2 pb-0.5 text-sm font-semibold"
          style={{ borderColor: "hsl(var(--seal))", ...annualSeal }}
        >
          {rest > 0 ? `멘토 ${rest}명 더 보기` : "사람들 전체 보기"}
        </Link>
      </div>
    </section>
  );
}
