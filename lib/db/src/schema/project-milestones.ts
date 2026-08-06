import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

/**
 * `dropped` means the plan changed, not that the team failed. UI must not
 * render it as a negative outcome (docs/design/03-growth-evidence.md §3).
 */
export const MILESTONE_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "dropped",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/**
 * No visibility column: milestones INHERIT the project's visibility. If you can
 * see the project, you can see its milestones.
 */
export const projectMilestonesTable = pgTable(
  "project_milestones",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status")
      .notNull()
      .default("planned")
      .$type<MilestoneStatus>(),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byProject: index("project_milestones_project_idx").on(
      t.projectId,
      t.sortOrder,
    ),
  }),
);

export type ProjectMilestone = typeof projectMilestonesTable.$inferSelect;
export type InsertProjectMilestone =
  typeof projectMilestonesTable.$inferInsert;
