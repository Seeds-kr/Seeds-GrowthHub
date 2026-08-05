import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Announcement, type Cohort, type Program } from "@/lib/mvp3-api";
import { ANNOUNCEMENT_TARGET_LABEL, formatKoreanDate } from "@/lib/admin-labels";
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

  const targetLabel = (a: Announcement) => {
    const base = ANNOUNCEMENT_TARGET_LABEL[a.targetType] ?? a.targetType;
    if (a.targetType === "all") return base;
    const name = a.targetType === "cohort"
      ? cohorts?.items.find((c) => c.id === a.targetId)?.name
      : programs?.items.find((p) => p.id === a.targetId)?.name;
    return name ? `${base} · ${name}` : base;
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">공지사항</h1>
        <Button onClick={openNew}>+ 새 공지</Button>
      </div>
      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>대상</TableHead><TableHead>발행</TableHead><TableHead>작성일</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">공지가 없습니다.</TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell className="text-sm">{targetLabel(a)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={a.isPublished ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                    {a.isPublished ? "발행됨" : "초안"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{formatKoreanDate(a.createdAt)}</TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(a)}>수정</Button>
                  <Button size="sm" onClick={() => togglePublish(a)}>{a.isPublished ? "발행 취소" : "발행"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "공지 수정" : "새 공지"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input placeholder="예: 2주차 모임 장소 변경 안내" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>내용</Label>
              <Textarea className="min-h-32" placeholder="공지에 담을 내용을 적어주세요." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>대상</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as any, targetId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ANNOUNCEMENT_TARGET_LABEL.all}</SelectItem>
                  <SelectItem value="cohort">{ANNOUNCEMENT_TARGET_LABEL.cohort}</SelectItem>
                  <SelectItem value="program">{ANNOUNCEMENT_TARGET_LABEL.program}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.targetType === "cohort" && (
              <div className="space-y-1.5">
                <Label>기수</Label>
                <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                  <SelectTrigger><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                  <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.targetType === "program" && (
              <div className="space-y-1.5">
                <Label>프로그램</Label>
                <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                  <SelectTrigger><SelectValue placeholder="프로그램 선택…" /></SelectTrigger>
                  <SelectContent>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              즉시 발행
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.title || !form.content || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
