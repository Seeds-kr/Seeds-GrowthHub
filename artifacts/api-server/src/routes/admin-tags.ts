import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  skillTagsTable,
  tagMappingsTable,
  TAG_TARGETS,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const TagBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
});
const MapBody = z.object({
  tagId: z.number().int().positive(),
  targetType: z.enum(TAG_TARGETS),
  targetId: z.number().int().positive(),
});

function toIso(t: typeof skillTagsTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/admin/tags", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(skillTagsTable)
    .orderBy(asc(skillTagsTable.name));
  res.json({ items: rows.map(toIso), total: rows.length });
});

router.post("/admin/tags", requireAdmin, async (req, res) => {
  const parsed = TagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db
      .insert(skillTagsTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .returning();
    res.status(201).json(toIso(row));
  } catch (e: any) {
    if ((e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")))
      res.status(409).json({ error: "Tag name already exists" });
    else throw e;
  }
});

router.patch("/admin/tags/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = TagBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .update(skillTagsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(skillTagsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete("/admin/tags/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(skillTagsTable)
    .where(eq(skillTagsTable.id, id))
    .returning({ id: skillTagsTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/admin/tag-mappings", requireAdmin, async (req, res) => {
  const parsed = MapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db
      .insert(tagMappingsTable)
      .values({
        tagId: parsed.data.tagId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        createdBy: req.sessionUser!.id,
      })
      .returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (e: any) {
    if ((e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")))
      res.status(409).json({ error: "Mapping already exists" });
    else throw e;
  }
});

router.delete("/admin/tag-mappings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(tagMappingsTable)
    .where(eq(tagMappingsTable.id, id))
    .returning({ id: tagMappingsTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

// Tag summary per student (counts across all targets that reference this student)
router.get("/admin/students/:id/tags", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Aggregate counts across the student's activity_records, projects (member),
  // artifacts owned, feedback referencing student, plus direct student mappings.
  // Simpler approach: union the relevant targetIds via raw SQL.
  const rows = await db.execute(sql`
    WITH ar AS (
      SELECT id FROM activity_records WHERE student_id = ${id}
    ), pr AS (
      SELECT project_id AS id FROM project_members WHERE student_id = ${id}
    ), art AS (
      SELECT id FROM artifacts WHERE student_id = ${id}
    ), fb AS (
      SELECT id FROM feedback WHERE student_id = ${id}
    )
    SELECT t.id AS tag_id, t.name AS tag_name, COUNT(*)::int AS cnt
    FROM tag_mappings tm
    JOIN skill_tags t ON t.id = tm.tag_id
    WHERE
      (tm.target_type = 'activity_record' AND tm.target_id IN (SELECT id FROM ar))
      OR (tm.target_type = 'project' AND tm.target_id IN (SELECT id FROM pr))
      OR (tm.target_type = 'artifact' AND tm.target_id IN (SELECT id FROM art))
      OR (tm.target_type = 'feedback' AND tm.target_id IN (SELECT id FROM fb))
      OR (tm.target_type = 'student' AND tm.target_id = ${id})
    GROUP BY t.id, t.name
    ORDER BY cnt DESC, t.name ASC
  `);
  res.json({
    items: (rows.rows as any[]).map((r) => ({
      tagId: r.tag_id,
      name: r.tag_name,
      count: r.cnt,
    })),
  });
});

// Bulk mappings for a target (used by detail pages)
router.get("/admin/tag-mappings", requireAdmin, async (req, res) => {
  const targetType = req.query.targetType as string | undefined;
  const targetId = req.query.targetId ? Number(req.query.targetId) : undefined;
  if (
    !targetType ||
    !(TAG_TARGETS as readonly string[]).includes(targetType) ||
    !targetId
  ) {
    res.status(400).json({ error: "targetType and targetId required" });
    return;
  }
  const rows = await db
    .select({
      mappingId: tagMappingsTable.id,
      tagId: skillTagsTable.id,
      name: skillTagsTable.name,
    })
    .from(tagMappingsTable)
    .innerJoin(skillTagsTable, eq(skillTagsTable.id, tagMappingsTable.tagId))
    .where(
      and(
        eq(
          tagMappingsTable.targetType,
          targetType as (typeof TAG_TARGETS)[number],
        ),
        eq(tagMappingsTable.targetId, targetId),
      ),
    );
  res.json({ items: rows });
});

export default router;
