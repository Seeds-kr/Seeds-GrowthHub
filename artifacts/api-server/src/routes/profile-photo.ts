import express, { Router, type IRouter, type RequestHandler } from "express";
import { Readable } from "stream";
import { and, eq } from "drizzle-orm";
import { db, peopleProfilesTable } from "@workspace/db";
import { requireAdmin, requireMentor, requireStudent } from "../lib/auth";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  deleteStored,
  isAllowedImageType,
  isPublicPath,
  openStored,
  storeImage,
} from "../lib/fileStore";

/**
 * 프로필 사진 — 본인이 올린다.
 *
 * 전에는 어드민이 AI 로 아바타를 생성했다. 그건 두 군데에 기대고 있었다 —
 * Replit 사이드카(저장)와 Gemini 프록시(생성). 둘 다 이 서버에 없어서 기능
 * 자체가 죽어 있었고, 살리려면 과금 계정과 공개 서빙 경로가 새로 필요했다.
 * 얼굴 사진은 어차피 본인 것이 맞으므로 **업로드**로 바꿨다(ADR-017).
 *
 * 사진을 내리면 우리 디스크에서는 지워지지만, 앞단 CDN 에 남은 사본은 캐시가
 * 만료될 때까지(아래 1시간) 주소를 아는 사람에게 열린다. 완전한 회수는 아니다.
 *
 * 사진은 **공개 영역**에 저장한다. `/people` 디렉터리가 비로그인 라우트라
 * 방문자 브라우저가 인증 없이 이미지를 받아야 하기 때문이다. 파일명이 UUID 라
 * 주소를 모르면 못 찾지만, 알려진 주소는 계속 열린다 — 공개 프로필에 맞다.
 * 회의록 본문 이미지는 반대로 권한을 확인한 뒤에만 내준다(attachments.ts).
 *
 * 누가 누구 사진을 바꾸나:
 *   학생·멘토  자기 것만. 프로필 행을 세션 사용자로 찾는다.
 *   어드민     아무나. `:id` 로 지정한다.
 */

const router: IRouter = Router();

/** DB 에 저장하고 화면이 `<img src>` 로 쓰는 주소. */
function publicUrlFor(relPath: string): string {
  return `/api/uploads/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}

/** 그 주소를 되돌린 상대 경로. 우리가 만든 것이 아니면 null(= 지우지 않는다). */
function relPathFromPublicUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url.startsWith("/api/uploads/")) return null;
  let rel: string;
  try {
    rel = decodeURIComponent(url.slice("/api/uploads/".length));
  } catch {
    return null;
  }
  return isPublicPath(rel) ? rel : null;
}

/**
 * 원시 바이트를 읽는다. `express.raw` 가 한도를 넘기면 기본 핸들러가 HTML 을
 * 돌려주는데, API 소비자는 JSON 을 기대하므로 여기서 우리 말로 바꾼다.
 */
const readImageBytes: RequestHandler = (req, res, next) => {
  express.raw({ type: "image/*", limit: MAX_IMAGE_BYTES + 1024 })(
    req,
    res,
    (err?: unknown) => {
      if (!err) return next();
      const code = (err as { status?: number }).status ?? 400;
      if (code === 413) {
        res.status(413).json({
          error: `사진이 너무 큽니다. ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
        });
        return;
      }
      res.status(400).json({ error: "업로드를 읽지 못했습니다." });
    },
  );
};

type ProfileRow = typeof peopleProfilesTable.$inferSelect;

/**
 * 사진을 바꾼다. 새 파일을 저장한 뒤 **이전 파일을 지운다** — 사람이 사진을
 * 여러 번 바꾸면 안 지우는 쪽은 계속 쌓이기만 한다. 지우기는 DB 를 고친 뒤에
 * 한다. 순서가 반대면 DB 갱신이 실패했을 때 화면은 없는 파일을 가리킨다.
 */
async function replacePhoto(
  profile: ProfileRow,
  body: Buffer,
  mime: string,
): Promise<ProfileRow> {
  const stored = await storeImage(Readable.from(body), mime, { public: true });
  const [row] = await db
    .update(peopleProfilesTable)
    .set({ photoUrl: publicUrlFor(stored.relPath), updatedAt: new Date() })
    .where(eq(peopleProfilesTable.id, profile.id))
    .returning();

  const old = relPathFromPublicUrl(profile.photoUrl);
  if (old && old !== stored.relPath) await deleteStored(old);
  return row;
}

/** 사진을 뗀다. 주소를 비우고 우리가 보관하던 파일도 지운다. */
async function clearPhoto(profile: ProfileRow): Promise<ProfileRow> {
  const [row] = await db
    .update(peopleProfilesTable)
    .set({ photoUrl: null, updatedAt: new Date() })
    .where(eq(peopleProfilesTable.id, profile.id))
    .returning();
  const old = relPathFromPublicUrl(profile.photoUrl);
  if (old) await deleteStored(old);
  return row;
}

