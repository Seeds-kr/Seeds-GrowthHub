import { PublicLayout } from "@/components/layout/PublicLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent, FAQ_DEFAULT } from "@/lib/site-content";
import { Reveal } from "@/lib/motion";

export default function Faq() {
  const { value: c } = useSiteContent("page.faq", FAQ_DEFAULT);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <Reveal>
          <h1 className="mb-12 text-center font-serif text-4xl font-bold">{c.title}</h1>
        </Reveal>
        {/* 문항을 하나씩 띄우지 않는다. 아코디언은 펼침/접힘 자체가 모션이라
            등장 모션까지 겹치면 두 움직임이 서로를 방해한다. */}
        <Reveal>
        <Accordion type="single" collapsible className="w-full">
          {c.items.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-lg font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed whitespace-pre-line">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        </Reveal>
      </div>
    </PublicLayout>
  );
}
