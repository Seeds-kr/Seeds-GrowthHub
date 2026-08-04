import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  api, PROJECT_STATUS_LABEL, ARTIFACT_TYPE_LABEL,
  ACTIVITY_SOURCE_LABEL, FEEDBACK_TYPE_LABEL,
  type StudentReport,
} from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ResourceMissing } from "@/components/ResourceMissing";

export default function AdminStudentReport() {
  const [, params] = useRoute("/admin/students/:id/report");
  const id = Number(params?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-student-report", id],
    queryFn: () => api<StudentReport>(`/admin/students/${id}/report`),
    enabled: Number.isFinite(id),
  });

  // 로딩과 "없음"을 갈라야 한다. 하나로 묶으면 없는 자료를 열었을 때

  // 스피너가 영원히 돈다(느린 건지 없는 건지 알 수 없다).

  if (isLoading) return <AdminLayout><Loader2 className="animate-spin mx-auto" /></AdminLayout>;

  if (!data)

    return (

      <AdminLayout>

        <ResourceMissing label="리포트" backHref="/admin/students" />

      </AdminLayout>

    );
  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-serif font-bold">학생 활동 리포트</h1>
        <Button className="rounded-none" onClick={() => window.print()}>인쇄</Button>
      </div>

      <div className="space-y-4">
        <Card className="rounded-none">
          <CardHeader><CardTitle>{data.student.name}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>이메일: {data.student.email}</div>
            <div>학교: {data.student.school ?? "-"}</div>
            <div>기수: {data.cohorts.map((c) => c.name).join(", ") || "-"}</div>
            <div>프로그램: {data.programs.map((p) => p.name).join(", ") || "-"}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>출석 요약</CardTitle></CardHeader>
          <CardContent className="text-sm flex gap-4">
            <span>출석 {data.attendanceSummary.present}</span>
            <span>지각 {data.attendanceSummary.late}</span>
            <span>결석 {data.attendanceSummary.absent}</span>
            <span>사유 {data.attendanceSummary.excused}</span>
            <span className="text-muted-foreground">총 {data.attendanceSummary.total}</span>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>과제 제출 ({data.submissions.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {data.submissions.length === 0 ? <div className="text-muted-foreground">제출 기록이 없습니다.</div>
            : data.submissions.map((s) => (
              <div key={s.id} className="flex justify-between border-b border-border py-1">
                <span>{s.title}</span>
                <span><Badge variant="outline" className="rounded-none">{s.status}</Badge> {s.submittedAt ? format(new Date(s.submittedAt), "MM-dd HH:mm") : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>프로젝트 ({data.projects.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {data.projects.length === 0 ? <div className="text-muted-foreground">프로젝트 없음</div>
            : data.projects.map((p) => (
              <div key={p.id} className="border-b border-border py-1">
                <span className="font-medium">{p.title}</span> · <Badge variant="outline" className="rounded-none">{PROJECT_STATUS_LABEL[p.status]}</Badge> · {p.role ?? "-"}
                {p.contributionSummary && <div className="text-xs text-muted-foreground mt-1">{p.contributionSummary}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>아티팩트 ({data.artifacts.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {data.artifacts.length === 0 ? <div className="text-muted-foreground">아티팩트 없음</div>
            : data.artifacts.map((a) => (
              <div key={a.id}><Badge variant="outline" className="rounded-none mr-2">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge><a className="hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.title}</a></div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>피드백 하이라이트 ({data.feedbackHighlights.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {data.feedbackHighlights.length === 0 ? <div className="text-muted-foreground">피드백 없음</div>
            : data.feedbackHighlights.map((f) => (
              <div key={f.id} className="border-b border-border py-1">
                <Badge variant="outline" className="rounded-none">{FEEDBACK_TYPE_LABEL[f.feedbackType]}</Badge>
                <div className="whitespace-pre-wrap mt-1">{f.content}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>스킬 태그 요약</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {data.skillTags.length === 0 ? <span className="text-muted-foreground">없음</span>
            : <div className="flex flex-wrap gap-1">{data.skillTags.map((t) => <Badge key={t.tagId} variant="outline" className="rounded-none">{t.name} · {t.count}</Badge>)}</div>}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>활동 타임라인 ({data.timeline.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {data.timeline.map((t) => (
              <div key={t.id} className="border-b border-border py-1">
                <span className="text-muted-foreground text-xs">{format(new Date(t.activityDate), "yyyy-MM-dd")}</span>
                <Badge variant="outline" className="rounded-none ml-2">{ACTIVITY_SOURCE_LABEL[t.sourceType]}</Badge>
                <span className="ml-2 font-medium">{t.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
