import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export function EvaluatorLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const logout = useAdminLogout();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !me) {
      setLocation("/admin/login");
    } else if (me.role !== "evaluator") {
      setLocation("/admin");
    }
  }, [isLoading, isError, me, setLocation]);

  if (isLoading || isError || !me || me.role !== "evaluator") {
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
        setLocation("/admin/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/10">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/evaluator" className="font-serif text-lg font-bold text-primary">
              Seeds 평가자
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/evaluator" className="text-sm font-medium text-muted-foreground hover:text-primary">
                내 배정 목록
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
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
