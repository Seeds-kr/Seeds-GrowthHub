import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

export const COHORT_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export const cohortsTable = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("draft").$type<CohortStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Cohort = typeof cohortsTable.$inferSelect;
export type InsertCohort = typeof cohortsTable.$inferInsert;
