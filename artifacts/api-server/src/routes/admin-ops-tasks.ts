import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  opsTasksTable,
  OPS_TASK_STATUSES,
  OPS_TASK_PRIORITIES,
  usersTable,
  meetingsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateTask = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).optional(),
  status: z.enum(OPS_TASK_STATUSES).optional(),
  priority: z.enum(OPS_TASK_PRIORITIES).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  sourceMeetingId: z.number().int().positive().nullable().optional(),
  linkedObjectType: z.string().trim().max(40).nullable().optional(),
  linkedObjectId: z.number().int().positive().nullable().optional(),
});

function serialize(t: typeof opsTasksTable.$inferSelect) {
  return {
    ...t,
    dueDate: t.dueDate ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/admin/ops-tasks", requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const assigneeIdRaw = req.query.assigneeId;
  const assigneeId =
    typeof assigneeIdRaw === "string" && assigneeIdRaw !== ""
      ? Number(assigneeIdRaw)
      : undefined;

  const conditions = [];
  if (status && (OPS_TASK_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(opsTasksTable.status, status as (typeof OPS_TASK_STATUSES)[number]));
  }
  if (assigneeId && Number.isFinite(assigneeId)) {
    conditions.push(eq(opsTasksTable.assigneeId, assigneeId));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  // Join assignee + source meeting names for display.
  const rows = await db
    .select({
      t: opsTasksTable,
      assigneeName: usersTable.name,
      assigneeEmail: usersTable.email,
      assigneeActive: usersTable.isActive,
      meetingTitle: meetingsTable.title,
    })
    .from(opsTasksTable)
    .leftJoin(usersTable, eq(usersTable.id, opsTasksTable.assigneeId))
    .leftJoin(meetingsTable, eq(meetingsTable.id, opsTasksTable.sourceMeetingId))
    .where(where)
    .orderBy(desc(opsTasksTable.createdAt));

  res.json({
    items: rows.map(({ t, assigneeName, assigneeEmail, assigneeActive, meetingTitle }) => ({
      ...serialize(t),
      assigneeName: assigneeName ?? null,
      assigneeEmail: assigneeEmail ?? null,
      assigneeActive: assigneeActive ?? null,
      sourceMeetingTitle: meetingTitle ?? null,
    })),
    total: rows.length,
  });
});

router.post("/admin/ops-tasks", requireAdmin, async (req, res) => {
  const parsed = CreateTask.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
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
  if (d.sourceMeetingId) {
    const [m] = await db
      .select({ id: meetingsTable.id })
      .from(meetingsTable)
      .where(eq(meetingsTable.id, d.sourceMeetingId));
    if (!m) {
      res.status(400).json({ error: "Source meeting not found" });
      return;
    }
  }
  const [row] = await db
    .insert(opsTasksTable)
    .values({
      title: d.title,
      description: d.description ?? "",
      status: d.status ?? "todo",
      priority: d.priority ?? "medium",
      assigneeId: d.assigneeId ?? null,
      dueDate: d.dueDate ?? null,
      sourceMeetingId: d.sourceMeetingId ?? null,
      linkedObjectType: d.linkedObjectType ?? null,
      linkedObjectId: d.linkedObjectId ?? null,
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/admin/ops-tasks/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateTask.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
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
  if (d.sourceMeetingId) {
    const [m] = await db
      .select({ id: meetingsTable.id })
      .from(meetingsTable)
      .where(eq(meetingsTable.id, d.sourceMeetingId));
    if (!m) {
      res.status(400).json({ error: "Source meeting not found" });
      return;
    }
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(d)) updates[k] = v;
  const [row] = await db
    .update(opsTasksTable)
    .set(updates)
    .where(eq(opsTasksTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/admin/ops-tasks/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(opsTasksTable).where(eq(opsTasksTable.id, id));
  res.status(204).end();
});

// Silence unused import warning if drizzle prunes
void sql;

export default router;
