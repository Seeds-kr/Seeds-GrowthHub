import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  assignmentsTable,
  TASK_STATUSES,
  SUBMISSION_STATUSES,
  assignmentSubmissionsTable,
  cohortsTable,
  programsTable,
  studentsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateAssignment = z.object({
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

router.get("/admin/assignments", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId
    ? Number(req.query.cohortId)
    : undefined;
  const status = req.query.status as string | undefined;
  const conds = [];
  if (cohortId && Number.isFinite(cohortId))
    conds.push(eq(assignmentsTable.cohortId, cohortId));
  if (status && (TASK_STATUSES as readonly string[]).includes(status))
    conds.push(
      eq(assignmentsTable.status, status as (typeof TASK_STATUSES)[number]),
    );
  let q = db
    .select({
      id: assignmentsTable.id,
      cohortId: assignmentsTable.cohortId,
      cohortName: cohortsTable.name,
      programId: assignmentsTable.programId,
      programName: programsTable.name,
      title: assignmentsTable.title,
      dueAt: assignmentsTable.dueAt,
      status: assignmentsTable.status,
      createdAt: assignmentsTable.createdAt,
    })
    .from(assignmentsTable)
    .innerJoin(cohortsTable, eq(assignmentsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(assignmentsTable.programId, programsTable.id))
    .$dynamic();
  if (conds.length > 0) q = q.where(and(...conds));
  const rows = await q.orderBy(desc(assignmentsTable.createdAt));
  res.json({
    items: rows.map((r) => ({
      ...r,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/admin/assignments", requireAdmin, async (req, res) => {
  const parsed = CreateAssignment.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(assignmentsTable)
    .values({
      cohortId: parsed.data.cohortId,
      programId: parsed.data.programId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      status: parsed.data.status ?? "draft",
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json({
    ...row,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.get("/admin/assignments/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, id))
    .limit(1);
  if (!assignment) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const submissions = await db
    .select({
      id: assignmentSubmissionsTable.id,
      studentId: assignmentSubmissionsTable.studentId,
      studentName: studentsTable.name,
      status: assignmentSubmissionsTable.status,
      content: assignmentSubmissionsTable.content,
      fileUrl: assignmentSubmissionsTable.fileUrl,
      externalUrl: assignmentSubmissionsTable.externalUrl,
      submittedAt: assignmentSubmissionsTable.submittedAt,
      feedback: assignmentSubmissionsTable.feedback,
      reviewedBy: assignmentSubmissionsTable.reviewedBy,
      updatedAt: assignmentSubmissionsTable.updatedAt,
    })
    .from(assignmentSubmissionsTable)
    .innerJoin(
      studentsTable,
      eq(assignmentSubmissionsTable.studentId, studentsTable.id),
    )
    .where(eq(assignmentSubmissionsTable.assignmentId, id))
    .orderBy(asc(studentsTable.name));
  res.json({
    assignment: {
      ...assignment,
      dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    },
    submissions: submissions.map((s) => ({
      ...s,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
});

router.patch("/admin/assignments/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateAssignment.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "dueAt" && typeof v === "string") {
      updates.dueAt = new Date(v);
    } else if (k === "dueAt" && v === null) {
      updates.dueAt = null;
    } else {
      updates[k] = v;
    }
  }
  const [row] = await db
    .update(assignmentsTable)
    .set(updates)
    .where(eq(assignmentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

const SubmissionFeedback = z.object({
  feedback: z.string().max(4000).nullable().optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
});

router.patch("/admin/submissions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = SubmissionFeedback.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    reviewedBy: req.sessionUser!.id,
  };
  if (parsed.data.feedback !== undefined) updates.feedback = parsed.data.feedback;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  const [row] = await db
    .update(assignmentSubmissionsTable)
    .set(updates)
    .where(eq(assignmentSubmissionsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
