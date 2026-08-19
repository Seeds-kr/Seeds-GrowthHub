import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, peopleProfilesTable } from "@workspace/db";
import {
  generateImage,
  type ReferenceImage,
} from "@workspace/integrations-gemini-ai/image";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_REF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_REF_BYTES = 5 * 1024 * 1024; // 5MB raw

const GenerateBody = z
  .object({
    gender: z.enum(["male", "female", "androgynous"]).optional(),
    hairLength: z.enum(["short", "medium", "long"]).optional(),
    hairStyle: z.enum(["straight", "wavy", "curly"]).optional(),
    hairColor: z.enum(["black", "dark_brown", "brown"]).optional(),
    glasses: z.enum(["none", "round", "rectangular"]).optional(),
    top: z
      .enum([
        "mint_hoodie",
        "white_tee",
        "grey_sweater",
        "navy_jacket",
        "black_turtleneck",
        "mint_tee",
      ])
      .optional(),
    expression: z.enum(["smile", "calm", "confident"]).optional(),
    notes: z.string().trim().max(300).optional(),
    referenceImage: z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .optional(),
  })
  .strict();

type GenerateOpts = z.infer<typeof GenerateBody>;

// Pretty labels passed to the model. Keys are stable API enum values.
const GENDER: Record<NonNullable<GenerateOpts["gender"]>, string> = {
  male: "male",
  female: "female",
  androgynous: "androgynous",
};
const HAIR_LEN: Record<NonNullable<GenerateOpts["hairLength"]>, string> = {
  short: "short",
  medium: "medium-length",
  long: "long",
};
const HAIR_STYLE: Record<NonNullable<GenerateOpts["hairStyle"]>, string> = {
  straight: "straight",
  wavy: "wavy",
  curly: "curly",
};
const HAIR_COLOR: Record<NonNullable<GenerateOpts["hairColor"]>, string> = {
  black: "black",
  dark_brown: "dark brown",
  brown: "brown",
};
const GLASSES: Record<NonNullable<GenerateOpts["glasses"]>, string> = {
  none: "no glasses",
  round: "round-frame glasses",
  rectangular: "rectangular-frame glasses",
};
const TOP: Record<NonNullable<GenerateOpts["top"]>, string> = {
  mint_hoodie: "a mint-green hoodie",
  white_tee: "a white t-shirt",
  grey_sweater: "a light grey crewneck sweater",
  navy_jacket: "a navy blue zip-up jacket",
  black_turtleneck: "a black turtleneck",
  mint_tee: "a mint-green t-shirt",
};
const EXPRESSION: Record<NonNullable<GenerateOpts["expression"]>, string> = {
  smile: "a warm friendly smile",
  calm: "a calm pleasant expression",
  confident: "a soft confident smile",
};

// Apple Memoji / Pixar-style stylized 3D cartoon character avatars.
// For unspecified fields we deterministically pick from a pool seeded off the
// person's name so each profile gets a distinct but stable character. We never
// pass the person's name/role/affiliation into the prompt — Gemini hallucinates
// garbled pseudo-text labels when given strings.
function buildPrompt(
  p: { name: string; kind: string },
  opts: GenerateOpts,
  hasReference: boolean,
): string {
  const seed = Math.abs(
    [...p.name].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0),
  );
  const pick = <T,>(arr: readonly T[], offset = 0): T =>
    arr[(seed + offset) % arr.length];

  const gender = opts.gender
    ? GENDER[opts.gender]
    : pick(["male", "female", "androgynous"] as const);
  const hairLen = opts.hairLength
    ? HAIR_LEN[opts.hairLength]
    : pick(["short", "medium-length", "shoulder-length"] as const, 1);
  const hairStyle = opts.hairStyle
    ? HAIR_STYLE[opts.hairStyle]
    : pick(["straight", "wavy", "softly textured"] as const, 2);
  const hairColor = opts.hairColor
    ? HAIR_COLOR[opts.hairColor]
    : pick(["black", "dark brown"] as const, 3);
  const glasses = opts.glasses
    ? GLASSES[opts.glasses]
    : pick(
        ["no glasses", "no glasses", "round-frame glasses", "rectangular-frame glasses"] as const,
        4,
      );
  const top = opts.top
    ? TOP[opts.top]
    : pick(
        [
          "a mint-green hoodie",
          "a white t-shirt",
          "a light grey crewneck sweater",
          "a navy blue zip-up jacket",
          "a black turtleneck",
        ] as const,
        5,
      );
  const expression = opts.expression
    ? EXPRESSION[opts.expression]
    : pick(
        [
          "a warm friendly smile",
          "a soft confident smile",
          "a calm pleasant expression",
        ] as const,
        6,
      );

  const lines = [
    `A stylized 3D cartoon character avatar in the style of Apple Memoji / Pixar.`,
    `A ${gender} character with ${hairLen} ${hairStyle} ${hairColor} hair, ${glasses}, wearing ${top}, with ${expression}.`,
    `Head-and-shoulders portrait facing slightly forward, centered in the frame.`,
    `Soft studio lighting, clean solid pure-white background (#FFFFFF), no scenery, no props, no shadow behind the character.`,
    `Square 1:1 composition, smooth 3D render, friendly and approachable, suitable as a profile avatar for a Korean student developer club.`,
  ];

  if (hasReference) {
    lines.push(
      `A reference photo of the real person is provided. Use it ONLY as loose inspiration for face shape, general hair length/style, gender presentation, and (if visible) whether they wear glasses. The reference photo may contain multiple people or other unrelated content — focus on the most central person and ignore background/other people entirely.`,
      `IMPORTANT: do NOT copy the photo or attempt photorealism. Do NOT reproduce identifiable facial features, skin texture, or exact likeness. The output must be a clearly stylized, anonymized cartoon character that is plausibly inspired by the person but is NOT the same person.`,
    );
  }

  if (opts.notes) {
    lines.push(`Additional guidance from the user: ${opts.notes}.`);
  }

  lines.push(
    `The character is NOT a real or recognizable person — it is a generic friendly cartoon avatar with simplified, smooth, rounded cartoon features (no realistic skin pores, no photorealism).`,
    `STRICT: do NOT render any text, letters, words, numbers, symbols, watermark, logo, signature, caption, label, badge, name tag, or any typography of any kind anywhere in the image. The image must contain ZERO characters or glyphs.`,
  );

  return lines.join(" ");
}

