import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort, type Program, type AssignmentItem } from "@/lib/mvp3-api";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_TONE, formatKoreanDateTime, type TaskStatus } from "@/lib/admin-labels";
import { EyeOff, Loader2, Send } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function AdminAssignments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentItem | null>(null);
  const [form, setForm] = useState({ cohortId: "", programId: "", title: "", description: "", dueAt: "", status: "draft" as TaskStatus });

  const { data, isLoading } = useQuery({ queryKey: ["admin-assignments"], queryFn: () => api<{ items: AssignmentItem[] }>("/admin/assignments") });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        cohortId: Number(form.cohortId),
        programId: form.programId ? Number(form.programId) : null,
        title: form.title,
        description: form.description || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        status: form.status,
      };
      return editing ? api(`/admin/assignments/${editing.id}`, { method: "PATCH", body }) : api(`/admin/assignments`, { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-assignments"] }); setOpen(false); setEditing(null); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  // 새 과제는 draft 로 저장되고, draft 인 동안 학생 화면에는 절대 안 나온다
  // (student.ts 가 published/closed 만 내려준다). 그런데 게시 컨트롤이 [수정]
  // 다이얼로그 안에만 있어서, 운영진이 "과제 냈다" 고 생각하고 넘어가기 쉬웠다.
  // 실제로 유저 스토리 주행에서 만든 과제가 학생에게 안 보였다.
  const publish = useMutation({
    mutationFn: (a: AssignmentItem) =>
      api(`/admin/assignments/${a.id}`, { method: "PATCH", body: { status: "published" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
      toast({ title: "학생에게 공개했습니다" });
    },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ cohortId: "", programId: "", title: "", description: "", dueAt: "", status: "draft" }); setOpen(true); };
  const openEdit = (a: AssignmentItem) => {
    setEditing(a);
    setForm({
      cohortId: String(a.cohortId), programId: a.programId ? String(a.programId) : "",
      title: a.title, description: a.description ?? "",
      dueAt: a.dueAt ? format(new Date(a.dueAt), "yyyy-MM-dd'T'HH:mm") : "",
      status: a.status as TaskStatus,
    });
    setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">과제 관리</h1>
        <Button onClick={openNew}>+ 새 과제</Button>
      </div>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>기수/프로그램</TableHead><TableHead>마감일</TableHead><TableHead>상태</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">과제가 없습니다.</TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.cohortName} {a.programName ? `/ ${a.programName}` : ""}</TableCell>
                <TableCell className="tabular-nums">{formatKoreanDateTime(a.dueAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={TASK_STATUS_TONE[a.status as TaskStatus] ?? ""}>
                    {TASK_STATUS_LABEL[a.status as TaskStatus] ?? a.status}
                  </Badge>
                  {/* "초안" 만으로는 그게 무슨 뜻인지 알 수 없다. 지금 상태가
                      학생에게 어떻게 보이는지를 그대로 적는다. */}
                  {a.status === "draft" ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <EyeOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                      학생에게 안 보임
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  {a.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={() => publish.mutate(a)}
                      disabled={publish.isPending}
                      title="학생에게 공개합니다"
                    >
                      {publish.isPending && publish.variables?.id === a.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      게시
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => openEdit(a)}>수정</Button>
                  <Link href={`/admin/assignments/${a.id}`}><Button variant="outline" size="sm">제출 관리</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "과제 수정" : "새 과제"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>기수</Label>
                <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
                  <SelectTrigger><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                  <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>프로그램 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.programId || "none"} onValueChange={(v) => setForm({ ...form, programId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음</SelectItem>
                    {programs?.items.filter((p) => !form.cohortId || String(p.cohortId) === form.cohortId).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input placeholder="예: 1주차 - 컴포넌트 분해 연습" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="과제 요구사항, 제출 방법 등을 안내해 주세요." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>마감일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
                {form.dueAt
                  ? <p className="text-xs text-muted-foreground">{formatKoreanDateTime(new Date(form.dueAt).toISOString())}</p>
                  : <p className="text-xs text-muted-foreground">예: 2026년 5월 22일 (금) 오후 11:59</p>}
              </div>
              <div className="space-y-1.5">
                <Label>상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.cohortId || !form.title || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
