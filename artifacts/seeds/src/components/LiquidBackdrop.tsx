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
export function LiquidBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="liquid-blob liquid-blob-1" />
      <div className="liquid-blob liquid-blob-2" />
      <div className="liquid-blob liquid-blob-3" />
      {/* 아래쪽으로 갈수록 종이색으로 녹아 본문과 이어진다. 경계선이 생기면
          배경이 "얹힌 판"으로 보이고, 유동적이라는 인상이 깨진다. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
