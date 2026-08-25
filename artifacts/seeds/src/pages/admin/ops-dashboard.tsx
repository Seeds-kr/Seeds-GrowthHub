import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/mvp3-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOC_TYPE_LABEL } from "@/lib/documents-api";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
  FileText,
  FolderKanban,
  Gauge,
  LifeBuoy,
  Loader2,
  Wallet,
  ExternalLink,
} from "lucide-react";
import {
  FINANCE_RECORD_STATUS_LABEL,
  type FinanceRecordStatus,
} from "@/lib/finance-api";

type OpsTaskItem = {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
};

type BlockedTaskItem = OpsTaskItem & { updatedAt: string };

type SessionItem = {
  id: number;
  title: string;
  scheduledAt: string;
  sessionType: string;
  status: string;
  prepStatus: string;
  checklistDocumentId: number | null;
  cohortName: string | null;
  programName: string | null;
};

/**
 * No `amount`/`currency`: this dashboard is admin-wide, but the figures are
 * behind the `finance` ops role. Counts here, numbers at /admin/finance.
 */
type FinanceItem = {
  id: number;
  title: string;
  recordType: "income" | "expense" | "reimbursement";
  status: FinanceRecordStatus;
  occurredOn: string;
};

type DocItem = {
  id: number;
  title: string;
  docType: string;
  updatedAt: string;
};

type OpsDashboard = {
  generatedAt: string;
  windowDays: { upcoming: number; staleDocsThreshold: number };
  overdueTasks: OpsTaskItem[];
  blockedTasks: BlockedTaskItem[];
  upcomingSessions: SessionItem[];
  checklistBreakdown: { prepStatus: string; count: number }[];
  evaluationProgress: {
    assigned: number;
    in_progress: number;
    completed: number;
    total: number;
    completionPct: number;
  };
  finance: {
    hooks: {
      pendingCount: number;
      awaitingApproval: number;
      approvedUnpaid: number;
      pendingReimbursements: number;
    };
    pendingItems: FinanceItem[];
  };
  recentDocuments: DocItem[];
  staleDocuments: DocItem[];
  teamSupport: {
    openCount: number;
    items: {
      checkId: number;
      projectId: number;
      projectTitle: string;
      teamStatus: string;
      note: string | null;
      blocker: string | null;
      checkedAt: string;
      authorName: string | null;
    }[];
  };
  staleStatusChecks: {
    projectId: number;
    projectTitle: string;
    lastCheckedAt: string | null;
  }[];
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "border-slate-400 text-slate-600 dark:text-slate-300",
  high: "border-amber-500 text-amber-700 dark:text-amber-400",
  urgent: "border-red-500 text-red-700 dark:text-red-400",
};

const PREP_STATUS_LABEL: Record<string, string> = {
  not_started: "준비 전",
  in_prep: "준비 중",
  ready: "준비 완료",
  done: "종료",
};

const SESSION_TYPE_LABEL: Record<string, string> = {
  regular: "정기 모임",
  workshop: "워크숍",
  meetup: "밋업",
  event: "행사",
  other: "기타",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR");
}

function daysSince(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000));
}

