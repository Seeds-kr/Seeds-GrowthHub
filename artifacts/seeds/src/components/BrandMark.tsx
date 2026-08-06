import markSrc from "@/assets/brand/mark.png";

/**
 * 헤더의 브랜드 표식.
 *
 * 공개 헤더는 "Seeds" 글자만, 어드민·학생·멘토 헤더는 글자 앞에 초록 `S` 사각형을
 * 손으로 그려 쓰고 있었다. 실제 로고가 생겼으니 한 자리로 모은다 — 표면마다 다른
 * 표식을 쓰면 같은 서비스로 안 보인다.
 *
 * 마크는 새싹만 잘라 쓴다. 원본에는 "seeds" 워드마크가 같이 있는데, 헤더에는
 * 이미 글자가 있어서 두 번 나온다.
 */
export function BrandMark({
  /** 마크 옆에 붙는 글자. 표면마다 다르다("Seeds 학생", "Seeds Admin"). */
  label,
  /** 굵게 표시할 앞부분. 나머지는 보통 굵기로 흐려진다. */
  strong = "Seeds",
  className = "",
  size = 26,
}: {
  label?: string;
  strong?: string;
  className?: string;
  size?: number;
}) {
  const rest = label && label.startsWith(strong) ? label.slice(strong.length) : "";
  return (
    <span className={`group inline-flex items-center gap-2 ${className}`}>
      <img
        src={markSrc}
        alt=""
        width={size}
        height={size}
        /* 장식이다 — 옆 글자가 이름을 말하므로 alt 를 비운다. 채우면
           스크린리더가 "Seeds Seeds" 로 두 번 읽는다. */
        aria-hidden="true"
        className="shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{ width: size, height: size }}
      />
      {label ? (
        <span className="font-bold tracking-[-0.02em]">
          <span className="text-primary">{strong}</span>
          {rest ? <span className="text-foreground">{rest}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
