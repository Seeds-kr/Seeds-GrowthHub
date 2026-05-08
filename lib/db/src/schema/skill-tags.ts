import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const TAG_TARGETS = [
  "activity_record",
  "project",
  "artifact",
  "feedback",
  "student",
] as const;
export type TagTarget = (typeof TAG_TARGETS)[number];

export const skillTagsTable = pgTable(
  "skill_tags",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ nameUnq: uniqueIndex("skill_tags_name_unique").on(t.name) }),
);
export type SkillTag = typeof skillTagsTable.$inferSelect;
export type InsertSkillTag = typeof skillTagsTable.$inferInsert;

export const tagMappingsTable = pgTable(
  "tag_mappings",
  {
    id: serial("id").primaryKey(),
    tagId: integer("tag_id")
      .notNull()
      .references(() => skillTagsTable.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull().$type<TagTarget>(),
    targetId: integer("target_id").notNull(),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("tag_mappings_unique").on(
      t.tagId,
      t.targetType,
      t.targetId,
    ),
  }),
);
export type TagMapping = typeof tagMappingsTable.$inferSelect;
export type InsertTagMapping = typeof tagMappingsTable.$inferInsert;
