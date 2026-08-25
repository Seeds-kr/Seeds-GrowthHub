import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mic, ArrowRight } from "lucide-react";
import { api } from "@/lib/mvp3-api";

/**
 * W8 — `/admin/interviews`.
 *
 * Read-only by design. The `interviews` row is written from the application
 * detail (`PUT /admin/applications/:id/interview`) and keeping a single write
 * path avoids two screens disagreeing about the same row. This one answers
 * "what does the schedule look like", which no screen could answer before.
 */

const STATUSES = [
  "not_scheduled",
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
] as const;

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  not_scheduled: "미정",
  scheduled: "예정",
  completed: "완료",
  no_show: "불참",
  cancelled: "취소",
};

const STATUS_STYLE: Record<(typeof STATUSES)[number], string> = {
  not_scheduled: "text-muted-foreground",
  scheduled: "border-blue-500 text-blue-700 dark:text-blue-400",
  completed: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  no_show: "border-red-500 text-red-700 dark:text-red-400",
  cancelled: "text-muted-foreground line-through",
};

type Interview = {
  id: number;
  applicationId: number;
  applicantName: string;
  applicantEmail: string;
  applicationStatus: string | null;
  finalDecision: string | null;
  scheduledAt: string | null;
  locationOrLink: string | null;
  interviewerNote: string | null;
  status: (typeof STATUSES)[number];
  updatedAt: string;
};

export default function AdminInterviewsPage() {
  const [status, setStatus] = useState<string>("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-interviews", status],
    queryFn: () =>
      api<{ items: Interview[]; total: number; counts: Record<string, number> }>(
        `/admin/interviews${status ? `?status=${status}` : ""}`,
      ),
  });

  // A finance-only admin lands here with 403; say so rather than showing an
  // empty schedule that looks like "no interviews".
  if (isError) {
    const httpStatus = (error as any)?.status;
    return (
      <>
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          {httpStatus === 403
            ? "면접 정보는 모집(recruiting) 담당 운영진만 볼 수 있습니다."
            : `불러오지 못했습니다: ${(error as any)?.message ?? "알 수 없는 오류"}`}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
          <Mic className="w-7 h-7 text-primary" />
          면접
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          일정 전체 보기입니다. 결과 입력은 지원서 상세에서 합니다.
        </p>
      </div>

      {data ? (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <Badge key={s} variant="outline" className={`${STATUS_STYLE[s]}`}>
              {STATUS_LABEL[s]} {data.counts?.[s] ?? 0}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Label className="text-xs">상태</Label>
        <Select
          value={status || "_all"}
          onValueChange={(v) => setStatus(v === "_all" ? "" : v)}
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : !data || data.items.length === 0 ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          면접 기록이 없습니다. 지원서 상세에서 일정을 잡으면 여기에 모입니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">지원자</th>
                <th className="p-3 font-medium">일시</th>
                <th className="p-3 font-medium">장소 / 링크</th>
                <th className="p-3 font-medium">상태</th>
                <th className="p-3 font-medium sr-only">이동</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((iv) => (
                <tr
                  key={iv.id}
                  className="border-t border-border"
                  data-testid={`interview-row-${iv.id}`}
                >
                  <td className="p-3">
                    <div className="font-medium">{iv.applicantName}</div>
                    <div className="text-xs text-muted-foreground">
                      {iv.applicantEmail}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {iv.scheduledAt
                      ? new Date(iv.scheduledAt).toLocaleString("ko-KR")
                      : "미정"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {iv.locationOrLink ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={STATUS_STYLE[iv.status]}>
                      {STATUS_LABEL[iv.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/applications/${iv.applicationId}`}
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      지원서 <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
