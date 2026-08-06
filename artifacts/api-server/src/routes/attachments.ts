import { Router, type IRouter } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  attachmentsTable,
  ATTACHMENT_VISIBILITIES,
  isLinkableType,
  financeRecordsTable,
  projectsTable,
  meetingsTable,
  documentsTable,
  getEffectiveRoles,
  hasOpsRole,
  type LinkableType,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { audit } from "../lib/audit";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

/**
 * Attachments (docs/design/04 §5).
 *
 * Objects are stored with ACL `visibility=private`, so they are NOT reachable
 * through the unauthenticated `GET /api/storage/objects/*` route that serves
 * avatars. Downloads must come through `/api/attachments/:id/download`, which
 * re-checks the row and the caller.
 *
 * Receipts (linked to a finance_record) additionally require the `finance` ops
 * role — `admin_only` alone would expose them to every admin.
 */

const CreateBody = z.object({
  objectPath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().max(200).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().max(50_000_000).nullable().optional(),
  linkedObjectType: z.string().max(50),
  linkedObjectId: z.number().int().positive(),
  visibility: z.enum(ATTACHMENT_VISIBILITIES).optional(),
});

/**
 * Verify the link target exists (design/04 §2 rule 2). Without this a caller
 * could attach files to ids that never existed, and orphan detection later
 * cannot tell "deleted" from "never valid".
 */
async function linkTargetExists(
  type: LinkableType,
  id: number,
): Promise<boolean> {
  switch (type) {
    case "finance_record":
      return Boolean(
        (await db.select({ id: financeRecordsTable.id }).from(financeRecordsTable).where(eq(financeRecordsTable.id, id)).limit(1))[0],
      );
    case "project":
      return Boolean(
        (await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1))[0],
      );
    case "meeting":
      return Boolean(
        (await db.select({ id: meetingsTable.id }).from(meetingsTable).where(eq(meetingsTable.id, id)).limit(1))[0],
      );
    case "document":
      return Boolean(
        (await db.select({ id: documentsTable.id }).from(documentsTable).where(eq(documentsTable.id, id)).limit(1))[0],
      );
    default:
      // Types without a validator are rejected rather than silently allowed.
      return false;
  }
}

/** Presigned PUT target for a direct browser upload. */
router.post("/admin/attachments/upload-url", requireAdmin, async (_req, res) => {
  const uploadUrl = await objectStorage.getObjectEntityUploadURL();
  res.json({ uploadUrl });
});

/** Register an uploaded object. Stamps the ACL private before recording it. */
router.post("/admin/attachments", requireAdmin, async (req, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  if (!isLinkableType(d.linkedObjectType)) {
    res.status(422).json({ error: "Unknown linkedObjectType" });
    return;
  }
  if (!(await linkTargetExists(d.linkedObjectType, d.linkedObjectId))) {
    res.status(422).json({ error: "연결 대상이 존재하지 않습니다." });
    return;
  }

  // Force private ACL — this is what keeps the object out of the public path.
  let objectPath: string;
  try {
    objectPath = await objectStorage.trySetObjectEntityAclPolicy(d.objectPath, {
      owner: String(req.sessionUser!.id),
      visibility: "private",
    });
  } catch {
    res.status(422).json({ error: "업로드된 파일을 찾을 수 없습니다." });
    return;
  }

  // Receipts are always admin_only regardless of what the client asked for.
  const visibility =
    d.linkedObjectType === "finance_record"
      ? "admin_only"
      : (d.visibility ?? "admin_only");

  const [row] = await db
    .insert(attachmentsTable)
    .values({
      objectPath,
      fileName: d.fileName,
      mimeType: d.mimeType ?? null,
      sizeBytes: d.sizeBytes ?? null,
      linkedObjectType: d.linkedObjectType,
      linkedObjectId: d.linkedObjectId,
      ownerId: req.sessionUser!.id,
      visibility,
    })
    .returning();

  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/admin/attachments", requireAdmin, async (req, res) => {
  const type = req.query.linkedObjectType;
  const id = Number(req.query.linkedObjectId);
  if (typeof type !== "string" || !isLinkableType(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "linkedObjectType/Id required" });
    return;
  }
  const rows = await db
    .select()
    .from(attachmentsTable)
    .where(
      and(
        eq(attachmentsTable.linkedObjectType, type),
        eq(attachmentsTable.linkedObjectId, id),
        // `private` is owner-only and that beats being an admin. Without this
        // the value was indistinguishable from `admin_only` — every admin saw
        // every row either way, which is what made it meaningless.
        or(
          sql`${attachmentsTable.visibility} <> 'private'`,
          eq(attachmentsTable.ownerId, req.sessionUser!.id),
        ),
      ),
    )
    .orderBy(desc(attachmentsTable.createdAt));
  res.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});

/**
 * Authenticated download. This is the ONLY way to read an attachment.
 *
 * Never redirects to a public URL and never returns the raw object path —
 * the file is streamed after the check so the storage location stays opaque.
 */
router.get("/attachments/:id/download", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const user = req.sessionUser!;
  const isAdmin = getEffectiveRoles(user).includes("admin");

  // Another owner's `private` attachment: 404, not 403. 403 would confirm the
  // id belongs to a real file the caller may not have.
  if (row.visibility === "private" && row.ownerId !== user.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Finance receipts need the finance function role on top of admin.
  if (row.linkedObjectType === "finance_record" && !hasOpsRole(user, "finance")) {
    res.status(403).json({ error: "Forbidden", requiredOpsRole: "finance" });
    return;
  }
  if (!isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const file = await objectStorage.getObjectEntityFile(row.objectPath);
    await objectStorage.downloadObject(file, 0);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    throw err;
  }
});

/** Metadata delete. The stored object is removed too, best-effort. */
router.delete("/admin/attachments/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Read before deleting so another owner's `private` row cannot be destroyed
  // by an admin who is not allowed to see it.
  const [target] = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.id, id))
    .limit(1);
  if (
    !target ||
    (target.visibility === "private" && target.ownerId !== req.sessionUser!.id)
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .delete(attachmentsTable)
    .where(eq(attachmentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  objectStorage.deleteObjectEntity(row.objectPath).catch(() => {});
  audit({
    action: "visibility_change",
    req,
    targetType: row.linkedObjectType,
    targetId: row.linkedObjectId,
    note: `attachment deleted: ${row.fileName}`,
  });
  res.json({ ok: true });
});

export default router;
