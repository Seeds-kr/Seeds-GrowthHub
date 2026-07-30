import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { MentorLayout } from "@/components/layout/MentorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCircle, ClipboardList, FolderKanban, ArrowRight } from "lucide-react";
import { api } from "@/lib/mvp3-api";
import { TEAM_STATUS_LABEL, TEAM_STATUS_STYLE, type MentorDashboard as Summary } from "@/lib/mentor-api";

export default function MentorDashboard() {
  const { data } = useQuery({
    queryKey: ["mentor-dashboard"],
    queryFn: () => api<Summary>("/mentor/dashboard"),
  });

  return (
    <MentorLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em]">멘토 홈</h1>
          <p className="text-muted-foreground mt-2">
            Seeds 멘토를 위한 공간입니다. 담당 팀 상태를 확인하고 짧게 피드백을 남기세요.
          </p>
        </div>

        {data && data.teamCount > 0 && (
          <Card className="rounded-none border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-primary" /> 담당 팀 {data.teamCount}개
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.needsCheckIn.length > 0 && (
                <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="mb-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    상태체크가 필요한 팀 {data.needsCheckIn.length}개
                  </div>
                  <div className="space-y-1">
                    {data.needsCheckIn.map((t) => (
                      <Link key={t.projectId} href={`/mentor/projects/${t.projectId}`}
                        className="flex items-center justify-between gap-2 text-xs hover:underline">
                        <span className="min-w-0 truncate">{t.projectTitle}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {t.daysSinceCheck === null ? "기록 없음" : `${t.daysSinceCheck}일 전`}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.atRisk.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">주의가 필요한 팀</div>
                  {data.atRisk.map((t) => (
                    <Link key={t.projectId} href={`/mentor/projects/${t.projectId}`}
                      className="flex items-center justify-between gap-2 text-xs hover:underline">
                      <span className="min-w-0 truncate">{t.projectTitle}</span>
                      <Badge variant="outline" className={`${TEAM_STATUS_STYLE[t.teamStatus]} shrink-0 text-xs`}>
                        {TEAM_STATUS_LABEL[t.teamStatus]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}

              {data.openSupportRequests > 0 && (
                <p className="text-xs text-muted-foreground">
                  운영진 지원 요청 {data.openSupportRequests}건이 처리 대기 중입니다.
                </p>
              )}

              {data.needsCheckIn.length === 0 && data.atRisk.length === 0 && (
                <p className="text-xs text-muted-foreground">지금 확인이 필요한 팀은 없습니다.</p>
              )}

              <Link href="/mentor/teams">
                <Button size="sm" className="gap-1 rounded-none">
                  담당 팀 전체 보기 <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="w-4 h-4 text-primary" /> 내 프로필
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>공개 페이지에 표시되는 내 소개·연락처를 수정합니다.</p>
              <Link href="/mentor/profile">
                <Button size="sm" className="rounded-none">프로필 편집</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" /> 회원 디렉터리
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>멘토 · 운영진 · 학생 명단과 연락처를 볼 수 있습니다.</p>
              <Link href="/people">
                <Button size="sm" variant="outline" className="rounded-none">디렉터리 열기</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="w-4 h-4 text-primary" /> 평가 배정
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>운영진이 배정한 지원자 평가가 있다면 여기서 확인합니다.</p>
              <Link href="/evaluator">
                <Button size="sm" variant="outline" className="rounded-none">평가 화면</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </MentorLayout>
  );
}
