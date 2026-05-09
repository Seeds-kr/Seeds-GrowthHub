import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, ABOUT_DEFAULT } from "@/lib/site-content";

export default function About() {
  const { value: c } = useSiteContent("page.about", ABOUT_DEFAULT);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <h1 className="text-4xl font-serif font-bold mb-8">{c.title}</h1>
        <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none">
          <p className="whitespace-pre-line">{c.intro}</p>
          {c.sections.map((s, i) => (
            <div key={i}>
              <h2>{s.heading}</h2>
              <p className="whitespace-pre-line">{s.body}</p>
            </div>
          ))}
          {c.values.length > 0 && (
            <>
              <h2>핵심 가치</h2>
              <ul>
                {c.values.map((v, i) => (
                  <li key={i}><strong>{v.label}:</strong> {v.desc}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
