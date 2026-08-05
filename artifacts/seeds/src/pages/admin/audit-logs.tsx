import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ScrollText, ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/mvp3-api";

type AuditRow = {
  id: number;
  action: string;
  actorId: number | null;
  actorLabel: string | null;
  targetType: string | null;
  targetId: number | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  role_change: "권한 변경",
  visibility_change: "공개범위 변경",
  finance_status: "회계 상태",
  decision_change: "합격 결정",
  permission_denied: "접근 거부",
  data_export: "데이터 내보내기",
  account_activation: "계정 활성화",
};

const ACTION_STYLE: Record<string, string> = {
  role_change: "border-primary text-primary",
  finance_status: "border-amber-500 text-amber-700 dark:text-amber-400",
  permission_denied: "border-red-500 text-red-700 dark:text-red-400",
  data_export: "border-orange-500 text-orange-700 dark:text-orange-400",
};

/** Compact "key: before → after" line. Values are already changed-fields-only. */
function DiffLine({ row }: { row: AuditRow }) {
  const after = row.afterJson ?? {};
  const before = row.beforeJson ?? {};
  const keys = Object.keys(after);
  if (keys.length === 0) return null;
  const fmt = (v: unknown) =>
    v === null || v === undefined
      ? "—"
      : Array.isArray(v)
        ? v.length
          ? v.join(", ")
          : "없음"
        : String(v);
  return (
    <div className="space-y-0.5 font-mono text-xs">
      {keys.map((k) => (
        <div key={k}>
          <span className="text-muted-foreground">{k}: </span>
          <span className="text-muted-foreground line-through">{fmt(before[k])}</span>
          <span className="mx-1">→</span>
          <span className="font-semibold">{fmt(after[k])}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAuditLogs() {
  const [action, setAction] = useState<string>("");

  const { data, isLoading, error } = useQuery<
    { items: AuditRow[]; total: number },
    ApiError
  >({
    queryKey: ["admin-audit-logs", action],
    queryFn: () =>
      api(`/admin/audit-logs${action ? `?action=${action}` : ""}`),
    retry: false,
  });

  // The route is gated on the `system` ops role; make the reason explicit
  // rather than showing an empty table.
  if (error?.status === 403) {
    return (
      <>
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">감사 로그를 볼 권한이 없습니다.</p>
            <p className="text-xs text-muted-foreground">
              <code>system</code> 기능 역할 또는 총괄(<code>program_lead</code>)이 필요합니다.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScrollText className="h-6 w-6 text-primary" />
            감사 로그
          </h1>
          <p className="text-sm text-muted-foreground">
            권한 변경·회계 상태 전이·데이터 내보내기 등 민감 작업만 기록됩니다.
            추가만 가능하며 수정·삭제할 수 없습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={action === "" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setAction("")}
          >
            전체
          </Button>
          {Object.entries(ACTION_LABEL).map(([code, label]) => (
            <Button
              key={code}
              size="sm"
              variant={action === code ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setAction(code)}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {data && data.items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              기록된 항목이 없습니다.
            </CardContent>
          </Card>
        )}

        {data && data.items.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              {data.total}건 중 {data.items.length}건 표시
            </p>
            <div className="space-y-2">
              {data.items.map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-1.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${ACTION_STYLE[r.action] ?? ""}`}
                      >
                        {ACTION_LABEL[r.action] ?? r.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.createdAt), "yyyy.MM.dd HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.actorLabel ?? "시스템"}
                      </span>
                      {r.targetType && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {r.targetType}
                          {r.targetId ? `#${r.targetId}` : ""}
                        </span>
                      )}
                    </div>
                    <DiffLine row={r} />
                    {r.note && (
                      <p className="text-xs text-muted-foreground">{r.note}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
