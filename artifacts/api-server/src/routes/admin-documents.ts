import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  documentsTable,
  documentVersionsTable,
  DOC_TYPES,
  DOC_VISIBILITIES,
  usersTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateDoc = z.object({
  title: z.string().trim().min(1).max(200),
  contentMd: z.string().max(200000).optional(),
  docType: z.enum(DOC_TYPES).optional(),
  isTemplate: z.boolean().optional(),
  visibility: z.enum(DOC_VISIBILITIES).optional(),
  linkedObjectType: z.string().trim().max(40).nullable().optional(),
  linkedObjectId: z.number().int().positive().nullable().optional(),
});

const PatchDoc = CreateDoc.partial().extend({
  archived: z.boolean().optional(),
});

function serialize(d: typeof documentsTable.$inferSelect) {
  return {
    ...d,
    archivedAt: d.archivedAt ? d.archivedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function serializeVersion(v: typeof documentVersionsTable.$inferSelect) {
  return { ...v, createdAt: v.createdAt.toISOString() };
}

// LIST — supports ?type=, ?isTemplate=true|false, ?q=, ?archived=true|false (default: not archived)
router.get("/admin/documents", requireAdmin, async (req, res) => {
  const conds = [];
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  if (type && (DOC_TYPES as readonly string[]).includes(type)) {
    conds.push(eq(documentsTable.docType, type as (typeof DOC_TYPES)[number]));
  }
  if (req.query.isTemplate === "true") {
    conds.push(eq(documentsTable.isTemplate, true));
  } else if (req.query.isTemplate === "false") {
    conds.push(eq(documentsTable.isTemplate, false));
  }
  if (req.query.archived === "true") {
    conds.push(sql`${documentsTable.archivedAt} is not null`);
  } else if (req.query.archived !== "all") {
    conds.push(sql`${documentsTable.archivedAt} is null`);
  }
  const q =
    typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length > 0) {
    conds.push(
      or(
        ilike(documentsTable.title, `%${q}%`),
        ilike(documentsTable.contentMd, `%${q}%`),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(documentsTable)
    .where(where)
    .orderBy(desc(documentsTable.updatedAt));
  res.json({ items: rows.map(serialize), total: rows.length });
});

// DETAIL — includes versions list (without bodies) for sidebar
router.get("/admin/documents/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, id));
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const versionRows = await db
    .select({
      id: documentVersionsTable.id,
      documentId: documentVersionsTable.documentId,
      versionNo: documentVersionsTable.versionNo,
      title: documentVersionsTable.title,
      editedBy: documentVersionsTable.editedBy,
      createdAt: documentVersionsTable.createdAt,
      editorName: usersTable.name,
      editorEmail: usersTable.email,
    })
    .from(documentVersionsTable)
    .leftJoin(usersTable, eq(usersTable.id, documentVersionsTable.editedBy))
    .where(eq(documentVersionsTable.documentId, id))
    .orderBy(desc(documentVersionsTable.versionNo));
  res.json({
    ...serialize(doc),
    versions: versionRows.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
  });
});

// VERSION DETAIL — includes contentMd
router.get(
  "/admin/documents/:id/versions/:vno",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    const vno = Number(req.params.vno);
    if (!Number.isFinite(id) || !Number.isFinite(vno)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [v] = await db
      .select()
      .from(documentVersionsTable)
      .where(
        and(
          eq(documentVersionsTable.documentId, id),
          eq(documentVersionsTable.versionNo, vno),
        ),
      );
    if (!v) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeVersion(v));
  },
);

// CREATE — also writes version_no=1 snapshot.
router.post("/admin/documents", requireAdmin, async (req, res) => {
  const parsed = CreateDoc.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const userId = req.sessionUser!.id;
  const created = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documentsTable)
      .values({
        title: d.title,
        contentMd: d.contentMd ?? "",
        docType: d.docType ?? "general",
        isTemplate: d.isTemplate ?? false,
        visibility: d.visibility ?? "admin_only",
        linkedObjectType: d.linkedObjectType ?? null,
        linkedObjectId: d.linkedObjectId ?? null,
        createdBy: userId,
      })
      .returning();
    await tx.insert(documentVersionsTable).values({
      documentId: doc.id,
      versionNo: 1,
      title: doc.title,
      contentMd: doc.contentMd,
      editedBy: userId,
    });
    return doc;
  });
  res.status(201).json(serialize(created));
});

// PATCH — creates a new version when title or contentMd changes.
router.patch("/admin/documents/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = PatchDoc.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const userId = req.sessionUser!.id;

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id));
    if (!existing) return null;

    const nextTitle = d.title ?? existing.title;
    const nextContent = d.contentMd ?? existing.contentMd;
    const contentChanged =
      nextTitle !== existing.title || nextContent !== existing.contentMd;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.title !== undefined) updates.title = d.title;
    if (d.contentMd !== undefined) updates.contentMd = d.contentMd;
    if (d.docType !== undefined) updates.docType = d.docType;
    if (d.isTemplate !== undefined) updates.isTemplate = d.isTemplate;
    if (d.visibility !== undefined) updates.visibility = d.visibility;
    if (d.linkedObjectType !== undefined)
      updates.linkedObjectType = d.linkedObjectType;
    if (d.linkedObjectId !== undefined)
      updates.linkedObjectId = d.linkedObjectId;
    if (d.archived !== undefined) {
      updates.archivedAt = d.archived ? new Date() : null;
    }

    const [updated] = await tx
      .update(documentsTable)
      .set(updates)
      .where(eq(documentsTable.id, id))
      .returning();

    if (contentChanged) {
      const [{ maxNo }] = await tx
        .select({
          maxNo: sql<number>`coalesce(max(${documentVersionsTable.versionNo}), 0)`,
        })
        .from(documentVersionsTable)
        .where(eq(documentVersionsTable.documentId, id));
      await tx.insert(documentVersionsTable).values({
        documentId: id,
        versionNo: Number(maxNo) + 1,
        title: nextTitle,
        contentMd: nextContent,
        editedBy: userId,
      });
    }
    return updated;
  });
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(result));
});

// CLONE — copies title/content/type into a new non-template doc.
router.post("/admin/documents/:id/clone", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const titleOverride =
    typeof req.body?.title === "string" && req.body.title.trim().length > 0
      ? req.body.title.trim().slice(0, 200)
      : null;
  const userId = req.sessionUser!.id;
  const cloned = await db.transaction(async (tx) => {
    const [src] = await tx
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id));
    if (!src) return null;
    const newTitle = titleOverride ?? `${src.title} (사본)`;
    const [doc] = await tx
      .insert(documentsTable)
      .values({
        title: newTitle,
        contentMd: src.contentMd,
        docType: src.docType,
        isTemplate: false,
        visibility: src.visibility,
        linkedObjectType: null,
        linkedObjectId: null,
        createdBy: userId,
      })
      .returning();
    await tx.insert(documentVersionsTable).values({
      documentId: doc.id,
      versionNo: 1,
      title: doc.title,
      contentMd: doc.contentMd,
      editedBy: userId,
    });
    return doc;
  });
  if (!cloned) {
    res.status(404).json({ error: "Source document not found" });
    return;
  }
  res.status(201).json(serialize(cloned));
});

// DELETE — hard delete (cascades versions). Use PATCH { archived: true } for soft archive.
router.delete("/admin/documents/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const r = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, id))
    .returning({ id: documentsTable.id });
  if (r.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

void asc;

export default router;
