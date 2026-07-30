import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { cohortsTable } from "./cohorts";
import { programsTable } from "./programs";
import { studentsTable } from "./students";

export const STUDY_STATUSES = [
  "planned",
  "active",
  "completed",
  "archived",
] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

/**
 * Student-led study groups (docs/design/03 §4). A deliberate clone of the
 * `projects` shape — no new concepts.
 *
 * NO visibility column: a study is open within its cohort. There is no reason
 * to hide voluntary learning from peers, and adding a fourth visibility enum
 * would violate visibility-policy §1 (원칙 2). Materials and outputs attach as
 * `artifacts`, which carry their own 4-level visibility.
 */
export const studiesTable = pgTable(
  "studies",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    programId: integer("program_id").references(() => programsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    topic: text("topic"),
    description: text("description"),
    /** Study lead — a student, mirroring project_members semantics. */
    leaderStudentId: integer("leader_student_id").references(
      () => studentsTable.id,
      { onDelete: "set null" },
    ),
    /**
     * Weekly plan is ONE markdown field, not a table. Growth v3 §8.3 deferred
     * per-week progress tracking, so there is nothing to structure yet.
     */
    weeklyPlanMd: text("weekly_plan_md").notNull().default(""),
    status: text("status").notNull().default("planned").$type<StudyStatus>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byCohort: index("studies_cohort_idx").on(t.cohortId, t.status),
  }),
);

export type Study = typeof studiesTable.$inferSelect;
export type InsertStudy = typeof studiesTable.$inferInsert;

export const studyMembersTable = pgTable(
  "study_members",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studiesTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    role: text("role"),
    participationNote: text("participation_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("study_members_unique").on(t.studyId, t.studentId),
  }),
);

export type StudyMember = typeof studyMembersTable.$inferSelect;
export type InsertStudyMember = typeof studyMembersTable.$inferInsert;
