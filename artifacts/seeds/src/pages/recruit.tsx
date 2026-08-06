import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, RECRUIT_DEFAULT } from "@/lib/site-content";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";
import { YearTrack } from "@/components/YearTrack";

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
      <Reveal as="section" className="py-24 md:py-32 flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-muted/50 to-background">
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
          <div className="grid md:grid-cols-3 gap-6">
            {c.intro.features.map((f, i) => (
              <div key={i} className="border border-border bg-card p-8">
                <div className="text-sm text-primary font-semibold mb-3">0{i + 1}</div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">{c.flow.title}</h2>
          <div className="grid md:grid-cols-4 gap-px bg-border border border-border">
            {c.flow.steps.map((step, i) => (
              <div key={i} className="bg-card p-8">
                <div className="text-sm text-primary font-semibold mb-2">{step.month}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
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
          <div className="space-y-4 mb-10">
            {c.faqTeaser.items.map((item, i) => (
              <div key={i} className="border border-border bg-card p-6">
                <h3 className="font-bold mb-2">Q. {item.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <Link href="/faq">
            <Button variant="outline" className="">
              {c.faqTeaser.ctaLabel}
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* Apply CTA */}
      <Reveal as="section" className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{c.cta.title}</h2>
          <p className="text-primary-foreground text-lg mb-10 leading-relaxed whitespace-pre-line">
            {c.cta.body}
          </p>
          <Link href="/apply">
            <Button size="lg" variant="secondary" className="text-lg px-8 h-14">
              {c.cta.ctaLabel}
            </Button>
          </Link>
        </div>
      </Reveal>
    </PublicLayout>
  );
}
