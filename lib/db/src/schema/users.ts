import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const USER_ROLES = ["admin", "mentor", "student"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Effective roles → can the user view other members' contact info
 * (phone/email) on the /people directory page?
 * Currently: any logged-in member (admin, mentor, student).
 * Centralized so adding alumni / suspending a role later changes only one place.
 */
export function canViewMemberContacts(u: {
  role: UserRole;
  extraRoles?: UserRole[] | null;
}): boolean {
  const roles = getEffectiveRoles(u);
  return (
    roles.includes("admin") ||
    roles.includes("mentor") ||
    roles.includes("student")
  );
}

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().$type<UserRole>(),
    extraRoles: text("extra_roles")
      .array()
      .notNull()
      .$type<UserRole[]>()
      .default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

/**
 * Effective roles = primary role + extra roles, deduped.
 * Used by middleware and role-switcher UI to support a single account
 * holding multiple roles (e.g. a student who is also a staff/admin).
 */
export function getEffectiveRoles(u: {
  role: UserRole;
  extraRoles?: UserRole[] | null;
}): UserRole[] {
  const set = new Set<UserRole>([u.role]);
  for (const r of u.extraRoles ?? []) {
    if ((USER_ROLES as readonly string[]).includes(r)) set.add(r);
  }
  return Array.from(set);
}
