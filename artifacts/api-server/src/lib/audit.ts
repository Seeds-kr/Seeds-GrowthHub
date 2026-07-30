import crypto from "node:crypto";
import type { Request } from "express";
import {
  db,
  auditLogsTable,
  type AuditAction,
  type LinkableType,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * Audit recording (docs/design/04 §3).
 *
 * Writes are best-effort: a failure here must never break the operation being
 * audited. Callers use `void recordAudit(...)` and ignore the result.
 */

/** Fields that must never reach the audit trail, whatever a caller passes. */
const FORBIDDEN_KEYS = new Set([
  "content",
  "contentMd",
  "bodyMd",
  "decisionsMd",
  "agendaMd",
  "notesMd",
  "pendingMd",
  "comment",
  "blocker",
  "nextFocus",
  "opsSupportNote",
  "description",
  "passwordHash",
  "password",
  "receiptUrl",
]);

/**
 * Reduce two snapshots to ONLY the keys that actually changed, dropping any
 * free-text field. Enforced here rather than trusted to call sites — the whole
 * point of the audit trail is that it cannot itself become a leak.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const prev = before[key];
    const next = after[key];
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    b[key] = prev ?? null;
    a[key] = next ?? null;
  }
  return { before: b, after: a };
}

function hashIp(req?: Request): string | null {
  const raw =
    (req?.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ??
    req?.socket?.remoteAddress;
  if (!raw) return null;
  // Salted with SESSION_SECRET so hashes are not comparable across installs.
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET ?? "seeds")
    .update(raw.trim())
    .digest("hex")
    .slice(0, 32);
}

export type AuditInput = {
  action: AuditAction;
  req?: Request;
  targetType?: LinkableType;
  targetId?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const actor = input.req?.sessionUser;
    await db.insert(auditLogsTable).values({
      action: input.action,
      actorId: actor?.id ?? null,
      actorLabel: actor ? `${actor.name} <${actor.email}>` : null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      beforeJson: input.before ?? null,
      afterJson: input.after ?? null,
      note: input.note ?? null,
      ipHash: hashIp(input.req),
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "failed to write audit log");
  }
}

/** Fire-and-forget wrapper for use inside route handlers. */
export function audit(input: AuditInput): void {
  void recordAudit(input);
}
