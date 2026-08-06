import { ReactNode } from "react";
import { Monitor } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsDesktop } from "@/hooks/use-desktop";

/**
 * W11 (design/05 §6.3) — C-tier gate.
 *
 * Below `lg` the children are not rendered at all, they are replaced by a
 * notice. Hiding with CSS would leave the blocked UI in the DOM, still
 * focusable and still able to contribute overflow — §6.4 forbids horizontal
 * scroll, and a kanban board is exactly the kind of tree that produces it.
 *
 * Wraps either a whole page or a single section: `/mentor/projects/:id` is
 * A-tier for reading but C-tier for its status-check form (§6.2), so the guard
 * has to be usable at section granularity too.
 *
 * Rule from §6.3: when in doubt a screen goes to C. A half-working mobile
 * layout is not better than an honest notice.
 */
export function DesktopOnly({
  feature,
  children,
}: {
  /**
   * Named in the notice so the user knows what is unavailable, not just that
   * something is. Interpolated with an em dash rather than a topic particle —
   * 는/은 depends on whether the last syllable carries a 받침 ("작업 보드는" but
   * "일괄 출석 입력은"), and a fixed particle would be wrong for half the callers.
   */
  feature: string;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) return <>{children}</>;

  return (
    <Alert data-testid="desktop-only-guard">
      <Monitor className="h-4 w-4" />
      <AlertTitle>{feature} — 데스크톱 전용</AlertTitle>
      <AlertDescription>
        이 화면은 데스크톱에 최적화되어 있습니다. 넓은 화면에서 열어주세요.
      </AlertDescription>
    </Alert>
  );
}
