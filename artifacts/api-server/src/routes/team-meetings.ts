import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  teamMeetingsTable,
  teamMeetingParticipantsTable,
  TEAM_MEETING_OWNER_TYPES,
  isTeamMeetingOwnerType,
  usersTable,
  studentsTable,
  projectMembersTable,
  projectMentorsTable,
  studyMembersTable,
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
import { recordActivity } from "../lib/activity";

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
 *
 * LIST NEVER RETURNS `contentMd`. A single note runs long; twenty of them in
 * one payload is hundreds of KB the list screen does not draw. Bodies come from
 * the detail route, one at a time, when the reader expands a row.
 */

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;

const ListQuery = z.object({
  ownerType: z.enum(TEAM_MEETING_OWNER_TYPES).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  tag: z.string().trim().min(1).max(40).optional(),
  participantId: z.coerce.number().int().positive().optional(),
});

/**
 * Tags are team-local labels, so the only rules are the ones that keep them
 * usable: trimmed, blanks dropped, deduped, capped. Case is preserved (a team
 * writing "기획" and "Planning" means two different things to them).
 *
 * Cleaning happens in `preprocess`, BEFORE validation, and that ordering is the
 * whole point. Written as `z.array(z.string().trim().min(1))` the blank chip a
 * tag input leaves behind fails `min(1)` and rejects the entire save — the user
 * loses a written meeting note because of an empty box they never filled in.
 * An empty tag is not an error to report, it is nothing to store.
 */
const TagList = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? Array.from(
          new Set(
            v
              .map((x) => (typeof x === "string" ? x.trim() : x))
              .filter((x) => typeof x === "string" && x.length > 0),
          ),
        )
      : v,
  z.array(z.string().max(40)).max(10),
);

const CreateBody = z.object({
  ownerType: z.enum(TEAM_MEETING_OWNER_TYPES),
  ownerId: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  metAt: z.string().datetime().optional(),
  contentMd: z.string().max(200_000).optional(),
  tags: TagList.optional(),
  participantUserIds: z.array(z.number().int().positive()).max(60).optional(),
});

const UpdateBody = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  metAt: z.string().datetime().optional(),
  contentMd: z.string().max(200_000).optional(),
  tags: TagList.optional(),
  participantUserIds: z.array(z.number().int().positive()).max(60).optional(),
});

// ── 팀 인원 ────────────────────────────────────────────────────────────────

/**
 * Everyone who may legitimately appear as a participant on this team's notes:
 * the student members, plus the actively assigned mentors for a project.
 *
 * This is the whitelist the write path checks against. Without it a student
 * could name any user id as a participant — turning the meeting record into a
 * way to assert that an arbitrary person attended.
 */
async function teamRoster(
  ownerType: TeamMeetingOwnerType,
  ownerId: number,
): Promise<{ id: number; name: string; kind: "student" | "mentor" }[]> {
  if (ownerType === "project") {
    const [members, mentors] = await Promise.all([
      db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(projectMembersTable)
        .innerJoin(studentsTable, eq(studentsTable.id, projectMembersTable.studentId))
        .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
        .where(eq(projectMembersTable.projectId, ownerId)),
      db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(projectMentorsTable)
        .innerJoin(usersTable, eq(usersTable.id, projectMentorsTable.mentorUserId))
        .where(
          and(
            eq(projectMentorsTable.projectId, ownerId),
            eq(projectMentorsTable.status, "active"),
          ),
        ),
    ]);
    return [
      ...members.map((m) => ({ ...m, kind: "student" as const })),
      ...mentors.map((m) => ({ ...m, kind: "mentor" as const })),
    ];
  }
  // studies have no mentor link (design 06 §5) — members only.
  const members = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(studyMembersTable)
    .innerJoin(studentsTable, eq(studentsTable.id, studyMembersTable.studentId))
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
    .where(eq(studyMembersTable.studyId, ownerId));
  return members.map((m) => ({ ...m, kind: "student" as const }));
}

