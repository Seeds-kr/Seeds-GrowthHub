import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  studentsTable,
  studentCohortsTable,
  studiesTable,
  studyMembersTable,
  STUDY_PUBLIC_STATUSES,
  projectMembersTable,
  reflectionsTable,
  mvp4ArtifactsTable,
  feedbackTable,
  usersTable,
  cohortsTable,
  REFLECTION_TYPES,
  REFLECTION_VISIBILITIES,
} from "@workspace/db";
import { requireStudent } from "../lib/auth";
import { recordActivity } from "../lib/activity";

const router: IRouter = Router();

/**
 * Student-side Growth surfaces: My Studies, My Reflections, My Feedback.
 *
 * ⚠️ ADR-001 — THE MISSING FILE IS THE POINT.
 * There is no `admin-reflections.ts` and there must never be one. Reflections
 * are reachable only through the routes below, all of which are hard-scoped to
 * `studentId = me`. Ops sees a reflection only when the student themselves
 * chose `cohort_visible`, and even then only via a cohort-scoped read — never
 * a bulk listing. If you find yourself needing "all reflections", the correct
 * answer is `project_status_checks`, not a wider query here.
 */

async function getStudentForUser(userId: number) {
  const [s] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);
  return s ?? null;
}

async function getCohortIds(studentId: number): Promise<number[]> {
  return (
    await db
      .select({ id: studentCohortsTable.cohortId })
      .from(studentCohortsTable)
      .where(eq(studentCohortsTable.studentId, studentId))
  ).map((r) => r.id);
}

// ---- My Studies ----------------------------------------------------------

router.get("/student/studies", requireStudent, async (req, res) => {
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const cohortIds = await getCohortIds(student.id);
  const myStudyIds = (
    await db
      .select({ id: studyMembersTable.studyId })
      .from(studyMembersTable)
      .where(eq(studyMembersTable.studentId, student.id))
  ).map((r) => r.id);

  // Studies are cohort-open (design/03 §4): my studies ∪ same-cohort studies.
  //
  // BUT only for statuses the cohort is allowed to browse. `proposed` and
  // `rejected` are the request lane (design 06 §10) and must NOT ride along on
  // the cohort branch — a proposal still under review is not the cohort's
  // business, and a rejection is the proposer's alone. Those two reach exactly
  // the student who owns them, via the membership branch.
  const conditions = [];
  if (myStudyIds.length > 0) conditions.push(inArray(studiesTable.id, myStudyIds));
  // The proposer is added as leader + member on create, so the membership
  // branch already covers "my own proposal" — this catches the edge where a
  // membership row was removed but the proposal is still theirs.
  conditions.push(eq(studiesTable.leaderStudentId, student.id));
  if (cohortIds.length > 0)
    conditions.push(
      and(
        inArray(studiesTable.cohortId, cohortIds),
        inArray(studiesTable.status, [...STUDY_PUBLIC_STATUSES]),
      ),
    );
  if (conditions.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const rows = await db
    .select({
      id: studiesTable.id,
      title: studiesTable.title,
      topic: studiesTable.topic,
      status: studiesTable.status,
      cohortId: studiesTable.cohortId,
      cohortName: cohortsTable.name,
      leaderStudentId: studiesTable.leaderStudentId,
      description: studiesTable.description,
      reviewNote: studiesTable.reviewNote,
      reviewedAt: studiesTable.reviewedAt,
    })
    .from(studiesTable)
    .leftJoin(cohortsTable, eq(studiesTable.cohortId, cohortsTable.id))
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(studiesTable.id));

  const memberSet = new Set(myStudyIds);
  res.json({
    items: rows.map((r) => ({ ...r, isMember: memberSet.has(r.id) })),
    total: rows.length,
  });
});

