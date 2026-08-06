import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  financeRecordsTable,
  FINANCE_RECORD_TYPES,
  FINANCE_RECORD_STATUSES,
  usersTable,
  type FinanceRecordStatus,
} from "@workspace/db";
import { alias } from "drizzle-orm/pg-core";
import { requireOpsRole } from "../lib/auth";
import { audit } from "../lib/audit";

// ADR-002: finance 담당 운영진 + program_lead 만 접근.
const requireFinance = requireOpsRole("finance");

const router: IRouter = Router();

/**
 * Polymorphic linked-object types accepted by finance records.
 * Whitelisted to avoid arbitrary strings. References are NOT enforced as
 * FKs — UI tolerates missing/archived targets.
 */
const LINKED_OBJECT_TYPES = [
  "session",
  "cohort",
  "project",
  "document",
] as const;

const AmountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((s) => /^-?\d+(\.\d{1,2})?$/.test(s), {
    message: "amount must be a number with up to 2 decimal places",
  })
  .refine((s) => {
    const n = Number(s);
    return Number.isFinite(n) && Math.abs(n) < 1e12;
  }, { message: "amount out of range" });

const CreateFinance = z.object({
  recordType: z.enum(FINANCE_RECORD_TYPES).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).optional(),
  category: z.string().trim().max(80).optional(),
  amount: AmountSchema,
  currency: z.string().trim().min(3).max(8).optional(),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "occurredOn must be YYYY-MM-DD"),
  status: z.enum(FINANCE_RECORD_STATUSES).optional(),
  requesterId: z.number().int().positive().nullable().optional(),
  approverId: z.number().int().positive().nullable().optional(),
  receiptUrl: z
    .string()
    .trim()
    .max(2000)
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  linkedObjectType: z.enum(LINKED_OBJECT_TYPES).nullable().optional(),
  linkedObjectId: z.number().int().positive().nullable().optional(),
});

