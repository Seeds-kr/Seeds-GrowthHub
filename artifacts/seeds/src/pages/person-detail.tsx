import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  api,
  PEOPLE_KIND_LABEL,
  PEOPLE_KINDS,
  type PeopleKind,
  type PublicPeopleProfile,
} from "@/lib/mvp3-api";

const KIND_BACK_PATH: Record<PeopleKind, string> = {
  mentor: "/mentors",
  staff: "/staff",
  member: "/members",
};

export default function PersonDetailPage() {
  const params = useParams<{ kind: string; id: string }>();
  const [, setLocation] = useLocation();
  const kind = (PEOPLE_KINDS as readonly string[]).includes(params.kind)
    ? (params.kind as PeopleKind)
    : null;
  const id = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-person", kind, id],
    queryFn: () => api<PublicPeopleProfile>(`/people/${kind}/${id}`),
    enabled: !!kind && Number.isFinite(id) && id > 0,
    retry: false,
  });

  if (!kind || !Number.isFinite(id)) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-3xl py-24 px-4 text-center text-muted-foreground">
          잘못된 경로입니다.
        </div>
      </PublicLayout>
    );
  }

  const backPath = KIND_BACK_PATH[kind];
  const tel = data?.phone ? data.phone.replace(/[^0-9+]/g, "") : "";

  return (
    <PublicLayout>
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <button
            onClick={() => setLocation(backPath)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {PEOPLE_KIND_LABEL[kind]} 목록으로
          </button>

          {isLoading ? (
            <div className="py-24 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error || !data ? (
            <div className="py-24 text-center text-muted-foreground">
              프로필을 찾을 수 없습니다.
              <div className="mt-4">
                <Link href={backPath} className="text-primary hover:underline">
                  목록으로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <article className="bg-card border border-border p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                <div className="md:w-56 shrink-0">
                  <div className="aspect-square w-full bg-muted overflow-hidden">
                    {data.photoUrl ? (
                      <img
                        src={data.photoUrl}
                        alt={data.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl font-serif text-muted-foreground">
                        {data.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-primary mb-2 font-semibold">
                    {PEOPLE_KIND_LABEL[data.kind]}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
                    {data.name}
                  </h1>
                  {data.roleTitle ? (
                    <div className="text-base text-primary font-medium mb-1">
                      {data.roleTitle}
                    </div>
                  ) : null}
                  {data.affiliation ? (
                    <div className="text-sm text-muted-foreground mb-5">
                      {data.affiliation}
                    </div>
                  ) : null}
                  {data.bio ? (
                    <p className="text-[15px] text-foreground/85 leading-relaxed whitespace-pre-line mt-2">
                      {data.bio}
                    </p>
                  ) : null}
                  {data.phone ? (
                    <a
                      href={`tel:${tel}`}
                      className="text-sm text-primary hover:underline mt-6 inline-flex items-center gap-1.5"
                    >
                      📞 {data.phone}
                    </a>
                  ) : null}
                  {data.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-6">
                      {data.tags.map((t, i) => (
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
            </article>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
