import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, peopleProfilesTable } from "@workspace/db";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Apple Memoji / Pixar-style stylized 3D cartoon character avatars.
// We seed the deterministic randomness off the person's name so each profile
// gets a distinct but stable character. We do NOT pass any descriptive text
// (name, role, affiliation) into the prompt — Gemini hallucinates garbled
// pseudo-text labels when given strings, and we don't want the model implying
// it's a real-person likeness either.
function buildPrompt(p: {
  name: string;
  kind: string;
  roleTitle: string | null;
  affiliation: string | null;
}): string {
  const seed = Math.abs(
    [...p.name].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0),
  );
  const pick = <T,>(arr: readonly T[], offset = 0): T =>
    arr[(seed + offset) % arr.length];

  const gender = pick(["male", "female", "androgynous"] as const);
  const skin = pick([
    "light",
    "fair",
    "medium",
    "tan",
    "olive",
    "warm brown",
    "deep brown",
  ] as const, 1);
  const hair = pick([
    "short black",
    "medium black",
    "buzz cut black",
    "neat side-parted dark brown",
    "wavy dark brown",
    "short curly black",
    "tied-back long black",
    "ponytail dark brown",
    "shoulder-length straight black",
  ] as const, 2);
  const accessory = pick([
    "no accessories",
    "round glasses",
    "rectangular glasses",
    "no accessories",
    "small earphones",
    "no accessories",
  ] as const, 3);
  const top = pick([
    "a mint-green hoodie",
    "a white t-shirt",
    "a light grey crewneck sweater",
    "a navy blue zip-up jacket",
    "a black turtleneck",
    "a mint-green t-shirt",
  ] as const, 4);
  const expression = pick([
    "a warm friendly smile",
    "a soft confident smile",
    "a calm pleasant expression",
    "a slight cheerful smile",
  ] as const, 5);

  return [
    `A stylized 3D cartoon character avatar in the style of Apple Memoji / Pixar.`,
    `A ${gender} character with ${skin} skin, ${hair} hair, ${accessory}, wearing ${top}, with ${expression}.`,
    `The character is NOT a real or recognizable person — it is a generic friendly cartoon avatar with simplified, smooth, rounded cartoon features (no realistic skin pores, no photorealism).`,
    `Head-and-shoulders portrait facing slightly forward, centered in the frame.`,
    `Soft studio lighting, clean solid pure-white background (#FFFFFF), no scenery, no props, no shadow behind the character.`,
    `Square 1:1 composition, high-quality 3D render, smooth shading, friendly and approachable, suitable as a profile avatar for a Korean student developer club.`,
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
