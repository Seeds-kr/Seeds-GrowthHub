import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { cohortsTable } from "./cohorts";

export const PROGRAM_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const programsTable = pgTable("programs", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohortsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft").$type<ProgramStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Program = typeof programsTable.$inferSelect;
export type InsertProgram = typeof programsTable.$inferInsert;
