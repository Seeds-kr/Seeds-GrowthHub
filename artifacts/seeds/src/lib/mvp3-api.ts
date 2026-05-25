const BASE = `${import.meta.env.BASE_URL}api`;

export type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const opts: RequestInit = { ...rest, credentials: "include", headers };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    opts.headers = {
      "content-type": "application/json",
      ...(headers as Record<string, string> | undefined),
    };
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && data.error) || res.statusText;
    throw new ApiError(res.status, data, `HTTP ${res.status}: ${msg}`);
  }
  return data as T;
}

export type Cohort = {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type Program = {
  id: number;
  cohortId: number;
  cohortName?: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type Student = {
  id: number;
  userId: number;
  applicationId: number | null;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  isActive: boolean;
  createdAt: string;
};

export type SessionPrepStatus = "not_started" | "in_progress" | "ready";
export type SessionMaterial = { label: string; url: string };

export type SessionItem = {
  id: number;
  cohortId: number;
  cohortName?: string;
  programId: number | null;
  programName?: string | null;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  locationOrLink: string | null;
  sessionType: string;
  status: "scheduled" | "completed" | "cancelled";
  ownerId?: number | null;
  ownerName?: string | null;
  prepStatus?: SessionPrepStatus;
  isPublished?: boolean;
  checklistDocumentId?: number | null;
};

export type SessionDetail = SessionItem & {
  description: string | null;
  ownerEmail: string | null;
  materials: SessionMaterial[];
  checklist: {
    id: number;
    title: string;
    docType: string;
    archivedAt: string | null;
  } | null;
  attendanceSummary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  followUps: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    assigneeId: number | null;
    assigneeName: string | null;
    dueDate: string | null;
    createdAt: string;
  }>;
};

export type SessionActionItem = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
};

export type AssignmentItem = {
  id: number;
  cohortId: number;
  cohortName?: string;
  programId: number | null;
  programName?: string | null;
  title: string;
  description?: string | null;
  dueAt: string | null;
  status: "draft" | "published" | "closed";
  createdAt: string;
};

export type Submission = {
  id: number;
  assignmentId: number;
  studentId: number;
  studentName?: string;
  content: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
  status: "not_submitted" | "submitted" | "late" | "reviewed";
  submittedAt: string | null;
  feedback: string | null;
  reviewedBy: number | null;
};

export type Announcement = {
  id: number;
  title: string;
  content: string;
  targetType: "all" | "cohort" | "program";
  targetId: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── MVP 4 ────────────────────────────────────────────────────────────────────

export const ACTIVITY_SOURCES = [
  "session", "assignment", "project", "feedback", "manual",
] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];
export const ACTIVITY_SOURCE_LABEL: Record<ActivitySource, string> = {
  session: "모임", assignment: "과제", project: "프로젝트",
  feedback: "피드백", manual: "수동 기록",
};

export const ACTIVITY_VISIBILITIES = ["private", "student_visible", "admin_only"] as const;
export type ActivityVisibility = (typeof ACTIVITY_VISIBILITIES)[number];
export const ACTIVITY_VISIBILITY_LABEL: Record<ActivityVisibility, string> = {
  private: "비공개", student_visible: "학생 공개", admin_only: "관리자 전용",
};

export type ActivityRecord = {
  id: number;
  studentId: number;
  cohortId: number;
  programId: number | null;
  sourceType: ActivitySource;
  sourceId: number | null;
  title: string;
  description: string | null;
  activityDate: string;
  visibility: ActivityVisibility;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  studentName?: string | null;
  cohortName?: string | null;
  programName?: string | null;
  tags?: { id: number; name: string }[];
};

export const PROJECT_STATUSES = [
  "ideation", "in_progress", "submitted", "presented", "completed", "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ideation: "기획", in_progress: "진행 중", submitted: "제출",
  presented: "발표", completed: "완료", archived: "보관",
};

export type Project = {
  id: number;
  cohortId: number;
  programId: number | null;
  title: string;
  description: string | null;
  problemStatement: string | null;
  solutionSummary: string | null;
  status: ProjectStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cohortName?: string | null;
  programName?: string | null;
};

export type ProjectMember = {
  id: number;
  studentId: number;
  studentName?: string;
  role: string | null;
  contributionSummary?: string | null;
};

