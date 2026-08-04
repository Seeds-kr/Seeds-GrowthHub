import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteContent, RECRUIT_DEFAULT } from "@/lib/site-content";
import { Cover, Plate, Entry, SealPlate, annualRule } from "@/components/annual";

/**
 * 모집 — 기수 연감(DESIGN.md)의 판면.
 *
 * 공개 표면 중 유일하게 결정을 요구하는 화면이라 판 순서가 곧 설득 순서다:
 * 무엇인가(01) → 누구를 찾는가(02) → 1년이 어떻게 흐르는가(03) →
 * 언제 뽑는가(04) → 흔한 의문(05) → 지원.
 *
 * eyebrow 6개를 전부 걷어냈다. 판 번호가 그 자리를 대신하는데, 여기서는
 * 번호가 실제로 기능한다 — 순서가 지원자가 밟는 경로다.
 */
export default function Recruit() {
  const { value: c } = useSiteContent("page.recruit", RECRUIT_DEFAULT);
  return (
    <PublicLayout>
      <Cover
        title={`${c.hero.headlineLine1}\n${c.hero.headlineLine2}`}
        intro={c.hero.body}
      >
        <Link href="/apply">
          <Button size="lg" className="mt-9 h-13 px-8 text-base">
            {c.hero.ctaLabel}
          </Button>
        </Link>
      </Cover>

      <Plate no="01" title={c.intro.title} lead={c.intro.body}>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {c.intro.features.map((f, i) => (
            <Entry
              key={i}
              label={String(i + 1).padStart(2, "0")}
              title={f.title}
              body={f.desc}
            />
          ))}
        </div>
      </Plate>

      <Plate no="02" title={c.applicants.title}>
        <ul className="grid gap-x-12 md:grid-cols-2">
          {c.applicants.items.map((item, i) => (
            <li
              key={i}
              className="flex items-baseline gap-4 border-t py-4"
              style={annualRule}
            >
              <span className="plate-no shrink-0 text-[11px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </Plate>

      {/* 1년의 흐름 — 연감의 색인과 같은 판형(왼쪽 시기, 오른쪽 내용). */}
      <Plate no="03" title={c.flow.title}>
        <ol>
          {c.flow.steps.map((step, i) => (
            <li
              key={i}
              className="grid grid-cols-[5rem_1fr] items-baseline gap-x-5 border-t py-5 md:grid-cols-[9rem_1fr] md:gap-x-8"
              style={annualRule}
            >
              <span className="text-sm font-bold tracking-[-0.01em] md:text-base">
                {step.month}
              </span>
              <div>
                <h3 className="text-base font-bold tracking-[-0.02em] md:text-lg">
                  {step.title}
                </h3>
                <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Plate>

      <Plate no="04" title={c.schedule.title}>
        <ol>
          {c.schedule.steps.map((step, i) => (
            <li
              key={i}
              className="grid grid-cols-[5rem_1fr] items-baseline gap-x-5 border-t py-5 md:grid-cols-[9rem_1fr] md:gap-x-8"
              style={annualRule}
            >
              <span className="text-sm font-bold tabular-nums md:text-base">
                {step.date}
              </span>
              <div>
                <h3 className="text-base font-bold tracking-[-0.02em] md:text-lg">
                  {step.phase}
                </h3>
                <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Plate>

      <Plate no="05" title={c.faqTeaser.title}>
        <dl>
          {c.faqTeaser.items.map((item, i) => (
            <div key={i} className="border-t py-5" style={annualRule}>
              <dt className="text-base font-bold tracking-[-0.02em]">
                {item.q}
              </dt>
              <dd className="mt-2 max-w-[68ch] leading-relaxed text-muted-foreground">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
        <Link href="/faq">
          <Button variant="outline" className="mt-8">
            {c.faqTeaser.ctaLabel}
          </Button>
        </Link>
      </Plate>

      <SealPlate title={c.cta.title} body={c.cta.body}>
        <Link href="/apply">
          <Button size="lg" variant="secondary" className="mt-8 h-13 px-8 text-base">
            {c.cta.ctaLabel}
          </Button>
        </Link>
      </SealPlate>
    </PublicLayout>
  );
}
