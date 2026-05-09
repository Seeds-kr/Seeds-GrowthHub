import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort, type Program } from "@/lib/mvp3-api";
import { PROGRAM_STATUSES, PROGRAM_STATUS_LABEL, PROGRAM_STATUS_TONE, type ProgramStatus } from "@/lib/admin-labels";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function AdminPrograms() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState({ cohortId: "", name: "", description: "", status: "draft" as ProgramStatus });

  const { data, isLoading } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        cohortId: Number(form.cohortId),
        name: form.name,
        description: form.description || null,
        status: form.status,
      };
      return editing ? api(`/admin/programs/${editing.id}`, { method: "PATCH", body }) : api(`/admin/programs`, { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-programs"] });
      setOpen(false); setEditing(null);
      setForm({ cohortId: "", name: "", description: "", status: "draft" });
      toast({ title: "저장됨" });
    },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ cohortId: "", name: "", description: "", status: "draft" }); setOpen(true); };
  const openEdit = (p: Program) => { setEditing(p); setForm({ cohortId: String(p.cohortId), name: p.name, description: p.description ?? "", status: p.status as ProgramStatus }); setOpen(true); };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">프로그램 / 트랙</h1>
        <Button onClick={openNew}>+ 새 프로그램</Button>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>이름</TableHead><TableHead>기수</TableHead><TableHead>상태</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">프로그램이 없습니다.</TableCell></TableRow>
            : data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.cohortName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={PROGRAM_STATUS_TONE[p.status as ProgramStatus] ?? ""}>
                    {PROGRAM_STATUS_LABEL[p.status as ProgramStatus] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => openEdit(p)}>수정</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "프로그램 수정" : "새 프로그램"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>기수</Label>
              <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
                <SelectTrigger><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input placeholder="예: 프론트엔드 트랙" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="이 프로그램에서 다루는 내용" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProgramStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROGRAM_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROGRAM_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.name || !form.cohortId || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
