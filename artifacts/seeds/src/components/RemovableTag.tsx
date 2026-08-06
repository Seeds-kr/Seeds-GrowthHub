import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * 떼어낼 수 있는 태그 칩.
 *
 * 원래는 `<Badge className="cursor-pointer" onClick={detach}>이름 ✕</Badge>` 였다.
 * 세 가지가 어긋나 있었다:
 *
 *  - 배지 전체가 클릭 대상인데 배지는 이 앱에서 라벨로 쓰이는 요소다. 같은
 *    모양의 다른 배지들은 눌러도 아무 일이 없으니, 어느 것이 눌리는지 알 수 없다.
 *  - 호버 반응이 없어 커서 말고는 신호가 없었다(터치에서는 신호가 0).
 *  - `✕` 가 본문 글자라 스크린리더가 "이름 곱하기"처럼 읽고, 키보드로는
 *    아예 도달할 수 없었다(div/span 에 onClick 만 있었으므로).
 *
 * 칩은 라벨로 두고 떼어내는 동작만 진짜 버튼으로 분리한다. 표준 칩 패턴이고,
 * 태그 이름을 드래그로 선택하는 것도 다시 가능해진다.
 */
export function RemovableTag({
  name,
  onRemove,
  disabled,
}: {
  name: string;
  onRemove: () => void;
  /** 삭제 요청이 날아가는 중이면 연타를 막는다. */
  disabled?: boolean;
}) {
  return (
    <Badge variant="outline" className="gap-0 pr-0">
      {name}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`태그 '${name}' 제거`}
        title={`태그 '${name}' 제거`}
        className="ml-1.5 mr-0.5 grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}
