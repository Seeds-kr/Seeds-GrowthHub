import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "소개", href: "/about" },
    { label: "프로그램", href: "/program" },
    { label: "사람들", href: "/people" },
    { label: "모집", href: "/recruit" },
    { label: "FAQ", href: "/faq" },
  ];

  // `.annual` — DESIGN.md의 기수 연감 세계. 헤더·푸터까지 같은 종이 위에 있어야
  // 이음매가 생기지 않는다. 공개 표면 전체가 이 세계를 공유하고, 어드민·학생·멘토는
  // 이 밖에 있으므로 영향을 받지 않는다.
  return (
    <div className="annual min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b backdrop-blur-md" style={{ borderColor: "hsl(var(--rule))", backgroundColor: "hsl(var(--paper) / 0.85)" }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-primary">
            Seeds
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location === item.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">로그인</Button>
            </Link>
            <Link href="/apply">
              <Button>지원하기</Button>
            </Link>
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
      <footer className="border-t" style={{ borderColor: "hsl(var(--rule))" }}>
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
