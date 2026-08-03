import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, PROJECT_STATUSES, PROJECT_STATUS_LABEL,
  ARTIFACT_TYPES, ARTIFACT_TYPE_LABEL,
  ARTIFACT_VISIBILITIES, ARTIFACT_VISIBILITY_LABEL,
  FEEDBACK_TYPES, FEEDBACK_TYPE_LABEL,
  FEEDBACK_VISIBILITIES, FEEDBACK_VISIBILITY_LABEL,
  type Project, type ProjectMember, type Mvp4Artifact, type FeedbackItem,
  type ArtifactType, type ArtifactVisibility, type FeedbackType, type FeedbackVisibility,
  type ProjectStatus, type Student, type SkillTag, type TagMapping,
} from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type MentorAssignment = {
  id: number; mentorUserId: number; mentorName: string; mentorEmail: string;
  roleLabel: string | null; status: "active" | "ended";
  assignedAt: string; endedAt: string | null;
};
type Milestone = {
  id: number; title: string; description: string | null; dueAt: string | null;
  status: "planned" | "in_progress" | "done" | "dropped"; sortOrder: number;
  completedAt: string | null;
};
type StatusCheck = {
  id: number; checkedAt: string; teamStatus: "good" | "watch" | "risk" | "blocked";
  blocker: string | null; nextFocus: string | null; needsOpsSupport: boolean;
  opsSupportNote: string | null; opsResolvedAt: string | null;
  comment: string | null; authorName: string | null;
};
type ProjectDetail = {
  project: Project; members: ProjectMember[]; artifacts: Mvp4Artifact[];
  feedback: FeedbackItem[]; tags: { id: number; name: string }[];
  mentors: MentorAssignment[]; milestones: Milestone[]; statusChecks: StatusCheck[];
};

const MILESTONE_STATUS_LABEL: Record<Milestone["status"], string> = {
  planned: "예정", in_progress: "진행 중", done: "완료", dropped: "계획 변경",
};
// `dropped` is a plan change, not a failure — keep it neutral, never destructive.
const MILESTONE_STATUS_STYLE: Record<Milestone["status"], string> = {
  planned: "text-muted-foreground",
  in_progress: "border-blue-500 text-blue-700 dark:text-blue-400",
  done: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  dropped: "text-muted-foreground",
};
const TEAM_STATUS_LABEL: Record<StatusCheck["teamStatus"], string> = {
  good: "양호", watch: "관찰 필요", risk: "위험", blocked: "막힘",
};
const TEAM_STATUS_STYLE: Record<StatusCheck["teamStatus"], string> = {
  good: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  watch: "border-amber-500 text-amber-700 dark:text-amber-400",
  risk: "border-orange-500 text-orange-700 dark:text-orange-400",
  blocked: "border-red-500 text-red-700 dark:text-red-400",
};

