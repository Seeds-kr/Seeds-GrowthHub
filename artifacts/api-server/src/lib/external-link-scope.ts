import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  applicationsTable,
  cohortsTable,
  documentsTable,
  externalLinksTable,
  financeRecordsTable,
  meetingsTable,
  opsTasksTable,
  programsTable,
  projectMembersTable,
  projectsTable,
  sessionsTable,
  studentCohortsTable,
  studentsTable,
  studiesTable,
  studyMembersTable,
  usersTable,
  hasOpsRole,
  type LinkableType,
  type User,
} from "@workspace/db";
import { getMentorProjectIds } from "./mentor-scope";

/**
 * Access resolution for `external_links` (visibility-policy §5.1).
 *
 * The rule is an INTERSECTION, not a single column check:
 *
 *   readable ⟺ (viewer can reach the linked object) AND (link.visibility allows them)
 *
 * Reading `visibility` alone leaks. Flipping a link that hangs off an
 * `admin_only` meeting to `cohort_visible` would publish that meeting's
 * existence and its material URL to an entire cohort via the link title, while
 * the meeting body stays correctly hidden. Every read path here goes through
 * one of the builders below so that intersection cannot be forgotten in a
 * single route.
 *
 * `private` is owner-only and that beats the ops path too — an admin who is not
 * the owner does not see another admin's private link. That is what keeps
 * `private` distinguishable from `admin_only` rather than a dead synonym
 * (visibility-policy §4.2).
 */

/**
 * Parent types a link may attach to. Deliberately NARROWER than
 * `LINKABLE_TYPES`: `meeting_type` keys off a type string rather than a row and
 * `channel` has no table at all, so neither can satisfy the design/04 §2 rule 2
 * existence check. Rejected at write time instead of being stored unvalidatable.
 */
const LINKABLE_PARENTS = [
  "project",
  "study",
  "session",
  "cohort",
  "program",
  "meeting",
  "document",
  "application",
  "finance_record",
  "ops_task",
  "student",
  "user",
] as const satisfies readonly LinkableType[];

export type LinkParentType = (typeof LINKABLE_PARENTS)[number];

export function isLinkParentType(v: unknown): v is LinkParentType {
  return (
    typeof v === "string" &&
    (LINKABLE_PARENTS as readonly string[]).includes(v)
  );
}

/**
 * design/04 §2 rule 2 — the target must exist at write time, else 422. Without
 * this, orphan detection later cannot tell "deleted" from "never valid".
 */
export async function linkTargetExists(
  type: LinkParentType,
  id: number,
): Promise<boolean> {
  const exists = async (table: { id: any }) =>
    Boolean(
      (
        await db
          .select({ id: table.id })
          .from(table as any)
          .where(eq(table.id, id))
          .limit(1)
      )[0],
    );

  switch (type) {
    case "project":
      return exists(projectsTable);
    case "study":
      return exists(studiesTable);
    case "session":
      return exists(sessionsTable);
    case "cohort":
      return exists(cohortsTable);
    case "program":
      return exists(programsTable);
    case "meeting":
      return exists(meetingsTable);
    case "document":
      return exists(documentsTable);
    case "application":
      return exists(applicationsTable);
    case "finance_record":
      return exists(financeRecordsTable);
    case "ops_task":
      return exists(opsTasksTable);
    case "student":
      return exists(studentsTable);
    case "user":
      return exists(usersTable);
  }
}

/**
 * Ops-side parent gate. Two parent types are not open to every admin (§5):
 * finance rows are `finance` only and applications are `recruiting` only.
 * `admin_only` on the link is not sufficient for those — same reasoning as the
 * receipt gate in `attachments`.
 */
export function opsCanReachParent(user: User, type: LinkParentType): boolean {
  if (type === "finance_record") return hasOpsRole(user, "finance");
  if (type === "application") return hasOpsRole(user, "recruiting");
  return true;
}

/** Parent types an admin without `finance`/`recruiting` may still list. */
export function opsReachableParents(user: User): LinkParentType[] {
  return LINKABLE_PARENTS.filter((t) => opsCanReachParent(user, t));
}

/**
 * Ops list filter: reachable parent types, and never another owner's `private`.
 */
export function opsVisibilityFilter(user: User): SQL {
  const reachable = opsReachableParents(user);
  return and(
    inArray(externalLinksTable.linkedObjectType, reachable),
    or(
      sql`${externalLinksTable.visibility} <> 'private'`,
      eq(externalLinksTable.ownerId, user.id),
    ),
  )!;
}

/** Cohort ids a student belongs to. */
async function studentCohortIds(studentId: number): Promise<number[]> {
  const rows = await db
    .select({ id: studentCohortsTable.cohortId })
    .from(studentCohortsTable)
    .where(eq(studentCohortsTable.studentId, studentId));
  return rows.map((r) => r.id);
}

/**
 * Student read filter. Built from membership, never from the link row alone.
 *
 * Returns null when the student can reach nothing, so callers can short-circuit
 * to an empty list rather than issuing `WHERE false`.
 */
