import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, BookOpen, Plus, ChevronDown, X } from "lucide-react";
import { api, type Cohort, type Student } from "@/lib/mvp3-api";
import { toast } from "@/hooks/use-toast";

type Study = {
  id: number;
  title: string;
  topic: string | null;
  status: "proposed" | "rejected" | "planned" | "active" | "completed" | "archived";
  cohortId: number;
  cohortName: string | null;
  leaderName: string | null;
  reviewNote: string | null;
};

const STATUS_LABEL: Record<Study["status"], string> = {
  proposed: "심사 중",
  rejected: "반려됨",
  planned: "준비 중",
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};

const STATUS_STYLE: Record<Study["status"], string> = {
  proposed: "border-amber-500 text-amber-700 dark:text-amber-400",
  rejected: "border-destructive text-destructive",
  planned: "text-muted-foreground",
  active: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  completed: "border-blue-500 text-blue-700 dark:text-blue-400",
  archived: "text-muted-foreground opacity-70",
};

type StudyMember = {
  id: number;
  studentId: number;
  studentName: string;
  role: string | null;
};

/**
 * 스터디 개설 요청 심사 (design 06 §10).
 *
 * 목록 맨 위에 세운다 — 대기 중인 제안은 누가 답을 기다리고 있다는 뜻이고,
 * 표 안 어딘가의 한 행으로 두면 그 사실이 보이지 않는다. 대기가 없으면 아무것도
 * 그리지 않으므로 평소에는 화면을 차지하지 않는다.
 *
 * 승인/반려는 `growth` 기능 역할만 가능하다(서버가 403). 다른 담당자에게도
 * 버튼은 보이되 눌렀을 때 이유가 있는 오류를 받는 편이, 버튼을 감춰 "왜 나만
 * 안 보이지"를 만드는 것보다 낫다 — 여기서는 권한이 곧 업무 분담이기 때문이다.
 */