export default function AdminProjectDetail() {
  const [, params] = useRoute("/admin/projects/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-project", id],
    queryFn: () => api<ProjectDetail>(`/admin/projects/${id}`),
    enabled: Number.isFinite(id),
  });
  const { data: students } = useQuery({ queryKey: ["admin-students"], queryFn: () => api<{ items: Student[] }>("/admin/students") });
  const { data: tags } = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<{ items: SkillTag[] }>("/admin/tags") });
  const { data: tagMappings } = useQuery({
    queryKey: ["admin-tag-mappings", "project", id],
    queryFn: () => api<{ items: TagMapping[] }>(`/admin/tag-mappings?targetType=project&targetId=${id}`),
    enabled: Number.isFinite(id),
  });

  // Only accounts with the mentor role can be assigned (server enforces too).
  const { data: mentorUsers } = useQuery({
    queryKey: ["admin-users", "mentor"],
    queryFn: () => api<{ items: { id: number; name: string; email: string }[] }>("/admin/users?role=mentor"),
  });

  const [mentorForm, setMentorForm] = useState({ mentorUserId: "", roleLabel: "" });
  const [msForm, setMsForm] = useState({ title: "", dueAt: "" });
  const [memberForm, setMemberForm] = useState({ studentId: "", role: "" });
  const [statusVal, setStatusVal] = useState<ProjectStatus | "">("");
  const [artForm, setArtForm] = useState({ title: "", url: "", artifactType: "link" as ArtifactType, visibility: "student_visible" as ArtifactVisibility });
  const [fbForm, setFbForm] = useState({ studentId: "", content: "", feedbackType: "general" as FeedbackType, visibility: "admin_only" as FeedbackVisibility });
  const [tagSel, setTagSel] = useState("");

  const updateProject = useMutation({
    mutationFn: (body: any) => api(`/admin/projects/${id}`, { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); toast({ title: "저장됨" }); },
  });
  const addMember = useMutation({
    mutationFn: () => api(`/admin/projects/${id}/members`, { method: "POST", body: { studentId: Number(memberForm.studentId), role: memberForm.role || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); setMemberForm({ studentId: "", role: "" }); toast({ title: "추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const delMember = useMutation({
    mutationFn: (mid: number) => api(`/admin/projects/${id}/members/${mid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", id] }),
  });
  const addMentor = useMutation({
    mutationFn: () => api(`/admin/projects/${id}/mentors`, { method: "POST", body: { mentorUserId: Number(mentorForm.mentorUserId), roleLabel: mentorForm.roleLabel || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); setMentorForm({ mentorUserId: "", roleLabel: "" }); toast({ title: "멘토 배정됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const endMentor = useMutation({
    mutationFn: (aid: number) => api(`/admin/projects/${id}/mentors/${aid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); toast({ title: "담당 종료됨" }); },
  });
  const addMilestone = useMutation({
    mutationFn: () => api(`/admin/projects/${id}/milestones`, { method: "POST", body: { title: msForm.title, dueAt: msForm.dueAt ? new Date(msForm.dueAt).toISOString() : null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); setMsForm({ title: "", dueAt: "" }); toast({ title: "추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const setMilestoneStatus = useMutation({
    mutationFn: (v: { mid: number; status: Milestone["status"] }) => api(`/admin/projects/${id}/milestones/${v.mid}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", id] }),
  });
  const resolveSupport = useMutation({
    mutationFn: (checkId: number) => api(`/admin/status-checks/${checkId}/resolve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); toast({ title: "지원 요청 처리됨" }); },
  });

  const addArt = useMutation({
    mutationFn: () => api(`/admin/artifacts`, { method: "POST", body: { ...artForm, projectId: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); setArtForm({ title: "", url: "", artifactType: "link", visibility: "student_visible" }); toast({ title: "추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const addFb = useMutation({
    mutationFn: () => api(`/admin/feedback`, { method: "POST", body: {
      targetType: "project", targetId: id,
      studentId: fbForm.studentId ? Number(fbForm.studentId) : null,
      content: fbForm.content, feedbackType: fbForm.feedbackType, visibility: fbForm.visibility,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-project", id] }); setFbForm({ studentId: "", content: "", feedbackType: "general", visibility: "admin_only" }); toast({ title: "추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const attachTag = useMutation({
    mutationFn: () => api(`/admin/tag-mappings`, { method: "POST", body: { tagId: Number(tagSel), targetType: "project", targetId: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tag-mappings", "project", id] }); setTagSel(""); toast({ title: "태그 추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const detachTag = useMutation({
    mutationFn: (mid: number) => api(`/admin/tag-mappings/${mid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tag-mappings", "project", id] }),
  });

  if (isLoading || !data) return <AdminLayout><Loader2 className="animate-spin mx-auto" /></AdminLayout>;
  const p = data.project;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold">{p.title}</h1>
        <div className="text-sm text-muted-foreground">{p.cohortName ?? ""} · {PROJECT_STATUS_LABEL[p.status]}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>프로젝트 정보</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">설명: </span>{p.description ?? "-"}</div>
            <div><span className="text-muted-foreground">문제 정의: </span>{p.problemStatement ?? "-"}</div>
            <div><span className="text-muted-foreground">해결책 요약: </span>{p.solutionSummary ?? "-"}</div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">상태 변경:</span>
              <Select value={statusVal || p.status} onValueChange={(v) => setStatusVal(v as ProjectStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" disabled={!statusVal || statusVal === p.status} onClick={() => updateProject.mutate({ status: statusVal })}>저장</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>팀원</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.members.length === 0 ? <div className="text-sm text-muted-foreground">팀원이 없습니다.</div>
            : data.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-border pb-1">
                <span><strong>{m.studentName}</strong>{m.role ? ` · ${m.role}` : ""}</span>
                <Button variant="outline" size="sm" onClick={() => delMember.mutate(m.id)}>제거</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Select value={memberForm.studentId} onValueChange={(v) => setMemberForm({ ...memberForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="학생 선택…" /></SelectTrigger>
                <SelectContent>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="역할 (선택)" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} />
              <Button disabled={!memberForm.studentId || addMember.isPending} onClick={() => addMember.mutate()}>추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>담당 멘토</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.mentors.length === 0 ? (
              <div className="text-sm text-muted-foreground">배정된 멘토가 없습니다.</div>
            ) : data.mentors.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-b border-border pb-1 text-sm">
                <span className={m.status === "ended" ? "text-muted-foreground" : ""}>
                  <strong>{m.mentorName}</strong>
                  {m.roleLabel ? ` · ${m.roleLabel}` : ""}
                  {m.status === "ended" && (
                    <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                      담당 종료 {m.endedAt ? format(new Date(m.endedAt), "yy.MM.dd") : ""}
                    </Badge>
                  )}
                </span>
                {m.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => endMentor.mutate(m.id)}>담당 종료</Button>
                )}
              </div>
            ))}
            {/* 배정 후보는 people_profiles가 아니라 `role=mentor` 계정이다.
                mentor-seed.ts가 넣는 멘토 프로필은 user_id가 비어 있어서,
                새로 설치한 직후에는 /admin/people에 멘토가 9명 보이는데
                이 목록은 0명인 상태가 된다. 빈 드롭다운만 두면 원인을 알 수 없어
                멘토 축 전체(상태체크·피드백·Mentor Workspace)가 조용히 막힌다. */}
            {mentorUsers && mentorUsers.items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">
                  배정할 수 있는 멘토 계정이 없습니다.
                </p>
                <p>
                  멘토 <strong>프로필</strong>(<Link href="/admin/people" className="text-primary hover:underline">사람들 프로필</Link>)과
                  로그인할 수 있는 <strong>계정</strong>은 별개입니다. 배정은 계정 기준이라 두 단계가 필요합니다.
                </p>
                <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                  <li>
                    <Link href="/admin/users" className="text-primary hover:underline">사용자</Link>에서
                    역할 <code className="font-mono">mentor</code>로 계정을 만든다
                  </li>
                  <li>
                    <Link href="/admin/people" className="text-primary hover:underline">사람들 프로필</Link>에서
                    해당 멘토 프로필에 그 계정을 연결한다
                  </li>
                </ol>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={mentorForm.mentorUserId} onValueChange={(v) => setMentorForm({ ...mentorForm, mentorUserId: v })}>
                  <SelectTrigger><SelectValue placeholder="멘토 선택…" /></SelectTrigger>
                  <SelectContent>{mentorUsers?.items.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="역할 (예: 기술 멘토)" value={mentorForm.roleLabel} onChange={(e) => setMentorForm({ ...mentorForm, roleLabel: e.target.value })} />
                <Button disabled={!mentorForm.mentorUserId || addMentor.isPending} onClick={() => addMentor.mutate()}>배정</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              담당 종료는 삭제가 아닙니다 — 기록은 남고 접근만 즉시 끊깁니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>마일스톤</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.milestones.length === 0 ? (
              <div className="text-sm text-muted-foreground">마일스톤이 없습니다.</div>
            ) : data.milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-b border-border pb-1 text-sm">
                <span className="min-w-0">
                  <strong className="truncate">{m.title}</strong>
                  {m.dueAt && <span className="ml-2 text-xs text-muted-foreground">~{format(new Date(m.dueAt), "yy.MM.dd")}</span>}
                </span>
                <Select value={m.status} onValueChange={(v) => setMilestoneStatus.mutate({ mid: m.id, status: v as Milestone["status"] })}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["planned", "in_progress", "done", "dropped"] as const).map((v) => (
                      <SelectItem key={v} value={v}>{MILESTONE_STATUS_LABEL[v]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="마일스톤 제목" value={msForm.title} onChange={(e) => setMsForm({ ...msForm, title: e.target.value })} />
              <Input type="date" className="w-40" value={msForm.dueAt} onChange={(e) => setMsForm({ ...msForm, dueAt: e.target.value })} />
              <Button disabled={!msForm.title || addMilestone.isPending} onClick={() => addMilestone.mutate()}>추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>팀 상태체크 이력</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              담당 멘토가 작성합니다. 수정·삭제되지 않으며(append-only), <strong>학생에게 노출되지 않습니다.</strong>
            </p>
            {data.statusChecks.length === 0 ? (
              <div className="text-sm text-muted-foreground">아직 상태체크가 없습니다.</div>
            ) : data.statusChecks.map((c) => (
              <div key={c.id} className="space-y-1 rounded border border-border p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={TEAM_STATUS_STYLE[c.teamStatus]}>
                    {TEAM_STATUS_LABEL[c.teamStatus]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.checkedAt), "yyyy.MM.dd")}
                    {c.authorName ? ` · ${c.authorName}` : ""}
                  </span>
                  {c.needsOpsSupport && !c.opsResolvedAt && (
                    <>
                      <Badge className="bg-primary text-primary-foreground text-xs">운영진 지원 요청</Badge>
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => resolveSupport.mutate(c.id)}>
                        처리 완료
                      </Button>
                    </>
                  )}
                  {c.needsOpsSupport && c.opsResolvedAt && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">지원 처리됨</Badge>
                  )}
                </div>
                {c.blocker && <div><span className="text-muted-foreground">블로커: </span>{c.blocker}</div>}
                {c.nextFocus && <div><span className="text-muted-foreground">다음 초점: </span>{c.nextFocus}</div>}
                {c.opsSupportNote && <div><span className="text-muted-foreground">지원 요청: </span>{c.opsSupportNote}</div>}
                {c.comment && <div className="text-muted-foreground">{c.comment}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>아티팩트</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.artifacts.length === 0 ? <div className="text-sm text-muted-foreground">아티팩트가 없습니다.</div>
            : data.artifacts.map((a) => (
              <div key={a.id} className="text-sm border-b border-border pb-1">
                <a className="font-medium hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
                <Badge variant="outline" className="ml-2">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge>
                <Badge variant="outline" className="ml-1">{ARTIFACT_VISIBILITY_LABEL[a.visibility]}</Badge>
              </div>
            ))}
            <div className="space-y-2">
              <Input placeholder="제목" value={artForm.title} onChange={(e) => setArtForm({ ...artForm, title: e.target.value })} />
              <Input placeholder="URL" value={artForm.url} onChange={(e) => setArtForm({ ...artForm, url: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={artForm.artifactType} onValueChange={(v) => setArtForm({ ...artForm, artifactType: v as ArtifactType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_TYPES.map((t) => <SelectItem key={t} value={t}>{ARTIFACT_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={artForm.visibility} onValueChange={(v) => setArtForm({ ...artForm, visibility: v as ArtifactVisibility })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{ARTIFACT_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!artForm.title || !artForm.url || addArt.isPending} onClick={() => addArt.mutate()}>아티팩트 추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>피드백</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.feedback.length === 0 ? <div className="text-sm text-muted-foreground">피드백이 없습니다.</div>
            : data.feedback.map((f) => (
              <div key={f.id} className="text-sm border-b border-border pb-2">
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">{FEEDBACK_TYPE_LABEL[f.feedbackType]}</Badge>
                  <Badge variant="outline">{FEEDBACK_VISIBILITY_LABEL[f.visibility]}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(f.createdAt), "yyyy-MM-dd")}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap">{f.content}</div>
              </div>
            ))}
            <div className="space-y-2">
              <Select value={fbForm.studentId || "none"} onValueChange={(v) => setFbForm({ ...fbForm, studentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="대상 학생 (선택)" /></SelectTrigger>
                <SelectContent><SelectItem value="none">학생 미지정</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="피드백 내용" value={fbForm.content} onChange={(e) => setFbForm({ ...fbForm, content: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={fbForm.feedbackType} onValueChange={(v) => setFbForm({ ...fbForm, feedbackType: v as FeedbackType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_TYPES.map((t) => <SelectItem key={t} value={t}>{FEEDBACK_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={fbForm.visibility} onValueChange={(v) => setFbForm({ ...fbForm, visibility: v as FeedbackVisibility })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{FEEDBACK_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!fbForm.content || addFb.isPending} onClick={() => addFb.mutate()}>피드백 추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>스킬 태그</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {(tagMappings?.items ?? []).map((m) => (
                <Badge key={m.mappingId} variant="outline" className="cursor-pointer" onClick={() => detachTag.mutate(m.mappingId)}>{m.name} ✕</Badge>
              ))}
              {(tagMappings?.items ?? []).length === 0 && <span className="text-sm text-muted-foreground">태그가 없습니다.</span>}
            </div>
            <div className="flex gap-2">
              <Select value={tagSel} onValueChange={setTagSel}>
                <SelectTrigger className="w-60"><SelectValue placeholder="태그 선택…" /></SelectTrigger>
                <SelectContent>{tags?.items.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={!tagSel || attachTag.isPending} onClick={() => attachTag.mutate()}>태그 추가</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
