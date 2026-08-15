import { createHash, randomUUID } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, stat, unlink } from "fs/promises";
import path from "path";
import type { Readable } from "stream";
import { pipeline } from "stream/promises";

/**
 * 본문 이미지 저장소 — 서버 디스크.
 *
 * 파일을 두 종류로 나눈다(설계 06 ADR-010).
 *
 *   자료 파일(기획서·발표자료·영상)  구글 드라이브. GrowthHub 는 주소만 든다.
 *   **본문 이미지**(회의록 스크린샷)  여기.
 *
 * 왜 본문 이미지만 안으로 들이나: 마크다운 `![](주소)` 가 그림으로 뜨려면 그
 * 주소가 **이미지 바이트 자체**를 돌려줘야 한다. 드라이브 공유 링크는 미리보기
 * HTML 을 돌려주므로 본문에 박히지 않는다. 두 용도는 다른 것이다.
 *
 * DB(bytea)가 아니라 디스크인 이유: 백업이 `pg_dump | gzip` 한 덩어리다. 지금
 * 29KB 인 그 파일에 스크린샷이 들어가면 매일 수십 MB 씩 쌓이고 복구도 느려진다.
 * 디렉터리는 백업 스크립트에 한 줄 더하면 된다.
 *
 * 경로는 **우리가 만든다.** 업로드한 파일 이름을 경로에 쓰지 않는다 —
 * `../../etc/passwd` 같은 이름이 그대로 경로가 되면 디렉터리를 벗어난다.
 * 원래 이름은 DB 의 `fileName` 에만 남고, 디스크에는 UUID 로 저장한다.
 */

/** 업로드 루트. 없으면 프리뷰 기본값(백업 스크립트가 같은 경로를 뜬다). */
const ROOT =
  process.env.UPLOAD_DIR?.trim() || "/home/harvester/seeds-preview/uploads";

/** 본문 이미지만 받는다. 임의 파일 보관소가 되면 백업·보안 부담이 달라진다. */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** 스크린샷 한 장에 넉넉하고, 디스크가 새지 않을 만큼. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedImageType(mime: string | null | undefined): boolean {
  return (
    typeof mime === "string" &&
    (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime.toLowerCase())
  );
}

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/** 저장 경로는 `YYYY/MM/uuid.ext`. 한 폴더에 수천 개가 쌓이지 않게 월별로 나눈다. */
function newRelPath(mime: string): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(yyyy, mm, `${randomUUID()}${EXT[mime] ?? ".bin"}`);
}

/** 루트 밖으로 나가는 경로를 막는다. DB 값이 손상돼도 여기서 걸린다. */
export function resolveInsideRoot(relPath: string): string {
  const abs = path.resolve(ROOT, relPath);
  const root = path.resolve(ROOT);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("업로드 루트를 벗어난 경로입니다.");
  }
  return abs;
}

export type StoredFile = {
  /** DB 에 저장할 상대 경로. 루트가 바뀌어도 그대로 쓴다. */
  relPath: string;
  sizeBytes: number;
  /** 같은 파일이 여러 번 올라왔는지 나중에 판단할 수 있게 남긴다. */
  sha256: string;
};

/**
 * 스트림을 디스크에 쓴다. 한도를 넘으면 **쓰다가 끊고 지운다** — 다 받은 뒤에
 * 크기를 재면 그 사이 디스크가 이미 찬다.
 */
export async function storeImage(
  input: Readable,
  mimeType: string,
): Promise<StoredFile> {
  if (!isAllowedImageType(mimeType)) {
    throw new Error("이미지 파일만 올릴 수 있습니다.");
  }
  const relPath = newRelPath(mimeType.toLowerCase());
  const abs = resolveInsideRoot(relPath);
  await mkdir(path.dirname(abs), { recursive: true });

  const hash = createHash("sha256");
  let size = 0;
  let tooBig = false;

  input.on("data", (chunk: Buffer) => {
    size += chunk.length;
    hash.update(chunk);
    if (size > MAX_IMAGE_BYTES && !tooBig) {
      tooBig = true;
      input.destroy(new Error("TOO_BIG"));
    }
  });

  try {
    await pipeline(input, createWriteStream(abs));
  } catch (err) {
    await unlink(abs).catch(() => {});
    if (tooBig || (err as Error)?.message === "TOO_BIG") {
      throw new Error(
        `파일이 너무 큽니다. ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
      );
    }
    throw err;
  }

  return { relPath, sizeBytes: size, sha256: hash.digest("hex") };
}

/** 읽기용 스트림. 파일이 없으면 null — 라우트가 404 로 바꾼다. */
export async function openStored(
  relPath: string,
): Promise<{ stream: Readable; sizeBytes: number } | null> {
  let abs: string;
  try {
    abs = resolveInsideRoot(relPath);
  } catch {
    return null;
  }
  try {
    const s = await stat(abs);
    if (!s.isFile()) return null;
    return { stream: createReadStream(abs), sizeBytes: s.size };
  } catch {
    return null;
  }
}

export async function deleteStored(relPath: string): Promise<void> {
  try {
    await unlink(resolveInsideRoot(relPath));
  } catch {
    // 이미 없으면 지워진 것과 같다. 삭제는 멱등이어야 한다.
  }
}

export function uploadRoot(): string {
  return path.resolve(ROOT);
}
