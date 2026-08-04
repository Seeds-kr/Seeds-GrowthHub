import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, ABOUT_DEFAULT } from "@/lib/site-content";
import seedsLogo from "@assets/image_1779550028961.png";
import teamPhoto from "@assets/KakaoTalk_20230801_023526919_01_1779550028961.jpg";
import mentorPhoto from "@assets/KakaoTalk_20230801_023526919_06_1779550028960.jpg";

export default function About() {
  const { value: c } = useSiteContent("page.about", ABOUT_DEFAULT);

  // Map images to sections by *heading content* (substring), not array index,
  // so admins reordering or inserting sections don't end up with mis-placed
  // photos. If no section matches, the image simply isn't shown.
  function imageFor(heading: string): { src: string; alt: string } | null {
    if (heading.includes("프로젝트")) return { src: teamPhoto, alt: "Seeds 팀 멘토링 모습" };
    if (heading.includes("구성")) return { src: mentorPhoto, alt: "Seeds 멘토진 소개 세션" };
    return null;
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-3xl">
        <div className="flex flex-col items-center text-center mb-12">
          <img src={seedsLogo} alt="Seeds" className="w-40 mb-6" />
          <h1 className="text-4xl font-serif font-bold mb-6">{c.title}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line max-w-2xl">
            {c.intro}
          </p>
        </div>

        <div className="space-y-12">
          {c.sections.map((s, i) => {
            const img = imageFor(s.heading);
            return (
              <div key={i}>
                <h2 className="text-2xl font-serif font-bold mb-4">{s.heading}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p>
                {img && (
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full rounded-lg border border-border mt-6 object-cover max-h-80"
                  />
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
      </section>
    </PublicLayout>
  );
}
