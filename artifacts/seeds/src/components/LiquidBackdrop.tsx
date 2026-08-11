/**
 * 히어로 뒤에서 천천히 도는 유동 배경.
 *
 * 흐린 덩어리 세 개가 서로 다른 주기로 떠다니면서 겹치는 자리마다 농도가
 * 달라진다. 정지 화면에서도 성립하는 구성이라, 모션이 꺼져도 그냥 은은한
 * 그라디언트로 남는다(사라지지 않는다).
 *
 * 지키는 것:
 *  - 애니메이션은 `transform` 뿐이다. 레이아웃·페인트를 건드리지 않아 합성만으로 돈다.
 *  - `pointer-events-none` + `aria-hidden`. 장식이라 클릭도 낭독도 가로채지 않는다.
 *  - 색은 브랜드 그린 하나만 쓴다. 무지개 메시 그라디언트는 정확히 AI가 만든
 *    페이지처럼 보이는 지점이라 피한다.
 *  - `prefers-reduced-motion` 이면 CSS 쪽에서 표류가 멈춘다.
 *
 * 덩어리를 감싼 컨테이너에 `overflow-hidden` 이 필요하다 — 안 그러면 흐림이
 * 섹션 밖으로 새어 가로 스크롤을 만든다.
 */
export function LiquidBackdrop({
  className = "",
  /**
   * 어떤 면 위에 까는지.
   *
   *  `paper` 종이색 위. 브랜드 그린 덩어리가 색으로 드러난다.
   *  `brand` 통초록 띠 위. 같은 초록의 **명도만** 흔든다 — 초록 위에 초록을
   *          얹으면 아무것도 안 보이기 때문이다. 흰 글자가 올라가는 면이라
   *          밝은 덩어리는 글줄 밖 모서리에 묶여 있다(index.css 참고).
   */
  tone = "paper",
}: {
  className?: string;
  tone?: "paper" | "brand";
}) {
  const brand = tone === "brand";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* 클래스 이름을 문자열로 조립하지 않는다. 통째로 적어야 나중에 grep 으로
          "이 덩어리가 어디서 쓰이나" 를 찾을 수 있다. */}
      {(brand
        ? ["liquid-blob-brand-1", "liquid-blob-brand-2", "liquid-blob-brand-3"]
        : ["liquid-blob-1", "liquid-blob-2", "liquid-blob-3"]
      ).map((b) => (
        <div key={b} className={`liquid-blob ${b}`} />
      ))}
      {/* 아래쪽으로 갈수록 종이색으로 녹아 본문과 이어진다. 경계선이 생기면
          배경이 "얹힌 판"으로 보이고, 유동적이라는 인상이 깨진다.
          통초록 띠는 위아래가 이미 다른 색으로 끊기므로 녹일 필요가 없다. */}
      {brand ? null : (
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      )}
    </div>
  );
}
