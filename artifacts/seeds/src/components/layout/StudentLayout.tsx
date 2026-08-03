import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout, getAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";
import { MobileNav } from "./MobileNav";

/** 데스크톱 헤더와 모바일 드로어가 같은 목록을 쓴다 — 갈라지면 폰에서만
 *  빠지는 메뉴가 생긴다. */
const STUDENT_NAV = [
  { href: "/student", label: "대시보드" },
  { href: "/student/sessions", label: "모임" },
  { href: "/student/assignments", label: "과제" },
  { href: "/student/announcements", label: "공지사항" },
  { href: "/student/attendance", label: "출석" },
  { href: "/student/timeline", label: "타임라인" },
  { href: "/student/projects", label: "프로젝트" },
  { href: "/student/studies", label: "스터디" },
  { href: "/student/artifacts", label: "아티팩트" },
  { href: "/student/reflections", label: "회고" },
  { href: "/student/feedback", label: "피드백" },
  { href: "/student/report", label: "리포트" },
  { href: "/student/profile", label: "내 프로필" },
];

export function StudentLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const logout = useAdminLogout();

  const roles = me ? effectiveRoles(me) : [];
  const allowed = roles.includes("student");

  useEffect(() => {
    if (isLoading) return;
    if (isError || !me) {
      setLocation("/login");
      return;
    }
    if (!allowed) {
      setLocation(pickRedirectFor(effectiveRoles(me)));
    }
  }, [isLoading, isError, me, allowed, setLocation]);

  if (isLoading || isError || !me || !allowed) {
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
    <div className="min-h-[100dvh] flex flex-col bg-muted/10">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/student" className="font-serif text-lg font-bold text-primary">Seeds 학생</Link>
            {/* lg 기준이다. 13개를 768px에 한 줄로 넣으면 눌러지지 않을 만큼
                좁아져서, 그 구간은 MobileNav가 맡는다. */}
            <nav className="hidden lg:flex items-center gap-6">
              {STUDENT_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <RoleSwitcher roles={roles} current="student" />
            {/* 이메일은 폰에서 숨긴다 — 헤더 폭을 가장 많이 먹으면서
                정보 가치는 가장 낮다. 드로어 하단에 그대로 나온다. */}
            <span className="hidden md:inline text-sm text-muted-foreground">{me.email}</span>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={handleLogout}
              disabled={logout.isPending}
            >
              {logout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              로그아웃
            </Button>
            <MobileNav
              items={STUDENT_NAV}
              title="Seeds 학생"
              breakpoint="lg"
              footer={
                <div className="space-y-2">
                  <p className="px-3 text-xs text-muted-foreground break-all">{me.email}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleLogout}
                    disabled={logout.isPending}
                  >
                    {logout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    로그아웃
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
