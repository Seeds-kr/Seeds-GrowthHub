import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Submission } from "@/lib/mvp3-api";
import { useRoute, Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type Detail = {
  assignment: { id: number; title: string; description: string | null; dueAt: string | null; status: string; cohortId: number; programId: number | null };
  submissions: Submission[];
};

function FeedbackBlock({ sub }: { sub: Submission }) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  useEffect(() => setFeedback(sub.feedback ?? ""), [sub.feedback]);
  const save = useMutation({
    mutationFn: () => api(`/admin/submissions/${sub.id}`, { method: "PATCH", body: { feedback, status: "reviewed" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-assignment"] }); toast({ title: "피드백 저장" }); },
  });
  return (
    <div className="space-y-2">
      <Textarea className="rounded-none" placeholder="피드백…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <Button size="sm" className="rounded-none" disabled={save.isPending} onClick={() => save.mutate()}>저장 & 검토 완료</Button>
    </div>
  );
}

export default function AdminAssignmentDetail() {
  const [, params] = useRoute("/admin/assignments/:id");
  const id = params?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["admin-assignment", id],
    queryFn: () => api<Detail>(`/admin/assignments/${id}`),
    enabled: !!id,
  });
  if (isLoading || !data) return <AdminLayout><div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/assignments" className="text-sm text-muted-foreground hover:text-primary">← 과제 목록</Link></div>
      <h1 className="text-3xl font-serif font-bold mb-2">{data.assignment.title}</h1>
      <div className="text-sm text-muted-foreground mb-6">
        <Badge className="rounded-none mr-2">{data.assignment.status}</Badge>
        마감: {data.assignment.dueAt ? format(new Date(data.assignment.dueAt), "yyyy-MM-dd HH:mm") : "없음"}
      </div>
      {data.assignment.description && <Card className="rounded-none mb-6"><CardContent className="pt-6 whitespace-pre-wrap text-sm">{data.assignment.description}</CardContent></Card>}

      <h2 className="text-xl font-bold mb-4">제출물 ({data.submissions.length})</h2>
      {data.submissions.length === 0 ? <div className="text-muted-foreground">제출이 없습니다.</div> : (
        <div className="space-y-4">
          {data.submissions.map((sub) => (
            <Card key={sub.id} className="rounded-none">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">{sub.studentName}</CardTitle>
                <div><Badge className="rounded-none mr-2">{sub.status}</Badge>{sub.submittedAt ? format(new Date(sub.submittedAt), "yyyy-MM-dd HH:mm") : "-"}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {sub.content && <div className="whitespace-pre-wrap text-sm border p-3 bg-muted/20">{sub.content}</div>}
                {sub.externalUrl && <div className="text-sm">URL: <a className="text-primary underline" href={sub.externalUrl} target="_blank" rel="noreferrer">{sub.externalUrl}</a></div>}
                {sub.fileUrl && <div className="text-sm">파일: <a className="text-primary underline" href={sub.fileUrl} target="_blank" rel="noreferrer">{sub.fileUrl}</a></div>}
                <FeedbackBlock sub={sub} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
