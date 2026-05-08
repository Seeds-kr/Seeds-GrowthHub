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
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const SESSION_TYPES = [
  "orientation",
  "workshop",
  "mentoring",
  "project_work",
  "presentation",
  "review",
  "other",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohortsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => programsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  locationOrLink: text("location_or_link"),
  sessionType: text("session_type")
    .notNull()
    .default("workshop")
    .$type<SessionType>(),
  status: text("status").notNull().default("scheduled").$type<SessionStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type SessionRecord = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "excused",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const attendanceRecordsTable = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().$type<AttendanceStatus>(),
    note: text("note"),
    markedBy: integer("marked_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    markedAt: timestamp("marked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("attendance_unique").on(t.sessionId, t.studentId),
  }),
);
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
export type InsertAttendanceRecord =
  typeof attendanceRecordsTable.$inferInsert;
