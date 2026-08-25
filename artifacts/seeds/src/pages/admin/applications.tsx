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
import { EmptyState } from "@/components/EmptyState";

/**
 * 목록 뱃지는 **결정이 났으면 결과를, 아니면 단계를** 보여준다.
 *
 * 전에는 레거시 `status` 하나로 그렸는데 그 열거형이 단계와 결과를 섞고 있었다.
 * 최종 결정을 눌러도 `status` 는 그대로라, 합격자가 목록에서 "제출 완료" 로
 * 남았다. 두 축을 따로 읽어 실제로 맞는 것을 보여준다.
 */
const lifecycleLabels: Record<string, string> = {
  submitted: "접수",
  document_review: "서류 검토 중",
  document_review_completed: "서류 검토 완료",
  interview: "면접 단계",
  interview_scheduled: "면접 예정",
  interview_completed: "면접 완료",
  final_decision_made: "최종 결정",
  withdrawn: "지원 취소",
};

const decisionLabels: Record<string, string> = {
  accepted: "합격",
  rejected: "불합격",
  waitlisted: "예비",
  withdrawn: "취소",
};

const decisionColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  accepted: "default",
  rejected: "destructive",
  waitlisted: "outline",
  withdrawn: "secondary",
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
  if (status !== "all") params.applicationStatus = status;

  const { data, isLoading } = useListApplications(params);

  const handleExport = () => {
    window.open(`${import.meta.env.BASE_URL}api/admin/applications/export`, '_blank');
  };

  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-serif font-bold">지원서 관리</h1>
            {/* 몇 건인지 없으면 검색·필터를 걸고도 "걸렸나 안 걸렸나" 를 표로
                세어야 한다. 특히 좁혔을 때 0건과 로딩 중이 구분되지 않는다. */}
            {!isLoading && data ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="text-result-count">
                {debouncedQ || status !== "all" ? "조건에 맞는 지원서 " : "전체 "}
                <strong className="text-foreground">{data.items.length}</strong>건
              </p>
            ) : null}
          </div>
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
              <SelectValue placeholder="단계 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 단계</SelectItem>
              {Object.entries(lifecycleLabels).map(([key, label]) => (
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
                <TableCell colSpan={6} className="p-0">
                <EmptyState title="조건에 맞는 지원서가 없습니다."
                  hint="모집이 열리면 여기에 쌓입니다." />
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
                    {app.finalDecision && app.finalDecision !== "pending" ? (
                      <Badge
                        variant={decisionColors[app.finalDecision] ?? "default"}
                        className="font-normal"
                      >
                        {decisionLabels[app.finalDecision] ?? app.finalDecision}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        {lifecycleLabels[app.applicationStatus] ?? app.applicationStatus}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
