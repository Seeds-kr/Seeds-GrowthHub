import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { useRoute, Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const STATUSES = ["present", "late", "absent", "excused"] as const;

type Roster = { studentId: number; name: string; email: string; status: string | null; note: string | null; recordId: number | null };
type Resp = { session: { id: number; title: string; scheduledAt: string; locationOrLink: string | null }; roster: Roster[] };

export default function AdminSessionAttendance() {
  const [, params] = useRoute("/admin/sessions/:id/attendance");
  const id = params?.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-session-attendance", id],
    queryFn: () => api<Resp>(`/admin/sessions/${id}/attendance`),
    enabled: !!id,
  });
  const [draft, setDraft] = useState<Record<number, { status: string; note: string }>>({});

  useEffect(() => {
    if (!data) return;
    const d: Record<number, { status: string; note: string }> = {};
    for (const r of data.roster) d[r.studentId] = { status: r.status ?? "present", note: r.note ?? "" };
    setDraft(d);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api(`/admin/sessions/${id}/attendance`, {
      method: "PUT",
      body: { records: Object.entries(draft).map(([sid, v]) => ({ studentId: Number(sid), status: v.status, note: v.note || null })) },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-session-attendance", id] }); toast({ title: "저장됨" }); },
    onError: (e: any) => toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  if (isLoading || !data) return <AdminLayout><div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/sessions" className="text-sm text-muted-foreground hover:text-primary">← 세션 목록</Link></div>
      <h1 className="text-3xl font-serif font-bold mb-2">{data.session.title}</h1>
      <div className="text-muted-foreground text-sm mb-6">
        {format(new Date(data.session.scheduledAt), "yyyy-MM-dd HH:mm")}
        {data.session.locationOrLink ? ` · ${data.session.locationOrLink}` : ""}
      </div>
      {data.roster.length === 0 ? <div className="text-muted-foreground">이 세션의 기수에 학생이 없습니다.</div> : (
        <>
          <div className="bg-card border border-border mb-6">
            <Table>
              <TableHeader><TableRow><TableHead>학생</TableHead><TableHead>이메일</TableHead><TableHead>출석 상태</TableHead><TableHead>노트</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.roster.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      <Select value={draft[r.studentId]?.status ?? "present"} onValueChange={(v) => setDraft({ ...draft, [r.studentId]: { ...(draft[r.studentId] ?? { status: "present", note: "" }), status: v } })}>
                        <SelectTrigger className="rounded-none w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input className="rounded-none" value={draft[r.studentId]?.note ?? ""} onChange={(e) => setDraft({ ...draft, [r.studentId]: { ...(draft[r.studentId] ?? { status: "present", note: "" }), note: e.target.value } })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button className="rounded-none" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}출석 저장</Button>
        </>
      )}
    </AdminLayout>
  );
}
