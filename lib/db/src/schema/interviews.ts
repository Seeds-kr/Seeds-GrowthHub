import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";

export const INTERVIEW_STATUSES = [
  "not_scheduled",
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const interviewsTable = pgTable(
  "interviews",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    locationOrLink: text("location_or_link"),
    interviewerNote: text("interviewer_note"),
    status: text("status")
      .notNull()
      .default("not_scheduled")
      .$type<InterviewStatus>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    oneInterviewPerApp: uniqueIndex("interviews_app_unique").on(
      t.applicationId,
    ),
  }),
);

export type Interview = typeof interviewsTable.$inferSelect;
export type InsertInterview = typeof interviewsTable.$inferInsert;
