import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, FEEDBACK_TARGETS, FEEDBACK_TARGET_LABEL,
  FEEDBACK_TYPES, FEEDBACK_TYPE_LABEL,
  FEEDBACK_VISIBILITIES, FEEDBACK_VISIBILITY_LABEL,
  type FeedbackItem, type FeedbackTarget, type FeedbackType, type FeedbackVisibility,
  type Student,
} from "@/lib/mvp3-api";
import { formatKoreanDate } from "@/lib/admin-labels";
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

export default function AdminFeedback() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ targetType: "", studentId: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    targetType: "student" as FeedbackTarget, targetId: "", studentId: "",
    feedbackType: "general" as FeedbackType, content: "", visibility: "admin_only" as FeedbackVisibility,
  });

  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-feedback", filters],
    queryFn: () => api<{ items: FeedbackItem[] }>(`/admin/feedback${qs ? `?${qs}` : ""}`),
  });
  const { data: students } = useQuery({ queryKey: ["admin-students"], queryFn: () => api<{ items: Student[] }>("/admin/students") });

  const create = useMutation({
    mutationFn: () => api("/admin/feedback", { method: "POST", body: {
      targetType: form.targetType, targetId: Number(form.targetId),
      studentId: form.studentId ? Number(form.studentId) : null,
      feedbackType: form.feedbackType, content: form.content, visibility: form.visibility,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-feedback"] }); setOpen(false); toast({ title: "생성됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/feedback/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-feedback"] }),
  });

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">피드백</h1>
        <Button onClick={() => { setForm({ targetType: "student", targetId: "", studentId: "", feedbackType: "general", content: "", visibility: "admin_only" }); setOpen(true); }}>+ 새 피드백</Button>
      </div>

      <div className="rounded-lg bg-card border border-border p-4 mb-4 grid grid-cols-2 gap-3">
        <Select value={filters.targetType || "all"} onValueChange={(v) => setFilters({ ...filters, targetType: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="대상 유형" /></SelectTrigger>
          <SelectContent><SelectItem value="all">대상 전체</SelectItem>{FEEDBACK_TARGETS.map((t) => <SelectItem key={t} value={t}>{FEEDBACK_TARGET_LABEL[t]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.studentId || "all"} onValueChange={(v) => setFilters({ ...filters, studentId: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="학생" /></SelectTrigger>
          <SelectContent><SelectItem value="all">학생 전체</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>날짜</TableHead><TableHead>대상</TableHead><TableHead>학생</TableHead><TableHead>유형</TableHead><TableHead>공개</TableHead><TableHead>내용</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">피드백이 없습니다.</TableCell></TableRow>
            : data?.items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="text-sm">{formatKoreanDate(f.createdAt)}</TableCell>
                <TableCell>{FEEDBACK_TARGET_LABEL[f.targetType]} #{f.targetId}</TableCell>
                <TableCell>{f.studentName ?? "-"}</TableCell>
                <TableCell><Badge variant="outline">{FEEDBACK_TYPE_LABEL[f.feedbackType]}</Badge></TableCell>
                <TableCell><Badge variant="outline">{FEEDBACK_VISIBILITY_LABEL[f.visibility]}</Badge></TableCell>
                <TableCell className="text-sm max-w-md truncate">{f.content}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) del.mutate(f.id); }}>삭제</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>새 피드백</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>대상 유형</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as FeedbackTarget })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_TARGETS.map((t) => <SelectItem key={t} value={t}>{FEEDBACK_TARGET_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>대상 ID</Label>
                <Input type="number" placeholder="대상의 숫자 ID" value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>대상 학생 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Select value={form.studentId || "none"} onValueChange={(v) => setForm({ ...form, studentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">미지정</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>내용</Label>
              <Textarea placeholder="피드백 내용을 적어주세요." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={form.feedbackType} onValueChange={(v) => setForm({ ...form, feedbackType: v as FeedbackType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_TYPES.map((t) => <SelectItem key={t} value={t}>{FEEDBACK_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>공개 범위</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as FeedbackVisibility })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{FEEDBACK_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.targetId || !form.content || create.isPending} onClick={() => create.mutate()}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
