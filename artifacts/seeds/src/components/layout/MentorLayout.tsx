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
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";
import { isActive } from "./nav-active";
import { useDocumentTitle } from "@/lib/document-title";

/** 데스크톱 헤더와 모바일 드로어가 같은 목록을 쓴다. */
const MENTOR_NAV = [
  { href: "/mentor", label: "홈" },
  { href: "/mentor/teams", label: "담당 팀" },
  { href: "/mentor/feedback", label: "내 피드백" },
  { href: "/mentor/profile", label: "내 프로필" },
];
// `/people` 과 `/evaluator` 를 뺐다. 둘 다 멘토 셸 밖이라 누르면 헤더가 통째로
// 바뀌고 — /people 은 공개 사이트 헤더라 로그인한 멘토에게 "로그인·지원하기"가
// 뜬다 — 멘토 화면으로 돌아올 링크가 하나도 없었다. 헤더에 있으면 "여기 안의
// 화면"으로 읽히는데 실제로는 나가는 문이었다.
//
// 둘 다 대시보드에 카드로 이미 있으므로 닿는 길이 사라지지는 않는다. 나가는
// 쪽에는 돌아올 길을 따로 만들었다(EvaluatorLayout · PublicLayout).

export function MentorLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const reduce = useReducedMotion();
  // 네비 라벨을 그대로 제목에 쓴다. 상세 화면처럼 네비에 없는 경로는
  // 영역 이름으로 떨어진다 — "Seeds" 하나보다는 어디인지 알 수 있다.
  useDocumentTitle(MENTOR_NAV.find((i) => isActive(location, i.href))?.label ?? "멘토");
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
            {/* lg 인 것은 학생 화면과 같은 이유다. md(768px)에서 펴면 로고+내비+역할
                스위처+이메일+로그아웃이 한 줄에 안 들어가 헤더가 두 줄이 된다.
                실측 필요 폭이 ~1100px 이라 그 사이는 MobileNav 가 맡는다. */}
            <nav className="hidden lg:flex items-center gap-6">
              {MENTOR_NAV.map((item) => {
                const on = isActive(location, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={`relative py-1 text-sm font-medium transition-colors ${
                      on ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {item.label}
                    {/* 현재 항목의 밑줄이 항목 사이를 미끄러진다 — 공개 화면과 같은
                        방식이다. 어디에서 어디로 옮겨왔는지가 보인다. */}
                    {on ? (
                      <motion.span
                        layoutId="mentor-nav-underline"
                        className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <RoleSwitcher roles={roles} current="mentor" />
            <span className="hidden lg:inline text-sm text-muted-foreground">{me.name} ({me.email})</span>
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
              breakpoint="lg"
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
