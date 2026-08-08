import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  projectsTable,
  projectMembersTable,
  projectMentorsTable,
  projectMilestonesTable,
  projectStatusChecksTable,
  studentsTable,
  cohortsTable,
  mvp4ArtifactsTable,
  feedbackTable,
  usersTable,
  reflectionsTable,
  TEAM_STATUSES,
  FEEDBACK_TYPES,
} from "@workspace/db";
import { requireMentor } from "../lib/auth";
import { getMentorProjectIds, mentorOwnsProject } from "../lib/mentor-scope";
import { notifySafely } from "../lib/notify";

const router: IRouter = Router();

/**
 * Mentor Workspace (docs/design/02-mentor-workspace.md).
 *
 * requireMentor is necessary but NOT sufficient — every route below re-checks
 * an ACTIVE project_mentors assignment, mirroring the evaluation surface's
 * per-application ownership re-check. Holding the mentor role opens nothing.
 *
 * Unowned project ids return 404, not 403, so a mentor cannot probe which
 * projects exist.
 */

const StatusCheckBody = z.object({
  teamStatus: z.enum(TEAM_STATUSES),
  blocker: z.string().max(2000).nullable().optional(),
  nextFocus: z.string().max(2000).nullable().optional(),
  needsOpsSupport: z.boolean().optional(),
  opsSupportNote: z.string().max(2000).nullable().optional(),
  comment: z.string().max(8000).nullable().optional(),
});

const FeedbackBody = z.object({
  content: z.string().trim().min(1).max(8000),
  feedbackType: z.enum(FEEDBACK_TYPES).optional(),
  studentId: z.number().int().positive().nullable().optional(),
  /** Mentors may write student-visible feedback; default keeps it internal. */
  visibility: z.enum(["student_visible", "admin_only"]).optional(),
});

/** Resolve the caller's project ids, or short-circuit an empty workspace. */
async function myProjectIds(userId: number): Promise<number[]> {
  return getMentorProjectIds(userId);
}

// ---- My Teams ------------------------------------------------------------

router.get("/mentor/teams", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const ids = await myProjectIds(me.id);
  if (ids.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const projects = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      status: projectsTable.status,
      cohortId: projectsTable.cohortId,
      cohortName: cohortsTable.name,
      description: projectsTable.description,
    })
    .from(projectsTable)
    .leftJoin(cohortsTable, eq(projectsTable.cohortId, cohortsTable.id))
    .where(inArray(projectsTable.id, ids))
    .orderBy(desc(projectsTable.id));

  // Member counts, latest status check, and last artifact time per project.
  const memberCounts = await db
    .select({
      projectId: projectMembersTable.projectId,
      count: sql<number>`count(*)::int`,
    })
    .from(projectMembersTable)
    .where(inArray(projectMembersTable.projectId, ids))
    .groupBy(projectMembersTable.projectId);

  const latestChecks = await db
    .select({
      projectId: projectStatusChecksTable.projectId,
      teamStatus: projectStatusChecksTable.teamStatus,
      blocker: projectStatusChecksTable.blocker,
      needsOpsSupport: projectStatusChecksTable.needsOpsSupport,
      opsResolvedAt: projectStatusChecksTable.opsResolvedAt,
      checkedAt: projectStatusChecksTable.checkedAt,
    })
    .from(projectStatusChecksTable)
    .where(inArray(projectStatusChecksTable.projectId, ids))
    .orderBy(desc(projectStatusChecksTable.checkedAt));

  const lastArtifacts = await db
    .select({
      projectId: mvp4ArtifactsTable.projectId,
      lastAt: sql<Date>`max(${mvp4ArtifactsTable.createdAt})`,
    })
    .from(mvp4ArtifactsTable)
    .where(inArray(mvp4ArtifactsTable.projectId, ids))
    .groupBy(mvp4ArtifactsTable.projectId);

  const memberMap = new Map(memberCounts.map((m) => [m.projectId, m.count]));
  const artifactMap = new Map(
    lastArtifacts.map((a) => [a.projectId, a.lastAt]),
  );
  // First row per project wins — the query is already sorted newest-first.
  const checkMap = new Map<number, (typeof latestChecks)[number]>();
  for (const c of latestChecks) {
    if (!checkMap.has(c.projectId)) checkMap.set(c.projectId, c);
  }

  const now = Date.now();
  const items = projects.map((p) => {
    const check = checkMap.get(p.id);
    const lastAt = artifactMap.get(p.id) ?? null;
    const daysSinceCheck = check
      ? Math.floor((now - check.checkedAt.getTime()) / 86_400_000)
      : null;
    return {
      ...p,
      memberCount: memberMap.get(p.id) ?? 0,
      lastArtifactAt: lastAt ? new Date(lastAt).toISOString() : null,
      latestCheck: check
        ? {
            teamStatus: check.teamStatus,
            blocker: check.blocker,
            needsOpsSupport: check.needsOpsSupport,
            opsResolved: check.opsResolvedAt !== null,
            checkedAt: check.checkedAt.toISOString(),
          }
        : null,
      daysSinceCheck,
      /** Drives the "check-in overdue" emphasis in the card UI. */
      checkOverdue: daysSinceCheck === null || daysSinceCheck > 14,
    };
  });

  res.json({ items, total: items.length });
});

