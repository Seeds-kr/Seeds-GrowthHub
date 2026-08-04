import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";
import { MentorRoster } from "@/components/MentorRoster";
import { Plate } from "@/components/annual";
import { ArrowRight } from "lucide-react";

/**
 * 공개 홈 — 기수 연감(DESIGN.md).
 *
 * 이 동아리의 단위는 기수이고, 연감은 한 기수를 통째로 기록해 남기는 물건이다.
 * `PRODUCT.md`의 1원칙이 "인수인계가 제품이다"이므로 겉모습이 제품의 주장과 같다.
 * 지원자에게 하는 말은 하나다 — 여기서 1년을 보내면 무엇이 남는가.
 *
 * 향수는 가져오지 않는다. 연감은 회고적이지만 이 표면은 다음 기수를 모집하므로
 * 과거형으로 말하지 않고, 아직 비어 있는 판을 "이 자리가 당신 것"으로 쓴다.
 *
 * 문구는 전부 `site-content`에서 온다 — 운영진이 배포 없이 고친다. 여기서 바꾼 것은
 * 판면뿐이고 내용은 한 글자도 지어내지 않았다. eyebrow 필드는 데이터에 남아 있지만
 * 렌더하지 않는다: 제목 위 kicker는 craft-floor의 금지 항목이고, 제목이 스스로
 * 무게를 진다.
 */
