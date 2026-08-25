import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SessionDetail, type SessionMaterial, type SessionActionItem } from "@/lib/mvp3-api";
import { Loader2, ArrowLeft, ExternalLink, Trash2, Plus } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { AttendanceGrid } from "@/components/session/AttendanceGrid";
import { DOC_TYPE_LABEL } from "@/lib/documents-api";

type DocItem = { id: number; title: string; docType: string; isTemplate: boolean; archivedAt: string | null };
type UserLite = { id: number; name: string; email: string };

const PREP_LABEL: Record<string, string> = { not_started: "준비 전", in_progress: "준비 중", ready: "준비 완료" };
const STATUS_LABEL: Record<string, string> = { scheduled: "예정", completed: "완료", cancelled: "취소됨" };
const PRIORITY_LABEL: Record<string, string> = { low: "낮음", medium: "보통", high: "높음", urgent: "긴급" };
const TASK_STATUS_LABEL: Record<string, string> = { todo: "할 일", in_progress: "진행 중", review: "검토", blocked: "막힘", done: "완료", canceled: "취소" };

function fmtDT(s: string) {
  return new Date(s).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminSessionDetail() {
  const [, params] = useRoute("/admin/sessions/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();
  const [showAttendance, setShowAttendance] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-session", id],
    queryFn: () => api<SessionDetail>(`/admin/sessions/${id}`),
    enabled: Number.isFinite(id),
  });
  const { data: docs } = useQuery({
    queryKey: ["admin-documents", "for-checklist"],
    queryFn: () => api<{ items: DocItem[] }>(`/admin/documents`),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/admin/sessions/${id}`, { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-session", id] }); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "저장 실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  // materials editor
  const [newMat, setNewMat] = useState({ label: "", url: "" });
  const addMaterial = () => {
    if (!newMat.label.trim() || !newMat.url.trim() || !data) return;
    const next: SessionMaterial[] = [...(data.materials ?? []), { label: newMat.label.trim(), url: newMat.url.trim() }];
    patch.mutate({ materials: next });
    setNewMat({ label: "", url: "" });
  };
  const removeMaterial = (idx: number) => {
    if (!data) return;
    const next = (data.materials ?? []).filter((_, i) => i !== idx);
    patch.mutate({ materials: next });
  };

  // action items
  const { data: actions } = useQuery({
    queryKey: ["admin-session-actions", id],
    queryFn: () => api<{ items: SessionActionItem[] }>(`/admin/sessions/${id}/action-items`),
    enabled: Number.isFinite(id),
  });
  const { data: assigneePool } = useQuery({
    queryKey: ["admin-users", "owner-pool"],
    queryFn: async () => {
      const [admins, mentors] = await Promise.all([
        api<{ items: UserLite[] }>(`/admin/users?role=admin`),
        api<{ items: UserLite[] }>(`/admin/users?role=mentor`),
      ]);
      const seen = new Set<number>();
      return [...admins.items, ...mentors.items].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
    },
  });
  const [actionOpen, setActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "" });
  const createAction = useMutation({
    mutationFn: () => api(`/admin/sessions/${id}/action-items`, {
      method: "POST",
      body: {
        title: actionForm.title,
        description: actionForm.description || undefined,
        priority: actionForm.priority,
        assigneeId: actionForm.assigneeId ? Number(actionForm.assigneeId) : null,
        dueDate: actionForm.dueDate || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-session-actions", id] });
      qc.invalidateQueries({ queryKey: ["admin-session", id] });
      setActionOpen(false);
      setActionForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "" });
      toast({ title: "후속 작업 생성됨" });
    },
    onError: (e: any) => toast({ title: "생성 실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  if (isLoading) return <><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></>;
  if (!data) return <><p className="text-muted-foreground">모임을 찾을 수 없습니다.</p></>;

  return (
    <>
      <Link href="/admin/sessions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" />모임 목록</Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-serif font-bold">{data.title}</h1>
          {data.isPublished === false && <Badge variant="outline" className="bg-muted text-muted-foreground border-border">비공개</Badge>}
        </div>
        <p className="text-muted-foreground">
          {data.cohortName}{data.programName ? ` · ${data.programName}` : ""} · {fmtDT(data.scheduledAt)} · {data.durationMinutes}분
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 개요 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <h2 className="font-semibold mb-4">개요</h2>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><div className="text-muted-foreground">담당자</div><div>{data.ownerName ?? "—"}{data.ownerEmail ? ` (${data.ownerEmail})` : ""}</div></div>
              <div><div className="text-muted-foreground">준비 상태</div><div>
                <Select value={data.prepStatus ?? "not_started"} onValueChange={(v) => patch.mutate({ prepStatus: v })}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{["not_started", "in_progress", "ready"].map((p) => <SelectItem key={p} value={p}>{PREP_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div></div>
              <div><div className="text-muted-foreground">상태</div><div>{STATUS_LABEL[data.status] ?? data.status}</div></div>
              <div><div className="text-muted-foreground">장소/링크</div><div>{data.locationOrLink ?? "—"}</div></div>
            </div>
            {data.description && <p className="text-sm whitespace-pre-wrap pt-4 border-t border-border">{data.description}</p>}
          </section>

          {/* 체크리스트 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <h2 className="font-semibold mb-4">준비 체크리스트</h2>
            {data.checklist ? (
              <div className="flex items-center justify-between p-3 bg-muted/30 border border-border">
                <div>
                  <Link href={`/admin/documents/${data.checklist.id}`} className="font-medium hover:underline">{data.checklist.title}</Link>
                  {data.checklist.archivedAt && <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">보관됨</Badge>}
                  <div className="text-xs text-muted-foreground mt-1">유형: {DOC_TYPE_LABEL[data.checklist.docType as keyof typeof DOC_TYPE_LABEL] ?? data.checklist.docType}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => patch.mutate({ checklistDocumentId: null })}>연결 해제</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">연결된 체크리스트가 없습니다.</p>
                <div className="flex gap-2">
                  <Select onValueChange={(v) => patch.mutate({ checklistDocumentId: Number(v) })}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="문서 선택…" /></SelectTrigger>
                    <SelectContent>
                      {docs?.items.filter((d) => !d.archivedAt).map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.title}{d.isTemplate ? " (템플릿)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* 후속 작업 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">후속 작업</h2>
              <Button size="sm" onClick={() => setActionOpen(true)}><Plus className="h-4 w-4 mr-1" />추가</Button>
            </div>
            {!actions || actions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 후속 작업이 없습니다. 회의에서 결정된 작업을 추가하세요.</p>
            ) : (
              <ul className="space-y-2">
                {actions.items.map((t) => (
                  <li key={t.id} className="flex items-start justify-between p-3 border border-border">
                    <div className="flex-1">
                      <div className="font-medium">{t.title}</div>
                      {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                      <div className="flex gap-2 mt-2 text-xs">
                        <Badge variant="outline">{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge>
                        <Badge variant="outline">{PRIORITY_LABEL[t.priority] ?? t.priority}</Badge>
                        {t.assigneeName && <Badge variant="outline">담당: {t.assigneeName}</Badge>}
                        {t.dueDate && <Badge variant="outline">마감: {t.dueDate}</Badge>}
                      </div>
                    </div>
                    <Link href={`/admin/tasks`}><Button variant="ghost" size="sm">관리 →</Button></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 자료 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <h2 className="font-semibold mb-4">자료 / 외부 링크</h2>
            <p className="text-xs text-muted-foreground mb-3">Google Drive / Notion 등의 외부 자료는 링크만 저장합니다 (내용 복제 안 함).</p>
            {(data.materials ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">아직 등록된 자료가 없습니다.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {data.materials.map((m, i) => (
                  <li key={i} className="flex items-center justify-between p-2 border border-border">
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-sm hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />{m.label}
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => removeMaterial(i)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input placeholder="라벨 (예: 발표 자료)" value={newMat.label} onChange={(e) => setNewMat({ ...newMat, label: e.target.value })} className="w-48" />
              <Input placeholder="https://…" value={newMat.url} onChange={(e) => setNewMat({ ...newMat, url: e.target.value })} className="flex-1" />
              <Button onClick={addMaterial} disabled={!newMat.label.trim() || !newMat.url.trim()}>추가</Button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* 출석 요약 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">출석</h2>
              <Button
                size="sm"
                variant={showAttendance ? "outline" : "default"}
                onClick={() => setShowAttendance((v) => !v)}
                data-testid="button-toggle-attendance"
              >
                {showAttendance ? "접기" : "출석 입력"}
              </Button>
            </div>
            {data.attendanceSummary.total === 0 ? (
              <p className="text-sm text-muted-foreground">아직 출석 기록이 없습니다.</p>
            ) : (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>전체 기록</dt><dd className="tabular-nums">{data.attendanceSummary.total}명</dd></div>
                <div className="flex justify-between"><dt className="text-primary">참석</dt><dd className="tabular-nums">{data.attendanceSummary.present}</dd></div>
                <div className="flex justify-between"><dt className="text-amber-700">지각</dt><dd className="tabular-nums">{data.attendanceSummary.late}</dd></div>
                <div className="flex justify-between"><dt className="text-red-700">결석</dt><dd className="tabular-nums">{data.attendanceSummary.absent}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">사유 결석</dt><dd className="tabular-nums">{data.attendanceSummary.excused}</dd></div>
              </dl>
            )}
            {/* 보는 곳과 고치는 곳을 갈라 두지 않는다 — 요약을 보고 고칠 것이
                생기면 여기서 바로 편다. 전에는 별도 화면으로 넘어가야 했다. */}
            {showAttendance && (
              <div className="mt-4 border-t pt-4">
                <AttendanceGrid sessionId={Number(id)} />
              </div>
            )}
          </section>

          {/* 빠른 액션 */}
          <section className="rounded-lg bg-card border border-border p-6">
            <h2 className="font-semibold mb-3">빠른 작업</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={data.isPublished ?? true} onChange={(e) => patch.mutate({ isPublished: e.target.checked })} />
                <span>학생에게 공개</span>
              </label>
              <p className="text-xs text-muted-foreground">비공개 모임은 학생 화면에서 보이지 않으며 내부 체크리스트도 노출되지 않습니다.</p>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>후속 작업 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>제목</Label><Input value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} placeholder="예: 다음 회의 안건 정리" /></div>
            <div className="space-y-1.5"><Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label><Textarea value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>우선순위</Label>
                <Select value={actionForm.priority} onValueChange={(v) => setActionForm({ ...actionForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>마감일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Input type="date" value={actionForm.dueDate} onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>담당자 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Select value={actionForm.assigneeId || "none"} onValueChange={(v) => setActionForm({ ...actionForm, assigneeId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {assigneePool?.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>취소</Button>
            <Button onClick={() => createAction.mutate()} disabled={!actionForm.title.trim() || createAction.isPending}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
