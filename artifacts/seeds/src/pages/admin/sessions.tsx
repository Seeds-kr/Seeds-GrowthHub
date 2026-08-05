import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort, type Program, type SessionItem } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const TYPES = ["orientation", "workshop", "mentoring", "project_work", "presentation", "review", "other"] as const;
const STATUSES = ["scheduled", "completed", "cancelled"] as const;
const PREP_STATUSES = ["not_started", "in_progress", "ready"] as const;

const PREP_LABEL: Record<(typeof PREP_STATUSES)[number], string> = {
  not_started: "준비 전",
  in_progress: "준비 중",
  ready: "준비 완료",
};
const PREP_TONE: Record<(typeof PREP_STATUSES)[number], string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  ready: "bg-primary/10 text-primary border-primary/20",
};

const TYPE_LABEL: Record<(typeof TYPES)[number], string> = {
  orientation: "오리엔테이션",
  workshop: "워크샵",
  mentoring: "멘토링",
  project_work: "프로젝트 활동",
  presentation: "발표",
  review: "리뷰",
  other: "기타",
};

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소됨",
};

const STATUS_TONE: Record<(typeof STATUSES)[number], string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function formatKoreanDateTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSessions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SessionItem | null>(null);
  const [filterCohort, setFilterCohort] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    cohortId: "", programId: "", title: "", description: "",
    scheduledAt: "", durationMinutes: "60", locationOrLink: "",
    sessionType: "workshop" as (typeof TYPES)[number], status: "scheduled" as (typeof STATUSES)[number],
    ownerId: "", prepStatus: "not_started" as (typeof PREP_STATUSES)[number], isPublished: true,
  });

  const params = new URLSearchParams();
  if (filterCohort !== "all") params.set("cohortId", filterCohort);
  if (filterStatus !== "all") params.set("status", filterStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-sessions", filterCohort, filterStatus],
    queryFn: () => api<{ items: SessionItem[] }>(`/admin/sessions?${params.toString()}`),
  });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });
  const { data: owners } = useQuery({
    queryKey: ["admin-users", "owner-pool"],
    queryFn: async () => {
      const [admins, mentors] = await Promise.all([
        api<{ items: { id: number; name: string; email: string }[] }>("/admin/users?role=admin"),
        api<{ items: { id: number; name: string; email: string }[] }>("/admin/users?role=mentor"),
      ]);
      const seen = new Set<number>();
      return [...admins.items, ...mentors.items].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        cohortId: Number(form.cohortId),
        programId: form.programId ? Number(form.programId) : null,
        title: form.title,
        description: form.description || null,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        locationOrLink: form.locationOrLink || null,
        sessionType: form.sessionType,
        status: form.status,
        ownerId: form.ownerId ? Number(form.ownerId) : null,
        prepStatus: form.prepStatus,
        isPublished: form.isPublished,
      };
      return editing ? api(`/admin/sessions/${editing.id}`, { method: "PATCH", body }) : api(`/admin/sessions`, { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sessions"] }); setOpen(false); setEditing(null); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ cohortId: "", programId: "", title: "", description: "", scheduledAt: "", durationMinutes: "60", locationOrLink: "", sessionType: "workshop", status: "scheduled", ownerId: "", prepStatus: "not_started", isPublished: true });
    setOpen(true);
  };
  const openEdit = (s: SessionItem) => {
    setEditing(s);
    setForm({
      cohortId: String(s.cohortId), programId: s.programId ? String(s.programId) : "",
      title: s.title, description: s.description ?? "",
      scheduledAt: format(new Date(s.scheduledAt), "yyyy-MM-dd'T'HH:mm"),
      durationMinutes: String(s.durationMinutes),
      locationOrLink: s.locationOrLink ?? "",
      sessionType: s.sessionType as any, status: s.status,
      ownerId: s.ownerId ? String(s.ownerId) : "",
      prepStatus: (s.prepStatus ?? "not_started") as (typeof PREP_STATUSES)[number],
      isPublished: s.isPublished ?? true,
    });
    setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">모임 관리</h1>
        <Button onClick={openNew}>+ 새 모임</Button>
      </div>
      <div className="rounded-lg bg-card border border-border p-4 mb-6 flex gap-4">
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 기수</SelectItem>
            {cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>기수/프로그램</TableHead><TableHead>일시</TableHead><TableHead>담당자</TableHead><TableHead>준비</TableHead><TableHead>상태</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">모임이 없습니다.</TableCell></TableRow>
            : data?.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/sessions/${s.id}`}><a className="hover:underline">{s.title}</a></Link>
                  {s.isPublished === false && <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground border-border">비공개</Badge>}
                </TableCell>
                <TableCell>{s.cohortName} {s.programName ? `/ ${s.programName}` : ""}</TableCell>
                <TableCell className="tabular-nums">{formatKoreanDateTime(s.scheduledAt)}</TableCell>
                <TableCell className="text-sm">{s.ownerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={PREP_TONE[(s.prepStatus ?? "not_started") as (typeof PREP_STATUSES)[number]]}>
                    {PREP_LABEL[(s.prepStatus ?? "not_started") as (typeof PREP_STATUSES)[number]]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[s.status as (typeof STATUSES)[number]] ?? ""}>
                    {STATUS_LABEL[s.status as (typeof STATUSES)[number]] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  <Link href={`/admin/sessions/${s.id}`}><Button variant="outline" size="sm">상세</Button></Link>
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)}>수정</Button>
                  <Link href={`/admin/sessions/${s.id}/attendance`}><Button size="sm">출석</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "모임 수정" : "새 모임"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>기수</Label>
                <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
                  <SelectTrigger><SelectValue placeholder="기수 선택…" /></SelectTrigger>
                  <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>프로그램 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.programId || "none"} onValueChange={(v) => setForm({ ...form, programId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음</SelectItem>
                    {programs?.items.filter((p) => !form.cohortId || String(p.cohortId) === form.cohortId).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input placeholder="예: 프론트엔드 1주차 워크샵" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>설명 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Textarea placeholder="이번 모임에서 다룰 내용을 적어주세요." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1.5">
                <Label>일시</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                {form.scheduledAt ? (
                  <p className="text-xs text-muted-foreground">{formatKoreanDateTime(new Date(form.scheduledAt).toISOString())}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">예: 2026년 5월 15일 (금) 오후 7시</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>소요 시간(분)</Label>
                <Input type="number" min={5} step={5} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>장소 또는 링크 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Input placeholder="예: 공학관 301호 / https://meet.google.com/…" value={form.locationOrLink} onChange={(e) => setForm({ ...form, locationOrLink: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>유형</Label>
                <Select value={form.sessionType} onValueChange={(v) => setForm({ ...form, sessionType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>담당자 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                <Select value={form.ownerId || "none"} onValueChange={(v) => setForm({ ...form, ownerId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {owners?.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>준비 상태</Label>
                <Select value={form.prepStatus} onValueChange={(v) => setForm({ ...form, prepStatus: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PREP_STATUSES.map((p) => <SelectItem key={p} value={p}>{PREP_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              <span>학생에게 공개 (체크 해제 시 학생 화면에서 보이지 않음)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!form.cohortId || !form.title || !form.scheduledAt || save.isPending} onClick={() => save.mutate()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
