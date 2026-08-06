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
 * Functional ops roles — Seeds 운영진 세부 역할.
 *
 * ORTHOGONAL to USER_ROLES. `role`/`extraRoles` answer "which workspace can
 * this account enter"; `opsRoles` answers "what may they do inside the admin
 * workspace". Deliberately a separate column so USER_ROLES stays exactly
 * admin|mentor|student — widening it would pollute the primary `role` column
 * and the role-switcher UI.
 *
 * `program_lead` is a superuser: it satisfies every hasOpsRole() check.
 *
 * See docs/design/01-role-permissions.md (ADR-002).
 */
export const OPS_ROLES = [
  "program_lead",
  "ops",
  "recruiting",
  "finance",
  "growth",
  "community",
  "system",
] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

export const OPS_ROLE_LABELS: Record<OpsRole, string> = {
  program_lead: "총괄 (Program Lead)",
  ops: "운영 (Ops Manager)",
  recruiting: "모집/선발",
  finance: "회계/행정",
  growth: "성장경험",
  community: "커뮤니티/커뮤니케이션",
  system: "시스템/데이터",
};

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
    /** Functional ops roles. Only meaningful when effective roles include "admin". */
    opsRoles: text("ops_roles")
      .array()
      .notNull()
      .$type<OpsRole[]>()
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

export type OpsRoleCarrier = {
  role: UserRole;
  extraRoles?: UserRole[] | null;
  opsRoles?: OpsRole[] | null;
};

/**
 * Functional ops roles, whitelist-filtered.
 * Returns [] for anyone whose effective roles do not include "admin" — ops
 * roles are meaningless outside the admin workspace, so a mentor/student can
 * never gain capability by having values in this column.
 */
export function getOpsRoles(u: OpsRoleCarrier): OpsRole[] {
  if (!getEffectiveRoles(u).includes("admin")) return [];
  const set = new Set<OpsRole>();
  for (const r of u.opsRoles ?? []) {
    if ((OPS_ROLES as readonly string[]).includes(r)) set.add(r);
  }
  return Array.from(set);
}

/** True if the user may act in `code`. `program_lead` satisfies every check. */
export function hasOpsRole(u: OpsRoleCarrier, code: OpsRole): boolean {
  const roles = getOpsRoles(u);
  return roles.includes("program_lead") || roles.includes(code);
}
