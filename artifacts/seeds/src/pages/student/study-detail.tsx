import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/markdown/MarkdownEditor";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/mvp3-api";
import { TeamMeetings } from "@/components/team/TeamMeetings";
import { TeamLinks } from "@/components/team/TeamLinks";

type Detail = {
  study: {
    id: number;
    title: string;
    topic: string | null;
    description: string | null;
    status: string;
    weeklyPlanMd: string;
  };
  isMember: boolean;
  members: { id: number; studentId: number; studentName: string; role: string | null }[];
  artifacts: {
    id: number;
    title: string;
    url: string | null;
    artifactType: string;
    visibility: string;
    createdAt: string;
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  planned: "준비 중",
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};

export default function StudentStudyDetail() {
  const [, params] = useRoute("/student/studies/:id");
  const id = Number(params?.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-study", id],
    queryFn: () => api<Detail>(`/student/studies/${id}`),
    enabled: Number.isFinite(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </>
    );
  }

  // 404 covers both "does not exist" and "not in my cohort" — no distinction.
  if (isError || !data) {
    return (
      <>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              볼 수 없는 스터디이거나 존재하지 않습니다.
            </p>
            <Link href="/student/studies">
              <Button variant="outline" size="sm" className="mt-3 gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> 스터디 목록
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  const s = data.study;

  return (
    <>
      <div className="space-y-4">
        <div>
          <Link href="/student/studies">
            <Button variant="ghost" size="sm" className="mb-2 gap-1 px-2">
              <ArrowLeft className="h-3.5 w-3.5" /> 스터디 목록
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{s.title}</h1>
            <Badge variant="outline" className="text-xs">
              {STATUS_LABEL[s.status] ?? s.status}
            </Badge>
            {data.isMember && (
              <Badge className="bg-primary text-xs text-primary-foreground">참여 중</Badge>
            )}
          </div>
          {s.topic && <p className="text-sm text-muted-foreground">{s.topic}</p>}
        </div>

        {s.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">소개</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{s.description}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">주차별 계획</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownView source={s.weeklyPlanMd} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">참여자</CardTitle>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <span className="text-xs text-muted-foreground">참여자가 없습니다.</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.members.map((m) => (
                  <Badge key={m.id} variant="outline" className="text-xs">
                    {m.studentName}
                    {m.role ? ` · ${m.role}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">자료 · 산출물</CardTitle>
            {!data.isMember && (
              <p className="text-xs text-muted-foreground">
                참여자가 아니므로 기수 전체에 공개된 자료만 보입니다.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.artifacts.length === 0 ? (
              <span className="text-xs text-muted-foreground">등록된 자료가 없습니다.</span>
            ) : (
              data.artifacts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 border-b border-border pb-1"
                >
                  <span className="min-w-0 truncate">{a.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), "yy.MM.dd")}
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                      >
                        열기 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4">
        <TeamMeetings viewer="student" ownerType="study" ownerId={id} />
        <TeamLinks viewer="student" ownerType="study" ownerId={id} />
      </div>
    </>
  );
}