function ReviewQueue({ studies }: { studies: Study[] }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<Record<number, string>>({});
  const pending = studies.filter((s) => s.status === "proposed");

  const review = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      api(`/admin/studies/${id}/${action}`, {
        method: "POST",
        body: { note: note[id]?.trim() || undefined },
      }),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ["admin-studies"] });
      toast({ title: v.action === "approve" ? "승인했습니다" : "반려했습니다" });
    },
    onError: (e: unknown) =>
      toast({
        title: e instanceof Error ? e.message : "처리하지 못했습니다",
        variant: "destructive",
      }),
  });

  if (pending.length === 0) return null;

  return (
    <section className="space-y-2" data-testid="study-review-queue">
      <h2 className="text-sm font-semibold">
        심사 대기 <Badge variant="secondary">{pending.length}</Badge>
      </h2>
      <div className="grid gap-3">
        {pending.map((s) => (
          <Card key={s.id} className="border-amber-500/40" data-testid={`study-review-${s.id}`}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.leaderName ?? "제안자 미상"} · {s.cohortName ?? "기수 미지정"}
                    {s.topic ? ` · ${s.topic}` : ""}
                  </p>
                </div>
              </div>
              <Input
                placeholder="사유 — 반려에는 반드시 필요합니다"
                value={note[s.id] ?? ""}
                onChange={(e) => setNote({ ...note, [s.id]: e.target.value })}
                data-testid={`study-review-note-${s.id}`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: s.id, action: "approve" })}
                  data-testid={`study-approve-${s.id}`}
                >
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending || !(note[s.id] ?? "").trim()}
                  title={!(note[s.id] ?? "").trim() ? "반려 사유를 적어 주세요" : undefined}
                  onClick={() => review.mutate({ id: s.id, action: "reject" })}
                  data-testid={`study-reject-${s.id}`}
                >
                  반려
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Member management for one study. Without this, study_members is unreachable. */
function MemberPanel({ studyId }: { studyId: number }) {
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-study", studyId],
    queryFn: () =>
      api<{ members: StudyMember[] }>(`/admin/studies/${studyId}`),
  });
  const { data: students } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => api<{ items: Student[] }>("/admin/students"),
  });

  const add = useMutation({
    mutationFn: () =>
      api(`/admin/studies/${studyId}/members`, {
        method: "POST",
        body: { studentId: Number(studentId), role: role || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-study", studyId] });
      setStudentId("");
      setRole("");
    },
    onError: (e: any) =>
      toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (memberId: number) =>
      api(`/admin/studies/${studyId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-study", studyId] }),
  });

  return (
    <div className="space-y-2 bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        {(data?.members ?? []).length === 0 ? (
          <span className="text-xs text-muted-foreground">참여자가 없습니다.</span>
        ) : (
          data!.members.map((m) => (
            <Badge key={m.id} variant="outline" className="gap-1 text-xs">
              {m.studentName}
              {m.role ? ` · ${m.role}` : ""}
              <button
                type="button"
                onClick={() => remove.mutate(m.id)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                aria-label="참여자 제거"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="학생 선택…" />
          </SelectTrigger>
          <SelectContent>
            {students?.items.map((st) => (
              <SelectItem key={st.id} value={String(st.id)}>
                {st.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-40 text-xs"
          placeholder="역할 (선택)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Button
          size="sm"
          className="h-8"
          disabled={!studentId || add.isPending}
          onClick={() => add.mutate()}
        >
          참여자 추가
        </Button>
      </div>
    </div>
  );
}

export default function AdminStudies() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cohortId: "", title: "", topic: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-studies"],
    queryFn: () => api<{ items: Study[]; total: number }>("/admin/studies"),
  });
  const { data: cohorts } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts"),
  });

  const create = useMutation({
    mutationFn: () =>
      api("/admin/studies", {
        method: "POST",
        body: {
          cohortId: Number(form.cohortId),
          title: form.title,
          topic: form.topic || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-studies"] });
      setForm({ cohortId: "", title: "", topic: "" });
      setOpen(false);
      toast({ title: "스터디가 생성되었습니다." });
    },
    onError: (e: any) =>
      toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: number; status: Study["status"] }) =>
      api(`/admin/studies/${v.id}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-studies"] }),
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6 text-primary" />
              스터디
            </h1>
            <p className="text-sm text-muted-foreground">
              학생 주도 스터디입니다. 기수 내 공개이며 별도 공개범위 설정이 없습니다 —
              자료·산출물은 산출물(Artifacts)의 공개범위를 따릅니다.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> 스터디 추가
          </Button>
        </div>

        {isLoading && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        <ReviewQueue studies={data?.items ?? []} />


        {data && data.items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            등록된 스터디가 없습니다.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">제목</th>
                  <th className="px-3 py-2 text-left">주제</th>
                  <th className="px-3 py-2 text-left">기수</th>
                  <th className="px-3 py-2 text-left">리더</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-left">참여자</th>
                </tr>
              </thead>
              <tbody>
                {data.items.flatMap((s) => [
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{s.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.topic ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.cohortName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.leaderName ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          setStatus.mutate({ id: s.id, status: v as Study["status"] })
                        }
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as Study["status"][]).map((k) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {STATUS_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      >
                        관리
                        <ChevronDown
                          className={`h-3 w-3 transition ${expanded === s.id ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </td>
                  </tr>,
                  expanded === s.id ? (
                    <tr key={`${s.id}-members`} className="border-t">
                      <td colSpan={6} className="p-0">
                        <MemberPanel studyId={s.id} />
                      </td>
                    </tr>
                  ) : null,
                ])}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>스터디 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Select
                value={form.cohortId}
                onValueChange={(v) => setForm({ ...form, cohortId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="기수 선택…" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts?.items.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="스터디 제목"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Input
                placeholder="주제 (선택)"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button
                disabled={!form.cohortId || !form.title || create.isPending}
                onClick={() => create.mutate()}
              >
                생성
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
