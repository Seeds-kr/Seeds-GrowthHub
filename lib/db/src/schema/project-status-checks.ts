import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const TEAM_STATUSES = ["good", "watch", "risk", "blocked"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

/**
 * Visibility is deliberately limited to ops + mentor. There is NO student-facing
 * value and NO student route: a team seeing itself labelled `risk` reads as a
 * brand, not a signal. See docs/design/03-growth-evidence.md §2.
 */
export const STATUS_CHECK_VISIBILITIES = [
  "admin_only",
  "mentor_visible",
] as const;
export type StatusCheckVisibility =
  (typeof STATUS_CHECK_VISIBILITIES)[number];

/**
 * Point-in-time read of how a team is doing, written by the assigned mentor or
 * by ops. Its purpose is to time an intervention — it is NOT an evaluation of
 * the students.
 *
 * APPEND-ONLY: no update/delete API. The trajectory of statuses over time is
 * itself the information. The single exception is the opsResolved* stamp, set
 * when ops picks up a support request.
 */
export const projectStatusChecksTable = pgTable(
  "project_status_checks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    teamStatus: text("team_status").notNull().$type<TeamStatus>(),
    blocker: text("blocker"),
    nextFocus: text("next_focus"),
    needsOpsSupport: boolean("needs_ops_support").notNull().default(false),
    opsSupportNote: text("ops_support_note"),
    /** Null while the request is still open — drives the ops dashboard widget. */
    opsResolvedAt: timestamp("ops_resolved_at", { withTimezone: true }),
    opsResolvedBy: integer("ops_resolved_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    comment: text("comment"),
    visibility: text("visibility")
      .notNull()
      .default("mentor_visible")
      .$type<StatusCheckVisibility>(),
    authorId: integer("author_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byProject: index("project_status_checks_project_idx").on(
      t.projectId,
      t.checkedAt,
    ),
    byOpenSupport: index("project_status_checks_open_support_idx").on(
      t.needsOpsSupport,
      t.opsResolvedAt,
    ),
  }),
);

export type ProjectStatusCheck = typeof projectStatusChecksTable.$inferSelect;
export type InsertProjectStatusCheck =
  typeof projectStatusChecksTable.$inferInsert;
