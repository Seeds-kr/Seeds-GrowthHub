import { api } from "@/lib/mvp3-api";

/** docs/design/06-team-meeting-notes.md */

export type TeamOwnerType = "project" | "study";

export type TeamMeeting = {
  id: number;
  ownerType: TeamOwnerType;
  ownerId: number;
  title: string;
  metAt: string;
  contentMd: string;
  authorId: number | null;
  lastEditedBy: number | null;
  authorName: string | null;
  ownerTitle?: string | null;
  createdAt: string;
  updatedAt: string;
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

export function teamMeetingsPath(
  viewer: TeamViewer,
  ownerType: TeamOwnerType,
  ownerId: number,
): string {
  if (viewer === "mentor") return `/mentor/team-meetings?projectId=${ownerId}`;
  const q = `ownerType=${ownerType}&ownerId=${ownerId}`;
  return viewer === "admin"
    ? `/admin/team-meetings?${q}`
    : `/student/team-meetings?${q}`;
}

export async function listTeamMeetings(
  viewer: TeamViewer,
  ownerType: TeamOwnerType,
  ownerId: number,
): Promise<TeamMeeting[]> {
  const r = await api<{ items: TeamMeeting[] }>(
    teamMeetingsPath(viewer, ownerType, ownerId),
  );
  return r.items;
}

export async function createTeamMeeting(input: {
  ownerType: TeamOwnerType;
  ownerId: number;
  title: string;
  metAt?: string;
  contentMd?: string;
}): Promise<TeamMeeting> {
  return api<TeamMeeting>("/student/team-meetings", {
    method: "POST",
    body: input,
  });
}

export async function updateTeamMeeting(
  id: number,
  patch: { title?: string; metAt?: string; contentMd?: string },
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
