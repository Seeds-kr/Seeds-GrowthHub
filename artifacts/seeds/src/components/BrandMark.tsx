import markUrl from "@/assets/brand/seeds-mark.png";
import { cn } from "@/lib/utils";

/**
 * 로고 마크(새싹). 워드마크 없이 마크만 쓴다.
 *
 * 헤더에는 이미 "Seeds 학생" · "Seeds Admin" 처럼 글자가 있다. 워드마크가 든
 * 전체 로고를 그 옆에 두면 "seeds"가 두 번 나온다. 그래서 마크만 붙이고 글자는
 * 각 레이아웃이 그대로 쓴다.
 *
 * 원본은 72×64(레티나 대비 2배)라 24px로 그려도 선명하다. `alt=""`인 것은
 * 의도다 — 바로 옆 텍스트가 이미 같은 것을 말하므로, 스크린리더에 "Seeds 로고
 * Seeds 학생"으로 두 번 읽히지 않게 장식으로 표시한다.
 */
export function BrandMark({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={markUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}