export async function studentLinkFilter(
  userId: number,
  studentId: number,
): Promise<SQL | null> {
  const [projectIds, studyIds, cohortIds] = await Promise.all([
    db
      .select({ id: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.studentId, studentId))
      .then((r) => r.map((x) => x.id)),
    db
      .select({ id: studyMembersTable.studyId })
      .from(studyMembersTable)
      .where(eq(studyMembersTable.studentId, studentId))
      .then((r) => r.map((x) => x.id)),
    studentCohortIds(studentId),
  ]);

  const conds: SQL[] = [];

  // A student owning a link is only reachable if a student-facing write path is
  // ever added; harmless and keeps `private` meaningful from both sides.
  conds.push(
    and(
      eq(externalLinksTable.ownerId, userId),
      eq(externalLinksTable.visibility, "private"),
    )!,
  );

  // project / study parents carry a team audience, so both team_visible and
  // cohort_visible resolve for a member.
  if (projectIds.length > 0) {
    conds.push(
      and(
        eq(externalLinksTable.linkedObjectType, "project"),
        inArray(externalLinksTable.linkedObjectId, projectIds),
        inArray(externalLinksTable.visibility, ["team_visible", "cohort_visible"]),
      )!,
    );
  }
  if (studyIds.length > 0) {
    conds.push(
      and(
        eq(externalLinksTable.linkedObjectType, "study"),
        inArray(externalLinksTable.linkedObjectId, studyIds),
        inArray(externalLinksTable.visibility, ["team_visible", "cohort_visible"]),
      )!,
    );
  }

  // cohort-shaped parents have no "team", so only cohort_visible resolves.
  if (cohortIds.length > 0) {
    conds.push(
      and(
        eq(externalLinksTable.linkedObjectType, "cohort"),
        inArray(externalLinksTable.linkedObjectId, cohortIds),
        eq(externalLinksTable.visibility, "cohort_visible"),
      )!,
    );
    const sessionIds = (
      await db
        .select({ id: sessionsTable.id })
        .from(sessionsTable)
        .where(inArray(sessionsTable.cohortId, cohortIds))
    ).map((r) => r.id);
    if (sessionIds.length > 0) {
      conds.push(
        and(
          eq(externalLinksTable.linkedObjectType, "session"),
          inArray(externalLinksTable.linkedObjectId, sessionIds),
          eq(externalLinksTable.visibility, "cohort_visible"),
        )!,
      );
    }
    const programIds = (
      await db
        .select({ id: programsTable.id })
        .from(programsTable)
        .where(inArray(programsTable.cohortId, cohortIds))
    ).map((r) => r.id);
    if (programIds.length > 0) {
      conds.push(
        and(
          eq(externalLinksTable.linkedObjectType, "program"),
          inArray(externalLinksTable.linkedObjectId, programIds),
          eq(externalLinksTable.visibility, "cohort_visible"),
        )!,
      );
    }
  }

  return conds.length > 0 ? or(...conds)! : null;
}

/**
 * Mentor read filter — scope, not visibility (ADR-004). Links on assigned
 * projects only, and never `private` or `admin_only`: §5 gives the mentor the
 * team audience, not the ops one.
 *
 * `meeting`/`document` parents are excluded here on purpose. §5 grants mentors
 * `mentor_visible` on those, but that is a property of the parent row, so a
 * mentor reaches those links through the meeting/document surface rather than
 * the team-scoped list.
 */
export async function mentorLinkFilter(
  mentorUserId: number,
): Promise<SQL | null> {
  const projectIds = await getMentorProjectIds(mentorUserId);
  if (projectIds.length === 0) return null;
  return and(
    eq(externalLinksTable.linkedObjectType, "project"),
    inArray(externalLinksTable.linkedObjectId, projectIds),
    inArray(externalLinksTable.visibility, ["team_visible", "cohort_visible"]),
  )!;
}

/** Orphan-tolerant title for a parent (design/04 §2 rule 3 — empty, not error). */
export async function parentLabel(
  type: LinkParentType,
  id: number,
): Promise<string | null> {
  const pick = async (table: any, col: any, idCol: any) => {
    const [row] = await db
      .select({ v: col })
      .from(table)
      .where(eq(idCol, id))
      .limit(1);
    return (row?.v as string | undefined) ?? null;
  };
  switch (type) {
    case "project":
      return pick(projectsTable, projectsTable.title, projectsTable.id);
    case "study":
      return pick(studiesTable, studiesTable.title, studiesTable.id);
    case "session":
      return pick(sessionsTable, sessionsTable.title, sessionsTable.id);
    case "cohort":
      return pick(cohortsTable, cohortsTable.name, cohortsTable.id);
    case "program":
      return pick(programsTable, programsTable.name, programsTable.id);
    case "meeting":
      return pick(meetingsTable, meetingsTable.title, meetingsTable.id);
    case "document":
      return pick(documentsTable, documentsTable.title, documentsTable.id);
    case "ops_task":
      return pick(opsTasksTable, opsTasksTable.title, opsTasksTable.id);
    case "student":
      return pick(studentsTable, studentsTable.name, studentsTable.id);
    case "user":
      return pick(usersTable, usersTable.name, usersTable.id);
    // Deliberately unlabelled: exposing an applicant name or a finance record
    // title through a link list would sidestep the recruiting/finance gates.
    case "application":
    case "finance_record":
      return null;
  }
}
