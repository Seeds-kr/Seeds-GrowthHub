import { api } from "@/lib/mvp3-api";

/** docs/design/06-team-meeting-notes.md */

export type TeamOwnerType = "project" | "study";

export type TeamPerson = { id: number; name: string };
export type RosterEntry = TeamPerson & { kind: "student" | "mentor" };

/**
 * List rows carry NO `contentMd` — the server does not send it (design 06 §6).
 * Bodies arrive from `getTeamMeeting` when a row is expanded, which is why
 * `contentMd` is optional on this type rather than a separate one: the list row
 * and the detail are the same meeting, just fetched at different depths.
 */
export type TeamMeeting = {
  id: number;
  ownerType: TeamOwnerType;
  ownerId: number;
  title: string;
  metAt: string;
  contentMd?: string;
  tags: string[];
  participants: TeamPerson[];
  authorId: number | null;
  lastEditedBy: number | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMeetingPage = {
  items: TeamMeeting[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type TeamMeetingFilters = {
  page?: number;
  pageSize?: number;
  tag?: string;
  participantId?: number;
};

export type TeamLink = {
  id: number;
  url: string;
  title: string;
  linkType: string;
  description: string | null;
  linkedObjectType: string;
  linkedObjectId: number;
  visibility: string;
  createdAt: string;
};

/**
 * Which surface asks for the data. The three roles hit different paths and get
 * different rights (design 06 §4–5) — students write, everyone else reads — so
 * the caller declares who it is instead of every screen re-deriving it.
 */
export type TeamViewer = "student" | "mentor" | "admin";

/** The base path for `viewer`. Mentors have their own route; ops another. */
function base(viewer: TeamViewer): string {
  return viewer === "mentor"
    ? "/mentor/team-meetings"
    : viewer === "admin"
      ? "/admin/team-meetings"
      : "/student/team-meetings";
}

export async function listTeamMeetings(
  viewer: TeamViewer,
  ownerType: TeamOwnerType,
  ownerId: number,
  filters: TeamMeetingFilters = {},
): Promise<TeamMeetingPage> {
  // URLSearchParams, not string concatenation — a tag like "기획/설계" or one
  // with a space breaks a hand-built query string, and tags are user-invented.
  const qs = new URLSearchParams();
  if (viewer === "mentor") qs.set("projectId", String(ownerId));
  else {
    qs.set("ownerType", ownerType);
    qs.set("ownerId", String(ownerId));
  }
  if (filters.page) qs.set("page", String(filters.page));
  if (filters.pageSize) qs.set("pageSize", String(filters.pageSize));
  if (filters.tag) qs.set("tag", filters.tag);
  if (filters.participantId) qs.set("participantId", String(filters.participantId));
  return api<TeamMeetingPage>(`${base(viewer)}?${qs.toString()}`);
}

/** One meeting WITH its body. Called when a row is expanded. */
export async function getTeamMeeting(
  viewer: TeamViewer,
  id: number,
): Promise<TeamMeeting> {
  return api<TeamMeeting>(`${base(viewer)}/${id}`);
}

/** Tags already used by this team + who may be named as a participant. */
export async function getTeamMeetingMeta(
  ownerType: TeamOwnerType,
  ownerId: number,
): Promise<{ tags: string[]; roster: RosterEntry[] }> {
  const qs = new URLSearchParams({ ownerType, ownerId: String(ownerId) });
  return api(`/student/team-meetings/meta?${qs.toString()}`);
}

export async function createTeamMeeting(input: {
  ownerType: TeamOwnerType;
  ownerId: number;
  title: string;
  metAt?: string;
  contentMd?: string;
  tags?: string[];
  participantUserIds?: number[];
}): Promise<TeamMeeting> {
  return api<TeamMeeting>("/student/team-meetings", {
    method: "POST",
    body: input,
  });
}

export async function updateTeamMeeting(
  id: number,
  patch: {
    title?: string;
    metAt?: string;
    contentMd?: string;
    tags?: string[];
    participantUserIds?: number[];
  },
): Promise<TeamMeeting> {
  return api<TeamMeeting>(`/student/team-meetings/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteTeamMeeting(id: number): Promise<void> {
  await api(`/student/team-meetings/${id}`, { method: "DELETE" });
}

// ── 참고링크 ────────────────────────────────────────────────────────────────

/** The server's `LINK_TYPES`, with the labels the UI shows. */
export const LINK_TYPE_LABEL: Record<string, string> = {
  github_repo: "GitHub 저장소",
  github_pr: "GitHub PR",
  github_issue: "GitHub 이슈",
  readme: "README",
  release: "릴리스",
  demo: "데모",
  deck: "발표자료",
  drive: "드라이브",
  notion: "노션",
  discord: "디스코드",
  figma: "피그마",
  issue_board: "이슈 보드",
  blog: "블로그",
  other: "기타",
};

export const LINK_TYPES = Object.keys(LINK_TYPE_LABEL);

/** Students may only pick an audience they can see themselves (design 06 §7). */
export const STUDENT_LINK_VISIBILITY_LABEL: Record<string, string> = {
  team_visible: "팀 안에서만",
  cohort_visible: "같은 기수 전체",
};

export async function listTeamLinks(
  viewer: TeamViewer,
  ownerType: TeamOwnerType,
  ownerId: number,
): Promise<TeamLink[]> {
  const q = `linkedObjectType=${ownerType}&linkedObjectId=${ownerId}`;
  const path =
    viewer === "student"
      ? `/student/external-links?${q}`
      : viewer === "mentor"
        ? `/mentor/external-links?${q}`
        : `/admin/external-links?${q}`;
  const r = await api<{ items: TeamLink[] }>(path);
  // The student and mentor endpoints scope by membership but IGNORE the
  // linkedObject query above — they return every link that viewer may see.
  // Verified against the running server. Without this filter a student on two
  // teams would see the other team's links under this team's card, which reads
  // as a leak even though the data was already theirs to see.
  return r.items.filter(
    (l) => l.linkedObjectType === ownerType && l.linkedObjectId === ownerId,
  );
}

export async function createTeamLink(input: {
  ownerType: TeamOwnerType;
  ownerId: number;
  title: string;
  url: string;
  linkType?: string;
  description?: string | null;
  visibility?: string;
}): Promise<TeamLink> {
  return api<TeamLink>("/student/external-links", {
    method: "POST",
    body: input,
  });
}

export async function deleteTeamLink(id: number): Promise<void> {
  await api(`/student/external-links/${id}`, { method: "DELETE" });
}
