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
import { EVALUATION_STAGES, type EvaluationStage } from "./evaluation-assignments";

export const RECOMMENDATIONS = [
  "strong_accept",
  "accept",
  "hold",
  "reject",
  "strong_reject",
] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export { EVALUATION_STAGES };

export const evaluationsTable = pgTable(
  "evaluations",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    evaluatorId: integer("evaluator_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().$type<EvaluationStage>(),
    motivationScore: integer("motivation_score"),
    problemAwarenessScore: integer("problem_awareness_score"),
    initiativeScore: integer("initiative_score"),
    collaborationScore: integer("collaboration_score"),
    fitScore: integer("fit_score"),
    overallScore: integer("overall_score").notNull(),
    recommendation: text("recommendation").notNull().$type<Recommendation>(),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueEvaluation: uniqueIndex("evaluations_unique").on(
      t.applicationId,
      t.evaluatorId,
      t.stage,
    ),
  }),
);

export type Evaluation = typeof evaluationsTable.$inferSelect;
export type InsertEvaluation = typeof evaluationsTable.$inferInsert;
