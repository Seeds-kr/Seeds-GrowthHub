import { and, eq } from "drizzle-orm";
import { db, projectMentorsTable } from "@workspace/db";

/**
 * Mentor scope resolution (ADR-003 / docs/design/02-mentor-workspace.md §2.3).
 *
 * Every /mentor/* route that touches team data MUST go through here. Holding
 * the `mentor` role alone opens nothing — access is granted by an ACTIVE
 * assignment on the specific project, mirroring how the evaluation surface
 * re-checks per-application assignment ownership after requireAdminOrMentor.
 */

/** Project ids this mentor currently carries. Empty array = no team access. */
export async function getMentorProjectIds(
  mentorUserId: number,
): Promise<number[]> {
  const rows = await db
    .select({ projectId: projectMentorsTable.projectId })
    .from(projectMentorsTable)
    .where(
      and(
        eq(projectMentorsTable.mentorUserId, mentorUserId),
        eq(projectMentorsTable.status, "active"),
      ),
    );
  return rows.map((r) => r.projectId);
}

/**
 * True only if the mentor holds an ACTIVE assignment on this project.
 * Ending an assignment cuts access immediately — we do not honour endedAt
 * grace periods.
 *
 * Callers should respond 404 (not 403) on false: a mentor should not be able
 * to probe which project ids exist.
 */
export async function mentorOwnsProject(
  mentorUserId: number,
  projectId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: projectMentorsTable.id })
    .from(projectMentorsTable)
    .where(
      and(
        eq(projectMentorsTable.mentorUserId, mentorUserId),
        eq(projectMentorsTable.projectId, projectId),
        eq(projectMentorsTable.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
