import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DesktopOnly } from "@/components/DesktopOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/mvp3-api";
import { toast } from "@/hooks/use-toast";
import {
  TEAM_STATUSES,
  TEAM_STATUS_HINT,
  TEAM_STATUS_LABEL,
  TEAM_STATUS_SELECTED,
  TEAM_STATUS_STYLE,
  type MentorProjectDetail,
  type TeamStatus,
} from "@/lib/mentor-api";
import { TeamMeetings } from "@/components/team/TeamMeetings";
import { TeamLinks } from "@/components/team/TeamLinks";

const MILESTONE_LABEL: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
  dropped: "계획 변경",
};

const FEEDBACK_TYPE_LABEL: Record<string, string> = {
  general: "일반",
  strength: "강점",
  improvement: "개선점",
  review: "리뷰",
  mentor_note: "멘토 노트",
  admin_note: "운영진 노트",
};

/**
 * The status-check form is the only recurring input we ask of a mentor.
 * Target: 30 seconds. Only teamStatus is required — one click then 제출.
 */
/**
 * 이력에서 기본으로 펼치는 건수.
 *
 * 기수 하나가 끝날 즈음이면 상태체크가 수십 건 쌓인다. 전부 펼치면 이력 카드가
 * 화면 대부분을 먹는다. 멘토가 실제로 보는 것은 "최근에 어땠나" 이고, 그 이상은
 * 필요할 때 펼친다.
 */
const RECENT_CHECKS = 5;

