import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, HOME_DEFAULT } from "@/lib/site-content";
import { ArrowRight } from "lucide-react";
import seedsHero from "@assets/image_1779550028961.png";

export default function Home() {
  const { value: c } = useSiteContent("page.home", HOME_DEFAULT);
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-20 md:py-28 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container mx-auto max-w-5xl grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-5 font-semibold">
              {c.hero.eyebrow}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground mb-6 leading-tight whitespace-pre-line">
              {c.hero.title}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed whitespace-pre-line">
              {c.hero.body}
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link href={c.hero.primaryCtaHref}>
                <Button size="lg" className="text-base px-7 h-12">
                  {c.hero.primaryCtaLabel}
                </Button>
              </Link>
              <Link href={c.hero.secondaryCtaHref}>
                <Button size="lg" variant="outline" className="text-base px-7 h-12">
                  {c.hero.secondaryCtaLabel}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <img
              src={seedsHero}
              alt="Seeds — 씨앗에서 나무로"
              className="w-full max-w-md object-contain"
            />
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
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
            <Button variant="outline">
              {c.about.ctaLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Activities (4 cards) */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold">
            {c.projects.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{c.projects.title}</h2>
          <p className="text-muted-foreground leading-relaxed mb-12 max-w-2xl whitespace-pre-line">
            {c.projects.body}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.projects.items.map((p, i) => (
              <div key={i} className="border border-border bg-card p-6 flex flex-col rounded-lg">
                <div className="inline-flex items-center self-start text-[10px] font-semibold text-primary uppercase tracking-wider mb-4 px-2 py-1 bg-primary/10 rounded">
                  {p.status}
                </div>
                <h3 className="text-lg font-bold mb-3">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{p.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Year timeline */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3 font-semibold">
            {c.activities.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">{c.activities.title}</h2>
          <div className="border border-border bg-card divide-y divide-border rounded-lg overflow-hidden">
            {c.activities.items.map((a, i) => (
              <div key={i} className="p-6 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8">
                <div className="text-sm font-semibold text-primary md:w-20 shrink-0">{a.date}</div>
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground mb-3 font-semibold">
            {c.recruitBanner.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            {c.recruitBanner.title}
          </h2>
          <p className="text-primary-foreground text-lg mb-10 leading-relaxed whitespace-pre-line">
            {c.recruitBanner.body}
          </p>
          <Link href={c.recruitBanner.ctaHref}>
            <Button size="lg" variant="secondary" className="text-base px-8 h-12">
              {c.recruitBanner.ctaLabel}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
