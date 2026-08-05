import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, PROJECT_STATUS_LABEL, type Project } from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function StudentProjects() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-projects"],
    queryFn: () => api<{ items: Project[] }>("/student/projects"),
  });
  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">내 프로젝트</h1>
      {isLoading ? <Loader2 className="animate-spin mx-auto" />
      : data?.items.length === 0 ? <div className="text-muted-foreground">참여 중인 프로젝트가 없습니다.</div>
      : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{data?.items.map((p) => (
        <Link key={p.id} href={`/student/projects/${p.id}`}>
          <Card className="cursor-pointer hover:bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {p.title}
                <Badge variant="outline" className="">{PROJECT_STATUS_LABEL[p.status]}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{p.description ?? "-"}</CardContent>
          </Card>
        </Link>
      ))}</div>}
    </StudentLayout>
  );
}
