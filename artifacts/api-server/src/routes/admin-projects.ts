import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  projectsTable,
  projectMembersTable,
  projectMentorsTable,
  projectMilestonesTable,
  projectStatusChecksTable,
  MILESTONE_STATUSES,
  TEAM_STATUSES,
  STATUS_CHECK_VISIBILITIES,
  usersTable,
  getEffectiveRoles,
  PROJECT_STATUSES,
  studentsTable,
  cohortsTable,
  programsTable,
  mvp4ArtifactsTable,
  feedbackTable,
  tagMappingsTable,
  skillTagsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const Body = z.object({
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(8000).nullable().optional(),
  problemStatement: z.string().max(8000).nullable().optional(),
  solutionSummary: z.string().max(8000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  githubUrl: z.string().url().max(2000).nullable().optional(),
  demoUrl: z.string().url().max(2000).nullable().optional(),
  deckUrl: z.string().url().max(2000).nullable().optional(),
  targetUsers: z.string().max(2000).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

const MilestoneBody = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const StatusCheckBody = z.object({
  teamStatus: z.enum(TEAM_STATUSES),
  /** Ops-only: hide this check from the assigned mentor. Default is shared. */
  visibility: z.enum(STATUS_CHECK_VISIBILITIES).optional(),
  blocker: z.string().max(2000).nullable().optional(),
  nextFocus: z.string().max(2000).nullable().optional(),
  needsOpsSupport: z.boolean().optional(),
  opsSupportNote: z.string().max(2000).nullable().optional(),
  comment: z.string().max(8000).nullable().optional(),
});

const MentorBody = z.object({
  mentorUserId: z.number().int().positive(),
  roleLabel: z.string().max(100).nullable().optional(),
});

const MemberBody = z.object({
  studentId: z.number().int().positive(),
  role: z.string().max(100).nullable().optional(),
  contributionSummary: z.string().max(8000).nullable().optional(),
});

function toIso(p: typeof projectsTable.$inferSelect) {
  return {
    ...p,
    startedAt: p.startedAt ? p.startedAt.toISOString() : null,
    endedAt: p.endedAt ? p.endedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/admin/projects", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;
  const programId = req.query.programId
    ? Number(req.query.programId)
    : undefined;
  const status = req.query.status as string | undefined;
  const filters = [];
  if (cohortId) filters.push(eq(projectsTable.cohortId, cohortId));
  if (programId) filters.push(eq(projectsTable.programId, programId));
  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) {
    filters.push(
      eq(projectsTable.status, status as (typeof PROJECT_STATUSES)[number]),
    );
  }
  const rows = await db
    .select({
      p: projectsTable,
      cohortName: cohortsTable.name,
      programName: programsTable.name,
    })
    .from(projectsTable)
    .leftJoin(cohortsTable, eq(projectsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(projectsTable.programId, programsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(projectsTable.createdAt));
  res.json({
    items: rows.map((row) => ({
      ...toIso(row.p),
      cohortName: row.cohortName,
      programName: row.programName,
    })),
    total: rows.length,
  });
});

router.post("/admin/projects", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(projectsTable)
    .values({
      cohortId: parsed.data.cohortId,
      programId: parsed.data.programId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      problemStatement: parsed.data.problemStatement ?? null,
      solutionSummary: parsed.data.solutionSummary ?? null,
      status: parsed.data.status ?? "ideation",
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.get("/admin/projects/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [p] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (!p) {
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
    .innerJoin(studentsTable, eq(projectMembersTable.studentId, studentsTable.id))
    .where(eq(projectMembersTable.projectId, id));
  // Active first, then ended (handover history stays visible to admins).
  const mentors = await db
    .select({
      id: projectMentorsTable.id,
      mentorUserId: projectMentorsTable.mentorUserId,
      mentorName: usersTable.name,
      mentorEmail: usersTable.email,
      roleLabel: projectMentorsTable.roleLabel,
      status: projectMentorsTable.status,
      assignedAt: projectMentorsTable.assignedAt,
      endedAt: projectMentorsTable.endedAt,
    })
    .from(projectMentorsTable)
    .innerJoin(usersTable, eq(projectMentorsTable.mentorUserId, usersTable.id))
    .where(eq(projectMentorsTable.projectId, id))
    .orderBy(asc(projectMentorsTable.status), desc(projectMentorsTable.assignedAt));
  const milestones = await db
    .select()
    .from(projectMilestonesTable)
    .where(eq(projectMilestonesTable.projectId, id))
    .orderBy(asc(projectMilestonesTable.sortOrder), asc(projectMilestonesTable.id));
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
      authorId: projectStatusChecksTable.authorId,
      authorName: usersTable.name,
    })
    .from(projectStatusChecksTable)
    .leftJoin(usersTable, eq(projectStatusChecksTable.authorId, usersTable.id))
    .where(eq(projectStatusChecksTable.projectId, id))
    .orderBy(desc(projectStatusChecksTable.checkedAt));
  const arts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(eq(mvp4ArtifactsTable.projectId, id))
    .orderBy(desc(mvp4ArtifactsTable.createdAt));
  const fbs = await db
    .select()
    .from(feedbackTable)
    .where(
      and(
        eq(feedbackTable.targetType, "project"),
        eq(feedbackTable.targetId, id),
      ),
    )
    .orderBy(desc(feedbackTable.createdAt));
  const tags = await db
    .select({ id: skillTagsTable.id, name: skillTagsTable.name })
    .from(tagMappingsTable)
    .innerJoin(skillTagsTable, eq(skillTagsTable.id, tagMappingsTable.tagId))
    .where(
      and(
        eq(tagMappingsTable.targetType, "project"),
        eq(tagMappingsTable.targetId, id),
      ),
    );
  res.json({
    project: toIso(p),
    members,
    mentors: mentors.map((m) => ({
      ...m,
      assignedAt: m.assignedAt.toISOString(),
      endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    })),
    artifacts: arts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    feedback: fbs.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    tags,
    milestones: milestones.map((m) => ({
      ...m,
      dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    statusChecks: statusChecks.map((c) => ({
      ...c,
      checkedAt: c.checkedAt.toISOString(),
      opsResolvedAt: c.opsResolvedAt ? c.opsResolvedAt.toISOString() : null,
    })),
  });
});

router.patch("/admin/projects/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = Body.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if ((k === "startedAt" || k === "endedAt") && typeof v === "string")
      updates[k] = new Date(v);
    else updates[k] = v;
  }
  const [row] = await db
    .update(projectsTable)
    .set(updates)
    .where(eq(projectsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete("/admin/projects/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id))
    .returning({ id: projectsTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/admin/projects/:id/members", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = MemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db
      .insert(projectMembersTable)
      .values({
        projectId: id,
        studentId: parsed.data.studentId,
        role: parsed.data.role ?? null,
        contributionSummary: parsed.data.contributionSummary ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    if ((e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")))
      res.status(409).json({ error: "Already a member" });
    else throw e;
  }
});

router.patch(
  "/admin/projects/:id/members/:memberId",
  requireAdmin,
  async (req, res) => {
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = MemberBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [row] = await db
      .update(projectMembersTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(projectMembersTable.id, memberId))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/admin/projects/:id/members/:memberId",
  requireAdmin,
  async (req, res) => {
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [removed] = await db
      .delete(projectMembersTable)
      .where(eq(projectMembersTable.id, memberId))
      .returning({ id: projectMembersTable.id });
    if (!removed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

/**
 * Assign a mentor (ADR-003). Idempotent-ish: re-assigning a previously ended
 * mentor REACTIVATES the existing row rather than failing on the unique index,
 * so a handover back to a former mentor keeps one continuous record.
 */
router.post("/admin/projects/:id/mentors", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = MentorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Only accounts that can actually enter /mentor may be assigned.
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.mentorUserId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Mentor not found" });
    return;
  }
  if (!getEffectiveRoles(user).includes("mentor")) {
    res.status(422).json({ error: "해당 계정은 멘토 역할이 없습니다." });
    return;
  }

  const [existing] = await db
    .select()
    .from(projectMentorsTable)
    .where(
      and(
        eq(projectMentorsTable.projectId, id),
        eq(projectMentorsTable.mentorUserId, parsed.data.mentorUserId),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      res.status(409).json({ error: "이미 배정된 멘토입니다." });
      return;
    }
    const [row] = await db
      .update(projectMentorsTable)
      .set({
        status: "active",
        endedAt: null,
        roleLabel: parsed.data.roleLabel ?? existing.roleLabel,
        assignedAt: new Date(),
        assignedBy: req.sessionUser?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projectMentorsTable.id, existing.id))
      .returning();
    res.status(200).json(row);
    return;
  }

  const [row] = await db
    .insert(projectMentorsTable)
    .values({
      projectId: id,
      mentorUserId: parsed.data.mentorUserId,
      roleLabel: parsed.data.roleLabel ?? null,
      assignedBy: req.sessionUser?.id ?? null,
    })
    .returning();
  res.status(201).json(row);
});

/**
 * End an assignment. NOT a delete — the row survives so that feedback written
 * during the assignment keeps its context (ADR-003). Access is cut immediately.
 */
router.delete(
  "/admin/projects/:id/mentors/:assignmentId",
  requireAdmin,
  async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .update(projectMentorsTable)
      .set({ status: "ended", endedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(projectMentorsTable.id, assignmentId),
          eq(projectMentorsTable.status, "active"),
        ),
      )
      .returning({ id: projectMentorsTable.id });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---- Milestones ----------------------------------------------------------

router.post("/admin/projects/:id/milestones", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = MilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(projectMilestonesTable)
    .values({
      projectId: id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      status: parsed.data.status ?? "planned",
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(row);
});

router.patch(
  "/admin/projects/:id/milestones/:milestoneId",
  requireAdmin,
  async (req, res) => {
    const milestoneId = Number(req.params.milestoneId);
    if (!Number.isFinite(milestoneId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = MilestoneBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      update.description = parsed.data.description;
    if (parsed.data.dueAt !== undefined)
      update.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    if (parsed.data.sortOrder !== undefined)
      update.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) {
      update.status = parsed.data.status;
      // Stamp/clear completion so "done" always carries a date.
      update.completedAt = parsed.data.status === "done" ? new Date() : null;
    }
    const [row] = await db
      .update(projectMilestonesTable)
      .set(update)
      .where(eq(projectMilestonesTable.id, milestoneId))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/admin/projects/:id/milestones/:milestoneId",
  requireAdmin,
  async (req, res) => {
    const milestoneId = Number(req.params.milestoneId);
    if (!Number.isFinite(milestoneId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .delete(projectMilestonesTable)
      .where(eq(projectMilestonesTable.id, milestoneId))
      .returning({ id: projectMilestonesTable.id });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---- Status checks -------------------------------------------------------
// APPEND-ONLY by design: there is intentionally no PATCH or DELETE here. The
// sequence of checks over time is the signal. The one mutation allowed is
// resolving an open ops-support request.

router.post(
  "/admin/projects/:id/status-checks",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = StatusCheckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Not found" });
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
        visibility: parsed.data.visibility ?? "mentor_visible",
        authorId: req.sessionUser?.id ?? null,
      })
      .returning();
    res.status(201).json(row);
  },
);

/** Mark an open ops-support request as picked up. */
router.post(
  "/admin/status-checks/:checkId/resolve",
  requireAdmin,
  async (req, res) => {
    const checkId = Number(req.params.checkId);
    if (!Number.isFinite(checkId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .update(projectStatusChecksTable)
      .set({
        opsResolvedAt: new Date(),
        opsResolvedBy: req.sessionUser?.id ?? null,
      })
      .where(
        and(
          eq(projectStatusChecksTable.id, checkId),
          eq(projectStatusChecksTable.needsOpsSupport, true),
          isNull(projectStatusChecksTable.opsResolvedAt),
        ),
      )
      .returning({ id: projectStatusChecksTable.id });
    if (!row) {
      res.status(404).json({ error: "Not found or already resolved" });
      return;
    }
    res.json({ ok: true });
  },
);

/**
 * Cohort-wide team status board (design/03 §7). The ops dashboard only surfaces
 * "지원 필요" and "체크 필요"; this is the good/watch/risk/blocked view.
 *
 * Ops see every check regardless of visibility — `admin_only` exists to hide a
 * check from the MENTOR, not from ops.
 */
router.get("/admin/team-status", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;

  const projects = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      status: projectsTable.status,
      cohortId: projectsTable.cohortId,
      cohortName: cohortsTable.name,
    })
    .from(projectsTable)
    .leftJoin(cohortsTable, eq(projectsTable.cohortId, cohortsTable.id))
    .where(
      cohortId && Number.isFinite(cohortId)
        ? eq(projectsTable.cohortId, cohortId)
        : undefined,
    )
    .orderBy(desc(projectsTable.id));

  if (projects.length === 0) {
    res.json({ items: [], byStatus: {} });
    return;
  }

  const checks = await db
    .select({
      projectId: projectStatusChecksTable.projectId,
      teamStatus: projectStatusChecksTable.teamStatus,
      blocker: projectStatusChecksTable.blocker,
      needsOpsSupport: projectStatusChecksTable.needsOpsSupport,
      opsResolvedAt: projectStatusChecksTable.opsResolvedAt,
      checkedAt: projectStatusChecksTable.checkedAt,
    })
    .from(projectStatusChecksTable)
    .where(inArray(projectStatusChecksTable.projectId, projects.map((p) => p.id)))
    .orderBy(desc(projectStatusChecksTable.checkedAt));

  // Newest check per project — the query is already sorted.
  const latest = new Map<number, (typeof checks)[number]>();
  for (const c of checks) if (!latest.has(c.projectId)) latest.set(c.projectId, c);

  const now = Date.now();
  const items = projects.map((p) => {
    const c = latest.get(p.id);
    return {
      ...p,
      teamStatus: c?.teamStatus ?? null,
      blocker: c?.blocker ?? null,
      openSupport: Boolean(c?.needsOpsSupport && !c.opsResolvedAt),
      checkedAt: c ? c.checkedAt.toISOString() : null,
      daysSinceCheck: c
        ? Math.floor((now - c.checkedAt.getTime()) / 86_400_000)
        : null,
    };
  });

  const byStatus: Record<string, number> = { good: 0, watch: 0, risk: 0, blocked: 0, none: 0 };
  for (const i of items) byStatus[i.teamStatus ?? "none"]++;

  res.json({ items, byStatus });
});

export default router;