/** Replace the participant set for a meeting, rejecting anyone off the roster. */
async function setParticipants(
  meetingId: number,
  ownerType: TeamMeetingOwnerType,
  ownerId: number,
  userIds: number[],
): Promise<{ ok: true } | { ok: false; strangers: number[] }> {
  const allowed = new Set((await teamRoster(ownerType, ownerId)).map((r) => r.id));
  const wanted = Array.from(new Set(userIds));
  const strangers = wanted.filter((id) => !allowed.has(id));
  if (strangers.length) return { ok: false, strangers };

  await db
    .delete(teamMeetingParticipantsTable)
    .where(eq(teamMeetingParticipantsTable.meetingId, meetingId));
  if (wanted.length) {
    await db
      .insert(teamMeetingParticipantsTable)
      .values(wanted.map((userId) => ({ meetingId, userId })));
  }
  return { ok: true };
}

/** Participants for a page of meetings, in one query rather than N. */
async function participantsFor(
  meetingIds: number[],
): Promise<Map<number, { id: number; name: string }[]>> {
  const map = new Map<number, { id: number; name: string }[]>();
  if (!meetingIds.length) return map;
  const rows = await db
    .select({
      meetingId: teamMeetingParticipantsTable.meetingId,
      id: usersTable.id,
      name: usersTable.name,
    })
    .from(teamMeetingParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, teamMeetingParticipantsTable.userId))
    .where(inArray(teamMeetingParticipantsTable.meetingId, meetingIds));
  for (const r of rows) {
    const list = map.get(r.meetingId) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.meetingId, list);
  }
  return map;
}

// ── 목록 공통 ──────────────────────────────────────────────────────────────

const listSelect = {
  id: teamMeetingsTable.id,
  ownerType: teamMeetingsTable.ownerType,
  ownerId: teamMeetingsTable.ownerId,
  title: teamMeetingsTable.title,
  metAt: teamMeetingsTable.metAt,
  tags: teamMeetingsTable.tags,
  authorId: teamMeetingsTable.authorId,
  lastEditedBy: teamMeetingsTable.lastEditedBy,
  createdAt: teamMeetingsTable.createdAt,
  updatedAt: teamMeetingsTable.updatedAt,
  authorName: usersTable.name,
};

/** Extra WHERE clauses from the filter params, or null when a filter matches nothing. */
function filterClauses(q: z.infer<typeof ListQuery>) {
  const extra = [];
  if (q.tag) {
    // Postgres array containment. GIN would help at scale; a club's volume
    // does not need it yet and an unused index is not free.
    extra.push(sql`${teamMeetingsTable.tags} @> ARRAY[${q.tag}]::text[]`);
  }
  if (q.participantId) {
    extra.push(
      sql`EXISTS (SELECT 1 FROM team_meeting_participants tmp
                  WHERE tmp.meeting_id = ${teamMeetingsTable.id}
                    AND tmp.user_id = ${q.participantId})`,
    );
  }
  return extra;
}

