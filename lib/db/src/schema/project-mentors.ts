import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const MENTOR_ASSIGNMENT_STATUSES = ["active", "ended"] as const;
export type MentorAssignmentStatus =
  (typeof MENTOR_ASSIGNMENT_STATUSES)[number];

/**
 * Mentor ↔ project assignment (ADR-003). N:N — a project may have co-mentors
 * and a mentor may carry several teams.
 *
 * Deliberately separate from `project_members`, which references `students`
 * and stays student-only. Mentors are accounts, so this references `users`.
 *
 * Assignments are ENDED, not deleted: the mentoring context (feedback written
 * during the assignment) must survive a handover. Access, however, is cut the
 * moment status flips to "ended" — see docs/design/02-mentor-workspace.md §2.2.
 */
export const projectMentorsTable = pgTable(
  "project_mentors",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    mentorUserId: integer("mentor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Free-form note, e.g. "기술 멘토" / "프로덕트 멘토". */
    roleLabel: text("role_label"),
    status: text("status")
      .notNull()
      .default("active")
      .$type<MentorAssignmentStatus>(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    assignedBy: integer("assigned_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // One row per (project, mentor) — re-assigning a former mentor reactivates
    // the existing row rather than inserting a duplicate.
    unq: uniqueIndex("project_mentors_unique").on(t.projectId, t.mentorUserId),
    byMentor: index("project_mentors_mentor_idx").on(t.mentorUserId, t.status),
  }),
);

export type ProjectMentor = typeof projectMentorsTable.$inferSelect;
export type InsertProjectMentor = typeof projectMentorsTable.$inferInsert;
