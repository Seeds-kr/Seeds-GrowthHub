import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  cohortsTable,
  COHORT_STATUSES,
  studentCohortsTable,
  studentsTable,
  programsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateCohort = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(COHORT_STATUSES).optional(),
});

router.get("/admin/cohorts", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(cohortsTable).orderBy(asc(cohortsTable.id));
  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/admin/cohorts", requireAdmin, async (req, res) => {
  const parsed = CreateCohort.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(cohortsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      status: parsed.data.status ?? "draft",
    })
    .returning();
  res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.get("/admin/cohorts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, id))
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const students = await db
    .select({
      id: studentsTable.id,
      name: studentsTable.name,
      email: studentsTable.email,
      isActive: studentsTable.isActive,
      joinedAt: studentCohortsTable.joinedAt,
    })
    .from(studentCohortsTable)
    .innerJoin(studentsTable, eq(studentCohortsTable.studentId, studentsTable.id))
    .where(eq(studentCohortsTable.cohortId, id));
  const programs = await db
    .select()
    .from(programsTable)
    .where(eq(programsTable.cohortId, id));
  res.json({
    cohort: {
      ...cohort,
      createdAt: cohort.createdAt.toISOString(),
      updatedAt: cohort.updatedAt.toISOString(),
    },
    students: students.map((s) => ({
      ...s,
      joinedAt: s.joinedAt.toISOString(),
    })),
    programs: programs.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
});

router.patch("/admin/cohorts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateCohort.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .update(cohortsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(cohortsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete(
  "/admin/cohorts/:id/students/:studentId",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    const sid = Number(req.params.studentId);
    if (!Number.isFinite(id) || !Number.isFinite(sid)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [removed] = await db
      .delete(studentCohortsTable)
      .where(
        and(
          eq(studentCohortsTable.cohortId, id),
          eq(studentCohortsTable.studentId, sid),
        ),
      )
      .returning({ id: studentCohortsTable.id });
    if (!removed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
