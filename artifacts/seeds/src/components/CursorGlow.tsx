import { useEffect, useRef } from "react";

/**
 * 커서를 따라오는 은은한 초록 빛.
 *
 * 카드마다 붙은 `spotlight-card` 는 그 카드 안에서만 도는 피드백이다. 이건
 * 화면 전체에 하나 깔려서, 카드 사이 빈 자리를 지날 때도 페이지가 마우스를
 * 알아본다는 감각을 준다.
 *
 * 세 가지를 지킨다.
 *
 *  1. **리렌더 0회.** 좌표는 `--glow-x/--glow-y` CSS 변수로만 흘린다. 상태로
 *     들고 있으면 마우스를 움직일 때마다 트리 전체가 다시 그려진다.
 *  2. **프레임당 한 번만 쓴다.** mousemove 는 한 프레임에 여러 번 오기도 한다.
 *     rAF 로 묶어 실제 쓰기는 프레임당 한 번이다.
 *  3. **바로 따라붙지 않는다.** 커서에 딱 붙으면 빛이 아니라 커서 장식으로
 *     읽힌다. 매 프레임 목표점의 12%씩 따라가면 살짝 끌리면서 유동적으로 보인다.
 *
 * 끄는 조건은 CSS 쪽에 있다(`prefers-reduced-motion`, 마우스 없는 기기).
 * 여기서 판단하지 않는 이유는, 창을 옮기거나 설정을 바꾸면 조건이 바뀌는데
 * 미디어 쿼리는 그걸 알아서 따라가기 때문이다.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // CSS 가 이미 껐다면 계산도 하지 않는다.
    if (getComputedStyle(el).display === "none") return;

    let tx = 0, ty = 0; // 커서가 있는 곳
    let x = 0, y = 0;   // 빛이 있는 곳
    let started = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!started) {
        // 첫 좌표는 따라가지 말고 그 자리에서 켠다. 안 그러면 화면 왼쪽 위에서
        // 커서까지 빛이 주욱 날아온다.
        started = true;
        x = tx; y = ty;
        el.dataset.on = "1";
      }
    };

    const tick = () => {
      if (started) {
        x += (tx - x) * 0.12;
        y += (ty - y) * 0.12;
        el.style.setProperty("--glow-x", `${x}px`);
        el.style.setProperty("--glow-y", `${y}px`);
      }
      raf = requestAnimationFrame(tick);
    };

    // 창 밖으로 나가면 마지막 자리에 빛이 남는다. 꺼 준다.
    const onLeave = () => { el.dataset.on = "0"; started = false; };
    const onEnter = () => { /* 다음 pointermove 가 다시 켠다 */ };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}