router.get("/student/studies/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [study] = await db
    .select()
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [membership] = await db
    .select({ id: studyMembersTable.id })
    .from(studyMembersTable)
    .where(
      and(
        eq(studyMembersTable.studyId, id),
        eq(studyMembersTable.studentId, student.id),
      ),
    )
    .limit(1);
  const cohortIds = await getCohortIds(student.id);
  // Same split as the list route: the cohort branch only opens studies whose
  // status the cohort may browse. Without this, `proposed`/`rejected` would be
  // readable by anyone in the same cohort — including the reviewer's rejection
  // note, which is addressed to the proposer and nobody else.
  const isMine = study.leaderStudentId === student.id;
  const cohortMaySee =
    cohortIds.includes(study.cohortId) &&
    (STUDY_PUBLIC_STATUSES as readonly string[]).includes(study.status);
  if (!membership && !isMine && !cohortMaySee) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const members = await db
    .select({
      id: studyMembersTable.id,
      studentId: studyMembersTable.studentId,
      studentName: studentsTable.name,
      role: studyMembersTable.role,
    })
    .from(studyMembersTable)
    .innerJoin(studentsTable, eq(studyMembersTable.studentId, studentsTable.id))
    .where(eq(studyMembersTable.studyId, id));

  // Mirrors the established /student/artifacts rules exactly (student-mvp4.ts):
  //   1) Mine — any visibility EXCEPT admin_only
  //   2) A study I'm a member of — student_visible | cohort_visible
  //   3) A study merely in my cohort — cohort_visible ONLY
  // All of it lives in the WHERE clause: visibility-policy §6 forbids filtering
  // in JS afterwards, because counts and aggregates leak what the filter hides.
  const visibilityConds = [
    and(
      eq(mvp4ArtifactsTable.studentId, student.id),
      sql`${mvp4ArtifactsTable.visibility} <> 'admin_only'`,
    ),
  ];
  if (membership) {
    visibilityConds.push(
      inArray(mvp4ArtifactsTable.visibility, ["student_visible", "cohort_visible"]),
    );
  } else {
    visibilityConds.push(eq(mvp4ArtifactsTable.visibility, "cohort_visible"));
  }

  const artifacts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(
      and(eq(mvp4ArtifactsTable.studyId, id), or(...visibilityConds)),
    )
    .orderBy(desc(mvp4ArtifactsTable.createdAt));

  res.json({
    study: {
      ...study,
      startedAt: study.startedAt ? study.startedAt.toISOString() : null,
      endedAt: study.endedAt ? study.endedAt.toISOString() : null,
      createdAt: study.createdAt.toISOString(),
      updatedAt: study.updatedAt.toISOString(),
    },
    isMember: Boolean(membership),
    members,
    artifacts: artifacts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
  });
});

// ---- 스터디 개설 요청 (design 06 §10) --------------------------------------

/**
 * A student proposes a study; ops with the `growth` role approves it
 * (`admin-studies.ts`). Until then it sits at `proposed` and only the proposer
 * sees it.
 *
 * Everything the student writes here is what the study runs with once approved
 * — that is why this is a `studies` row from the start rather than a request
 * object to be copied across later.
 */
const StudyProposalBody = z.object({
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  weeklyPlanMd: z.string().max(60000).optional(),
  cohortId: z.number().int().positive().optional(),
});

router.post("/student/studies", requireStudent, async (req, res) => {
  const parsed = StudyProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const cohortIds = await getCohortIds(student.id);
  if (cohortIds.length === 0) {
    res.status(422).json({ error: "소속된 기수가 없어 스터디를 제안할 수 없습니다." });
    return;
  }
  const d = parsed.data;
  // A student may only propose into a cohort they belong to. Unstated means
  // their (only / most recent) cohort rather than an error — most students have
  // exactly one, and making them pick from a list of one is noise.
  const cohortId = d.cohortId ?? cohortIds[0];
  if (!cohortIds.includes(cohortId)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // One open proposal at a time. Without this a student can flood the review
  // queue, and the queue is a person's attention.
  const [pending] = await db
    .select({ id: studiesTable.id })
    .from(studiesTable)
    .where(
      and(
        eq(studiesTable.leaderStudentId, student.id),
        eq(studiesTable.status, "proposed"),
      ),
    )
    .limit(1);
  if (pending) {
    res.status(409).json({
      error: "이미 심사 중인 제안이 있습니다. 결과를 받은 뒤 다시 제안해 주세요.",
      pendingStudyId: pending.id,
    });
    return;
  }

  const [row] = await db
    .insert(studiesTable)
    .values({
      cohortId,
      title: d.title,
      topic: d.topic ?? null,
      description: d.description ?? null,
      weeklyPlanMd: d.weeklyPlanMd ?? "",
      leaderStudentId: student.id,
      status: "proposed",
    })
    .returning();

  // The proposer joins their own study. Otherwise an approved study starts with
  // nobody in it and the leader has to be added by hand.
  await db
    .insert(studyMembersTable)
    .values({ studyId: row.id, studentId: student.id, role: "스터디장" });

  res.status(201).json({
    ...row,
    startedAt: null,
    endedAt: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: null,
  });
});

/** Withdraw an own proposal while it is still pending. */
router.delete("/student/studies/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [study] = await db
    .select()
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  // Only an own, still-pending proposal. An approved study is the cohort's now,
  // not the proposer's to delete.
  if (!study || study.leaderStudentId !== student.id || study.status !== "proposed") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(studyMembersTable).where(eq(studyMembersTable.studyId, id));
  await db.delete(studiesTable).where(eq(studiesTable.id, id));
  res.json({ ok: true });
});

