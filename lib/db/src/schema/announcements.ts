import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ANNOUNCEMENT_TARGETS = ["all", "cohort", "program"] as const;
export type AnnouncementTarget = (typeof ANNOUNCEMENT_TARGETS)[number];

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  targetType: text("target_type")
    .notNull()
    .default("all")
    .$type<AnnouncementTarget>(),
  targetId: integer("target_id"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type Announcement = typeof announcementsTable.$inferSelect;
export type InsertAnnouncement = typeof announcementsTable.$inferInsert;
