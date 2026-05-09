import crypto from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import {
  db,
  accountActivationTokensTable,
  usersTable,
  type User,
} from "@workspace/db";

export const ACTIVATION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a new activation token for the given user.
 * Invalidates any previous unused tokens for the same user (single-use, latest-wins).
 * Returns the plaintext token (only available at issue time) plus expiry.
 */
export async function issueActivationToken(params: {
  userId: number;
  createdBy: number | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
  await db.transaction(async (tx) => {
    // Mark any previous unused tokens as used so only the latest works.
    await tx
      .update(accountActivationTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(accountActivationTokensTable.userId, params.userId),
          isNull(accountActivationTokensTable.usedAt),
        ),
      );
    await tx.insert(accountActivationTokensTable).values({
      userId: params.userId,
      tokenHash,
      expiresAt,
      createdBy: params.createdBy,
    });
  });
  return { token, expiresAt };
}

export type ResolvedActivation = {
  status: "ok" | "not_found" | "expired" | "used";
  user?: User;
  tokenRowId?: number;
  expiresAt?: Date;
};

/**
 * Look up a plaintext token, return the associated user + token state.
 * Does NOT consume the token.
 */
export async function resolveActivationToken(
  token: string,
): Promise<ResolvedActivation> {
  if (!token || token.length < 16) return { status: "not_found" };
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(accountActivationTokensTable)
    .where(eq(accountActivationTokensTable.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { status: "not_found" };
  if (row.usedAt) return { status: "used" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);
  if (!user) return { status: "not_found" };
  return {
    status: "ok",
    user,
    tokenRowId: row.id,
    expiresAt: row.expiresAt,
  };
}

/**
 * Atomic consume: mark a token row used iff still unused and unexpired.
 * Returns true if this call won the race.
 */
export async function consumeActivationToken(
  tokenRowId: number,
): Promise<boolean> {
  const updated = await db
    .update(accountActivationTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(accountActivationTokensTable.id, tokenRowId),
        isNull(accountActivationTokensTable.usedAt),
        gt(accountActivationTokensTable.expiresAt, new Date()),
      ),
    )
    .returning({ id: accountActivationTokensTable.id });
  return updated.length > 0;
}
