import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  studentsTable,
  studentCohortsTable,
  studentProgramsTable,
  cohortsTable,
  programsTable,
  sessionsTable,
  attendanceRecordsTable,
  assignmentsTable,
  assignmentSubmissionsTable,
  announcementsTable,
  SUBMISSION_STATUSES,
} from "@workspace/db";
import { requireStudent } from "../lib/auth";

const router: IRouter = Router();

async function getStudentForUser(userId: number) {
  const [s] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);
  return s ?? null;
}

router.get("/student/me", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.status(404).json({ error: "Student profile not found" });
    return;
  }
  const cohorts = await db
    .select({
      id: cohortsTable.id,
      name: cohortsTable.name,
      status: cohortsTable.status,
    })
    .from(studentCohortsTable)
    .innerJoin(cohortsTable, eq(studentCohortsTable.cohortId, cohortsTable.id))
    .where(eq(studentCohortsTable.studentId, student.id));
  const programs = await db
    .select({
      id: programsTable.id,
      cohortId: programsTable.cohortId,
      name: programsTable.name,
      status: programsTable.status,
    })
    .from(studentProgramsTable)
    .innerJoin(programsTable, eq(studentProgramsTable.programId, programsTable.id))
    .where(eq(studentProgramsTable.studentId, student.id));
  res.json({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      school: student.school,
      isActive: student.isActive,
    },
    cohorts,
    programs,
  });
});

async function getMembership(studentId: number) {
  const cohortIds = (
    await db
      .select({ id: studentCohortsTable.cohortId })
      .from(studentCohortsTable)
      .where(eq(studentCohortsTable.studentId, studentId))
  ).map((r) => r.id);
  const programIds = (
    await db
      .select({ id: studentProgramsTable.programId })
      .from(studentProgramsTable)
      .where(eq(studentProgramsTable.studentId, studentId))
  ).map((r) => r.id);
  return { cohortIds, programIds };
}

router.get("/student/sessions", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const { cohortIds, programIds } = await getMembership(student.id);
  if (cohortIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }
  // Sessions belonging to my cohorts; if a session has programId, only include if I'm in that program.
  // Explicit projection: internal planning fields (ownerId, prepStatus,
  // checklistDocumentId, materials, isPublished) MUST NOT leak to students.
  const rows = await db
    .select({
      id: sessionsTable.id,
      cohortId: sessionsTable.cohortId,
      programId: sessionsTable.programId,
      title: sessionsTable.title,
      description: sessionsTable.description,
      scheduledAt: sessionsTable.scheduledAt,
      durationMinutes: sessionsTable.durationMinutes,
      locationOrLink: sessionsTable.locationOrLink,
      sessionType: sessionsTable.sessionType,
      status: sessionsTable.status,
    })
    .from(sessionsTable)
    .where(
      and(
        inArray(sessionsTable.cohortId, cohortIds),
        or(
          sql`${sessionsTable.programId} is null`,
          programIds.length > 0
            ? inArray(sessionsTable.programId, programIds)
            : sql`false`,
        ),
        eq(sessionsTable.isPublished, true),
      ),
    )
    .orderBy(asc(sessionsTable.scheduledAt));
  res.json({
    items: rows.map((r) => ({
      ...r,
      scheduledAt: r.scheduledAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.get("/student/attendance", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], summary: { present: 0, late: 0, absent: 0, excused: 0, total: 0 } });
    return;
  }
  const records = await db
    .select({
      id: attendanceRecordsTable.id,
      sessionId: attendanceRecordsTable.sessionId,
      sessionTitle: sessionsTable.title,
      scheduledAt: sessionsTable.scheduledAt,
      status: attendanceRecordsTable.status,
      note: attendanceRecordsTable.note,
    })
    .from(attendanceRecordsTable)
    .innerJoin(sessionsTable, eq(attendanceRecordsTable.sessionId, sessionsTable.id))
    .where(eq(attendanceRecordsTable.studentId, student.id))
    .orderBy(desc(sessionsTable.scheduledAt));
  const summary = {
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    excused: records.filter((r) => r.status === "excused").length,
    total: records.length,
  };
  res.json({
    items: records.map((r) => ({
      ...r,
      scheduledAt: r.scheduledAt.toISOString(),
    })),
    summary,
  });
});

router.get("/student/assignments", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const { cohortIds, programIds } = await getMembership(student.id);
  if (cohortIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }
  const list = await db
    .select()
    .from(assignmentsTable)
    .where(
      and(
        inArray(assignmentsTable.cohortId, cohortIds),
        or(
          sql`${assignmentsTable.programId} is null`,
          programIds.length > 0
            ? inArray(assignmentsTable.programId, programIds)
            : sql`false`,
        ),
        // students never see drafts
        or(
          eq(assignmentsTable.status, "published"),
          eq(assignmentsTable.status, "closed"),
        ),
      ),
    )
    .orderBy(desc(assignmentsTable.createdAt));
  // Attach my submission per assignment
  const ids = list.map((a) => a.id);
  const subs =
    ids.length > 0
      ? await db
          .select()
          .from(assignmentSubmissionsTable)
          .where(
            and(
              eq(assignmentSubmissionsTable.studentId, student.id),
              inArray(assignmentSubmissionsTable.assignmentId, ids),
            ),
          )
      : [];
  const subMap = new Map(subs.map((s) => [s.assignmentId, s]));
  res.json({
    items: list.map((a) => {
      const sub = subMap.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        status: a.status,
        cohortId: a.cohortId,
        programId: a.programId,
        mySubmission: sub
          ? {
              id: sub.id,
              status: sub.status,
              submittedAt: sub.submittedAt
                ? sub.submittedAt.toISOString()
                : null,
              feedback: sub.feedback,
            }
          : null,
      };
    }),
    total: list.length,
  });
});

