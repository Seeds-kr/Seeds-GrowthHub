import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Cohort, type Program } from "@/lib/mvp3-api";
import { useRoute, Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type Detail = {
  student: {
    id: number; userId: number; name: string; email: string; phone: string | null; school: string | null;
    isActive: boolean; applicationId: number | null; createdAt: string;
  };
  application: any | null;
  cohorts: { id: number; name: string; status: string; joinedAt: string }[];
  programs: { id: number; name: string; cohortId: number; status: string }[];
  attendance: { id: number; sessionId: number; sessionTitle: string; scheduledAt: string; status: string; note: string | null }[];
  attendanceSummary: { present: number; late: number; absent: number; excused: number; total: number };
  submissions: { id: number; assignmentId: number; assignmentTitle: string; status: string; submittedAt: string | null; feedback: string | null }[];
};

export default function AdminStudentDetail() {
  const [, params] = useRoute("/admin/students/:id");
  const id = params?.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-student", id],
    queryFn: () => api<Detail>(`/admin/students/${id}`),
    enabled: !!id,
  });
  const { data: cohorts } = useQuery({ queryKey: ["admin-cohorts"], queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts") });
  const { data: programs } = useQuery({ queryKey: ["admin-programs"], queryFn: () => api<{ items: Program[] }>("/admin/programs") });

  const [cohortId, setCohortId] = useState("");
  const [programId, setProgramId] = useState("");

  const addCohort = useMutation({
    mutationFn: (cid: number) => api(`/admin/students/${id}/cohorts`, { method: "POST", body: { cohortId: cid } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-student", id] }); setCohortId(""); toast({ title: "기수 배정 완료" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const addProgram = useMutation({
    mutationFn: (pid: number) => api(`/admin/students/${id}/programs`, { method: "POST", body: { programId: pid } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-student", id] }); setProgramId(""); toast({ title: "프로그램 배정 완료" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const setActive = useMutation({
    mutationFn: (active: boolean) => api(`/admin/students/${id}`, { method: "PATCH", body: { isActive: active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-student", id] }),
  });

  if (isLoading || !data) return <AdminLayout><div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div></AdminLayout>;
  const s = data.student;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link href="/admin/students" className="text-sm text-muted-foreground hover:text-primary">← 학생 목록</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-serif font-bold">{s.name}</h1>
        <Button variant="outline" className="rounded-none" onClick={() => setActive.mutate(!s.isActive)}>
          {s.isActive ? "비활성화" : "활성화"}
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="rounded-none"><CardHeader><CardTitle>프로필</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <div>이메일: {s.email}</div><div>전화: {s.phone ?? "-"}</div><div>학교: {s.school ?? "-"}</div>
          <div>활성화: <Badge className="rounded-none">{s.isActive ? "활성" : "비활성"}</Badge></div>
          {s.applicationId && <div>지원서: <Link href={`/admin/applications/${s.applicationId}`} className="text-primary underline">#{s.applicationId}</Link></div>}
        </CardContent></Card>
        <Card className="rounded-none"><CardHeader><CardTitle>출석 요약</CardTitle></CardHeader><CardContent className="grid grid-cols-4 gap-2 text-sm">
          <div>출석: <strong>{data.attendanceSummary.present}</strong></div>
          <div>지각: <strong>{data.attendanceSummary.late}</strong></div>
          <div>결석: <strong>{data.attendanceSummary.absent}</strong></div>
          <div>인정: <strong>{data.attendanceSummary.excused}</strong></div>
        </CardContent></Card>
      </div>

      <ExtraRolesCard userId={s.userId} />

      <Card className="rounded-none mb-6"><CardHeader><CardTitle>기수 / 프로그램</CardTitle></CardHeader><CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">기수</div>
          <div className="flex gap-2 flex-wrap mb-3">{data.cohorts.map((c) => <Badge key={c.id} className="rounded-none">{c.name}</Badge>)}</div>
          <div className="flex gap-2">
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="기수 선택…" /></SelectTrigger>
              <SelectContent>{cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="rounded-none" disabled={!cohortId || addCohort.isPending} onClick={() => addCohort.mutate(Number(cohortId))}>배정</Button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">프로그램</div>
          <div className="flex gap-2 flex-wrap mb-3">{data.programs.map((p) => <Badge key={p.id} variant="outline" className="rounded-none">{p.name}</Badge>)}</div>
          <div className="flex gap-2">
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="프로그램 선택…" /></SelectTrigger>
              <SelectContent>{programs?.items.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="rounded-none" disabled={!programId || addProgram.isPending} onClick={() => addProgram.mutate(Number(programId))}>배정</Button>
          </div>
        </div>
      </CardContent></Card>

      <Card className="rounded-none mb-6"><CardHeader><CardTitle>출석 내역</CardTitle></CardHeader><CardContent>
        {data.attendance.length === 0 ? <div className="text-sm text-muted-foreground">출석 기록이 없습니다.</div>
        : <ul className="text-sm space-y-2">{data.attendance.map((a) => (
            <li key={a.id} className="flex justify-between border-b pb-2"><span>{a.sessionTitle}</span><span><Badge className="rounded-none mr-2">{a.status}</Badge>{format(new Date(a.scheduledAt), "yyyy-MM-dd HH:mm")}</span></li>
          ))}</ul>}
      </CardContent></Card>

      <Card className="rounded-none"><CardHeader><CardTitle>과제 제출 내역</CardTitle></CardHeader><CardContent>
        {data.submissions.length === 0 ? <div className="text-sm text-muted-foreground">제출 내역이 없습니다.</div>
        : <ul className="text-sm space-y-2">{data.submissions.map((s2) => (
            <li key={s2.id} className="flex justify-between border-b pb-2"><span>{s2.assignmentTitle}</span><span><Badge className="rounded-none mr-2">{s2.status}</Badge>{s2.submittedAt ? format(new Date(s2.submittedAt), "yyyy-MM-dd HH:mm") : "-"}</span></li>
          ))}</ul>}
      </CardContent></Card>
    </AdminLayout>
  );
}

function ExtraRolesCard({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const r = await api<{ items: { id: number; role: string; extraRoles: string[] }[] }>("/admin/users");
      return r.items.find((u) => u.id === userId) ?? null;
    },
  });
  const update = useMutation({
    mutationFn: (extraRoles: string[]) =>
      api(`/admin/users/${userId}`, { method: "PATCH", body: { extraRoles } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      toast({ title: "권한 업데이트 완료" });
    },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  if (!user) return null;
  const extras = user.extraRoles ?? [];
  const has = (r: string) => extras.includes(r);
  const toggle = (r: string) => {
    const next = has(r) ? extras.filter((x) => x !== r) : [...extras, r];
    update.mutate(next);
  };
  return (
    <Card className="rounded-none mb-6">
      <CardHeader><CardTitle>겸직 권한 (추가 역할)</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          이 학생 계정에 추가 역할을 부여하면 같은 계정으로 운영진/평가위원 화면도 사용할 수 있습니다. 기본 역할(학생)은 항상 유지됩니다.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={has("admin") ? "default" : "outline"}
            className="rounded-none"
            disabled={update.isPending}
            onClick={() => toggle("admin")}
          >
            운영진(admin) {has("admin") ? "✓" : ""}
          </Button>
          <Button
            variant={has("evaluator") ? "default" : "outline"}
            className="rounded-none"
            disabled={update.isPending}
            onClick={() => toggle("evaluator")}
          >
            평가위원(evaluator) {has("evaluator") ? "✓" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
