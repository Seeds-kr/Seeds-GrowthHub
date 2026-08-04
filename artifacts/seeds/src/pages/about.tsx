import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, ABOUT_DEFAULT } from "@/lib/site-content";
import { Cover, Plate, Entry, annualRule, annualSeal } from "@/components/annual";
import teamPhoto from "@assets/KakaoTalk_20230801_023526919_01_1779550028961.jpg";
import mentorPhoto from "@assets/KakaoTalk_20230801_023526919_06_1779550028960.jpg";

/**
 * 소개 — 기수 연감(DESIGN.md)의 판면.
 *
 * 사진은 남긴다. 연감에서 도판은 장식이 아니라 기록이고 이 두 장은 실제 활동
 * 사진이다. 다만 캡션이 도판 아래 작은 활자로 붙는 연감 규칙을 따른다.
 *
 * 로고 이미지는 뺐다 — 그 안의 워드마크가 Pretendard와 다른 서체라 판면에서
 * 따로 놀았고, 표제가 이미 이름을 말한다.
 */
export default function About() {
  const { value: c } = useSiteContent("page.about", ABOUT_DEFAULT);

  // 제목 내용으로 도판을 매칭한다(배열 순서가 아니라). 운영진이 절을 재배열하거나
  // 새로 끼워 넣어도 사진이 엉뚱한 곳에 붙지 않는다.
  function imageFor(heading: string): { src: string; alt: string } | null {
    if (heading.includes("프로젝트"))
      return { src: teamPhoto, alt: "Seeds 팀 멘토링 모습" };
    if (heading.includes("구성"))
      return { src: mentorPhoto, alt: "Seeds 멘토진 소개 세션" };
    return null;
  }

  return (
    <PublicLayout>
      <Cover title={c.title} intro={c.intro} />

      {c.sections.map((s, i) => {
        const img = imageFor(s.heading);
        return (
          <Plate key={i} no={String(i + 1).padStart(2, "0")} title={s.heading}>
            <p className="mt-3 max-w-[68ch] whitespace-pre-line text-base leading-[1.75] text-muted-foreground">
              {s.body}
            </p>
            {img ? (
              <figure className="mt-8">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full border object-cover"
                  style={{ ...annualRule, maxHeight: "22rem" }}
                />
                <figcaption className="plate-no mt-2 text-[11px]">
                  {img.alt}
                </figcaption>
              </figure>
            ) : null}
          </Plate>
        );
      })}

      {c.values.length > 0 ? (
        <Plate
          no={String(c.sections.length + 1).padStart(2, "0")}
          title="핵심 가치"
        >
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {c.values.map((v, i) => (
              <Entry key={i} title={v.label} body={v.desc} />
            ))}
          </div>
        </Plate>
      ) : null}

      <Plate title="문의">
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            이메일{" "}
            <a
              href="mailto:seeds.code@gmail.com"
              className="font-medium underline-offset-4 hover:underline"
              style={annualSeal}
            >
              seeds.code@gmail.com
            </a>
          </li>
          <li>
            카카오톡 오픈채팅{" "}
            <a
              href="https://open.kakao.com/o/sqpmEzEf"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline-offset-4 hover:underline"
              style={annualSeal}
            >
              바로가기
            </a>
          </li>
        </ul>
      </Plate>
    </PublicLayout>
  );
}
