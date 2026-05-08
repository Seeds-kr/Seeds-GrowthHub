import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const FEEDBACK_TARGETS = [
  "student",
  "project",
  "assignment_submission",
  "activity_record",
  "session",
] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];

export const FEEDBACK_TYPES = [
  "general",
  "strength",
  "improvement",
  "review",
  "mentor_note",
  "admin_note",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_VISIBILITIES = [
  "student_visible",
  "admin_only",
] as const;
export type FeedbackVisibility = (typeof FEEDBACK_VISIBILITIES)[number];

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull().$type<FeedbackTarget>(),
  targetId: integer("target_id").notNull(),
  // For project/assignment/etc. targets, recording which student the feedback
  // is about (if applicable) makes student-side filtering correct without
  // needing JOIN-aware visibility logic per target.
  studentId: integer("student_id").references(() => studentsTable.id, {
    onDelete: "set null",
  }),
  authorId: integer("author_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  feedbackType: text("feedback_type")
    .notNull()
    .default("general")
    .$type<FeedbackType>(),
  content: text("content").notNull(),
  visibility: text("visibility")
    .notNull()
    .default("admin_only")
    .$type<FeedbackVisibility>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = typeof feedbackTable.$inferInsert;
