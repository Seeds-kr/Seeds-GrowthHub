import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const MEETING_TYPES = [
  "general",
  "ops",
  "planning",
  "retro",
  "mentor",
  "external",
  "other",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

/**
 * Visibility for internal meetings.
 * - `admin_only` (default): admins only — students NEVER see.
 * - `mentor_visible`: admins + mentors.
 *
 * NOTE: Meetings are an internal Ops surface. Students do not have
 * any route that returns meeting data. The `visibility` column is
 * stored for future mentor surface use; admin routes always return all.
 */
export const MEETING_VISIBILITIES = ["admin_only", "mentor_visible"] as const;
export type MeetingVisibility = (typeof MEETING_VISIBILITIES)[number];

export const meetingsTable = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    meetingType: text("meeting_type")
      .notNull()
      .default("general")
      .$type<MeetingType>(),
    meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
    /** Free-form participant labels (names or emails). */
    participants: text("participants").array().notNull().default([]),
    /**
     * Main body, seeded from the template chosen for `meetingType` (ADR-006).
     * Sections vary by meeting type, so they live in one markdown field rather
     * than fixed columns.
     */
    bodyMd: text("body_md").notNull().default(""),
    /**
     * Decisions stay a SEPARATE column even though the body is free-form:
     * dashboards, handover and audit all need to pull decisions alone. This is
     * the one structure ADR-006 enforces across every template.
     */
    decisionsMd: text("decisions_md").notNull().default(""),
    /**
     * Legacy fixed sections, pre-ADR-006. Retained (not dropped) for one cohort
     * so the migration is reversible; content was backfilled into `bodyMd`.
     * The UI no longer reads or writes these.
     */
    agendaMd: text("agenda_md").notNull().default(""),
    notesMd: text("notes_md").notNull().default(""),
    pendingMd: text("pending_md").notNull().default(""),
    visibility: text("visibility")
      .notNull()
      .default("admin_only")
      .$type<MeetingVisibility>(),
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
    byDate: index("meetings_date_idx").on(t.meetingDate),
  }),
);
export type Meeting = typeof meetingsTable.$inferSelect;
export type InsertMeeting = typeof meetingsTable.$inferInsert;
