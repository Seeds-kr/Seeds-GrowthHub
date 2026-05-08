import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { usersTable } from "./users";

export const EVALUATION_STAGES = ["document_review", "interview"] as const;
export type EvaluationStage = (typeof EVALUATION_STAGES)[number];

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const evaluationAssignmentsTable = pgTable(
  "evaluation_assignments",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    evaluatorId: integer("evaluator_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().$type<EvaluationStage>(),
    assignedBy: integer("assigned_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status")
      .notNull()
      .default("assigned")
      .$type<AssignmentStatus>(),
  },
  (t) => ({
    uniqueAssignment: uniqueIndex("eval_assignments_unique").on(
      t.applicationId,
      t.evaluatorId,
      t.stage,
    ),
  }),
);

export type EvaluationAssignment =
  typeof evaluationAssignmentsTable.$inferSelect;
export type InsertEvaluationAssignment =
  typeof evaluationAssignmentsTable.$inferInsert;
