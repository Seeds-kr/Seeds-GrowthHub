import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  teamMeetingsTable,
  TEAM_MEETING_OWNER_TYPES,
  isTeamMeetingOwnerType,
  usersTable,
  projectsTable,
  studiesTable,
  type TeamMeetingOwnerType,
} from "@workspace/db";
import { requireStudent, requireMentor, requireAdmin } from "../lib/auth";
import { getMentorProjectIds, mentorOwnsProject } from "../lib/mentor-scope";
import {
  getStudentIdForUser,
  teamOwnerExists,
  studentOnTeam,
  studentProjectIds,
  studentStudyIds,
} from "../lib/team-scope";

const router: IRouter = Router();

/**
 * Team meeting notes (docs/design/06-team-meeting-notes.md).
 *
 * Students write; mentors and ops read. There is no `visibility` column
 * (ADR-011) — the audience is fixed at team + assigned mentor + all ops, so
 * access is decided entirely by WHICH ROUTE you came in through plus a
 * membership/assignment re-check here in the handler.
 *
 * ⚠️ This is NOT `admin-meetings.ts`. That table is the ops meeting record and
 * students must never reach it. Keeping the two files apart is the same
 * safeguard as keeping the two tables apart (ADR-009) — if you find yourself
 * importing `meetingsTable` here, stop.
 */

const OwnerQuery = z.object({
  ownerType: z.enum(TEAM_MEETING_OWNER_TYPES),
  ownerId: z.coerce.number().int().positive(),
});

const CreateBody = z.object({
  ownerType: z.enum(TEAM_MEETING_OWNER_TYPES),
  ownerId: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  metAt: z.string().datetime().optional(),
  contentMd: z.string().max(200_000).optional(),
});

const UpdateBody = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  metAt: z.string().datetime().optional(),
  contentMd: z.string().max(200_000).optional(),
});

const authorAlias = usersTable;

function serialize(row: {
  id: number;
  ownerType: string;
  ownerId: number;
  title: string;
  metAt: Date;
  contentMd: string;
  authorId: number | null;
  lastEditedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  authorName?: string | null;
}) {
  return {
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName ?? null,
  };
}

const baseSelect = {
  id: teamMeetingsTable.id,
  ownerType: teamMeetingsTable.ownerType,
  ownerId: teamMeetingsTable.ownerId,
  title: teamMeetingsTable.title,
  metAt: teamMeetingsTable.metAt,
  contentMd: teamMeetingsTable.contentMd,
  authorId: teamMeetingsTable.authorId,
  lastEditedBy: teamMeetingsTable.lastEditedBy,
  createdAt: teamMeetingsTable.createdAt,
  updatedAt: teamMeetingsTable.updatedAt,
  authorName: authorAlias.name,
};

/** Attach the owning team's title so a list is readable without a second call. */
async function withOwnerTitles<T extends { ownerType: string; ownerId: number }>(
  rows: T[],
): Promise<(T & { ownerTitle: string | null })[]> {
  const projectIds = rows.filter((r) => r.ownerType === "project").map((r) => r.ownerId);
  const studyIds = rows.filter((r) => r.ownerType === "study").map((r) => r.ownerId);
  const [projects, studies] = await Promise.all([
    projectIds.length
      ? db
          .select({ id: projectsTable.id, title: projectsTable.title })
          .from(projectsTable)
          .where(inArray(projectsTable.id, projectIds))
      : Promise.resolve([]),
    studyIds.length
      ? db
          .select({ id: studiesTable.id, title: studiesTable.title })
          .from(studiesTable)
          .where(inArray(studiesTable.id, studyIds))
      : Promise.resolve([]),
  ]);
  const pMap = new Map(projects.map((p) => [p.id, p.title]));
  const sMap = new Map(studies.map((s) => [s.id, s.title]));
  return rows.map((r) => ({
    ...r,
    ownerTitle:
      (r.ownerType === "project" ? pMap.get(r.ownerId) : sMap.get(r.ownerId)) ??
      null,
  }));
}

// ── 학생 ────────────────────────────────────────────────────────────────────

/**
 * My teams' meeting notes. With ownerType/ownerId, one team's; without, every
 * team I am on. The no-filter form is what the student dashboard uses.
 */
router.get("/student/team-meetings", requireStudent, async (req, res) => {
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!studentId) {
    res.json({ items: [], total: 0 });
    return;
  }

  const filter = OwnerQuery.safeParse(req.query);
  let where;
  if (filter.success) {
    const { ownerType, ownerId } = filter.data;
    if (!(await studentOnTeam(studentId, ownerType, ownerId))) {
      // 404, not 403 — do not confirm the team exists.
      res.status(404).json({ error: "Not found" });
      return;
    }
    where = and(
      eq(teamMeetingsTable.ownerType, ownerType),
      eq(teamMeetingsTable.ownerId, ownerId),
    );
  } else {
    const [projectIds, studyIds] = await Promise.all([
      studentProjectIds(studentId),
      studentStudyIds(studentId),
    ]);
    if (projectIds.length === 0 && studyIds.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }
    // An empty id list must contribute `false`, never an unconstrained branch —
    // an `inArray(col, [])` that degenerates to TRUE would hand this student
    // every team's notes.
    where = or(
      projectIds.length
        ? and(
            eq(teamMeetingsTable.ownerType, "project"),
            inArray(teamMeetingsTable.ownerId, projectIds),
          )
        : sql`false`,
      studyIds.length
        ? and(
            eq(teamMeetingsTable.ownerType, "study"),
            inArray(teamMeetingsTable.ownerId, studyIds),
          )
        : sql`false`,
    );
  }

  const rows = await db
    .select(baseSelect)
    .from(teamMeetingsTable)
    .leftJoin(authorAlias, eq(authorAlias.id, teamMeetingsTable.authorId))
    .where(where)
    .orderBy(desc(teamMeetingsTable.metAt));
  res.json({ items: await withOwnerTitles(rows.map(serialize)), total: rows.length });
});

