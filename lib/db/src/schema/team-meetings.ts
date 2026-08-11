import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Which team a meeting note belongs to. Polymorphic rather than two nullable
 * FK columns: `projectId`/`studyId` side by side would make "both set" and
 * "neither set" representable, and nothing in the type system would stop it.
 * Same pattern as `attachments` / `external_links` — the parent's existence is
 * checked at write time instead (see `teamOwnerExists()` in the route).
 */
export const TEAM_MEETING_OWNER_TYPES = ["project", "study"] as const;
export type TeamMeetingOwnerType = (typeof TEAM_MEETING_OWNER_TYPES)[number];

export function isTeamMeetingOwnerType(
  v: unknown,
): v is TeamMeetingOwnerType {
  return (
    typeof v === "string" &&
    (TEAM_MEETING_OWNER_TYPES as readonly string[]).includes(v)
  );
}

/**
 * Team meeting notes — what a project/study team decided when they met.
 * Students write these. See docs/design/06-team-meeting-notes.md.
 *
 * NOT the same table as `meetings`, and deliberately so (ADR-009):
 * `meetings` is the OPS meeting record, whose whole identity is "students
 * never see this" — its visibility enum has no student value and
 * `admin-meetings.ts` returns every row with no visibility filter at all.
 * Mixing the two would either flood the ops meeting list with team notes or
 * force a filter change onto a surface that never needed one. Different
 * authors, different readers, different lifetimes.
 *
 * NO `visibility` COLUMN — ADR-011. The audience is fixed: team members +
 * assigned mentors + all ops. A team meeting note is an operating record, not
 * private reflection; the mentor reading it is the point. `visibility-policy`
 * §4.2 established that an enum value with no reader should not exist
 * (that is why `attachments` lost `team_visible`), and the same reasoning says
 * a column with one possible audience should not exist either. To narrow it
 * later, add the column AND its read path in the same change.
 */
export const teamMeetingsTable = pgTable(
  "team_meetings",
  {
    id: serial("id").primaryKey(),
    ownerType: text("owner_type").notNull().$type<TeamMeetingOwnerType>(),
    ownerId: integer("owner_id").notNull(),
    title: text("title").notNull(),
    /** When the team actually met — not when the note was typed up. */
    metAt: timestamp("met_at", { withTimezone: true }).notNull().defaultNow(),
    contentMd: text("content_md").notNull().default(""),
    /**
     * Team-local labels ("정기", "기획", "긴급"). A plain array, not a table.
     *
     * `skill_tags` exists but is NOT reused: it is the (still provisional)
     * competency taxonomy shared across the club, and design 00 §8 keeps its
     * final shape open. Meeting labels are the opposite kind of thing — a team
     * invents them for itself, they mean nothing outside that team, and nobody
     * should be tempted to aggregate across them. Mixing the two would quietly
     * turn "우리 팀이 붙인 이름"으로 역량을 집계할 수 있게 만든다.
     *
     * `people_profiles.tags` already uses this shape, so it is the established
     * pattern for free-form labels here.
     */
    tags: text("tags").array().notNull().$type<string[]>().default([]),
    /**
     * Who first wrote it. Kept even after others edit, so "whose note is this"
     * survives. SET NULL rather than CASCADE: losing the account must not
     * delete the team's record of what they decided.
     */
    authorId: integer("author_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /**
     * Any team member may edit (design 06 §4), so the last writer wins. There
     * is no version table yet — this column plus `updatedAt` is the minimum
     * that makes an overwrite traceable. See design 06 §9.
     */
    lastEditedBy: integer("last_edited_by").references(() => usersTable.id, {
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
    // Every read is "this team's notes, newest meeting first".
    byOwner: index("team_meetings_owner_idx").on(
      t.ownerType,
      t.ownerId,
      t.metAt,
    ),
  }),
);

export type TeamMeeting = typeof teamMeetingsTable.$inferSelect;
export type InsertTeamMeeting = typeof teamMeetingsTable.$inferInsert;

/**
 * Who was in the room.
 *
 * A join table rather than a `text[]` of names (which is what `tags` gets):
 * participants are real accounts we already have, and a table is what makes
 * "회의에 안 들어온 사람" filterable and keeps a renamed user from stranding a
 * stale string. Cascade on delete of the meeting; the user FK cascades too —
 * unlike `authorId`, a participant row carries no content worth keeping once
 * the account is gone.
 *
 * `userId` (not `studentId`) because an assigned mentor may sit in on a team
 * meeting, and mentors have no `students` row.
 */
export const teamMeetingParticipantsTable = pgTable(
  "team_meeting_participants",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id")
      .notNull()
      .references(() => teamMeetingsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Same person twice in one meeting is meaningless; let the DB say so
    // rather than relying on every writer to dedupe.
    unq: uniqueIndex("team_meeting_participants_unique").on(
      t.meetingId,
      t.userId,
    ),
    byUser: index("team_meeting_participants_user_idx").on(t.userId),
  }),
);

export type TeamMeetingParticipant =
  typeof teamMeetingParticipantsTable.$inferSelect;
export type InsertTeamMeetingParticipant =
  typeof teamMeetingParticipantsTable.$inferInsert;
