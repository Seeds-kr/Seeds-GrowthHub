import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { LinkableType } from "./_linkable";

/**
 * Only sensitive changes are recorded — this is not a request log.
 * See docs/design/04 §3.1 for the write sites.
 */
export const AUDIT_ACTIONS = [
  "role_change",
  "visibility_change",
  "finance_status",
  "decision_change",
  "permission_denied",
  "data_export",
  "account_activation",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Append-only audit trail for sensitive mutations (docs/design/04 §3).
 *
 * HARD RULES:
 *  - No UPDATE/DELETE API. Same treatment as `decision_logs`, which stays a
 *    separate recruitment-domain log rather than being absorbed here.
 *  - `beforeJson`/`afterJson` hold ONLY THE CHANGED FIELDS. Never whole rows,
 *    and never free-text bodies — feedback, reflections, meeting notes and
 *    document content must not leak into the audit trail.
 *  - `reflections` are not auditable at all (ADR-001).
 *  - IP is stored hashed, never raw.
 *
 * Read access: `system` ops role + `program_lead` only.
 */
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull().$type<AuditAction>(),
    actorId: integer("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /** Denormalised so the trail stays readable after an account is removed. */
    actorLabel: text("actor_label"),
    targetType: text("target_type").$type<LinkableType>(),
    targetId: integer("target_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    note: text("note"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byAction: index("audit_logs_action_idx").on(t.action, t.createdAt),
    byTarget: index("audit_logs_target_idx").on(t.targetType, t.targetId),
    byActor: index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
  }),
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
