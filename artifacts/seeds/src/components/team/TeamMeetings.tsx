import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor, MarkdownView } from "@/components/markdown/MarkdownEditor";
import {
  listTeamMeetings,
  createTeamMeeting,
  updateTeamMeeting,
  deleteTeamMeeting,
  type TeamMeeting,
  type TeamOwnerType,
  type TeamViewer,
} from "@/lib/team-api";

/**
 * Team meeting notes (docs/design/06-team-meeting-notes.md §8).
 *
 * One component for all three surfaces. `viewer` decides both which endpoint is
 * read and whether the write controls render — mentors and ops are read-only by
 * design (§4), and the buttons simply do not exist for them rather than being
 * shown disabled. A greyed-out button invites "why can't I?"; absence doesn't.
 *
 * NOTE: `MarkdownEditor` is mounted WITHOUT `uploadTarget`. Image paste posts to
 * `/admin/attachments`, which students cannot reach — passing a target here
 * would give them a paste action that always fails. Student attachments are
 * design 06 §9.
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
  const key = ["team-meetings", viewer, ownerType, ownerId];

  const { data: items, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listTeamMeetings(viewer, ownerType, ownerId),
  });

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [metAt, setMetAt] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setComposing(false);
    setEditingId(null);
    setTitle("");
    setMetAt("");
    setBody("");
    setError(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      // datetime-local gives "2026-08-08T14:30" with no zone; the API wants a
      // full ISO instant. Empty means "now" and the server fills it in.
      const iso = metAt ? new Date(metAt).toISOString() : undefined;
      if (editingId !== null) {
        return updateTeamMeeting(editingId, { title, metAt: iso, contentMd: body });
      }
      return createTeamMeeting({ ownerType, ownerId, title, metAt: iso, contentMd: body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      reset();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "저장하지 못했습니다."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMeeting(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const startEdit = (m: TeamMeeting) => {
    setEditingId(m.id);
    setComposing(true);
    setTitle(m.title);
    setMetAt(m.metAt.slice(0, 16));
    setBody(m.contentMd);
    setError(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          팀 회의록
          {items?.length ? (
            <Badge variant="secondary" data-testid="team-meetings-count">
              {items.length}
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

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "아직 회의록이 없습니다. 팀이 모여서 정한 것을 남겨 보세요."
              : "아직 회의록이 없습니다."}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((m) => (
              <li key={m.id} className="rounded-lg border p-3" data-testid={`team-meeting-${m.id}`}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(m.metAt), "yyyy. M. d. HH:mm")}
                      {m.authorName ? ` · ${m.authorName}` : ""}
                      {/* 팀원 누구나 고칠 수 있으니, 마지막에 만진 사람이 작성자와 다르면 그걸 밝힌다 */}
                      {m.lastEditedBy && m.lastEditedBy !== m.authorId ? " · 이후 다른 팀원이 수정" : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(m)} aria-label="수정">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`"${m.title}" 회의록을 지웁니다. 되돌릴 수 없습니다.`)) {
                            remove.mutate(m.id);
                          }
                        }}
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <MarkdownView source={m.contentMd} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
