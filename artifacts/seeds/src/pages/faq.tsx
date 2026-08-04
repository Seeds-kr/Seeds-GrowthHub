import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSiteContent, FAQ_DEFAULT } from "@/lib/site-content";
import { Cover, Plate, annualRule } from "@/components/annual";

/**
 * FAQ — 기수 연감(DESIGN.md)의 판면.
 *
 * 아코디언은 유지한다. 답이 길어 전부 펼치면 훑기가 어렵고, 접힘/펼침은 이미
 * 익숙한 어포던스다. 연감 규칙은 겉면에만 적용한다 — 괘선으로 구획하고
 * 문항에 번호를 붙인다(순서가 곧 색인이라 번호가 기능한다).
 */
export default function Faq() {
  const { value: c } = useSiteContent("page.faq", FAQ_DEFAULT);
  return (
    <PublicLayout>
      <Cover title={c.title} />

      <Plate>
        <Accordion type="single" collapsible className="w-full">
          {c.items.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-b"
              style={annualRule}
            >
              <AccordionTrigger className="py-5 text-left">
                <span className="flex items-baseline gap-4">
                  <span className="plate-no shrink-0 text-[11px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base font-bold tracking-[-0.02em] md:text-lg">
                    {faq.q}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-line pb-6 pl-[2.6rem] text-base leading-[1.75] text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Plate>
    </PublicLayout>
  );
}
