import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor, MarkdownView } from "@/components/markdown/MarkdownEditor";
import {
  listTeamMeetings,
  getTeamMeeting,
  getTeamMeetingMeta,
  createTeamMeeting,
  updateTeamMeeting,
  deleteTeamMeeting,
  type TeamMeeting,
  type TeamOwnerType,
  type TeamViewer,
} from "@/lib/team-api";

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
  const [openId, setOpenId] = useState<number | null>(null);

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

  // ── 작성/수정 폼 ─────────────────────────────────────────────────────────
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [metAt, setMetAt] = useState("");
  const [body, setBody] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [attendees, setAttendees] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setComposing(false);
    setEditingId(null);
    setTitle("");
    setMetAt("");
    setBody("");
    setFormTags([]);
    setTagDraft("");
    setAttendees([]);
    setError(null);
  };

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || formTags.includes(t) || formTags.length >= 10) return;
    setFormTags([...formTags, t]);
    setTagDraft("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const iso = metAt ? new Date(metAt).toISOString() : undefined;
      const payload = {
        title,
        metAt: iso,
        contentMd: body,
        tags: formTags,
        participantUserIds: attendees,
      };
      return editingId !== null
        ? updateTeamMeeting(editingId, payload)
        : createTeamMeeting({ ownerType, ownerId, ...payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-meetings"] });
      void qc.invalidateQueries({ queryKey: ["team-meeting-meta"] });
      reset();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "저장하지 못했습니다."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMeeting(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["team-meetings"] }),
  });

  const startEdit = async (m: TeamMeeting) => {
    // The list row has no body — fetch it before opening the editor, or the
    // first save would blank out the note.
    const full = await getTeamMeeting(viewer, m.id);
    setEditingId(m.id);
    setComposing(true);
    setTitle(full.title);
    setMetAt(full.metAt.slice(0, 16));
    setBody(full.contentMd ?? "");
    setFormTags(full.tags);
    setAttendees(full.participants.map((p) => p.id));
    setError(null);
  };

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
        {canEdit && !composing && (
          <Button size="sm" onClick={() => setComposing(true)} data-testid="button-new-team-meeting">
            <Plus className="mr-1 h-4 w-4" /> 회의록 쓰기
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── 작성/수정 ── */}
        {composing && canEdit && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-48 flex-1"
                placeholder="회의 제목 — 예: 3주차 정기 회의"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-team-meeting-title"
              />
              <Input
                type="datetime-local"
                className="w-56"
                value={metAt}
                onChange={(e) => setMetAt(e.target.value)}
                data-testid="input-team-meeting-met-at"
              />
            </div>

            {/* 참여자 — 팀원과 담당 멘토만 고를 수 있다(서버도 같은 목록으로 막는다) */}
            <div>
              <p className="mb-1 text-sm font-medium">참여자</p>
              <div className="flex flex-wrap gap-3 rounded-md border p-2">
                {people.length === 0 ? (
                  <span className="text-sm text-muted-foreground">팀원 정보를 불러오는 중…</span>
                ) : (
                  people.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      data-testid={`attendee-${p.id}`}
                    >
                      <Checkbox
                        checked={attendees.includes(p.id)}
                        onCheckedChange={(c) =>
                          setAttendees(
                            c ? [...attendees, p.id] : attendees.filter((x) => x !== p.id),
                          )
                        }
                      />
                      {p.name}
                      {"kind" in p && p.kind === "mentor" && (
                        <Badge variant="outline" className="text-[10px]">멘토</Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* 태그 — 기존 것을 고르거나 새로 지어낸다 */}
            <div>
              <p className="mb-1 text-sm font-medium">태그</p>
              <div className="flex flex-wrap items-center gap-2">
                {formTags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button
                      type="button"
                      onClick={() => setFormTags(formTags.filter((x) => x !== t))}
                      aria-label={`${t} 태그 제거`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="h-8 w-40"
                  placeholder="새 태그 + Enter"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // 폼 제출로 새어 나가면 회의록이 반쯤 저장된다
                      e.preventDefault();
                      addTag(tagDraft);
                    }
                  }}
                  data-testid="input-team-meeting-tag"
                />
                {tagOptions
                  .filter((t) => !formTags.includes(t))
                  .slice(0, 8)
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      + {t}
                    </button>
                  ))}
              </div>
            </div>

            <MarkdownEditor
              value={body}
              onChange={setBody}
              rows={12}
              placeholder={"## 정한 것\n- \n\n## 다음까지 할 일\n- "}
              data-testid="editor-team-meeting"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!title.trim() || save.isPending}
                onClick={() => save.mutate()}
                data-testid="button-save-team-meeting"
              >
                {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editingId !== null ? "수정 저장" : "저장"}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="mr-1 h-4 w-4" /> 취소
              </Button>
            </div>
          </div>
        )}

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
                viewer={viewer}
                open={openId === m.id}
                onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                canEdit={canEdit}
                onEdit={() => void startEdit(m)}
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
    </Card>
  );
}

/**
 * One row: a title line that expands. The body is fetched on first open and
 * cached by key, so re-opening is free but the list stays light.
 */
function MeetingRow({
  meeting,
  viewer,
  open,
  onToggle,
  canEdit,
  onEdit,
  onDelete,
}: {
  meeting: TeamMeeting;
  viewer: TeamViewer;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: full, isLoading } = useQuery({
    queryKey: ["team-meeting", viewer, meeting.id],
    queryFn: () => getTeamMeeting(viewer, meeting.id),
    enabled: open,
  });

  return (
    <li data-testid={`team-meeting-${meeting.id}`}>
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
          data-testid={`team-meeting-toggle-${meeting.id}`}
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{meeting.title}</span>
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
      </div>
      {open && (
        <div className="border-t bg-muted/30 px-3 py-3 pl-9">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <MarkdownView source={full?.contentMd ?? ""} />
              <p className="mt-3 text-xs text-muted-foreground">
                {meeting.authorName ? `${meeting.authorName} 작성` : "작성자 없음"}
                {meeting.lastEditedBy && meeting.lastEditedBy !== meeting.authorId
                  ? " · 이후 다른 팀원이 수정"
                  : ""}
              </p>
            </>
          )}
        </div>
      )}
    </li>
  );
}
