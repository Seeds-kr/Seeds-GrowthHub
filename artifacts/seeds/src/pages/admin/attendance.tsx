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
import { Loader2, ClipboardList } from "lucide-react";
import { api, type Cohort } from "@/lib/mvp3-api";

/**
 * W8 — `/admin/attendance`. Cohort rollup over per-session records.
 *
 * Read-only: marking stays at `/admin/sessions/:id/attendance`, which is C tier
 * (design/05 §6.2). This one is B tier — it is a read.
 */

const STATUSES = ["present", "late", "absent", "excused"] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
  excused: "인정",
};

type Row = {
  studentId: number;
  studentName: string;
  counts: Record<string, number>;
  marked: number;
  unmarked: number;
  attendanceRate: number | null;
};

type Resp = {
  sessionCount: number;
  students: Row[];
  totals: Record<string, number>;
};

function rateStyle(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate < 60) return "border-red-500 text-red-700 dark:text-red-400";
  if (rate < 80) return "border-amber-500 text-amber-700 dark:text-amber-400";
  return "border-emerald-500 text-emerald-700 dark:text-emerald-400";
}

export default function AdminAttendancePage() {
  const [cohortId, setCohortId] = useState<string>("");

  const { data: cohorts } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: () => api<{ items: Cohort[]; total: number }>("/admin/cohorts"),
  });
  const cohortList = cohorts?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["admin-attendance", cohortId],
    queryFn: () => api<Resp>(`/admin/attendance?cohortId=${cohortId}`),
    enabled: cohortId !== "",
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          출석 집계
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          기수 단위 집계입니다. 출석 입력은 모임 상세 화면에서 합니다.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Label className="text-xs">기수</Label>
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="기수를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {cohortList.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cohortId === "" ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          기수를 선택하면 학생별 출석률이 표시됩니다.
        </div>
      ) : isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : !data || data.sessionCount === 0 ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          이 기수에 모임이 없습니다.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="outline">모임 {data.sessionCount}회</Badge>
            {STATUSES.map((s) => (
              <Badge key={s} variant="outline" className="text-muted-foreground">
                {STATUS_LABEL[s]} {data.totals?.[s] ?? 0}
              </Badge>
            ))}
          </div>

          {data.students.length === 0 ? (
            <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
              아직 출석 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3 font-medium">학생</th>
                    <th className="p-3 font-medium">출석률</th>
                    {STATUSES.map((s) => (
                      <th key={s} className="p-3 font-medium">
                        {STATUS_LABEL[s]}
                      </th>
                    ))}
                    <th className="p-3 font-medium">미기록</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((r) => (
                    <tr
                      key={r.studentId}
                      className="border-t border-border"
                      data-testid={`attendance-row-${r.studentId}`}
                    >
                      <td className="p-3">
                        <Link
                          href={`/admin/students/${r.studentId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.studentName}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={rateStyle(r.attendanceRate)}>
                          {r.attendanceRate === null
                            ? "—"
                            : `${r.attendanceRate}%`}
                        </Badge>
                      </td>
                      {STATUSES.map((s) => (
                        <td key={s} className="p-3 text-muted-foreground">
                          {r.counts?.[s] ?? 0}
                        </td>
                      ))}
                      <td className="p-3 text-muted-foreground">{r.unmarked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            출석률 = (출석 + 지각) ÷ (전체 모임 − 인정결석). 인정결석은 분모에서
            빼므로 불이익으로 계산되지 않습니다. 낮은 순으로 정렬됩니다.
          </p>
        </>
      )}
    </>
  );
}
