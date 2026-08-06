import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useIsDesktop } from "@/hooks/use-desktop";

/**
 * 판이 화면을 지나는 동안 가로로 흐르는 띠.
 *
 * 처음에는 스크롤을 통째로 가로채는 방식(sticky 로 화면을 고정하고 세로 스크롤을
 * x 이동으로 바꾸는 것)으로 만들었다가 버렸다. 실측해 보니 두 가지가 걸렸다.
 *
 *   - 이동 거리가 624px 이었다. 화면 하나도 안 되는 거리를 위해 스크롤을
 *     빼앗는 건 손해다. 모션은 값을 치른 만큼 돌려줘야 한다.
 *   - 화면을 통째로 고정했는데 연도 카드는 얇은 띠라, 위아래가 빈 채로
 *     남았다. 화면을 잡아놓고 30%만 쓰는 셈이었다.
 *
 * 그래서 고정을 없앴다. 판은 내용 높이 그대로 두고, 그 판이 화면을 지나가는
 * 동안에만 트랙이 가로로 흐른다. 스크롤은 평소대로 동작하고, 시간이 가로로
 * 흐른다는 감각은 남는다. 값을 치르지 않고 얻는 쪽이다.
 *
 * 데스크톱 전용이다. 폰에서는 손가락으로 미는 네이티브 스냅 스크롤이 낫고,
 * `prefers-reduced-motion` 이면 흐름 없이 정지한 띠가 된다.
 */
export function HorizontalDrift({
  children,
  className = "",
  /** 흐르는 양(0~1). 1이면 트랙이 화면 밖으로 나간 만큼 전부 흐른다. */
  travel = 0.85,
}: {
  children: ReactNode;
  className?: string;
  travel?: number;
}) {
  const reduce = useReducedMotion();
  const isDesktop = useIsDesktop();
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);

  // 트랙이 화면 밖으로 얼마나 나가 있는지. 글꼴이 늦게 붙거나 창 크기가 바뀌면
  // 달라지므로 계속 따라간다.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setOverflow(Math.max(0, track.scrollWidth - window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  // 판의 아래끝이 화면에 들어올 때 시작해서 위끝이 화면을 빠져나갈 때 끝난다.
  // 즉 "보이는 동안"이 곧 흐르는 구간이다.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.35 });
  const x = useTransform(smooth, [0, 1], [0, -overflow * travel]);

  if (reduce || !isDesktop) {
    return (
      <div className={`flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="overflow-hidden">
      <motion.div ref={trackRef} style={{ x }} className={`flex ${className}`}>
        {children}
      </motion.div>
    </div>
  );
}