function StatusCheckForm({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TeamStatus | null>(null);
  const [blocker, setBlocker] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [needsOps, setNeedsOps] = useState(false);
  const [opsNote, setOpsNote] = useState("");
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api(`/mentor/projects/${projectId}/status-checks`, {
        method: "POST",
        body: {
          teamStatus: status,
          blocker: blocker || null,
          nextFocus: nextFocus || null,
          needsOpsSupport: needsOps,
          opsSupportNote: needsOps ? opsNote || null : null,
          comment: comment || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-project", projectId] });
      qc.invalidateQueries({ queryKey: ["mentor-teams"] });
      setStatus(null);
      setBlocker("");
      setNextFocus("");
      setNeedsOps(false);
      setOpsNote("");
      setComment("");
      toast({ title: "상태체크가 기록되었습니다." });
    },
    onError: (e: any) =>
      toast({
        title: "실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">상태체크</CardTitle>
        <p className="text-xs text-muted-foreground">
          상태 하나만 골라도 제출됩니다. 나머지는 전부 선택 입력입니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEAM_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              // 넷 중 하나를 고르는 묶음이다. 색으로만 선택을 표시하면 화면을
              // 못 보는 멘토는 무엇이 골라졌는지 알 수 없다.
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`rounded-md border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                status === s
                  ? TEAM_STATUS_SELECTED[s]
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="text-sm font-medium">{TEAM_STATUS_LABEL[s]}</div>
              <div
                className={`text-[11px] ${status === s ? "opacity-90" : "text-muted-foreground"}`}
              >
                {TEAM_STATUS_HINT[s]}
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="현재 블로커 (선택)"
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
          />
          <Input
            placeholder="다음 초점 (선택)"
            value={nextFocus}
            onChange={(e) => setNextFocus(e.target.value)}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={needsOps}
            onCheckedChange={(v) => setNeedsOps(Boolean(v))}
          />
          운영진 지원이 필요합니다
        </label>

        {needsOps && (
          <Input
            placeholder="어떤 지원이 필요한지 (선택)"
            value={opsNote}
            onChange={(e) => setOpsNote(e.target.value)}
          />
        )}

        <Textarea
          rows={2}
          placeholder="메모 (선택)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <Button
            disabled={!status || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            제출
          </Button>
          <span className="text-xs text-muted-foreground">
            기록은 수정·삭제되지 않으며 학생에게 보이지 않습니다.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackForm({
  projectId,
  members,
}: {
  projectId: number;
  members: MentorProjectDetail["members"];
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [studentId, setStudentId] = useState("");
  const [visibility, setVisibility] = useState<"admin_only" | "student_visible">(
    "admin_only",
  );

  const submit = useMutation({
    mutationFn: () =>
      api(`/mentor/projects/${projectId}/feedback`, {
        method: "POST",
        body: {
          content,
          feedbackType: "mentor_note",
          studentId: studentId ? Number(studentId) : null,
          visibility,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-project", projectId] });
      setContent("");
      setStudentId("");
      toast({ title: "피드백이 기록되었습니다." });
    },
    onError: (e: any) =>
      toast({
        title: "실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <Textarea
        rows={3}
        placeholder="피드백 작성…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="대상 학생 (선택)" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.studentId} value={String(m.studentId)}>
                {m.studentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as typeof visibility)}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin_only">비공개 (운영진·멘토만)</SelectItem>
            <SelectItem value="student_visible">학생에게 공개</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={
            !content.trim() ||
            submit.isPending ||
            (visibility === "student_visible" && !studentId)
          }
          onClick={() => submit.mutate()}
          data-testid="button-submit-feedback"
        >
          기록
        </Button>
      </div>
      {/* 대상 없는 "학생 공개"는 아무에게도 안 간다 — 학생 쪽 조회가 전부
          studentId = 나 로 걸러지기 때문이다. 전에는 그대로 저장돼서, 멘토는
          보냈다고 믿고 학생은 못 받는 상태가 됐다. 서버도 422 로 막는다. */}
      {visibility === "student_visible" && !studentId ? (
        <p className="text-xs text-destructive" data-testid="feedback-needs-student">
          대상 학생을 골라 주세요. 고르지 않으면 아무에게도 전달되지 않습니다.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {visibility === "student_visible"
            ? "해당 학생의 “내 피드백”에 나타납니다."
            : "운영진과 멘토만 봅니다. 학생에게는 보이지 않습니다."}
        </p>
      )}
    </div>
  );
}

export default function MentorProjectDetailPage() {
  const [showAllChecks, setShowAllChecks] = useState(false);
  const [, params] = useRoute("/mentor/projects/:id");
  const id = Number(params?.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mentor-project", id],
    queryFn: () => api<MentorProjectDetail>(`/mentor/projects/${id}`),
    enabled: Number.isFinite(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </>
    );
  }

  // Unowned projects return 404 by design — do not hint that the id exists.
  if (isError || !data) {
    return (
      <>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              담당하지 않는 프로젝트이거나 존재하지 않습니다.
            </p>
            <Link href="/mentor/teams">
              <Button variant="outline" size="sm" className="mt-3 gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> 담당 팀으로
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  const p = data.project;

  const visibleChecks = showAllChecks

    ? data.statusChecks

    : data.statusChecks.slice(0, RECENT_CHECKS);
  const links = [
    { label: "GitHub", url: p.githubUrl },
    { label: "데모", url: p.demoUrl },
    { label: "발표자료", url: p.deckUrl },
  ].filter((l) => l.url);

  return (
    <>
      <div className="mb-4">
        <Link href="/mentor/teams">
          <Button variant="ghost" size="sm" className="mb-2 gap-1 px-2">
            <ArrowLeft className="h-3.5 w-3.5" /> 담당 팀
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{p.title}</h1>
        {links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-3">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.url!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
              >
                {l.label} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* W11 (design/05 §6.2) — this page is A tier for reading, but the
            status-check form is C. Guarded at the call site so everything else
            on the route stays readable on a phone (MIXED_TIER_SCREENS in
            lib/responsive-tiers.ts records the split).

            ADR-008 accepts "멘토가 폰에서 상태체크 불가" because ADR-007's Discord
            notifications carry the urgent path. §9 leaves input rate as an open
            question — if it comes in low for the first cohort, ADR-008 is what
            gets revisited, not this guard in isolation. */}
        <DesktopOnly feature="상태체크 입력">
          <StatusCheckForm projectId={id} />
        </DesktopOnly>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">프로젝트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {/* 값이 없을 때 "-" 를 찍으면 대시가 내용인지 빈 것인지 알 수
                  없다. 셋 다 비었으면 줄을 늘어놓는 대신 한 줄로 말한다. */}
              {!p.solutionSummary && !p.problemStatement && !p.targetUsers ? (
                <p className="text-muted-foreground">
                  팀이 아직 프로젝트 개요를 적지 않았습니다.
                </p>
              ) : (
                <>
                  {p.solutionSummary ? (
                    <div>
                      <span className="text-muted-foreground">목표: </span>
                      {p.solutionSummary}
                    </div>
                  ) : null}
                  {p.problemStatement ? (
                    <div>
                      <span className="text-muted-foreground">문제정의: </span>
                      {p.problemStatement}
                    </div>
                  ) : null}
                  {p.targetUsers ? (
                    <div>
                      <span className="text-muted-foreground">대상 사용자: </span>
                      {p.targetUsers}
                    </div>
                  ) : null}
                </>
              )}
              <div className="pt-2">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  팀원
                </div>
                {data.members.length === 0 ? (
                  <span className="text-xs text-muted-foreground">없음</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {data.members.map((m) => (
                      <Badge key={m.id} variant="outline" className="text-xs">
                        {m.studentName}
                        {m.role ? ` · ${m.role}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">마일스톤</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.milestones.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  마일스톤이 없습니다.
                </span>
              ) : (
                data.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 border-b border-border pb-1"
                  >
                    <span className="min-w-0 truncate">{m.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {m.dueAt && (
                        <span className="text-xs text-muted-foreground">
                          ~{format(new Date(m.dueAt), "yy.MM.dd")}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {MILESTONE_LABEL[m.status] ?? m.status}
                      </Badge>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">최근 산출물</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.artifacts.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                등록된 산출물이 없습니다.
              </span>
            ) : (
              data.artifacts.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 border-b border-border pb-1"
                >
                  <span className="min-w-0 truncate">{a.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), "yy.MM.dd")}
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        열기
                      </a>
                    )}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">피드백</CardTitle>
            <p className="text-xs text-muted-foreground">
              이 팀에 남겨진 모든 피드백입니다. 이전 담당 멘토와 운영진이 남긴 것도 포함됩니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeedbackForm projectId={id} members={data.members} />
            {data.feedback.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                아직 피드백이 없습니다.
              </span>
            ) : (
              data.feedback.map((f) => (
                <div
                  key={f.id}
                  className="space-y-1 rounded border border-border p-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {FEEDBACK_TYPE_LABEL[f.feedbackType] ?? f.feedbackType}
                    </Badge>
                    <span className="text-muted-foreground">
                      {f.authorName ?? "작성자 없음"} ·{" "}
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
                  <p className="whitespace-pre-wrap">{f.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>상태체크 이력</span>
              {data.statusChecks.length > 0 ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {data.statusChecks.length}건
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.statusChecks.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                아직 상태체크가 없습니다.
              </span>
            ) : (
              visibleChecks.map((c) => (
                <div
                  key={c.id}
                  className="space-y-1 rounded border border-border p-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={TEAM_STATUS_STYLE[c.teamStatus]}
                    >
                      {TEAM_STATUS_LABEL[c.teamStatus]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.checkedAt), "yyyy.MM.dd")}
                      {c.authorName ? ` · ${c.authorName}` : ""}
                    </span>
                    {c.needsOpsSupport && (
                      <Badge
                        variant="outline"
                        className={
                          c.opsResolvedAt
                            ? "text-xs text-muted-foreground"
                            : "border-primary text-xs text-primary"
                        }
                      >
                        {c.opsResolvedAt ? "지원 처리됨" : "지원 요청 중"}
                      </Badge>
                    )}
                  </div>
                  {c.blocker && (
                    <div>
                      <span className="text-muted-foreground">블로커: </span>
                      {c.blocker}
                    </div>
                  )}
                  {c.nextFocus && (
                    <div>
                      <span className="text-muted-foreground">다음 초점: </span>
                      {c.nextFocus}
                    </div>
                  )}
                  {c.comment && (
                    <p className="text-muted-foreground">{c.comment}</p>
                  )}
                </div>
              ))
            )}
            {data.statusChecks.length > RECENT_CHECKS ? (
              <button
                type="button"
                onClick={() => setShowAllChecks((v) => !v)}
                className="w-full rounded-md border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showAllChecks
                  ? `최근 ${RECENT_CHECKS}건만 보기`
                  : `이전 ${data.statusChecks.length - RECENT_CHECKS}건 더 보기`}
              </button>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4">
        <TeamMeetings viewer="mentor" ownerType="project" ownerId={id} />
        <TeamLinks viewer="mentor" ownerType="project" ownerId={id} />
      </div>
    </>
  );
}
