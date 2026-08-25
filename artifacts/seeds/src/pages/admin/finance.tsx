import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import {
  type FinanceRecord,
  type FinanceSummary,
  FINANCE_RECORD_TYPES,
  FINANCE_RECORD_TYPE_LABEL,
  FINANCE_RECORD_STATUSES,
  FINANCE_RECORD_STATUS_LABEL,
  FINANCE_LINKED_OBJECT_TYPES,
  FINANCE_LINKED_OBJECT_TYPE_LABEL,
  formatAmount,
} from "@/lib/finance-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Wallet, ExternalLink } from "lucide-react";

const STATUS_BADGE: Record<(typeof FINANCE_RECORD_STATUSES)[number], string> = {
  draft: "bg-muted text-muted-foreground",
  requested: "border-amber-500 text-amber-700 dark:text-amber-400",
  under_review: "border-blue-500 text-blue-700 dark:text-blue-400",
  approved: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  paid: "bg-emerald-600 text-white",
  rejected: "border-red-500 text-red-700 dark:text-red-400",
  canceled: "bg-muted/40 text-muted-foreground line-through",
};

function blankForm() {
  return {
    recordType: "expense" as (typeof FINANCE_RECORD_TYPES)[number],
    title: "",
    description: "",
    category: "",
    amount: "",
    currency: "KRW",
    occurredOn: new Date().toISOString().slice(0, 10),
    status: "draft" as (typeof FINANCE_RECORD_STATUSES)[number],
    requesterId: "",
    receiptUrl: "",
    linkedObjectType: "",
    linkedObjectId: "",
  };
}

type AdminUserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export default function AdminFinancePage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm());

  const queryKey = useMemo(
    () => ["admin-finance-records", filterStatus, filterType] as const,
    [filterStatus, filterType],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterType) qs.set("recordType", filterType);
      const s = qs.toString();
      return api<{ items: FinanceRecord[]; total: number }>(
        `/admin/finance-records${s ? `?${s}` : ""}`,
      );
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["admin-finance-summary"],
    queryFn: () => api<FinanceSummary>("/admin/finance-records/summary"),
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users-all"],
    queryFn: () => api<{ items: AdminUserListItem[] }>("/admin/users"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<FinanceRecord>("/admin/finance-records", {
        method: "POST",
        body: {
          recordType: form.recordType,
          title: form.title,
          description: form.description,
          category: form.category,
          amount: form.amount,
          currency: form.currency,
          occurredOn: form.occurredOn,
          status: form.status,
          requesterId: form.requesterId ? Number(form.requesterId) : null,
          receiptUrl: form.receiptUrl || null,
          linkedObjectType: form.linkedObjectType || null,
          linkedObjectId: form.linkedObjectId
            ? Number(form.linkedObjectId)
            : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-finance-records"] });
      qc.invalidateQueries({ queryKey: ["admin-finance-summary"] });
      toast({ title: "재정 기록이 추가되었습니다." });
      setOpen(false);
      setForm(blankForm());
    },
    onError: (e: any) =>
      toast({
        title: "저장 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const updateStatus = useMutation({
    mutationFn: (vars: {
      id: number;
      status: (typeof FINANCE_RECORD_STATUSES)[number];
    }) =>
      api<FinanceRecord>(`/admin/finance-records/${vars.id}`, {
        method: "PATCH",
        body: { status: vars.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-finance-records"] });
      qc.invalidateQueries({ queryKey: ["admin-finance-summary"] });
    },
    onError: (e: any) =>
      toast({
        title: "상태 변경 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            재정
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            동아리 수입·지출·환급 기록과 승인/지급 흐름을 관리합니다. 운영진(admin) 전용.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          data-testid="btn-new-finance-record"
        >
          <Plus className="w-4 h-4 mr-1" /> 새 기록
        </Button>
      </div>

      {/* Dashboard hooks summary */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-border rounded p-4">
            <div className="text-xs text-muted-foreground">승인 대기</div>
            <div className="text-2xl font-bold mt-1">
              {summary.hooks.awaitingApproval}
            </div>
              {/* 카드 부제는 "이 숫자가 무엇을 세는가" 를 말해야 한다. DB 값을
                  그대로 적으면 그 값을 아는 사람에게만 뜻이 통한다. */}
            <div className="text-[11px] text-muted-foreground mt-1">
              요청됨 · 검토중
            </div>
          </div>
          <div className="border border-border rounded p-4">
            <div className="text-xs text-muted-foreground">미지급 승인</div>
            <div className="text-2xl font-bold mt-1">
              {summary.hooks.approvedUnpaid}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              승인됐지만 아직 지급 전
            </div>
          </div>
          <div className="border border-border rounded p-4">
            <div className="text-xs text-muted-foreground">대기 중 환급</div>
            <div className="text-2xl font-bold mt-1">
              {summary.hooks.pendingReimbursements}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              환급 요청 중 검토 단계
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs">상태</Label>
          <Select
            value={filterStatus || "_all"}
            onValueChange={(v) => setFilterStatus(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">전체</SelectItem>
              {FINANCE_RECORD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {FINANCE_RECORD_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">유형</Label>
          <Select
            value={filterType || "_all"}
            onValueChange={(v) => setFilterType(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">전체</SelectItem>
              {FINANCE_RECORD_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {FINANCE_RECORD_TYPE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : !data || data.items.length === 0 ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          재정 기록이 없습니다. "새 기록" 버튼으로 첫 항목을 추가하세요.
        </div>
      ) : (
        <div className="border border-border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">날짜</th>
                <th className="text-left p-2">유형</th>
                <th className="text-left p-2">제목 / 분류</th>
                <th className="text-right p-2">금액</th>
                <th className="text-left p-2">요청자</th>
                <th className="text-left p-2">연결</th>
                <th className="text-left p-2">영수증</th>
                <th className="text-left p-2">상태</th>
                <th className="text-left p-2">상태 변경</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border"
                  data-testid={`finance-row-${r.id}`}
                >
                  <td className="p-2 whitespace-nowrap">{r.occurredOn}</td>
                  <td className="p-2">
                    <Badge variant="outline">
                      {FINANCE_RECORD_TYPE_LABEL[r.recordType]}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{r.title}</div>
                    {r.category && (
                      <div className="text-xs text-muted-foreground">
                        {r.category}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {formatAmount(r.amount, r.currency)}
                  </td>
                  <td className="p-2 text-xs">
                    {r.requesterName ?? r.requesterEmail ?? "—"}
                  </td>
                  <td className="p-2 text-xs">
                    {r.linkedObjectType
                      ? `${FINANCE_LINKED_OBJECT_TYPE_LABEL[r.linkedObjectType]} #${r.linkedObjectId ?? ""}`
                      : "—"}
                  </td>
                  <td className="p-2">
                    {r.receiptUrl ? (
                      <a
                        href={r.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 rounded px-1 text-xs underline-offset-4 transition-colors hover:bg-muted hover:underline"
                        data-testid={`finance-receipt-${r.id}`}
                      >
                        보기 <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE[r.status]}
                    >
                      {FINANCE_RECORD_STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        updateStatus.mutate({
                          id: r.id,
                          status: v as (typeof FINANCE_RECORD_STATUSES)[number],
                        })
                      }
                    >
                      <SelectTrigger
                        className="w-36 h-8"
                        data-testid={`finance-status-${r.id}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINANCE_RECORD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {FINANCE_RECORD_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 재정 기록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>유형</Label>
                <Select
                  value={form.recordType}
                  onValueChange={(v) =>
                    setForm({ ...form, recordType: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCE_RECORD_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {FINANCE_RECORD_TYPE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>상태</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCE_RECORD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {FINANCE_RECORD_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="input-finance-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>금액 *</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  placeholder="예: 45000"
                  data-testid="input-finance-amount"
                />
              </div>
              <div>
                <Label>통화</Label>
                <Input
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value.toUpperCase() })
                  }
                  maxLength={8}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>발생일 *</Label>
                <Input
                  type="date"
                  value={form.occurredOn}
                  onChange={(e) =>
                    setForm({ ...form, occurredOn: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>분류</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder="예: 다과, 교통비, 후원금"
                />
              </div>
            </div>
            <div>
              <Label>설명</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>요청자</Label>
                <Select
                  value={form.requesterId || "_none"}
                  onValueChange={(v) =>
                    setForm({ ...form, requesterId: v === "_none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">선택 안 함</SelectItem>
                    {users?.items
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>영수증 URL</Label>
                <Input
                  type="url"
                  value={form.receiptUrl}
                  onChange={(e) =>
                    setForm({ ...form, receiptUrl: e.target.value })
                  }
                  placeholder="https://..."
                  data-testid="input-finance-receipt-url"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>연결 대상</Label>
                <Select
                  value={form.linkedObjectType || "_none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      linkedObjectType: v === "_none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">없음</SelectItem>
                    {FINANCE_LINKED_OBJECT_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {FINANCE_LINKED_OBJECT_TYPE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>연결 ID</Label>
                <Input
                  inputMode="numeric"
                  value={form.linkedObjectId}
                  onChange={(e) =>
                    setForm({ ...form, linkedObjectId: e.target.value })
                  }
                  disabled={!form.linkedObjectType}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !form.title.trim() ||
                !form.amount.trim() ||
                !form.occurredOn
              }
              data-testid="btn-save-finance-record"
            >
              {create.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
