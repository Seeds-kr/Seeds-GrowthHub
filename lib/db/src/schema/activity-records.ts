import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { cohortsTable } from "./cohorts";
import { programsTable } from "./programs";
import { usersTable } from "./users";

export const ACTIVITY_SOURCES = [
  "session",
  "assignment",
  "project",
  "feedback",
  "manual",
] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const ACTIVITY_VISIBILITIES = [
  "private",
  "student_visible",
  "admin_only",
] as const;
export type ActivityVisibility = (typeof ACTIVITY_VISIBILITIES)[number];

export const activityRecordsTable = pgTable("activity_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohortsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => programsTable.id, {
    onDelete: "set null",
  }),
  sourceType: text("source_type").notNull().$type<ActivitySource>(),
  sourceId: integer("source_id"),
  title: text("title").notNull(),
  description: text("description"),
  activityDate: timestamp("activity_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  visibility: text("visibility")
    .notNull()
    .default("admin_only")
    .$type<ActivityVisibility>(),
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type ActivityRecord = typeof activityRecordsTable.$inferSelect;
export type InsertActivityRecord = typeof activityRecordsTable.$inferInsert;
