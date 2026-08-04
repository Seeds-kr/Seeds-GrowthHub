import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, PROGRAM_DEFAULT } from "@/lib/site-content";
import { Cover, Plate, SealPlate, annualRule } from "@/components/annual";

/**
 * 프로그램 — 기수 연감(DESIGN.md)의 판면.
 *
 * 이전에는 커리큘럼과 혜택을 나란한 두 카드에 넣고 한쪽만 초록으로 채웠다.
 * 연감에서 두 목록의 무게가 같다면 판을 나눠 순서로 말한다 — 색으로 한쪽만
 * 강조하면 다른 쪽이 부록처럼 읽힌다. 혜택은 마감 판(도장 면)으로 내려
 * 읽고 난 뒤 마지막에 오게 했다.
 */
export default function Program() {
  const { value: c } = useSiteContent("page.program", PROGRAM_DEFAULT);
  return (
    <PublicLayout>
      <Cover title={c.title} />

      <Plate no="01" title={c.curriculum.heading}>
        <dl>
          {c.curriculum.items.map((it, i) => (
            <div
              key={i}
              className="grid gap-x-8 gap-y-1 border-t py-5 md:grid-cols-[14rem_1fr]"
              style={annualRule}
            >
              <dt className="text-base font-bold tracking-[-0.02em]">
                {it.title}
              </dt>
              <dd className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                {it.desc}
              </dd>
            </div>
          ))}
        </dl>
      </Plate>

      <SealPlate no="02" title={c.benefits.heading}>
        <ul className="mt-9 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {c.benefits.items.map((it, i) => (
            <li
              key={i}
              className="border-t pt-4 text-base leading-relaxed"
              style={{
                borderColor: "hsl(0 0% 100% / 0.25)",
                color: "hsl(0 0% 100% / 0.92)",
              }}
            >
              {it}
            </li>
          ))}
        </ul>
      </SealPlate>
    </PublicLayout>
  );
}
