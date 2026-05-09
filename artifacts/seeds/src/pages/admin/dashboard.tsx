import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Loader2,
  Users,
  GraduationCap,
  CalendarClock,
  ClipboardList,
  FileText,
  TrendingUp,
  Megaphone,
  ArrowRight,
  KeyRound,
  FolderKanban,
  Activity,
  MessageSquare,
  Package,
} from "lucide-react";

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  submitted: "제출 완료",
  reviewing: "검토 중",
  interview: "면접 대상",
  accepted: "최종 합격",
  rejected: "불합격",
  waitlisted: "예비 후보",
  withdrawn: "지원 취소",
};

const APPLICATION_STATUS_TONE: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  interview: "bg-purple-50 text-purple-700",
  accepted: "bg-primary/10 text-primary",
  rejected: "bg-rose-50 text-rose-700",
  waitlisted: "bg-slate-100 text-slate-700",
  withdrawn: "bg-muted text-muted-foreground",
};

const SESSION_TYPE_LABEL: Record<string, string> = {
  orientation: "오리엔테이션",
  workshop: "워크샵",
  mentoring: "멘토링",
  project_work: "프로젝트",
  presentation: "발표",
  review: "리뷰",
  other: "기타",
};

const ANNOUNCEMENT_TARGET_LABEL: Record<string, string> = {
  all: "전체",
  cohort: "기수",
  program: "프로그램",
};

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDays(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days > 0) return `${days}일 뒤`;
  return `${Math.abs(days)}일 전`;
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <Card className="border-border shadow-none transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        {hint ? (
          <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-muted/40">
      <div className="w-8 h-8 rounded-md bg-card text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-base font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
        >
          {hrefLabel ?? "전체 보기"} <ArrowRight className="w-3 h-3" />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="text-sm text-muted-foreground py-6 text-center">{message}</div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard();

  return (
    <AdminLayout>
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] mb-1">대시보드</h1>
          <p className="text-sm text-muted-foreground">
            동아리 운영 현황을 한눈에 살펴보세요.
            {data?.generatedAt ? (
              <span className="ml-2 text-xs">
                · {new Date(data.generatedAt).toLocaleString("ko-KR")} 기준
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/applications">
            <Button variant="outline" size="sm">
              지원서 검토 <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
          <Link href="/admin/sessions">
            <Button size="sm">
              세션 관리 <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="활성 학생"
              value={`${data.members.activeStudents}명`}
              hint={`평가위원 ${data.members.evaluators}명`}
              icon={GraduationCap}
              href="/admin/students"
            />
            <KpiCard
              label="진행 중 기수"
              value={`${data.cohorts.activeCount}개`}
              hint={`총 학생 ${data.cohorts.active.reduce(
                (s, c) => s + c.studentCount,
                0,
              )}명 참여`}
              icon={Users}
              href="/admin/cohorts"
            />
            <KpiCard
              label="다가오는 세션"
              value={`${data.sessions.upcoming.length}건`}
              hint={`최근 30일 ${data.sessions.last30dCount}건 진행`}
              icon={CalendarClock}
              href="/admin/sessions"
            />
            <KpiCard
              label="공개 중 과제"
              value={`${data.assignments.activeCount}개`}
              hint={`검토 대기 제출물 ${data.assignments.pendingReview}건`}
              icon={ClipboardList}
              href="/admin/assignments"
            />
          </div>

          {/* Activation alert */}
          {data.members.pendingActivation > 0 ? (
            <Card className="border-primary/30 bg-primary/[0.04] shadow-none mb-6">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{data.members.pendingActivation}명</span>
                  의 사용자가 아직 계정 활성화 링크를 사용하지 않았습니다.
                </div>
                <Link href="/admin/students">
                  <Button size="sm" variant="outline">
                    학생 보기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recruiting funnel — full width on mobile, 2-col on desktop */}
            <div className="lg:col-span-2">
              <SectionHeader
                title="모집 현황"
                href="/admin/applications"
                hrefLabel="지원서로"
              />
              <Card className="border-border shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-baseline justify-between mb-5">
                    <div>
                      <div className="text-3xl font-bold tabular-nums">
                        {data.applications.total}
                        <span className="text-base font-normal text-muted-foreground ml-1">
                          명 지원
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        최근 7일 신규 지원 {data.applications.last7d}건
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {data.applications.byStatus.map((s) => (
                      <div
                        key={s.status}
                        className={`rounded-md px-3 py-2.5 ${
                          APPLICATION_STATUS_TONE[s.status] ?? "bg-muted"
                        }`}
                      >
                        <div className="text-[11px] opacity-80">
                          {APPLICATION_STATUS_LABEL[s.status] ?? s.status}
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                          {s.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity summary */}
            <div>
              <SectionHeader title={`최근 ${data.windowDays.recent}일 활동`} />
              <Card className="border-border shadow-none">
                <CardContent className="p-4 space-y-2">
                  <MiniStat
                    label="진행 중인 프로젝트"
                    value={`${data.activity.activeProjects}개`}
                    icon={FolderKanban}
                  />
                  <MiniStat
                    label="새 활동 기록"
                    value={`${data.activity.activityRecordsLast30d}건`}
                    icon={Activity}
                  />
                  <MiniStat
                    label="새 피드백"
                    value={`${data.activity.feedbackLast30d}건`}
                    icon={MessageSquare}
                  />
                  <MiniStat
                    label="새 아티팩트"
                    value={`${data.activity.artifactsLast30d}건`}
                    icon={Package}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Upcoming sessions */}
            <div className="lg:col-span-2">
              <SectionHeader title="다가오는 세션" href="/admin/sessions" />
              <Card className="border-border shadow-none">
                <CardContent className="p-0">
                  {data.sessions.upcoming.length === 0 ? (
                    <EmptyRow message="예정된 세션이 없습니다." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.sessions.upcoming.map((s) => (
                        <li key={s.id} className="px-5 py-3.5 flex items-center gap-4">
                          <div className="w-14 text-center shrink-0">
                            <div className="text-[11px] text-muted-foreground uppercase">
                              {relativeDays(s.scheduledAt)}
                            </div>
                            <div className="text-sm font-semibold tabular-nums">
                              {formatDate(s.scheduledAt).slice(3)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{s.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {s.cohortName ?? "—"}
                              {s.programName ? ` · ${s.programName}` : ""} ·{" "}
                              {SESSION_TYPE_LABEL[s.sessionType] ?? s.sessionType}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {formatDateTime(s.scheduledAt).split(" ").slice(-1)[0]}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active cohorts */}
            <div>
              <SectionHeader title="진행 중인 기수" href="/admin/cohorts" />
              <Card className="border-border shadow-none">
                <CardContent className="p-0">
                  {data.cohorts.active.length === 0 ? (
                    <EmptyRow message="진행 중인 기수가 없습니다." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.cohorts.active.map((c) => (
                        <li key={c.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate">{c.name}</div>
                            <Badge
                              variant="secondary"
                              className="text-[11px] tabular-nums"
                            >
                              {c.studentCount}명
                            </Badge>
                          </div>
                          {c.startDate || c.endDate ? (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {c.startDate ?? "?"} ~ {c.endDate ?? "?"}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Due soon assignments */}
            <div className="lg:col-span-2">
              <SectionHeader title="마감 임박 과제" href="/admin/assignments" />
              <Card className="border-border shadow-none">
                <CardContent className="p-0">
                  {data.assignments.dueSoon.length === 0 ? (
                    <EmptyRow message="마감 임박 과제가 없습니다." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.assignments.dueSoon.map((a) => {
                        const rate =
                          a.totalStudents > 0
                            ? Math.round((a.submissions / a.totalStudents) * 100)
                            : 0;
                        return (
                          <li
                            key={a.id}
                            className="px-5 py-3.5 flex items-center gap-4"
                          >
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/admin/assignments/${a.id}`}
                                className="font-medium hover:text-primary truncate block"
                              >
                                {a.title}
                              </Link>
                              <div className="text-xs text-muted-foreground truncate">
                                {a.cohortName ?? "—"} · 마감 {formatDateTime(a.dueAt)}{" "}
                                ({relativeDays(a.dueAt)})
                              </div>
                            </div>
                            <div className="shrink-0 w-28">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground tabular-nums">
                                  {a.submissions}/{a.totalStudents}
                                </span>
                                <span className="font-medium tabular-nums">{rate}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${Math.min(100, rate)}%` }}
                                />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent announcements */}
            <div>
              <SectionHeader title="최근 공지" href="/admin/announcements" />
              <Card className="border-border shadow-none">
                <CardContent className="p-0">
                  {data.announcements.recent.length === 0 ? (
                    <EmptyRow message="최근 공지가 없습니다." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.announcements.recent.map((a) => (
                        <li key={a.id} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Megaphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {ANNOUNCEMENT_TARGET_LABEL[a.targetType] ?? a.targetType}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground ml-auto">
                              {formatDate(a.publishedAt)}
                            </span>
                          </div>
                          <div className="text-sm font-medium truncate">{a.title}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    발행된 공지 총 {data.announcements.publishedCount}건
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