router.get("/student/team-meetings/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !studentId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select(baseSelect)
    .from(teamMeetingsTable)
    .leftJoin(authorAlias, eq(authorAlias.id, teamMeetingsTable.authorId))
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (
    !row ||
    !(await studentOnTeam(
      studentId,
      row.ownerType as TeamMeetingOwnerType,
      row.ownerId,
    ))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.post("/student/team-meetings", requireStudent, async (req, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!studentId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!(await teamOwnerExists(d.ownerType, d.ownerId))) {
    res.status(422).json({ error: "팀을 찾을 수 없습니다." });
    return;
  }
  if (!(await studentOnTeam(studentId, d.ownerType, d.ownerId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [row] = await db
    .insert(teamMeetingsTable)
    .values({
      ownerType: d.ownerType,
      ownerId: d.ownerId,
      title: d.title,
      metAt: d.metAt ? new Date(d.metAt) : new Date(),
      contentMd: d.contentMd ?? "",
      authorId: req.sessionUser!.id,
      lastEditedBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(serialize({ ...row, authorName: req.sessionUser!.name }));
});

/**
 * Any team member may edit (design 06 §4) — meeting notes get written in turns,
 * and `project_members` carries no permission concept to hang "author only" on.
 * `lastEditedBy` is what makes an overwrite traceable.
 */
router.patch("/student/team-meetings/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateBody.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!studentId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [target] = await db
    .select()
    .from(teamMeetingsTable)
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (
    !target ||
    !(await studentOnTeam(studentId, target.ownerType, target.ownerId))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const d = parsed.data;
  const [row] = await db
    .update(teamMeetingsTable)
    .set({
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.metAt !== undefined ? { metAt: new Date(d.metAt) } : {}),
      ...(d.contentMd !== undefined ? { contentMd: d.contentMd } : {}),
      lastEditedBy: req.sessionUser!.id,
      updatedAt: new Date(),
    })
    .where(eq(teamMeetingsTable.id, id))
    .returning();
  res.json(serialize({ ...row, authorName: null }));
});

router.delete("/student/team-meetings/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !studentId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [target] = await db
    .select()
    .from(teamMeetingsTable)
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (
    !target ||
    !(await studentOnTeam(studentId, target.ownerType, target.ownerId))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(teamMeetingsTable).where(eq(teamMeetingsTable.id, id));
  // No audit() call. `AUDIT_ACTIONS` has no value that fits and `LinkableType`
  // has no `team_meeting`, and widening either is a policy change rather than
  // an implementation detail — audit_logs is gated on the `system` ops role and
  // exists for sensitive ops actions, not for a team editing its own record.
  // Whether a delete here deserves a trace is left open in design 06 §9.
  res.json({ ok: true });
});

// ── 멘토 ────────────────────────────────────────────────────────────────────

/**
 * Read-only. Assigned projects only — `studies` has no mentor concept
 * (no `study_mentors` table), so study notes never appear here (design 06 §5).
 */
router.get("/mentor/team-meetings", requireMentor, async (req, res) => {
  const mentorId = req.sessionUser!.id;
  const projectId = req.query.projectId ? Number(req.query.projectId) : null;

  if (projectId !== null) {
    if (!Number.isFinite(projectId) || !(await mentorOwnsProject(mentorId, projectId))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }
  const ids = projectId !== null ? [projectId] : await getMentorProjectIds(mentorId);
  if (ids.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }
  const rows = await db
    .select(baseSelect)
    .from(teamMeetingsTable)
    .leftJoin(authorAlias, eq(authorAlias.id, teamMeetingsTable.authorId))
    .where(
      and(
        eq(teamMeetingsTable.ownerType, "project"),
        inArray(teamMeetingsTable.ownerId, ids),
      ),
    )
    .orderBy(desc(teamMeetingsTable.metAt));
  res.json({ items: await withOwnerTitles(rows.map(serialize)), total: rows.length });
});

// ── 운영진 ──────────────────────────────────────────────────────────────────

/** Read-only. Ops does not edit a team's own record of what they decided. */
router.get("/admin/team-meetings", requireAdmin, async (req, res) => {
  const filter = OwnerQuery.safeParse(req.query);
  const where = filter.success
    ? and(
        eq(teamMeetingsTable.ownerType, filter.data.ownerType),
        eq(teamMeetingsTable.ownerId, filter.data.ownerId),
      )
    : undefined;
  if (req.query.ownerType && !isTeamMeetingOwnerType(req.query.ownerType)) {
    res.status(400).json({ error: "Invalid ownerType" });
    return;
  }
  const rows = await db
    .select(baseSelect)
    .from(teamMeetingsTable)
    .leftJoin(authorAlias, eq(authorAlias.id, teamMeetingsTable.authorId))
    .where(where)
    .orderBy(desc(teamMeetingsTable.metAt))
    .limit(200);
  res.json({ items: await withOwnerTitles(rows.map(serialize)), total: rows.length });
});

export default router;
