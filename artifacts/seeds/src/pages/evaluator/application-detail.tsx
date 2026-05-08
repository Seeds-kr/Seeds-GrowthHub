import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { EvaluatorLayout } from "@/components/layout/EvaluatorLayout";
import {
  useGetEvaluatorApplication,
  useSubmitEvaluation,
  getGetEvaluatorApplicationQueryKey,
  getListMyAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  stageLabels,
  recommendationLabels,
  assignmentStatusLabels,
} from "@/lib/seeds-labels";
import type { EvaluationStage, Recommendation } from "@workspace/api-zod";

export default function EvaluatorApplicationDetail() {
  const { id } = useParams();
  const appId = id ? parseInt(id, 10) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetEvaluatorApplication(appId, {
    query: {
      enabled: !!appId,
      queryKey: getGetEvaluatorApplicationQueryKey(appId),
    },
  });

  const submit = useSubmitEvaluation();
  const stages = useMemo(
    () => (data?.myAssignments ?? []).map((a) => a.stage),
    [data],
  );
  const [stage, setStage] = useState<EvaluationStage>("document_review");
  const [motivationScore, setMotivationScore] = useState(3);
  const [problemAwarenessScore, setProblemAwarenessScore] = useState(3);
  const [initiativeScore, setInitiativeScore] = useState(3);
  const [collaborationScore, setCollaborationScore] = useState(3);
  const [fitScore, setFitScore] = useState(3);
  const [overallScore, setOverallScore] = useState(3);
  const [recommendation, setRecommendation] = useState<Recommendation>("accept");
  const [comment, setComment] = useState("");

  // Pick first available stage by default; load existing eval values if present
  useEffect(() => {
    if (!data) return;
    const defaultStage = stages[0] ?? "document_review";
    setStage(defaultStage);
  }, [data, stages]);

  useEffect(() => {
    if (!data) return;
    const existing = data.myEvaluations.find((e) => e.stage === stage);
    if (existing) {
      setMotivationScore(existing.motivationScore ?? 3);
      setProblemAwarenessScore(existing.problemAwarenessScore ?? 3);
      setInitiativeScore(existing.initiativeScore ?? 3);
      setCollaborationScore(existing.collaborationScore ?? 3);
      setFitScore(existing.fitScore ?? 3);
      setOverallScore(existing.overallScore);
      setRecommendation(existing.recommendation);
      setComment(existing.comment ?? "");
    }
  }, [data, stage]);

  const handleSubmit = () => {
    submit.mutate(
      {
        id: appId,
        data: {
          stage,
          motivationScore,
          problemAwarenessScore,
          initiativeScore,
          collaborationScore,
          fitScore,
          overallScore,
          recommendation,
          comment: comment.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "평가서 저장 완료" });
          queryClient.invalidateQueries({
            queryKey: getGetEvaluatorApplicationQueryKey(appId),
          });
          queryClient.invalidateQueries({
            queryKey: getListMyAssignmentsQueryKey(),
          });
        },
        onError: () => {
          toast({
            title: "저장 실패",
            description: "평가서 저장 중 오류가 발생했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <EvaluatorLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </EvaluatorLayout>
    );
  }

  if (error || !data) {
    return (
      <EvaluatorLayout>
        <div className="bg-card border border-border p-8 text-center">
          <p className="text-muted-foreground">
            이 지원서를 열람할 권한이 없거나 존재하지 않습니다.
          </p>
          <Link href="/evaluator">
            <Button variant="outline" className="rounded-none mt-4">
              목록으로
            </Button>
          </Link>
        </div>
      </EvaluatorLayout>
    );
  }

  const app = data.application;

  return (
    <EvaluatorLayout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/evaluator">
          <Button variant="outline" size="icon" className="rounded-none">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-serif font-bold">{app.name} 평가</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">
              기본 정보
            </h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
              <div><span className="text-muted-foreground">학교:</span> {app.school}</div>
              <div><span className="text-muted-foreground">학년:</span> {app.grade}</div>
              <div><span className="text-muted-foreground">출생연도:</span> {app.birthYear}</div>
              <div><span className="text-muted-foreground">관심분야:</span> {app.interestArea}</div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">
              상세 응답
            </h2>
            <Section label="지원 동기" value={app.motivation} />
            <Section label="관련 경험" value={app.experience} />
            <Section label="문제 인식" value={app.problemAwareness} />
            <Section label="기대하는 점" value={app.expectation} />
          </div>

          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2 mb-4">
              내 배정 현황
            </h2>
            <ul className="space-y-2">
              {data.myAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span>{stageLabels[a.stage] ?? a.stage}</span>
                  <Badge variant="outline" className="rounded-none font-normal">
                    {assignmentStatusLabels[a.status] ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="bg-muted border border-border p-6 sticky top-24 space-y-4">
            <h2 className="text-lg font-serif font-bold">평가서</h2>

            <div>
              <Label>평가 단계</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as EvaluationStage)}>
                <SelectTrigger className="rounded-none bg-background" data-testid="select-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.length > 0
                    ? stages.map((s) => (
                        <SelectItem key={s} value={s}>
                          {stageLabels[s] ?? s}
                        </SelectItem>
                      ))
                    : (
                      <SelectItem value="document_review">서류 평가</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            <ScoreInput label="동기 (1-5)" value={motivationScore} onChange={setMotivationScore} testId="input-motivation" />
            <ScoreInput label="문제 인식 (1-5)" value={problemAwarenessScore} onChange={setProblemAwarenessScore} testId="input-problem" />
            <ScoreInput label="주도성 (1-5)" value={initiativeScore} onChange={setInitiativeScore} testId="input-initiative" />
            <ScoreInput label="협업 (1-5)" value={collaborationScore} onChange={setCollaborationScore} testId="input-collab" />
            <ScoreInput label="적합도 (1-5)" value={fitScore} onChange={setFitScore} testId="input-fit" />
            <ScoreInput label="종합 점수 (1-5) *" value={overallScore} onChange={setOverallScore} testId="input-overall" />

            <div>
              <Label>추천 *</Label>
              <Select
                value={recommendation}
                onValueChange={(v) => setRecommendation(v as Recommendation)}
              >
                <SelectTrigger className="rounded-none bg-background" data-testid="select-recommendation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(recommendationLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>의견</Label>
              <Textarea
                className="min-h-[100px] rounded-none bg-background resize-none"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid="input-comment"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submit.isPending}
              className="w-full rounded-none"
              data-testid="button-submit-evaluation"
            >
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              평가서 저장
            </Button>
          </div>
        </div>
      </div>
    </EvaluatorLayout>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2">{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
        {value}
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  testId?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={1}
        max={5}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(1, Math.min(5, n)));
        }}
        className="rounded-none bg-background"
        data-testid={testId}
      />
    </div>
  );
}
