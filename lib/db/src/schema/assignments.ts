import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cohortsTable } from "./cohorts";
import { programsTable } from "./programs";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const TASK_STATUSES = ["draft", "published", "closed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohortsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => programsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: text("status").notNull().default("draft").$type<TaskStatus>(),
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
export type Assignment = typeof assignmentsTable.$inferSelect;
export type InsertAssignment = typeof assignmentsTable.$inferInsert;

export const SUBMISSION_STATUSES = [
  "not_submitted",
  "submitted",
  "late",
  "reviewed",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const assignmentSubmissionsTable = pgTable(
  "assignment_submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignmentsTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    content: text("content"),
    fileUrl: text("file_url"),
    externalUrl: text("external_url"),
    status: text("status")
      .notNull()
      .default("submitted")
      .$type<SubmissionStatus>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    feedback: text("feedback"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("submissions_unique").on(t.assignmentId, t.studentId),
  }),
);
export type AssignmentSubmission =
  typeof assignmentSubmissionsTable.$inferSelect;
export type InsertAssignmentSubmission =
  typeof assignmentSubmissionsTable.$inferInsert;
