import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListApplications } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ApplicationStatus } from "@workspace/api-zod";

const statusLabels: Record<string, string> = {
  submitted: "제출 완료",
  reviewing: "검토 중",
  interview: "면접 대상",
  accepted: "최종 합격",
  rejected: "불합격",
  waitlisted: "예비 후보",
  withdrawn: "지원 취소",
};

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary",
  reviewing: "default",
  interview: "default",
  accepted: "default",
  rejected: "destructive",
  waitlisted: "outline",
  withdrawn: "outline",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AdminApplications() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 500);
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");

  const params: any = {};
  if (debouncedQ) params.q = debouncedQ;
  if (status !== "all") params.status = status;

  const { data, isLoading } = useListApplications(params);

  const handleExport = () => {
    window.open(`${import.meta.env.BASE_URL}api/admin/applications/export`, '_blank');
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif font-bold">지원서 관리</h1>
        <Button onClick={handleExport} variant="outline" className="">
          <Download className="w-4 h-4 mr-2" />
          CSV 내보내기
        </Button>
      </div>

      <div className="rounded-lg bg-card border border-border p-6 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="이름, 이메일, 학교 검색..." 
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {Object.entries(statusLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>학교</TableHead>
              <TableHead>학년</TableHead>
              <TableHead>제출일</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  조건에 맞는 지원서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((app) => (
                <TableRow key={app.id} className="cursor-pointer group relative focus-within:bg-muted/60 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[hsl(var(--ring))]">
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      aria-label={`${app.name} 지원서 열기`}
                      className="absolute inset-0 z-10 focus-visible:outline-none"
                    />
                    {app.name}
                  </TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell>{app.school}</TableCell>
                  <TableCell>{app.grade}</TableCell>
                  <TableCell>{format(new Date(app.submittedAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[app.status] || "default"} className="font-normal">
                      {statusLabels[app.status] || app.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
