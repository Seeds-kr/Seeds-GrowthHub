import { AdminLayout } from "@/components/layout/AdminLayout";
import { useParams, Link } from "wouter";
import {
  useGetApplication,
  useUpdateApplication,
  useListUsers,
  useCreateAssignment,
  useDeleteAssignment,
  useUpsertInterview,
  useSetFinalDecision,
  getGetApplicationQueryKey,
  getListApplicationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  ApplicationStatus,
  EvaluationStage,
  FinalDecision,
  InterviewStatus,
} from "@workspace/api-zod";
import {
  statusLabels,
  lifecycleLabels,
  finalDecisionLabels,
  interviewStatusLabels,
  stageLabels,
  recommendationLabels,
} from "@/lib/seeds-labels";

export default function AdminApplicationDetail() {
  const { id } = useParams();
  const appId = id ? parseInt(id, 10) : 0;
  const { data: application, isLoading } = useGetApplication(appId, {
    query: { enabled: !!appId, queryKey: getGetApplicationQueryKey(appId) },
  });

  const updateMutation = useUpdateApplication();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const evaluators = useListUsers({ role: "evaluator" });
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const upsertInterview = useUpsertInterview();
  const setFinal = useSetFinalDecision();

  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [adminNote, setAdminNote] = useState("");

  // Assignment form state
  const [newEvaluatorId, setNewEvaluatorId] = useState("");
  const [newStage, setNewStage] = useState<EvaluationStage>("document_review");

  // Interview state
  const [interviewScheduledAt, setInterviewScheduledAt] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewNote, setInterviewNote] = useState("");
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>("not_scheduled");

  // Final decision
  const [finalDecision, setFinalDecisionState] = useState<FinalDecision>("pending");
  const [decisionReason, setDecisionReason] = useState("");

  useEffect(() => {
    if (!application) return;
    setStatus(application.status);
    setAdminNote(application.adminNote || "");
    if (application.interview) {
      setInterviewScheduledAt(
        application.interview.scheduledAt
          ? application.interview.scheduledAt.slice(0, 16)
          : "",
      );
      setInterviewLocation(application.interview.locationOrLink ?? "");
      setInterviewNote(application.interview.interviewerNote ?? "");
      setInterviewStatus(application.interview.status);
    }
    setFinalDecisionState(application.finalDecision);
  }, [application]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(appId) });
    queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
  };

  const handleSaveStatus = () => {
    if (!status) return;
    updateMutation.mutate(
      {
        id: appId,
        data: { status: status as ApplicationStatus, adminNote: adminNote || null },
      },
      {
        onSuccess: () => {
          toast({ title: "저장 완료" });
          refresh();
        },
        onError: () => {
          toast({ title: "저장 실패", variant: "destructive" });
        },
      },
    );
  };

  const handleAssign = () => {
    const eid = Number(newEvaluatorId);
    if (!Number.isFinite(eid) || eid <= 0) return;
    createAssignment.mutate(
      { id: appId, data: { evaluatorId: eid, stage: newStage } },
      {
        onSuccess: () => {
          toast({ title: "평가자 배정 완료" });
          setNewEvaluatorId("");
          refresh();
        },
        onError: (err: any) => {
          if (err?.status === 409) {
            toast({
              title: "이미 배정된 평가자입니다.",
              variant: "destructive",
            });
          } else {
            toast({ title: "배정 실패", variant: "destructive" });
          }
        },
      },
    );
  };

  const handleDelete = (assignmentId: number) => {
    deleteAssignment.mutate(
      { appId, assignmentId },
      {
        onSuccess: () => {
          toast({ title: "배정 해제 완료" });
          refresh();
        },
      },
    );
  };

  const handleSaveInterview = () => {
    upsertInterview.mutate(
      {
        id: appId,
        data: {
          scheduledAt: interviewScheduledAt
            ? new Date(interviewScheduledAt).toISOString()
            : null,
          locationOrLink: interviewLocation || null,
          interviewerNote: interviewNote || null,
          status: interviewStatus,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "면접 정보 저장 완료" });
          refresh();
        },
        onError: () =>
          toast({ title: "면접 정보 저장 실패", variant: "destructive" }),
      },
    );
  };

  const handleFinal = () => {
    if (decisionReason.trim().length === 0) {
      toast({ title: "사유를 입력하세요.", variant: "destructive" });
      return;
    }
    setFinal.mutate(
      {
        id: appId,
        data: { finalDecision, reason: decisionReason.trim() },
      },
      {
        onSuccess: () => {
          toast({ title: "최종 결정 저장 완료" });
          setDecisionReason("");
          refresh();
        },
        onError: () =>
          toast({ title: "결정 저장 실패", variant: "destructive" }),
      },
    );
  };

  if (isLoading || !application) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const evaluatorOptions = (evaluators.data?.items ?? []).filter((u) => u.isActive);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/applications">
            <Button variant="outline" size="icon" className="rounded-none">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold">{application.name} 지원서</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="rounded-none font-normal">
                {lifecycleLabels[application.applicationStatus] ?? application.applicationStatus}
              </Badge>
              <Badge variant="outline" className="rounded-none font-normal">
                최종: {finalDecisionLabels[application.finalDecision] ?? application.finalDecision}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Basic info */}
          <div className="bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">
              기본 정보
            </h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
              <Field label="이메일" value={application.email} />
              <Field label="연락처" value={application.phone} />
              <Field label="학교" value={application.school} />
              <Field label="학년" value={application.grade} />
              <Field label="출생연도" value={`${application.birthYear}`} />
              <Field label="관심분야" value={application.interestArea} />
            </div>
          </div>

          {/* Detailed responses */}
          <div className="bg-card border border-border p-6 space-y-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">
              상세 응답
            </h2>
            <ResponseBlock label="지원 동기" value={application.motivation} />
            <ResponseBlock label="관련 경험" value={application.experience} />
            <ResponseBlock label="문제 인식" value={application.problemAwareness} />
            <ResponseBlock label="기대하는 점" value={application.expectation} />
          </div>

          {/* Assignments */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2 mb-4">
              평가자 배정
            </h2>
            <div className="space-y-2 mb-4">
              {application.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">배정된 평가자가 없습니다.</p>
              ) : (
                application.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border border-border p-3 text-sm"
                    data-testid={`assignment-${a.id}`}
                  >
                    <div>
                      <span className="font-medium">{a.evaluatorName}</span>
                      <span className="text-muted-foreground"> · {a.evaluatorEmail}</span>
                      <span className="text-muted-foreground"> · {stageLabels[a.stage] ?? a.stage}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-none"
                      onClick={() => handleDelete(a.id)}
                      data-testid={`button-unassign-${a.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>평가자</Label>
                <Select value={newEvaluatorId} onValueChange={setNewEvaluatorId}>
                  <SelectTrigger className="rounded-none" data-testid="select-evaluator">
                    <SelectValue placeholder="평가자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {evaluatorOptions.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>단계</Label>
                <Select
                  value={newStage}
                  onValueChange={(v) => setNewStage(v as EvaluationStage)}
                >
                  <SelectTrigger className="rounded-none" data-testid="select-new-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(stageLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAssign}
                disabled={createAssignment.isPending || !newEvaluatorId}
                className="rounded-none"
                data-testid="button-assign"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                배정
              </Button>
            </div>
          </div>

          {/* Evaluations */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2 mb-4">
              평가 결과
              {application.avgDocReviewScore !== null && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  서류 평균: {application.avgDocReviewScore.toFixed(2)}
                </span>
              )}
            </h2>
            {application.evaluations.length === 0 ? (
              <p className="text-sm text-muted-foreground">제출된 평가서가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {application.evaluations.map((e) => (
                  <div key={e.id} className="border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {e.evaluatorName} <span className="text-muted-foreground">· {stageLabels[e.stage] ?? e.stage}</span>
                      </div>
                      <Badge className="rounded-none font-normal">
                        {recommendationLabels[e.recommendation] ?? e.recommendation}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      종합 {e.overallScore} / 5
                      {e.motivationScore !== null && ` · 동기 ${e.motivationScore}`}
                      {e.problemAwarenessScore !== null && ` · 문제 ${e.problemAwarenessScore}`}
                      {e.initiativeScore !== null && ` · 주도 ${e.initiativeScore}`}
                      {e.collaborationScore !== null && ` · 협업 ${e.collaborationScore}`}
                      {e.fitScore !== null && ` · 적합 ${e.fitScore}`}
                    </div>
                    {e.comment && (
                      <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 border border-border/50">
                        {e.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Decision logs */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2 mb-4">
              결정 이력
            </h2>
            {application.decisionLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">변경 이력이 없습니다.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {application.decisionLogs.map((l) => (
                  <li key={l.id} className="border-l-2 border-primary pl-3">
                    <div>
                      <span className="font-medium">
                        {l.previousDecision ? finalDecisionLabels[l.previousDecision] : "—"}
                        {" → "}
                        {finalDecisionLabels[l.newDecision] ?? l.newDecision}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}· {l.changedByName ?? "삭제된 사용자"} · {format(new Date(l.createdAt), "yyyy-MM-dd HH:mm")}
                      </span>
                    </div>
                    {l.reason && <div className="text-muted-foreground mt-1">{l.reason}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* MVP1 status / note */}
          <div className="bg-muted border border-border p-6 sticky top-24 space-y-4">
            <h2 className="text-lg font-serif font-bold">관리자 메모 / 상태</h2>
            <div>
              <Label>지원 상태 (레거시)</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
                <SelectTrigger className="rounded-none bg-background" data-testid="select-legacy-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>관리자 메모</Label>
              <Textarea
                className="min-h-[120px] rounded-none bg-background resize-none"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                data-testid="input-admin-note"
              />
            </div>
            <Button
              onClick={handleSaveStatus}
              disabled={updateMutation.isPending}
              className="w-full rounded-none"
              data-testid="button-save-status"
            >
              <Save className="w-4 h-4 mr-2" />
              저장
            </Button>
          </div>

          {/* Interview */}
          <div className="bg-muted border border-border p-6 space-y-3">
            <h2 className="text-lg font-serif font-bold">면접 일정</h2>
            <div>
              <Label>일시</Label>
              <Input
                type="datetime-local"
                value={interviewScheduledAt}
                onChange={(e) => setInterviewScheduledAt(e.target.value)}
                className="rounded-none bg-background"
                data-testid="input-interview-when"
              />
            </div>
            <div>
              <Label>장소 / 링크</Label>
              <Input
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                className="rounded-none bg-background"
                data-testid="input-interview-location"
              />
            </div>
            <div>
              <Label>상태</Label>
              <Select
                value={interviewStatus}
                onValueChange={(v) => setInterviewStatus(v as InterviewStatus)}
              >
                <SelectTrigger className="rounded-none bg-background" data-testid="select-interview-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(interviewStatusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>면접관 메모</Label>
              <Textarea
                className="min-h-[80px] rounded-none bg-background resize-none"
                value={interviewNote}
                onChange={(e) => setInterviewNote(e.target.value)}
                data-testid="input-interview-note"
              />
            </div>
            <Button
              onClick={handleSaveInterview}
              disabled={upsertInterview.isPending}
              className="w-full rounded-none"
              data-testid="button-save-interview"
            >
              <Save className="w-4 h-4 mr-2" />
              면접 정보 저장
            </Button>
          </div>

          {/* Final decision */}
          <div className="bg-muted border border-border p-6 space-y-3">
            <h2 className="text-lg font-serif font-bold">최종 결정</h2>
            <div>
              <Label>결과</Label>
              <Select
                value={finalDecision}
                onValueChange={(v) => setFinalDecisionState(v as FinalDecision)}
              >
                <SelectTrigger className="rounded-none bg-background" data-testid="select-final-decision">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(finalDecisionLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>사유 *</Label>
              <Textarea
                className="min-h-[80px] rounded-none bg-background resize-none"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                data-testid="input-decision-reason"
              />
            </div>
            <Button
              onClick={handleFinal}
              disabled={setFinal.isPending}
              className="w-full rounded-none"
              data-testid="button-save-decision"
            >
              <Save className="w-4 h-4 mr-2" />
              최종 결정 저장
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function ResponseBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2">{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
        {value}
      </div>
    </div>
  );
}
