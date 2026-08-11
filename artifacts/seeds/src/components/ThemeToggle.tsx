import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

/**
 * 라이트/다크 전환 버튼.
 *
 * 3단(밝게/어둡게/시스템) 드롭다운이 아니라 **한 번 누르면 바뀌는 버튼**이다.
 * 헤더에서 이걸 누르는 사람이 원하는 건 "지금 눈이 부시다" 를 즉시 해결하는
 * 것이지, 메뉴를 열어 셋 중 하나를 고르는 게 아니다.
 *
 * 시스템 설정은 **기본값으로만** 남는다 — 아무것도 안 고른 사람은 OS 를 따라가고,
 * 한 번 누르면 그 선택이 이긴다. 되돌리려면 아래 `title` 이 알려주는 대로
 * 길게 누르지 않아도 되게, 다시 눌러 원래 모드로 가면 그만이다.
 *
 * 아이콘은 **지금 상태**가 아니라 **누르면 될 상태**를 보여준다. 어두운 화면에서
 * 해를 보여주는 게 "누르면 밝아진다" 로 읽힌다 — 반대로 하면 매번 헷갈린다.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const label = next === "dark" ? "어둡게 보기" : "밝게 보기";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={`shrink-0 ${className}`}
      onClick={() => setChoice(next)}
    >
      {resolved === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
