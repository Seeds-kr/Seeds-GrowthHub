import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Announcement, type Cohort, type Program } from "@/lib/mvp3-api";
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

export default function AdminAnnouncements() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", targetType: "all" as "all" | "cohort" | "program",
    targetId: "", isPublished: false,
  });

  const { data, isLoading } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => api<{ items: Announcement[] }>("/admin/announcements") });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title, content: form.content,
        targetType: form.targetType,
        targetId: form.targetType === "all" ? null : (form.targetId ? Number(form.targetId) : null),
        isPublished: form.isPublished,
      };
      return editing ? api(`/admin/announcements/${editing.id}`, { method: "PATCH", body }) : api(`/admin/announcements`, { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-announcements"] }); setOpen(false); setEditing(null); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ title: "", content: "", targetType: "all", targetId: "", isPublished: false }); setOpen(true); };
  const openEdit = (a: Announcement) => { setEditing(a); setForm({ title: a.title, content: a.content, targetType: a.targetType, targetId: a.targetId ? String(a.targetId) : "", isPublished: a.isPublished }); setOpen(true); };
  const togglePublish = (a: Announcement) => { setEditing(a); setForm({ title: a.title, content: a.content, targetType: a.targetType, targetId: a.targetId ? String(a.targetId) : "", isPublished: !a.isPublished }); save.mutate(); };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">공지사항</h1>
        <Button className="rounded-none" onClick={openNew}>+ 새 공지</Button>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>대상</TableHead><TableHead>발행</TableHead><TableHead>작성일</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">공지가 없습니다.</TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.targetType}{a.targetId ? ` #${a.targetId}` : ""}</TableCell>
                <TableCell><Badge variant={a.isPublished ? "default" : "outline"} className="rounded-none">{a.isPublished ? "발행됨" : "초안"}</Badge></TableCell>
                <TableCell>{format(new Date(a.createdAt), "yyyy-MM-dd")}</TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => openEdit(a)}>수정</Button>
                  <Button size="sm" className="rounded-none" onClick={() => togglePublish(a)}>{a.isPublished ? "발행 취소" : "발행"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle>{editing ? "공지 수정" : "새 공지"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="rounded-none" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea className="rounded-none min-h-32" placeholder="내용" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as any, targetId: "" })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학생</SelectItem>
                <SelectItem value="cohort">특정 기수</SelectItem>
                <SelectItem value="program">특정 프로그램</SelectItem>
              </SelectContent>
            </Select>
            {form.targetType === "cohort" && (
              <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {form.targetType === "program" && (
              <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="프로그램 선택…" /></SelectTrigger>
                <SelectContent>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              즉시 발행
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>취소</Button>
            <Button className="rounded-none" disabled={!form.title || !form.content || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
