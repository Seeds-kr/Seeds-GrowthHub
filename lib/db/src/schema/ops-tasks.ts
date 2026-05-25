import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { meetingsTable } from "./meetings";

/**
 * Operational tasks / action items.
 *
 * Distinct from MVP3 `assignments` (student homework). Use this for
 * meeting follow-ups, ops to-dos, event prep, and other internal work.
 * Table name `ops_tasks` to avoid clash with the generic word `tasks`
 * and to keep the operational semantics explicit.
 */
export const OPS_TASK_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
  "canceled",
] as const;
export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];

export const OPS_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type OpsTaskPriority = (typeof OPS_TASK_PRIORITIES)[number];

export const opsTasksTable = pgTable(
  "ops_tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo").$type<OpsTaskStatus>(),
    priority: text("priority")
      .notNull()
      .default("medium")
      .$type<OpsTaskPriority>(),
    assigneeId: integer("assignee_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    sourceMeetingId: integer("source_meeting_id").references(
      () => meetingsTable.id,
      { onDelete: "set null" },
    ),
    /** Polymorphic link to a related object (e.g. "project", "session"). */
    linkedObjectType: text("linked_object_type"),
    linkedObjectId: integer("linked_object_id"),
    createdBy: integer("created_by").references(() => usersTable.id, {
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
    byStatus: index("ops_tasks_status_idx").on(t.status),
    byAssignee: index("ops_tasks_assignee_idx").on(t.assigneeId),
    bySourceMeeting: index("ops_tasks_source_meeting_idx").on(
      t.sourceMeetingId,
    ),
  }),
);
export type OpsTask = typeof opsTasksTable.$inferSelect;
export type InsertOpsTask = typeof opsTasksTable.$inferInsert;
