import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { Magnetic } from "@/lib/motion";
import { BrandMark } from "@/components/BrandMark";
import { CursorGlow } from "@/components/CursorGlow";
import { useAdminMe, getAdminMeQueryKey } from "@workspace/api-client-react";
import { effectiveRoles, pickRedirectFor } from "./RoleSwitcher";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  /**
   * 공개 사이트는 비로그인 방문자용이지만, 로그인한 사람도 여기로 온다 —
   * `/people`(회원 디렉터리)이 공개 라우트라 멘토·학생이 그 링크를 따라오면
   * 이 헤더를 만난다. 그때 "로그인 / 지원하기"가 뜨면 이미 들어와 있는 사람에게
   * 다시 들어오라고 하는 셈이고, 자기 화면으로 돌아갈 길도 없다.
   *
   * 실패는 조용히 넘긴다. 비로그인 방문자에게 401 은 정상이고, 그 경우 아래
   * 로직이 그대로 원래 버튼을 그린다.
   */
  const { data: me } = useAdminMe({
    query: { retry: false, queryKey: getAdminMeQueryKey() },
  });
  const myHome = me ? pickRedirectFor(effectiveRoles(me)) : null;

  // 스크롤하면 헤더가 얇아지고 그림자가 생긴다. 페이지 맨 위인지 아닌지를
  // 알려주는 신호이자, 본문이 헤더 아래로 지나간다는 걸 보여주는 깊이 단서다.
  // `useScroll` 을 쓰는 이유는 스크롤 이벤트를 직접 걸면 매 프레임 리렌더가
  // 나기 때문이다. 여기서는 임계값을 넘는 순간에만 상태가 바뀐다.
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 12;
    setScrolled((prev) => (prev === next ? prev : next));
  });

  const navItems = [
    { label: "소개", href: "/about" },
    { label: "프로그램", href: "/program" },
    { label: "사람들", href: "/people" },
    { label: "모집", href: "/recruit" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* 공개 표면에만 깐다. 어드민·학생 화면은 표를 읽고 값을 넣는 자리라
          커서를 따라다니는 빛이 방해가 된다. */}
      <CursorGlow />
      <header
        className={`sticky top-0 z-50 w-full overflow-hidden border-b bg-background/80 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 ${
          scrolled
            ? "border-border shadow-[0_1px_20px_-8px_hsl(var(--foreground)/0.28)]"
            : "border-transparent"
        }`}
      >
        {/* 유리 위를 초록 빛이 좌우로 지나간다. 헤더가 56~64px 로 얇아서 히어로용
            큰 원을 쓰면 그라디언트 한 조각만 보이므로, 가로로 눕힌 덩어리를
            좌우로만 흘린다(index.css 의 liquid-blob-head-*).

            `-z-10` 을 쓰면 안 된다. 헤더 배경이 `bg-background/80` 이라 음수 z
            는 그 흰 면 **뒤로** 가고, 80% 에 가려 빛이 거의 남지 않는다. 대신
            그리는 순서로 해결한다 — 덩어리를 먼저 두고 내용에 `relative` 를
            줘서 글자가 위에 온다. 글자 위로 올라가면 대비를 갉아먹는데 메뉴
            글자는 흰 종이 위 5.61:1 이라 여유가 1.11 뿐이다. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="liquid-blob liquid-blob-head-1" />
          <div className="liquid-blob liquid-blob-head-2" />
        </div>
        <div
          className={`container relative mx-auto flex items-center justify-between px-4 transition-[height] duration-300 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight text-primary">
            <BrandMark size={28} />
            Seeds
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => {
              const on = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative py-1 text-sm font-medium transition-colors ${
                    on ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {/* 현재 항목의 밑줄이 항목 사이를 미끄러진다. 어디에서 어디로
                      옮겨왔는지가 보여서 위치 감각이 유지된다. */}
                  {on ? (
                    <motion.span
                      layoutId="public-nav-underline"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {myHome ? (
              <Link href={myHome}>
                <Button data-testid="button-my-workspace">← 내 화면으로</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">로그인</Button>
                </Link>
                <Magnetic strength={5}>
                  <Link href="/apply">
                    <Button>지원하기</Button>
                  </Link>
                </Magnetic>
              </>
            )}
            {/* 헤더 nav가 md 미만에서 사라지므로, 없으면 폰에서 소개·프로그램·
                사람들·모집·FAQ 어디에도 갈 수 없다. 공개 사이트는 A 등급이고
                A는 "내용 전부 읽힘"을 약속한다(design/05 §6.2). */}
            <MobileNav
              items={navItems}
              title="Seeds"
              footer={
                <Link
                  href={myHome ?? "/login"}
                  className="block rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {myHome ? "← 내 화면으로" : "로그인 (관리자 / 멘토 / 학생)"}
                </Link>
              }
            />
          </div>
        </div>

        {/* 페이지 진행 표시줄. 공개 페이지가 길어서(홈은 화면 6개분) 지금
            어디쯤인지가 안 보인다. 헤더 바닥에 붙여 스크롤바를 대신한다.
            scaleX 만 바꾸므로 레이아웃 계산이 없다. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
          style={{ scaleX: scrollYProgress }}
        />
      </header>
      {/* 페이지 전환. 링크를 눌렀을 때 화면이 통째로 바뀌면 같은 사이트 안에서
          움직였다는 감각이 끊긴다. 짧게 겹쳐 넘기면 이어진 것으로 읽힌다.
          `location` 을 키로 써서 경로가 바뀔 때만 재생된다. */}
      <motion.main
        key={location}
        className="flex flex-1 flex-col"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div>&copy; {new Date().getFullYear()} Seeds Program. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-primary transition-colors">
              로그인 (관리자 / 평가위원 / 학생)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
