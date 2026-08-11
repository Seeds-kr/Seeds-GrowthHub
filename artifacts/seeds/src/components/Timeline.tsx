import { motion, useReducedMotion } from "framer-motion";
import { parseMonths } from "@/components/YearTrack";

/**
 * 기간이 있는 단계들을 실제로 "흐르게" 그린다.
 *
 * 지금까지 이 내용(2월 → 11월, 네 단계)은 카드 안의 그냥 목록이었다. 시간의
 * 흐름인데 시각적으로는 아무 데도 흐르지 않았고, 항목 넷이 전부 같은 무게라
 * 어디가 시작이고 어디가 끝인지 형태로는 알 수 없었다.
 *
 * 세로 축 하나를 긋고 마디를 얹는다. 축은 스크롤이 닿을 때 위에서 아래로
 * 자라고, 마디는 순서대로 켜진다 — 움직임 자체가 "이 순서로 간다" 를 말한다.
 *
 * 지금 진행 중인 마디는 따로 표시한다. 월을 읽어 오늘과 견주고, 못 읽으면
 * 아무것도 강조하지 않는다(틀린 마디를 켜느니 안 켠다).
 */

/** `2월`·`3-5월`·`10-11월` 에서 시작·끝 달을 뽑는다. 못 읽으면 null. */
function monthRange(text: string): { from: number; to: number } | null {
  const ms = parseMonths(text);
  if (ms.length === 0) {
    // "3-5월" 은 앞 숫자에 `월` 이 없어 parseMonths 가 5만 잡는다. 범위를 따로 본다.
    const m = text.match(/(\d{1,2})\s*[-~–]\s*(\d{1,2})\s*월/);
    if (!m) return null;
    return { from: Number(m[1]), to: Number(m[2]) };
  }
  const m = text.match(/(\d{1,2})\s*[-~–]\s*(\d{1,2})\s*월/);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  return { from: ms[0], to: ms[ms.length - 1] };
}

export function Timeline({
  items,
}: {
  /** 기간 표기(`2월`·`3-5월`). 없으면 마디 제목만 나오고 "지금" 판정도 하지 않는다. */
  items: { label?: string; title: string; desc: string }[];
}) {
  const reduce = useReducedMotion();
  const thisMonth = new Date().getMonth() + 1;

  const rows = items.map((it) => {
    const r = it.label ? monthRange(it.label) : null;
    return { ...it, current: r ? thisMonth >= r.from && thisMonth <= r.to : false };
  });
  // 여러 마디가 겹쳐 걸리면 강조가 의미를 잃는다. 첫 하나만 켠다.
  const activeIdx = rows.findIndex((r) => r.current);

  return (
    <ol className="relative">
      {/* 축. 마디들을 꿰는 선이고, 스크롤이 닿으면 위에서 아래로 자란다. */}
      <motion.span
        aria-hidden="true"
        className="absolute left-[7px] top-2 w-px origin-top bg-border"
        style={{ bottom: "1.5rem" }}
        initial={reduce ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      {rows.map((row, i) => {
        const active = i === activeIdx;
        return (
          <motion.li
            key={i}
            className="relative pb-9 pl-9 last:pb-0"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 마디. 진행 중인 것만 채워지고 옅은 테를 두른다. */}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-background ${
                active ? "bg-primary" : "bg-border"
              }`}
            >
              {active ? (
                <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-primary/40" />
              ) : null}
            </span>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {row.label ? (
                <span
                  className={`text-sm font-bold tabular-nums ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {row.label}
                </span>
              ) : null}
              <h3 className="text-lg font-bold tracking-[-0.02em]">{row.title}</h3>
              {/* 색만으로 "지금" 을 전하지 않는다. */}
              {active ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  지금 이 단계
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {row.desc}
            </p>
          </motion.li>
        );
      })}
    </ol>
  );
}
