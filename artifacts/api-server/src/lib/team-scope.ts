import { and, eq } from "drizzle-orm";
import {
  db,
  studentsTable,
  projectsTable,
  projectMembersTable,
  studiesTable,
  studyMembersTable,
  type TeamMeetingOwnerType,
} from "@workspace/db";

/**
 * Team membership resolution for team-owned objects
 * (docs/design/06-team-meeting-notes.md §5).
 *
 * Mirrors `mentor-scope.ts`: holding the `student` role opens nothing. Access
 * comes from a membership row on the specific project/study, and every route
 * re-checks it in the handler — `requireStudent` only establishes "is a
 * student", never "is on this team".
 *
 * Callers respond 404 (not 403) on false, same rule as `attachments`: a 403
 * confirms the id belongs to a real team the caller is not on.
 */

/** The students row for a user account, or null (not every user is a student). */
export async function getStudentIdForUser(
  userId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

/** True if the parent row exists. Polymorphic owners have no FK to lean on. */
export async function teamOwnerExists(
  ownerType: TeamMeetingOwnerType,
  ownerId: number,
): Promise<boolean> {
  if (ownerType === "project") {
    const [r] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, ownerId))
      .limit(1);
    return Boolean(r);
  }
  const [r] = await db
    .select({ id: studiesTable.id })
    .from(studiesTable)
    .where(eq(studiesTable.id, ownerId))
    .limit(1);
  return Boolean(r);
}

/** True if this student is a member of the given project/study. */
export async function studentOnTeam(
  studentId: number,
  ownerType: TeamMeetingOwnerType,
  ownerId: number,
): Promise<boolean> {
  if (ownerType === "project") {
    const [r] = await db
      .select({ id: projectMembersTable.id })
      .from(projectMembersTable)
      .where(
        and(
          eq(projectMembersTable.studentId, studentId),
          eq(projectMembersTable.projectId, ownerId),
        ),
      )
      .limit(1);
    return Boolean(r);
  }
  const [r] = await db
    .select({ id: studyMembersTable.id })
    .from(studyMembersTable)
    .where(
      and(
        eq(studyMembersTable.studentId, studentId),
        eq(studyMembersTable.studyId, ownerId),
      ),
    )
    .limit(1);
  return Boolean(r);
}

/** Every project id this student is on. */
export async function studentProjectIds(studentId: number): Promise<number[]> {
  const rows = await db
    .select({ id: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.studentId, studentId));
  return rows.map((r) => r.id);
}

/** Every study id this student is on. */
export async function studentStudyIds(studentId: number): Promise<number[]> {
  const rows = await db
    .select({ id: studyMembersTable.studyId })
    .from(studyMembersTable)
    .where(eq(studyMembersTable.studentId, studentId));
  return rows.map((r) => r.id);
}
