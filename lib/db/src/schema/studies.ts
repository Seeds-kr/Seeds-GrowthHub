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
import { usersTable } from "./users";

/**
 * `proposed` / `rejected` are the student-request lane (design 06 §10).
 *
 * A status rather than a `study_requests` table: an approved request IS the
 * study — the title, topic and plan the student wrote are the ones the study
 * runs with. A separate table would mean copying those across on approval and
 * then keeping two rows in step, which is the shape `applications` already
 * regrets (gap-register §4, "이중 상태").
 *
 * ⚠️ `proposed` and `rejected` are NOT cohort-open. Everything else here is
 * visible to the whole cohort; a proposal under review is not the cohort's
 * business, and a rejection is the proposer's alone. See the split in
 * `/student/studies`.
 */
export const STUDY_STATUSES = [
  "proposed",
  "rejected",
  "planned",
  "active",
  "completed",
  "archived",
] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

/** Statuses the whole cohort may browse. */
export const STUDY_PUBLIC_STATUSES = [
  "planned",
  "active",
  "completed",
  "archived",
] as const;

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
    /**
     * Why a proposal was approved or turned down, written by the reviewer.
     *
     * Load-bearing for the rejection case: "안 됩니다"로 끝나면 학생은 무엇을
     * 고쳐 다시 내야 할지 모르고, 대개 다시 내지 않는다. 반려는 종료가 아니라
     * 되돌려 보내는 것이므로 이유가 함께 가야 한다.
     */
    reviewNote: text("review_note"),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
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
