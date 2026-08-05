import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, AlertCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/mvp3-api";
import {
  TEAM_STATUS_LABEL,
  TEAM_STATUS_STYLE,
  type MentorTeam,
} from "@/lib/mentor-api";

/**
 * My Teams — the mentor's entry point.
 *
 * A card must be enough to decide WHERE TO INTERVENE without opening anything:
 * current status, how stale the read is, whether a blocker is open, and whether
 * ops has been asked for help.
 */
export default function MentorTeams() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mentor-teams"],
    queryFn: () => api<{ items: MentorTeam[]; total: number }>("/mentor/teams"),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6 text-primary" />
          담당 팀
        </h1>
        <p className="text-sm text-muted-foreground">
          내가 담당하는 프로젝트입니다. 상태체크는 30초면 됩니다 — 상태 하나만 골라도 제출됩니다.
        </p>
      </div>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
        </div>
      )}

      {isError && (
        <p className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          담당 팀을 불러오지 못했습니다.
        </p>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              아직 배정된 담당 팀이 없습니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              운영진이 프로젝트에 멘토를 배정하면 여기에 나타납니다.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.items.map((t) => (
          <Card key={t.id} className={t.checkOverdue ? "border-amber-500/60" : ""}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{t.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t.cohortName ?? "기수 미지정"} · 팀원 {t.memberCount}명
                  </p>
                </div>
                {t.latestCheck ? (
                  <Badge
                    variant="outline"
                    className={TEAM_STATUS_STYLE[t.latestCheck.teamStatus]}
                  >
                    {TEAM_STATUS_LABEL[t.latestCheck.teamStatus]}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    상태체크 없음
                  </Badge>
                )}
              </div>

              <div className="space-y-1 text-xs">
                <div
                  className={
                    t.checkOverdue
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  }
                >
                  {t.daysSinceCheck === null
                    ? "아직 상태체크가 없습니다"
                    : `마지막 상태체크 ${t.daysSinceCheck}일 전`}
                  {t.checkOverdue && " · 확인이 필요합니다"}
                </div>
                <div className="text-muted-foreground">
                  최근 산출물{" "}
                  {t.lastArtifactAt
                    ? format(new Date(t.lastArtifactAt), "yyyy.MM.dd")
                    : "없음"}
                </div>
              </div>

              {t.latestCheck?.blocker && (
                <div className="flex items-start gap-1.5 rounded bg-muted/50 p-2 text-xs">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                  <span className="min-w-0">{t.latestCheck.blocker}</span>
                </div>
              )}

              {t.latestCheck?.needsOpsSupport && !t.latestCheck.opsResolved && (
                <Badge className="bg-primary text-xs text-primary-foreground">
                  운영진 지원 요청 중
                </Badge>
              )}

              <Link href={`/mentor/projects/${t.id}`}>
                <Button size="sm" className="w-full gap-1">
                  열기 <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
