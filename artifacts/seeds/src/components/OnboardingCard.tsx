import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, FileText, X, ArrowRight } from "lucide-react";
import { api } from "@/lib/mvp3-api";

/**
 * First-run guidance for a new ops member (design/05 §7).
 *
 * §7 chose a card on `/admin` over a separate onboarding screen, pointing at the
 * `documents` onboarding entries "담당 기능 역할에 맞춰". So this reads the real
 * documents table rather than hardcoding a tour — ops edit the content at
 * `/admin/documents` and it shows up here with no deploy.
 *
 * Dismissal lives in localStorage. Per-user dismissal would need a column, and
 * schema work is deliberately deferred right now; a welcome card is also the
 * kind of thing where per-browser is acceptable. The tradeoff is that dismissing
 * on a laptop does not dismiss on a phone.
 */

const STORAGE_KEY = "seeds.onboarding.dismissed.v1";

type OpsRole =
  | "program_lead"
  | "ops"
  | "recruiting"
  | "finance"
  | "growth"
  | "community"
  | "system";

/**
 * Where each function role actually starts working. Keyed to the same OPS_ROLES
 * the server gates on, so a member only ever sees links they can open — a
 * "first step" that 403s is worse than no guidance.
 */
const ROLE_NEXT_STEPS: Record<OpsRole, { href: string; label: string }[]> = {
  program_lead: [
    { href: "/admin/ops-dashboard", label: "운영 대시보드에서 전체 상황 보기" },
    { href: "/admin/users", label: "운영진 기능 역할 배정하기" },
  ],
  ops: [
    { href: "/admin/tasks", label: "작업 보드에서 할 일 확인" },
    { href: "/admin/meetings", label: "회의록 작성하기" },
  ],
  recruiting: [
    { href: "/admin/applications", label: "지원서 검토 시작" },
    { href: "/admin/interviews", label: "면접 일정 확인" },
  ],
  finance: [
    { href: "/admin/finance", label: "회계 기록 확인" },
  ],
  growth: [
    { href: "/admin/team-status", label: "팀 상태 보드 확인" },
    { href: "/admin/projects", label: "프로젝트와 멘토 배정 보기" },
  ],
  community: [
    { href: "/admin/announcements", label: "공지 작성하기" },
    { href: "/admin/sessions", label: "모임 일정 관리" },
  ],
  system: [
    { href: "/admin/users", label: "계정 관리" },
    { href: "/admin/audit-logs", label: "감사 로그 확인" },
  ],
};

const ROLE_LABEL: Record<OpsRole, string> = {
  program_lead: "총괄",
  ops: "운영",
  recruiting: "모집",
  finance: "회계",
  growth: "성장",
  community: "커뮤니티",
  system: "시스템",
};

type DocSummary = { id: number; title: string; docType: string };

export function OnboardingCard({ opsRoles }: { opsRoles: readonly string[] }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private mode / storage disabled — show the card rather than crash.
      return false;
    }
  });

  const { data } = useQuery({
    queryKey: ["admin-onboarding-docs"],
    queryFn: () =>
      api<{ items: DocSummary[] }>("/admin/documents?type=onboarding"),
    enabled: !dismissed,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (dismissed) return null;

  const roles = opsRoles.filter(
    (r): r is OpsRole => r in ROLE_NEXT_STEPS,
  );

  // program_lead already implies every function, so listing all seven sets of
  // steps would bury the useful ones. Its own two links are the entry point.
  const steps = roles.includes("program_lead")
    ? ROLE_NEXT_STEPS.program_lead
    : roles.flatMap((r) => ROLE_NEXT_STEPS[r]);

  const docs = data?.items ?? [];

  // Nothing to say — no roles assigned and no onboarding document written yet.
  if (steps.length === 0 && docs.length === 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* not persisting is fine; the card just returns next load */
    }
    setDismissed(true);
  };

  return (
    <Card className="mb-6 border-primary/40 bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            처음이신가요?
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            맡으신 역할에서 바로 할 수 있는 것부터 안내합니다.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          aria-label="온보딩 안내 닫기"
          data-testid="btn-dismiss-onboarding"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">내 기능 역할</span>
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-[11px]">
                {ROLE_LABEL[r]}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            아직 기능 역할이 배정되지 않았습니다. 총괄(program_lead) 운영진에게
            요청하면 담당 화면이 열립니다.
          </p>
        )}

        {steps.length > 0 ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/50 hover:bg-muted"
                  data-testid={`onboarding-step-${s.href.replace(/\//g, "-")}`}
                >
                  <span>{s.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {docs.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">온보딩 문서</p>
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/documents/${d.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            온보딩 문서가 아직 없습니다.{" "}
            <Link href="/admin/documents" className="text-primary hover:underline">
              문서에서 &quot;온보딩&quot; 유형으로 만들면
            </Link>{" "}
            이 자리에 표시됩니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
