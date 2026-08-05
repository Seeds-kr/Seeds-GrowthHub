import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort } from "@/lib/mvp3-api";
import { COHORT_STATUSES, COHORT_STATUS_LABEL, COHORT_STATUS_TONE, formatKoreanDate, type CohortStatus } from "@/lib/admin-labels";
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
import { EmptyState } from "@/components/EmptyState";

export default function AdminCohorts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [form, setForm] = useState({ name: "", description: "", startDate: "", endDate: "", status: "draft" as CohortStatus });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts"),
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        description: form.description || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
      };
      return editing ? api(`/admin/cohorts/${editing.id}`, { method: "PATCH", body }) : api(`/admin/cohorts`, { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cohorts"] });
      setOpen(false); setEditing(null);
      setForm({ name: "", description: "", startDate: "", endDate: "", status: "draft" });
      toast({ title: "저장됨" });
    },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", startDate: "", endDate: "", status: "draft" }); setOpen(true); };
  const openEdit = (c: Cohort) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? "", startDate: c.startDate ?? "", endDate: c.endDate ?? "", status: c.status as CohortStatus });
    setOpen(true);
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">기수 관리</h1>
        <Button onClick={openNew}>+ 새 기수</Button>
      </div>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>이름</TableHead><TableHead>기간</TableHead><TableHead>상태</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={4} className="p-0">
                <EmptyState title="기수가 없습니다." />
              </TableCell></TableRow>
            : data?.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm">{formatKoreanDate(c.startDate)} ~ {formatKoreanDate(c.endDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={COHORT_STATUS_TONE[c.status as CohortStatus] ?? ""}>
                    {COHORT_STATUS_LABEL[c.status as CohortStatus] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => openEdit(c)}>수정</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "기수 수정" : "새 기수"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input placeholder="예: Seeds 1기" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="기수 소개 또는 운영 메모" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>시작일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>종료일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CohortStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COHORT_STATUSES.map((s) => <SelectItem key={s} value={s}>{COHORT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
