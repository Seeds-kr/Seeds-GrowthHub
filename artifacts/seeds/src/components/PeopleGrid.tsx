import { useQuery } from "@tanstack/react-query";
import { Stagger, StaggerItem } from "@/lib/motion";
import { SurfaceCard } from "@/components/SurfaceCard";
import { ArrowRight, Loader2, Phone, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LiquidBackdrop } from "@/components/LiquidBackdrop";
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
/** 태그를 몇 개까지 보여줄지. 넘치면 "+N" 으로 접는다. */
const TAG_LIMIT = 6;

/** 이름 첫 글자를 딴 대체 아바타. 이름이 같은 사람끼리도 색이 갈리도록 글자로 색을 정한다. */
function initialTint(name: string): string {
  // 브랜드 초록 계열 안에서만 색상을 흔든다. 무지개로 만들면 페이지가 시끄러워진다.
  const h = 152 + ((name.charCodeAt(0) % 5) - 2) * 9;
  return `linear-gradient(140deg, hsl(${h} 45% 92%), hsl(${h} 38% 84%))`;
}

function Card({ p }: { p: PublicPeopleProfile }) {
  const tags = p.tags.slice(0, TAG_LIMIT);
  const overflow = p.tags.length - tags.length;

  return (
    <SurfaceCard href={`/people/${p.kind}/${p.id}`} className="h-full">
      <div className="flex items-start gap-4">
        {/* 아바타. 사진이 없을 때 정사각 회색 판을 통째로 비워두면 카드의 절반이
            빈 덩어리가 된다(멘토 아홉 명이면 페이지 대부분이 회색이었다).
            원형으로 줄이고 이름 첫 글자를 앉히면 자리는 지키되 비어 보이지 않는다.
            큰 사진은 프로필 상세에서 제대로 보여준다. */}
        <span
          className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-border"
          style={p.photoUrl ? undefined : { backgroundImage: initialTint(p.name) }}
          aria-hidden="true"
        >
          {p.photoUrl ? (
            <img
              src={p.photoUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <span className="font-serif text-2xl font-bold text-primary/70">
              {p.name.slice(0, 1)}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl font-bold decoration-2 underline-offset-4 group-hover:underline">
            {p.name}
          </span>
          {p.roleTitle ? (
            <span className="mt-1 block text-sm font-medium leading-snug text-primary">
              {p.roleTitle}
            </span>
          ) : null}
          {p.affiliation ? (
            <span className="mt-1 block text-sm text-muted-foreground">{p.affiliation}</span>
          ) : null}
        </span>
      </div>

      {p.bio ? (
        <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
          {p.bio}
        </p>
      ) : null}

      {tags.length > 0 ? (
        /* 태그가 열넷씩 달린 사람이 있어서 그 카드만 두 배로 길어졌다. 격자가
           들쭉날쭉해지므로 여섯 개에서 끊고 나머지는 개수로 알린다. */
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {overflow > 0 ? (
            <span className="rounded-full px-2 py-0.5 text-xs text-muted-foreground/80">
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 아래 두 줄은 카드 바닥에 고정된다(mt-auto). 카드마다 내용 길이가 달라도
          "프로필 보기"의 세로 위치가 맞아 격자가 흔들리지 않는다. */}
      {p.phone ? (
        /* 링크 안에 링크를 중첩할 수 없다(HTML 위반이고 클릭 대상이 겹친다).
           전화는 카드 링크 밖 형제로 두고, 카드 링크는 이 줄을 덮지 않는다. */
        <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{p.phone}</span>
        </div>
      ) : null}
      <div className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-primary">
        프로필 보기
        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
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
    <section className="relative overflow-hidden px-4 pb-20 pt-16">
      {/* 표제 뒤가 비어 있었다. 다른 공개 페이지와 같은 배경을 깐다. */}
      <LiquidBackdrop className="h-[26rem]" />
      <div className="container relative mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary mb-3 font-semibold">
            Seeds People
          </div>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">사람들</h1>
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

        <p className="mb-8 text-center text-sm text-muted-foreground">
          {KIND_SUBTITLE[kind]}
        </p>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || data.items.length === 0 ? (
          /* 회색 한 줄만 있으면 고장 난 건지 아직 안 채운 건지 알 수 없다.
             다른 탭에는 사람이 있다는 것까지 같이 말해준다. */
          <EmptyState
            icon={Users}
            title={KIND_EMPTY[kind]}
            hint="위 탭에서 다른 분류를 볼 수 있습니다."
          />
        ) : (
          <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <StaggerItem key={p.id} className="h-full">
                <Card p={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}
