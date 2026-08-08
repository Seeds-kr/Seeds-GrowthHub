import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, ChevronRight, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/mvp3-api";

type StudyRow = {
  id: number;
  title: string;
  topic: string | null;
  status: string;
  cohortName: string | null;
  isMember: boolean;
  description?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  proposed: "심사 중",
  rejected: "반려됨",
  planned: "준비 중",
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};

export default function StudentStudies() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["student-studies"],
    queryFn: () => api<{ items: StudyRow[]; total: number }>("/student/studies"),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setTitle("");
    setTopic("");
    setDescription("");
    setPlan("");
    setError(null);
  };

  const propose = useMutation({
    mutationFn: () =>
      api("/student/studies", {
        method: "POST",
        body: {
          title,
          topic: topic || null,
          description: description || null,
          weeklyPlanMd: plan,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-studies"] });
      reset();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "제안하지 못했습니다."),
  });

  const withdraw = useMutation({
    mutationFn: (id: number) => api(`/student/studies/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["student-studies"] }),
  });

  const items = data?.items ?? [];
  // 심사 중·반려는 제안자에게만 보인다(서버가 그렇게 준다). 참여 중 목록에
  // 섞으면 "내 스터디"가 아직 스터디가 아닌 것과 뒤엉키므로 따로 세운다.
  const requests = items.filter((s) => s.status === "proposed" || s.status === "rejected");
  const requestIds = new Set(requests.map((s) => s.id));
  const mine = items.filter((s) => s.isMember && !requestIds.has(s.id));
  const others = items.filter((s) => !s.isMember && !requestIds.has(s.id));
  const hasPending = requests.some((s) => s.status === "proposed");

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6 text-primary" />내 스터디
            </h1>
            <p className="text-sm text-muted-foreground">
              참여 중인 스터디와, 같은 기수에서 열린 스터디를 볼 수 있습니다.
              열고 싶은 스터디가 있으면 직접 제안하세요.
            </p>
          </div>
          {!open && (
            <Button
              onClick={() => setOpen(true)}
              disabled={hasPending}
              title={hasPending ? "이미 심사 중인 제안이 있습니다" : undefined}
              data-testid="button-propose-study"
            >
              <Plus className="mr-1 h-4 w-4" /> 스터디 제안
            </Button>
          )}
        </div>

        {open && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <p className="text-sm font-medium">스터디 개설 제안</p>
              <p className="text-xs text-muted-foreground">
                운영진(성장경험 담당)이 확인한 뒤 열립니다. 반려되면 사유와 함께
                돌아오니 고쳐서 다시 낼 수 있습니다.
              </p>
              <Input
                placeholder="스터디 이름 — 예: 타입스크립트 심화"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-study-title"
              />
              <Input
                placeholder="주제 (선택) — 예: TypeScript"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                data-testid="input-study-topic"
              />
              <Textarea
                placeholder="왜 이 스터디가 필요한가요? 누구와 하고 싶나요?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-study-description"
              />
              <Textarea
                placeholder={"주차 계획 (선택)\n## 1주차\n- "}
                rows={5}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                data-testid="input-study-plan"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  disabled={!title.trim() || propose.isPending}
                  onClick={() => propose.mutate()}
                  data-testid="button-submit-study"
                >
                  {propose.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  제안하기
                </Button>
                <Button variant="ghost" onClick={reset}>
                  <X className="mr-1 h-4 w-4" /> 취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {requests.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">내 제안</h2>
            <div className="grid gap-3">
              {requests.map((s) => (
                <Card
                  key={s.id}
                  className={s.status === "rejected" ? "border-destructive/40" : "border-amber-500/40"}
                  data-testid={`study-request-${s.id}`}
                >
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge
                        variant={s.status === "rejected" ? "destructive" : "outline"}
                        className="shrink-0 text-xs"
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {s.reviewNote && (
                      <p className="rounded bg-muted p-2 text-sm">
                        <span className="text-muted-foreground">운영진: </span>
                        {s.reviewNote}
                      </p>
                    )}
                    {s.status === "proposed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`"${s.title}" 제안을 철회합니다.`)) withdraw.mutate(s.id);
                        }}
                      >
                        제안 철회
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data && items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            아직 열린 스터디가 없습니다. 첫 스터디를 제안해 보세요.
          </p>
        )}

        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">참여 중</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {mine.map((s) => (
                <Link key={s.id} href={`/student/studies/${s.id}`}>
                <Card className="cursor-pointer border-primary/40 transition hover:bg-muted/30">
                  <CardContent className="space-y-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {s.topic && (
                      <p className="text-xs text-muted-foreground">{s.topic}</p>
                    )}
                    <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      {s.cohortName ?? "기수 미지정"}
                      <ChevronRight className="h-3 w-3" />
                    </p>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              같은 기수의 다른 스터디
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {others.map((s) => (
                <Link key={s.id} href={`/student/studies/${s.id}`}>
                <Card className="cursor-pointer transition hover:bg-muted/30">
                  <CardContent className="space-y-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {s.topic && (
                      <p className="text-xs text-muted-foreground">{s.topic}</p>
                    )}
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
