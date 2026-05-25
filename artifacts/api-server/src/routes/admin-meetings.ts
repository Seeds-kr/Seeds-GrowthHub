import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  meetingsTable,
  MEETING_TYPES,
  MEETING_VISIBILITIES,
  opsTasksTable,
  OPS_TASK_PRIORITIES,
  usersTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateMeeting = z.object({
  title: z.string().trim().min(1).max(200),
  meetingType: z.enum(MEETING_TYPES).optional(),
  meetingDate: z.string().min(1), // ISO date/time
  participants: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  agendaMd: z.string().max(20000).optional(),
  decisionsMd: z.string().max(20000).optional(),
  notesMd: z.string().max(20000).optional(),
  pendingMd: z.string().max(20000).optional(),
  visibility: z.enum(MEETING_VISIBILITIES).optional(),
  linkedObjectType: z.string().trim().max(40).nullable().optional(),
  linkedObjectId: z.number().int().positive().nullable().optional(),
});

function serializeMeeting(m: typeof meetingsTable.$inferSelect) {
  return {
    ...m,
    meetingDate: m.meetingDate.toISOString(),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

router.get("/admin/meetings", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(meetingsTable)
    .orderBy(desc(meetingsTable.meetingDate));
  res.json({ items: rows.map(serializeMeeting), total: rows.length });
});

router.get("/admin/meetings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const actionItems = await db
    .select()
    .from(opsTasksTable)
    .where(eq(opsTasksTable.sourceMeetingId, id))
    .orderBy(desc(opsTasksTable.createdAt));
  res.json({
    ...serializeMeeting(row),
    actionItems: actionItems.map((t) => ({
      ...t,
      dueDate: t.dueDate ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
});

router.post("/admin/meetings", requireAdmin, async (req, res) => {
  const parsed = CreateMeeting.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const date = new Date(d.meetingDate);
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ error: "Invalid meetingDate" });
    return;
  }
  const [row] = await db
    .insert(meetingsTable)
    .values({
      title: d.title,
      meetingType: d.meetingType ?? "general",
      meetingDate: date,
      participants: d.participants ?? [],
      agendaMd: d.agendaMd ?? "",
      decisionsMd: d.decisionsMd ?? "",
      notesMd: d.notesMd ?? "",
      pendingMd: d.pendingMd ?? "",
      visibility: d.visibility ?? "admin_only",
      linkedObjectType: d.linkedObjectType ?? null,
      linkedObjectId: d.linkedObjectId ?? null,
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(serializeMeeting(row));
});

router.patch("/admin/meetings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateMeeting.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.meetingType !== undefined) updates.meetingType = d.meetingType;
  if (d.meetingDate !== undefined) {
    const date = new Date(d.meetingDate);
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ error: "Invalid meetingDate" });
      return;
    }
    updates.meetingDate = date;
  }
  if (d.participants !== undefined) updates.participants = d.participants;
  if (d.agendaMd !== undefined) updates.agendaMd = d.agendaMd;
  if (d.decisionsMd !== undefined) updates.decisionsMd = d.decisionsMd;
  if (d.notesMd !== undefined) updates.notesMd = d.notesMd;
  if (d.pendingMd !== undefined) updates.pendingMd = d.pendingMd;
  if (d.visibility !== undefined) updates.visibility = d.visibility;
  if (d.linkedObjectType !== undefined) updates.linkedObjectType = d.linkedObjectType;
  if (d.linkedObjectId !== undefined) updates.linkedObjectId = d.linkedObjectId;
  const [row] = await db
    .update(meetingsTable)
    .set(updates)
    .where(eq(meetingsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeMeeting(row));
});

router.delete("/admin/meetings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
  res.status(204).end();
});

// Create action item (task) from a meeting.
const CreateActionItem = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  priority: z.enum(OPS_TASK_PRIORITIES).optional(),
});

router.post(
  "/admin/meetings/:id/action-items",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [meeting] = await db
      .select({ id: meetingsTable.id })
      .from(meetingsTable)
      .where(eq(meetingsTable.id, id));
    if (!meeting) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }
    const parsed = CreateActionItem.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    // Validate assignee exists if provided
    if (d.assigneeId) {
      const [u] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, d.assigneeId));
      if (!u) {
        res.status(400).json({ error: "Assignee not found" });
        return;
      }
    }
    const [row] = await db
      .insert(opsTasksTable)
      .values({
        title: d.title,
        description: d.description ?? "",
        priority: d.priority ?? "medium",
        assigneeId: d.assigneeId ?? null,
        dueDate: d.dueDate ?? null,
        sourceMeetingId: id,
        createdBy: req.sessionUser!.id,
      })
      .returning();
    res.status(201).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
