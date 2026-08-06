import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, ABOUT_DEFAULT } from "@/lib/site-content";
import { Reveal } from "@/lib/motion";
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
            <div className="grid sm:grid-cols-3 gap-4">
              {c.values.map((v, i) => (
                <div key={i} className="border border-border bg-card p-5 rounded-lg">
                  <div className="font-bold text-foreground mb-2">{v.label}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{v.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground">
          <div className="font-semibold text-foreground mb-2">문의</div>
          <ul className="space-y-1">
            <li>이메일: <a href="mailto:seeds.code@gmail.com" className="text-primary hover:underline">seeds.code@gmail.com</a></li>
            <li>카카오톡 오픈채팅: <a href="https://open.kakao.com/o/sqpmEzEf" target="_blank" rel="noreferrer" className="text-primary hover:underline">바로가기</a></li>
          </ul>
        </div>
      </Reveal>
    </PublicLayout>
  );
}
