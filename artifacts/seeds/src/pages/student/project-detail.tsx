import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  api, PROJECT_STATUS_LABEL, ARTIFACT_TYPE_LABEL, FEEDBACK_TYPE_LABEL,
  type Project, type ProjectMember, type Mvp4Artifact, type ArtifactType,
  type FeedbackType,
} from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ResourceMissing } from "@/components/ResourceMissing";
import { TeamMeetings } from "@/components/team/TeamMeetings";
import { TeamLinks } from "@/components/team/TeamLinks";

type Detail = {
  project: Project;
  members: ProjectMember[];
  myMembership: { id: number; role: string | null; contributionSummary: string | null };
  artifacts: (Pick<Mvp4Artifact, "id" | "title" | "url" | "visibility"> & { artifactType: ArtifactType; description: string | null; createdAt: string })[];
  feedback: { id: number; feedbackType: FeedbackType; content: string; createdAt: string }[];
  tags: { id: number; name: string }[];
};

export default function StudentProjectDetail() {
  const [, params] = useRoute("/student/projects/:id");
  const id = Number(params?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["student-project", id],
    queryFn: () => api<Detail>(`/student/projects/${id}`),
    enabled: Number.isFinite(id),
  });
  // 로딩과 "없음"을 갈라야 한다. 하나로 묶으면 없는 자료를 열었을 때
  // 스피너가 영원히 돈다(느린 건지 없는 건지 알 수 없다).
  if (isLoading) return <><Loader2 className="animate-spin mx-auto" /></>;
  if (!data)
    return (
      <>
        <ResourceMissing label="프로젝트" backHref="/student/projects" />
      </>
    );
  const p = data.project;
  return (
    <>
      <div className="mb-4">
        <h1 className="text-3xl font-serif font-bold">{p.title}</h1>
        <Badge variant="outline" className="mt-1">{PROJECT_STATUS_LABEL[p.status]}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="">
          <CardHeader><CardTitle>프로젝트 정보</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">설명: </span>{p.description ?? "-"}</div>
            <div><span className="text-muted-foreground">문제 정의: </span>{p.problemStatement ?? "-"}</div>
            <div><span className="text-muted-foreground">해결책: </span>{p.solutionSummary ?? "-"}</div>
            <div><span className="text-muted-foreground">내 역할: </span>{data.myMembership.role ?? "-"}</div>
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle>팀원</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {data.members.map((m) => <div key={m.id}>{m.studentName}{m.role ? ` · ${m.role}` : ""}</div>)}
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle>아티팩트</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {data.artifacts.length === 0 ? <span className="text-muted-foreground">없음</span>
            : data.artifacts.map((a) => (
              <div key={a.id}><Badge variant="outline" className="mr-2">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge><a className="hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.title}</a></div>
            ))}
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle>피드백</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {data.feedback.length === 0 ? <span className="text-muted-foreground">없음</span>
            : data.feedback.map((f) => (
              <div key={f.id} className="border-b border-border py-1">
                <Badge variant="outline" className="">{FEEDBACK_TYPE_LABEL[f.feedbackType]}</Badge>
                <span className="text-xs text-muted-foreground ml-2">{format(new Date(f.createdAt), "yyyy-MM-dd")}</span>
                <div className="mt-1 whitespace-pre-wrap">{f.content}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>스킬 태그</CardTitle></CardHeader>
          <CardContent>
            {data.tags.length === 0 ? <span className="text-sm text-muted-foreground">태그 없음</span>
            : <div className="flex flex-wrap gap-1">{data.tags.map((t) => <Badge key={t.id} variant="outline" className="">{t.name}</Badge>)}</div>}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4">
        <TeamMeetings viewer="student" ownerType="project" ownerId={id} />
        <TeamLinks viewer="student" ownerType="project" ownerId={id} />
      </div>
    </>
  );
}
