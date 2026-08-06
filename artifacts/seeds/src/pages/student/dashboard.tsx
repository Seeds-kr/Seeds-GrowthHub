import { useQuery } from "@tanstack/react-query";
import { api, type SessionItem, type AssignmentItem, type Announcement } from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

/**
 * 학생 홈.
 *
 * 원래는 같은 무게의 상자 네 개에 원자료를 늘어놓았다. 기수 배지, 공지 제목,
 * 모임 목록, 과제 목록. 전부 사실이지만 학생이 이 화면에서 실제로 묻는 것은
 * 하나다 — **지금 내가 뭘 해야 하나.** 그 질문에 답하지 않았다.
 *
 * 특히 과제 줄에 **제출 여부가 없었다.** 학생에게 가장 중요한 정보인데,
 * 서버는 이미 `mySubmission` 을 붙여 내려주고 있었고 화면만 안 쓰고 있었다.
 * 그래서 "냈나 안 냈나"를 확인하려면 과제를 하나씩 열어봐야 했다.
 *
 * 지금은 맨 위가 할 일이다. 마감이 가깝고 아직 안 낸 것부터.
 */

type Me = {
  student: { id: number; name: string; email: string };
  cohorts: { id: number; name: string; status: string }[];
  programs: { id: number; name: string; cohortId: number }[];
};

const DAY = 24 * 60 * 60 * 1000;

/** 마감까지 남은 시간을 사람 말로. 지난 것은 음수가 아니라 "지남"으로 말한다. */
function dueLabel(dueAt: string | null): { text: string; urgent: boolean } {
  if (!dueAt) return { text: "마감 없음", urgent: false };
  const diff = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(diff / DAY);
  if (diff < 0) return { text: `마감 ${Math.abs(days)}일 지남`, urgent: true };
  if (days <= 1) return { text: "오늘 마감", urgent: true };
  if (days <= 3) return { text: `${days}일 남음`, urgent: true };
  return { text: format(new Date(dueAt), "M월 d일 마감"), urgent: false };
}

export default function StudentDashboard() {
  const me = useQuery({ queryKey: ["student-me"], queryFn: () => api<Me>("/student/me") });
  const sessions = useQuery({ queryKey: ["student-sessions"], queryFn: () => api<{ items: SessionItem[] }>("/student/sessions") });
  const assignments = useQuery({ queryKey: ["student-assignments"], queryFn: () => api<{ items: AssignmentItem[] }>("/student/assignments") });
  const announcements = useQuery({ queryKey: ["student-announcements"], queryFn: () => api<{ items: Announcement[] }>("/student/announcements") });

  if (me.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const upcoming = (sessions.data?.items ?? [])
    .filter((s) => new Date(s.scheduledAt).getTime() > Date.now() && s.status === "scheduled")
    .slice(0, 4);

  const live = (assignments.data?.items ?? []).filter((a) => a.status === "published");
  // 아직 안 낸 것이 할 일이다. 마감이 가까운 순으로 세운다 —
  // 마감 없는 과제는 급하지 않으므로 뒤로 보낸다.
  const todo = live
    .filter((a) => !a.mySubmission)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  const done = live.filter((a) => a.mySubmission);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-serif text-3xl font-bold">
          안녕하세요, {me.data?.student.name}님
        </h1>
        {/* 기수는 정체성이지 할 일이 아니다. 큰 상자를 주지 않고 제목 옆에 붙인다.
            (전에는 카드 하나를 통째로 차지하고 대부분이 빈 공간이었다.) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {me.data?.cohorts.map((c) => <Badge key={c.id}>{c.name}</Badge>)}
          {me.data?.programs.map((p) => (
            <Badge key={p.id} variant="outline">{p.name}</Badge>
          ))}
          {me.data?.cohorts.length === 0 ? (
            <span className="text-sm text-muted-foreground">아직 배정된 기수가 없습니다.</span>
          ) : null}
        </div>
      </div>

      {/* ── 할 일 ─────────────────────────────────────────────────────────
          맨 위에 온다. 여기가 이 화면의 존재 이유다. */}
      <Card className="mb-6 elev-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>내가 할 일</span>
            {todo.length > 0 ? (
              <span className="text-sm font-normal text-muted-foreground">
                아직 안 낸 과제 <strong className="text-foreground">{todo.length}</strong>개
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {todo.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={live.length === 0 ? "진행 중인 과제가 없습니다." : "낼 과제를 다 냈습니다."}
              hint={live.length === 0 ? "과제가 나오면 여기에 뜹니다." : undefined}
            />
          ) : (
            <ul className="divide-y divide-border">
              {todo.map((a) => {
                const d = dueLabel(a.dueAt);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="group flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:text-primary">
                          {a.title}
                        </span>
                        {/* 마감을 제목 바로 아래 둔다. 전에는 행 오른쪽 끝에
                            떨어져 있어 어느 과제 것인지 눈으로 이어붙여야 했다. */}
                        <span
                          className={`mt-0.5 inline-flex items-center gap-1 text-xs ${
                            d.urgent ? "font-semibold text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {d.urgent ? <AlertTriangle className="h-3 w-3 shrink-0" /> : null}
                          {d.text}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 이미 낸 것은 접어 둔다. 확인은 되어야 하지만 할 일은 아니다. */}
          {done.length > 0 ? (
            <details className="mt-3 border-t pt-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                제출 완료 {done.length}개
              </summary>
              <ul className="mt-2 space-y-1.5">
                {done.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="truncate text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="elev-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">다가오는 모임</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="예정된 모임이 없습니다." />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">{s.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {format(new Date(s.scheduledAt), "M월 d일 HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="elev-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>최근 공지</span>
              <Link
                href="/student/announcements"
                className="text-xs font-normal text-muted-foreground hover:text-primary"
              >
                전체 보기
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(announcements.data?.items ?? []).length === 0 ? (
              <EmptyState title="공지가 없습니다." />
            ) : (
              <ul className="divide-y divide-border">
                {(announcements.data?.items ?? []).slice(0, 3).map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="font-medium">{a.title}</div>
                    {/* 제목만으로는 무슨 내용인지 알 수 없어 결국 눌러봐야 했다.
                        첫 줄을 같이 보여준다. */}
                    {a.content ? (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {a.content}
                      </p>
                    ) : null}
                    <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      {a.publishedAt ? format(new Date(a.publishedAt), "yyyy-MM-dd") : ""}
                    </div>
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
