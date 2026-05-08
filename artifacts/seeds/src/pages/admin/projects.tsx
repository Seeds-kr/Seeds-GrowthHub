import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  api, PROJECT_STATUSES, PROJECT_STATUS_LABEL,
  type Project, type ProjectStatus, type Cohort, type Program,
} from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function AdminProjects() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cohortId: "", programId: "", title: "", description: "",
    status: "ideation" as ProjectStatus,
  });

  const { data, isLoading } = useQuery({ queryKey: ["admin-projects"], queryFn: () => api<{ items: Project[] }>("/admin/projects") });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });

  const create = useMutation({
    mutationFn: () => api("/admin/projects", { method: "POST", body: {
      cohortId: Number(form.cohortId),
      programId: form.programId ? Number(form.programId) : null,
      title: form.title, description: form.description || null,
      status: form.status,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-projects"] }); setOpen(false); toast({ title: "생성됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">프로젝트</h1>
        <Button className="rounded-none" onClick={() => { setForm({ cohortId: "", programId: "", title: "", description: "", status: "ideation" }); setOpen(true); }}>+ 새 프로젝트</Button>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>기수</TableHead><TableHead>프로그램</TableHead><TableHead>상태</TableHead><TableHead>생성일</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">프로젝트가 없습니다.</TableCell></TableRow>
            : data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.cohortName ?? `#${p.cohortId}`}</TableCell>
                <TableCell>{p.programName ?? "-"}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-none">{PROJECT_STATUS_LABEL[p.status]}</Badge></TableCell>
                <TableCell>{format(new Date(p.createdAt), "yyyy-MM-dd")}</TableCell>
                <TableCell><Link href={`/admin/projects/${p.id}`}><Button variant="outline" size="sm" className="rounded-none">상세</Button></Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle>새 프로젝트</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="rounded-none" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea className="rounded-none" placeholder="설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="기수 선택…" /></SelectTrigger>
              <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.programId || "none"} onValueChange={(v) => setForm({ ...form, programId: v === "none" ? "" : v })}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="프로그램 (선택)" /></SelectTrigger>
              <SelectContent><SelectItem value="none">프로그램 없음</SelectItem>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>취소</Button>
            <Button className="rounded-none" disabled={!form.cohortId || !form.title || create.isPending} onClick={() => create.mutate()}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
