import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";

/**
 * 공개 표면의 모션 레이어.
 *
 * 규칙 두 가지를 지킨다.
 *
 *  - **모션에는 이유가 있어야 한다.** 여기 있는 것들은 전부 위계(먼저 읽어야 할
 *    것을 먼저 보여준다) 또는 피드백(내 동작이 먹혔다) 중 하나를 한다. "멋있어서"
 *    붙인 무한 루프는 없다.
 *  - **`prefers-reduced-motion`이면 전부 정지한다.** 끄는 게 아니라 최종 상태로
 *    바로 간다. 켜져 있든 꺼져 있든 읽을 수 있는 내용은 같다.
 *
 * 스크롤 값은 `window.addEventListener("scroll")` 로 읽지 않는다. 매 프레임
 * 리렌더가 걸려 모바일에서 무너진다. IntersectionObserver(`useInView`)와
 * 모션 값(`useMotionValue`)만 쓴다.
 */

/** 종이 위로 올라오는 듯한 감속. 끝에서 살짝 붙잡혀 기계적으로 안 보인다. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 스크롤해서 들어올 때 떠오르는 블록.
 *
 * 한 번만 재생한다(`once`). 스크롤을 되감을 때마다 다시 튀면 읽는 걸 방해한다.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  /** 떠오르는 거리. 큰 표제는 더 멀리서 와야 무게가 산다. */
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "span";
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </M>
  );
}

/**
 * 자식들이 차례로 들어오는 컨테이너.
 *
 * 순서가 정보인 곳에만 쓴다(연도별 기록, 모집 일정, 단계). 순서가 없는 격자에
 * 걸면 위계를 지어내는 셈이라 오히려 방해가 된다.
 */
const STAGGER_PARENT: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "dl";
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      variants={reduce ? undefined : STAGGER_PARENT}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </M>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M className={className} variants={reduce ? undefined : STAGGER_CHILD}>
      {children}
    </M>
  );
}

/**
 * 커서를 향해 살짝 끌려오는 버튼.
 *
 * 스프링을 태워 손에 붙는 느낌을 만든다. 값은 모션 값으로만 흐르고 React 상태를
 * 거치지 않는다(상태로 하면 마우스 움직임마다 트리가 리렌더된다).
 *
 * 끌림 폭은 8px로 얕게 잡았다. 크게 잡으면 클릭 대상이 커서에서 달아나서
 * 오히려 누르기 어려워진다.
 */
export function Magnetic({
  children,
  className,
  strength = 8,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 22, mass: 0.4 });
  const y = useSpring(my, { stiffness: 260, damping: 22, mass: 0.4 });

  if (reduce) return <span className={className}>{children}</span>;

  return (
    <motion.span
      ref={ref}
      className={`inline-block ${className ?? ""}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        // 터치는 제외한다. 손가락에는 호버가 없고, 누르는 순간 대상이 움직이면
        // 오작동으로 느껴진다.
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength);
        my.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * 커서를 따라다니는 광원 테두리.
 *
 * 카드가 포인터에 반응한다는 피드백이다. 좌표를 CSS 변수로 흘려서 리렌더가
 * 아예 없다. 실제 빛은 자식 쪽 `[--spot]` 그라디언트가 그린다.
 */
export function Spotlight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={
        reduce
          ? undefined
          : (e) => {
              if (e.pointerType !== "mouse" || !ref.current) return;
              const r = ref.current.getBoundingClientRect();
              ref.current.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
              ref.current.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
            }
      }
    >
      {children}
    </div>
  );
}

/**
 * 화면에 들어올 때 0에서 올라가는 숫자.
 *
 * 숫자가 "쌓인 기록"이라는 걸 보여준다. 접두·접미(3년+, 96명)는 그대로 두고
 * 숫자 부분만 센다 — 파싱에 실패하면 원문을 그대로 낸다(억지로 숫자를 만들지 않는다).
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const m = value.match(/^(\D*)(\d[\d,]*)(.*)$/s);
  const target = m ? Number(m[2].replace(/,/g, "")) : null;
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView || target === null || reduce) return;
    const DURATION = 1100;
    let raf = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / DURATION);
      // 도착 직전에 감속. 선형으로 세면 계수기처럼 보인다.
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduce]);

  if (target === null || reduce) return <span className={className}>{value}</span>;
  return (
    <span ref={ref} className={className}>
      {m![1]}
      {(inView ? n : 0).toLocaleString("ko-KR")}
      {m![3]}
    </span>
  );
}
