import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, PROGRAM_DEFAULT } from "@/lib/site-content";
import { Reveal } from "@/lib/motion";

export default function Program() {
  const { value: c } = useSiteContent("page.program", PROGRAM_DEFAULT);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <Reveal>
          <h1 className="mb-12 text-center font-serif text-4xl font-bold">{c.title}</h1>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <Reveal className="rounded-lg bg-card border border-border p-8">
            <h2 className="text-2xl font-serif font-bold mb-4">{c.curriculum.heading}</h2>
            <ul className="space-y-4 text-muted-foreground">
              {c.curriculum.items.map((it, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground">{it.title}</span>
                  <span>{it.desc}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.12} className="rounded-lg bg-card border border-border p-8 bg-primary text-primary-foreground">
            <h2 className="text-2xl font-serif font-bold mb-4">{c.benefits.heading}</h2>
            <ul className="space-y-4 opacity-90">
              {c.benefits.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </PublicLayout>
  );
}
