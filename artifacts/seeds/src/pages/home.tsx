import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";

export default function Home() {
  const { value: c } = useSiteContent("page.home", HOME_DEFAULT);
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-muted/50 to-background">
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
          <Button size="lg" className="text-lg px-8 h-14 rounded-none">
            {c.hero.ctaLabel}
          </Button>
        </Link>
      </section>

      {/* What is Seeds? */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.intro.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            {c.intro.title}
          </h2>
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
      </section>

      {/* Who should apply? */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.applicants.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            {c.applicants.title}
          </h2>
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
      </section>

      {/* Program flow */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.flow.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            {c.flow.title}
          </h2>
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
      </section>

      {/* Recruitment schedule */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.schedule.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            {c.schedule.title}
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {c.schedule.steps.map((step, i) => (
              <div key={i} className="flex flex-col p-6 border border-border bg-card">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Step {i + 1}
                </div>
                <div className="text-sm font-semibold text-primary mb-2">{step.date}</div>
                <div className="text-xl font-bold mb-3">{step.phase}</div>
                <div className="text-sm text-muted-foreground">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            {c.faqTeaser.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            {c.faqTeaser.title}
          </h2>
          <div className="space-y-4 mb-10">
            {c.faqTeaser.items.map((item, i) => (
              <div key={i} className="border border-border bg-card p-6">
                <h3 className="font-bold mb-2">Q. {item.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <Link href="/faq">
            <Button variant="outline" className="rounded-none">
              {c.faqTeaser.ctaLabel}
            </Button>
          </Link>
        </div>
      </section>

      {/* Apply CTA */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            {c.cta.title}
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-10 leading-relaxed whitespace-pre-line">
            {c.cta.body}
          </p>
          <Link href="/apply">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 h-14 rounded-none"
            >
              {c.cta.ctaLabel}
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
