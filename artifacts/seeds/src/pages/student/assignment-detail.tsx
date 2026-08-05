import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { useRoute, Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type Detail = {
  assignment: { id: number; title: string; description: string | null; dueAt: string | null; status: string };
  mySubmission: { id: number; content: string | null; externalUrl: string | null; fileUrl: string | null; status: string; submittedAt: string | null; feedback: string | null } | null;
};

export default function StudentAssignmentDetail() {
  const [, params] = useRoute("/student/assignments/:id");
  const id = params?.id;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assignment", id],
    queryFn: () => api<Detail>(`/student/assignments/${id}`),
    enabled: !!id, retry: false,
  });
  const [content, setContent] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  useEffect(() => {
    if (data?.mySubmission) {
      setContent(data.mySubmission.content ?? "");
      setExternalUrl(data.mySubmission.externalUrl ?? "");
    }
  }, [data]);

  const submit = useMutation({
    mutationFn: () => api(`/student/assignments/${id}/submission`, {
      method: "POST",
      body: { content: content || null, externalUrl: externalUrl || null },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-assignment", id] }); qc.invalidateQueries({ queryKey: ["student-assignments"] }); toast({ title: "제출 완료" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  if (isLoading) return <StudentLayout><Loader2 className="animate-spin mx-auto" /></StudentLayout>;
  if (error || !data) return <StudentLayout><div className="text-muted-foreground">접근할 수 없습니다.</div></StudentLayout>;

  const closed = data.assignment.status === "closed";

  return (
    <StudentLayout>
      <div className="mb-4"><Link href="/student/assignments" className="text-sm text-muted-foreground hover:text-primary">← 과제 목록</Link></div>
      <h1 className="text-3xl font-serif font-bold mb-2">{data.assignment.title}</h1>
      <div className="text-sm text-muted-foreground mb-6">
        <Badge className="mr-2">{data.assignment.status}</Badge>
        마감: {data.assignment.dueAt ? format(new Date(data.assignment.dueAt), "yyyy-MM-dd HH:mm") : "없음"}
      </div>
      {data.assignment.description && <Card className="mb-6"><CardContent className="pt-6 whitespace-pre-wrap text-sm">{data.assignment.description}</CardContent></Card>}

      <Card className="mb-6">
        <CardHeader><CardTitle>{data.mySubmission ? "내 제출 (수정 가능)" : "제출하기"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea className="min-h-32" placeholder="텍스트 답변 (선택)" value={content} onChange={(e) => setContent(e.target.value)} disabled={closed} />
          <Input className="" placeholder="제출 URL (선택, https://…)" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} disabled={closed} />
          <Button className="" disabled={closed || submit.isPending || (!content && !externalUrl)} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {data.mySubmission ? "재제출" : "제출"}
          </Button>
          {closed && <div className="text-sm text-muted-foreground">마감되어 제출할 수 없습니다.</div>}
        </CardContent>
      </Card>

      {data.mySubmission?.feedback && (
        <Card className="">
          <CardHeader><CardTitle>피드백</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{data.mySubmission.feedback}</CardContent>
        </Card>
      )}
    </StudentLayout>
  );
}
