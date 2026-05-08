import { Router, type IRouter } from "express";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  studentsTable,
  studentCohortsTable,
  studentProgramsTable,
  cohortsTable,
  programsTable,
  attendanceRecordsTable,
  sessionsTable,
  assignmentsTable,
  assignmentSubmissionsTable,
  activityRecordsTable,
  projectsTable,
  projectMembersTable,
  mvp4ArtifactsTable,
  feedbackTable,
  tagMappingsTable,
  skillTagsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

// Per-student activity report (full, includes admin_only — admin view).
router.get("/admin/students/:id/report", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, id))
    .limit(1);
  if (!student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const cohorts = await db
    .select({ id: cohortsTable.id, name: cohortsTable.name })
    .from(studentCohortsTable)
    .innerJoin(cohortsTable, eq(studentCohortsTable.cohortId, cohortsTable.id))
    .where(eq(studentCohortsTable.studentId, id));
  const programs = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(studentProgramsTable)
    .innerJoin(
      programsTable,
      eq(studentProgramsTable.programId, programsTable.id),
    )
    .where(eq(studentProgramsTable.studentId, id));
  const attendance = await db
    .select({ status: attendanceRecordsTable.status })
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.studentId, id));
  const attendanceSummary = {
    present: attendance.filter((a) => a.status === "present").length,
    late: attendance.filter((a) => a.status === "late").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    excused: attendance.filter((a) => a.status === "excused").length,
    total: attendance.length,
  };
  const submissions = await db
    .select({
      id: assignmentSubmissionsTable.id,
      assignmentId: assignmentSubmissionsTable.assignmentId,
      title: assignmentsTable.title,
      status: assignmentSubmissionsTable.status,
      submittedAt: assignmentSubmissionsTable.submittedAt,
      feedback: assignmentSubmissionsTable.feedback,
    })
    .from(assignmentSubmissionsTable)
    .innerJoin(
      assignmentsTable,
      eq(assignmentsTable.id, assignmentSubmissionsTable.assignmentId),
    )
    .where(eq(assignmentSubmissionsTable.studentId, id));
  const projects = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      status: projectsTable.status,
      role: projectMembersTable.role,
      contributionSummary: projectMembersTable.contributionSummary,
    })
    .from(projectMembersTable)
    .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
    .where(eq(projectMembersTable.studentId, id));
  const artifacts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(eq(mvp4ArtifactsTable.studentId, id));
  const feedbackHighlights = await db
    .select()
    .from(feedbackTable)
    .where(eq(feedbackTable.studentId, id));
  const timeline = await db
    .select()
    .from(activityRecordsTable)
    .where(eq(activityRecordsTable.studentId, id))
    .orderBy(sql`${activityRecordsTable.activityDate} DESC`);
  // Skill tag summary
  const tagRows = await db.execute(sql`
    WITH ar AS (
      SELECT id FROM activity_records WHERE student_id = ${id}
    ), pr AS (
      SELECT project_id AS id FROM project_members WHERE student_id = ${id}
    ), art AS (
      SELECT id FROM artifacts WHERE student_id = ${id}
    ), fb AS (
      SELECT id FROM feedback WHERE student_id = ${id}
    )
    SELECT t.id AS tag_id, t.name AS tag_name, COUNT(*)::int AS cnt
    FROM tag_mappings tm
    JOIN skill_tags t ON t.id = tm.tag_id
    WHERE
      (tm.target_type = 'activity_record' AND tm.target_id IN (SELECT id FROM ar))
      OR (tm.target_type = 'project' AND tm.target_id IN (SELECT id FROM pr))
      OR (tm.target_type = 'artifact' AND tm.target_id IN (SELECT id FROM art))
      OR (tm.target_type = 'feedback' AND tm.target_id IN (SELECT id FROM fb))
      OR (tm.target_type = 'student' AND tm.target_id = ${id})
    GROUP BY t.id, t.name
    ORDER BY cnt DESC, t.name ASC
  `);
  res.json({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      school: student.school,
      isActive: student.isActive,
    },
    cohorts,
    programs,
    attendanceSummary,
    submissions: submissions.map((s) => ({
      ...s,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    })),
    projects,
    artifacts: artifacts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    feedbackHighlights: feedbackHighlights.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    timeline: timeline.map((t) => ({
      ...t,
      activityDate: t.activityDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    skillTags: (tagRows.rows as any[]).map((r) => ({
      tagId: r.tag_id,
      name: r.tag_name,
      count: r.cnt,
    })),
  });
});