// PUT raw bytes to the presigned URL returned by the sidecar.
/**
 * AI 아바타 생성이 이 배포에서 쓸 수 있는 상태인가.
 *
 * 이 기능은 **두 가지 Replit 전용 설비**에 얹혀 있다.
 *   ① 이미지 생성 — `AI_INTEGRATIONS_GEMINI_*` (Replit 이 붙여주던 Gemini 프록시)
 *   ② 저장 — `lib/objectStorage.ts` 의 사이드카(`127.0.0.1:1106`)
 * Replit 을 떠난 뒤로 둘 다 없다. 즉 이 라우트는 **어차피 성공할 수 없다.**
 *
 * 그런데 실패 문구가 `Image generation failed` 한 줄이라, 운영진 입장에서는
 * 일시 장애인지 아예 안 되는 건지 알 수 없었다. 설정이 없는 것은 장애가 아니라
 * 상태이므로 502(상류 실패)가 아니라 503 으로, 우리 말로 알린다.
 */
function avatarUnavailableReason(): string | null {
  const missing: string[] = [];
  if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) missing.push("이미지 생성 API");
  if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) missing.push("이미지 생성 키");
  if (missing.length === 0) return null;
  return `AI 아바타 생성이 이 서버에 설정돼 있지 않습니다 (${missing.join(", ")}). 프로필 사진은 '사진 URL' 칸에 주소를 직접 넣어 설정할 수 있습니다.`;
}

async function uploadPng(signedUrl: string, bytes: Buffer): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.byteLength),
    },
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
    const parsed = GenerateBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid options", issues: parsed.error.issues });
      return;
    }
    const opts = parsed.data;

    // Validate reference image if provided.
    const referenceImages: ReferenceImage[] = [];
    if (opts.referenceImage) {
      if (!ALLOWED_REF_MIME.has(opts.referenceImage.mimeType)) {
        res.status(400).json({
          error: "Unsupported reference image type (use JPEG, PNG, or WebP)",
        });
        return;
      }
      let refBytes: Buffer;
      try {
        refBytes = Buffer.from(opts.referenceImage.base64, "base64");
      } catch {
        res.status(400).json({ error: "Reference image is not valid base64" });
        return;
      }
      if (refBytes.byteLength === 0 || refBytes.byteLength > MAX_REF_BYTES) {
        res.status(400).json({
          error: `Reference image must be 1 byte – ${MAX_REF_BYTES} bytes`,
        });
        return;
      }
      referenceImages.push({
        base64: opts.referenceImage.base64,
        mimeType: opts.referenceImage.mimeType,
      });
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

    const unavailable = avatarUnavailableReason();
    if (unavailable) {
      res.status(503).json({ error: unavailable });
      return;
    }

    let b64: string;
    try {
      const result = await generateImage(
        buildPrompt(profile, opts, referenceImages.length > 0),
        referenceImages,
      );
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
