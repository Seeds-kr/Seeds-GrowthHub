import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Finance / Reimbursement records for GrowthHub Ops.
 *
 * Lightweight — NOT a full accounting ledger. Tracks club-level income,
 * expenses, and reimbursement requests with a simple approval flow.
 *
 * Status flow (no enforced state machine — UI guides transitions):
 *   draft → requested → under_review → approved → paid
 *                                              ↘ rejected
 *                                              ↘ canceled
 *
 * Sensitive: gated `requireAdmin` only. Students MUST NOT see this.
 * Receipt files (if any) go through admin-only storage; this table stores
 * only an opaque `receiptUrl` (object-storage path or external URL).
 *
 * Linked object is polymorphic (same convention as ops_tasks / meetings):
 * `linkedObjectType` ∈ {session, cohort, project, document, ...} +
 * `linkedObjectId`. References are NOT enforced as FKs — UI must tolerate
 * the linked object being missing/archived.
 */
export const FINANCE_RECORD_TYPES = [
  "income",
  "expense",
  "reimbursement",
] as const;
export type FinanceRecordType = (typeof FINANCE_RECORD_TYPES)[number];

export const FINANCE_RECORD_STATUSES = [
  "draft",
  "requested",
  "under_review",
  "approved",
  "paid",
  "rejected",
  "canceled",
] as const;
export type FinanceRecordStatus = (typeof FINANCE_RECORD_STATUSES)[number];

export const financeRecordsTable = pgTable(
  "finance_records",
  {
    id: serial("id").primaryKey(),
    recordType: text("record_type")
      .notNull()
      .default("expense")
      .$type<FinanceRecordType>(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    /** numeric(14,2): supports up to ~999,999,999,999.99. Stored as string by drizzle. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    /** ISO 4217 currency code; defaults to KRW for the Korean club. */
    currency: text("currency").notNull().default("KRW"),
    occurredOn: date("occurred_on").notNull(),
    status: text("status")
      .notNull()
      .default("draft")
      .$type<FinanceRecordStatus>(),
    requesterId: integer("requester_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approverId: integer("approver_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Receipt link — either object-storage path or external URL. Nullable. */
    receiptUrl: text("receipt_url"),
    /** Polymorphic link to a related object (session/cohort/project/document). */
    linkedObjectType: text("linked_object_type"),
    linkedObjectId: integer("linked_object_id"),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byStatus: index("finance_records_status_idx").on(t.status),
    byType: index("finance_records_type_idx").on(t.recordType),
    byRequester: index("finance_records_requester_idx").on(t.requesterId),
    byOccurredOn: index("finance_records_occurred_on_idx").on(t.occurredOn),
  }),
);
export type FinanceRecord = typeof financeRecordsTable.$inferSelect;
export type InsertFinanceRecord = typeof financeRecordsTable.$inferInsert;
