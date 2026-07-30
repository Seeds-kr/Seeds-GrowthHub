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
   * Which counter from the ops-dashboard summary to show beside this item.
   * Badges are "currently open" counts, not an inbox — there is deliberately
   * no read state (design/05 §5.3), so no notifications table is needed.
   */
  badgeKey?: "tasks" | "teamSupport" | "finance";
  /** If true, page is a placeholder (not-yet-implemented feature). */
  placeholder?: boolean;
  /** Short description used by placeholder pages. */
  description?: string;
  /** Scope/future plan shown on placeholder pages. */
  futureScope?: string;
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
 * Existing routes are preserved as-is. Items marked `placeholder: true`
 * point to not-yet-implemented features and are rendered as informational
 * placeholder pages so the IA is fully navigable.
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
      { href: "/admin/users", label: "사용자(Users)", icon: UserCog },
      { href: "/admin/people", label: "사람들 프로필", icon: UserSquare2 },
      { href: "/admin/roles", label: "역할 & 권한", icon: ShieldCheck },
      { href: "/admin/cohorts", label: "기수(Cohorts)", icon: Users },
      { href: "/admin/programs", label: "프로그램(Programs)", icon: FolderKanban },
      {
        href: "/admin/members",
        label: "회원(Members)",
        icon: Users,
        placeholder: true,
        description: "동아리 회원(Members) 명부 — 학생·멘토·운영진을 통합한 사람 단위 목록입니다.",
        futureScope: "현재는 people_profiles(/admin/people)와 학생(/admin/students)으로 분리되어 있습니다. 통합 회원 명부와 회원 카드(연락처·소속·태그·소속 기수) 통합 화면을 제공할 예정입니다.",
      },
    ],
  },
  {
    title: "Ops · 운영",
    key: "ops",
    items: [
      { href: "/admin/meetings", label: "회의(Meetings)", icon: CalendarCheck },
      { href: "/admin/tasks", label: "작업(Tasks / Action Items)", icon: CheckSquare, badgeKey: "tasks" },
      { href: "/admin/documents", label: "문서 & 템플릿", icon: FileStack },
      { href: "/admin/applications", label: "모집(Recruitment)", icon: FileText, requiredOpsRole: "recruiting" },
      // Read-wide on purpose: this page lists mentor ACCOUNTS, not applicants.
      // Its mutations (create/update user) are gated on `system`, and the
      // per-application assignment routes on `recruiting`.
      { href: "/admin/evaluators", label: "평가 담당자(Evaluations)", icon: UserCheck },
      {
        href: "/admin/interviews",
        label: "면접(Interviews)",
        icon: Mic,
        placeholder: true,
        requiredOpsRole: "recruiting",
        description: "면접 일정·결과 통합 관리 화면입니다.",
        futureScope: "현재 면접 결과는 지원서 상세(/admin/applications/:id)에서 입력합니다. 일정·면접관 캘린더 뷰와 결과 일괄 조회 화면을 추가할 예정입니다.",
      },
      { href: "/admin/sessions", label: "행사 / 모임(Events / Sessions)", icon: CalendarDays },
      {
        href: "/admin/attendance",
        label: "출석(Attendance)",
        icon: ClipboardList,
        placeholder: true,
        description: "기수·프로그램 단위 출석 통계와 검색 화면입니다.",
        futureScope: "현재 출석은 세션별(/admin/sessions/:id/attendance)로 관리됩니다. 학생별 출석률·결석 알림 등 집계 화면을 제공할 예정입니다.",
      },
      { href: "/admin/assignments", label: "과제(Assignments)", icon: ClipboardList },
      { href: "/admin/announcements", label: "공지(Announcements)", icon: Megaphone },
      { href: "/admin/finance", label: "재정(Finance)", icon: Wallet, requiredOpsRole: "finance", badgeKey: "finance" },
      { href: "/admin/ops-dashboard", label: "운영 대시보드", icon: Gauge, badgeKey: "teamSupport" },
    ],
  },
  {
    title: "Growth · 성장",
    key: "growth",
    items: [
      { href: "/admin/students", label: "학생(Students)", icon: GraduationCap },
      { href: "/admin/projects", label: "프로젝트(Projects)", icon: FolderKanban },
      { href: "/admin/studies", label: "스터디(Studies)", icon: BookOpen },
      { href: "/admin/team-status", label: "팀 상태 보드", icon: LayoutGrid },
      { href: "/admin/activity-records", label: "활동 기록(Activity Records)", icon: Activity },
      { href: "/admin/artifacts", label: "산출물(Artifacts)", icon: Package },
      { href: "/admin/feedback", label: "피드백(Feedback)", icon: MessageSquare },
      { href: "/admin/tags", label: "태그(Tags)", icon: Tags },
      {
        href: "/admin/reports",
        label: "리포트(Reports)",
        icon: BarChart3,
        placeholder: true,
        description: "학생·기수 단위 활동 리포트 인덱스. 현재는 학생 상세에서 개별적으로 접근합니다.",
        futureScope: "학생 리포트(/admin/students/:id/report)와 기수 요약(/admin/cohorts/:id/summary)을 한 자리에서 탐색·내보내기할 수 있도록 통합합니다.",
      },
    ],
  },
  {
    title: "Content · 콘텐츠",
    key: "content",
    items: [
      { href: "/admin/site-content", label: "사이트 콘텐츠", icon: FileEdit },
      {
        href: "/admin/public-pages",
        label: "공개 페이지",
        icon: Globe,
        placeholder: true,
        description: "공개 페이지(/, /about, /program, /faq, /recruit) 메타 정보와 노출 상태를 관리하는 자리입니다.",
        futureScope: "현재는 site-content 키 기반으로 본문만 편집됩니다. 페이지 단위 게시/숨김, SEO 메타, 미리보기 링크 등을 추가할 예정입니다.",
      },
      {
        href: "/admin/media",
        label: "미디어 / 링크",
        icon: ImageIcon,
        placeholder: true,
        description: "이미지·문서 등 업로드된 미디어와 외부 링크(external_links)를 한곳에서 관리합니다.",
        futureScope: "object storage에 업로드된 자산 목록 + external_links 테이블 도입 후 통합 인덱스를 제공합니다.",
      },
    ],
  },
  {
    title: "System · 시스템",
    key: "system",
    items: [
      {
        href: "/admin/integrations",
        label: "외부 연동(Integrations)",
        icon: Plug,
        placeholder: true,
        description: "GitHub·Discord·Google Drive·Calendar·이메일 등 외부 도구 연동 상태와 링크 매핑을 관리합니다.",
        futureScope: "외부 도구 연계 설계 문서에 따라 링크 기반 연동을 우선 도입하고, API 연동은 운영이 안정화된 뒤 검토합니다.",
      },
      {
        href: "/admin/audit-logs",
        label: "감사 로그(Audit Logs)",
        icon: ScrollText,
        requiredOpsRole: "system",
      },
      {
        href: "/admin/settings",
        label: "설정(Settings)",
        icon: Settings,
        placeholder: true,
        description: "플랫폼 전역 설정 — 부트스트랩 관리자, 시스템 환경, 알림 채널, 기본 가시성 정책 등을 관리하는 자리입니다.",
        futureScope: "현재 설정은 환경변수(SESSION_SECRET, ADMIN_EMAIL 등)에 의존합니다. UI에서 조정 가능한 항목을 단계적으로 노출합니다.",
      },
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
      (item) => !item.requiredOpsRole || hasOpsRole(opsRoles, item.requiredOpsRole),
    ),
  })).filter((section) => section.items.length > 0);
}

/** Flattened list of placeholder items — used by App.tsx to register routes. */
export const ADMIN_PLACEHOLDER_ITEMS: NavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  (section) => section.items.filter((item) => item.placeholder),
);

/** Lookup placeholder metadata by href, used by the shared placeholder page. */
export function findPlaceholderItem(href: string): NavItem | undefined {
  return ADMIN_PLACEHOLDER_ITEMS.find((item) => item.href === href);
}
