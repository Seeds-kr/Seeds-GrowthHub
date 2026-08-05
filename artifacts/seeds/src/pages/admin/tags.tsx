import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SkillTag } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";

export default function AdminTags() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SkillTag | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<{ items: SkillTag[] }>("/admin/tags") });

  const save = useMutation({
    mutationFn: () => editing
      ? api(`/admin/tags/${editing.id}`, { method: "PATCH", body: { name: form.name, description: form.description || null } })
      : api(`/admin/tags`, { method: "POST", body: { name: form.name, description: form.description || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tags"] }); setOpen(false); setEditing(null); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tags"] }),
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">스킬 태그</h1>
        <Button className="" onClick={() => { setEditing(null); setForm({ name: "", description: "" }); setOpen(true); }}>+ 새 태그</Button>
      </div>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>이름</TableHead><TableHead>설명</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={3} className="p-0">
                <EmptyState title="태그가 없습니다." />
              </TableCell></TableRow>
            : data?.items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.description ?? "-"}</TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" className="" onClick={() => { setEditing(t); setForm({ name: t.name, description: t.description ?? "" }); setOpen(true); }}>수정</Button>
                  <Button variant="outline" size="sm" className="" onClick={() => { if (confirm("삭제?")) del.mutate(t.id); }}>삭제</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="">
          <DialogHeader><DialogTitle>{editing ? "태그 수정" : "새 태그"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea className="" placeholder="설명 (선택)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="" onClick={() => setOpen(false)}>취소</Button>
            <Button className="" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
