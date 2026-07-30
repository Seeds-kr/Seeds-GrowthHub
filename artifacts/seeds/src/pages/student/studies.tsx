import { useQuery } from "@tanstack/react-query";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/mvp3-api";

type StudyRow = {
  id: number;
  title: string;
  topic: string | null;
  status: string;
  cohortName: string | null;
  isMember: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  planned: "준비 중",
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};

export default function StudentStudies() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-studies"],
    queryFn: () => api<{ items: StudyRow[]; total: number }>("/student/studies"),
  });

  const mine = data?.items.filter((s) => s.isMember) ?? [];
  const others = data?.items.filter((s) => !s.isMember) ?? [];

  return (
    <StudentLayout>
      <div className="space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6 text-primary" />내 스터디
          </h1>
          <p className="text-sm text-muted-foreground">
            참여 중인 스터디와, 같은 기수에서 열린 스터디를 볼 수 있습니다.
          </p>
        </div>

        {isLoading && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            아직 열린 스터디가 없습니다.
          </p>
        )}

        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">참여 중</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {mine.map((s) => (
                <Link key={s.id} href={`/student/studies/${s.id}`}>
                <Card className="cursor-pointer border-primary/40 transition hover:bg-muted/30">
                  <CardContent className="space-y-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {s.topic && (
                      <p className="text-xs text-muted-foreground">{s.topic}</p>
                    )}
                    <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      {s.cohortName ?? "기수 미지정"}
                      <ChevronRight className="h-3 w-3" />
                    </p>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              같은 기수의 다른 스터디
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {others.map((s) => (
                <Link key={s.id} href={`/student/studies/${s.id}`}>
                <Card className="cursor-pointer transition hover:bg-muted/30">
                  <CardContent className="space-y-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {s.topic && (
                      <p className="text-xs text-muted-foreground">{s.topic}</p>
                    )}
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </StudentLayout>
  );
}
