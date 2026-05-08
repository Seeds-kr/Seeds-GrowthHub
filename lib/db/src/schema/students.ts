import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { applicationsTable } from "./applications";
import { cohortsTable } from "./cohorts";
import { programsTable } from "./programs";

export const studentsTable = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    applicationId: integer("application_id").references(
      () => applicationsTable.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    school: text("school"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUnique: uniqueIndex("students_user_unique").on(t.userId),
    appUnique: uniqueIndex("students_application_unique").on(t.applicationId),
  }),
);
export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = typeof studentsTable.$inferInsert;

export const studentCohortsTable = pgTable(
  "student_cohorts",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("student_cohorts_unique").on(t.studentId, t.cohortId),
  }),
);
export type StudentCohort = typeof studentCohortsTable.$inferSelect;
export type InsertStudentCohort = typeof studentCohortsTable.$inferInsert;

export const studentProgramsTable = pgTable(
  "student_programs",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    programId: integer("program_id")
      .notNull()
      .references(() => programsTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("student_programs_unique").on(t.studentId, t.programId),
  }),
);
export type StudentProgram = typeof studentProgramsTable.$inferSelect;
export type InsertStudentProgram = typeof studentProgramsTable.$inferInsert;
