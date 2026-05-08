import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import {
  api, ARTIFACT_TYPE_LABEL, ARTIFACT_VISIBILITY_LABEL,
  type Mvp4Artifact,
} from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function StudentArtifacts() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-artifacts"],
    queryFn: () => api<{ items: Mvp4Artifact[] }>("/student/artifacts"),
  });
  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">내 아티팩트</h1>
      {isLoading ? <Loader2 className="animate-spin mx-auto" />
      : data?.items.length === 0 ? <div className="text-muted-foreground">아티팩트가 없습니다.</div>
      : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{data?.items.map((a) => (
        <Card key={a.id} className="rounded-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <a className="hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
              <Badge variant="outline" className="rounded-none">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>{a.description ?? ""}</div>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="rounded-none">{ARTIFACT_VISIBILITY_LABEL[a.visibility]}</Badge>
              <span>{format(new Date(a.createdAt), "yyyy-MM-dd")}</span>
            </div>
          </CardContent>
        </Card>
      ))}</div>}
    </StudentLayout>
  );
}
