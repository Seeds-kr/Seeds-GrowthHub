import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * 라이트/다크 전환.
 *
 * 스타일은 이미 다 있었다 — `index.css` 에 `.dark` 변수 블록이 있고 컴포넌트
 * 65곳이 `dark:` 유틸을 쓴다. **없던 건 `.dark` 클래스를 붙이는 주체 하나뿐**이라,
 * 다크 스타일이 통째로 죽어 있었다(이슈 #16).
 *
 * `next-themes` 를 쓰지 않는다. 의존성이 하나 늘고, 우리에게 필요한 건
 * "클래스 하나를 토글하고 고른 값을 기억한다" 가 전부다.
 *
 * 세 가지를 지킨다.
 *
 *  1. **시스템 설정을 기본으로 따른다.** 사용자가 직접 고르기 전까지는 OS 설정이
 *     정답이다. 고르고 나면 그 선택이 이긴다(`localStorage`).
 *  2. **고르지 않았다면 시스템 변경을 계속 따라간다.** 낮에 밝고 밤에 어두운
 *     설정을 쓰는 사람이 있고, 우리가 한 번 읽고 굳혀 버리면 그게 깨진다.
 *  3. **첫 페인트 전에 정한다.** 클래스를 React 안에서 붙이면 흰 화면이 한 번
 *     번쩍인 뒤 어두워진다. `index.html` 의 인라인 스크립트가 먼저 붙이고,
 *     여기서는 그 상태를 이어받는다.
 */

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "seeds-theme";

/** `index.html` 인라인 스크립트와 **같은 규칙**이어야 한다. 어긋나면 깜빡인다. */
function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // 사생활 보호 모드 등에서 localStorage 가 막힐 수 있다. 그때는 시스템을 따른다.
  }
  return "system";
}

function apply(mode: "light" | "dark") {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

type Ctx = {
  choice: ThemeChoice;
  /** 실제로 적용된 값. `system` 일 때 무엇으로 풀렸는지 알아야 아이콘을 고른다. */
  resolved: "light" | "dark";
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() =>
    typeof window === "undefined" ? "system" : readChoice(),
  );
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : resolve(readChoice()),
  );

  useEffect(() => {
    const mode = resolve(choice);
    setResolved(mode);
    apply(mode);
  }, [choice]);

  // 직접 고르지 않았을 때만 시스템을 따라간다.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const mode = mq.matches ? "dark" : "light";
      setResolved(mode);
      apply(mode);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 동작한다.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme 는 ThemeProvider 안에서만 쓸 수 있습니다.");
  return c;
}
