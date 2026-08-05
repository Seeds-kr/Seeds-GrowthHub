import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Student, type Cohort } from "@/lib/mvp3-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

type AcceptedApp = {
  id: number;
  name: string;
  email: string;
  school: string;
};

type ConvertResult = {
  id: number;
  userId: number;
  name: string;
  email: string;
  activationPath?: string;
  activationToken?: string;
  expiresAt?: string;
};

export default function AdminStudents() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cohortId, setCohortId] = useState<string>("all");
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [activationResult, setActivationResult] = useState<ConvertResult | null>(null);
  const [copied, setCopied] = useState(false);

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
    mutationFn: (vars: { appId: number }) =>
      api<ConvertResult>(`/admin/applications/${vars.appId}/convert-to-student`, {
        method: "POST",
        body: {},
      }),
    onSuccess: (data) => {
      toast({ title: "학생 계정 생성 완료", description: "활성화 링크를 학생에게 전달해주세요." });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["admin-applications-accepted-pending"] });
      setConvertOpen(false);
      setSelectedAppId(null);
      setActivationResult(data);
      setCopied(false);
    },
    onError: (err: any) => toast({ title: "전환 실패", description: err?.data?.error ?? err.message, variant: "destructive" }),
  });

  const activationUrl = activationResult?.activationPath
    ? `${window.location.origin}${activationResult.activationPath}`
    : "";

  const copyActivationUrl = async () => {
    if (!activationUrl) return;
    try {
      await navigator.clipboard.writeText(activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "복사 실패", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">학생 관리</h1>
        <Button className="" onClick={() => setConvertOpen(true)}>합격자 → 학생 전환</Button>
      </div>
      <div className="rounded-lg bg-card border border-border p-6 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="이름, 이메일, 학교 검색…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-full md:w-64">
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger className=""><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기수</SelectItem>
              {cohorts?.items.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow>
            <TableHead>이름</TableHead><TableHead>이메일</TableHead><TableHead>학교</TableHead><TableHead>활성화</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">학생이 없습니다.</TableCell></TableRow>
            : data?.items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer relative focus-within:bg-muted/60 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[hsl(var(--ring))]">
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/students/${s.id}`}
                    aria-label={`${s.name} 학생 상세 보기`}
                    className="absolute inset-0 z-10 focus-visible:outline-none"
                  />
                  {s.name}
                </TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.school ?? "-"}</TableCell>
                <TableCell><Badge variant={s.isActive ? "default" : "outline"} className="">{s.isActive ? "활성" : "비활성"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>합격자를 학생으로 전환</DialogTitle>
            <DialogDescription>
              학생 계정이 생성되고, 본인이 직접 비밀번호를 설정할 수 있는 1회용 활성화 링크가 발급됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAppId ? String(selectedAppId) : ""} onValueChange={(v) => setSelectedAppId(Number(v))}>
              <SelectTrigger className=""><SelectValue placeholder="합격자 선택…" /></SelectTrigger>
              <SelectContent>
                {pending?.items.length === 0 ? <SelectItem value="-" disabled>전환 가능한 합격자가 없습니다.</SelectItem>
                  : pending?.items.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="" onClick={() => setConvertOpen(false)}>취소</Button>
            <Button className="" disabled={!selectedAppId || convert.isPending} onClick={() => selectedAppId && convert.mutate({ appId: selectedAppId })}>
              {convert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}계정 생성 + 활성화 링크 발급
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activationResult} onOpenChange={(open) => !open && setActivationResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>활성화 링크 발급 완료</DialogTitle>
            <DialogDescription>
              아래 링크를 <strong>{activationResult?.name} ({activationResult?.email})</strong> 학생에게 직접 전달해주세요. 본인이 링크를 열고 비밀번호를 설정하면 로그인할 수 있습니다. 링크는 14일간 유효하며, 1회만 사용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border border-border bg-muted p-3 text-xs break-all font-mono">{activationUrl}</div>
            <Button className="w-full" onClick={copyActivationUrl}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "복사됨" : "링크 복사"}
            </Button>
            {activationResult?.expiresAt && (
              <p className="text-xs text-muted-foreground">만료: {new Date(activationResult.expiresAt).toLocaleString()}</p>
            )}
            <p className="text-xs text-muted-foreground">
              이 링크는 이 화면을 닫으면 다시 볼 수 없습니다. 만료되거나 분실 시 학생 상세 페이지에서 재발급할 수 있습니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="" onClick={() => setActivationResult(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