router.get(
  "/student/assignments/:id",
  requireStudent,
  async (req, res) => {
    const me = req.sessionUser!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const student = await getStudentForUser(me.id);
    if (!student) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [a] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { cohortIds, programIds } = await getMembership(student.id);
    if (!cohortIds.includes(a.cohortId)) {
      res.status(403).json({ error: "Not assigned" });
      return;
    }
    if (a.programId && !programIds.includes(a.programId)) {
      res.status(403).json({ error: "Not assigned" });
      return;
    }
    if (a.status === "draft") {
      res.status(403).json({ error: "Not yet published" });
      return;
    }
    const [mySub] = await db
      .select()
      .from(assignmentSubmissionsTable)
      .where(
        and(
          eq(assignmentSubmissionsTable.assignmentId, id),
          eq(assignmentSubmissionsTable.studentId, student.id),
        ),
      )
      .limit(1);
    res.json({
      assignment: {
        ...a,
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      },
      mySubmission: mySub
        ? {
            ...mySub,
            submittedAt: mySub.submittedAt
              ? mySub.submittedAt.toISOString()
              : null,
            updatedAt: mySub.updatedAt.toISOString(),
          }
        : null,
    });
  },
);

const SubmissionBody = z.object({
  content: z.string().max(8000).nullable().optional(),
  fileUrl: z.string().url().max(2000).nullable().optional(),
  externalUrl: z.string().url().max(2000).nullable().optional(),
});

router.post(
  "/student/assignments/:id/submission",
  requireStudent,
  async (req, res) => {
    const me = req.sessionUser!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = SubmissionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    if (
      !parsed.data.content &&
      !parsed.data.fileUrl &&
      !parsed.data.externalUrl
    ) {
      res
        .status(400)
        .json({ error: "Provide content, fileUrl, or externalUrl" });
      return;
    }
    const student = await getStudentForUser(me.id);
    if (!student) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [a] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { cohortIds, programIds } = await getMembership(student.id);
    if (!cohortIds.includes(a.cohortId)) {
      res.status(403).json({ error: "Not assigned" });
      return;
    }
    if (a.programId && !programIds.includes(a.programId)) {
      res.status(403).json({ error: "Not assigned" });
      return;
    }
    if (a.status === "draft") {
      res.status(403).json({ error: "Not yet published" });
      return;
    }
    if (a.status !== "published") {
      // closed or any other non-open state — student has access but the
      // assignment no longer accepts submissions
      res.status(409).json({ error: "Assignment is closed for submissions" });
      return;
    }
    const now = new Date();
    let submissionStatus: (typeof SUBMISSION_STATUSES)[number] = "submitted";
    if (a.dueAt && a.dueAt.getTime() < now.getTime()) submissionStatus = "late";
    const [row] = await db
      .insert(assignmentSubmissionsTable)
      .values({
        assignmentId: id,
        studentId: student.id,
        content: parsed.data.content ?? null,
        fileUrl: parsed.data.fileUrl ?? null,
        externalUrl: parsed.data.externalUrl ?? null,
        status: submissionStatus,
        submittedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          assignmentSubmissionsTable.assignmentId,
          assignmentSubmissionsTable.studentId,
        ],
        set: {
          content: parsed.data.content ?? null,
          fileUrl: parsed.data.fileUrl ?? null,
          externalUrl: parsed.data.externalUrl ?? null,
          status: submissionStatus,
          submittedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    res.json({
      ...row,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

router.get("/student/announcements", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const { cohortIds, programIds } = await getMembership(student.id);
  // Filter: target=all OR (target=cohort AND id in mine) OR (target=program AND id in mine)
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(
      and(
        eq(announcementsTable.isPublished, true),
        or(
          eq(announcementsTable.targetType, "all"),
          and(
            eq(announcementsTable.targetType, "cohort"),
            cohortIds.length > 0
              ? inArray(announcementsTable.targetId, cohortIds)
              : sql`false`,
          ),
          and(
            eq(announcementsTable.targetType, "program"),
            programIds.length > 0
              ? inArray(announcementsTable.targetId, programIds)
              : sql`false`,
          ),
        ),
      ),
    )
    .orderBy(desc(announcementsTable.publishedAt));
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      targetType: r.targetType,
      targetId: r.targetId,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    })),
    total: rows.length,
  });
});

export default router;
