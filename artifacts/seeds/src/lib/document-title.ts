import { useEffect } from "react";

/**
 * 브라우저 탭 제목을 페이지에 맞춘다.
 *
 * 전에는 모든 화면이 `index.html` 의 `Seeds` 그대로였다. 탭을 여럿 열면 전부
 * 같은 이름이라 구분이 안 되고, 방문 기록·북마크도 마찬가지다. 운영진은 지원서와
 * 회의록과 재정을 나란히 열어 두고 오가는 사람들이라 이게 매일 걸린다.
 *
 * **네비 라벨을 그대로 쓴다.** 제목을 따로 적어 두면 메뉴 이름을 바꿀 때 한쪽만
 * 바뀌어 갈린다 — 이 레포에서 사이드바만 고치고 화면 제목을 안 고쳐 `재정` 과
 * `재정(Finance)` 가 갈린 적이 있다(2026-08-25).
 *
 * 순서는 **구체적인 것이 앞**이다. `지원서 관리 · Seeds` 는 탭이 좁아져도 앞부분이
 * 남지만, `Seeds · 지원서 관리` 는 잘리면 전부 `Seeds…` 가 된다.
 */
const SUFFIX = "Seeds";

export function useDocumentTitle(label: string | null | undefined): void {
  useEffect(() => {
    const next = label ? `${label} · ${SUFFIX}` : SUFFIX;
    if (document.title !== next) document.title = next;
    // 되돌리지 않는다. 다음 화면이 자기 제목을 정하므로, 여기서 원복하면
    // 화면 전환마다 "Seeds" 가 한 번 깜빡인다.
  }, [label]);
}