/** 업로드 본문 검사. 통과하면 버퍼, 아니면 응답을 이미 보낸 뒤 null. */
function takeImage(req: express.Request, res: express.Response): Buffer | null {
  const mime = (req.header("content-type") || "").split(";")[0].trim();
  if (!isAllowedImageType(mime)) {
    res.status(415).json({
      error: `이미지 파일만 올릴 수 있습니다 (${ALLOWED_IMAGE_TYPES.join(", ")}).`,
    });
    return null;
  }
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "빈 파일입니다." });
    return null;
  }
  if (body.length > MAX_IMAGE_BYTES) {
    res.status(413).json({
      error: `사진이 너무 큽니다. ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
    });
    return null;
  }
  return body;
}

function mimeOf(req: express.Request): string {
  return (req.header("content-type") || "").split(";")[0].trim().toLowerCase();
}

/** 내 프로필 행. 학생은 없으면 만들지 않는다 — 사진만 올릴 수는 없다. */
async function myProfile(
  userId: number,
  kind: "member" | "mentor",
): Promise<ProfileRow | null> {
  const [row] = await db
    .select()
    .from(peopleProfilesTable)
    .where(
      and(
        eq(peopleProfilesTable.userId, userId),
        eq(peopleProfilesTable.kind, kind),
      ),
    )
    .limit(1);
  return row ?? null;
}

function selfRoutes(prefix: string, kind: "member" | "mentor", guard: RequestHandler) {
  router.post(`${prefix}/photo`, guard, readImageBytes, async (req, res) => {
    const profile = await myProfile(req.sessionUser!.id, kind);
    if (!profile) {
      res.status(404).json({ error: "프로필이 없습니다." });
      return;
    }
    const body = takeImage(req, res);
    if (!body) return;
    try {
      res.json(await replacePhoto(profile, body, mimeOf(req)));
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.delete(`${prefix}/photo`, guard, async (req, res) => {
    const profile = await myProfile(req.sessionUser!.id, kind);
    if (!profile) {
      res.status(404).json({ error: "프로필이 없습니다." });
      return;
    }
    res.json(await clearPhoto(profile));
  });
}

selfRoutes("/student/profile", "member", requireStudent);
selfRoutes("/mentor/profile", "mentor", requireMentor);

router.post(
  "/admin/people/:id/photo",
  requireAdmin,
  readImageBytes,
  async (req, res) => {
    const id = Number(req.params.id);
    const [profile] = await db
      .select()
      .from(peopleProfilesTable)
      .where(eq(peopleProfilesTable.id, id))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "프로필을 찾을 수 없습니다." });
      return;
    }
    const body = takeImage(req, res);
    if (!body) return;
    try {
      // 감사 로그는 남기지 않는다. `AUDIT_ACTIONS` 는 권한·금액·공개범위처럼
      // 되돌리기 어려운 변경만 받는 닫힌 집합이고, 프로필 사진 교체는 거기
      // 해당하지 않는다(설계 04 §3). 넣으려면 열거형부터 넓혀야 한다.
      res.json(await replacePhoto(profile, body, mimeOf(req)));
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

router.delete("/admin/people/:id/photo", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [profile] = await db
    .select()
    .from(peopleProfilesTable)
    .where(eq(peopleProfilesTable.id, id))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "프로필을 찾을 수 없습니다." });
    return;
  }
  res.json(await clearPhoto(profile));
});

/**
 * 공개 서빙 — **인증이 없다.**
 *
 * `/people` 이 공개 라우트라 방문자 브라우저가 그냥 받아야 한다. 대신 내주는
 * 범위를 `public/` 아래로 못박는다. `isPublicPath` 가 `path.normalize` 로
 * 판정하므로 `public/../2026/…` 같은 우회는 정규화 단계에서 접두어를 잃고
 * 걸린다. 그 아래에는 프로필 사진만 들어간다.
 *
 * 파일명이 UUID 라 내용이 바뀌면 주소도 바뀐다. 그래서 오래 캐시해도 낡은
 * 사진이 남지 않는다.
 */
router.get(/^\/uploads\/(.+)$/, async (req, res) => {
  let rel: string;
  try {
    rel = decodeURIComponent(String((req.params as unknown as string[])[0] ?? ""));
  } catch {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isPublicPath(rel)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const file = await openStored(rel);
  if (!file) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
  const type =
    ext === ".png" ? "image/png"
    : ext === ".gif" ? "image/gif"
    : ext === ".webp" ? "image/webp"
    : "image/jpeg";
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(file.sizeBytes));
  // 1년 `immutable` 이 내용상으로는 맞다 — UUID 주소의 바이트는 안 바뀐다.
  // 그런데도 1시간으로 두는 건 **내리기가 실제로 먹히게** 하기 위해서다.
  // 앞단이 Cloudflare 라 길게 잡으면 사진을 지워도 주소를 아는 사람에게는
  // 캐시 사본이 그만큼 계속 열린다. 사람 얼굴이므로 그 쪽이 더 중요하다.
  res.setHeader("Cache-Control", "public, max-age=3600");
  // 이미지로만 해석되게 못박는다. 업로드가 실제로는 다른 형식이어도 브라우저가
  // 알아서 HTML 로 읽고 실행하는 일이 없다.
  res.setHeader("X-Content-Type-Options", "nosniff");
  file.stream.on("error", () => res.destroy());
  file.stream.pipe(res);
});

export default router;
