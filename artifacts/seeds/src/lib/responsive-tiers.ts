/**
 * W11 — responsive tier registry (design/05 §6).
 *
 * §6.1 requires every screen to carry one of three tiers, and requires a new
 * screen to declare its tier when it is added. This file is that declaration
 * point: one row per route in `App.tsx`, so a tier is a reviewable fact rather
 * than tribal knowledge.
 *
 *   A — mobile read guaranteed. Layout intact, no horizontal scroll, all
 *       content legible. Editing is not promised.
 *   B — mobile viewable. Tables may collapse to cards or scroll inside their
 *       own `overflow-x` container. Minimal interaction only.
 *   C — desktop only. Below `lg` the feature is replaced by a notice
 *       (`<DesktopOnly>`), never a broken layout.
 *
 * §6.4 baselines: Tailwind default breakpoints, C blocks below `lg` (1024px),
 * A and B must not scroll horizontally at the page level.
 *
 * NOTE — this registry is documentation and a lookup, not an enforcement
 * mechanism. A `C` row does nothing on its own; the guard has to be applied in
 * the page. `MIXED_TIER_SCREENS` records the screens where the page tier and
 * the tier of one section inside it disagree.
 */

export type ResponsiveTier = "A" | "B" | "C";

export const RESPONSIVE_TIERS: Record<string, ResponsiveTier> = {
  // ---- Public site — A (§6.2: 공개 사이트 전체) ----------------------------
  "/": "A",
  "/about": "A",
  "/program": "A",
  "/faq": "A",
  "/recruit": "A",
  "/apply": "A",
  "/apply/success": "A",
  "/people": "A",
  "/mentors": "A",
  "/staff": "A",
  "/members": "A",
  "/people/:kind/:id": "A",

  // Entry points. Reached from a phone more often than any other route, so a
  // broken sign-in would strand every tier below it.
  "/login": "A",
  "/admin/login": "A",
  "/student/login": "A",
  "/activate/:token": "A",

  // The pathless catch-all `<Route component={NotFound} />` in App.tsx. Keyed
  // by "*" because it has no path of its own; rendered for any unmatched URL
  // on any device.
  "*": "A",

  // ---- Student — A (§6.2: /student/* 전체) --------------------------------
  "/student": "A",
  "/student/sessions": "A",
  "/student/assignments": "A",
  "/student/assignments/:id": "A",
  "/student/announcements": "A",
  "/student/attendance": "A",
  "/student/timeline": "A",
  "/student/projects": "A",
  "/student/projects/:id": "A",
  "/student/artifacts": "A",
  "/student/studies": "A",
  "/student/studies/:id": "A",
  "/student/reflections": "A",
  "/student/feedback": "A",
  "/student/report": "A",
  "/student/profile": "A",

  // ---- Mentor — A for reading (§6.2) -------------------------------------
  // ADR-008 is load-bearing here: mentors are the role most likely to be on a
  // phone, and ADR-007's Discord notifications are what make read-only
  // acceptable. `/mentor/projects/:id` is A as a page but holds a C section —
  // see MIXED_TIER_SCREENS.
  "/mentor": "A",
  "/mentor/teams": "A",
  "/mentor/projects/:id": "A",
  "/mentor/feedback": "A",
  "/mentor/profile": "A",

  // ---- Admin — B (§6.2: /admin 목록 화면 · 상세 조회 · ops-dashboard) -----
  "/admin": "B",
  "/admin/applications": "B",
  "/admin/applications/:id": "B",
  "/admin/evaluators": "B",
  "/admin/students": "B",
  "/admin/students/:id": "B",
  "/admin/students/:id/timeline": "B",
  "/admin/students/:id/report": "B",
  "/admin/cohorts": "B",
  "/admin/cohorts/:id/summary": "B",
  "/admin/programs": "B",
  "/admin/sessions": "B",
  "/admin/sessions/:id": "B",
  "/admin/assignments": "B",
  "/admin/assignments/:id": "B",
  "/admin/announcements": "B",
  "/admin/activity-records": "B",
  "/admin/projects": "B",
  "/admin/projects/:id": "B",
  "/admin/artifacts": "B",
  "/admin/feedback": "B",
  "/admin/tags": "B",
  "/admin/site-content": "B",
  "/admin/people": "B",
  "/admin/meetings": "B",
  "/admin/finance": "B",
  "/admin/ops-dashboard": "B",
  "/admin/audit-logs": "B",
  "/admin/studies": "B",
  "/admin/team-status": "B",
  "/admin/users": "B",
  "/admin/roles": "B",
  "/admin/documents": "B",

  // W8 실체화분. 넷 다 읽기 화면이라 B로 확정했다.
  // 표는 `overflow-x-auto` 컨테이너 안에서만 스크롤한다(§6.4).
  // /admin/members · /admin/public-pages · /admin/integrations · /admin/settings 는
  // W8에서 제거되어 여기서도 빠졌다 — 사유는 lib/admin-nav.ts 해당 위치 주석.
  "/admin/interviews": "B",
  "/admin/attendance": "B",
  "/admin/reports": "B",
  "/admin/media": "B",

  // ---- Evaluator — B ------------------------------------------------------
  // NOT classified by §6.2; assigned here. B rather than C on two grounds: the
  // detail layout already collapses (`md:grid-cols-3`), so there is no broken
  // layout for C to protect against, and HANDOFF §5.4 warns that gating
  // /evaluator/* tends to lock out the assigned mentors it is meant to serve.
  // Revisit if the rubric grows wide enough to break at 375px.
  "/evaluator": "B",
  "/evaluator/applications/:id": "B",

  // ---- Desktop only — C (§6.2) -------------------------------------------
  "/admin/tasks": "C", // 6-column kanban + drag and drop
  "/admin/sessions/:id/attendance": "C", // bulk attendance entry
  "/admin/documents/:id": "C", // split editor
  "/admin/meetings/:id": "C", // edit mode — read mode stays available, see MIXED_TIER_SCREENS
};

/**
 * Screens whose page tier and section tier disagree. The page renders at its
 * registry tier; the listed section is wrapped in `<DesktopOnly>` instead of
 * the whole route, so mobile keeps the readable part.
 *
 * §6.2 states both of these directly: `/mentor/projects/:id (조회부)` is A while
 * the status-check form is C, and `/admin/meetings/:id (편집 모드)` is C while
 * the rendered note stays readable.
 */
export const MIXED_TIER_SCREENS: Array<{
  route: string;
  pageTier: ResponsiveTier;
  desktopOnlySection: string;
}> = [
  {
    route: "/mentor/projects/:id",
    pageTier: "A",
    desktopOnlySection: "상태체크 입력 폼",
  },
  {
    route: "/admin/meetings/:id",
    pageTier: "C",
    desktopOnlySection: "편집 모드 (읽기는 모바일에서 가능)",
  },
];

/** Exact-path lookup. Returns undefined for a route with no declared tier. */
export function tierFor(route: string): ResponsiveTier | undefined {
  return RESPONSIVE_TIERS[route];
}
