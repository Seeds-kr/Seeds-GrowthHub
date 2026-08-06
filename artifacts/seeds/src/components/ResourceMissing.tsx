import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/**
 * 요청한 자료가 없을 때 보여주는 판.
 *
 * 원래는 상세 화면들이 전부 `if (isLoading || !data) return <Spinner/>` 였다.
 * 없는 자료를 열면 로딩이 끝나도 `data` 가 계속 비어 있으므로 **스피너가
 * 영원히 돈다**. 사용자는 느린 건지 없는 건지 알 수 없고, 기다리다 나간다.
 * 12개 화면이 같은 모양이었다.
 *
 * 문구는 "없거나 접근 권한이 없다" 로 합친다. 둘을 구분해 알려주면 남의 자료가
 * **존재한다는 사실**이 새어 나간다(권한 밖 리소스는 403이 아니라 404 로 다룬다는
 * 설계와 같은 이유다). 돌아갈 곳을 반드시 준다 — 막다른 길을 만들지 않는다.
 */
/**
 * 받침 유무로 조사를 고른다. "지원서을(를)" 같은 표기를 피하려는 것이고,
 * 라벨이 운영 중에 바뀌어도 문장이 깨지지 않는다.
 *
 * 한글 음절(U+AC00~U+D7A3)은 (코드 - 0xAC00) % 28 이 종성 인덱스라, 0이면
 * 받침이 없다. 한글이 아닌 글자로 끝나면(영문·숫자) 판단할 근거가 없으므로
 * 받침 없는 쪽으로 둔다 — 이 화면의 라벨은 전부 한글이다.
 */
function withObjectParticle(word: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinal = isHangul && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? "을" : "를"}`;
}

export function ResourceMissing({
  label,
  backHref,
  backLabel,
}: {
  /** 무엇을 찾고 있었는지. "지원서", "프로젝트" 처럼 목적어로 넣는다. */
  label: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        404
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {withObjectParticle(label)} 찾을 수 없습니다
      </h1>
      <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
        주소가 잘못되었거나, 삭제되었거나, 접근 권한이 없는 자료입니다.
      </p>
      <Link href={backHref}>
        <Button variant="outline" className="mt-7">
          {backLabel ?? "목록으로 돌아가기"}
        </Button>
      </Link>
    </div>
  );
}
