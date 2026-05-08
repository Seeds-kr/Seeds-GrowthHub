import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Student, type Cohort } from "@/lib/mvp3-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

type AcceptedApp = {
  id: number;
  name: string;
  email: string;
  school: string;
};

export default function AdminStudents() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cohortId, setCohortId] = useState<string>("all");
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [tempPassword, setTempPassword] = useState("");

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cohortId !== "all") params.set("cohortId", cohortId);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-students", q, cohortId],
    queryFn: () => api<{ items: Student[]; total: number }>(`/admin/students?${params.toString()}`),
  });
  const { data: cohorts } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: () => api<{ items: Cohort[] }>("/admin/cohorts"),
  });
  const { data: pending } = useQuery({
    queryKey: ["admin-applications-accepted-pending"],
    queryFn: () => api<{ items: AcceptedApp[] }>("/admin/applications-accepted-pending"),
  });

  const convert = useMutation({
    mutationFn: (vars: { appId: number; password: string }) =>
      api(`/admin/applications/${vars.appId}/convert-to-student`, {
        method: "POST",
        body: { password: vars.password },
      }),
    onSuccess: () => {
      toast({ title: "학생으로 전환 완료" });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["admin-applications-accepted-pending"] });
      setConvertOpen(false);
      setSelectedAppId(null);
      setTempPassword("");
    },
    onError: (err: any) => toast({ title: "전환 실패", description: err?.data?.error ?? err.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">학생 관리</h1>
        <Button className="rounded-none" onClick={() => setConvertOpen(true)}>합격자 → 학생 전환</Button>
      </div>
      <div className="bg-card border border-border p-6 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 rounded-none" placeholder="이름, 이메일, 학교 검색…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-full md:w-64">
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기수</SelectItem>
              {cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>이름</TableHead><TableHead>이메일</TableHead><TableHead>학교</TableHead><TableHead>활성화</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">학생이 없습니다.</TableCell></TableRow>
            : data?.items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer relative">
                <TableCell className="font-medium">
                  <Link href={`/admin/students/${s.id}`} className="absolute inset-0 z-10" />
                  {s.name}
                </TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.school ?? "-"}</TableCell>
                <TableCell><Badge variant={s.isActive ? "default" : "outline"} className="rounded-none">{s.isActive ? "활성" : "비활성"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle>합격자를 학생으로 전환</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAppId ? String(selectedAppId) : ""} onValueChange={(v) => setSelectedAppId(Number(v))}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="합격자 선택…" /></SelectTrigger>
              <SelectContent>
                {pending?.items.length === 0 ? <SelectItem value="-" disabled>전환 가능한 합격자가 없습니다.</SelectItem>
                  : pending?.items.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="rounded-none" type="password" placeholder="초기 비밀번호 (8자 이상)" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setConvertOpen(false)}>취소</Button>
            <Button className="rounded-none" disabled={!selectedAppId || tempPassword.length < 8 || convert.isPending} onClick={() => selectedAppId && convert.mutate({ appId: selectedAppId, password: tempPassword })}>
              {convert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}전환
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
