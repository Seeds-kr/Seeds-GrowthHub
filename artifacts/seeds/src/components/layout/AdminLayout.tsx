import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import {
  Loader2,
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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    items: [{ href: "/admin", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    title: "모집",
    items: [
      { href: "/admin/applications", label: "지원서", icon: FileText },
      { href: "/admin/evaluators", label: "평가위원", icon: UserCheck },
    ],
  },
  {
    title: "기수 운영",
    items: [
      { href: "/admin/cohorts", label: "기수", icon: Users },
      { href: "/admin/programs", label: "프로그램", icon: FolderKanban },
      { href: "/admin/students", label: "학생", icon: GraduationCap },
      { href: "/admin/sessions", label: "모임", icon: CalendarDays },
      { href: "/admin/assignments", label: "과제", icon: ClipboardList },
      { href: "/admin/announcements", label: "공지", icon: Megaphone },
    ],
  },
  {
    title: "활동 기록",
    items: [
      { href: "/admin/activity-records", label: "활동 기록", icon: Activity },
      { href: "/admin/projects", label: "프로젝트", icon: FolderKanban },
      { href: "/admin/artifacts", label: "아티팩트", icon: Package },
      { href: "/admin/feedback", label: "피드백", icon: MessageSquare },
      { href: "/admin/tags", label: "태그", icon: Tags },
    ],
  },
  {
    title: "사이트",
    items: [
      { href: "/admin/site-content", label: "홈페이지 콘텐츠", icon: FileEdit },
      { href: "/admin/people", label: "사람들", icon: UserSquare2 },
    ],
  },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/admin") return currentPath === "/admin";
  return currentPath === href || currentPath.startsWith(href + "/");
}

function SidebarContent({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-7">
      {NAV_SECTIONS.map((section, idx) => (
        <div key={idx}>
          {section.title ? (
            <div className="px-3 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              {section.title}
            </div>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(currentPath, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: admin, isLoading, isError } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const logout = useAdminLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = admin ? effectiveRoles(admin) : [];
  const allowed = roles.includes("admin");

  useEffect(() => {
    if (isLoading) return;
    if (isError || !admin) {
      setLocation("/login");
      return;
    }
    if (!allowed) {
      setLocation(pickRedirectFor(effectiveRoles(admin)));
    }
  }, [isLoading, isError, admin, allowed, setLocation]);

  if (isLoading || isError || !admin || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminMeQueryKey() });
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-card z-40">
        <div className="h-16 px-6 flex items-center border-b border-border">
          <Link href="/admin" className="text-lg font-bold text-primary tracking-tight">
            Seeds <span className="text-muted-foreground font-normal">Admin</span>
          </Link>
        </div>
        <SidebarContent currentPath={location} />
        <div className="border-t border-border p-3 space-y-2">
          <div className="px-3 py-1">
            <div className="text-xs text-muted-foreground">로그인 계정</div>
            <div className="text-sm font-medium truncate" title={admin.email}>
              {admin.email}
            </div>
          </div>
          <RoleSwitcher roles={roles} current="admin" />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            {logout.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 h-14 px-4 flex items-center justify-between bg-card border-b border-border">
        <Link href="/admin" className="text-base font-bold text-primary">
          Seeds <span className="text-muted-foreground font-normal">Admin</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-card border-r border-border">
            <div className="h-14 px-4 flex items-center justify-between border-b border-border">
              <span className="text-base font-bold text-primary">Seeds Admin</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 -mr-2"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent
              currentPath={location}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="border-t border-border p-3 space-y-2">
              <div className="px-3 py-1">
                <div className="text-xs text-muted-foreground">로그인 계정</div>
                <div className="text-sm font-medium truncate">{admin.email}</div>
              </div>
              <RoleSwitcher roles={roles} current="admin" />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