function serialize(t: typeof financeRecordsTable.$inferSelect) {
  return {
    ...t,
    amount: t.amount, // numeric → string by drizzle; keep as string for precision
    approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
    paidAt: t.paidAt ? t.paidAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function assertUserExists(
  id: number | null | undefined,
  label: string,
  res: import("express").Response,
): Promise<boolean> {
  if (!id) return true;
  const [u] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (!u) {
    res.status(400).json({ error: `${label} not found` });
    return false;
  }
  return true;
}

router.get("/admin/finance-records", requireFinance, async (req, res) => {
  const statusQ =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const typeQ =
    typeof req.query.recordType === "string" ? req.query.recordType : undefined;
  const linkedTypeQ =
    typeof req.query.linkedObjectType === "string"
      ? req.query.linkedObjectType
      : undefined;
  const linkedIdRaw = req.query.linkedObjectId;
  const linkedId =
    typeof linkedIdRaw === "string" && linkedIdRaw !== ""
      ? Number(linkedIdRaw)
      : undefined;

  const conditions = [];
  if (
    statusQ &&
    (FINANCE_RECORD_STATUSES as readonly string[]).includes(statusQ)
  ) {
    conditions.push(
      eq(financeRecordsTable.status, statusQ as FinanceRecordStatus),
    );
  }
  if (
    typeQ &&
    (FINANCE_RECORD_TYPES as readonly string[]).includes(typeQ)
  ) {
    conditions.push(
      eq(
        financeRecordsTable.recordType,
        typeQ as (typeof FINANCE_RECORD_TYPES)[number],
      ),
    );
  }
  if (
    linkedTypeQ &&
    (LINKED_OBJECT_TYPES as readonly string[]).includes(linkedTypeQ)
  ) {
    conditions.push(eq(financeRecordsTable.linkedObjectType, linkedTypeQ));
  }
  if (linkedId && Number.isFinite(linkedId)) {
    conditions.push(eq(financeRecordsTable.linkedObjectId, linkedId));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const requester = alias(usersTable, "requester");
  const approver = alias(usersTable, "approver");
  const rows = await db
    .select({
      r: financeRecordsTable,
      requesterName: requester.name,
      requesterEmail: requester.email,
      approverName: approver.name,
      approverEmail: approver.email,
    })
    .from(financeRecordsTable)
    .leftJoin(requester, eq(requester.id, financeRecordsTable.requesterId))
    .leftJoin(approver, eq(approver.id, financeRecordsTable.approverId))
    .where(where)
    .orderBy(desc(financeRecordsTable.occurredOn), desc(financeRecordsTable.id));

  res.json({
    items: rows.map(
      ({ r, requesterName, requesterEmail, approverName, approverEmail }) => ({
        ...serialize(r),
        requesterName: requesterName ?? null,
        requesterEmail: requesterEmail ?? null,
        approverName: approverName ?? null,
        approverEmail: approverEmail ?? null,
      }),
    ),
    total: rows.length,
  });
});

/**
 * Dashboard summary for Ops Dashboard hookup.
 * Returns counts + sums per status bucket; admin-only.
 */
router.get("/admin/finance-records/summary", requireFinance, async (_req, res) => {
  const rows = await db
    .select({
      status: financeRecordsTable.status,
      recordType: financeRecordsTable.recordType,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${financeRecordsTable.amount}), 0)::text`,
    })
    .from(financeRecordsTable)
    .groupBy(financeRecordsTable.status, financeRecordsTable.recordType);

  // Aggregate hooks the dashboard cares about.
  const pendingReimbursements = rows
    .filter(
      (x) =>
        x.recordType === "reimbursement" &&
        (x.status === "requested" || x.status === "under_review"),
    )
    .reduce((acc, x) => acc + x.count, 0);
  const awaitingApproval = rows
    .filter((x) => x.status === "requested" || x.status === "under_review")
    .reduce((acc, x) => acc + x.count, 0);
  const approvedUnpaid = rows
    .filter((x) => x.status === "approved")
    .reduce((acc, x) => acc + x.count, 0);

  res.json({
    breakdown: rows,
    hooks: {
      pendingReimbursements,
      awaitingApproval,
      approvedUnpaid,
    },
  });
});

router.get("/admin/finance-records/:id", requireFinance, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const requester = alias(usersTable, "requester");
  const approver = alias(usersTable, "approver");
  const [row] = await db
    .select({
      r: financeRecordsTable,
      requesterName: requester.name,
      requesterEmail: requester.email,
      approverName: approver.name,
      approverEmail: approver.email,
    })
    .from(financeRecordsTable)
    .leftJoin(requester, eq(requester.id, financeRecordsTable.requesterId))
    .leftJoin(approver, eq(approver.id, financeRecordsTable.approverId))
    .where(eq(financeRecordsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...serialize(row.r),
    requesterName: row.requesterName ?? null,
    requesterEmail: row.requesterEmail ?? null,
    approverName: row.approverName ?? null,
    approverEmail: row.approverEmail ?? null,
  });
});

router.post("/admin/finance-records", requireFinance, async (req, res) => {
  const parsed = CreateFinance.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  if (!(await assertUserExists(d.requesterId, "Requester", res))) return;
  if (!(await assertUserExists(d.approverId, "Approver", res))) return;

  const [row] = await db
    .insert(financeRecordsTable)
    .values({
      recordType: d.recordType ?? "expense",
      title: d.title,
      description: d.description ?? "",
      category: d.category ?? "",
      amount: d.amount,
      currency: d.currency ?? "KRW",
      occurredOn: d.occurredOn,
      status: d.status ?? "draft",
      requesterId: d.requesterId ?? null,
      approverId: d.approverId ?? null,
      receiptUrl: d.receiptUrl ?? null,
      linkedObjectType: d.linkedObjectType ?? null,
      linkedObjectId: d.linkedObjectId ?? null,
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/admin/finance-records/:id", requireFinance, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateFinance.partial().safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  if (!(await assertUserExists(d.requesterId, "Requester", res))) return;
  if (!(await assertUserExists(d.approverId, "Approver", res))) return;

  // Auto-stamp approvedAt / paidAt when transitioning into those states.
  const [existing] = await db
    .select()
    .from(financeRecordsTable)
    .where(eq(financeRecordsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(d)) updates[k] = v;

  if (d.status && d.status !== existing.status) {
    if (d.status === "approved" && !existing.approvedAt) {
      updates.approvedAt = new Date();
      if (!d.approverId && !existing.approverId) {
        updates.approverId = req.sessionUser!.id;
      }
    }
    if (d.status === "paid" && !existing.paidAt) {
      updates.paidAt = new Date();
    }
  }

  const [row] = await db
    .update(financeRecordsTable)
    .set(updates)
    .where(eq(financeRecordsTable.id, id))
    .returning();

  // Status transitions only — amount/description edits are not audit-worthy
  // and `receiptUrl` is on the audit denylist anyway.
  if (d.status && d.status !== existing.status) {
    audit({
      action: "finance_status",
      req,
      targetType: "finance_record",
      targetId: id,
      before: { status: existing.status },
      after: { status: row.status },
    });
  }

  res.json(serialize(row));
});

/**
 * No hard delete — finance records are preserved for audit even when
 * canceled or rejected. Use PATCH `status: canceled` instead. We still
 * expose a soft "cancel" alias for clarity.
 */
router.post(
  "/admin/finance-records/:id/cancel",
  requireFinance,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .update(financeRecordsTable)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(financeRecordsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serialize(row));
  },
);

export default router;
