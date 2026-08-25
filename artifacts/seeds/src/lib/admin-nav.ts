import {
  LayoutDashboard,
  LayoutGrid,
  FileText,
  UserCheck,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  Megaphone,
  Activity,
  FolderKanban,
  Package,
  MessageSquare,
  Tags,
  FileEdit,
  UserSquare2,
  CalendarCheck,
  ShieldCheck,
  UserCog,
  CheckSquare,
  FileStack,
  Mic,
  Wallet,
  Gauge,
  BookOpen,
  BarChart3,
  Globe,
  ImageIcon,
  Plug,
  ScrollText,
  Settings,
  Send,
  type LucideIcon,
} from "lucide-react";

/** Functional ops roles (ADR-002). Mirrors OPS_ROLES in @workspace/db. */
export type OpsRoleCode =
  | "program_lead"
  | "ops"
  | "recruiting"
  | "finance"
  | "growth"
  | "community"
  | "system";

/**
 * 사이드바 라벨은 **한국어만** 쓴다.
 *
 * 전에는 `발송 이력(Communications)` 처럼 영어를 괄호로 병기했다. 사이드바
 * 내용 폭이 ~180px 인데 그렇게 하면 29~34자가 되어 잘린다 — 실제로
 * `발송 이력(Communicatio...)` 과 `행사 / 모임(Events / Sess...)` 은 **읽을 수가
 * 없었다**(2026-08-25 확인). 잘린 라벨은 없는 라벨과 같다.
 *
 * 영어를 뗀 근거: 문서도 이 화면들을 한국어로 부르고(`발송 이력`, `활동 기록`),
 * 제품 화면 전체가 한국어다. 영어는 설계 문서에서 넘어온 흔적이지 사용자가
 * 찾는 이름이 아니었다.
 */
export const OPS_ROLE_LABELS: Record<OpsRoleCode, string> = {
  program_lead: "총괄",
  ops: "운영",
  recruiting: "모집/선발",
  finance: "회계/행정",
  growth: "성장경험",
  community: "커뮤니티",
  system: "시스템/데이터",
};

/** `program_lead` satisfies every check. Mirrors hasOpsRole() on the server. */
export function hasOpsRole(
  held: readonly string[] | null | undefined,
  code: OpsRoleCode,
): boolean {
  const list = held ?? [];
  return list.includes("program_lead") || list.includes(code);
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Restricted-read menu: hidden unless the viewer holds this ops role.
   * Cosmetic only — the server gate in requireOpsRole() is the real boundary.
   * Omitted = read-wide (visible to every admin).
   */
  requiredOpsRole?: OpsRoleCode;
  /**
   * 여럿 중 하나만 있으면 되는 경우. `communication_logs` 처럼 두 역할이 공동
   * 소유하는 화면에 쓴다 — 둘 다 무언가를 보내고, 보낸 것을 확인하는 것은
   * 보내는 일의 일부다. 서버의 requireAnyOpsRole() 과 짝이다.
   */
  requiredAnyOpsRole?: OpsRoleCode[];
  /**
   * Which counter from the ops-dashboard summary to show beside this item.
   * Badges are "currently open" counts, not an inbox — there is deliberately
   * no read state (design/05 §5.3), so no notifications table is needed.
   */
  badgeKey?: "tasks" | "teamSupport" | "finance";
};

export type NavSection = {
  /** Section title shown in the sidebar. Empty string = ungrouped (no header). */
  title: string;
  /** Stable key used for collapsed-state and React keys. */
  key: string;
  items: NavItem[];
};

/**
 * Admin navigation re-organized per the GrowthHub IA v2 baseline:
 * Home / Core / Ops / Growth / Content / System.
 *
 * W8 완료 후 이 목록에는 **빈 화면이 없다.** 전에는 IA를 전부 순회할 수 있게
 * `placeholder: true` 항목을 두고 안내 페이지를 렌더했는데, 그 자리들이 각각
 * 실체화되거나(미디어·면접·출석·리포트) 제거되었다(회원·공개페이지·외부연동·설정).
 * 제거 사유는 해당 위치의 주석에 남겨두었다 — 되살리려면 그 근거부터 뒤집어야 한다.
 *
 * 신규 항목을 추가할 때는 동작하는 화면과 함께 넣는다. 화면 없는 nav 항목은
 * 존재하지 않는 기능을 약속하는 것과 같다.
 */