// ---- Project detail ------------------------------------------------------

router.get("/mentor/projects/:id", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !(await mentorOwnsProject(me.id, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const members = await db
    .select({
      id: projectMembersTable.id,
      studentId: projectMembersTable.studentId,
      studentName: studentsTable.name,
      role: projectMembersTable.role,
      contributionSummary: projectMembersTable.contributionSummary,
    })
    .from(projectMembersTable)
    .innerJoin(
      studentsTable,
      eq(projectMembersTable.studentId, studentsTable.id),
    )
    .where(eq(projectMembersTable.projectId, id));

  const milestones = await db
    .select()
    .from(projectMilestonesTable)
    .where(eq(projectMilestonesTable.projectId, id))
    .orderBy(
      asc(projectMilestonesTable.sortOrder),
      asc(projectMilestonesTable.id),
    );

  // Students' unfinished personal drafts stay private even from their mentor.
  const artifacts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(
      and(
        eq(mvp4ArtifactsTable.projectId, id),
        ne(mvp4ArtifactsTable.visibility, "private"),
      ),
    )
    .orderBy(desc(mvp4ArtifactsTable.createdAt));

  // ADR-004: every feedback item on an owned project, regardless of author,
  // type, or visibility — including admin_note. Continuity of mentoring
  // context is the point; access is gated by ASSIGNMENT, not by visibility.
  const feedback = await db
    .select({
      id: feedbackTable.id,
      feedbackType: feedbackTable.feedbackType,
      content: feedbackTable.content,
      visibility: feedbackTable.visibility,
      studentId: feedbackTable.studentId,
      authorId: feedbackTable.authorId,
      authorName: usersTable.name,
      createdAt: feedbackTable.createdAt,
    })
    .from(feedbackTable)
    .leftJoin(usersTable, eq(feedbackTable.authorId, usersTable.id))
    .where(
      and(
        eq(feedbackTable.targetType, "project"),
        eq(feedbackTable.targetId, id),
      ),
    )
    .orderBy(desc(feedbackTable.createdAt));

  const statusChecks = await db
    .select({
      id: projectStatusChecksTable.id,
      checkedAt: projectStatusChecksTable.checkedAt,
      teamStatus: projectStatusChecksTable.teamStatus,
      blocker: projectStatusChecksTable.blocker,
      nextFocus: projectStatusChecksTable.nextFocus,
      needsOpsSupport: projectStatusChecksTable.needsOpsSupport,
      opsSupportNote: projectStatusChecksTable.opsSupportNote,
      opsResolvedAt: projectStatusChecksTable.opsResolvedAt,
      comment: projectStatusChecksTable.comment,
      authorName: usersTable.name,
    })
    .from(projectStatusChecksTable)
    .leftJoin(usersTable, eq(projectStatusChecksTable.authorId, usersTable.id))
    .where(
      and(
        eq(projectStatusChecksTable.projectId, id),
        // visibility-policy §1 원칙 1: access = scope AND visibility. Owning the
        // project was being checked; the visibility half was not, which made
        // `admin_only` an unenforced label on an ops-internal note.
        eq(projectStatusChecksTable.visibility, "mentor_visible"),
      ),
    )
    .orderBy(desc(projectStatusChecksTable.checkedAt));

  res.json({
    project: {
      ...project,
      startedAt: project.startedAt ? project.startedAt.toISOString() : null,
      endedAt: project.endedAt ? project.endedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    members,
    milestones: milestones.map((m) => ({
      ...m,
      dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    artifacts: artifacts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    feedback: feedback.map((f) => ({
      ...f,
      authorName: f.authorName ?? null,
      createdAt: f.createdAt.toISOString(),
    })),
    statusChecks: statusChecks.map((c) => ({
      ...c,
      checkedAt: c.checkedAt.toISOString(),
      opsResolvedAt: c.opsResolvedAt ? c.opsResolvedAt.toISOString() : null,
      authorName: c.authorName ?? null,
    })),
  });
});

// ---- Status check (the 30-second form) -----------------------------------

router.post(
  "/mentor/projects/:id/status-checks",
  requireMentor,
  async (req, res) => {
    const me = req.sessionUser!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || !(await mentorOwnsProject(me.id, id))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = StatusCheckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [row] = await db
      .insert(projectStatusChecksTable)
      .values({
        projectId: id,
        teamStatus: parsed.data.teamStatus,
        blocker: parsed.data.blocker ?? null,
        nextFocus: parsed.data.nextFocus ?? null,
        needsOpsSupport: parsed.data.needsOpsSupport ?? false,
        opsSupportNote: parsed.data.opsSupportNote ?? null,
        comment: parsed.data.comment ?? null,
        authorId: me.id,
      })
      .returning();

    // N3 — the single most important notification (design/05 §5.1). Without
    // it a mentor learns that asking for help changes nothing.
    // Payload carries the project title and a link ONLY: no student names, no
    // raw blocker text (ADR-007 rule 2).
    if (row.needsOpsSupport) {
      const [project] = await db
        .select({ title: projectsTable.title })
        .from(projectsTable)
        .where(eq(projectsTable.id, id))
        .limit(1);
      notifySafely({
        channel: "ops",
        templateId: "team_support",
        content: `🔴 팀 지원 요청 · ${project?.title ?? `프로젝트 #${id}`}`,
        description: "담당 멘토가 운영진 지원을 요청했습니다.",
        path: `/admin/projects/${id}`,
        relatedObjectType: "project",
        relatedObjectId: id,
      });
    }

    res.status(201).json(row);
  },
);

// ---- Feedback ------------------------------------------------------------

router.post("/mentor/projects/:id/feedback", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !(await mentorOwnsProject(me.id, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  // `student_visible` with no subject reaches nobody. Every student-side read
  // of `feedback` — /student/feedback, /student/projects/:id, the report —
  // filters on `studentId = me`, so a team-wide row marked student_visible is
  // saved, looks published to the mentor, and is seen by zero people. Silently
  // writing into a void is worse than refusing.
  if ((parsed.data.visibility ?? "admin_only") === "student_visible" && !parsed.data.studentId) {
    res.status(422).json({
      error: "학생에게 공개하려면 대상 학생을 골라 주세요. 팀 전체에 보이는 피드백은 아직 없습니다.",
    });
    return;
  }
  // targetType/targetId are forced — a mentor cannot attach feedback to an
  // arbitrary object by crafting the body.
  const [row] = await db
    .insert(feedbackTable)
    .values({
      targetType: "project",
      targetId: id,
      studentId: parsed.data.studentId ?? null,
      authorId: me.id,
      feedbackType: parsed.data.feedbackType ?? "general",
      content: parsed.data.content,
      visibility: parsed.data.visibility ?? "admin_only",
    })
    .returning();
  res.status(201).json(row);
});

/** Everything this mentor has written, across currently-owned projects. */
router.get("/mentor/feedback", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const ids = await myProjectIds(me.id);
  if (ids.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }
  const rows = await db
    .select({
      id: feedbackTable.id,
      targetId: feedbackTable.targetId,
      projectTitle: projectsTable.title,
      feedbackType: feedbackTable.feedbackType,
      content: feedbackTable.content,
      visibility: feedbackTable.visibility,
      createdAt: feedbackTable.createdAt,
    })
    .from(feedbackTable)
    .innerJoin(projectsTable, eq(feedbackTable.targetId, projectsTable.id))
    .where(
      and(
        eq(feedbackTable.targetType, "project"),
        eq(feedbackTable.authorId, me.id),
        inArray(feedbackTable.targetId, ids),
      ),
    )
    .orderBy(desc(feedbackTable.createdAt));
  res.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: rows.length,
  });
});


/**
 * Reflections my assigned students chose to share with their mentor.
 *
 * Scoped twice over: the student must be a member of a project I currently
 * carry, AND they must have set `mentor_visible` or wider. `private` and
 * `team_visible` never appear here — a mentor is not a teammate.
 *
 * This is NOT an ops surface. It exists because ADR-001 lets the student pick
 * an audience, and "담당 멘토" is one of the audiences the picker offers; if the
 * read path did not exist, the picker would be lying.
 */
router.get("/mentor/reflections", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const ids = await myProjectIds(me.id);
  if (ids.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const studentIds = (
    await db
      .select({ id: projectMembersTable.studentId })
      .from(projectMembersTable)
      .where(inArray(projectMembersTable.projectId, ids))
  ).map((r) => r.id);
  if (studentIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const rows = await db
    .select({
      id: reflectionsTable.id,
      studentId: reflectionsTable.studentId,
      studentName: studentsTable.name,
      reflectionType: reflectionsTable.reflectionType,
      title: reflectionsTable.title,
      contentMd: reflectionsTable.contentMd,
      visibility: reflectionsTable.visibility,
      createdAt: reflectionsTable.createdAt,
    })
    .from(reflectionsTable)
    .innerJoin(studentsTable, eq(reflectionsTable.studentId, studentsTable.id))
    .where(
      and(
        inArray(reflectionsTable.studentId, studentIds),
        inArray(reflectionsTable.visibility, ["mentor_visible", "cohort_visible"]),
      ),
    )
    .orderBy(desc(reflectionsTable.createdAt));

  res.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: rows.length,
  });
});

// ---- Dashboard summary ---------------------------------------------------

router.get("/mentor/dashboard", requireMentor, async (req, res) => {
  const me = req.sessionUser!;
  const ids = await myProjectIds(me.id);
  if (ids.length === 0) {
    res.json({
      teamCount: 0,
      needsCheckIn: [],
      openSupportRequests: 0,
      atRisk: [],
    });
    return;
  }

  const latest = await db
    .select({
      projectId: projectStatusChecksTable.projectId,
      projectTitle: projectsTable.title,
      teamStatus: projectStatusChecksTable.teamStatus,
      needsOpsSupport: projectStatusChecksTable.needsOpsSupport,
      opsResolvedAt: projectStatusChecksTable.opsResolvedAt,
      checkedAt: projectStatusChecksTable.checkedAt,
    })
    .from(projectStatusChecksTable)
    .innerJoin(
      projectsTable,
      eq(projectStatusChecksTable.projectId, projectsTable.id),
    )
    .where(inArray(projectStatusChecksTable.projectId, ids))
    .orderBy(desc(projectStatusChecksTable.checkedAt));

  const seen = new Map<number, (typeof latest)[number]>();
  for (const r of latest) if (!seen.has(r.projectId)) seen.set(r.projectId, r);

  const titles = await db
    .select({ id: projectsTable.id, title: projectsTable.title })
    .from(projectsTable)
    .where(inArray(projectsTable.id, ids));

  const now = Date.now();
  const needsCheckIn = titles
    .map((t) => {
      const c = seen.get(t.id);
      const days = c
        ? Math.floor((now - c.checkedAt.getTime()) / 86_400_000)
        : null;
      return { projectId: t.id, projectTitle: t.title, daysSinceCheck: days };
    })
    .filter((x) => x.daysSinceCheck === null || x.daysSinceCheck > 14);

  const openSupportRequests = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectStatusChecksTable)
    .where(
      and(
        inArray(projectStatusChecksTable.projectId, ids),
        eq(projectStatusChecksTable.needsOpsSupport, true),
        isNull(projectStatusChecksTable.opsResolvedAt),
      ),
    );

  res.json({
    teamCount: ids.length,
    needsCheckIn,
    openSupportRequests: openSupportRequests[0]?.count ?? 0,
    atRisk: Array.from(seen.values())
      .filter((c) => c.teamStatus === "risk" || c.teamStatus === "blocked")
      .map((c) => ({
        projectId: c.projectId,
        projectTitle: c.projectTitle,
        teamStatus: c.teamStatus,
        checkedAt: c.checkedAt.toISOString(),
      })),
  });
});

export default router;
