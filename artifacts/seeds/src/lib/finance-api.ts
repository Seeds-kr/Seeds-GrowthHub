export const FINANCE_RECORD_TYPES = [
  "income",
  "expense",
  "reimbursement",
] as const;
export type FinanceRecordType = (typeof FINANCE_RECORD_TYPES)[number];

export const FINANCE_RECORD_TYPE_LABEL: Record<FinanceRecordType, string> = {
  income: "수입",
  expense: "지출",
  reimbursement: "환급",
};

export const FINANCE_RECORD_STATUSES = [
  "draft",
  "requested",
  "under_review",
  "approved",
  "paid",
  "rejected",
  "canceled",
] as const;
export type FinanceRecordStatus = (typeof FINANCE_RECORD_STATUSES)[number];

export const FINANCE_RECORD_STATUS_LABEL: Record<FinanceRecordStatus, string> =
  {
    draft: "임시저장",
    requested: "요청됨",
    under_review: "검토 중",
    approved: "승인됨",
    paid: "지급 완료",
    rejected: "반려됨",
    canceled: "취소됨",
  };

export const FINANCE_LINKED_OBJECT_TYPES = [
  "session",
  "cohort",
  "project",
  "document",
] as const;
export type FinanceLinkedObjectType =
  (typeof FINANCE_LINKED_OBJECT_TYPES)[number];

export const FINANCE_LINKED_OBJECT_TYPE_LABEL: Record<
  FinanceLinkedObjectType,
  string
> = {
  session: "행사/모임",
  cohort: "기수",
  project: "프로젝트",
  document: "문서",
};

export type FinanceRecord = {
  id: number;
  recordType: FinanceRecordType;
  title: string;
  description: string;
  category: string;
  amount: string; // numeric string for precision
  currency: string;
  occurredOn: string; // YYYY-MM-DD
  status: FinanceRecordStatus;
  requesterId: number | null;
  approverId: number | null;
  approvedAt: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  linkedObjectType: FinanceLinkedObjectType | null;
  linkedObjectId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  approverName?: string | null;
  approverEmail?: string | null;
};

export type FinanceSummary = {
  breakdown: Array<{
    status: FinanceRecordStatus;
    recordType: FinanceRecordType;
    count: number;
    total: string;
  }>;
  hooks: {
    pendingReimbursements: number;
    awaitingApproval: number;
    approvedUnpaid: number;
  };
};

export function formatAmount(amount: string, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  // KRW: no decimals, comma-grouped.
  if (currency === "KRW") {
    return `₩${Math.round(n).toLocaleString("ko-KR")}`;
  }
  return `${n.toLocaleString("ko-KR", { minimumFractionDigits: 2 })} ${currency}`;
}
