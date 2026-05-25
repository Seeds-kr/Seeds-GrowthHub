import {
  LayoutDashboard,
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
  NotebookPen,
  BarChart3,
  Globe,
  ImageIcon,
  Plug,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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
      {
        href: "/admin/users",
        label: "사용자(Users)",
        icon: UserCog,
        placeholder: true,
        description: "플랫폼 계정 단위로 사용자(Users)를 관리합니다. 계정 생성·비활성화, 기본/추가 역할(extra_roles) 부여, 활성화 토큰 재발급 등이 모일 자리입니다.",
        futureScope: "현재는 학생 화면(/admin/students/:id)과 합격자 전환 흐름에서 분산되어 있는 사용자 관리 기능을 한 화면으로 모읍니다.",
      },
      { href: "/admin/people", label: "사람들 프로필", icon: UserSquare2 },
      {
        href: "/admin/roles",
        label: "역할 & 권한",
        icon: ShieldCheck,
        placeholder: true,
        description: "역할 코드(admin/mentor/student)와 추가 역할(extra_roles), 향후 도입 검토 중인 scope 기반 권한(role_assignments)을 관리할 자리입니다.",
        futureScope: "현재 권한 모델은 단일 role + extra_roles 배열입니다. 운영진 세부 역할(모집장·재정장 등) 분리 요구가 발생하면 scope 기반 모델로 확장합니다.",
      },
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
      { href: "/admin/tasks", label: "작업(Tasks / Action Items)", icon: CheckSquare },
      {
        href: "/admin/documents",
        label: "문서 & 템플릿",
        icon: FileStack,
        placeholder: true,
        description: "운영 문서와 템플릿 — Markdown 기반의 운영 가이드, 체크리스트, 회의록 템플릿 등을 보관하는 자리입니다.",
        futureScope: "documents + document_versions 테이블로 버전 관리, is_template 플래그로 템플릿 복제, 객체 연결(linked_object) 지원 예정.",
      },
      { href: "/admin/applications", label: "모집(Recruitment)", icon: FileText },
      { href: "/admin/evaluators", label: "평가 담당자(Evaluations)", icon: UserCheck },
      {
        href: "/admin/interviews",
        label: "면접(Interviews)",
        icon: Mic,
        placeholder: true,
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
      {
        href: "/admin/finance",
        label: "재정(Finance)",
        icon: Wallet,
        placeholder: true,
        description: "동아리 회계 — 수입/지출 기록, 영수증 첨부, 승인 흐름을 관리합니다.",
        futureScope: "finance_records + attachments 테이블 도입 예정. 권한 분리(재정 담당자 역할), 영수증 ACL 게이팅 필요.",
      },
      {
        href: "/admin/ops-dashboard",
        label: "운영 대시보드",
        icon: Gauge,
        placeholder: true,
        description: "운영 전체 현황 대시보드 — 지연된 작업, 진행 중 모집, 임박한 행사, 미처리 회계, 문서/팀 지원 요청을 한눈에 봅니다.",
        futureScope: "Meetings·Tasks·Finance·Documents 구현 후 영역별 위젯을 단계적으로 추가합니다.",
      },
    ],
  },
  {
    title: "Growth · 성장",
    key: "growth",
    items: [
      { href: "/admin/students", label: "학생(Students)", icon: GraduationCap },
      { href: "/admin/projects", label: "프로젝트(Projects)", icon: FolderKanban },
      {
        href: "/admin/studies",
        label: "스터디(Studies)",
        icon: BookOpen,
        placeholder: true,
        description: "학생 주도 스터디 그룹 — 모임 단위로 학습 주제·구성원·산출물을 기록합니다.",
        futureScope: "studies + study_members 테이블 도입 예정. 프로젝트(projects)와 유사한 라이프사이클을 따르되 가벼운 운영을 지향합니다.",
      },
      { href: "/admin/activity-records", label: "활동 기록(Activity Records)", icon: Activity },
      { href: "/admin/artifacts", label: "산출물(Artifacts)", icon: Package },
      { href: "/admin/feedback", label: "피드백(Feedback)", icon: MessageSquare },
      {
        href: "/admin/reflections",
        label: "회고(Reflections)",
        icon: NotebookPen,
        placeholder: true,
        description: "학생 회고록 — 주차별/프로젝트별 회고와 멘토·운영진의 코멘트가 모이는 자리입니다.",
        futureScope: "reflections 테이블 도입 예정. 가시성 정책(private / mentor_visible / student_visible 등) 합의 후 진행합니다.",
      },
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
        placeholder: true,
        description: "민감 작업(권한 변경, 회계 승인, 가시성 변경 등) 감사 로그를 조회합니다.",
        futureScope: "현재는 decision_logs(최종 합격 결정 변경)만 append-only로 기록됩니다. audit_logs 테이블 도입 후 확장합니다.",
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

/** Flattened list of placeholder items — used by App.tsx to register routes. */
export const ADMIN_PLACEHOLDER_ITEMS: NavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  (section) => section.items.filter((item) => item.placeholder),
);

/** Lookup placeholder metadata by href, used by the shared placeholder page. */
export function findPlaceholderItem(href: string): NavItem | undefined {
  return ADMIN_PLACEHOLDER_ITEMS.find((item) => item.href === href);
}
