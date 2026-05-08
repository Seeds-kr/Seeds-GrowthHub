import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute } from "wouter";
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

export default function AdminProjectDetail() {
  const [, params] = useRoute("/admin/projects/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-project", id],
    queryFn: () => api<{ project: Project; members: ProjectMember[]; artifacts: Mvp4Artifact[]; feedback: FeedbackItem[]; tags: { id: number; name: string }[] }>(`/admin/projects/${id}`),
    enabled: Number.isFinite(id),
  });
  const { data: students } = useQuery({ queryKey: ["admin-students"], queryFn: () => api<{ items: Student[] }>("/admin/students") });
  const { data: tags } = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<{ items: SkillTag[] }>("/admin/tags") });
  const { data: tagMappings } = useQuery({
    queryKey: ["admin-tag-mappings", "project", id],
    queryFn: () => api<{ items: TagMapping[] }>(`/admin/tag-mappings?targetType=project&targetId=${id}`),
    enabled: Number.isFinite(id),
  });

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
        <Card className="rounded-none">
          <CardHeader><CardTitle>프로젝트 정보</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">설명: </span>{p.description ?? "-"}</div>
            <div><span className="text-muted-foreground">문제 정의: </span>{p.problemStatement ?? "-"}</div>
            <div><span className="text-muted-foreground">해결책 요약: </span>{p.solutionSummary ?? "-"}</div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">상태 변경:</span>
              <Select value={statusVal || p.status} onValueChange={(v) => setStatusVal(v as ProjectStatus)}>
                <SelectTrigger className="rounded-none w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="rounded-none" disabled={!statusVal || statusVal === p.status} onClick={() => updateProject.mutate({ status: statusVal })}>저장</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>팀원</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.members.length === 0 ? <div className="text-sm text-muted-foreground">팀원이 없습니다.</div>
            : data.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-border pb-1">
                <span><strong>{m.studentName}</strong>{m.role ? ` · ${m.role}` : ""}</span>
                <Button variant="outline" size="sm" className="rounded-none" onClick={() => delMember.mutate(m.id)}>제거</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Select value={memberForm.studentId} onValueChange={(v) => setMemberForm({ ...memberForm, studentId: v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="학생 선택…" /></SelectTrigger>
                <SelectContent>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="rounded-none" placeholder="역할 (선택)" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} />
              <Button className="rounded-none" disabled={!memberForm.studentId || addMember.isPending} onClick={() => addMember.mutate()}>추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>아티팩트</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.artifacts.length === 0 ? <div className="text-sm text-muted-foreground">아티팩트가 없습니다.</div>
            : data.artifacts.map((a) => (
              <div key={a.id} className="text-sm border-b border-border pb-1">
                <a className="font-medium hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
                <Badge variant="outline" className="rounded-none ml-2">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge>
                <Badge variant="outline" className="rounded-none ml-1">{ARTIFACT_VISIBILITY_LABEL[a.visibility]}</Badge>
              </div>
            ))}
            <div className="space-y-2">
              <Input className="rounded-none" placeholder="제목" value={artForm.title} onChange={(e) => setArtForm({ ...artForm, title: e.target.value })} />
              <Input className="rounded-none" placeholder="URL" value={artForm.url} onChange={(e) => setArtForm({ ...artForm, url: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={artForm.artifactType} onValueChange={(v) => setArtForm({ ...artForm, artifactType: v as ArtifactType })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_TYPES.map((t) => <SelectItem key={t} value={t}>{ARTIFACT_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={artForm.visibility} onValueChange={(v) => setArtForm({ ...artForm, visibility: v as ArtifactVisibility })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{ARTIFACT_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{ARTIFACT_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="rounded-none w-full" disabled={!artForm.title || !artForm.url || addArt.isPending} onClick={() => addArt.mutate()}>아티팩트 추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader><CardTitle>피드백</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.feedback.length === 0 ? <div className="text-sm text-muted-foreground">피드백이 없습니다.</div>
            : data.feedback.map((f) => (
              <div key={f.id} className="text-sm border-b border-border pb-2">
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="rounded-none">{FEEDBACK_TYPE_LABEL[f.feedbackType]}</Badge>
                  <Badge variant="outline" className="rounded-none">{FEEDBACK_VISIBILITY_LABEL[f.visibility]}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(f.createdAt), "yyyy-MM-dd")}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap">{f.content}</div>
              </div>
            ))}
            <div className="space-y-2">
              <Select value={fbForm.studentId || "none"} onValueChange={(v) => setFbForm({ ...fbForm, studentId: v === "none" ? "" : v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="대상 학생 (선택)" /></SelectTrigger>
                <SelectContent><SelectItem value="none">학생 미지정</SelectItem>{students?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea className="rounded-none" placeholder="피드백 내용" value={fbForm.content} onChange={(e) => setFbForm({ ...fbForm, content: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={fbForm.feedbackType} onValueChange={(v) => setFbForm({ ...fbForm, feedbackType: v as FeedbackType })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_TYPES.map((t) => <SelectItem key={t} value={t}>{FEEDBACK_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={fbForm.visibility} onValueChange={(v) => setFbForm({ ...fbForm, visibility: v as FeedbackVisibility })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{FEEDBACK_VISIBILITY_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="rounded-none w-full" disabled={!fbForm.content || addFb.isPending} onClick={() => addFb.mutate()}>피드백 추가</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none lg:col-span-2">
          <CardHeader><CardTitle>스킬 태그</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {(tagMappings?.items ?? []).map((m) => (
                <Badge key={m.mappingId} variant="outline" className="rounded-none cursor-pointer" onClick={() => detachTag.mutate(m.mappingId)}>{m.name} ✕</Badge>
              ))}
              {(tagMappings?.items ?? []).length === 0 && <span className="text-sm text-muted-foreground">태그가 없습니다.</span>}
            </div>
            <div className="flex gap-2">
              <Select value={tagSel} onValueChange={setTagSel}>
                <SelectTrigger className="rounded-none w-60"><SelectValue placeholder="태그 선택…" /></SelectTrigger>
                <SelectContent>{tags?.items.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button className="rounded-none" disabled={!tagSel || attachTag.isPending} onClick={() => attachTag.mutate()}>태그 추가</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
