import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * 한 해 트랙 — 모집이 언제 열리는지를 달력 위에 표시한다.
 *
 * 전에는 `STEP 1 / STEP 2 / STEP 3` 카드 석 장이었다. 두 가지가 틀렸다.
 *
 *  - 이건 **단계가 아니다.** 정기모집과 수시모집은 나란한 두 경로이고, 문의는
 *    연락처다. 번호를 매기면 "1을 거쳐야 2로 간다" 는 잘못된 인상을 준다.
 *  - 방문자가 이 판에서 묻는 건 하나다: **"지금 지원할 수 있나?"** 그 답이
 *    본문 괄호 안에 묻혀 있었다.
 *
 * 트랙은 그 질문에 눈으로 답한다. 열두 칸 위에 모집 달이 칠해지고, 오늘이 어디쯤인지
 * 표시가 선다. 애니메이션은 그 표시가 제자리를 찾아가는 것 하나뿐이다 — 움직임이
 * 정보를 나르지 못하면 넣지 않는다.
 *
 * 달은 `date` 문자열에서 뽑는다("매년 12월" → 12). 운영진이 자유롭게 쓰는 칸이라
 * 못 읽을 수 있고, 그때는 트랙을 아예 그리지 않는다 — 틀린 달을 칠하느니 안 그린다.
 */

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** "매년 12월", "12월 중순", "12~1월" 에서 달을 뽑는다. 못 찾으면 빈 배열. */
export function parseMonths(text: string): number[] {
  const found = new Set<number>();
  for (const m of text.matchAll(/(\d{1,2})\s*월/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

export function YearTrack({
  /** 각 항목의 이름과 날짜 문구. 날짜에서 달을 읽는다. */
  items,
}: {
  items: { label: string; date: string }[];
}) {
  const reduce = useReducedMotion();

  const marked = useMemo(() => {
    const map = new Map<number, string>();
    for (const it of items) {
      for (const m of parseMonths(it.date)) {
        if (!map.has(m)) map.set(m, it.label);
      }
    }
    return map;
  }, [items]);

  // 읽어낸 달이 하나도 없으면 트랙이 아무 정보를 못 준다. 그리지 않는다.
  if (marked.size === 0) return null;

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  // 오늘 위치는 달의 경계가 아니라 달 안에서의 진행까지 반영한다.
  const daysInMonth = new Date(now.getFullYear(), thisMonth, 0).getDate();
  const progress = ((thisMonth - 1 + (now.getDate() - 1) / daysInMonth) / 12) * 100;

  return (
    <div className="mb-12">
      <div className="mb-2 flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>1월</span>
        <span>12월</span>
      </div>

      <div className="relative">
        <ol className="flex gap-1" aria-label="연간 모집 일정">
          {MONTHS.map((m) => {
            const label = marked.get(m);
            return (
              <li
                key={m}
                className="group relative flex-1"
                /* 칠해진 달에만 설명을 붙인다. 빈 달에 title 을 달면 마우스를
                   어디에 올려도 툴팁이 떠서 오히려 방해가 된다. */
                title={label ? `${m}월 · ${label}` : undefined}
              >
                <div
                  className={`h-2.5 rounded-sm transition-colors duration-200 ${
                    label
                      ? "bg-primary group-hover:bg-primary/80"
                      : "bg-border group-hover:bg-muted-foreground/30"
                  }`}
                />
                {label ? (
                  <span className="sr-only">
                    {m}월 {label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* 오늘 표시. 트랙 위를 미끄러져 제자리를 찾는다 — 이 판에서 유일한
            애니메이션이고, "지금 여기" 라는 정보를 나른다. */}
        <motion.div
          className="pointer-events-none absolute -top-1 z-10"
          initial={reduce ? false : { left: "0%", opacity: 0 }}
          whileInView={{ left: `${progress}%`, opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          style={reduce ? { left: `${progress}%` } : undefined}
          aria-hidden="true"
        >
          <div className="-translate-x-1/2">
            <div className="h-4.5 w-0.5 rounded-full bg-foreground" style={{ height: "1.125rem" }} />
            <div className="mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
              오늘
            </div>
          </div>
        </motion.div>
      </div>

      {/* 칠해진 달이 무엇인지 글로도 적는다. 색만으로 전하지 않는다. */}
      <p className="mt-9 text-xs text-muted-foreground">
        {[...marked.entries()]
          .map(([m, label]) => `${m}월 ${label}`)
          .join(" · ")}
      </p>
    </div>
  );
}
