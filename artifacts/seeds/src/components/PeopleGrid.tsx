import { useQuery } from "@tanstack/react-query";
import { Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";
import { ArrowRight, Loader2, Phone } from "lucide-react";
import {
  api,
  PEOPLE_KIND_LABEL,
  PEOPLE_KINDS,
  type PeopleKind,
  type PublicPeopleProfile,
} from "@/lib/mvp3-api";

/**
 * 인물 카드.
 *
 * 이 카드는 프로필 상세로 가는 링크인데, 원래는 세 가지가 어긋나 있었다.
 *
 * 1) `<div role="link">` 이라 href 가 없었다. 흉내만 낸 링크라 가운데 클릭·
 *    새 탭으로 열기·링크 주소 복사·상태표시줄 URL 미리보기가 전부 죽는다.
 *    멘토 프로필은 공유될 만한 주소라 이 손실이 크다. 진짜 `<a>` 로 바꾼다.
 *
 * 2) 호버가 `hover:bg-accent/50` 이었는데 이 프로젝트는 --accent 가 --primary 와
 *    같은 값이다. 그래서 카드 전체가 브랜드 그린 50%로 덮이고, 그 위에 놓인
 *    초록 직함 글자가 배경에 묻혔다. 클릭 가능이 아니라 "선택됨"으로 읽힌다.
 *    호버는 테두리·그림자·밑줄로만 말하고 면을 칠하지 않는다.
 *
 * 3) 호버 전에는 클릭할 수 있다는 신호가 커서 말고 없었다. 터치 기기에는 호버가
 *    아예 없으므로 폰에서는 신호가 0이었다. "프로필 보기 →" 를 항상 띄워
 *    입력 방식과 무관하게 보이게 한다.
 */
function Card({ p }: { p: PublicPeopleProfile }) {
  return (
    <SurfaceCard href={`/people/${p.kind}/${p.id}`} className="h-full">
      <div className="aspect-square w-full mb-4 bg-muted overflow-hidden">
        {p.photoUrl ? (
          <img
            src={p.photoUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-serif text-muted-foreground">
            {p.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="font-serif text-xl font-bold mb-1 decoration-2 underline-offset-4 group-hover:underline">
          {p.name}
        </div>
        {p.roleTitle ? (
          <div className="text-sm text-primary font-medium mb-1">{p.roleTitle}</div>
        ) : null}
        {p.affiliation ? (
          <div className="text-sm text-muted-foreground mb-3">{p.affiliation}</div>
        ) : null}
        {p.bio ? (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {p.bio}
          </p>
        ) : null}
        {p.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {p.tags.map((t, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-muted text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* 아래 두 줄은 카드 바닥에 고정된다(mt-auto). 카드마다 내용 길이가 달라도
            "프로필 보기"의 세로 위치가 맞아 격자가 흔들리지 않는다. */}
        {p.phone ? (
          /* 링크 안에 링크를 중첩할 수 없다(HTML 위반이고 클릭 대상이 겹친다).
             전화는 카드 링크 밖 형제로 두고, 카드 링크는 이 줄을 덮지 않는다. */
          <div className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{p.phone}</span>
          </div>
        ) : null}
        <div className="mt-auto pt-5 text-sm font-medium text-primary inline-flex items-center gap-1">
          프로필 보기
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
        </div>
      </div>
    </SurfaceCard>
  );
}

const KIND_SUBTITLE: Record<PeopleKind, string> = {
  mentor: "Seeds 학생들의 성장을 함께하는 분야별 멘토를 소개합니다.",
  staff: "Seeds 프로그램을 기획·운영하는 운영진입니다.",
  member: "Seeds에서 함께 배우고 만드는 학생들입니다. 본인이 공개에 동의한 경우에만 표시됩니다.",
};
const KIND_EMPTY: Record<PeopleKind, string> = {
  mentor: "아직 공개된 멘토가 없습니다.",
  staff: "아직 공개된 운영진이 없습니다.",
  member: "아직 공개에 동의한 학생이 없습니다.",
};

export function PeopleGrid({
  kind,
  onKindChange,
}: {
  kind: PeopleKind;
  onKindChange: (k: PeopleKind) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-people", kind],
    queryFn: () =>
      api<{ items: PublicPeopleProfile[] }>(`/people/${kind}`),
  });

  return (
    <section className="py-24 md:py-32 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary mb-3 font-semibold">
            Seeds People
          </div>
          <h1 className="text-5xl md:text-6xl mb-5">사람들</h1>
          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
            Seeds를 함께 만드는 멘토·운영진·학생을 소개합니다.
          </p>
        </div>

        <div role="tablist" className="flex justify-center gap-2 mb-6 border-b border-border">
          {PEOPLE_KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === kind}
              onClick={() => onKindChange(k)}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                k === kind
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {PEOPLE_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mb-10">
          {KIND_SUBTITLE[kind]}
        </p>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            {KIND_EMPTY[kind]}
          </div>
        ) : (
          <Stagger className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <StaggerItem key={p.id}>
                <Card p={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}
