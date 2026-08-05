import { useState } from "react";
import { Link } from "wouter";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import {
  type Meeting,
  type OpsTask,
  MEETING_TYPES,
  MEETING_TYPE_LABEL,
  MEETING_VISIBILITIES,
  MEETING_VISIBILITY_LABEL,
  OPS_TASK_PRIORITIES,
  OPS_TASK_PRIORITY_LABEL,
} from "@/lib/meetings-api";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, CalendarCheck } from "lucide-react";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PendingAction = {
  title: string;
  assigneeId: string;
  dueDate: string;
  priority: (typeof OPS_TASK_PRIORITIES)[number];
};

function blankForm() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return {
    title: "",
    meetingType: "general" as (typeof MEETING_TYPES)[number],
    meetingDate: toLocalInput(now.toISOString()),
    participantsText: "",
    visibility: "admin_only" as (typeof MEETING_VISIBILITIES)[number],
    decisionsMd: "",
    pendingActions: [] as PendingAction[],
  };
}

type AdminUserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export default function AdminMeetingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-meetings"],
    queryFn: () => api<{ items: Meeting[] }>("/admin/meetings"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-all"],
    queryFn: () => api<{ items: AdminUserListItem[] }>("/admin/users"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const meeting = await api<Meeting>("/admin/meetings", {
        method: "POST",
        body: {
          title: form.title,
          meetingType: form.meetingType,
          meetingDate: new Date(form.meetingDate).toISOString(),
          participants: form.participantsText
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          visibility: form.visibility,
          // bodyMd omitted on purpose: the server seeds it from the meeting
          // type's template (ADR-006), so ops edits to the template apply.
          decisionsMd: form.decisionsMd,
        },
      });
      const validActions = form.pendingActions.filter((a) => a.title.trim());
      const failed: string[] = [];
      for (const a of validActions) {
        try {
          await api<OpsTask>(`/admin/meetings/${meeting.id}/action-items`, {
            method: "POST",
            body: {
              title: a.title.trim(),
              assigneeId: a.assigneeId ? Number(a.assigneeId) : null,
              dueDate: a.dueDate || null,
              priority: a.priority,
            },
          });
        } catch (e: any) {
          failed.push(`${a.title}: ${e?.data?.error ?? e.message}`);
        }
      }
      return { meeting, actionCount: validActions.length, failed };
    },
    onSuccess: ({ actionCount, failed }) => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["admin-ops-tasks"] });
      if (failed.length > 0) {
        toast({
          title: `회의 저장됨 (액션 ${actionCount - failed.length}/${actionCount} 추가)`,
          description: failed.join("\n"),
          variant: "destructive",
        });
      } else {
        toast({
          title:
            actionCount > 0
              ? `회의 생성됨 (후속 액션 ${actionCount}건 추가)`
              : "회의가 생성되었습니다.",
        });
      }
      setOpen(false);
      setForm(blankForm());
    },
    onError: (e: any) =>
      toast({
        title: "저장 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const addAction = () =>
    setForm((f) => ({
      ...f,
      pendingActions: [
        ...f.pendingActions,
        { title: "", assigneeId: "", dueDate: "", priority: "medium" },
      ],
    }));
  const updateAction = (i: number, patch: Partial<PendingAction>) =>
    setForm((f) => ({
      ...f,
      pendingActions: f.pendingActions.map((a, idx) =>
        idx === i ? { ...a, ...patch } : a,
      ),
    }));
  const removeAction = (i: number) =>
    setForm((f) => ({
      ...f,
      pendingActions: f.pendingActions.filter((_, idx) => idx !== i),
    }));

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-primary" />
            회의록
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            운영진 회의를 기록하고 후속 액션을 작업(Tasks)으로 전환합니다.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-new-meeting">
          + 새 회의
        </Button>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead className="w-24">유형</TableHead>
              <TableHead className="w-40">일시</TableHead>
              <TableHead className="w-40">참석자</TableHead>
              <TableHead className="w-32">공개 범위</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  아직 회의록이 없습니다. 첫 회의록을 만들어 보세요.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/admin/meetings/${m.id}`}
                      className="font-medium text-primary hover:underline"
                      data-testid={`link-meeting-${m.id}`}
                    >
                      {m.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {MEETING_TYPE_LABEL[m.meetingType] ?? m.meetingType}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.meetingDate).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-40">
                    {m.participants.length > 0 ? m.participants.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {MEETING_VISIBILITY_LABEL[m.visibility] ?? m.visibility}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 회의록 작성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 2026년 2월 운영진 정기회의"
              />
            </div>
            {/* W11 — B tier. Three selects share ~113px each inside a dialog at
                375px, which shrinks rather than overflows but is not operable.
                Stacked below `sm`. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>유형</Label>
                <Select
                  value={form.meetingType}
                  onValueChange={(v) =>
                    setForm({ ...form, meetingType: v as (typeof MEETING_TYPES)[number] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {MEETING_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>공개 범위</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      visibility: v as (typeof MEETING_VISIBILITIES)[number],
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEETING_VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {MEETING_VISIBILITY_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">일시 *</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={form.meetingDate}
                  onChange={(e) =>
                    setForm({ ...form, meetingDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="participants">참석자 (쉼표 또는 줄바꿈으로 구분)</Label>
              <Textarea
                id="participants"
                rows={2}
                value={form.participantsText}
                onChange={(e) =>
                  setForm({ ...form, participantsText: e.target.value })
                }
                placeholder="홍길동, 김철수, 이영희"
              />
            </div>
            <div className="rounded border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              회의 본문은 선택한 <strong>회의 유형의 템플릿</strong>으로 자동 채워집니다.
              생성 후 상세 화면에서 이어서 작성하세요. 템플릿 자체는{" "}
              <Link href="/admin/documents">
                <a className="underline underline-offset-2">문서 &amp; 템플릿</a>
              </Link>
              에서 수정할 수 있습니다.
            </div>
            <div>
              <Label htmlFor="decisions">결정사항 (선택)</Label>
              <p className="mb-1 text-xs text-muted-foreground">
                모든 회의 유형에서 별도로 관리됩니다. 지금 비워두고 나중에 채워도 됩니다.
              </p>
              <MarkdownEditor
                rows={5}
                value={form.decisionsMd}
                onChange={(decisionsMd) => setForm({ ...form, decisionsMd })}
              />
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label>후속 액션 아이템</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAction}
                  data-testid="btn-add-action"
                >
                  <Plus className="w-4 h-4 mr-1" /> 액션 추가
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                회의에서 결정된 후속 작업을 함께 등록합니다. 저장 시 회의와 자동 연결되어 작업(Tasks) 목록에 나타납니다.
              </p>
              {form.pendingActions.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  등록된 액션이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.pendingActions.map((a, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_140px_140px_100px_auto] gap-2 items-start border border-border p-2 rounded"
                      data-testid={`row-action-${i}`}
                    >
                      <Input
                        placeholder="액션 제목 *"
                        value={a.title}
                        onChange={(e) => updateAction(i, { title: e.target.value })}
                        data-testid={`input-action-title-${i}`}
                      />
                      <Select
                        value={a.assigneeId || "_none"}
                        onValueChange={(v) =>
                          updateAction(i, { assigneeId: v === "_none" ? "" : v })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="담당자" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">담당자 없음</SelectItem>
                          {(usersData?.items ?? []).map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={a.dueDate}
                        onChange={(e) => updateAction(i, { dueDate: e.target.value })}
                      />
                      <Select
                        value={a.priority}
                        onValueChange={(v) =>
                          updateAction(i, {
                            priority: v as (typeof OPS_TASK_PRIORITIES)[number],
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPS_TASK_PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {OPS_TASK_PRIORITY_LABEL[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(i)}
                        data-testid={`btn-remove-action-${i}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.title.trim() || !form.meetingDate || create.isPending}
              data-testid="btn-save-meeting"
            >
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
