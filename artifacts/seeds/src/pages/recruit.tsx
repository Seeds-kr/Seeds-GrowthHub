import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, RECRUIT_DEFAULT } from "@/lib/site-content";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";
import { YearTrack } from "@/components/YearTrack";
import { Timeline } from "@/components/Timeline";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";

/**
 * 제목 앞에 붙은 장식용 이모지를 뗀다(🗓 정기모집 → 정기모집).
 *
 * 운영진이 관리자 화면에서 쓰는 문구라 내용은 건드리지 않고 앞머리 기호만
 * 없앤다. 이모지를 아이콘처럼 쓰면 글꼴·플랫폼마다 크기와 정렬이 달라져
 * 제목 줄이 흔들린다. 운영진이 원하면 site-content 에서 그대로 지우면 된다.
 */
function cleanPhase(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u, "").trim() || text;
}

export default function Recruit() {
  const { value: c } = useSiteContent("page.recruit", RECRUIT_DEFAULT);
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-24 text-center md:py-32">
        {/* /program·/faq 와 같은 배경. 세로 그라디언트 한 겹만 있던 자리다. */}
        <LiquidBackdrop />
        <Reveal className="relative flex flex-col items-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-6 font-medium">
          {c.hero.eyebrow}
        </div>
        <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-foreground max-w-3xl mb-6 leading-tight">
          {c.hero.headlineLine1}<br />{c.hero.headlineLine2}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed whitespace-pre-line">
          {c.hero.body}
        </p>
        <Link href="/apply">
          <Button size="lg" className="text-lg px-8 h-14">
            {c.hero.ctaLabel}
          </Button>
        </Link>
        </Reveal>
      </section>

      {/* What is Seeds? */}
      <Reveal as="section" className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.intro.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{c.intro.title}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-3xl whitespace-pre-line">
            {c.intro.body}
          </p>
          <Stagger className="grid gap-5 md:grid-cols-3">
            {c.intro.features.map((f, i) => (
              <StaggerItem key={i}>
                <SurfaceCard className="h-full">
                  {/* 번호는 세는 표시일 뿐 읽을 내용이 아니다. 크게 흐리게 두면
                      순서는 전해지면서 제목을 가리지 않는다. */}
                  <div
                    className="font-serif text-3xl font-bold leading-none text-primary/25 transition-colors duration-200 group-hover:text-primary/45"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2.5 leading-relaxed text-muted-foreground">{f.desc}</p>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

      {/* Who should apply? */}
      <Reveal as="section" className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.applicants.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">{c.applicants.title}</h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
            {c.applicants.items.map((item, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-border/60">
                <span className="font-serif text-primary font-bold text-lg leading-none mt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Program flow */}
      <Reveal as="section" className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.flow.eyebrow}
          </div>
          <h2 className="mb-10 font-serif text-3xl font-bold md:text-4xl">{c.flow.title}</h2>
          {/* 넉 장을 나란히 놓으면 시간의 흐름이 형태로 드러나지 않는다.
              축을 하나 긋고 마디를 얹으면 순서가 보이고, 지금이 어느 단계인지도
              같이 말할 수 있다. */}
          <Timeline
            items={c.flow.steps.map((s) => ({ label: s.month, title: s.title, desc: s.desc }))}
          />
        </div>
      </Reveal>

      {/* Recruitment schedule */}
      <Reveal as="section" className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.schedule.eyebrow}
          </div>
          <h2 className="mb-10 font-serif text-3xl font-bold md:text-4xl">
            {c.schedule.title}
          </h2>

          {/* 한 해 어디쯤인지를 먼저 보여준다. 방문자가 이 판에서 묻는 건
              "지금 지원할 수 있나" 하나인데, 전에는 그 답이 본문 괄호 안에
              묻혀 있었다. */}
          <YearTrack
            items={c.schedule.steps.map((s) => ({ label: cleanPhase(s.phase), date: s.date }))}
          />

          {/* `Step 1/2/3` 을 없앴다. 이건 단계가 아니다 — 정기모집과 수시모집은
              나란한 두 경로이고 문의는 연락처다. 번호를 매기면 "1을 거쳐야 2로
              간다" 는 잘못된 인상을 준다. 대신 날짜가 표제 자리를 갖는다. */}
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.schedule.steps.map((step, i) => (
              <StaggerItem key={i}>
                <SurfaceCard className="h-full">
                  <div className="text-sm font-semibold text-primary">{step.date}</div>
                  <h3 className="mt-1.5 text-xl font-bold tracking-tight">
                    {cleanPhase(step.phase)}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

      {/* FAQ teaser */}
      <Reveal as="section" className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.faqTeaser.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">{c.faqTeaser.title}</h2>
          <Stagger className="mb-10 flex flex-col gap-3">
            {c.faqTeaser.items.map((item, i) => (
              <StaggerItem key={i}>
                <SurfaceCard>
                  <div className="flex gap-3">
                    <span
                      className="font-serif text-lg font-bold leading-none text-primary/60"
                      aria-hidden="true"
                    >
                      Q
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold">{item.q}</h3>
                      <p className="mt-1.5 leading-relaxed text-muted-foreground">{item.a}</p>
                    </div>
                  </div>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
          <Link href="/faq">
            <Button variant="outline" className="">
              {c.faqTeaser.ctaLabel}
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* Apply CTA */}
      <section className="relative overflow-hidden bg-primary px-4 py-24 text-primary-foreground">
        <LiquidBackdrop tone="brand" />
        <Reveal className="container relative mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{c.cta.title}</h2>
          <p className="text-primary-foreground text-lg mb-10 leading-relaxed whitespace-pre-line">
            {c.cta.body}
          </p>
          <Link href="/apply">
            <Button size="lg" variant="secondary" className="text-lg px-8 h-14">
              {c.cta.ctaLabel}
            </Button>
          </Link>
        </Reveal>
      </section>
    </PublicLayout>
  );
}
