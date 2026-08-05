import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, ARTIFACT_TYPES, ARTIFACT_TYPE_LABEL,
  ARTIFACT_VISIBILITIES, ARTIFACT_VISIBILITY_LABEL,
  type Mvp4Artifact, type ArtifactType, type ArtifactVisibility,
  type Student, type Project,
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

export default function AdminArtifacts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: "", projectId: "", title: "", description: "", url: "",
    artifactType: "link" as ArtifactType, visibility: "student_visible" as ArtifactVisibility,
  });

  const { data, isLoading } = useQuery({ queryKey: ["admin-artifacts"], queryFn: () => api<{ items: Mvp4Artifact[] }>("/admin/artifacts") });
  const { data: students } = useQuery({ queryKey: ["admin-students"], queryFn: () => api<{ items: Student[] }>("/admin/students") });
  const { data: projects } = useQuery({ queryKey: ["admin-projects"], queryFn: () => api<{ items: Project[] }>("/admin/projects") });

  const create = useMutation({
    mutationFn: () => api("/admin/artifacts", { method: "POST", body: {
      studentId: form.studentId ? Number(form.studentId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      title: form.title, description: form.description || null, url: form.url,
      artifactType: form.artifactType, visibility: form.visibility,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-artifacts"] }); setOpen(false); toast({ title: "생성됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/artifacts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-artifacts"] }),
  });

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">아티팩트</h1>
        <Button onClick={() => { setForm({ studentId: "", projectId: "", title: "", description: "", url: "", artifactType: "link", visibility: "student_visible" }); setOpen(true); }}>+ 새 아티팩트</Button>
      </div>
      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>유형</TableHead><TableHead>학생</TableHead><TableHead>프로젝트</TableHead><TableHead>공개</TableHead><TableHead>링크</TableHead><TableHead>생성일</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">아티팩트가 없습니다.</TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell><Badge variant="outline">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge></TableCell>
                <TableCell>{a.studentName ?? "-"}</TableCell>
                <TableCell>{a.projectTitle ?? "-"}</TableCell>
                <TableCell><Badge variant="outline">{ARTIFACT_VISIBILITY_LABEL[a.visibility]}</Badge></TableCell>
                <TableCell><a className="text-primary hover:underline text-sm" href={a.url} target="_blank" rel="noreferrer">열기</a></TableCell>
                <TableCell className="text-sm">{formatKoreanDate(a.createdAt)}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) del.mutate(a.id); }}>삭제</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>새 아티팩트</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input placeholder="예: 1주차 발표 슬라이드" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="아티팩트에 대한 간단한 설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>학생 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.studentId || "none"} onValueChange={(v) => setForm({ ...form, studentId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">미지정</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>프로젝트 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.projectId || "none"} onValueChange={(v) => setForm({ ...form, projectId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">미지정</SelectItem>{projects?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={form.artifactType} onValueChange={(v) => setForm({ ...form, artifactType: v as ArtifactType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_TYPES.map((t) => <SelectItem key={t} value={t}>{ARTIFACT_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>공개 범위</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as ArtifactVisibility })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{ARTIFACT_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.title || !form.url || create.isPending} onClick={() => create.mutate()}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
