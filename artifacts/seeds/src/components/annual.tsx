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
    /* 간격이 리듬을 만든다. 1차 시도는 표제·본문·내용이 전부 같은 간격이라
       판이 균질하게 흘렀다. 여기서는 비를 벌린다 — 판번호↔표제는 붙이고
       (2:같은 덩어리), 표제↔본문은 벌리고(5), 본문↔내용은 크게 띄운다(10~14).
       읽는 사람이 어디까지가 한 덩어리인지 간격만으로 안다. */
    <section className="border-t" style={RULE}>
      <div className="container mx-auto max-w-5xl px-4 py-14 md:py-20">
        {no ? <div className="plate-no text-[11px] uppercase">{no}</div> : null}
        {title ? (
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] md:text-4xl">
            {title}
          </h2>
        ) : null}
        {lead ? (
          <p className="mt-5 max-w-[62ch] text-base leading-[1.75] text-muted-foreground">
            {lead}
          </p>
        ) : null}
        <div className={title || lead ? (lead ? "mt-10" : "mt-8") : undefined}>
          {children}
        </div>
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

/**
 * 인물 판 — 연감의 본체.
 *
 * 1차 시도에서 이 조각이 아예 없었다. 연감은 인물 초상을 모아 놓은 물건인데
 * 실존 멘토 9명이 공개 표면 어디에도 안 나왔다. 세계관만 선언하고 그 세계의
 * 핵심 판을 비워둔 것이 "빼기만 했다"는 인상의 가장 큰 원인이다.
 *
 * 카드가 아니다: 테두리로 감싸지 않고 괘선과 판번호로만 구획한다. 초상은
 * 정사각이 아니라 세로 4:5 — 연감 증명사진의 비율이고, 정사각 격자가 주는
 * 프로필-카드 인상에서 벗어난다.
 */
export function Portrait({
  no,
  name,
  roleTitle,
  affiliation,
  bio,
  photoUrl,
  tags = [],
  href,
}: {
  /** 판번호. 색인과 짝을 이루므로 순서가 정보인 자리에서만 넘긴다. */
  no?: string;
  name: string;
  roleTitle?: string | null;
  affiliation?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  tags?: string[];
  /** 넘기면 판 전체가 링크가 된다. */
  href?: string;
}) {
  const body = (
    <>
      <div
        className="plate-edge relative overflow-hidden border"
        style={{ ...RULE, aspectRatio: "4 / 5", backgroundColor: "hsl(var(--paper-2, var(--muted)))" }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-[filter,transform] duration-500 group-hover:scale-[1.02] group-hover:saturate-[1.08]"
            style={{ filter: "saturate(0.82) contrast(1.03)" }}
          />
        ) : (
          /* 사진이 없으면 이름 첫 글자를 크게 각인한다. 회색 아바타 원보다
             연감의 판형에 맞고, 빈 판이 격자에서 구멍처럼 보이지 않는다. */
          <div
            className="flex h-full w-full items-center justify-center font-bold leading-none tracking-[-0.05em]"
            style={{ fontSize: "clamp(3rem, 7vw, 5rem)", color: "hsl(var(--rule))" }}
            aria-hidden="true"
          >
            {name.slice(0, 1)}
          </div>
        )}
        {no ? (
          <div
            className="absolute left-0 top-0 px-2 py-1 text-[10px] font-bold tabular-nums tracking-[0.14em]"
            style={{ backgroundColor: "hsl(var(--seal))", color: "hsl(0 0% 100%)" }}
          >
            {no}
          </div>
        ) : null}
      </div>

      {/* 활자 대비 — 이름은 크게 각인, 나머지는 캡션 크기로 확 떨어뜨린다.
          연감은 이 낙차가 전부다. 중간 크기를 두면 밋밋해진다. */}
      <h3
        className="mt-3 font-bold leading-[1.1] tracking-[-0.03em]"
        style={{ fontSize: "clamp(1.375rem, 2.1vw, 1.75rem)" }}
      >
        {name}
      </h3>
      {roleTitle ? (
        <div
          className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.13em]"
          style={SEAL}
        >
          {roleTitle}
        </div>
      ) : null}
      {affiliation ? (
        <div className="mt-1 text-[13px] text-muted-foreground">{affiliation}</div>
      ) : null}
      {bio ? (
        <p className="mt-2.5 max-w-[46ch] whitespace-pre-line text-[13px] leading-[1.65] text-muted-foreground">
          {bio}
        </p>
      ) : null}
      {tags.length > 0 ? (
        /* 태그는 알약이 아니라 캡션 줄이다 — 알약을 쓰면 다시 카드 언어로
           돌아가고, 연감에서 분류는 도판 아래 작은 활자로 붙는다. */
        <div className="mt-3 border-t pt-2 text-[11px] tracking-[0.06em] text-muted-foreground" style={RULE}>
          {tags.join(" · ")}
        </div>
      ) : null}
    </>
  );

  if (!href) return <article className="group">{body}</article>;
  return (
    <a
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ ["--tw-ring-color" as string]: "hsl(var(--seal))" }}
    >
      {body}
    </a>
  );
}

