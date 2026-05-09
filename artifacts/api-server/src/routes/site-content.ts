import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, siteContentsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import {
  SITE_CONTENT_KEYS,
  SITE_CONTENT_LABELS,
  type SiteContentKey,
} from "../lib/site-content-defaults";
import { SITE_CONTENT_SCHEMAS } from "../lib/site-content-schemas";

const router: IRouter = Router();

function isValidKey(k: string): k is SiteContentKey {
  return (SITE_CONTENT_KEYS as readonly string[]).includes(k);
}

function shape(row: typeof siteContentsTable.$inferSelect) {
  return {
    key: row.key,
    label: row.label,
    value: row.value,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

// Public: list all known site content (used by FE pages on render)
router.get("/site-content", async (_req, res) => {
  const rows = await db.select().from(siteContentsTable);
  const items = rows
    .filter((r) => (SITE_CONTENT_KEYS as readonly string[]).includes(r.key))
    .map(shape);
  res.json({ items });
});

// Public: single key
router.get("/site-content/:key", async (req, res) => {
  const key = String(req.params.key);
  if (!isValidKey(key)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(siteContentsTable)
    .where(eq(siteContentsTable.key, key))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(shape(row));
});

// Admin: list (same shape as public; available even if FE wants to gate)
router.get("/admin/site-content", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(siteContentsTable);
  // Ensure all known keys are returned (so admin sees blanks too)
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const items = SITE_CONTENT_KEYS.map((k) => {
    const r = byKey.get(k);
    return r
      ? shape(r)
      : { key: k, label: SITE_CONTENT_LABELS[k], value: null, updatedAt: null, updatedBy: null };
  });
  res.json({ items });
});

const PutBody = z.object({
  value: z.unknown().refine((v) => v !== undefined, { message: "value required" }),
});

// Admin: upsert
router.put("/admin/site-content/:key", requireAdmin, async (req, res) => {
  const key = String(req.params.key);
  if (!isValidKey(key)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const schema = SITE_CONTENT_SCHEMAS[key];
  const shapeCheck = schema.safeParse(parsed.data.value);
  if (!shapeCheck.success) {
    res.status(400).json({
      error: "콘텐츠 구조가 올바르지 않습니다. 필드명/구조를 확인해주세요.",
      details: shapeCheck.error.issues.slice(0, 5),
    });
    return;
  }
  const me = req.sessionUser!;
  const label = SITE_CONTENT_LABELS[key];
  const [row] = await db
    .insert(siteContentsTable)
    .values({
      key,
      label,
      value: parsed.data.value as object,
      updatedBy: me.id,
    })
    .onConflictDoUpdate({
      target: siteContentsTable.key,
      set: {
        value: parsed.data.value as object,
        label,
        updatedBy: me.id,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json(shape(row));
});

export default router;
