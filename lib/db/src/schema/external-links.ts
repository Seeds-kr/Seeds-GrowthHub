import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { LinkableType } from "./_linkable";

export const LINK_TYPES = [
  "github_repo",
  "github_pr",
  "github_issue",
  "readme",
  "release",
  "demo",
  "deck",
  "drive",
  "notion",
  "discord",
  "figma",
  "issue_board",
  "blog",
  "other",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

/**
 * Same vocabulary as `artifacts` (visibility-policy §4.2).
 *
 * These values can only NARROW the audience the linked object already grants,
 * never widen it — see `visibility-policy` §5.1. `private` and `admin_only`
 * hold regardless of the parent; `team_visible`/`cohort_visible` mean something
 * only when the parent actually has that audience.
 */
export const EXTERNAL_LINK_VISIBILITIES = [
  "private",
  "team_visible",
  "cohort_visible",
  "admin_only",
] as const;
export type ExternalLinkVisibility =
  (typeof EXTERNAL_LINK_VISIBILITIES)[number];

/**
 * Reference links attached to an arbitrary object (docs/design/04 §4).
 *
 * NOT the same thing as `artifacts`. `artifacts` are growth evidence a student
 * produced; these are reference material that keeps operational context — a
 * Discord channel, a Drive folder, a spec someone should read. A project's three
 * headline URLs (github/demo/deck) are columns on `projects`, not rows here.
 *
 * Reads must intersect this row's visibility with access to the linked object
 * (visibility-policy §5.1). Checking this column alone leaks: flipping a link on
 * an `admin_only` meeting to `cohort_visible` would expose that meeting's
 * existence and material URL to a whole cohort through the link title.
 *
 * `freshnessCheckedAt` is a MANUAL marker — "someone confirmed this still
 * resolves". design/04 §4 explicitly rules out crawling the target, counting
 * commits, or ranking students by activity.
 */
export const externalLinksTable = pgTable(
  "external_links",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    linkType: text("link_type").notNull().default("other").$type<LinkType>(),
    description: text("description"),
    linkedObjectType: text("linked_object_type")
      .notNull()
      .$type<LinkableType>(),
    linkedObjectId: integer("linked_object_id").notNull(),
    ownerId: integer("owner_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    visibility: text("visibility")
      .notNull()
      .default("admin_only")
      .$type<ExternalLinkVisibility>(),
    /** Manual freshness marker — "이 링크 아직 유효함" 확인 시각. Never automated. */
    freshnessCheckedAt: timestamp("freshness_checked_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byLinked: index("external_links_linked_idx").on(
      t.linkedObjectType,
      t.linkedObjectId,
    ),
  }),
);

export type ExternalLink = typeof externalLinksTable.$inferSelect;
export type InsertExternalLink = typeof externalLinksTable.$inferInsert;
