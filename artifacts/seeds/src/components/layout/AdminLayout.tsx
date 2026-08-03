import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import {
  Loader2,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";
import { visibleNavSections, type NavSection } from "@/lib/admin-nav";

function isActive(currentPath: string, href: string): boolean {
  if (href === "/admin") return currentPath === "/admin";
  return currentPath === href || currentPath.startsWith(href + "/");
}

function sectionHasActive(section: NavSection, currentPath: string): boolean {
  return section.items.some((item) => isActive(currentPath, item.href));
}

type BadgeCounts = { tasks: number; teamSupport: number; finance: number };

function SidebarContent({
  currentPath,
  opsRoles,
  badges,
  onNavigate,
}: {
  currentPath: string;
  /** Restricted-read menus are hidden unless the viewer holds the role. */
  opsRoles: readonly string[];
  badges: BadgeCounts;
  onNavigate?: () => void;
}) {
  const sections = useMemo(() => visibleNavSections(opsRoles), [opsRoles]);
  // Track collapsed/expanded state per section; default = expanded if active item lives inside.
  const initialExpanded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const section of sections) {
      // Home section (no title) is always shown.
      if (!section.title) {
        map[section.key] = true;
        continue;
      }
      map[section.key] = sectionHasActive(section, currentPath);
    }
    return map;
  }, [currentPath, sections]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(initialExpanded);

  // When route changes, auto-open the matching section without collapsing others the user opened.
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (!section.title) continue;
        if (sectionHasActive(section, currentPath)) next[section.key] = true;
      }
      return next;
    });
  }, [currentPath, sections]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-5">
      {sections.map((section) => {
        const isOpen = expanded[section.key];
        const hasTitle = Boolean(section.title);
        return (
          <div key={section.key}>
            {hasTitle ? (
              <button
                type="button"
                onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between px-3 mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold hover:text-foreground transition-colors"
                aria-expanded={isOpen}
              >
                <span>{section.title}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>
            ) : null}
            {!hasTitle || isOpen ? (
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
                        data-testid={`admin-nav-${item.href.replace(/\//g, "-")}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.badgeKey && badges[item.badgeKey] > 0 ? (
                          <span
                            className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                            aria-label={`${badges[item.badgeKey]}건 처리 필요`}
                          >
                            {badges[item.badgeKey] > 99 ? "99+" : badges[item.badgeKey]}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
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
  const opsRoles = admin?.opsRoles ?? [];

  // Badges reuse the ops-dashboard aggregate rather than adding a notifications
  // table (design/05 §5.3). They show what is currently OPEN, not unread.
  const { data: summary } = useQuery({
    queryKey: ["admin-nav-badges"],
    queryFn: () =>
      api<{
        overdueTasks: unknown[];
        blockedTasks: unknown[];
        teamSupport: { openCount: number };
        finance: { hooks: { pendingCount: number } };
      }>("/admin/ops-dashboard/summary"),
    enabled: allowed,
    staleTime: 60_000,
    retry: false,
  });

  const badges = {
    tasks: (summary?.overdueTasks.length ?? 0) + (summary?.blockedTasks.length ?? 0),
    teamSupport: summary?.teamSupport.openCount ?? 0,
    finance: summary?.finance.hooks.pendingCount ?? 0,
  };

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
        <SidebarContent currentPath={location} opsRoles={opsRoles} badges={badges} />
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
              opsRoles={opsRoles}
              badges={badges}
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
