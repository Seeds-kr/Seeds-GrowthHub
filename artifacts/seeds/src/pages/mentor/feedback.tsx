import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare } from "lucide-react";
import { api } from "@/lib/mvp3-api";

type Row = {
  id: number;
  targetId: number;
  projectTitle: string;
  feedbackType: string;
  content: string;
  visibility: string;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  general: "일반",
  strength: "강점",
  improvement: "개선점",
  review: "리뷰",
  mentor_note: "멘토 노트",
  admin_note: "운영진 노트",
};

/** Feedback THIS mentor wrote, limited to currently-owned projects. */
export default function MentorFeedback() {
  const { data, isLoading } = useQuery({
    queryKey: ["mentor-feedback"],
    queryFn: () => api<{ items: Row[]; total: number }>("/mentor/feedback"),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessageSquare className="h-6 w-6 text-primary" />내 피드백
        </h1>
        <p className="text-sm text-muted-foreground">
          내가 남긴 피드백입니다. 현재 담당 중인 팀의 것만 표시됩니다.
        </p>
      </div>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
        </div>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            아직 작성한 피드백이 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.items.map((f) => (
          <Card key={f.id}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/mentor/projects/${f.targetId}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {f.projectTitle}
                </Link>
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABEL[f.feedbackType] ?? f.feedbackType}
                </Badge>
                <span className="text-muted-foreground">
                  {format(new Date(f.createdAt), "yyyy.MM.dd")}
                </span>
                {f.visibility === "student_visible" && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500 text-xs text-emerald-700 dark:text-emerald-400"
                  >
                    학생 공개
                  </Badge>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{f.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
