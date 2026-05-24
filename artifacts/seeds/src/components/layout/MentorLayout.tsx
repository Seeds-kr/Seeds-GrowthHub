import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { RoleSwitcher, effectiveRoles, pickRedirectFor } from "./RoleSwitcher";

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
            <Link href="/mentor" className="font-serif text-lg font-bold text-primary">Seeds 멘토</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/mentor" className="text-sm font-medium text-muted-foreground hover:text-primary">홈</Link>
              <Link href="/mentor/profile" className="text-sm font-medium text-muted-foreground hover:text-primary">내 프로필</Link>
              <Link href="/people" className="text-sm font-medium text-muted-foreground hover:text-primary">회원 디렉터리</Link>
              <Link href="/evaluator" className="text-sm font-medium text-muted-foreground hover:text-primary">평가 배정</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <RoleSwitcher roles={roles} current="mentor" />
            <span className="text-sm text-muted-foreground">{me.name} ({me.email})</span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
              {logout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              로그아웃
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