export const ARTIFACT_TYPES = [
  "link", "document", "presentation", "video", "code", "image", "report", "other",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export const ARTIFACT_TYPE_LABEL: Record<ArtifactType, string> = {
  link: "링크", document: "문서", presentation: "발표자료", video: "영상",
  code: "코드", image: "이미지", report: "보고서", other: "기타",
};

export const ARTIFACT_VISIBILITIES = [
  "private", "student_visible", "cohort_visible", "admin_only",
] as const;
export type ArtifactVisibility = (typeof ARTIFACT_VISIBILITIES)[number];
export const ARTIFACT_VISIBILITY_LABEL: Record<ArtifactVisibility, string> = {
  private: "비공개", student_visible: "학생 공개",
  cohort_visible: "기수 공개", admin_only: "관리자 전용",
};

export type Mvp4Artifact = {
  id: number;
  studentId: number | null;
  studentName?: string | null;
  projectId: number | null;
  projectTitle?: string | null;
  assignmentSubmissionId: number | null;
  title: string;
  description: string | null;
  artifactType: ArtifactType;
  url: string;
  visibility: ArtifactVisibility;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export const FEEDBACK_TARGETS = [
  "student", "project", "assignment_submission", "activity_record", "session",
] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];
export const FEEDBACK_TARGET_LABEL: Record<FeedbackTarget, string> = {
  student: "학생", project: "프로젝트", assignment_submission: "과제 제출",
  activity_record: "활동 기록", session: "모임",
};

export const FEEDBACK_TYPES = [
  "general", "strength", "improvement", "review", "mentor_note", "admin_note",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  general: "일반", strength: "강점", improvement: "개선점",
  review: "리뷰", mentor_note: "멘토 메모", admin_note: "관리자 메모",
};

export const FEEDBACK_VISIBILITIES = ["student_visible", "admin_only"] as const;
export type FeedbackVisibility = (typeof FEEDBACK_VISIBILITIES)[number];
export const FEEDBACK_VISIBILITY_LABEL: Record<FeedbackVisibility, string> = {
  student_visible: "학생 공개", admin_only: "관리자 전용",
};

export type FeedbackItem = {
  id: number;
  targetType: FeedbackTarget;
  targetId: number;
  studentId: number | null;
  studentName?: string | null;
  authorId: number | null;
  authorName?: string | null;
  feedbackType: FeedbackType;
  content: string;
  visibility: FeedbackVisibility;
  createdAt: string;
  updatedAt: string;
};

export const TAG_TARGETS = [
  "activity_record", "project", "artifact", "feedback", "student",
] as const;
export type TagTarget = (typeof TAG_TARGETS)[number];

export type SkillTag = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TagMapping = { mappingId: number; tagId: number; name: string };

export type StudentReport = {
  student: { id: number; name: string; email: string; school: string | null; isActive?: boolean };
  cohorts: { id: number; name: string }[];
  programs: { id: number; name: string }[];
  attendanceSummary: { present: number; late: number; absent: number; excused: number; total: number };
  submissions: { id: number; assignmentId: number; title: string; status: string; submittedAt: string | null; feedback: string | null }[];
  projects: { id: number; title: string; status: ProjectStatus; role: string | null; contributionSummary?: string | null }[];
  artifacts: { id: number; title: string; url: string; artifactType: ArtifactType; visibility: ArtifactVisibility; createdAt: string }[];
  feedbackHighlights: { id: number; feedbackType: FeedbackType; content: string; createdAt: string }[];
  timeline: { id: number; sourceType: ActivitySource; title: string; description: string | null; activityDate: string }[];
  skillTags: { tagId: number; name: string; count: number }[];
};

export const PEOPLE_KINDS = ["mentor", "staff", "member"] as const;
export type PeopleKind = (typeof PEOPLE_KINDS)[number];
export const PEOPLE_KIND_LABEL: Record<PeopleKind, string> = {
  mentor: "멘토",
  staff: "운영진",
  member: "학생",
};
export const PEOPLE_KIND_PATH: Record<PeopleKind, string> = {
  mentor: "/mentors",
  staff: "/staff",
  member: "/members",
};

export type PeopleProfile = {
  id: number;
  kind: PeopleKind;
  userId: number | null;
  studentId: number | null;
  name: string;
  roleTitle: string | null;
  affiliation: string | null;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
  tags: string[];
  displayOrder: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicPeopleProfile = {
  id: number;
  kind: PeopleKind;
  name: string;
  roleTitle: string | null;
  affiliation: string | null;
  bio: string | null;
  photoUrl: string | null;
  // phone is only present when the request was authenticated as a member.
  // Unauthenticated viewers see null.
  phone: string | null;
  tags: string[];
  displayOrder: number;
};

export type CohortSummary = {
  cohort: { id: number; name: string; status: string };
  studentCount: number;
  attendanceOverview: { present: number; late: number; absent: number; excused: number; total: number };
  submissionOverview: { status: string; count: number }[];
  projectCount: number;
  artifactCount: number;
  skillTagDistribution: { tagId: number; name: string; count: number }[];
  studentsMissingActivity: { id: number; name: string }[];
};
