import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import {
  api,
  PEOPLE_KIND_LABEL,
  PEOPLE_KIND_PATH,
  PEOPLE_KINDS,
  type PeopleKind,
  type PublicPeopleProfile,
} from "@/lib/mvp3-api";

function Card({ p }: { p: PublicPeopleProfile }) {
  return (
    <div className="bg-card border border-border p-6 flex flex-col">
      <div className="aspect-square w-full mb-4 bg-muted overflow-hidden">
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoUrl}
            alt={p.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-serif text-muted-foreground">
            {p.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="font-serif text-xl font-bold mb-1">{p.name}</div>
        {p.roleTitle ? (
          <div className="text-sm text-primary font-medium mb-1">
            {p.roleTitle}
          </div>
        ) : null}
        {p.affiliation ? (
          <div className="text-sm text-muted-foreground mb-3">
            {p.affiliation}
          </div>
        ) : null}
        {p.bio ? (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {p.bio}
          </p>
        ) : null}
        {p.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {p.tags.map((t, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-muted text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PeopleGrid({
  kind,
  title,
  subtitle,
  emptyText,
}: {
  kind: PeopleKind;
  title: string;
  subtitle?: string;
  emptyText: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-people", kind],
    queryFn: () =>
      api<{ items: PublicPeopleProfile[] }>(`/people/${kind}`),
  });

  return (
    <section className="py-20 md:py-28 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            Seeds People
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>

        <nav className="flex justify-center gap-2 mb-12 border-b border-border">
          {PEOPLE_KINDS.map((k) => (
            <Link
              key={k}
              href={PEOPLE_KIND_PATH[k]}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                k === kind
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {PEOPLE_KIND_LABEL[k]}
            </Link>
          ))}
        </nav>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
            {data.items.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
