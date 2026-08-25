import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";
import { isActive } from "./nav-active";

export function EvaluatorLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const logout = useAdminLogout();

  const roles = me ? effectiveRoles(me) : [];
  // The evaluator role was removed; evaluation work is performed by any admin
  // or mentor that has been assigned to an application.
  const allowed = roles.includes("admin") || roles.includes("mentor");
  // RoleSwitcher needs a known role for `current`; show as mentor if the user
  // has it, otherwise admin. Either way the switcher only renders OTHER roles.
  const switcherCurrent: "admin" | "mentor" = roles.includes("mentor")
    ? "mentor"
    : "admin";

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
            <Link href="/evaluator" className="flex items-center gap-2 font-serif text-lg font-bold text-primary"><BrandMark size={24} />Seeds 평가</Link>
            <nav className="hidden md:flex items-center gap-6">
              {/* 메뉴가 하나뿐이라 미끄러지는 밑줄은 의미가 없다(옮겨갈 자리가
                  없다). 대신 지금 그 화면이라는 것만 표시한다. 아래 두 링크는
                  이 표면을 **나가는** 것이라 활성 대상이 아니다. */}
              <Link
                href="/evaluator"
                aria-current={isActive(location, "/evaluator") ? "page" : undefined}
                className={`text-sm font-medium transition-colors ${
                  isActive(location, "/evaluator")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                내 배정 목록
              </Link>
              {/* 평가는 역할이 아니라 배정 기반 표면이라(설계 00 §3.5) 여기 온
                  사람은 원래 멘토이거나 운영진이다. 그런데 이 헤더에는 원래
                  자리로 돌아갈 링크가 없어서, 멘토가 대시보드 카드로 들어오면
                  뒤로 가기 말고는 나갈 방법이 없었다. */}
              {roles.includes("mentor") && (
                <Link href="/mentor" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  ← 멘토 화면
                </Link>
              )}
              {roles.includes("admin") && (
                <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  ← 운영 화면
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <RoleSwitcher roles={roles} current={switcherCurrent} />
            <span className="text-sm text-muted-foreground">{me.name} ({me.email})</span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
              {logout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              로그아웃
            </Button>
          </div>
        </div>
      </header>
      <motion.main
        key={location}
        className="flex-1 container mx-auto px-4 py-8"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>
    </div>
  );
}
