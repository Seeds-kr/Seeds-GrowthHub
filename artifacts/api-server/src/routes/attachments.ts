import express, { Router, type IRouter } from "express";
import { Readable } from "stream";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  deleteStored,
  isAllowedImageType,
  openStored,
  storeImage,
} from "../lib/fileStore";
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
import { audit } from "../lib/audit";

const router: IRouter = Router();

/**
 * Attachments (docs/design/04 §5).
 *
 * 파일은 업로드 루트의 **비공개 영역**에 있다. 무인증으로 열리는 곳은
 * `uploads/public/` 뿐이고 거기엔 프로필 사진만 들어간다(ADR-017). 그래서
 * 본문 이미지는 주소를 알아도 그냥 열리지 않는다 — 반드시
 * `/api/attachments/:id/download` 를 거치고, 그 라우트가 행과 호출자를 다시 본다.
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
/**
 * 이미지 업로드 — 본문에 박히는 그림만 받는다.
 *
 * 전에는 서명된 URL 을 발급해 브라우저가 저장소로 직접 PUT 했다(Replit 사이드카
 * 전제). 사이드카가 없는 곳에서는 그 발급이 500 이라 붙여넣기가 통째로 죽었다.
 * 이제 바이트를 여기로 바로 받는다 — 외부 의존이 없다.
 *
 * 자료 파일(기획서·발표자료·영상)은 여기로 오지 않는다. 그건 구글 드라이브에
 * 두고 `external_links` 로 주소만 붙인다(설계 06 ADR-010).
 *
 * 본문은 원시 바이트다(multipart 아님). 한 번에 한 장이고 파일명·타입은 헤더로
 * 오므로 파서를 하나 더 들일 이유가 없다.
 */
router.post(
  "/admin/attachments/upload",
  requireAdmin,
  // express.raw 가 한도를 넘기면 기본 오류 핸들러가 **HTML** 을 돌려준다.
  // API 소비자는 JSON 을 기대하므로 여기서 잡아 우리 말로 바꾼다.
  (req, res, next) => {
    express.raw({ type: "image/*", limit: MAX_IMAGE_BYTES + 1024 })(
      req,
      res,
      (err?: unknown) => {
        if (!err) return next();
        const code = (err as { status?: number }).status ?? 400;
        if (code === 413) {
          res.status(413).json({
            error: `파일이 너무 큽니다. ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
          });
          return;
        }
        res.status(400).json({ error: "업로드를 읽지 못했습니다." });
      },
    );
  },
  async (req, res) => {
    const mime = (req.header("content-type") || "").split(";")[0].trim();
    if (!isAllowedImageType(mime)) {
      res.status(415).json({
        error: `이미지 파일만 올릴 수 있습니다 (${ALLOWED_IMAGE_TYPES.join(", ")}).`,
      });
      return;
    }
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "빈 파일입니다." });
      return;
    }
    if (body.length > MAX_IMAGE_BYTES) {
      res.status(413).json({
        error: `파일이 너무 큽니다. ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
      });
      return;
    }
    try {
      const stored = await storeImage(Readable.from(body), mime);
      res.status(201).json(stored);
    } catch (err) {
      res.status(422).json({ error: (err as Error).message });
    }
  },
);

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

  // 저장된 파일이 실제로 있는지 확인한다. 경로만 받아 DB 에 적으면 존재하지
  // 않는 파일을 가리키는 행이 생긴다.
  const objectPath = d.objectPath;
  if (!(await openStored(objectPath))) {
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

  const stored = await openStored(row.objectPath);
  if (!stored) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  // 권한으로 막힌 파일이므로 어디에도 캐시되면 안 된다.
  res.setHeader("Cache-Control", "private, max-age=0, no-store");
  res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", String(stored.sizeBytes));
  // `inline`, not `attachment` — MarkdownEditor 가 같은 주소를 <img> src 로
  // 쓰므로 attachment 면 붙여넣은 이미지마다 다운로드 창이 뜬다.
  // filename* 은 RFC 5987 이라 한글 이름이 살아남는다.
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
  );
  stored.stream.on("error", () => res.destroy());
  stored.stream.pipe(res);
});

/** 메타데이터 삭제. 저장된 파일도 같이 지운다(실패해도 진행). */
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
  deleteStored(row.objectPath).catch(() => {});
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
