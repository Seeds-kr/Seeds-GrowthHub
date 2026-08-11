import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Maximize2, Minimize2, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MarkdownEditor, MarkdownView } from "@/components/markdown/MarkdownEditor";
import {
  getTeamMeeting,
  createTeamMeeting,
  updateTeamMeeting,
  type RosterEntry,
  type TeamMeeting,
  type TeamOwnerType,
  type TeamViewer,
} from "@/lib/team-api";

/**
 * 회의록 읽기·쓰기 모달 (design 06 §8).
 *
 * 왜 아코디언이 아니라 모달인가: 펼치기는 목록 안에서 길이가 튄다. 짧은 회의록
 * 하나에 121px, 실제 회의록이면 수천px — "스크롤을 너무 내려야 한다"는 원래
 * 문제가 형태만 바꿔 돌아온다. 게다가 수정에 들어가면 목록 자리가 편집기로
 * 바뀌어 다른 회의록이 보이지 않았다. 모달은 목록 위에 뜨고, 닫으면 스크롤
 * 위치가 그대로다.
 *
 * 전체화면 토글은 마크다운 편집 때문이다. 기본 폭에서는 편집기와 미리보기를
 * 나란히 두기 좁다.
 */
export function TeamMeetingDialog({
  open,
  onOpenChange,
  viewer,
  ownerType,
  ownerId,
  meetingId,
  startInEdit = false,
  roster,
  tagOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  viewer: TeamViewer;
  ownerType: TeamOwnerType;
  ownerId: number;
  /** null = 새로 쓰기 */
  meetingId: number | null;
  startInEdit?: boolean;
  roster: RosterEntry[];
  tagOptions: string[];
}) {
  const qc = useQueryClient();
  const canEdit = viewer === "student";
  const [full, setFull] = useState(false);
  const [editing, setEditing] = useState(startInEdit || meetingId === null);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["team-meeting", viewer, meetingId],
    queryFn: () => getTeamMeeting(viewer, meetingId!),
    enabled: open && meetingId !== null,
  });

  const [title, setTitle] = useState("");
  const [metAt, setMetAt] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [attendees, setAttendees] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 모달을 열 때마다 폼을 실제 값으로 되돌린다. 안 하면 직전에 열었던 회의록의
  // 내용이 남아 다음 회의록에 덮어써진다.
  useEffect(() => {
    if (!open) return;
    setFull(false);
    setError(null);
    setTagDraft("");
    setEditing(startInEdit || meetingId === null);
    if (meetingId === null) {
      setTitle("");
      setMetAt("");
      setBody("");
      setTags([]);
      setAttendees([]);
    }
  }, [open, meetingId, startInEdit]);

  useEffect(() => {
    if (!meeting) return;
    setTitle(meeting.title);
    setMetAt(meeting.metAt.slice(0, 16));
    setBody(meeting.contentMd ?? "");
    setTags(meeting.tags);
    setAttendees(meeting.participants.map((p) => p.id));
  }, [meeting]);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t) || tags.length >= 10) return;
    setTags([...tags, t]);
    setTagDraft("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        metAt: metAt ? new Date(metAt).toISOString() : undefined,
        contentMd: body,
        tags,
        participantUserIds: attendees,
      };
      return meetingId === null
        ? createTeamMeeting({ ownerType, ownerId, ...payload })
        : updateTeamMeeting(meetingId, payload);
    },
    onSuccess: (saved: TeamMeeting) => {
      void qc.invalidateQueries({ queryKey: ["team-meetings"] });
      void qc.invalidateQueries({ queryKey: ["team-meeting-meta"] });
      void qc.invalidateQueries({ queryKey: ["team-meeting", viewer, saved.id] });
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "저장하지 못했습니다."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3 overflow-hidden",
          full
            ? "h-[100dvh] max-h-none w-screen max-w-none rounded-none"
            : "max-h-[85vh] max-w-3xl",
        )}
        data-testid="team-meeting-dialog"
      >
        <DialogHeader className="pr-16">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {meetingId === null ? "새 회의록" : (meeting?.title ?? "회의록")}
              </DialogTitle>
              <DialogDescription>
                {meeting
                  ? `${format(new Date(meeting.metAt), "yyyy. M. d. HH:mm")}${
                      meeting.authorName ? ` · ${meeting.authorName} 작성` : ""
                    }`
                  : "팀이 모여서 정한 것을 남깁니다."}
              </DialogDescription>
            </div>
            {/* 닫기 버튼(오른쪽 위)과 겹치지 않게 그 왼쪽에 둔다 */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-12 top-3"
              onClick={() => setFull((v) => !v)}
              aria-label={full ? "창 크기로" : "전체화면"}
              data-testid="button-meeting-fullscreen"
            >
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : editing && canEdit ? (
            <div className="space-y-3">
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

              <div>
                <p className="mb-1 text-sm font-medium">참여자</p>
                <div className="flex flex-wrap gap-3 rounded-md border p-2">
                  {roster.length === 0 ? (
                    <span className="text-sm text-muted-foreground">팀원을 불러오는 중…</span>
                  ) : (
                    roster.map((p) => (
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
                        {p.kind === "mentor" && (
                          <Badge variant="outline" className="text-[10px]">멘토</Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">태그</p>
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
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
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    data-testid="input-team-meeting-tag"
                  />
                  {tagOptions
                    .filter((t) => !tags.includes(t))
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
                rows={full ? 26 : 14}
                placeholder={"## 정한 것\n- \n\n## 다음까지 할 일\n- "}
                data-testid="editor-team-meeting"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {(meeting?.participants.length ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  참여 · {meeting!.participants.map((p) => p.name).join(", ")}
                </p>
              )}
              {(meeting?.tags.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {meeting!.tags.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}
              <MarkdownView source={meeting?.contentMd ?? ""} />
              {meeting?.lastEditedBy && meeting.lastEditedBy !== meeting.authorId && (
                <p className="text-xs text-muted-foreground">이후 다른 팀원이 수정했습니다.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
          {editing && canEdit ? (
            <>
              <Button
                variant="ghost"
                onClick={() => (meetingId === null ? onOpenChange(false) : setEditing(false))}
              >
                취소
              </Button>
              <Button
                disabled={!title.trim() || save.isPending}
                onClick={() => save.mutate()}
                data-testid="button-save-team-meeting"
              >
                {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                저장
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-team-meeting">
                  <Pencil className="mr-1 h-4 w-4" /> 수정
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>닫기</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
