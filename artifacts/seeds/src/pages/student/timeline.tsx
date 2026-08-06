import { useQuery } from "@tanstack/react-query";
import { api, ACTIVITY_SOURCE_LABEL, type ActivityRecord } from "@/lib/mvp3-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function StudentTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-timeline"],
    queryFn: () => api<{ items: ActivityRecord[] }>("/student/timeline"),
  });
  return (
    <>
      <h1 className="text-3xl font-serif font-bold mb-6">내 활동 타임라인</h1>
      {isLoading ? <Loader2 className="animate-spin mx-auto" />
      : data?.items.length === 0 ? <div className="text-muted-foreground">아직 기록이 없습니다.</div>
      : <div className="space-y-3">{data?.items.map((r) => (
        <Card key={r.id} className="">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{format(new Date(r.activityDate), "yyyy-MM-dd")}</span>
              <Badge variant="outline" className="">{ACTIVITY_SOURCE_LABEL[r.sourceType]}</Badge>
            </div>
            <div className="font-medium">{r.title}</div>
            {r.description && <div className="text-sm whitespace-pre-wrap">{r.description}</div>}
            {r.tags && r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">{r.tags.map((t) => <Badge key={t.id} variant="outline" className="">{t.name}</Badge>)}</div>
            )}
          </CardContent>
        </Card>
      ))}</div>}
    </>
  );
}
