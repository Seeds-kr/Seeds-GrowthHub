import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, ACTIVITY_SOURCE_LABEL, ACTIVITY_VISIBILITY_LABEL,
  type ActivityRecord, type SkillTag, type TagMapping,
} from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { RemovableTag } from "@/components/RemovableTag";

function TimelineItem({ r, allTags, onChange }: { r: ActivityRecord; allTags?: SkillTag[]; onChange: () => void }) {
  const qc = useQueryClient();
  const [tagSel, setTagSel] = useState("");
  const { data: mappings } = useQuery({
    queryKey: ["admin-tag-mappings", "activity_record", r.id],
    queryFn: () => api<{ items: TagMapping[] }>(`/admin/tag-mappings?targetType=activity_record&targetId=${r.id}`),
  });
  const attach = useMutation({
    mutationFn: () => api(`/admin/tag-mappings`, { method: "POST", body: { tagId: Number(tagSel), targetType: "activity_record", targetId: r.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tag-mappings", "activity_record", r.id] }); setTagSel(""); onChange(); toast({ title: "태그 추가됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });
  const detach = useMutation({
    mutationFn: (mid: number) => api(`/admin/tag-mappings/${mid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tag-mappings", "activity_record", r.id] }); onChange(); },
  });
  return (
    <Card className="rounded-none">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{format(new Date(r.activityDate), "yyyy-MM-dd")}</span>
          <Badge variant="outline" className="rounded-none">{ACTIVITY_SOURCE_LABEL[r.sourceType]}</Badge>
          <Badge variant="outline" className="rounded-none">{ACTIVITY_VISIBILITY_LABEL[r.visibility]}</Badge>
        </div>
        <div className="font-medium">{r.title}</div>
        {r.description && <div className="text-sm whitespace-pre-wrap">{r.description}</div>}
        <div className="flex flex-wrap gap-1">
          {(mappings?.items ?? []).map((m) => (
            <RemovableTag key={m.mappingId} name={m.name} onRemove={() => detach.mutate(m.mappingId)} disabled={detach.isPending} />
          ))}
          <Select value={tagSel} onValueChange={setTagSel}>
            <SelectTrigger className="rounded-none w-32 h-7"><SelectValue placeholder="+ 태그" /></SelectTrigger>
            <SelectContent>{allTags?.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="rounded-none h-7" disabled={!tagSel} onClick={() => attach.mutate()}>추가</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminStudentTimeline() {
  const [, params] = useRoute("/admin/students/:id/timeline");
  const id = Number(params?.id);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-student-timeline", id],
    queryFn: () => api<{ items: ActivityRecord[] }>(`/admin/students/${id}/timeline`),
    enabled: Number.isFinite(id),
  });
  const { data: tags } = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<{ items: SkillTag[] }>("/admin/tags") });
  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">활동 타임라인</h1>
        <div className="flex gap-2">
          <Link href={`/admin/students/${id}`}><Button variant="outline" className="rounded-none">학생 상세</Button></Link>
          <Link href={`/admin/students/${id}/report`}><Button className="rounded-none">리포트 보기</Button></Link>
        </div>
      </div>
      {isLoading ? <Loader2 className="animate-spin mx-auto" />
      : data?.items.length === 0 ? <div className="text-muted-foreground">기록이 없습니다.</div>
      : <div className="space-y-3">
          {data?.items.map((r) => <TimelineItem key={r.id} r={r} allTags={tags?.items} onChange={() => qc.invalidateQueries({ queryKey: ["admin-student-timeline", id] })} />)}
        </div>}
    </AdminLayout>
  );
}