/**
 * 명부 한 줄 — 초상 없는 인물 판.
 *
 * 처음엔 사진이 없으면 4:5 상자에 이름 첫 글자를 크게 깔았다. 그런데 실제
 * 데이터에는 사진이 있는 사람이 **한 명도 없어서**, 화면의 절반이 회색 빈
 * 상자로 덮였다. 빈 초상 아홉 개는 절제가 아니라 그냥 빈 자리다.
 *
 * 연감에는 이 경우의 정답이 이미 있다 — 뒤쪽 명부. 도판 없이 번호·이름·소속을
 * 붙여 촘촘히 조판한 판이고, 사진이 없어도 완결된 물건으로 읽힌다.
 * 어느 형식을 쓸지는 {@link hasPortraits}가 컬렉션 단위로 정한다.
 */
export function RosterRow({
  no,
  name,
  roleTitle,
  affiliation,
  bio,
  tags = [],
  href,
}: {
  no: string;
  name: string;
  roleTitle?: string | null;
  affiliation?: string | null;
  bio?: string | null;
  tags?: string[];
  href?: string;
}) {
  const inner = (
    <>
      {/* 번호는 도장색 각인. 초상이 없으니 이 숫자가 판의 시각적 정박점이 된다. */}
      <span
        className="select-none pt-1 text-right text-[13px] font-bold tabular-nums leading-none tracking-[0.06em]"
        style={SEAL}
      >
        {no}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3
            className="font-bold leading-[1.15] tracking-[-0.03em] transition-colors group-hover:text-[hsl(var(--seal))]"
            style={{ fontSize: "clamp(1.25rem, 1.7vw, 1.5rem)" }}
          >
            {name}
          </h3>
          {affiliation ? (
            <span className="text-[13px] text-muted-foreground">{affiliation}</span>
          ) : null}
        </div>
        {roleTitle ? (
          <div
            className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]"
            style={SEAL}
          >
            {roleTitle}
          </div>
        ) : null}
        {bio ? (
          <p className="mt-2 max-w-[52ch] whitespace-pre-line text-[13px] leading-[1.65] text-muted-foreground">
            {bio}
          </p>
        ) : null}
        {tags.length > 0 ? (
          <div className="mt-2 text-[11.5px] leading-[1.7] tracking-[0.04em] text-muted-foreground">
            {tags.join(" · ")}
          </div>
        ) : null}
      </div>
    </>
  );

  const cls =
    "group grid grid-cols-[2rem_1fr] gap-x-4 border-t py-6 md:grid-cols-[2.5rem_1fr] md:gap-x-6";
  if (!href) return <li className={cls} style={RULE}>{inner}</li>;
  return (
    <li className="contents">
      <a href={href} className={`${cls} focus-visible:outline-none focus-visible:ring-2`} style={{ ...RULE, ["--tw-ring-color" as string]: "hsl(var(--seal))" }}>
        {inner}
      </a>
    </li>
  );
}

/**
 * 초상 격자를 쓸지 명부를 쓸지 정한다. 사람마다 따로 정하면 한 격자 안에서
 * 상자 있는 칸과 없는 칸이 섞여 판형이 무너지므로, 컬렉션 단위로 한 번 정한다.
 * 한 명이라도 사진이 있으면 초상 격자로 가고, 사진 없는 사람은 이니셜 판을 받는다.
 */
export function hasPortraits(people: { photoUrl?: string | null }[]) {
  return people.some((p) => p.photoUrl);
}

export const annualRule = RULE;
export const annualSeal = SEAL;
