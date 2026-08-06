import type { ReactNode } from "react";
import { Link } from "wouter";

/**
 * 공개 표면의 카드 하나.
 *
 * 카드가 세 군데에 있었는데 셋 다 달랐다 — 하나는 모서리가 둥글고 하나는 각졌고,
 * 패딩이 p-6/p-7 로 갈렸고, 호버는 하나만 떠오르고 테두리 농도도 제각각이었다
 * (`hover:border-primary` vs `hover:border-primary/40`). 각각은 사소하지만 한
 * 페이지에서 나란히 놓이면 "만들다 만" 인상을 준다.
 *
 * 여기서 한 벌로 정한다:
 *   모서리   rounded-lg 하나만 쓴다
 *   패딩     p-6 (촘촘한 자리는 dense 로 p-5)
 *   호버     테두리가 브랜드색으로, 그림자가 깊어지고, 1px 떠오른다
 *   포커스   링 + 오프셋. 누를 수 있는 카드에만.
 *
 * 광원(`spotlight-card`)은 포인터를 따라다니는 피드백이고, 좌표는 CSS 변수로만
 * 흘러 리렌더가 없다.
 */

const BASE =
  "spotlight-card relative flex flex-col rounded-lg border border-border bg-card " +
  "transition-[border-color,box-shadow,transform] duration-200 ease-out";

const INTERACTIVE =
  "cursor-pointer hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
  "active:translate-y-0 active:shadow-md";

/** 누를 수 없는 카드도 살짝 반응한다. 죽은 판처럼 보이지 않을 만큼만. */
const STATIC_HOVER = "hover:border-primary/30 hover:shadow-md";

/** 포인터 좌표를 CSS 변수로 흘린다. 상태를 거치지 않으므로 리렌더가 없다. */
function trackSpot(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
  el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
}

export function SurfaceCard({
  children,
  href,
  dense,
  flush,
  className = "",
}: {
  children: ReactNode;
  /** 넘기면 카드 전체가 링크가 된다. 진짜 <a> 라 새 탭·링크 복사가 동작한다. */
  href?: string;
  dense?: boolean;
  /**
   * 안쪽 여백을 없앤다. 사진처럼 카드 가장자리까지 닿아야 하는 내용에 쓴다
   * (여백을 className 으로 덮으려 하면 Tailwind 에서 어느 쪽이 이길지가
   * 클래스 순서에 달려 불안정하다).
   */
  flush?: boolean;
  className?: string;
}) {
  const pad = flush ? "overflow-hidden" : dense ? "p-5" : "p-6";
  const cls = `group ${BASE} ${pad} ${href ? INTERACTIVE : STATIC_HOVER} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} onPointerMove={trackSpot}>
        {children}
      </Link>
    );
  }
  return (
    <article className={cls} onPointerMove={trackSpot}>
      {children}
    </article>
  );
}
