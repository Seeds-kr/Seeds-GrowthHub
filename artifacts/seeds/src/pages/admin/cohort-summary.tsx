import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, type CohortSummary } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResourceMissing } from "@/components/ResourceMissing";

export default function AdminCohortSummary() {
  const [, params] = useRoute("/admin/cohorts/:id/summary");
  const id = Number(params?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-cohort-summary", id],
    queryFn: () => api<CohortSummary>(`/admin/cohorts/${id}/summary`),
    enabled: Number.isFinite(id),
  });
  // 로딩과 "없음"을 갈라야 한다. 하나로 묶으면 없는 자료를 열었을 때
  // 스피너가 영원히 돈다(느린 건지 없는 건지 알 수 없다).
  if (isLoading) return <AdminLayout><Loader2 className="animate-spin mx-auto" /></AdminLayout>;
  if (!data)
    return (
      <AdminLayout>
        <ResourceMissing label="기수 요약" backHref="/admin/cohorts" />
      </AdminLayout>
    );
  return (
    <AdminLayout>
      <h1 className="text-3xl font-serif font-bold mb-4">{data.cohort.name} · 활동 요약</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className=""><CardHeader><CardTitle className="text-sm">학생 수</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.studentCount}</CardContent></Card>
        <Card className=""><CardHeader><CardTitle className="text-sm">프로젝트 수</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.projectCount}</CardContent></Card>
        <Card className=""><CardHeader><CardTitle className="text-sm">아티팩트 수</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.artifactCount}</CardContent></Card>
        <Card className=""><CardHeader><CardTitle className="text-sm">출석 기록</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.attendanceOverview.total}</CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="">
          <CardHeader><CardTitle>출석 분포</CardTitle></CardHeader>
          <CardContent className="text-sm flex gap-4">
            <span>출석 {data.attendanceOverview.present}</span>
            <span>지각 {data.attendanceOverview.late}</span>
            <span>결석 {data.attendanceOverview.absent}</span>
            <span>사유 {data.attendanceOverview.excused}</span>
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle>과제 제출 분포</CardTitle></CardHeader>
          <CardContent className="text-sm flex gap-3 flex-wrap">
            {data.submissionOverview.length === 0 ? <span className="text-muted-foreground">데이터 없음</span>
            : data.submissionOverview.map((s) => <span key={s.status}>{s.status}: {s.count}</span>)}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>스킬 태그 분포</CardTitle></CardHeader>
          <CardContent>
            {data.skillTagDistribution.length === 0 ? <span className="text-sm text-muted-foreground">태그 없음</span>
            : <div className="flex flex-wrap gap-1">{data.skillTagDistribution.map((t) => <Badge key={t.tagId} variant="outline" className="">{t.name} · {t.count}</Badge>)}</div>}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>활동 기록이 없는 학생 ({data.studentsMissingActivity.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {data.studentsMissingActivity.length === 0 ? <span className="text-muted-foreground">없음</span>
            : <div className="flex flex-wrap gap-2">{data.studentsMissingActivity.map((s) => (
                <Link key={s.id} href={`/admin/students/${s.id}`}><Badge variant="outline" className="cursor-pointer">{s.name}</Badge></Link>
              ))}</div>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