function SectionCard({
  icon: Icon,
  title,
  countBadge,
  href,
  children,
  empty,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  countBadge?: number | string;
  href?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{title}</h3>
          {countBadge !== undefined && (
            <Badge variant="secondary" className="ml-1">
              {countBadge}
            </Badge>
          )}
        </div>
        {href && (
          <Link href={href}>
            <Button size="sm" variant="ghost" className="gap-1">
              자세히
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
      <div className={empty ? "px-4 py-6 text-sm text-muted-foreground" : "p-4"}>
        {children}
      </div>
    </div>
  );
}

export default function AdminOpsDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery<OpsDashboard>({
    queryKey: ["admin", "ops-dashboard"],
    queryFn: () => api<OpsDashboard>("/admin/ops-dashboard/summary"),
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Gauge className="h-6 w-6 text-primary" />
              운영 대시보드
            </h1>
            <p className="text-sm text-muted-foreground">
              운영 전체 현황을 한눈에 — 지연·막힌 작업, 임박 행사, 미처리 회계, 문서 상태를 영역별로 묶었습니다.
            </p>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">
              최근 갱신: {formatDate(data.generatedAt)}
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            불러오는 중…
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">
              대시보드를 불러오지 못했습니다.
            </p>
            <p className="mt-1 text-muted-foreground">
              {(error as Error)?.message ?? "알 수 없는 오류"}
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Overdue tasks */}
            <SectionCard
              icon={AlertTriangle}
              title="연체된 운영 작업"
              countBadge={data.overdueTasks.length}
              href="/admin/tasks"
              empty={data.overdueTasks.length === 0}
            >
              {data.overdueTasks.length === 0 ? (
                "연체된 작업이 없습니다. 좋아요 👍"
              ) : (
                <ul className="divide-y">
                  {data.overdueTasks.map((t) => (
                    <li key={t.id} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/tasks`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              마감 {formatDateOnly(t.dueDate)}
                              {t.assigneeName ? ` · 담당 ${t.assigneeName}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={PRIORITY_BADGE[t.priority] ?? ""}
                          >
                            {t.priority}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Blocked tasks */}
            <SectionCard
              icon={Ban}
              title="막힌 운영 작업"
              countBadge={data.blockedTasks.length}
              href="/admin/tasks"
              empty={data.blockedTasks.length === 0}
            >
              {data.blockedTasks.length === 0 ? (
                "막힌 작업이 없습니다."
              ) : (
                <ul className="divide-y">
                  {data.blockedTasks.map((t) => (
                    <li key={t.id} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/tasks`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              최근 변경 {formatDate(t.updatedAt)}
                              {t.assigneeName ? ` · 담당 ${t.assigneeName}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={PRIORITY_BADGE[t.priority] ?? ""}
                          >
                            {t.priority}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Upcoming sessions */}
            <SectionCard
              icon={CalendarClock}
              title={`다가오는 모임/행사 (${data.windowDays.upcoming}일)`}
              countBadge={data.upcomingSessions.length}
              href="/admin/sessions"
              empty={data.upcomingSessions.length === 0}
            >
              {data.upcomingSessions.length === 0 ? (
                "예정된 모임/행사가 없습니다."
              ) : (
                <ul className="divide-y">
                  {data.upcomingSessions.map((s) => (
                    <li key={s.id} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/sessions/${s.id}`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(s.scheduledAt)} ·{" "}
                              {SESSION_TYPE_LABEL[s.sessionType] ?? s.sessionType}
                              {s.cohortName ? ` · ${s.cohortName}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {PREP_STATUS_LABEL[s.prepStatus] ?? s.prepStatus}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Checklist breakdown */}
            <SectionCard
              icon={ClipboardCheck}
              title="행사 준비 체크리스트 현황"
              empty={data.checklistBreakdown.length === 0}
            >
              {data.checklistBreakdown.length === 0 ? (
                "집계할 예정 모임이 없습니다."
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.checklistBreakdown.map((c) => (
                    <Badge key={c.prepStatus} variant="outline" className="gap-1">
                      <span>{PREP_STATUS_LABEL[c.prepStatus] ?? c.prepStatus}</span>
                      <span className="font-bold">{c.count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Evaluation progress */}
            <SectionCard
              icon={ClipboardCheck}
              title="모집 평가 진행률"
              href="/admin/applications"
              empty={data.evaluationProgress.total === 0}
            >
              {data.evaluationProgress.total === 0 ? (
                "현재 진행 중인 평가 배정이 없습니다."
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      완료 {data.evaluationProgress.completed} /{" "}
                      {data.evaluationProgress.total}
                    </span>
                    <span className="font-semibold">
                      {data.evaluationProgress.completionPct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${data.evaluationProgress.completionPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">배정 {data.evaluationProgress.assigned}</Badge>
                    <Badge variant="outline">
                      진행 중 {data.evaluationProgress.in_progress}
                    </Badge>
                    <Badge variant="outline">
                      완료 {data.evaluationProgress.completed}
                    </Badge>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Pending finance */}
            <SectionCard
              icon={Wallet}
              title="미처리 회계"
              countBadge={data.finance.hooks.pendingCount}
              href="/admin/finance"
              empty={data.finance.pendingItems.length === 0}
            >
              {data.finance.pendingItems.length === 0 ? (
                "미처리 회계 건이 없습니다."
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      승인 대기 {data.finance.hooks.awaitingApproval}
                    </Badge>
                    <Badge variant="outline">
                      미지급 승인 {data.finance.hooks.approvedUnpaid}
                    </Badge>
                    <Badge variant="outline">
                      환급 요청 {data.finance.hooks.pendingReimbursements}
                    </Badge>
                  </div>
                  <ul className="divide-y">
                    {data.finance.pendingItems.slice(0, 5).map((f) => (
                      <li key={f.id} className="py-2 first:pt-0 last:pb-0">
                        <Link href="/admin/finance" className="flex items-center justify-between gap-3 hover:underline">
                          <span className="contents">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{f.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateOnly(f.occurredOn)} · {f.recordType}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="whitespace-nowrap text-xs"
                            >
                              {FINANCE_RECORD_STATUS_LABEL[f.status] ?? f.status}
                            </Badge>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>

            {/* Team support requests — the mentor → ops signal */}
            <SectionCard
              icon={LifeBuoy}
              title="팀 지원 필요"
              countBadge={data.teamSupport.openCount}
              href="/admin/projects"
              empty={data.teamSupport.openCount === 0}
            >
              {data.teamSupport.openCount === 0 ? (
                "처리 대기 중인 지원 요청이 없습니다."
              ) : (
                <ul className="divide-y">
                  {data.teamSupport.items.map((t) => (
                    <li key={t.checkId} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/projects/${t.projectId}`} className="block hover:underline">
                        <span className="contents">
                          <p className="truncate font-medium">{t.projectTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.note ?? t.blocker ?? "지원 요청"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.authorName ? `${t.authorName} · ` : ""}
                            {formatDate(t.checkedAt)}
                          </p>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Teams whose last status check is stale */}
            <SectionCard
              icon={FolderKanban}
              title="상태체크 필요 팀"
              countBadge={data.staleStatusChecks.length}
              href="/admin/projects"
              empty={data.staleStatusChecks.length === 0}
            >
              {data.staleStatusChecks.length === 0 ? (
                "모든 진행 중 팀이 최근 상태체크를 받았습니다."
              ) : (
                <ul className="divide-y">
                  {data.staleStatusChecks.map((t) => (
                    <li key={t.projectId} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/projects/${t.projectId}`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {t.projectTitle}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t.lastCheckedAt ? formatDate(t.lastCheckedAt) : "기록 없음"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Recent documents */}
            <SectionCard
              icon={FileText}
              title="최근 수정된 문서"
              countBadge={data.recentDocuments.length}
              href="/admin/documents"
              empty={data.recentDocuments.length === 0}
            >
              {data.recentDocuments.length === 0 ? (
                "등록된 문서가 없습니다."
              ) : (
                <ul className="divide-y">
                  {data.recentDocuments.map((d) => (
                    <li key={d.id} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/documents/${d.id}`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{d.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOC_TYPE_LABEL[d.docType as keyof typeof DOC_TYPE_LABEL] ?? d.docType} · {formatDate(d.updatedAt)}
                            </p>
                          </div>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Stale documents */}
            <SectionCard
              icon={FileWarning}
              title={`오래된 문서 (${data.windowDays.staleDocsThreshold}일+ 미수정)`}
              countBadge={data.staleDocuments.length}
              href="/admin/documents"
              empty={data.staleDocuments.length === 0}
            >
              {data.staleDocuments.length === 0 ? (
                "오래된 문서가 없습니다."
              ) : (
                <ul className="divide-y">
                  {data.staleDocuments.map((d) => (
                    <li key={d.id} className="py-2 first:pt-0 last:pb-0">
                      <Link href={`/admin/documents/${d.id}`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="contents">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{d.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOC_TYPE_LABEL[d.docType as keyof typeof DOC_TYPE_LABEL] ?? d.docType} · {daysSince(d.updatedAt)}일 전 수정
                            </p>
                          </div>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}
