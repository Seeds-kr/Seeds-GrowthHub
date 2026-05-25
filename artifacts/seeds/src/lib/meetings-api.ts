export const MEETING_TYPES = [
  "general",
  "ops",
  "planning",
  "retro",
  "mentor",
  "external",
  "other",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  general: "일반",
  ops: "운영",
  planning: "기획",
  retro: "회고",
  mentor: "멘토",
  external: "외부",
  other: "기타",
};

export const MEETING_VISIBILITIES = ["admin_only", "mentor_visible"] as const;
export type MeetingVisibility = (typeof MEETING_VISIBILITIES)[number];

export const MEETING_VISIBILITY_LABEL: Record<MeetingVisibility, string> = {
  admin_only: "운영진만",
  mentor_visible: "운영진+멘토",
};

export type Meeting = {
  id: number;
  title: string;
  meetingType: MeetingType;
  meetingDate: string;
  participants: string[];
  agendaMd: string;
  decisionsMd: string;
  notesMd: string;
  pendingMd: string;
  visibility: MeetingVisibility;
  linkedObjectType: string | null;
  linkedObjectId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export const OPS_TASK_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
  "canceled",
] as const;
export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];

export const OPS_TASK_STATUS_LABEL: Record<OpsTaskStatus, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  review: "검토",
  blocked: "막힘",
  done: "완료",
  canceled: "취소",
};

export const OPS_TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type OpsTaskPriority = (typeof OPS_TASK_PRIORITIES)[number];

export const OPS_TASK_PRIORITY_LABEL: Record<OpsTaskPriority, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  urgent: "긴급",
};

export type OpsTask = {
  id: number;
  title: string;
  description: string;
  status: OpsTaskStatus;
  priority: OpsTaskPriority;
  assigneeId: number | null;
  dueDate: string | null;
  sourceMeetingId: number | null;
  linkedObjectType: string | null;
  linkedObjectId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields from list endpoint
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  assigneeActive?: boolean | null;
  sourceMeetingTitle?: string | null;
};

export type MeetingDetail = Meeting & { actionItems: OpsTask[] };

export function isOverdue(t: OpsTask): boolean {
  if (!t.dueDate) return false;
  if (t.status === "done" || t.status === "canceled") return false;
  const due = new Date(t.dueDate + "T23:59:59");
  return due.getTime() < Date.now();
}
