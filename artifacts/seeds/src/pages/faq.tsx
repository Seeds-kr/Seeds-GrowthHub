import { PublicLayout } from "@/components/layout/PublicLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Faq() {
  const faqs = [
    {
      q: "지원 자격은 어떻게 되나요?",
      a: "대한민국에 거주 중인 고등학생 및 대학생 누구나 지원 가능합니다. 특정 전공이나 성적 제한은 없으나, 프로그램에 대한 열정과 성실한 참여 의지가 중요합니다."
    },
    {
      q: "면접은 어떻게 진행되나요?",
      a: "서류 합격자에 한해 온라인 화상 면접으로 진행됩니다. 면접 시간은 약 30분 내외이며, 지원서에 작성하신 내용을 바탕으로 심층적인 질문이 주어집니다."
    },
    {
      q: "프로그램 참가 비용이 있나요?",
      a: "아니오, Seeds 프로그램은 전액 무료로 운영됩니다. 최종 선발된 학생들에게는 교육, 멘토링 등 모든 혜택이 무상으로 제공됩니다."
    },
    {
      q: "해외 거주자도 지원 가능한가요?",
      a: "모든 프로그램 일정이 한국 시간에 맞춰 진행되며 주요 오프라인 행사가 있을 수 있어, 원칙적으로 국내 거주자를 우선적으로 선발하고 있습니다."
    }
  ];

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <h1 className="text-4xl font-serif font-bold mb-12 text-center">자주 묻는 질문</h1>
        
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-lg font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </PublicLayout>
  );
}
