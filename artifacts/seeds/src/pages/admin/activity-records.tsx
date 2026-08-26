import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, ACTIVITY_SOURCES, ACTIVITY_SOURCE_LABEL,
  ACTIVITY_VISIBILITIES, ACTIVITY_VISIBILITY_LABEL,
  type ActivityRecord, type ActivitySource, type ActivityVisibility,
  type Cohort, type Program, type Student, type SkillTag,
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
import { EmptyState } from "@/components/EmptyState";

export default function AdminActivityRecords() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ studentId: "", cohortId: "", programId: "", sourceType: "", tagId: "" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [form, setForm] = useState({
    studentId: "", cohortId: "", programId: "",
    sourceType: "manual" as ActivitySource, title: "", description: "",
    visibility: "admin_only" as ActivityVisibility,
  });

  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity-records", filters],
    queryFn: () =>
        api<{ items: ActivityRecord[]; total: number; truncated: boolean }>(
          `/admin/activity-records${qs ? `?${qs}` : ""}`,
        ),
  });
  const { data: students } = useQuery({ queryKey: ["admin-students"], queryFn: () => api<{ items: Student[] }>("/admin/students") });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });
  const { data: tags } = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<{ items: SkillTag[] }>("/admin/tags") });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        studentId: Number(form.studentId), cohortId: Number(form.cohortId),
        programId: form.programId ? Number(form.programId) : null,
        sourceType: form.sourceType, title: form.title,
        description: form.description || null, visibility: form.visibility,
      };
      return editing
        ? api(`/admin/activity-records/${editing.id}`, { method: "PATCH", body })
        : api(`/admin/activity-records`, { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-activity-records"] }); setOpen(false); setEditing(null); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/activity-records/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-activity-records"] }); toast({ title: "삭제됨" }); },
  });

  const openNew = () => { setEditing(null); setForm({ studentId: "", cohortId: "", programId: "", sourceType: "manual", title: "", description: "", visibility: "admin_only" }); setOpen(true); };
  const openEdit = (r: ActivityRecord) => { setEditing(r); setForm({ studentId: String(r.studentId), cohortId: String(r.cohortId), programId: r.programId ? String(r.programId) : "", sourceType: r.sourceType, title: r.title, description: r.description ?? "", visibility: r.visibility }); setOpen(true); };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">활동 기록</h1>
          {/* 활동 기록은 학생 수 × 활동 수로 자라는 유일한 목록이다. 서버가
              상한까지만 주므로, 잘렸으면 그 사실과 좁히는 방법을 알린다. */}
          {!isLoading && data ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="text-record-count">
              전체 <strong className="text-foreground">{data.total}</strong>건
              {data.truncated ? (
                <span className="ml-1 text-amber-700 dark:text-amber-400">
                  (최근 {data.items.length}건만 표시 — 위 필터로 좁혀 주세요)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <Button onClick={openNew}>+ 새 기록</Button>
      </div>

      <div className="rounded-lg bg-card border border-border p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Select value={filters.studentId || "all"} onValueChange={(v) => setFilters({ ...filters, studentId: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="학생" /></SelectTrigger>
          <SelectContent><SelectItem value="all">학생 전체</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.cohortId || "all"} onValueChange={(v) => setFilters({ ...filters, cohortId: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="기수" /></SelectTrigger>
          <SelectContent><SelectItem value="all">기수 전체</SelectItem>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.programId || "all"} onValueChange={(v) => setFilters({ ...filters, programId: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="프로그램" /></SelectTrigger>
          <SelectContent><SelectItem value="all">프로그램 전체</SelectItem>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.sourceType || "all"} onValueChange={(v) => setFilters({ ...filters, sourceType: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="유형" /></SelectTrigger>
          <SelectContent><SelectItem value="all">유형 전체</SelectItem>{ACTIVITY_SOURCES.map((s) => <SelectItem key={s} value={s}>{ACTIVITY_SOURCE_LABEL[s]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.tagId || "all"} onValueChange={(v) => setFilters({ ...filters, tagId: v === "all" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="태그" /></SelectTrigger>
          <SelectContent><SelectItem value="all">태그 전체</SelectItem>{tags?.items.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>날짜</TableHead><TableHead>학생</TableHead><TableHead>유형</TableHead><TableHead>제목</TableHead><TableHead>공개</TableHead><TableHead>태그</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={7} className="p-0">
                <EmptyState title="기록이 없습니다." />
              </TableCell></TableRow>
            : data?.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{formatKoreanDate(r.activityDate)}</TableCell>
                <TableCell>{r.studentName ?? `#${r.studentId}`}</TableCell>
                <TableCell>{ACTIVITY_SOURCE_LABEL[r.sourceType]}</TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell><Badge variant="outline">{ACTIVITY_VISIBILITY_LABEL[r.visibility]}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{(r.tags ?? []).map((t) => t.name).join(", ")}</TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>수정</Button>
                  <Button variant="outline" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) del.mutate(r.id); }}>삭제</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "기록 수정" : "새 활동 기록"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>학생</Label>
                <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder="학생 선택…" /></SelectTrigger>
                  <SelectContent>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>기수</Label>
                <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
                  <SelectTrigger><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                  <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>프로그램 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.programId || "none"} onValueChange={(v) => setForm({ ...form, programId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">없음</SelectItem>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v as ActivitySource })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_SOURCES.map((s) => <SelectItem key={s} value={s}>{ACTIVITY_SOURCE_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input placeholder="예: 해커톤 본선 진출" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="활동에 대한 상세 내용" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>공개 범위</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as ActivityVisibility })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{ACTIVITY_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.studentId || !form.cohortId || !form.title || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