// Cohort-level summary
router.get("/admin/cohorts/:id/summary", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, id))
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const studentRows = await db
    .select({ id: studentsTable.id, name: studentsTable.name })
    .from(studentCohortsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, studentCohortsTable.studentId))
    .where(eq(studentCohortsTable.cohortId, id));
  const studentIds = studentRows.map((s) => s.id);
  const sessionRows = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(eq(sessionsTable.cohortId, id));
  const sessionIds = sessionRows.map((s) => s.id);
  const attendance =
    sessionIds.length > 0
      ? await db
          .select({ status: attendanceRecordsTable.status })
          .from(attendanceRecordsTable)
          .where(inArray(attendanceRecordsTable.sessionId, sessionIds))
      : [];
  const attendanceOverview = {
    present: attendance.filter((a) => a.status === "present").length,
    late: attendance.filter((a) => a.status === "late").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    excused: attendance.filter((a) => a.status === "excused").length,
    total: attendance.length,
  };
  const assignmentRows = await db
    .select({ id: assignmentsTable.id })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.cohortId, id));
  const assignmentIds = assignmentRows.map((a) => a.id);
  const submissionStats =
    assignmentIds.length > 0
      ? await db
          .select({
            status: assignmentSubmissionsTable.status,
            cnt: count(),
          })
          .from(assignmentSubmissionsTable)
          .where(inArray(assignmentSubmissionsTable.assignmentId, assignmentIds))
          .groupBy(assignmentSubmissionsTable.status)
      : [];
  const projectCount = await db
    .select({ cnt: count() })
    .from(projectsTable)
    .where(eq(projectsTable.cohortId, id));
  const artifactCount =
    studentIds.length > 0
      ? await db
          .select({ cnt: count() })
          .from(mvp4ArtifactsTable)
          .where(inArray(mvp4ArtifactsTable.studentId, studentIds))
      : [{ cnt: 0 }];
  // Skill tag distribution across the cohort's students
  let tagDist: { tagId: number; name: string; count: number }[] = [];
  if (studentIds.length > 0) {
    const tagRows = await db.execute(sql`
      WITH stu AS (SELECT unnest(ARRAY[${sql.join(studentIds, sql`, `)}]::int[]) AS id),
      ar AS (SELECT id FROM activity_records WHERE student_id IN (SELECT id FROM stu)),
      pr AS (SELECT project_id AS id FROM project_members WHERE student_id IN (SELECT id FROM stu)),
      art AS (SELECT id FROM artifacts WHERE student_id IN (SELECT id FROM stu)),
      fb AS (SELECT id FROM feedback WHERE student_id IN (SELECT id FROM stu))
      SELECT t.id AS tag_id, t.name AS tag_name, COUNT(*)::int AS cnt
      FROM tag_mappings tm
      JOIN skill_tags t ON t.id = tm.tag_id
      WHERE
        (tm.target_type = 'activity_record' AND tm.target_id IN (SELECT id FROM ar))
        OR (tm.target_type = 'project' AND tm.target_id IN (SELECT id FROM pr))
        OR (tm.target_type = 'artifact' AND tm.target_id IN (SELECT id FROM art))
        OR (tm.target_type = 'feedback' AND tm.target_id IN (SELECT id FROM fb))
        OR (tm.target_type = 'student' AND tm.target_id IN (SELECT id FROM stu))
      GROUP BY t.id, t.name
      ORDER BY cnt DESC, t.name ASC
    `);
    tagDist = (tagRows.rows as any[]).map((r) => ({
      tagId: r.tag_id,
      name: r.tag_name,
      count: r.cnt,
    }));
  }
  // Students with no activity records yet
  const recordedStudentIds =
    studentIds.length > 0
      ? new Set(
          (
            await db
              .selectDistinct({ id: activityRecordsTable.studentId })
              .from(activityRecordsTable)
              .where(inArray(activityRecordsTable.studentId, studentIds))
          ).map((r) => r.id),
        )
      : new Set<number>();
  const studentsMissingActivity = studentRows.filter(
    (s) => !recordedStudentIds.has(s.id),
  );
  res.json({
    cohort: {
      id: cohort.id,
      name: cohort.name,
      status: cohort.status,
    },
    studentCount: studentIds.length,
    attendanceOverview,
    submissionOverview: submissionStats.map((s) => ({
      status: s.status,
      count: s.cnt,
    })),
    projectCount: projectCount[0]?.cnt ?? 0,
    artifactCount: artifactCount[0]?.cnt ?? 0,
    skillTagDistribution: tagDist,
    studentsMissingActivity,
  });
});

export default router;
