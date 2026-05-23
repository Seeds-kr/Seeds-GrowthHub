import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, peopleProfilesTable } from "@workspace/db";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Brand-aligned avatar prompt: minimalist flat illustration, mint green +
// white palette, abstract silhouette (no facial features) to avoid the
// "fake person" problem for AI-generated portraits.
function buildPrompt(p: {
  name: string;
  kind: string;
  roleTitle: string | null;
  affiliation: string | null;
}): string {
  const role =
    p.kind === "mentor"
      ? "tech mentor"
      : p.kind === "staff"
        ? "club staff member"
        : "student developer";
  // Note: we deliberately do NOT pass the person's name, role, or affiliation
  // to the image model. Gemini frequently hallucinates and renders garbled
  // pseudo-text labels when given any descriptive string, even with explicit
  // "no text" instructions. Using only a neutral seed keeps avatars clean.
  const seed = Math.abs(
    [...p.name].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0),
  );
  const accents = ["a leaf", "a small circle", "a single line", "a soft spark", "a small dot pattern"];
  const accent = accents[seed % accents.length];
  return [
    `Minimalist flat vector illustration avatar for a ${role}.`,
    `Style: clean modern startup illustration, similar to Notion or Linear avatars. Pure white background with a single mint-green accent color. Geometric simplified shapes only.`,
    `Subject: an abstract head-and-shoulders silhouette of a person, NO facial features, NO eyes, NO mouth, NO realistic skin or hair detail. Just a clean simplified human shape with ${accent} as a soft geometric accent.`,
    `Composition: centered, square, generous negative space, soft edges. Looks friendly and professional.`,
    `STRICT: do NOT render any text, letters, words, numbers, symbols, watermark, logo, signature, caption, label, badge, name tag, or any typography of any kind anywhere in the image. The image must contain ZERO characters or glyphs.`,
  ].join(" ");
}

// PUT raw bytes to the presigned URL returned by the sidecar.
async function uploadPng(signedUrl: string, bytes: Buffer): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.byteLength),
    },
    // Convert Node Buffer to a Uint8Array body, then cast for the fetch type
    // (Node's fetch accepts BodyInit including Uint8Array).
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(
      `Avatar upload failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
}

router.post(
  "/admin/people/:id/generate-avatar",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [profile] = await db
      .select()
      .from(peopleProfilesTable)
      .where(eq(peopleProfilesTable.id, id))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    let b64: string;
    try {
      const result = await generateImage(buildPrompt(profile));
      b64 = result.b64_json;
    } catch (e) {
      req.log.error({ err: e, profileId: id }, "Avatar generation failed");
      res.status(502).json({ error: "Image generation failed" });
      return;
    }

    const bytes = Buffer.from(b64, "base64");
    let uploadedObjectPath: string | null = null;
    try {
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      await uploadPng(uploadUrl, bytes);
      // Stamp ACL public so /api/storage/objects/* serves to anyone.
      uploadedObjectPath =
        await objectStorageService.trySetObjectEntityAclPolicy(uploadUrl, {
          owner: String(req.sessionUser?.id ?? "system"),
          visibility: "public",
        });
      const photoUrl = `/api/storage${uploadedObjectPath}`;
      const oldPhotoUrl = profile.photoUrl;
      const [updated] = await db
        .update(peopleProfilesTable)
        .set({ photoUrl, updatedAt: new Date() })
        .where(eq(peopleProfilesTable.id, id))
        .returning();
      // Best-effort delete of the previously-stored avatar object to avoid
      // accumulating orphaned PNGs across repeated admin clicks.
      if (oldPhotoUrl && oldPhotoUrl.startsWith("/api/storage/objects/")) {
        const oldObjectPath = oldPhotoUrl.slice("/api/storage".length);
        objectStorageService
          .deleteObjectEntity(oldObjectPath)
          .catch((err) =>
            req.log.warn(
              { err, oldPhotoUrl },
              "Failed to delete prior avatar object",
            ),
          );
      }
      res.json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (e) {
      req.log.error({ err: e, profileId: id }, "Avatar upload failed");
      // Cleanup the just-uploaded object so a failed run doesn't leak storage.
      if (uploadedObjectPath) {
        objectStorageService
          .deleteObjectEntity(uploadedObjectPath)
          .catch(() => {});
      }
      res.status(500).json({ error: "Avatar upload failed" });
    }
  },
);

export default router;