export default function Home() {
  const { value: c } = useSiteContent("page.home", HOME_DEFAULT);

  // 연감의 표지 연도. `activities`는 최신 연도가 앞이라 첫 항목이 현재 기수다.
  const currentYear = c.activities.items[0]?.date ?? "";

  return (
    <PublicLayout>
        {/* ── 표지 ───────────────────────────────────────────────────────── */}
        <section className="border-b" style={{ borderColor: "hsl(var(--rule))" }}>
          <div className="container mx-auto max-w-5xl px-4 py-20 md:py-28">
            {/* 표지의 활자 낙차가 이 판면의 전부다. 연도 각인과 그 옆에 붙는
                캡션의 크기 차이를 크게 벌린다 — 1차 시도는 제목 3rem·본문 1rem이
                전부라 위계가 밋밋했다. */}
            <div className="press-in">
              <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
                <div
                  className="ink-press font-bold leading-[0.8] tracking-[-0.055em]"
                  style={{
                    fontSize: "clamp(4.5rem, 14vw, 11rem)",
                    color: "hsl(var(--seal))",
                  }}
                >
                  {currentYear}
                </div>
                <div className="pb-3 md:pb-5">
                  <div className="plate-no text-[11px] uppercase">기수 기록</div>
                  <div className="mt-1 text-sm font-semibold tracking-[-0.01em]">
                    Seeds GrowthHub
                  </div>
                </div>
              </div>
              <h1
                className="mt-7 max-w-3xl whitespace-pre-line font-bold leading-[1.12] tracking-[-0.04em]"
                style={{ fontSize: "clamp(2.125rem, 4.6vw, 3.75rem)" }}
              >
                {c.hero.title}
              </h1>
            </div>

            <p className="mt-7 max-w-[64ch] whitespace-pre-line text-base leading-[1.7] text-muted-foreground md:text-lg">
              {c.hero.body}
            </p>

            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href={c.hero.primaryCtaHref}>
                <Button size="lg" className="h-12 px-7 text-base">
                  {c.hero.primaryCtaLabel}
                </Button>
              </Link>
              <Link href={c.hero.secondaryCtaHref}>
                <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                  {c.hero.secondaryCtaLabel}
                </Button>
              </Link>
            </div>

            {/* 판권 정보처럼 표지 아래에 붙는 사실들. 큰 숫자 카드 격자(hero-metric
                템플릿)를 쓰지 않는 이유는 그것이 이 카테고리의 기본값이기 때문이고,
                연감에서 수치는 자랑이 아니라 기록이라 작게 놓인다. */}
            <dl className="mt-16 grid grid-cols-2 border-t sm:grid-cols-4" style={{ borderColor: "hsl(var(--rule))" }}>
              {c.stats.items.map((s, i) => (
                /* 세로 괘선으로 칸을 나눈다 — 판권 정보는 표로 조판된다.
                   첫 칸에는 왼쪽 선을 두지 않아 판면 가장자리가 열려 있게 한다. */
                <div
                  key={i}
                  className="border-l py-5 pl-4 first:border-l-0 first:pl-0 sm:pl-5"
                  style={{ borderColor: "hsl(var(--rule))" }}
                >
                  <dt className="plate-no text-[11px] uppercase">{s.label}</dt>
                  <dd className="mt-1.5 text-2xl font-bold tabular-nums tracking-[-0.03em] md:text-3xl">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 01 색인: 연도별 기록 ───────────────────────────────────────── */}
        <Plate no="01" title={c.activities.title}>
          <ol>
            {c.activities.items.map((a, i) => {
              const isCurrent = i === 0;
              return (
                <li
                  key={a.date}
                  className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-5 border-t py-5 md:grid-cols-[7rem_1fr] md:gap-x-8"
                  style={{ borderColor: "hsl(var(--rule))" }}
                >
                  <span
                    className="text-lg font-bold tabular-nums tracking-[-0.02em] md:text-2xl"
                    style={isCurrent ? { color: "hsl(var(--seal))" } : undefined}
                  >
                    {a.date}
                  </span>
                  <div>
                    <h3 className="text-base font-bold tracking-[-0.02em] md:text-lg">
                      {a.title}
                      {/* 색이 아니라 글자로도 현재 기수를 말한다 — 색만으로 상태를
                          전하지 않는다는 접근성 원칙. */}
                      {isCurrent ? (
                        <span
                          className="ml-2 align-middle text-xs font-semibold"
                          style={{ color: "hsl(var(--seal))" }}
                        >
                          모집 예정
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                      {a.summary}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Plate>

        {/* ── 02 무엇을 만드는가 ─────────────────────────────────────────── */}
        <Plate no="02" title={c.about.title} lead={c.about.body}>
          <Link
            href={c.about.ctaHref}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: "hsl(var(--seal))" }}
          >
            {c.about.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </Plate>

        {/* ── 03 인물 판 ─────────────────────────────────────────────────
            실존 멘토진. 등록된 사람이 없으면 스스로 렌더하지 않는다. */}
        <MentorRoster />

        {/* ── 04 활동 플레이트 ───────────────────────────────────────────── */}
        <Plate no="04" title={c.projects.title} lead={c.projects.body}>
          {/* 고정 축척 그리드 — 크기로 서열을 만들지 않는다. 카드로 감싸지 않고
              괘선으로만 구획한다(중첩 카드 금지). */}
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {c.projects.items.map((p, i) => (
              <article
                key={i}
                className="border-t pt-5"
                style={{ borderColor: "hsl(var(--rule))" }}
              >
                <div className="plate-no text-[11px] uppercase">{p.status}</div>
                <h3 className="mt-2 text-lg font-bold tracking-[-0.02em]">{p.title}</h3>
                <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  {p.summary}
                </p>
              </article>
            ))}
          </div>
        </Plate>

        {/* ── 05 아직 비어 있는 판 ───────────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "hsl(var(--rule))", backgroundColor: "hsl(var(--seal))" }}
        >
          <div className="container mx-auto max-w-5xl px-4 py-20 md:py-24">
            <div className="plate-no text-[11px] uppercase" style={{ color: "hsl(0 0% 100% / 0.7)" }}>
              05
            </div>
            <h2
              className="mt-3 max-w-3xl text-3xl font-bold leading-[1.2] tracking-[-0.035em] md:text-4xl"
              style={{ color: "hsl(0 0% 100%)" }}
            >
              {c.recruitBanner.title}
            </h2>
            <p
              className="mt-5 max-w-[62ch] text-base leading-[1.7]"
              style={{ color: "hsl(0 0% 100% / 0.85)" }}
            >
              {c.recruitBanner.body}
            </p>
            <Link href={c.recruitBanner.ctaHref}>
              <Button
                size="lg"
                variant="secondary"
                className="mt-8 h-12 px-7 text-base"
              >
                {c.recruitBanner.ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
    </PublicLayout>
  );
}
