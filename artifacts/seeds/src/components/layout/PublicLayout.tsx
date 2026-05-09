import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "소개", href: "/about" },
    { label: "프로그램", href: "/program" },
    { label: "사람들", href: "/people" },
    { label: "모집", href: "/recruit" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
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
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
            <Link href="/apply">
              <Button>지원하기</Button>
            </Link>
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
