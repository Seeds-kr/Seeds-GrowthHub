import * as React from "react"

/**
 * W11 (design/05 §6.4) — the C-tier blocking threshold is Tailwind `lg`.
 *
 * Deliberately separate from `useIsMobile` (768px / `md`), which drives the
 * sidebar drawer. §6.4 keeps the drawer on its current breakpoint, so widening
 * this one to reuse that hook would move the drawer too.
 */
const DESKTOP_BREAKPOINT = 1024

export function useIsDesktop() {
  // Seeded synchronously rather than in the effect: this is a client-only SPA
  // (main.tsx createRoot, no SSR), and a `false` first paint would flash the
  // "desktop only" banner on desktop before the effect corrected it.
  const [isDesktop, setIsDesktop] = React.useState(
    () =>
      typeof window === "undefined" ||
      window.innerWidth >= DESKTOP_BREAKPOINT,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const onChange = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isDesktop
}
