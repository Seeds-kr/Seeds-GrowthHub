import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const PEOPLE_KINDS = ["mentor", "staff", "member"] as const;
export type PeopleKind = (typeof PEOPLE_KINDS)[number];

export const peopleProfilesTable = pgTable(
  "people_profiles",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull().$type<PeopleKind>(),
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    studentId: integer("student_id").references(() => studentsTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    affiliation: text("affiliation"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    tags: text("tags").array().notNull().default([]),
    displayOrder: integer("display_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    kindOrderIdx: index("people_profiles_kind_order_idx").on(
      t.kind,
      t.displayOrder,
    ),
    userIdUnq: uniqueIndex("people_profiles_user_id_unique").on(t.userId),
    studentIdUnq: uniqueIndex("people_profiles_student_id_unique").on(
      t.studentId,
    ),
  }),
);

export type PeopleProfile = typeof peopleProfilesTable.$inferSelect;
export type InsertPeopleProfile = typeof peopleProfilesTable.$inferInsert;
