import { useState } from "react";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DesktopOnly } from "@/components/DesktopOnly";
import { useIsDesktop } from "@/hooks/use-desktop";
import { api, ApiError } from "@/lib/mvp3-api";
import {
  type MeetingDetail,
  type OpsTask,
  MEETING_TYPE_LABEL,
  MEETING_VISIBILITY_LABEL,
  OPS_TASK_STATUS_LABEL,
  OPS_TASK_PRIORITY_LABEL,
  OPS_TASK_PRIORITIES,
  isOverdue,
} from "@/lib/meetings-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Trash2, AlertTriangle } from "lucide-react";

type AdminUserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

/**
 * Editable markdown section. Meeting notes previously had no edit path at all —
 * you could only create. Inline per-section editing (design/05 §3.4) rather
 * than a split view, because a single section is too narrow to split.
 */
function MarkdownSection({
  title,
  source,
  hint,
  onSave,
  saving,
  meetingId,
}: {
  title: string;
  source: string;
  hint?: string;
  onSave: (next: string) => void;
  saving: boolean;
  meetingId: number;
}) {
  const isDesktop = useIsDesktop();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  const hasContent = source.trim().length > 0;

  const start = () => {
    setDraft(source);
    setEditing(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {editing ? (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
            >
              저장
            </Button>
          </div>
        ) : isDesktop ? (
          /* W11 (design/05 §6.2) — 편집 모드 is C tier. Reading the note stays
             A/B, so only the entry point disappears below `lg`. */
          <Button size="sm" variant="outline" className="shrink-0" onClick={start}>
            편집
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {editing ? (
          /* Still guarded even though the button is hidden below `lg`: the
             window can be narrowed while a section is already open. */
          <DesktopOnly feature="회의록 편집">
            <MarkdownEditor
              rows={14}
              value={draft}
              onChange={setDraft}
              uploadTarget={{ linkedObjectType: "meeting", linkedObjectId: meetingId }}
            />
          </DesktopOnly>
        ) : hasContent ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{source}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">비어있음</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminMeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<MeetingDetail, ApiError>({
    queryKey: ["admin-meeting", id],
    queryFn: () => api<MeetingDetail>(`/admin/meetings/${id}`),
    enabled: Number.isFinite(id),
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users-all"],
    queryFn: () => api<{ items: AdminUserListItem[] }>("/admin/users"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigneeId: "" as string,
    dueDate: "",
    priority: "medium" as (typeof OPS_TASK_PRIORITIES)[number],
  });

  const createTask = useMutation({
    mutationFn: () =>
      api<OpsTask>(`/admin/meetings/${id}/action-items`, {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
          dueDate: form.dueDate || null,
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meeting", id] });
      qc.invalidateQueries({ queryKey: ["admin-ops-tasks"] });
      toast({ title: "액션 아이템이 추가되었습니다." });
      setOpen(false);
      setForm({
        title: "",
        description: "",
        assigneeId: "",
        dueDate: "",
        priority: "medium",
      });
    },
    onError: (e: any) =>
      toast({
        title: "추가 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const updateMeeting = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api(`/admin/meetings/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meeting", id] });
      toast({ title: "저장되었습니다." });
    },
    onError: (e: any) =>
      toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const removeMeeting = useMutation({
    mutationFn: () =>
      api(`/admin/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      window.history.back();
    },
    onError: (e: any) =>
      toast({
        title: "삭제 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <Loader2 className="w-6 h-6 animate-spin" />
      </AdminLayout>
    );
  }
  if (error || !data) {
    return (
      <AdminLayout>
        <div className="text-muted-foreground">회의록을 찾을 수 없습니다.</div>
        <Link href="/admin/meetings" className="text-primary text-sm mt-4 inline-block">
          ← 목록으로
        </Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Link
        href="/admin/meetings"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 회의록 목록
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold">{data.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline">
              {MEETING_TYPE_LABEL[data.meetingType] ?? data.meetingType}
            </Badge>
            <Badge variant="outline">
              {MEETING_VISIBILITY_LABEL[data.visibility] ?? data.visibility}
            </Badge>
            <span>·</span>
            <span>{new Date(data.meetingDate).toLocaleString("ko-KR")}</span>
            {data.participants.length > 0 ? (
              <>
                <span>·</span>
                <span>참석: {data.participants.join(", ")}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)} data-testid="btn-new-action-item">
            <Plus className="w-4 h-4 mr-1" /> 액션 아이템 추가
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("이 회의록을 삭제하시겠습니까? 연결된 액션 아이템의 출처 참조도 끊깁니다.")) {
                removeMeeting.mutate();
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MarkdownSection
          title="회의 내용"
          source={data.bodyMd}
          onSave={(bodyMd) => updateMeeting.mutate({ bodyMd })}
          saving={updateMeeting.isPending}
          meetingId={id}
        />
        <MarkdownSection
          title="결정사항"
          source={data.decisionsMd}
          hint="모든 회의 유형에서 별도로 관리됩니다 — 인수인계와 감사의 기준입니다."
          onSave={(decisionsMd) => updateMeeting.mutate({ decisionsMd })}
          saving={updateMeeting.isPending}
          meetingId={id}
        />

        {(data.agendaMd.trim() || data.pendingMd.trim() || data.notesMd.trim()) && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                이전 형식 기록
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                구 고정 섹션입니다. 내용은 위 &ldquo;회의 내용&rdquo;으로 옮겨졌으며 여기서는 읽기 전용입니다.
              </p>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert opacity-70">
              {data.agendaMd.trim() && <><h3>안건</h3><ReactMarkdown>{data.agendaMd}</ReactMarkdown></>}
              {data.pendingMd.trim() && <><h3>보류</h3><ReactMarkdown>{data.pendingMd}</ReactMarkdown></>}
              {data.notesMd.trim() && <><h3>메모</h3><ReactMarkdown>{data.notesMd}</ReactMarkdown></>}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            액션 아이템
            <Badge variant="secondary">{data.actionItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 액션 아이템이 없습니다. 위 "액션 아이템 추가"로 시작하세요.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.actionItems.map((t) => (
                <li
                  key={t.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      {t.title}
                      {isOverdue(t) ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" /> 기한 초과
                        </Badge>
                      ) : null}
                    </div>
                    {t.description ? (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {t.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Badge variant="outline">{OPS_TASK_STATUS_LABEL[t.status]}</Badge>
                    <Badge variant="outline">{OPS_TASK_PRIORITY_LABEL[t.priority]}</Badge>
                    {t.dueDate ? <span>{t.dueDate}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link
              href="/admin/tasks"
              className="text-xs text-primary hover:underline"
            >
              전체 작업 보드 보기 →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>액션 아이템 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ai-title">제목 *</Label>
              <Input
                id="ai-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ai-desc">설명</Label>
              <Textarea
                id="ai-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            {/* W11 — B tier, same reasoning as the meeting create dialog. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>담당자</Label>
                <Select
                  value={form.assigneeId || "_none"}
                  onValueChange={(v) =>
                    setForm({ ...form, assigneeId: v === "_none" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="미지정" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">미지정</SelectItem>
                    {users?.items
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>우선순위</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
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
              </div>
              <div>
                <Label htmlFor="ai-due">기한</Label>
                <Input
                  id="ai-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => createTask.mutate()}
              disabled={!form.title.trim() || createTask.isPending}
              data-testid="btn-save-action-item"
            >
              {createTask.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
