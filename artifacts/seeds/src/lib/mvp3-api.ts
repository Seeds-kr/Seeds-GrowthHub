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
