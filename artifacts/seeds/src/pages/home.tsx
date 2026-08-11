import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";
import { ArrowRight } from "lucide-react";
import { PHOTOS, WORKS } from "@/assets/photos";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";
import { HorizontalDrift } from "@/components/HorizontalDrift";
import { CountUp, Magnetic, Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";

/**
 * 공개 홈.
 *
 * 판면·문구·정보 구조는 원래 그대로다. 얹은 것은 모션 레이어뿐이고, 각 모션은
 * 하나씩 할 일이 있다:
 *
 *   히어로 유동 배경   살아 있는 화면이라는 첫인상. 정지해도 성립하는 구성이라
 *                     모션이 꺼지면 은은한 그라디언트로 남는다.
 *   히어로 캐스케이드   읽는 순서를 만든다. 표제 → 본문 → 행동 순으로 도착한다.
 *   숫자 카운트업     "3년+ / 96명"이 쌓인 기록이라는 걸 보여준다. 화면에
 *                     들어올 때 한 번만 센다.
 *   스크롤 등장       긴 페이지에서 지금 읽을 구간을 가리킨다.
 *   카드 광원·부상     포인터에 반응한다는 피드백.
 *   자석 버튼         주요 행동에만. 손에 붙는 느낌을 만든다.
 *
 * 전부 `prefers-reduced-motion` 에서 정지한다(사라지지 않는다). 스크롤 값은
 * IntersectionObserver 로만 읽고 스크롤 이벤트를 걸지 않는다.
 */
export default function Home() {
  const { value: c } = useSiteContent("page.home", HOME_DEFAULT);
  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28">
        <LiquidBackdrop />
        <div className="container relative mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            {/* 지연을 계단으로 준다. 같은 시각에 다 들어오면 순서가 사라진다. */}
            <div
              className="rise mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary"
              style={{ animationDelay: "60ms" }}
            >
              {c.hero.eyebrow}
            </div>
            <h1
              className="rise mb-6 whitespace-pre-line text-4xl font-serif font-bold leading-tight tracking-tight text-foreground md:text-5xl"
              style={{ animationDelay: "140ms" }}
            >
              {c.hero.title}
            </h1>
            <p
              className="rise mb-8 whitespace-pre-line text-base leading-relaxed text-muted-foreground md:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              {c.hero.body}
            </p>
            <div
              className="rise flex flex-col items-start gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "340ms" }}
            >
              {/* 자석 효과는 주요 행동 하나에만. 둘 다 끌리면 어느 쪽이 주된
                  행동인지 알 수 없어지고, 효과 자체도 값싸 보인다. */}
              <Magnetic>
                <Link href={c.hero.primaryCtaHref}>
                  <Button size="lg" className="h-12 px-7 text-base">
                    {c.hero.primaryCtaLabel}
                  </Button>
                </Link>
              </Magnetic>
              <Link href={c.hero.secondaryCtaHref}>
                <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                  {c.hero.secondaryCtaLabel}
                </Button>
              </Link>
            </div>
          </div>
          {/* 클립아트를 실제 기수 사진으로 바꿨다. 지원자가 가장 알고 싶은 건
              "여기 어떤 사람들이 있나" 인데, 일러스트는 그 질문에 답하지 못한다.
              이 사진 한 장이 본문 세 문단보다 많은 말을 한다. */}
          <div className="rise" style={{ animationDelay: "200ms" }}>
            <figure className="relative overflow-hidden rounded-lg elev-2">
              <img
                src={PHOTOS.cohortGroup.src}
                alt={PHOTOS.cohortGroup.alt}
                /* 히어로 이미지는 첫 화면에 보이므로 지연 로딩하지 않는다.
                   lazy 를 걸면 LCP 가 늦어진다. */
                loading="eager"
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <Reveal>
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              {c.stats.eyebrow}
            </div>
            <h2 className="mb-12 text-center font-serif text-3xl font-bold md:text-4xl">
              {c.stats.title}
            </h2>
          </Reveal>
          <Stagger className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            {c.stats.items.map((s, i) => (
              <StaggerItem key={i} className="bg-card p-8 text-center">
                <div className="mb-2 font-serif text-4xl font-bold tabular-nums text-primary md:text-5xl">
                  <CountUp value={s.value} />
                </div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 px-4 py-24">
        <div className="container mx-auto max-w-4xl">
          <Reveal>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              {c.about.eyebrow}
            </div>
            <h2 className="mb-6 font-serif text-3xl font-bold md:text-4xl">{c.about.title}</h2>
            <p className="mb-8 max-w-3xl whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
              {c.about.body}
            </p>
            <Link href={c.about.ctaHref}>
              {/* 화살표가 커서 쪽으로 나가면서 "이어진다"는 걸 말한다. */}
              <Button variant="outline" className="group">
                {c.about.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Activities (4 cards) ─────────────────────────────────────────── */}
      <section className="border-t border-border px-4 py-24">
        <div className="container mx-auto max-w-5xl">
          <Reveal>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              {c.projects.eyebrow}
            </div>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl">{c.projects.title}</h2>
            <p className="mb-12 max-w-2xl whitespace-pre-line leading-relaxed text-muted-foreground">
              {c.projects.body}
            </p>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.projects.items.map((p, i) => (
              <StaggerItem key={i}>
                <SurfaceCard className="h-full">
                  <div className="mb-4 inline-flex items-center self-start rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {p.status}
                  </div>
                  <h3 className="mb-3 text-lg font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 학생들이 만든 것 ──────────────────────────────────────────────
          사이트에 없던 판이다. "무엇을 하는 동아리인가" 는 문장으로 설명하고
          있었지만, 실제로 나온 결과물은 한 장도 없었다. 지원자에게는 이게
          가장 강한 증거다 — 여기 오면 이런 걸 만들게 된다는 것. */}
      <section className="border-t border-border bg-muted/30 px-4 py-24">
        <div className="container mx-auto max-w-5xl">
          <Reveal>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              STUDENT WORK
            </div>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl">
              학생들이 만든 것
            </h2>
            <p className="mb-12 max-w-2xl leading-relaxed text-muted-foreground">
              기수마다 팀을 짜서 처음부터 끝까지 만듭니다. 아래는 실제 결과물입니다.
            </p>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2">
            {WORKS.map((w) => (
              <StaggerItem key={w.title}>
                <SurfaceCard flush className="h-full">
                  {/* 사진이 카드의 내용이므로 패딩 없이 위쪽을 꽉 채운다.
                      비율을 고정해 넉 장이 서로 어긋나지 않게 한다. */}
                  <img
                    src={w.src}
                    alt={w.alt}
                    loading="lazy"
                    className="aspect-[16/9] w-full border-b border-border bg-muted object-cover object-top"
                  />
                  <div className="p-5">
                    <h3 className="text-base font-bold">{w.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {w.note}
                    </p>
                  </div>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Year timeline ────────────────────────────────────────────────────
          이 판만 가로로 흐른다. 2023에서 2026으로 가는 것이 실제로 "앞으로
          나아가는" 일이라, 가로 이동이 내용의 의미와 맞는 유일한 자리다.

          스크롤을 가로채지 않는다. 처음엔 화면을 고정하고 세로 스크롤을 가로
          이동으로 바꾸는 방식으로 만들었는데, 실측하니 이동 거리가 624px 뿐이라
          화면 하나도 안 되는 거리를 위해 스크롤을 빼앗는 꼴이었다. 게다가
          고정한 화면의 70%가 빈 채로 남았다. 지금은 판이 지나가는 동안에만
          흐르고, 스크롤은 평소대로 동작한다. */}
      <section className="border-t border-border bg-muted/30 py-24">
        <Reveal className="container mx-auto max-w-4xl px-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            {c.activities.eyebrow}
          </div>
          <h2 className="mb-10 font-serif text-3xl font-bold md:text-4xl">
            {c.activities.title}
          </h2>
        </Reveal>

        <HorizontalDrift className="gap-6 pl-[max(1rem,calc((100vw-56rem)/2))] pr-8">
          {c.activities.items.map((a, i) => (
            <SurfaceCard key={i} className="w-[17rem] shrink-0 snap-start md:w-[19rem]">
              {/* 연도를 크게 각인한다. 가로로 흐르는 동안 지금 어느 해를 보고
                  있는지가 한눈에 잡혀야 한다. */}
              <div className="font-serif text-5xl font-bold tabular-nums leading-none text-primary">
                {a.date}
              </div>
              <h3 className="mt-5 text-lg font-bold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.summary}</p>
            </SurfaceCard>
          ))}
        </HorizontalDrift>
      </section>

      {/* ── Recruit banner ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden brand-band px-4 py-24">
        {/* 사이트에서 가장 납작한 면이었다 — 초록 한 색으로 꽉 찬 판. 같은 초록의
            명도만 흔들어 물속에 빛이 든 것처럼 만든다. */}
        <LiquidBackdrop tone="brand" />
        <div className="container relative mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]">
              {c.recruitBanner.eyebrow}
            </div>
            <h2 className="mb-6 font-serif text-3xl font-bold md:text-4xl">
              {c.recruitBanner.title}
            </h2>
            <p className="mb-10 whitespace-pre-line text-lg leading-relaxed">
              {c.recruitBanner.body}
            </p>
            <Magnetic>
              <Link href={c.recruitBanner.ctaHref}>
                <Button size="lg" variant="secondary" className="group h-12 px-8 text-base">
                  {c.recruitBanner.ctaLabel}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
