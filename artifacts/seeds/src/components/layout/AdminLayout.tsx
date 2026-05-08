import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: admin, isLoading, isError } = useAdminMe({
    query: {
      retry: false,
      queryKey: getAdminMeQueryKey(),
    },
  });
  const logout = useAdminLogout();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !admin) {
      setLocation("/admin/login");
    } else if (admin.role === "evaluator") {
      setLocation("/evaluator");
    } else if (admin.role === "student") {
      setLocation("/student");
    }
  }, [isLoading, isError, admin, setLocation]);

  if (isLoading || isError || !admin || admin.role !== "admin") {
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
            <Link href="/admin" className="font-serif text-lg font-bold text-primary">
              Seeds Admin
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary">
                대시보드
              </Link>
              <Link href="/admin/applications" className="text-sm font-medium text-muted-foreground hover:text-primary">
                지원서
              </Link>
              <Link href="/admin/students" className="text-sm font-medium text-muted-foreground hover:text-primary">
                학생
              </Link>
              <Link href="/admin/cohorts" className="text-sm font-medium text-muted-foreground hover:text-primary">
                기수
              </Link>
              <Link href="/admin/programs" className="text-sm font-medium text-muted-foreground hover:text-primary">
                프로그램
              </Link>
              <Link href="/admin/sessions" className="text-sm font-medium text-muted-foreground hover:text-primary">
                세션
              </Link>
              <Link href="/admin/assignments" className="text-sm font-medium text-muted-foreground hover:text-primary">
                과제
              </Link>
              <Link href="/admin/announcements" className="text-sm font-medium text-muted-foreground hover:text-primary">
                공지
              </Link>
              <Link href="/admin/activity-records" className="text-sm font-medium text-muted-foreground hover:text-primary">
                활동기록
              </Link>
              <Link href="/admin/projects" className="text-sm font-medium text-muted-foreground hover:text-primary">
                프로젝트
              </Link>
              <Link href="/admin/artifacts" className="text-sm font-medium text-muted-foreground hover:text-primary">
                아티팩트
              </Link>
              <Link href="/admin/feedback" className="text-sm font-medium text-muted-foreground hover:text-primary">
                피드백
              </Link>
              <Link href="/admin/tags" className="text-sm font-medium text-muted-foreground hover:text-primary">
                태그
              </Link>
              <Link href="/admin/evaluators" className="text-sm font-medium text-muted-foreground hover:text-primary">
                평가자
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{admin.email}</span>
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
