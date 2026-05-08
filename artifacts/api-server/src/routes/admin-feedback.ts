import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  feedbackTable,
  FEEDBACK_TARGETS,
  FEEDBACK_TYPES,
  FEEDBACK_VISIBILITIES,
  studentsTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const Body = z.object({
  targetType: z.enum(FEEDBACK_TARGETS),
  targetId: z.number().int().positive(),
  studentId: z.number().int().positive().nullable().optional(),
  feedbackType: z.enum(FEEDBACK_TYPES).optional(),
  content: z.string().trim().min(1).max(8000),
  visibility: z.enum(FEEDBACK_VISIBILITIES).optional(),
});

function toIso(f: typeof feedbackTable.$inferSelect) {
  return {
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

router.get("/admin/feedback", requireAdmin, async (req, res) => {
  const targetType = req.query.targetType as string | undefined;
  const targetId = req.query.targetId ? Number(req.query.targetId) : undefined;
  const studentId = req.query.studentId
    ? Number(req.query.studentId)
    : undefined;
  const filters = [];
  if (
    targetType &&
    (FEEDBACK_TARGETS as readonly string[]).includes(targetType)
  ) {
    filters.push(
      eq(
        feedbackTable.targetType,
        targetType as (typeof FEEDBACK_TARGETS)[number],
      ),
    );
  }
  if (targetId) filters.push(eq(feedbackTable.targetId, targetId));
  if (studentId) filters.push(eq(feedbackTable.studentId, studentId));
  const rows = await db
    .select({
      f: feedbackTable,
      studentName: studentsTable.name,
      authorName: usersTable.name,
    })
    .from(feedbackTable)
    .leftJoin(studentsTable, eq(feedbackTable.studentId, studentsTable.id))
    .leftJoin(usersTable, eq(feedbackTable.authorId, usersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(feedbackTable.createdAt));
  res.json({
    items: rows.map((row) => ({
      ...toIso(row.f),
      studentName: row.studentName,
      authorName: row.authorName,
    })),
    total: rows.length,
  });
});

router.post("/admin/feedback", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(feedbackTable)
    .values({
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      studentId: parsed.data.studentId ?? null,
      authorId: req.sessionUser!.id,
      feedbackType: parsed.data.feedbackType ?? "general",
      content: parsed.data.content,
      visibility: parsed.data.visibility ?? "admin_only",
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.patch("/admin/feedback/:id", requireAdmin, async (req, res) => {
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
  const [row] = await db
    .update(feedbackTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(feedbackTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete("/admin/feedback/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(feedbackTable)
    .where(eq(feedbackTable.id, id))
    .returning({ id: feedbackTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
