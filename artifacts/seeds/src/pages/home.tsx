import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";
import { ArrowRight } from "lucide-react";
import seedsHero from "@assets/image_1779550028961.png";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";
import { HorizontalDrift } from "@/components/HorizontalDrift";
import { CountUp, Magnetic, Reveal, Spotlight, Stagger, StaggerItem } from "@/lib/motion";

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
          {/* 이 래퍼에는 등장 애니메이션을 걸지 않는다. `.rise` 가 opacity 를
              건드리는 순간 쌓임 맥락이 생기고, 그러면 아래 이미지의 blend 가
              그 안에 갇혀 배경까지 닿지 못한다(transform 도 마찬가지다).
              흰 사각형이 보이는 것보다 페이드 하나를 포기하는 편이 낫다. */}
          <div className="flex justify-center md:justify-end">
            {/* 이 PNG 는 배경이 불투명한 흰색이라 색이 깔린 위에 놓으면 오려
                붙인 것처럼 뜬다. multiply 로 곱하면 흰 부분이 배경을 그대로
                통과시켜 그림만 남는다. 원본 에셋은 건드리지 않는다. */}
            <img
              src={seedsHero}
              alt="씨앗에서 나무로 자라는 Seeds 상징"
              className="w-full max-w-md object-contain mix-blend-multiply"
            />
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
                <Spotlight className="spotlight-card h-full rounded-lg border border-border bg-card p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  <div className="mb-4 inline-flex items-center self-start rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {p.status}
                  </div>
                  <h3 className="mb-3 text-lg font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                </Spotlight>
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
            <article
              key={i}
              className="spotlight-card flex w-[17rem] shrink-0 snap-start flex-col rounded-lg border border-border bg-card p-7 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-lg md:w-[19rem]"
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse") return;
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
                el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
              }}
            >
              {/* 연도를 크게 각인한다. 가로로 흐르는 동안 지금 어느 해를 보고
                  있는지가 한눈에 잡혀야 한다. */}
              <div className="font-serif text-5xl font-bold tabular-nums leading-none text-primary">
                {a.date}
              </div>
              <h3 className="mt-5 text-lg font-bold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.summary}</p>
            </article>
          ))}
        </HorizontalDrift>
      </section>

      {/* ── Recruit banner ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary px-4 py-24 text-primary-foreground">
        <div className="container relative mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground">
              {c.recruitBanner.eyebrow}
            </div>
            <h2 className="mb-6 font-serif text-3xl font-bold md:text-4xl">
              {c.recruitBanner.title}
            </h2>
            <p className="mb-10 whitespace-pre-line text-lg leading-relaxed text-primary-foreground">
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
