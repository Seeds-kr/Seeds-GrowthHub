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

export const PROJECT_STATUSES = [
  "ideation",
  "in_progress",
  "submitted",
  "presented",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohortsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => programsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  problemStatement: text("problem_statement"),
  solutionSummary: text("solution_summary"),
  status: text("status")
    .notNull()
    .default("ideation")
    .$type<ProjectStatus>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;

export const projectMembersTable = pgTable(
  "project_members",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    role: text("role"),
    contributionSummary: text("contribution_summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("project_members_unique").on(t.projectId, t.studentId),
  }),
);
export type ProjectMember = typeof projectMembersTable.$inferSelect;
export type InsertProjectMember = typeof projectMembersTable.$inferInsert;
