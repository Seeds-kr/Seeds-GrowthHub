import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";

/**
 * Mobile navigation for the header-based layouts (public / student / mentor /
 * evaluator).
 *
 * Those layouts rendered their nav as `hidden md:flex` with nothing in its
 * place, so below 768px every link vanished and only the current page was
 * reachable. For the public site and `/student/*` that broke the A tier they
 * are assigned in design/05 §6.2 — A promises "내용 전부 읽힘", and a student on a
 * phone could open the dashboard and nothing else.
 *
 * `AdminLayout` already had a drawer; this is the same idea factored out so the
 * four header layouts do not each grow their own copy.
 *
 * Deliberately NOT a `DesktopOnly` case: navigation is the one thing that must
 * work on every tier. Blocking it would make the tier meaningless.
 */
export type MobileNavItem = { href: string; label: string };

/**
 * Which breakpoint the desktop nav appears at, so this hides at exactly the
 * same one. Written as whole literal class strings — Tailwind scans source
 * text, so a built-up `${bp}:hidden` would be purged from the CSS.
 */
const BP = {
  md: { trigger: "md:hidden", panel: "md:hidden" },
  lg: { trigger: "lg:hidden", panel: "lg:hidden" },
} as const;

export function MobileNav({
  items,
  title,
  /** Rendered under the links — sign out, role switcher, etc. */
  footer,
  /** Match the desktop nav's own breakpoint, or the two overlap or gap. */
  breakpoint = "md",
}: {
  items: MobileNavItem[];
  title: string;
  footer?: React.ReactNode;
  breakpoint?: keyof typeof BP;
}) {
  const bp = BP[breakpoint];
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  // Close on navigation. Without this the panel stays over the page the user
  // just asked for.
  useEffect(() => {
    setOpen(false);
  }, [location]);

  // The drawer scrolls itself; letting the body scroll behind it is what makes
  // these panels feel broken on a phone.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${bp.trigger} p-2 -mr-1 text-muted-foreground hover:text-foreground`}
        aria-label="메뉴 열기"
        aria-expanded={open}
        data-testid="btn-mobile-nav"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open ? (
        <div className={`${bp.panel} fixed inset-0 z-50 flex justify-end`}>
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-border bg-card"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-base font-bold text-primary">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 p-2 text-muted-foreground hover:text-foreground"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4">
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    location === item.href ||
                    (item.href !== "/" && location.startsWith(item.href + "/"));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-md px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {footer ? (
              <div className="shrink-0 border-t border-border p-3">{footer}</div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