// ---- My Reflections ------------------------------------------------------

const ReflectionBody = z.object({
  reflectionType: z.enum(REFLECTION_TYPES).optional(),
  targetType: z.enum(["project", "study", "session", "cohort"]).nullable().optional(),
  targetId: z.number().int().positive().nullable().optional(),
  title: z.string().max(300).nullable().optional(),
  contentMd: z.string().trim().min(1).max(60000),
  visibility: z.enum(REFLECTION_VISIBILITIES).optional(),
  reflectedOn: z.string().date().nullable().optional(),
});

router.get("/student/reflections", requireStudent, async (req, res) => {
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  // Own reflections at EVERY visibility — the student always sees all of theirs.
  const rows = await db
    .select()
    .from(reflectionsTable)
    .where(eq(reflectionsTable.studentId, student.id))
    .orderBy(desc(reflectionsTable.createdAt));
  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/student/reflections", requireStudent, async (req, res) => {
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.status(404).json({ error: "Student profile not found" });
    return;
  }
  const parsed = ReflectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(reflectionsTable)
    .values({
      // studentId is taken from the session, never from the body — a student
      // cannot author a reflection "as" someone else.
      studentId: student.id,
      reflectionType: d.reflectionType ?? "personal",
      targetType: d.targetType ?? null,
      targetId: d.targetId ?? null,
      title: d.title ?? null,
      contentMd: d.contentMd,
      visibility: d.visibility ?? "private",
      reflectedOn: d.reflectedOn ?? null,
    })
    .returning();
  // 타임라인 (설계 07). 회고를 "썼다"는 사실만 남기고 내용은 넣지 않는다 —
  // ADR-001 이 회고 본문을 학생 소유로 못박았는데, 타임라인은 운영진도 리포트로
  // 읽는 자리라 본문이 섞이면 그 보장이 옆문으로 뚫린다.
  void recordActivity({
    studentId: student.id,
    sourceType: "project",
    sourceId: row.id,
    title: "회고 작성",
  });
  res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.patch("/student/reflections/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = ReflectionBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.contentMd !== undefined) update.contentMd = d.contentMd;
  if (d.title !== undefined) update.title = d.title;
  if (d.reflectionType !== undefined) update.reflectionType = d.reflectionType;
  if (d.reflectedOn !== undefined) update.reflectedOn = d.reflectedOn;
  // Narrowing is always allowed — ADR-001 §5.3 explicitly permits taking a
  // reflection back. No audit entry is written for reflections either.
  if (d.visibility !== undefined) update.visibility = d.visibility;

  const [row] = await db
    .update(reflectionsTable)
    .set(update)
    .where(
      and(
        eq(reflectionsTable.id, id),
        // Ownership is in the WHERE clause, not a post-fetch check.
        eq(reflectionsTable.studentId, student.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

/** Hard delete is allowed: a reflection is the student's, not an audit record. */
router.delete("/student/reflections/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!Number.isFinite(id) || !student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .delete(reflectionsTable)
    .where(
      and(
        eq(reflectionsTable.id, id),
        eq(reflectionsTable.studentId, student.id),
      ),
    )
    .returning({ id: reflectionsTable.id });
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});


/**
 * Reflections OTHERS have shared with me.
 *
 * ADR-001 boundary, stated precisely: a student choosing a wider visibility must
 * actually reach that audience, otherwise the picker lies. What ADR-001 forbids
 * is an OPS BULK LISTING — not a peer seeing what a peer deliberately published.
 *
 * So this endpoint exists for students, and a mentor-side equivalent exists for
 * assigned mentors. There is still NO ops surface of any kind.
 *
 * Levels are cumulative narrow → wide, and each viewer relationship admits only
 * the levels at or above its own threshold:
 *   - team member  → team_visible | mentor_visible | cohort_visible
 *   - same cohort  → cohort_visible only
 * `private` is never returned to anyone but the owner.
 */
router.get("/student/reflections/shared", requireStudent, async (req, res) => {
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }

  const cohortIds = await getCohortIds(student.id);

  // Teammates = students sharing a project or a study with me.
  const myProjectIds = (
    await db
      .select({ id: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.studentId, student.id))
  ).map((r) => r.id);
  const myStudyIds = (
    await db
      .select({ id: studyMembersTable.studyId })
      .from(studyMembersTable)
      .where(eq(studyMembersTable.studentId, student.id))
  ).map((r) => r.id);

  const teammateIds = new Set<number>();
  if (myProjectIds.length > 0) {
    for (const r of await db
      .select({ id: projectMembersTable.studentId })
      .from(projectMembersTable)
      .where(inArray(projectMembersTable.projectId, myProjectIds)))
      teammateIds.add(r.id);
  }
  if (myStudyIds.length > 0) {
    for (const r of await db
      .select({ id: studyMembersTable.studentId })
      .from(studyMembersTable)
      .where(inArray(studyMembersTable.studyId, myStudyIds)))
      teammateIds.add(r.id);
  }
  teammateIds.delete(student.id);

  // Same-cohort students, excluding me.
  const cohortStudentIds = new Set<number>();
  if (cohortIds.length > 0) {
    for (const r of await db
      .select({ id: studentCohortsTable.studentId })
      .from(studentCohortsTable)
      .where(inArray(studentCohortsTable.cohortId, cohortIds)))
      cohortStudentIds.add(r.id);
  }
  cohortStudentIds.delete(student.id);

  const conds = [];
  if (teammateIds.size > 0) {
    conds.push(
      and(
        inArray(reflectionsTable.studentId, Array.from(teammateIds)),
        inArray(reflectionsTable.visibility, [
          "team_visible",
          "mentor_visible",
          "cohort_visible",
        ]),
      ),
    );
  }
  if (cohortStudentIds.size > 0) {
    conds.push(
      and(
        inArray(reflectionsTable.studentId, Array.from(cohortStudentIds)),
        eq(reflectionsTable.visibility, "cohort_visible"),
      ),
    );
  }
  if (conds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const rows = await db
    .select({
      id: reflectionsTable.id,
      studentId: reflectionsTable.studentId,
      authorName: studentsTable.name,
      reflectionType: reflectionsTable.reflectionType,
      title: reflectionsTable.title,
      contentMd: reflectionsTable.contentMd,
      visibility: reflectionsTable.visibility,
      createdAt: reflectionsTable.createdAt,
    })
    .from(reflectionsTable)
    .innerJoin(studentsTable, eq(reflectionsTable.studentId, studentsTable.id))
    .where(or(...conds))
    .orderBy(desc(reflectionsTable.createdAt));

  res.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: rows.length,
  });
});

// ---- My Feedback ---------------------------------------------------------

router.get("/student/feedback", requireStudent, async (req, res) => {
  const student = await getStudentForUser(req.sessionUser!.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  // Same rule as student/report.feedbackHighlights: subject is me AND the
  // author marked it student_visible. admin_only never reaches a student.
  const rows = await db
    .select({
      id: feedbackTable.id,
      targetType: feedbackTable.targetType,
      targetId: feedbackTable.targetId,
      feedbackType: feedbackTable.feedbackType,
      content: feedbackTable.content,
      authorName: usersTable.name,
      createdAt: feedbackTable.createdAt,
    })
    .from(feedbackTable)
    .leftJoin(usersTable, eq(feedbackTable.authorId, usersTable.id))
    .where(
      and(
        eq(feedbackTable.studentId, student.id),
        eq(feedbackTable.visibility, "student_visible"),
      ),
    )
    .orderBy(desc(feedbackTable.createdAt));

  res.json({
    items: rows.map((r) => ({
      ...r,
      authorName: r.authorName ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: rows.length,
  });
});

export default router;