async function respondList(
  res: import("express").Response,
  where: ReturnType<typeof and>,
  q: z.infer<typeof ListQuery>,
) {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(teamMeetingsTable)
    .where(where);

  const rows = await db
    .select(listSelect)
    .from(teamMeetingsTable)
    .leftJoin(usersTable, eq(usersTable.id, teamMeetingsTable.authorId))
    .where(where)
    .orderBy(desc(teamMeetingsTable.metAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  const parts = await participantsFor(rows.map((r) => r.id));
  res.json({
    items: rows.map((r) => ({
      ...r,
      metAt: r.metAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      authorName: r.authorName ?? null,
      participants: parts.get(r.id) ?? [],
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  });
}

// ── 학생 ────────────────────────────────────────────────────────────────────

router.get("/student/team-meetings", requireStudent, async (req, res) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const q = parsed.data;
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!studentId) {
    res.json({ items: [], total: 0, page: 1, pageSize: q.pageSize, totalPages: 1 });
    return;
  }

  let scope;
  if (q.ownerType && q.ownerId) {
    if (!(await studentOnTeam(studentId, q.ownerType, q.ownerId))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    scope = and(
      eq(teamMeetingsTable.ownerType, q.ownerType),
      eq(teamMeetingsTable.ownerId, q.ownerId),
    );
  } else {
    const [projectIds, studyIds] = await Promise.all([
      studentProjectIds(studentId),
      studentStudyIds(studentId),
    ]);
    if (!projectIds.length && !studyIds.length) {
      res.json({ items: [], total: 0, page: 1, pageSize: q.pageSize, totalPages: 1 });
      return;
    }
    // An empty id list must contribute `false`, never an unconstrained branch —
    // an `inArray(col, [])` that degenerates to TRUE would hand this student
    // every team's notes.
    scope = or(
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
  await respondList(res, and(scope, ...filterClauses(q)), q);
});

/**
 * Filter options for one team: the tags already in use and who may be named as
 * a participant. Both come from the team itself — there is no global tag list,
 * because there is no global meaning to a team's tags (design 06 §3).
 */
router.get("/student/team-meetings/meta", requireStudent, async (req, res) => {
  const ownerType = req.query.ownerType;
  const ownerId = Number(req.query.ownerId);
  if (!isTeamMeetingOwnerType(ownerType) || !Number.isFinite(ownerId)) {
    res.status(400).json({ error: "ownerType/ownerId required" });
    return;
  }
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!studentId || !(await studentOnTeam(studentId, ownerType, ownerId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [tagRows, roster] = await Promise.all([
    db
      .select({ tag: sql<string>`unnest(${teamMeetingsTable.tags})` })
      .from(teamMeetingsTable)
      .where(
        and(
          eq(teamMeetingsTable.ownerType, ownerType),
          eq(teamMeetingsTable.ownerId, ownerId),
        ),
      ),
    teamRoster(ownerType, ownerId),
  ]);
  res.json({
    tags: Array.from(new Set(tagRows.map((r) => r.tag))).sort((a, b) =>
      a.localeCompare(b, "ko"),
    ),
    roster,
  });
});

router.get("/student/team-meetings/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const studentId = await getStudentIdForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !studentId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select({ ...listSelect, contentMd: teamMeetingsTable.contentMd })
    .from(teamMeetingsTable)
    .leftJoin(usersTable, eq(usersTable.id, teamMeetingsTable.authorId))
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (
    !row ||
    !(await studentOnTeam(studentId, row.ownerType as TeamMeetingOwnerType, row.ownerId))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parts = await participantsFor([row.id]);
  res.json({
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName ?? null,
    participants: parts.get(row.id) ?? [],
  });
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
      tags: d.tags ?? [],
      authorId: req.sessionUser!.id,
      lastEditedBy: req.sessionUser!.id,
    })
    .returning();

  if (d.participantUserIds?.length) {
    const r = await setParticipants(row.id, d.ownerType, d.ownerId, d.participantUserIds);
    if (!r.ok) {
      // The note is already written; rather than leave a half-saved record,
      // undo it and tell the caller which ids were not on the team.
      await db.delete(teamMeetingsTable).where(eq(teamMeetingsTable.id, row.id));
      res.status(422).json({
        error: "팀에 속하지 않은 사람은 참여자로 넣을 수 없습니다.",
        strangers: r.strangers,
      });
      return;
    }
  }
  const parts = await participantsFor([row.id]);
  // 타임라인 (설계 07). 회의록을 남긴 것은 학생이 한 일이다. 참여자 전원이
  // 아니라 작성자에게만 남긴다 — 참여자 목록은 "누가 그 자리에 있었나"를
  // 작성자가 적은 것이라, 그걸 각자의 활동기록으로 바꾸면 남이 쓴 명단이
  // 내 기록이 된다.
  void recordActivity({
    studentId,
    sourceType: "project",
    sourceId: row.id,
    title: `팀 회의록 — ${row.title}`,
    activityDate: row.metAt,
  });
  res.status(201).json({
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: req.sessionUser!.name,
    participants: parts.get(row.id) ?? [],
  });
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
  if (!target || !(await studentOnTeam(studentId, target.ownerType, target.ownerId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const d = parsed.data;
  if (d.participantUserIds) {
    const r = await setParticipants(id, target.ownerType, target.ownerId, d.participantUserIds);
    if (!r.ok) {
      res.status(422).json({
        error: "팀에 속하지 않은 사람은 참여자로 넣을 수 없습니다.",
        strangers: r.strangers,
      });
      return;
    }
  }

  const [row] = await db
    .update(teamMeetingsTable)
    .set({
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.metAt !== undefined ? { metAt: new Date(d.metAt) } : {}),
      ...(d.contentMd !== undefined ? { contentMd: d.contentMd } : {}),
      ...(d.tags !== undefined ? { tags: d.tags } : {}),
      lastEditedBy: req.sessionUser!.id,
      updatedAt: new Date(),
    })
    .where(eq(teamMeetingsTable.id, id))
    .returning();
  const parts = await participantsFor([id]);
  res.json({
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: null,
    participants: parts.get(id) ?? [],
  });
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
  if (!target || !(await studentOnTeam(studentId, target.ownerType, target.ownerId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Participants cascade with the meeting row.
  await db.delete(teamMeetingsTable).where(eq(teamMeetingsTable.id, id));
  // No audit() call — see design 06 §9.
  res.json({ ok: true });
});

// ── 멘토 ────────────────────────────────────────────────────────────────────

/**
 * Read-only. Assigned projects only — `studies` has no mentor concept
 * (no `study_mentors` table), so study notes never appear here (design 06 §5).
 */
router.get("/mentor/team-meetings", requireMentor, async (req, res) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const q = parsed.data;
  const mentorId = req.sessionUser!.id;
  const asked = req.query.projectId ? Number(req.query.projectId) : q.ownerId ?? null;

  if (asked !== null) {
    if (!Number.isFinite(asked) || !(await mentorOwnsProject(mentorId, asked))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }
  const ids = asked !== null ? [asked] : await getMentorProjectIds(mentorId);
  if (!ids.length) {
    res.json({ items: [], total: 0, page: 1, pageSize: q.pageSize, totalPages: 1 });
    return;
  }
  await respondList(
    res,
    and(
      eq(teamMeetingsTable.ownerType, "project"),
      inArray(teamMeetingsTable.ownerId, ids),
      ...filterClauses(q),
    ),
    q,
  );
});

router.get("/mentor/team-meetings/:id", requireMentor, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select({ ...listSelect, contentMd: teamMeetingsTable.contentMd })
    .from(teamMeetingsTable)
    .leftJoin(usersTable, eq(usersTable.id, teamMeetingsTable.authorId))
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (
    !row ||
    row.ownerType !== "project" ||
    !(await mentorOwnsProject(req.sessionUser!.id, row.ownerId))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parts = await participantsFor([row.id]);
  res.json({
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName ?? null,
    participants: parts.get(row.id) ?? [],
  });
});

// ── 운영진 ──────────────────────────────────────────────────────────────────

/** Read-only. Ops does not edit a team's own record of what they decided. */
router.get("/admin/team-meetings", requireAdmin, async (req, res) => {
  if (req.query.ownerType && !isTeamMeetingOwnerType(req.query.ownerType)) {
    res.status(400).json({ error: "Invalid ownerType" });
    return;
  }
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const q = parsed.data;
  const scope =
    q.ownerType && q.ownerId
      ? and(
          eq(teamMeetingsTable.ownerType, q.ownerType),
          eq(teamMeetingsTable.ownerId, q.ownerId),
        )
      : undefined;
  await respondList(res, and(scope, ...filterClauses(q)), q);
});

router.get("/admin/team-meetings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select({ ...listSelect, contentMd: teamMeetingsTable.contentMd })
    .from(teamMeetingsTable)
    .leftJoin(usersTable, eq(usersTable.id, teamMeetingsTable.authorId))
    .where(eq(teamMeetingsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parts = await participantsFor([row.id]);
  res.json({
    ...row,
    metAt: row.metAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName ?? null,
    participants: parts.get(row.id) ?? [],
  });
});

export default router;
