import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/mvp3-api";
import {
  type OpsTask,
  type Meeting,
  OPS_TASK_STATUSES,
  OPS_TASK_STATUS_LABEL,
  OPS_TASK_PRIORITIES,
  OPS_TASK_PRIORITY_LABEL,
  isOverdue,
} from "@/lib/meetings-api";
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
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, AlertTriangle, CheckSquare } from "lucide-react";

type AdminUserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const STATUS_COLUMN_BG: Record<(typeof OPS_TASK_STATUSES)[number], string> = {
  todo: "bg-muted/40",
  in_progress: "bg-blue-50/60 dark:bg-blue-950/20",
  review: "bg-amber-50/60 dark:bg-amber-950/20",
  blocked: "bg-red-50/60 dark:bg-red-950/20",
  done: "bg-emerald-50/60 dark:bg-emerald-950/20",
  canceled: "bg-muted/30",
};

const PRIORITY_BADGE: Record<(typeof OPS_TASK_PRIORITIES)[number], string> = {
  low: "",
  medium: "",
  high: "border-amber-500 text-amber-700 dark:text-amber-400",
  urgent: "border-red-500 text-red-700 dark:text-red-400",
};

function blankForm() {
  return {
    title: "",
    description: "",
    status: "todo" as (typeof OPS_TASK_STATUSES)[number],
    priority: "medium" as (typeof OPS_TASK_PRIORITIES)[number],
    assigneeId: "",
    dueDate: "",
    sourceMeetingId: "",
  };
}

export default function AdminTasksPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm());

  const queryKey = useMemo(
    () => ["admin-ops-tasks", filterStatus, filterAssignee] as const,
    [filterStatus, filterAssignee],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterAssignee) qs.set("assigneeId", filterAssignee);
      const s = qs.toString();
      return api<{ items: OpsTask[] }>(`/admin/ops-tasks${s ? `?${s}` : ""}`);
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users-all"],
    queryFn: () => api<{ items: AdminUserListItem[] }>("/admin/users"),
  });

  const { data: meetings } = useQuery({
    queryKey: ["admin-meetings"],
    queryFn: () => api<{ items: Meeting[] }>("/admin/meetings"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<OpsTask>("/admin/ops-tasks", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          status: form.status,
          priority: form.priority,
          assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
          dueDate: form.dueDate || null,
          sourceMeetingId: form.sourceMeetingId
            ? Number(form.sourceMeetingId)
            : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ops-tasks"] });
      toast({ title: "작업이 추가되었습니다." });
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

  const updateStatus = useMutation({
    mutationFn: (vars: { id: number; status: (typeof OPS_TASK_STATUSES)[number] }) =>
      api<OpsTask>(`/admin/ops-tasks/${vars.id}`, {
        method: "PATCH",
        body: { status: vars.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ops-tasks"] });
    },
    onError: (e: any) =>
      toast({
        title: "상태 변경 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const byStatus = useMemo(() => {
    const map = new Map<(typeof OPS_TASK_STATUSES)[number], OpsTask[]>();
    for (const s of OPS_TASK_STATUSES) map.set(s, []);
    for (const t of data?.items ?? []) {
      map.get(t.status)?.push(t);
    }
    return map;
  }, [data]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-primary" />
            작업 보드
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            운영 작업·액션 아이템. 학생 과제(/admin/assignments)와는 별개입니다.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-new-task">
          <Plus className="w-4 h-4 mr-1" /> 새 작업
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs">상태</Label>
          <Select
            value={filterStatus || "_all"}
            onValueChange={(v) => setFilterStatus(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">전체</SelectItem>
              {OPS_TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {OPS_TASK_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">담당자</Label>
          <Select
            value={filterAssignee || "_all"}
            onValueChange={(v) => setFilterAssignee(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">전체</SelectItem>
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
      </div>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : !data || data.items.length === 0 ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          작업이 없습니다. 회의록에서 액션 아이템을 만들거나 직접 추가해 보세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {OPS_TASK_STATUSES.map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <div
                key={status}
                className={`rounded border border-border p-2 ${STATUS_COLUMN_BG[status]} min-h-40`}
              >
                <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{OPS_TASK_STATUS_LABEL[status]}</span>
                  <span className="text-muted-foreground">{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      className="bg-card border border-border rounded p-2 text-xs space-y-1"
                      data-testid={`task-card-${t.id}`}
                    >
                      <div className="font-medium text-sm leading-tight flex items-start gap-1">
                        <span className="flex-1">{t.title}</span>
                        {isOverdue(t) ? (
                          <AlertTriangle
                            className="w-3 h-3 text-red-600 shrink-0 mt-0.5"
                            aria-label="기한 초과"
                          />
                        ) : null}
                      </div>
                      {t.description ? (
                        <p className="text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${PRIORITY_BADGE[t.priority]}`}
                        >
                          {OPS_TASK_PRIORITY_LABEL[t.priority]}
                        </Badge>
                        {t.assigneeName ? (
                          <span
                            className={`text-[10px] ${
                              t.assigneeActive === false
                                ? "text-muted-foreground italic"
                                : ""
                            }`}
                            title={
                              t.assigneeActive === false
                                ? "비활성 사용자"
                                : undefined
                            }
                          >
                            @{t.assigneeName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            담당자 미지정
                          </span>
                        )}
                        {t.dueDate ? (
                          <span
                            className={`text-[10px] ${
                              isOverdue(t) ? "text-red-600 font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {t.dueDate}
                          </span>
                        ) : null}
                      </div>
                      {t.sourceMeetingTitle && t.sourceMeetingId ? (
                        <Link
                          href={`/admin/meetings/${t.sourceMeetingId}`}
                          className="block text-[10px] text-primary hover:underline truncate"
                        >
                          ← {t.sourceMeetingTitle}
                        </Link>
                      ) : null}
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          updateStatus.mutate({
                            id: t.id,
                            status: v as (typeof OPS_TASK_STATUSES)[number],
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPS_TASK_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {OPS_TASK_STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
                  {items.length === 0 ? (
                    <li className="text-[10px] text-muted-foreground italic px-1 py-2">
                      없음
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 작업 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="t-title">제목 *</Label>
              <Input
                id="t-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="t-desc">설명</Label>
              <Textarea
                id="t-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>상태</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      status: v as (typeof OPS_TASK_STATUSES)[number],
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPS_TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {OPS_TASK_STATUS_LABEL[s]}
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="t-due">기한</Label>
                <Input
                  id="t-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>출처 회의 (선택)</Label>
              <Select
                value={form.sourceMeetingId || "_none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    sourceMeetingId: v === "_none" ? "" : v,
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="없음" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">없음</SelectItem>
                  {meetings?.items.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.title.trim() || create.isPending}
              data-testid="btn-save-task"
            >
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
