import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { Magnetic } from "@/lib/motion";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  // 스크롤하면 헤더가 얇아지고 그림자가 생긴다. 페이지 맨 위인지 아닌지를
  // 알려주는 신호이자, 본문이 헤더 아래로 지나간다는 걸 보여주는 깊이 단서다.
  // `useScroll` 을 쓰는 이유는 스크롤 이벤트를 직접 걸면 매 프레임 리렌더가
  // 나기 때문이다. 여기서는 임계값을 넘는 순간에만 상태가 바뀐다.
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
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
      <header
        className={`sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 ${
          scrolled
            ? "border-border shadow-[0_1px_20px_-8px_hsl(var(--foreground)/0.28)]"
            : "border-transparent"
        }`}
      >
        <div
          className={`container mx-auto flex items-center justify-between px-4 transition-[height] duration-300 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-primary">
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
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">로그인</Button>
            </Link>
            <Magnetic strength={5}>
              <Link href="/apply">
                <Button>지원하기</Button>
              </Link>
            </Magnetic>
            {/* 헤더 nav가 md 미만에서 사라지므로, 없으면 폰에서 소개·프로그램·
                사람들·모집·FAQ 어디에도 갈 수 없다. 공개 사이트는 A 등급이고
                A는 "내용 전부 읽힘"을 약속한다(design/05 §6.2). */}
            <MobileNav
              items={navItems}
              title="Seeds"
              footer={
                <Link
                  href="/login"
                  className="block rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  로그인 (관리자 / 멘토 / 학생)
                </Link>
              }
            />
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
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
