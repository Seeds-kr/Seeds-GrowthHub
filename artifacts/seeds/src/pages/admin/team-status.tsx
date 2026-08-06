import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LayoutGrid, AlertCircle } from "lucide-react";
import { api } from "@/lib/mvp3-api";

type TeamStatus = "good" | "watch" | "risk" | "blocked";

type Row = {
  id: number;
  title: string;
  cohortName: string | null;
  teamStatus: TeamStatus | null;
  blocker: string | null;
  openSupport: boolean;
  checkedAt: string | null;
  daysSinceCheck: number | null;
};

/** Column order runs calm → urgent so the eye lands on trouble at the right. */
const COLUMNS: { key: TeamStatus | "none"; label: string; style: string }[] = [
  { key: "good", label: "양호", style: "border-emerald-500/50" },
  { key: "watch", label: "관찰 필요", style: "border-amber-500/50" },
  { key: "risk", label: "위험", style: "border-orange-500/50" },
  { key: "blocked", label: "막힘", style: "border-red-500/50" },
  { key: "none", label: "상태체크 없음", style: "border-border" },
];

export default function AdminTeamStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-team-status"],
    queryFn: () =>
      api<{ items: Row[]; byStatus: Record<string, number> }>("/admin/team-status"),
  });

  const bucket = (k: string) =>
    (data?.items ?? []).filter((i) => (i.teamStatus ?? "none") === k);

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LayoutGrid className="h-6 w-6 text-primary" />팀 상태 보드
          </h1>
          <p className="text-sm text-muted-foreground">
            담당 멘토가 남긴 최신 상태체크 기준입니다. 개입 타이밍을 잡기 위한 신호이며
            학생 평가가 아닙니다 — <strong>학생에게는 노출되지 않습니다.</strong>
          </p>
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            프로젝트가 없습니다.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {COLUMNS.map((col) => {
              const items = bucket(col.key);
              return (
                <div key={col.key} className={`rounded-lg border-t-4 bg-muted/20 p-2 ${col.style}`}>
                  <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">
                    <span>{col.label}</span>
                    <Badge variant="secondary" className="h-5 text-xs">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      items.map((p) => (
                        <Link key={p.id} href={`/admin/projects/${p.id}`}>
                          <Card className="cursor-pointer transition hover:bg-background">
                            <CardContent className="space-y-1 p-2.5">
                              <p className="truncate text-sm font-medium">{p.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.cohortName ?? "기수 미지정"}
                              </p>
                              {p.blocker && (
                                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-orange-600" />
                                  <span className="min-w-0 line-clamp-2">{p.blocker}</span>
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                {p.openSupport && (
                                  <Badge className="bg-primary text-[10px] text-primary-foreground">
                                    지원 요청
                                  </Badge>
                                )}
                                <span
                                  className={`text-[11px] ${
                                    p.daysSinceCheck === null || p.daysSinceCheck > 14
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {p.daysSinceCheck === null
                                    ? "기록 없음"
                                    : `${p.daysSinceCheck}일 전`}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
