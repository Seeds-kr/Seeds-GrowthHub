import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort, type Program, type AssignmentItem } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const STATUSES = ["draft", "published", "closed"] as const;

export default function AdminAssignments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentItem | null>(null);
  const [form, setForm] = useState({ cohortId: "", programId: "", title: "", description: "", dueAt: "", status: "draft" as (typeof STATUSES)[number] });

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

  const openNew = () => { setEditing(null); setForm({ cohortId: "", programId: "", title: "", description: "", dueAt: "", status: "draft" }); setOpen(true); };
  const openEdit = (a: AssignmentItem) => {
    setEditing(a);
    setForm({
      cohortId: String(a.cohortId), programId: a.programId ? String(a.programId) : "",
      title: a.title, description: a.description ?? "",
      dueAt: a.dueAt ? format(new Date(a.dueAt), "yyyy-MM-dd'T'HH:mm") : "",
      status: a.status,
    });
    setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">과제 관리</h1>
        <Button className="rounded-none" onClick={openNew}>+ 새 과제</Button>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>기수/프로그램</TableHead><TableHead>마감일</TableHead><TableHead>상태</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">과제가 없습니다.</TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.cohortName} {a.programName ? `/ ${a.programName}` : ""}</TableCell>
                <TableCell>{a.dueAt ? format(new Date(a.dueAt), "yyyy-MM-dd HH:mm") : "-"}</TableCell>
                <TableCell><Badge className="rounded-none">{a.status}</Badge></TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => openEdit(a)}>수정</Button>
                  <Link href={`/admin/assignments/${a.id}`}><Button size="sm" className="rounded-none">제출 관리</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle>{editing ? "과제 수정" : "새 과제"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="기수 선택…" /></SelectTrigger>
              <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.programId || "none"} onValueChange={(v) => setForm({ ...form, programId: v === "none" ? "" : v })}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="프로그램(선택)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                {programs?.items.filter((p) => !form.cohortId || String(p.cohortId) === form.cohortId).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="rounded-none" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea className="rounded-none" placeholder="설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input type="datetime-local" className="rounded-none" placeholder="마감일" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>취소</Button>
            <Button className="rounded-none" disabled={!form.cohortId || !form.title || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
