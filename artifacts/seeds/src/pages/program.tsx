import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSiteContent, PROGRAM_DEFAULT } from "@/lib/site-content";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { Timeline } from "@/components/Timeline";
import { SurfaceCard } from "@/components/SurfaceCard";
import { PHOTOS } from "@/assets/photos";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";
import { Check } from "lucide-react";

/**
 * `"2월 — 팀 빌딩 & 기획"` 을 기간과 제목으로 가른다.
 *
 * 구분자는 **앞뒤에 공백이 있는** 대시만 인정한다. 그냥 `-` 를 쓰면 `"3-5월 — 설계"`
 * 의 범위 하이픈이 먼저 걸려 기간이 `"3"` 으로 잘린다.
 *
 * 이 칸은 운영진이 자유롭게 쓰는 곳이라 구분자가 없을 수도 있다. 그때는 통째로
 * 제목으로 넘긴다(기간을 억지로 만들어내지 않는다).
 */
function splitStep(title: string): { label?: string; title: string } {
  const m = title.match(/^(.{1,12}?)\s+[—–-]\s+(.+)$/);
  return m ? { label: m[1].trim(), title: m[2].trim() } : { title };
}

/**
 * 프로그램 안내.
 *
 * 원래는 한 화면 안에 카드 두 장이 나란히 있었다. 왼쪽은 흰 카드에 10개월 흐름,
 * 오른쪽은 통초록 카드에 혜택 목록. 세 가지가 걸렸다.
 *
 *  - **10개월 흐름이 흐르지 않았다.** 시간 순서인데 그냥 목록이라, 어디가 시작이고
 *    어디가 끝인지 형태로는 알 수 없었다.
 *  - **두 카드의 높이가 안 맞아** 오른쪽 초록 카드 아래 절반이 빈 덩어리였다.
 *  - 무게가 어긋났다. 한쪽은 흰 판, 한쪽은 통색이라 둘이 같은 층위로 안 읽힌다.
 *
 * 나란히 두지 않고 판을 나눈다. 흐름이 먼저 오고(이게 이 페이지의 본체다),
 * 혜택은 그 뒤에 격자로 놓는다.
 */
export default function Program() {
  const { value: c } = useSiteContent("page.program", PROGRAM_DEFAULT);

  return (
    <PublicLayout>
      {/* ── 표제 ─────────────────────────────────────────────────────────────
          글만 왼쪽에 붙여 두면 1440px 화면에서 오른쪽 절반이 통째로 빈다. 사진을
          하나 앉혀 균형을 잡는다 — 이 페이지가 설명하는 게 결국 저 장면이다. */}
      <section className="relative overflow-hidden border-b border-border px-4 pb-16 pt-20">
        <LiquidBackdrop />
        <div className="container mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1fr_minmax(0,22rem)]">
          <Reveal>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
              PROGRAM
            </div>
            <h1 className="font-serif text-4xl font-bold md:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
              2월에 팀을 짜서 11월에 결과를 공유합니다. 열 달 동안 무엇을 하는지 아래에
              적었습니다.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <img
              src={PHOTOS.mentoringTeam.src}
              alt={PHOTOS.mentoringTeam.alt}
              loading="eager"
              className="elev-2 aspect-[4/3] w-full rounded-lg border border-border object-cover"
            />
          </Reveal>
        </div>
      </section>

      {/* ── 10개월 흐름 ──────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <Reveal>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
              10-MONTH FLOW
            </div>
            <h2 className="mb-10 font-serif text-2xl font-bold md:text-3xl">
              {c.curriculum.heading}
            </h2>
          </Reveal>
          {/* 축을 긋고 마디를 얹는다. 지금이 어느 단계인지도 같이 말한다. */}
          <Timeline
            items={c.curriculum.items.map((it) => ({ ...splitStep(it.title), desc: it.desc }))}
          />
        </div>
      </section>

      {/* ── 함께 얻는 것 ─────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <Reveal>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
              WHAT YOU GET
            </div>
            <h2 className="mb-10 font-serif text-2xl font-bold md:text-3xl">
              {c.benefits.heading}
            </h2>
          </Reveal>
          {/* 통초록 카드 하나에 몰아넣지 않는다. 항목마다 자기 자리를 준다 —
              다섯 개가 한 덩어리로 읽히면 하나하나가 눈에 안 들어온다. */}
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {c.benefits.items.map((it, i) => (
              <StaggerItem key={i}>
                <SurfaceCard dense className="h-full">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-relaxed">{it}</span>
                  </div>
                </SurfaceCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 실제 모습 ────────────────────────────────────────────────────────
          글로만 설명하고 끝나던 페이지였다. 세미나·발표 사진 두 장이면
          "열 달 동안 뭘 하나" 가 훨씬 빨리 전해진다. */}
      <section className="border-t border-border px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <Reveal>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
              IN PRACTICE
            </div>
            <h2 className="mb-8 font-serif text-2xl font-bold md:text-3xl">
              이런 모습으로 굴러갑니다
            </h2>
            <Stagger className="grid gap-6 sm:grid-cols-2">
              {[PHOTOS.seminarRoom, PHOTOS.projectShowcase].map((ph) => (
                <StaggerItem key={ph.src}>
                  <figure>
                    <img
                      src={ph.src}
                      alt={ph.alt}
                      loading="lazy"
                      className="elev-1 aspect-[4/3] w-full rounded-lg border border-border object-cover"
                    />
                    <figcaption className="mt-2 text-xs text-muted-foreground">
                      {ph.alt}
                    </figcaption>
                  </figure>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
