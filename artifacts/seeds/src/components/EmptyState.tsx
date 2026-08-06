import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * 비어 있는 목록.
 *
 * 지금까지는 표 한가운데 "공지가 없습니다." 같은 회색 한 줄이 전부였다(81곳).
 * 틀린 건 아니지만 두 가지를 안 한다 — 여기가 원래 무엇이 오는 자리인지
 * 말하지 않고, 다음에 뭘 하면 되는지도 알려주지 않는다. 처음 들어온 운영진은
 * 화면이 고장 난 건지 아직 안 만든 건지 구분하지 못한다.
 *
 * 도형 하나와 한 줄 안내를 더한다. 크게 만들지는 않는다 — 어드민은 일하는
 * 화면이라 빈 상태가 자리를 많이 먹으면 그것대로 방해다.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  /** 다음에 할 일. 없으면 생략한다 — 지어내지 않는다. */
  hint?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div
        className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p className="mt-1 max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
