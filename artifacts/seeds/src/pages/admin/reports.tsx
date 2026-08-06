import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, BarChart3, ArrowRight } from "lucide-react";
import { api, type Cohort, type Student } from "@/lib/mvp3-api";

/**
 * W8 — `/admin/reports`.
 *
 * Deliberately thin: an index, not a new report. `/admin/students/:id/report`
 * and `/admin/cohorts/:id/summary` already compute everything; the gap was that
 * both were only reachable by first finding the student or cohort. No new
 * endpoint — building one would duplicate two working aggregations.
 */
export default function AdminReportsPage() {
  const [q, setQ] = useState("");

  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: () => api<{ items: Cohort[]; total: number }>("/admin/cohorts"),
  });

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => api<{ items: Student[]; total: number }>("/admin/students"),
  });

  const needle = q.trim().toLowerCase();
  const filteredStudents = (students?.items ?? []).filter(
    (s) =>
      needle === "" ||
      s.name.toLowerCase().includes(needle) ||
      (s.email ?? "").toLowerCase().includes(needle),
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />
          리포트(Reports)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          학생 활동 리포트와 기수 요약으로 가는 입구입니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기수 요약</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCohorts ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (cohorts?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">기수가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {cohorts!.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/cohorts/${c.id}/summary`}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                      data-testid={`report-cohort-${c.id}`}
                    >
                      <span>{c.name}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">학생 리포트</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="mb-3"
            />
            {loadingStudents ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {needle ? "검색 결과가 없습니다." : "학생이 없습니다."}
              </p>
            ) : (
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {filteredStudents.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/admin/students/${s.id}/report`}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                      data-testid={`report-student-${s.id}`}
                    >
                      <span>
                        {s.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.email}
                        </span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
