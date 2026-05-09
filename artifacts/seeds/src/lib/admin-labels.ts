export const COHORT_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];
export const COHORT_STATUS_LABEL: Record<CohortStatus, string> = {
  draft: "준비 중",
  active: "진행 중",
  completed: "완료",
  archived: "보관됨",
};
export const COHORT_STATUS_TONE: Record<CohortStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  archived: "bg-muted text-muted-foreground border-border",
};

export const PROGRAM_STATUSES = COHORT_STATUSES;
export type ProgramStatus = CohortStatus;
export const PROGRAM_STATUS_LABEL = COHORT_STATUS_LABEL;
export const PROGRAM_STATUS_TONE = COHORT_STATUS_TONE;

export const TASK_STATUSES = ["draft", "published", "closed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  draft: "초안",
  published: "공개",
  closed: "마감",
};
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  published: "bg-primary/10 text-primary border-primary/20",
  closed: "bg-blue-50 text-blue-700 border-blue-200",
};

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
  excused: "공결",
};

export const ANNOUNCEMENT_TARGET_LABEL: Record<"all" | "cohort" | "program", string> = {
  all: "전체 학생",
  cohort: "특정 기수",
  program: "특정 프로그램",
};

export function formatKoreanDateTime(s: string | Date | null | undefined): string {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatKoreanDate(s: string | Date | null | undefined): string {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
