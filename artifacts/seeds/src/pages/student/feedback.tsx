import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare } from "lucide-react";
import { api } from "@/lib/mvp3-api";

type Row = {
  id: number;
  targetType: string;
  targetId: number;
  feedbackType: string;
  content: string;
  authorName: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  general: "일반",
  strength: "강점",
  improvement: "개선점",
  review: "리뷰",
  mentor_note: "멘토 노트",
};

const TYPE_STYLE: Record<string, string> = {
  strength: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  improvement: "border-amber-500 text-amber-700 dark:text-amber-400",
};

export default function StudentFeedback() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-feedback"],
    queryFn: () => api<{ items: Row[]; total: number }>("/student/feedback"),
  });

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />내 피드백
          </h1>
          <p className="text-sm text-muted-foreground">
            멘토·운영진이 나에게 공개한 피드백입니다.
          </p>
        </div>

        {isLoading && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            아직 공개된 피드백이 없습니다.
          </p>
        )}

        <div className="space-y-3">
          {data?.items.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`text-xs ${TYPE_STYLE[f.feedbackType] ?? ""}`}
                  >
                    {TYPE_LABEL[f.feedbackType] ?? f.feedbackType}
                  </Badge>
                  <span className="text-muted-foreground">
                    {f.authorName ?? "작성자 없음"} ·{" "}
                    {format(new Date(f.createdAt), "yyyy.MM.dd")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{f.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