export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    key: "home",
    items: [
      { href: "/admin", label: "홈", icon: LayoutDashboard },
    ],
  },
  {
    title: "Core · 코어",
    key: "core",
    items: [
      { href: "/admin/users", label: "사용자", icon: UserCog },
      { href: "/admin/people", label: "사람들 프로필", icon: UserSquare2 },
      { href: "/admin/roles", label: "역할 & 권한", icon: ShieldCheck },
      { href: "/admin/cohorts", label: "기수", icon: Users },
      { href: "/admin/programs", label: "프로그램", icon: FolderKanban },
      // W8 — `/admin/members` 제거. IA v2 트리에 Members 항목이 있으나, §7.2 매핑표는
      // `/admin/students`를 "Growth > Students 또는 Core > Members"로 적고 우선순위를
      // "위치 정리 필요"로 남겼다. 즉 요구는 신규 화면이 아니라 **중복 해소**였다.
      // 인물 단위 통합 디렉터리는 `/admin/people`이 이미 kind(mentor/staff/member)로
      // 제공하므로, Members를 만들면 사람 목록이 네 개(users·people·students·members)가 되어
      // 어느 것이 정본인지 더 흐려진다.
    ],
  },
  {
    title: "Ops · 운영",
    key: "ops",
    items: [
      { href: "/admin/meetings", label: "회의", icon: CalendarCheck },
      { href: "/admin/tasks", label: "작업", icon: CheckSquare, badgeKey: "tasks" },
      { href: "/admin/documents", label: "문서 & 템플릿", icon: FileStack },
      { href: "/admin/applications", label: "모집", icon: FileText, requiredOpsRole: "recruiting" },
      // Read-wide on purpose: this page lists mentor ACCOUNTS, not applicants.
      // Its mutations (create/update user) are gated on `system`, and the
      // per-application assignment routes on `recruiting`.
      { href: "/admin/evaluators", label: "평가 담당자", icon: UserCheck },
      { href: "/admin/interviews", label: "면접", icon: Mic, requiredOpsRole: "recruiting" },
      { href: "/admin/sessions", label: "행사 / 모임", icon: CalendarDays },
      // "출석"이 아니라 "출석 집계"다. 출석 입력은 모임 상세 안으로 들어갔고,
      // 이 화면은 기수 단위 집계 — 특정 모임에 속하지 않는 질문("3기 출석률은
      // 어떤가")에 답한다. 이름이 그냥 "출석"이면 모임과 별개 기능처럼 읽혀서
      // 입력하러 여기 들어왔다가 되돌아 나가게 된다.
      { href: "/admin/attendance", label: "출석 집계", icon: ClipboardList },
      { href: "/admin/assignments", label: "과제", icon: ClipboardList },
      { href: "/admin/announcements", label: "공지", icon: Megaphone },
      // 공지 바로 아래. 무엇을 보냈는지 확인하는 자리라 보내는 화면 옆이 맞다.
      { href: "/admin/communications", label: "발송 이력", icon: Send, requiredAnyOpsRole: ["recruiting", "community"] },
      { href: "/admin/finance", label: "재정", icon: Wallet, requiredOpsRole: "finance", badgeKey: "finance" },
      { href: "/admin/ops-dashboard", label: "운영 대시보드", icon: Gauge, badgeKey: "teamSupport" },
    ],
  },
  {
    title: "Growth · 성장",
    key: "growth",
    items: [
      { href: "/admin/students", label: "학생", icon: GraduationCap },
      { href: "/admin/projects", label: "프로젝트", icon: FolderKanban },
      { href: "/admin/studies", label: "스터디", icon: BookOpen },
      { href: "/admin/team-status", label: "팀 상태 보드", icon: LayoutGrid },
      { href: "/admin/activity-records", label: "활동 기록", icon: Activity },
      { href: "/admin/artifacts", label: "산출물", icon: Package },
      { href: "/admin/feedback", label: "피드백", icon: MessageSquare },
      { href: "/admin/tags", label: "태그", icon: Tags },
      { href: "/admin/reports", label: "리포트", icon: BarChart3 },
    ],
  },
  {
    title: "Content · 콘텐츠",
    key: "content",
    items: [
      { href: "/admin/site-content", label: "사이트 콘텐츠", icon: FileEdit },
      // W8 — `/admin/public-pages` 제거. 약속한 것(페이지 단위 게시/숨김, SEO 메타,
      // 미리보기 링크)은 전부 **스키마가 없다** — `site_contents`는 키→본문 맵이고
      // 게시 상태나 메타 필드를 담지 않는다. 데이터 모델 없이 화면만 두면 없는 기능을
      // 약속하는 자리가 된다. 본문 편집이라는 현재 필요는 `/admin/site-content`가 충족한다.
      // 되살릴 때는 `site_contents` 확장(게시 상태·메타)과 같은 변경에서.
      { href: "/admin/media", label: "미디어 / 링크", icon: ImageIcon },
    ],
  },
  {
    title: "System · 시스템",
    key: "system",
    items: [
      // W8 — `/admin/integrations` 제거. design/04 §8이 자동 sync(`sync_logs`,
      // `integration_accounts`)를 **명시적 비목표**로 못박았고, baseline 외부연계는
      // "링크 기반 우선, API 연동은 필요성이 검증된 뒤"라고 정했다. 연동 *상태* 화면은
      // 그 상태를 만들어낼 sync 계층이 있어야 성립하는데 그 계층을 안 만들기로 한 것이다.
      // `/admin/reflections`가 ADR-001과 충돌해 제거된 것과 같은 형태다.
      // 링크 기반 연동의 실체는 `external_links`이고 화면은 `/admin/media`에 있다.
      {
        href: "/admin/audit-logs",
        label: "감사 로그",
        icon: ScrollText,
        requiredOpsRole: "system",
      },
      // W8 — `/admin/settings` 제거. 두 가지 이유다.
      // ① 약속한 항목(부트스트랩 관리자, 시스템 환경)은 `SESSION_SECRET`·`ADMIN_EMAIL`
      //    같은 환경변수이며, 이를 UI로 노출하는 것은 보안 후퇴다.
      // ② "기본 가시성 정책"을 런타임에 조정 가능하게 만드는 것은 이 설계의 핵심 전제를
      //    깨뜨린다 — ADR-001은 가시성을 UI 문구가 아니라 **구조**로 보장한다고 정했고,
      //    구조를 화면에서 바꿀 수 있으면 그 보장이 사라진다.
      // 알림 채널은 이미 환경변수이며 미설정 시 조용히 꺼지도록 W10에서 처리했다.
    ],
  },
];

/**
 * Sections with restricted-read items removed for this viewer.
 * Sections left with no items are dropped entirely.
 */
export function visibleNavSections(
  opsRoles: readonly string[] | null | undefined,
): NavSection[] {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        (!item.requiredOpsRole || hasOpsRole(opsRoles, item.requiredOpsRole)) &&
        (!item.requiredAnyOpsRole ||
          item.requiredAnyOpsRole.some((c) => hasOpsRole(opsRoles, c))),
    ),
  })).filter((section) => section.items.length > 0);
}

