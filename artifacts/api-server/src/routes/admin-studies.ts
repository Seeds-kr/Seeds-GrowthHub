import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  studiesTable,
  studyMembersTable,
  studentsTable,
  cohortsTable,
  programsTable,
  mvp4ArtifactsTable,
  STUDY_STATUSES,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

/**
 * Study administration (docs/design/03 §4). Mirrors admin-projects.ts.
 *
 * NOTE: there is intentionally no reflections counterpart to this file —
 * see ADR-001 and the comment at the top of routes/student-growth.ts.
 */

const Body = z.object({
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  topic: z.string().max(300).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  leaderStudentId: z.number().int().positive().nullable().optional(),
  weeklyPlanMd: z.string().max(40000).optional(),
  status: z.enum(STUDY_STATUSES).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

const MemberBody = z.object({
  studentId: z.number().int().positive(),
  role: z.string().max(100).nullable().optional(),
  participationNote: z.string().max(8000).nullable().optional(),
});

function toIso(s: typeof studiesTable.$inferSelect) {
  return {
    ...s,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/admin/studies", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;
  const rows = await db
    .select({
      study: studiesTable,
      cohortName: cohortsTable.name,
      programName: programsTable.name,
      leaderName: studentsTable.name,
    })
    .from(studiesTable)
    .leftJoin(cohortsTable, eq(studiesTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(studiesTable.programId, programsTable.id))
    .leftJoin(studentsTable, eq(studiesTable.leaderStudentId, studentsTable.id))
    .where(
      cohortId && Number.isFinite(cohortId)
        ? eq(studiesTable.cohortId, cohortId)
        : undefined,
    )
    .orderBy(desc(studiesTable.id));

  res.json({
    items: rows.map((r) => ({
      ...toIso(r.study),
      cohortName: r.cohortName ?? null,
      programName: r.programName ?? null,
      leaderName: r.leaderName ?? null,
    })),
    total: rows.length,
  });
});

router.post("/admin/studies", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(studiesTable)
    .values({
      cohortId: d.cohortId,
      programId: d.programId ?? null,
      title: d.title,
      topic: d.topic ?? null,
      description: d.description ?? null,
      leaderStudentId: d.leaderStudentId ?? null,
      weeklyPlanMd: d.weeklyPlanMd ?? "",
      status: d.status ?? "planned",
      startedAt: d.startedAt ? new Date(d.startedAt) : null,
      endedAt: d.endedAt ? new Date(d.endedAt) : null,
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.get("/admin/studies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [study] = await db
    .select()
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const members = await db
    .select({
      id: studyMembersTable.id,
      studentId: studyMembersTable.studentId,
      studentName: studentsTable.name,
      role: studyMembersTable.role,
      participationNote: studyMembersTable.participationNote,
    })
    .from(studyMembersTable)
    .innerJoin(studentsTable, eq(studyMembersTable.studentId, studentsTable.id))
    .where(eq(studyMembersTable.studyId, id));
  const artifacts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(eq(mvp4ArtifactsTable.studyId, id))
    .orderBy(desc(mvp4ArtifactsTable.createdAt));

  res.json({
    study: toIso(study),
    members,
    artifacts: artifacts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
});

router.patch("/admin/studies/:id", requireAdmin, async (req, res) => {
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
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(d)) {
    if (k === "startedAt" || k === "endedAt") {
      update[k] = v ? new Date(v as string) : null;
    } else {
      update[k] = v;
    }
  }
  const [row] = await db
    .update(studiesTable)
    .set(update)
    .where(eq(studiesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

/** Archive rather than delete, per ERD v3 §13. */
router.post("/admin/studies/:id/archive", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .update(studiesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(studiesTable.id, id))
    .returning({ id: studiesTable.id });
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/admin/studies/:id/members", requireAdmin, async (req, res) => {
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
      .insert(studyMembersTable)
      .values({
        studyId: id,
        studentId: parsed.data.studentId,
        role: parsed.data.role ?? null,
        participationNote: parsed.data.participationNote ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")) {
      res.status(409).json({ error: "Already a member" });
    } else throw e;
  }
});

router.delete(
  "/admin/studies/:id/members/:memberId",
  requireAdmin,
  async (req, res) => {
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .delete(studyMembersTable)
      .where(eq(studyMembersTable.id, memberId))
      .returning({ id: studyMembersTable.id });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
