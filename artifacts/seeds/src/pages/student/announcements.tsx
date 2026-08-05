import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import { api, type Announcement } from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function StudentAnnouncements() {
  const { data, isLoading } = useQuery({ queryKey: ["student-announcements"], queryFn: () => api<{ items: Announcement[] }>("/student/announcements") });
  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">공지사항</h1>
      {isLoading ? <Loader2 className="animate-spin mx-auto" />
      : data?.items.length === 0 ? <div className="text-muted-foreground">공지가 없습니다.</div>
      : <div className="space-y-4">{data?.items.map((a) => (
          <Card key={a.id} className="">
            <CardHeader><CardTitle className="text-base">{a.title}</CardTitle>
              <div className="text-xs text-muted-foreground">{a.publishedAt ? format(new Date(a.publishedAt), "yyyy-MM-dd HH:mm") : ""}</div>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm">{a.content}</CardContent>
          </Card>
        ))}</div>}
    </StudentLayout>
  );
}
