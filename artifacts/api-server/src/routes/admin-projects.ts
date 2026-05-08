import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  projectsTable,
  projectMembersTable,
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
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
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

export default router;
