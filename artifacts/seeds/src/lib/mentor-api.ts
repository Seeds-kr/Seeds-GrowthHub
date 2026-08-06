/** Shared types for the Mentor Workspace (docs/design/02-mentor-workspace.md). */

export const TEAM_STATUSES = ["good", "watch", "risk", "blocked"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = {
  good: "양호",
  watch: "관찰 필요",
  risk: "위험",
  blocked: "막힘",
};

/** One-line prompt under each button so the choice is not guesswork. */
export const TEAM_STATUS_HINT: Record<TeamStatus, string> = {
  good: "잘 굴러가고 있음",
  watch: "지켜볼 필요 있음",
  risk: "개입이 필요할 수 있음",
  blocked: "지금 막혀 있음",
};

export const TEAM_STATUS_STYLE: Record<TeamStatus, string> = {
  good: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  watch: "border-amber-500 text-amber-700 dark:text-amber-400",
  risk: "border-orange-500 text-orange-700 dark:text-orange-400",
  blocked: "border-red-500 text-red-700 dark:text-red-400",
};

export const TEAM_STATUS_SELECTED: Record<TeamStatus, string> = {
  good: "bg-emerald-500 text-white border-emerald-500",
  watch: "bg-amber-500 text-white border-amber-500",
  risk: "bg-orange-500 text-white border-orange-500",
  blocked: "bg-red-500 text-white border-red-500",
};

export type MentorTeam = {
  id: number;
  title: string;
  status: string;
  cohortId: number;
  cohortName: string | null;
  description: string | null;
  memberCount: number;
  lastArtifactAt: string | null;
  latestCheck: {
    teamStatus: TeamStatus;
    blocker: string | null;
    needsOpsSupport: boolean;
    opsResolved: boolean;
    checkedAt: string;
  } | null;
  daysSinceCheck: number | null;
  checkOverdue: boolean;
};

export type MentorMilestone = {
  id: number;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: "planned" | "in_progress" | "done" | "dropped";
  completedAt: string | null;
};

export type MentorStatusCheck = {
  id: number;
  checkedAt: string;
  teamStatus: TeamStatus;
  blocker: string | null;
  nextFocus: string | null;
  needsOpsSupport: boolean;
  opsSupportNote: string | null;
  opsResolvedAt: string | null;
  comment: string | null;
  authorName: string | null;
};

export type MentorFeedbackItem = {
  id: number;
  feedbackType: string;
  content: string;
  visibility: string;
  studentId: number | null;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
};

export type MentorProjectDetail = {
  project: {
    id: number;
    title: string;
    description: string | null;
    problemStatement: string | null;
    solutionSummary: string | null;
    status: string;
    githubUrl: string | null;
    demoUrl: string | null;
    deckUrl: string | null;
    targetUsers: string | null;
  };
  members: {
    id: number;
    studentId: number;
    studentName: string;
    role: string | null;
    contributionSummary: string | null;
  }[];
  milestones: MentorMilestone[];
  artifacts: {
    id: number;
    title: string;
    url: string | null;
    artifactType: string;
    visibility: string;
    createdAt: string;
  }[];
  feedback: MentorFeedbackItem[];
  statusChecks: MentorStatusCheck[];
};

export type MentorDashboard = {
  teamCount: number;
  needsCheckIn: {
    projectId: number;
    projectTitle: string;
    daysSinceCheck: number | null;
  }[];
  openSupportRequests: number;
  atRisk: {
    projectId: number;
    projectTitle: string;
    teamStatus: TeamStatus;
    checkedAt: string;
  }[];
};
