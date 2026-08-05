import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import { api, type SessionItem, type AssignmentItem, type Announcement } from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

type Me = {
  student: { id: number; name: string; email: string };
  cohorts: { id: number; name: string; status: string }[];
  programs: { id: number; name: string; cohortId: number }[];
};

export default function StudentDashboard() {
  const me = useQuery({ queryKey: ["student-me"], queryFn: () => api<Me>("/student/me") });
  const sessions = useQuery({ queryKey: ["student-sessions"], queryFn: () => api<{ items: SessionItem[] }>("/student/sessions") });
  const assignments = useQuery({ queryKey: ["student-assignments"], queryFn: () => api<{ items: AssignmentItem[] }>("/student/assignments") });
  const announcements = useQuery({ queryKey: ["student-announcements"], queryFn: () => api<{ items: Announcement[] }>("/student/announcements") });

  if (me.isLoading) return <StudentLayout><Loader2 className="animate-spin mx-auto" /></StudentLayout>;
  const upcoming = (sessions.data?.items ?? []).filter((s) => new Date(s.scheduledAt).getTime() > Date.now() && s.status === "scheduled").slice(0, 5);

  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">안녕하세요, {me.data?.student.name}님</h1>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className=""><CardHeader><CardTitle>내 기수 / 프로그램</CardTitle></CardHeader><CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">{me.data?.cohorts.map((c) => <Badge key={c.id} className="">{c.name}</Badge>)}</div>
          <div className="flex flex-wrap gap-2">{me.data?.programs.map((p) => <Badge key={p.id} variant="outline" className="">{p.name}</Badge>)}</div>
          {me.data?.cohorts.length === 0 && <div className="text-sm text-muted-foreground">아직 배정된 기수가 없습니다.</div>}
        </CardContent></Card>

        <Card className=""><CardHeader><CardTitle>최근 공지</CardTitle></CardHeader><CardContent className="space-y-2">
          {(announcements.data?.items ?? []).slice(0, 3).map((a) => (
            <div key={a.id} className="border-b pb-2 last:border-0">
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.publishedAt ? format(new Date(a.publishedAt), "yyyy-MM-dd") : ""}</div>
            </div>
          ))}
          {announcements.data?.items.length === 0 && <div className="text-sm text-muted-foreground">공지가 없습니다.</div>}
        </CardContent></Card>
      </div>

      <Card className="mb-6"><CardHeader><CardTitle>다가오는 모임</CardTitle></CardHeader><CardContent>
        {upcoming.length === 0 ? <div className="text-sm text-muted-foreground">예정된 모임이 없습니다.</div>
        : <ul className="space-y-2 text-sm">{upcoming.map((s) => (
            <li key={s.id} className="flex justify-between border-b pb-2 last:border-0"><span>{s.title}</span><span>{format(new Date(s.scheduledAt), "yyyy-MM-dd HH:mm")}</span></li>
          ))}</ul>}
      </CardContent></Card>

      <Card className=""><CardHeader><CardTitle>활성 과제</CardTitle></CardHeader><CardContent>
        {(assignments.data?.items ?? []).filter((a) => a.status === "published").length === 0 ? <div className="text-sm text-muted-foreground">진행 중인 과제가 없습니다.</div>
        : <ul className="space-y-2 text-sm">{(assignments.data?.items ?? []).filter((a) => a.status === "published").map((a) => (
            <li key={a.id} className="flex justify-between border-b pb-2 last:border-0">
              <Link href={`/student/assignments/${a.id}`} className="font-medium hover:text-primary">{a.title}</Link>
              <span>{a.dueAt ? `마감 ${format(new Date(a.dueAt), "MM-dd HH:mm")}` : "마감 없음"}</span>
            </li>
          ))}</ul>}
      </CardContent></Card>
    </StudentLayout>
  );
}
