import { useMemo } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent, FAQ_DEFAULT } from "@/lib/site-content";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";
import { Mail, MessageCircle } from "lucide-react";

/**
 * 답변 본문에서 연락 수단을 뽑는다.
 *
 * 문의처는 이미 FAQ 마지막 문항 안에 적혀 있다. 아래 안내 판에 같은 주소를 한 번 더
 * 하드코딩하면 운영진이 한쪽만 고쳤을 때 둘이 갈라진다. 그래서 **적어둔 곳에서 읽어
 * 온다** — 원본은 언제나 site-content 하나다.
 *
 * 못 찾으면 판을 아예 그리지 않는다(틀린 주소를 보여주느니 안 보여준다).
 */
function findContacts(answers: string[]): { kakao?: string; email?: string } {
  const all = answers.join("\n");
  return {
    kakao: all.match(/https?:\/\/open\.kakao\.com\/[^\s)>,]+/)?.[0],
    email: all.match(/[\w.+-]+@[\w-]+\.[\w.-]+\w/)?.[0],
  };
}

export default function Faq() {
  const { value: c } = useSiteContent("page.faq", FAQ_DEFAULT);
  const contacts = useMemo(() => findContacts(c.items.map((it) => it.a)), [c.items]);
  const hasContact = Boolean(contacts.kakao || contacts.email);

  return (
    <PublicLayout>
      {/* ── 표제 ────────────────────────────────────────────────────────────
          가운데 정렬 제목 하나만 덩그러니 있던 자리다. 다른 공개 페이지는 전부
          왼쪽 정렬 표제 띠로 시작하므로 여기도 맞춘다. */}
      <section className="relative overflow-hidden border-b border-border px-4 pb-14 pt-20">
        <LiquidBackdrop />
        <Reveal className="container mx-auto max-w-3xl">
          <h1 className="font-serif text-4xl font-bold md:text-5xl">{c.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            지원 전에 가장 많이 받는 질문 {c.items.length}개를 모았습니다.
          </p>
        </Reveal>
      </section>

      {/* ── 문항 ─────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-3xl">
          {/* 문항을 하나씩 띄우지 않는다. 아코디언은 펼침/접힘 자체가 모션이라
              등장 모션까지 겹치면 두 움직임이 서로를 방해한다.

              대신 판을 나눈다 — 머리카락 같은 밑줄 하나로 이어 붙이면 문항 열둘이
              한 덩어리 글로 읽힌다. 각자 카드에 앉히면 "고를 수 있는 것" 으로
              보이고, 열린 문항이 어디까지인지도 눈에 들어온다. */}
          <Reveal>
            <Accordion type="single" collapsible className="flex w-full flex-col gap-3">
              {c.items.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md data-[state=open]:border-primary/50 data-[state=open]:shadow-md"
                >
                  <AccordionTrigger className="px-5 py-4 text-left text-base font-semibold hover:no-underline data-[state=open]:text-primary md:text-lg">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line border-t border-border/70 px-5 pb-5 pt-4 text-base leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ── 여기 없는 질문 ───────────────────────────────────────────────────
          FAQ 는 답을 못 찾았을 때 갈 곳이 있어야 끝난다. 지금은 그 정보가 마지막
          문항 안에 접혀 있어서, 펼치지 않으면 보이지 않는다. */}
      {hasContact ? (
        <section className="border-t border-border bg-muted/30 px-4 py-16">
          <div className="container mx-auto max-w-3xl">
            <Reveal>
              <h2 className="font-serif text-2xl font-bold">여기 없는 질문이라면</h2>
              <p className="mt-2 text-muted-foreground">
                편한 쪽으로 물어보세요. 운영진이 직접 답합니다.
              </p>
            </Reveal>
            <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
              {contacts.kakao ? (
                <StaggerItem>
                  <a
                    href={contacts.kakao}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                      aria-hidden="true"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">카카오톡 오픈채팅</span>
                      <span className="block text-xs text-muted-foreground">
                        새 창에서 열립니다
                      </span>
                    </span>
                  </a>
                </StaggerItem>
              ) : null}
              {contacts.email ? (
                <StaggerItem>
                  <a
                    href={`mailto:${contacts.email}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                      aria-hidden="true"
                    >
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">이메일</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {contacts.email}
                      </span>
                    </span>
                  </a>
                </StaggerItem>
              ) : null}
            </Stagger>
          </div>
        </section>
      ) : null}
    </PublicLayout>
  );
}
