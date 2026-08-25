/**
 * 현재 경로가 이 메뉴 항목에 해당하는가.
 *
 * 접두어로 판정하되 **각 영역의 홈은 정확히 일치할 때만** 활성이다. 안 그러면
 * `/student` 가 `/student/assignments` 에서도 활성이라 두 곳이 동시에 켜진다 —
 * 그러면 표시가 있으나 마나다.
 *
 * `AdminLayout` 안에만 있던 것을 꺼냈다. 멘토·학생·평가위원 화면에는 활성 표시가
 * **아예 없었고**(2026-08-24 확인), 학생은 메뉴가 12개인데도 그랬다. 같은 판정을
 * 네 곳이 각자 구현하면 또 갈린다.
 */
const SECTION_HOMES = ["/admin", "/mentor", "/student", "/evaluator"];

export function isActive(currentPath: string, href: string): boolean {
  if (SECTION_HOMES.includes(href)) return currentPath === href;
  return currentPath === href || currentPath.startsWith(href + "/");
}
