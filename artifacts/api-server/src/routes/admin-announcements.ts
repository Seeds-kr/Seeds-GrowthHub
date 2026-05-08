import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  announcementsTable,
  ANNOUNCEMENT_TARGETS,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateAnnouncement = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(8000),
  targetType: z.enum(ANNOUNCEMENT_TARGETS).optional(),
  targetId: z.number().int().positive().nullable().optional(),
  isPublished: z.boolean().optional(),
});

router.get("/admin/announcements", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt));
  res.json({
    items: rows.map((r) => ({
      ...r,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/admin/announcements", requireAdmin, async (req, res) => {
  const parsed = CreateAnnouncement.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const targetType = parsed.data.targetType ?? "all";
  if (targetType !== "all" && !parsed.data.targetId) {
    res.status(400).json({ error: "targetId required for cohort/program target" });
    return;
  }
  const isPublished = parsed.data.isPublished ?? false;
  const [row] = await db
    .insert(announcementsTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      targetType,
      targetId: targetType === "all" ? null : parsed.data.targetId ?? null,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json({
    ...row,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.patch("/admin/announcements/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateAnnouncement.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) updates[k] = v;
  if (parsed.data.isPublished === true) updates.publishedAt = new Date();
  if (parsed.data.isPublished === false) updates.publishedAt = null;
  const [row] = await db
    .update(announcementsTable)
    .set(updates)
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
