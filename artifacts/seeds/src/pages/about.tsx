import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, ABOUT_DEFAULT } from "@/lib/site-content";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";
import { Mail, MessageCircle } from "lucide-react";
import { OPS_EMAIL, OPS_KAKAO, opsMailto } from "@/lib/contact";
import { PHOTOS } from "@/assets/photos";

export default function About() {
  const { value: c } = useSiteContent("page.about", ABOUT_DEFAULT);

  // Map images to sections by *heading content* (substring), not array index,
  // so admins reordering or inserting sections don't end up with mis-placed
  // photos. If no section matches, the image simply isn't shown.
  function imageFor(heading: string): { src: string; alt: string } | null {
    if (heading.includes("프로젝트")) return PHOTOS.projectShowcase;
    if (heading.includes("구성") || heading.includes("멘토")) return PHOTOS.mentoringTeam;
    if (heading.includes("강의") || heading.includes("세미나")) return PHOTOS.seminarRoom;
    if (heading.includes("커뮤니티") || heading.includes("네트워")) return PHOTOS.awards;
    return null;
  }

  return (
    <PublicLayout>
      <Reveal as="section" className="container mx-auto px-4 py-20 max-w-3xl">
        <div className="mb-12 flex flex-col items-center text-center">
          <h1 className="mb-6 font-serif text-4xl font-bold">{c.title}</h1>
          <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
            {c.intro}
          </p>
          {/* 로고 클립아트를 실제 기수 사진으로 바꿨다. 로고는 헤더에 이미 있고,
              이 자리에서 필요한 건 "여기 어떤 사람들이 있나" 에 대한 답이다. */}
          <figure className="elev-2 mt-10 w-full overflow-hidden rounded-lg">
            <img
              src={PHOTOS.cohortGroup.src}
              alt={PHOTOS.cohortGroup.alt}
              loading="eager"
              className="aspect-[16/10] w-full object-cover"
            />
          </figure>
        </div>

        <div className="space-y-12">
          {c.sections.map((s, i) => {
            const img = imageFor(s.heading);
            return (
              <div key={i}>
                <h2 className="text-2xl font-serif font-bold mb-4">{s.heading}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p>
                {img && (
                  <figure className="mt-6">
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      className="max-h-80 w-full rounded-lg border border-border object-cover"
                    />
                    {/* 사진만 있으면 무엇을 보고 있는지 알 수 없다. 대체 텍스트를
                        캡션으로도 쓴다 — 두 곳에서 서로 다른 말을 하지 않는다. */}
                    <figcaption className="mt-2 text-xs text-muted-foreground">
                      {img.alt}
                    </figcaption>
                  </figure>
                )}
              </div>
            );
          })}
        </div>

        {c.values.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-serif font-bold mb-6">핵심 가치</h2>
            <Stagger className="grid gap-4 sm:grid-cols-3">
              {c.values.map((v, i) => (
                <StaggerItem key={i}>
                  <SurfaceCard dense className="h-full">
                    <div className="mb-2 font-bold text-foreground">{v.label}</div>
                    <div className="text-sm leading-relaxed text-muted-foreground">{v.desc}</div>
                  </SurfaceCard>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

        {/* 문의. 글줄 안에 링크를 박아두면 페이지 끝에서 눈에 안 띈다 — FAQ 아래쪽과
            같은 판으로 맞춘다(같은 일을 하는 두 곳이 다르게 생기지 않게). */}
        <div className="mt-16 border-t border-border pt-10">
          <h2 className="mb-4 font-serif text-2xl font-bold">문의</h2>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: OPS_KAKAO,
                icon: MessageCircle,
                title: "카카오톡 오픈채팅",
                sub: "새 창에서 열립니다",
                external: true,
              },
              {
                href: opsMailto("Seeds 문의"),
                icon: Mail,
                title: "이메일",
                sub: OPS_EMAIL,
                external: false,
              },
            ].map((ch) => (
              <StaggerItem key={ch.href}>
                <a
                  href={ch.href}
                  {...(ch.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                    aria-hidden="true"
                  >
                    <ch.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{ch.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{ch.sub}</span>
                  </span>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </PublicLayout>
  );
}
