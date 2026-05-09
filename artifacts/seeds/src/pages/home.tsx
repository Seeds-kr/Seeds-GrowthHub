import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const { value: c } = useSiteContent("page.home", HOME_DEFAULT);
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-24 md:py-32 px-4 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-6 font-semibold">
            {c.hero.eyebrow}
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-foreground mb-6 leading-tight">
            {c.hero.title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed whitespace-pre-line">
            {c.hero.body}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={c.hero.primaryCtaHref}>
              <Button size="lg" className="text-lg px-8 h-14 rounded-none">
                {c.hero.primaryCtaLabel}
              </Button>
            </Link>
            <Link href={c.hero.secondaryCtaHref}>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 rounded-none">
                {c.hero.secondaryCtaLabel}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold text-center">
            {c.stats.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12 text-center">
            {c.stats.title}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
            {c.stats.items.map((s, i) => (
              <div key={i} className="bg-card p-8 text-center">
                <div className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold">
            {c.about.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{c.about.title}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-3xl whitespace-pre-line">
            {c.about.body}
          </p>
          <Link href={c.about.ctaHref}>
            <Button variant="outline" className="rounded-none">
              {c.about.ctaLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured projects */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold">
            {c.projects.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{c.projects.title}</h2>
          <p className="text-muted-foreground leading-relaxed mb-12 max-w-2xl whitespace-pre-line">
            {c.projects.body}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {c.projects.items.map((p, i) => (
              <div key={i} className="border border-border bg-card p-8 flex flex-col">
                <div className="inline-flex items-center text-xs font-semibold text-primary uppercase tracking-wider mb-4">
                  {p.status}
                </div>
                <h3 className="text-xl font-bold mb-3">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{p.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent activities */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold">
            {c.activities.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">{c.activities.title}</h2>
          <div className="border border-border bg-card divide-y divide-border">
            {c.activities.items.map((a, i) => (
              <div key={i} className="p-6 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8">
                <div className="text-sm font-semibold text-primary md:w-28 shrink-0">{a.date}</div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">{a.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{a.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruit banner */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/80 mb-3 font-semibold">
            {c.recruitBanner.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            {c.recruitBanner.title}
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-10 leading-relaxed whitespace-pre-line">
            {c.recruitBanner.body}
          </p>
          <Link href={c.recruitBanner.ctaHref}>
            <Button size="lg" variant="secondary" className="text-lg px-8 h-14 rounded-none">
              {c.recruitBanner.ctaLabel}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
