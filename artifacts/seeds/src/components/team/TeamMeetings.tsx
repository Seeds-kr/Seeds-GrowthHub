import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTeamMeetings,
  getTeamMeetingMeta,
  deleteTeamMeeting,
  type TeamMeeting,
  type TeamOwnerType,
  type TeamViewer,
} from "@/lib/team-api";
import { TeamMeetingDialog } from "./TeamMeetingDialog";

const PAGE_SIZE = 10;
/** Sentinel for "no filter". Radix Select rejects an empty-string item value. */
const ALL = "__all__";

/**
 * Team meeting notes (docs/design/06-team-meeting-notes.md §8).
 *
 * The list shows TITLES ONLY. The first cut rendered every body inline, and ten
 * notes made the page unusable — you scrolled past three screens of somebody
 * else's minutes to reach last week's. Now a row is one line; clicking it
 * fetches that one body. Bodies are not in the list payload at all, so the
 * saving is real and not just visual.
 *
 * `viewer` decides both which endpoint is read and whether write controls
 * render. Mentors and ops are read-only by design (§4) and the buttons simply
 * do not exist for them — a disabled button invites "why can't I?".
 */
export function TeamMeetings({
  viewer,
  ownerType,
  ownerId,
}: {
  viewer: TeamViewer;
  ownerType: TeamOwnerType;
  ownerId: number;
}) {
  const qc = useQueryClient();
  const canEdit = viewer === "student";

  const [page, setPage] = useState(1);
  const [tag, setTag] = useState<string>(ALL);
  const [participantId, setParticipantId] = useState<string>(ALL);
  // null 이면 닫힘. { id: null } 이면 새로 쓰기.
  const [dialog, setDialog] = useState<{ id: number | null; edit: boolean } | null>(null);

  const filters = {
    page,
    pageSize: PAGE_SIZE,
    tag: tag === ALL ? undefined : tag,
    participantId: participantId === ALL ? undefined : Number(participantId),
  };
  const listKey = ["team-meetings", viewer, ownerType, ownerId, filters];

  const { data: pageData, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listTeamMeetings(viewer, ownerType, ownerId, filters),
  });

  // Roster and tag list are only reachable by team members; mentors/ops read the
  // same notes but have no meta route, so their filters come from what is on
  // screen instead.
  const { data: meta } = useQuery({
    queryKey: ["team-meeting-meta", ownerType, ownerId],
    queryFn: () => getTeamMeetingMeta(ownerType, ownerId),
    enabled: canEdit,
  });
  const tagOptions =
    meta?.tags ??
    Array.from(new Set((pageData?.items ?? []).flatMap((m) => m.tags))).sort();
  const people =
    meta?.roster ??
    Array.from(
      new Map(
        (pageData?.items ?? []).flatMap((m) => m.participants).map((p) => [p.id, p]),
      ).values(),
    );

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMeeting(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["team-meetings"] }),
  });

  const items = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          팀 회의록
          {pageData?.total ? (
            <Badge variant="secondary" data-testid="team-meetings-count">
              {pageData.total}
            </Badge>
          ) : null}
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setDialog({ id: null, edit: true })} data-testid="button-new-team-meeting">
            <Plus className="mr-1 h-4 w-4" /> 회의록 쓰기
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── 필터 ── */}
        {(tagOptions.length > 0 || people.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {tagOptions.length > 0 && (
              <Select
                value={tag}
                onValueChange={(v) => {
                  setTag(v);
                  setPage(1); // 3페이지에서 좁히면 결과가 없어 빈 화면이 된다
                }}
              >
                <SelectTrigger className="h-8 w-40" data-testid="filter-tag">
                  <SelectValue placeholder="태그" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>태그 전체</SelectItem>
                  {tagOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {people.length > 0 && (
              <Select
                value={participantId}
                onValueChange={(v) => {
                  setParticipantId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-44" data-testid="filter-participant">
                  <SelectValue placeholder="참여자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>참여자 전체</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(tag !== ALL || participantId !== ALL) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTag(ALL);
                  setParticipantId(ALL);
                  setPage(1);
                }}
              >
                필터 지우기
              </Button>
            )}
          </div>
        )}

        {/* ── 목록 ── */}
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tag !== ALL || participantId !== ALL
              ? "조건에 맞는 회의록이 없습니다."
              : canEdit
                ? "아직 회의록이 없습니다. 팀이 모여서 정한 것을 남겨 보세요."
                : "아직 회의록이 없습니다."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((m) => (
              <MeetingRow
                key={m.id}
                meeting={m}
                canEdit={canEdit}
                onOpen={() => setDialog({ id: m.id, edit: false })}
                onEdit={() => setDialog({ id: m.id, edit: true })}
                onDelete={() => {
                  if (confirm(`"${m.title}" 회의록을 지웁니다. 되돌릴 수 없습니다.`)) {
                    remove.mutate(m.id);
                  }
                }}
              />
            ))}
          </ul>
        )}

        {/* ── 페이지 ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              data-testid="page-prev"
            >
              이전
            </Button>
            <span className="text-sm text-muted-foreground" data-testid="page-indicator">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              data-testid="page-next"
            >
              다음
            </Button>
          </div>
        )}
      </CardContent>

      {dialog && (
        <TeamMeetingDialog
          open
          onOpenChange={(v) => !v && setDialog(null)}
          viewer={viewer}
          ownerType={ownerType}
          ownerId={ownerId}
          meetingId={dialog.id}
          startInEdit={dialog.edit}
          roster={meta?.roster ?? []}
          tagOptions={tagOptions}
        />
      )}
    </Card>
  );
}

/**
 * 한 줄짜리 행. 펼치지 않고 모달을 연다 — 목록의 높이가 내용에 따라 튀지
 * 않으므로, 몇 편이 쌓이든 화면에서 차지하는 자리가 일정하다.
 */
function MeetingRow({
  meeting,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  meeting: TeamMeeting;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-2 p-3" data-testid={`team-meeting-${meeting.id}`}>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
        data-testid={`team-meeting-open-${meeting.id}`}
      >
        <span className="block truncate font-medium hover:underline">{meeting.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{format(new Date(meeting.metAt), "yyyy. M. d.")}</span>
          {meeting.participants.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {meeting.participants.map((p) => p.name).join(", ")}
            </span>
          )}
          {meeting.tags.map((t) => (
            <Badge key={t} variant="outline" className="px-1.5 py-0 text-[10px]">
              {t}
            </Badge>
          ))}
        </span>
      </button>
      {canEdit && (
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="수정">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="삭제">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}
