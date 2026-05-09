import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  api,
  PEOPLE_KIND_LABEL,
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

const KIND_SUBTITLE: Record<PeopleKind, string> = {
  mentor: "Seeds 학생들의 성장을 함께하는 분야별 멘토를 소개합니다.",
  staff: "Seeds 프로그램을 기획·운영하는 운영진입니다.",
  member: "Seeds에서 함께 배우고 만드는 학생들입니다. 본인이 공개에 동의한 경우에만 표시됩니다.",
};
const KIND_EMPTY: Record<PeopleKind, string> = {
  mentor: "아직 공개된 멘토가 없습니다.",
  staff: "아직 공개된 운영진이 없습니다.",
  member: "아직 공개에 동의한 학생이 없습니다.",
};

export function PeopleGrid({
  kind,
  onKindChange,
}: {
  kind: PeopleKind;
  onKindChange: (k: PeopleKind) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-people", kind],
    queryFn: () =>
      api<{ items: PublicPeopleProfile[] }>(`/people/${kind}`),
  });

  return (
    <section className="py-24 md:py-32 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary mb-3 font-semibold">
            Seeds People
          </div>
          <h1 className="text-5xl md:text-6xl mb-5">사람들</h1>
          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
            Seeds를 함께 만드는 멘토·운영진·학생을 소개합니다.
          </p>
        </div>

        <div role="tablist" className="flex justify-center gap-2 mb-6 border-b border-border">
          {PEOPLE_KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === kind}
              onClick={() => onKindChange(k)}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                k === kind
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {PEOPLE_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mb-10">
          {KIND_SUBTITLE[kind]}
        </p>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            {KIND_EMPTY[kind]}
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
