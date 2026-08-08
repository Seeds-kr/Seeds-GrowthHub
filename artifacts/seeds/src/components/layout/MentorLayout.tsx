import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";
import { MobileNav } from "./MobileNav";
import { BrandMark } from "@/components/BrandMark";

/** 데스크톱 헤더와 모바일 드로어가 같은 목록을 쓴다. */
const MENTOR_NAV = [
  { href: "/mentor", label: "홈" },
  { href: "/mentor/teams", label: "담당 팀" },
  { href: "/mentor/feedback", label: "내 피드백" },
  { href: "/mentor/profile", label: "내 프로필" },
  { href: "/people", label: "회원 디렉터리" },
  { href: "/evaluator", label: "평가 배정" },
];

export function MentorLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const logout = useAdminLogout();

  const roles = me ? effectiveRoles(me) : [];
  const allowed = roles.includes("mentor");

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
            <Link href="/mentor" className="flex items-center gap-2 font-serif text-lg font-bold text-primary"><BrandMark size={24} />Seeds 멘토</Link>
            <nav className="hidden md:flex items-center gap-6">
              {MENTOR_NAV.map((item) => (
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
          <div className="flex items-center gap-4">
            <RoleSwitcher roles={roles} current="mentor" />
            <span className="hidden md:inline text-sm text-muted-foreground">{me.name} ({me.email})</span>
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
              items={MENTOR_NAV}
              title="Seeds 멘토"
              footer={
                <div className="space-y-2">
                  <p className="px-3 text-xs text-muted-foreground break-all">
                    {me.name} ({me.email})
                  </p>
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
