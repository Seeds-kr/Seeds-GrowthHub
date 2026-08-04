import type { ReactNode } from "react";

/**
 * 기수 연감(DESIGN.md)의 판면 조각들.
 *
 * 페이지마다 다시 만들면 갈라진다 — 홈만 연감이고 나머지는 옛 구성인 상태가
 * 정확히 그 증상이었다. 공개 표면은 전부 이 조각들로 짠다.
 *
 * 색은 `.annual` 스코프의 CSS 변수에서만 온다(PublicLayout이 건다).
 * 이 파일이 팔레트를 새로 정의하지 않는 이유이고, 어드민 표면이 영향을 받지
 * 않는 이유이기도 하다.
 */

const RULE = { borderColor: "hsl(var(--rule))" } as const;
const SEAL = { color: "hsl(var(--seal))" } as const;

/**
 * 판 표제 — 각 공개 페이지의 첫 화면.
 *
 * 제목 위 eyebrow를 두지 않는다(craft-floor 금지). 대신 연감의 실제 기능인
 * 판 번호나 연도가 그 자리를 가진다.
 */
export function Cover({
  stamp,
  title,
  intro,
  children,
}: {
  /** 연도나 판 번호처럼 이 판을 가리키는 짧은 표식. 없으면 생략된다. */
  stamp?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b" style={RULE}>
      <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
        {stamp ? (
          <div
            className="press-in font-bold leading-[0.85] tracking-[-0.05em]"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", ...SEAL }}
          >
            {stamp}
          </div>
        ) : null}
        <h1
          className={`${stamp ? "mt-5" : "press-in"} max-w-3xl whitespace-pre-line font-bold leading-[1.15] tracking-[-0.035em]`}
          style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
        >
          {title}
        </h1>
        {intro ? (
          <p className="mt-6 max-w-[68ch] whitespace-pre-line text-base leading-[1.7] text-muted-foreground md:text-lg">
            {intro}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** 번호가 붙은 판. 번호는 순서가 정보인 자리에서만 쓴다. */
export function Plate({
  no,
  title,
  lead,
  children,
}: {
  no?: string;
  title?: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t" style={RULE}>
      <div className="container mx-auto max-w-5xl px-4 py-14 md:py-20">
        {no ? <div className="plate-no text-[11px] uppercase">{no}</div> : null}
        {title ? (
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] md:text-3xl">
            {title}
          </h2>
        ) : null}
        {lead ? (
          <p className="mt-3 max-w-[68ch] text-base leading-[1.75] text-muted-foreground">
            {lead}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * 고정 축척 항목 — 카드가 아니라 괘선 위에 놓인다.
 * 크기로 서열을 만들지 않으므로 모든 항목이 같은 판형을 갖는다.
 */
export function Entry({
  label,
  title,
  body,
  children,
}: {
  /** 캡션 자리의 짧은 표식(기간·분류 등). */
  label?: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <article className="border-t pt-5" style={RULE}>
      {label ? (
        <div className="plate-no text-[11px] uppercase">{label}</div>
      ) : null}
      <h3 className="mt-2 text-lg font-bold tracking-[-0.02em]">{title}</h3>
      {body ? (
        <p className="mt-2 max-w-[62ch] whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {children}
    </article>
  );
}

/** 마감 판 — 도장 색으로 덮인다. 공개 표면의 행동 요청이 여기 놓인다. */
export function SealPlate({
  no,
  title,
  body,
  children,
}: {
  no?: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="border-t"
      style={{ ...RULE, backgroundColor: "hsl(var(--seal))" }}
    >
      <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
        {no ? (
          <div
            className="plate-no text-[11px] uppercase"
            style={{ color: "hsl(0 0% 100% / 0.7)" }}
          >
            {no}
          </div>
        ) : null}
        <h2
          className="mt-3 max-w-3xl text-2xl font-bold leading-[1.2] tracking-[-0.035em] md:text-4xl"
          style={{ color: "hsl(0 0% 100%)" }}
        >
          {title}
        </h2>
        {body ? (
          <p
            className="mt-5 max-w-[62ch] whitespace-pre-line text-base leading-[1.7]"
            style={{ color: "hsl(0 0% 100% / 0.85)" }}
          >
            {body}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export const annualRule = RULE;
export const annualSeal = SEAL;
