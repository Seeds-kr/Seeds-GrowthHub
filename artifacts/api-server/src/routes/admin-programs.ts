import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  programsTable,
  PROGRAM_STATUSES,
  cohortsTable,
  studentProgramsTable,
  studentsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateProgram = z.object({
  cohortId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(PROGRAM_STATUSES).optional(),
});

router.get("/admin/programs", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId
    ? Number(req.query.cohortId)
    : undefined;
  let q = db
    .select({
      id: programsTable.id,
      cohortId: programsTable.cohortId,
      cohortName: cohortsTable.name,
      name: programsTable.name,
      description: programsTable.description,
      status: programsTable.status,
      createdAt: programsTable.createdAt,
      updatedAt: programsTable.updatedAt,
    })
    .from(programsTable)
    .innerJoin(cohortsTable, eq(programsTable.cohortId, cohortsTable.id))
    .$dynamic();
  if (cohortId && Number.isFinite(cohortId)) {
    q = q.where(eq(programsTable.cohortId, cohortId));
  }
  const rows = await q.orderBy(asc(programsTable.id));
  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/admin/programs", requireAdmin, async (req, res) => {
  const parsed = CreateProgram.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [c] = await db
    .select({ id: cohortsTable.id })
    .from(cohortsTable)
    .where(eq(cohortsTable.id, parsed.data.cohortId))
    .limit(1);
  if (!c) {
    res.status(400).json({ error: "Cohort does not exist" });
    return;
  }
  const [row] = await db
    .insert(programsTable)
    .values({
      cohortId: parsed.data.cohortId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "draft",
    })
    .returning();
  res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.get("/admin/programs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [program] = await db
    .select()
    .from(programsTable)
    .where(eq(programsTable.id, id))
    .limit(1);
  if (!program) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const students = await db
    .select({
      id: studentsTable.id,
      name: studentsTable.name,
      email: studentsTable.email,
      joinedAt: studentProgramsTable.joinedAt,
    })
    .from(studentProgramsTable)
    .innerJoin(studentsTable, eq(studentProgramsTable.studentId, studentsTable.id))
    .where(eq(studentProgramsTable.programId, id));
  res.json({
    program: {
      ...program,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
    },
    students: students.map((s) => ({
      ...s,
      joinedAt: s.joinedAt.toISOString(),
    })),
  });
});

router.patch("/admin/programs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateProgram.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .update(programsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(programsTable.id, id))
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

export default router;
