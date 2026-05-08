import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { usersTable } from "./users";

export const FINAL_DECISIONS = [
  "pending",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
] as const;
export type FinalDecision = (typeof FINAL_DECISIONS)[number];

export const decisionLogsTable = pgTable("decision_logs", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),
  previousDecision: text("previous_decision").$type<FinalDecision>(),
  newDecision: text("new_decision").notNull().$type<FinalDecision>(),
  changedBy: integer("changed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DecisionLog = typeof decisionLogsTable.$inferSelect;
export type InsertDecisionLog = typeof decisionLogsTable.$inferInsert;
