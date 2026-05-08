import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  activityRecordsTable,
  ACTIVITY_SOURCES,
  ACTIVITY_VISIBILITIES,
  studentsTable,
  cohortsTable,
  programsTable,
  tagMappingsTable,
  skillTagsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const Body = z.object({
  studentId: z.number().int().positive(),
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  sourceType: z.enum(ACTIVITY_SOURCES),
  sourceId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(8000).nullable().optional(),
  activityDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: "Invalid date",
    })
    .optional(),
  visibility: z.enum(ACTIVITY_VISIBILITIES).optional(),
});

function toIso(r: typeof activityRecordsTable.$inferSelect) {
  return {
    ...r,
    activityDate: r.activityDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/admin/activity-records", requireAdmin, async (req, res) => {
  const studentId = req.query.studentId
    ? Number(req.query.studentId)
    : undefined;
  const cohortId = req.query.cohortId
    ? Number(req.query.cohortId)
    : undefined;
  const programId = req.query.programId
    ? Number(req.query.programId)
    : undefined;
  const sourceType = req.query.sourceType as string | undefined;
  const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;

  const filters = [];
  if (studentId) filters.push(eq(activityRecordsTable.studentId, studentId));
  if (cohortId) filters.push(eq(activityRecordsTable.cohortId, cohortId));
  if (programId) filters.push(eq(activityRecordsTable.programId, programId));
  if (
    sourceType &&
    (ACTIVITY_SOURCES as readonly string[]).includes(sourceType)
  ) {
    filters.push(
      eq(
        activityRecordsTable.sourceType,
        sourceType as (typeof ACTIVITY_SOURCES)[number],
      ),
    );
  }
  if (tagId) {
    const taggedIds = (
      await db
        .select({ id: tagMappingsTable.targetId })
        .from(tagMappingsTable)
        .where(
          and(
            eq(tagMappingsTable.tagId, tagId),
            eq(tagMappingsTable.targetType, "activity_record"),
          ),
        )
    ).map((r) => r.id);
    if (taggedIds.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }
    filters.push(inArray(activityRecordsTable.id, taggedIds));
  }

  const rows = await db
    .select({
      r: activityRecordsTable,
      studentName: studentsTable.name,
      cohortName: cohortsTable.name,
      programName: programsTable.name,
    })
    .from(activityRecordsTable)
    .leftJoin(studentsTable, eq(activityRecordsTable.studentId, studentsTable.id))
    .leftJoin(cohortsTable, eq(activityRecordsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(activityRecordsTable.programId, programsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(activityRecordsTable.activityDate));
  res.json({
    items: rows.map((row) => ({
      ...toIso(row.r),
      studentName: row.studentName,
      cohortName: row.cohortName,
      programName: row.programName,
    })),
    total: rows.length,
  });
});

router.post("/admin/activity-records", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(activityRecordsTable)
    .values({
      studentId: parsed.data.studentId,
      cohortId: parsed.data.cohortId,
      programId: parsed.data.programId ?? null,
      sourceType: parsed.data.sourceType,
      sourceId: parsed.data.sourceId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      activityDate: parsed.data.activityDate
        ? new Date(parsed.data.activityDate)
        : new Date(),
      visibility: parsed.data.visibility ?? "admin_only",
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.patch("/admin/activity-records/:id", requireAdmin, async (req, res) => {
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
    if (k === "activityDate" && typeof v === "string")
      updates[k] = new Date(v);
    else updates[k] = v;
  }
  const [row] = await db
    .update(activityRecordsTable)
    .set(updates)
    .where(eq(activityRecordsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete(
  "/admin/activity-records/:id",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [removed] = await db
      .delete(activityRecordsTable)
      .where(eq(activityRecordsTable.id, id))
      .returning({ id: activityRecordsTable.id });
    if (!removed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

// Admin view: full timeline for a student (includes admin_only)
router.get(
  "/admin/students/:id/timeline",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select()
      .from(activityRecordsTable)
      .where(eq(activityRecordsTable.studentId, id))
      .orderBy(desc(activityRecordsTable.activityDate));
    // tags per record
    const ids = rows.map((r) => r.id);
    const tags = ids.length
      ? await db
          .select({
            recordId: tagMappingsTable.targetId,
            tagId: skillTagsTable.id,
            name: skillTagsTable.name,
          })
          .from(tagMappingsTable)
          .innerJoin(
            skillTagsTable,
            eq(skillTagsTable.id, tagMappingsTable.tagId),
          )
          .where(
            and(
              eq(tagMappingsTable.targetType, "activity_record"),
              inArray(tagMappingsTable.targetId, ids),
            ),
          )
      : [];
    const tagMap = new Map<number, { id: number; name: string }[]>();
    for (const t of tags) {
      const arr = tagMap.get(t.recordId) ?? [];
      arr.push({ id: t.tagId, name: t.name });
      tagMap.set(t.recordId, arr);
    }
    res.json({
      items: rows.map((r) => ({ ...toIso(r), tags: tagMap.get(r.id) ?? [] })),
      total: rows.length,
    });
  },
);

export default router;
