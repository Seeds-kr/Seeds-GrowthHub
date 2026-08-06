import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  auditLogsTable,
  AUDIT_ACTIONS,
  type AuditAction,
} from "@workspace/db";
import { requireOpsRole } from "../lib/auth";

const router: IRouter = Router();

// Restricted read (visibility-policy §5): `system` ops role + program_lead.
const requireSystem = requireOpsRole("system");

/**
 * Read-only. There is intentionally NO POST/PATCH/DELETE — the trail is
 * append-only and written exclusively by lib/audit.ts at the mutation sites.
 */
router.get("/admin/audit-logs", requireSystem, async (req, res) => {
  const action =
    typeof req.query.action === "string" &&
    (AUDIT_ACTIONS as readonly string[]).includes(req.query.action)
      ? (req.query.action as AuditAction)
      : undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const where = action ? eq(auditLogsTable.action, action) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .where(where),
  ]);

  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
});

/** Counts per action for the last 30 days — drives the filter chips. */
router.get("/admin/audit-logs/summary", requireSystem, async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({
      action: auditLogsTable.action,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogsTable)
    .where(and(sql`${auditLogsTable.createdAt} >= ${since}`))
    .groupBy(auditLogsTable.action);
  res.json({ since: since.toISOString(), breakdown: rows });
});

export default router;
