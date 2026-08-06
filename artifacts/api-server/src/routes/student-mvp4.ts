import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  studentsTable,
  studentCohortsTable,
  studentProgramsTable,
  cohortsTable,
  programsTable,
  activityRecordsTable,
  projectsTable,
  projectMembersTable,
  mvp4ArtifactsTable,
  feedbackTable,
  tagMappingsTable,
  skillTagsTable,
  attendanceRecordsTable,
  assignmentsTable,
  assignmentSubmissionsTable,
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

async function getCohortIds(studentId: number): Promise<number[]> {
  return (
    await db
      .select({ id: studentCohortsTable.cohortId })
      .from(studentCohortsTable)
      .where(eq(studentCohortsTable.studentId, studentId))
  ).map((r) => r.id);
}

router.get("/student/timeline", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const rows = await db
    .select()
    .from(activityRecordsTable)
    .where(
      and(
        eq(activityRecordsTable.studentId, student.id),
        eq(activityRecordsTable.visibility, "student_visible"),
      ),
    )
    .orderBy(desc(activityRecordsTable.activityDate));
  // attach tags
  const ids = rows.map((r) => r.id);
  const tags = ids.length
    ? await db
        .select({
          recordId: tagMappingsTable.targetId,
          tagId: skillTagsTable.id,
          name: skillTagsTable.name,
        })
        .from(tagMappingsTable)
        .innerJoin(skillTagsTable, eq(skillTagsTable.id, tagMappingsTable.tagId))
        .where(
          and(
            eq(tagMappingsTable.targetType, "activity_record"),
            inArray(tagMappingsTable.targetId, ids),
          ),
        )
    : [];
  const tagMap = new Map<number, { id: number; name: string }[]>();
  for (const t of tags) {
    const arr = tagMap.get(t.recordId) ?? [];
    arr.push({ id: t.tagId, name: t.name });
    tagMap.set(t.recordId, arr);
  }
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      description: r.description,
      activityDate: r.activityDate.toISOString(),
      tags: tagMap.get(r.id) ?? [],
    })),
    total: rows.length,
  });
});

router.get("/student/projects", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const projectIds = (
    await db
      .select({ id: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.studentId, student.id))
  ).map((r) => r.id);
  if (projectIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }
  const rows = await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.id, projectIds))
    .orderBy(desc(projectsTable.createdAt));
  res.json({
    items: rows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      cohortId: p.cohortId,
      programId: p.programId,
      startedAt: p.startedAt ? p.startedAt.toISOString() : null,
      endedAt: p.endedAt ? p.endedAt.toISOString() : null,
    })),
    total: rows.length,
  });
});

router.get("/student/projects/:id", requireStudent, async (req, res) => {
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
  const [member] = await db
    .select()
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, id),
        eq(projectMembersTable.studentId, student.id),
      ),
    )
    .limit(1);
  if (!member) {
    res.status(403).json({ error: "Not a project member" });
    return;
  }
  const [p] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const members = await db
    .select({
      id: projectMembersTable.id,
      studentId: projectMembersTable.studentId,
      studentName: studentsTable.name,
      role: projectMembersTable.role,
    })
    .from(projectMembersTable)
    .innerJoin(studentsTable, eq(projectMembersTable.studentId, studentsTable.id))
    .where(eq(projectMembersTable.projectId, id));
  // Artifacts on this project:
  //   - own artifacts (studentId=me) at any non-admin_only visibility, OR
  //   - other members' artifacts at student_visible / cohort_visible only.
  // Never expose admin_only or other students' private artifacts.
  const arts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(
      and(
        eq(mvp4ArtifactsTable.projectId, id),
        sql`${mvp4ArtifactsTable.visibility} <> 'admin_only'`,
        or(
          eq(mvp4ArtifactsTable.studentId, student.id),
          inArray(mvp4ArtifactsTable.visibility, [
            "student_visible",
            "cohort_visible",
          ]),
        ),
      ),
    );
  // Feedback on the project (student-visible only) OR feedback specifically about
  // this student that targets this project.
  //
  // The studentId condition was missing: without it, feedback naming a specific
  // teammate was returned to every member of the project. visibility-policy §2
  // defines feedback's `student_visible` as 대상형 — readable by the ONE student
  // in `studentId` — and §5 pins the 학생 column to "대상=본인 AND student_visible".
  // A NULL studentId means the feedback is about the project itself, so it stays
  // visible to the whole team.
  const fbs = await db
    .select()
    .from(feedbackTable)
    .where(
      and(
        eq(feedbackTable.targetType, "project"),
        eq(feedbackTable.targetId, id),
        eq(feedbackTable.visibility, "student_visible"),
        or(
          isNull(feedbackTable.studentId),
          eq(feedbackTable.studentId, student.id),
        ),
      ),
    );
  const tags = await db
    .select({ id: skillTagsTable.id, name: skillTagsTable.name })
    .from(tagMappingsTable)
    .innerJoin(skillTagsTable, eq(skillTagsTable.id, tagMappingsTable.tagId))
    .where(
      and(
        eq(tagMappingsTable.targetType, "project"),
        eq(tagMappingsTable.targetId, id),
      ),
    );
  res.json({
    project: {
      id: p.id,
      title: p.title,
      description: p.description,
      problemStatement: p.problemStatement,
      solutionSummary: p.solutionSummary,
      status: p.status,
      cohortId: p.cohortId,
      programId: p.programId,
      startedAt: p.startedAt ? p.startedAt.toISOString() : null,
      endedAt: p.endedAt ? p.endedAt.toISOString() : null,
    },
    members,
    myMembership: {
      id: member.id,
      role: member.role,
      contributionSummary: member.contributionSummary,
    },
    artifacts: arts.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      artifactType: a.artifactType,
      url: a.url,
      visibility: a.visibility,
      createdAt: a.createdAt.toISOString(),
    })),
    feedback: fbs.map((f) => ({
      id: f.id,
      feedbackType: f.feedbackType,
      content: f.content,
      createdAt: f.createdAt.toISOString(),
    })),
    tags,
  });
});

router.get("/student/artifacts", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }
  const myProjectIds = (
    await db
      .select({ id: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.studentId, student.id))
  ).map((r) => r.id);
  const cohortIds = await getCohortIds(student.id);
  // Build cohort-visible artifact set: artifacts on projects whose cohort is mine
  const cohortProjectIds =
    cohortIds.length > 0
      ? (
          await db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(inArray(projectsTable.cohortId, cohortIds))
        ).map((r) => r.id)
      : [];
  // Visibility rules:
  //   1) Mine (studentId=me) — any visibility except admin_only
  //   2) On a project I'm a member of — visibility in {student_visible, cohort_visible}
  //   3) On a project in my cohort — visibility = cohort_visible
  const conds = [
    and(
      eq(mvp4ArtifactsTable.studentId, student.id),
      sql`${mvp4ArtifactsTable.visibility} <> 'admin_only'`,
    ),
  ];
  if (myProjectIds.length > 0) {
    conds.push(
      and(
        inArray(mvp4ArtifactsTable.projectId, myProjectIds),
        inArray(mvp4ArtifactsTable.visibility, [
          "student_visible",
          "cohort_visible",
        ]),
      )!,
    );
  }
  if (cohortProjectIds.length > 0) {
    conds.push(
      and(
        inArray(mvp4ArtifactsTable.projectId, cohortProjectIds),
        eq(mvp4ArtifactsTable.visibility, "cohort_visible"),
      )!,
    );
  }
  const rows = await db
    .selectDistinct()
    .from(mvp4ArtifactsTable)
    .where(or(...conds))
    .orderBy(desc(mvp4ArtifactsTable.createdAt));
  res.json({
    items: rows.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      projectId: a.projectId,
      title: a.title,
      description: a.description,
      artifactType: a.artifactType,
      url: a.url,
      visibility: a.visibility,
      createdAt: a.createdAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.get("/student/report", requireStudent, async (req, res) => {
  const me = req.sessionUser!;
  const student = await getStudentForUser(me.id);
  if (!student) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const cohorts = await db
    .select({ id: cohortsTable.id, name: cohortsTable.name })
    .from(studentCohortsTable)
    .innerJoin(cohortsTable, eq(studentCohortsTable.cohortId, cohortsTable.id))
    .where(eq(studentCohortsTable.studentId, student.id));
  const programs = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(studentProgramsTable)
    .innerJoin(programsTable, eq(studentProgramsTable.programId, programsTable.id))
    .where(eq(studentProgramsTable.studentId, student.id));
  const attendance = await db
    .select({ status: attendanceRecordsTable.status })
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.studentId, student.id));
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
    .where(eq(assignmentSubmissionsTable.studentId, student.id));
  const projectRows = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      status: projectsTable.status,
      role: projectMembersTable.role,
    })
    .from(projectMembersTable)
    .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
    .where(eq(projectMembersTable.studentId, student.id));
  // Artifacts visible to student (own + project, non-admin_only)
  const myProjectIds = projectRows.map((p) => p.id);
  const artifactConds = [
    and(
      eq(mvp4ArtifactsTable.studentId, student.id),
      sql`${mvp4ArtifactsTable.visibility} <> 'admin_only'`,
    ),
  ];
  if (myProjectIds.length > 0) {
    artifactConds.push(
      and(
        inArray(mvp4ArtifactsTable.projectId, myProjectIds),
        inArray(mvp4ArtifactsTable.visibility, [
          "student_visible",
          "cohort_visible",
        ]),
      )!,
    );
  }
  const artifacts = await db
    .selectDistinct()
    .from(mvp4ArtifactsTable)
    .where(or(...artifactConds));
  // Feedback highlights: only student_visible feedback referencing this student
  const feedbackHighlights = await db
    .select()
    .from(feedbackTable)
    .where(
      and(
        eq(feedbackTable.studentId, student.id),
        eq(feedbackTable.visibility, "student_visible"),
      ),
    );
  // Visible activity timeline
  const timeline = await db
    .select()
    .from(activityRecordsTable)
    .where(
      and(
        eq(activityRecordsTable.studentId, student.id),
        eq(activityRecordsTable.visibility, "student_visible"),
      ),
    )
    .orderBy(desc(activityRecordsTable.activityDate));
  // Tag summary across visible items
  const tagRows = await db.execute(sql`
    WITH ar AS (
      SELECT id FROM activity_records WHERE student_id = ${student.id} AND visibility = 'student_visible'
    ), pr AS (
      SELECT project_id AS id FROM project_members WHERE student_id = ${student.id}
    ), art AS (
      SELECT id FROM artifacts WHERE student_id = ${student.id} AND visibility <> 'admin_only'
    ), fb AS (
      SELECT id FROM feedback WHERE student_id = ${student.id} AND visibility = 'student_visible'
    )
    SELECT t.id AS tag_id, t.name AS tag_name, COUNT(*)::int AS cnt
    FROM tag_mappings tm
    JOIN skill_tags t ON t.id = tm.tag_id
    WHERE
      (tm.target_type = 'activity_record' AND tm.target_id IN (SELECT id FROM ar))
      OR (tm.target_type = 'project' AND tm.target_id IN (SELECT id FROM pr))
      OR (tm.target_type = 'artifact' AND tm.target_id IN (SELECT id FROM art))
      OR (tm.target_type = 'feedback' AND tm.target_id IN (SELECT id FROM fb))
      OR (tm.target_type = 'student' AND tm.target_id = ${student.id})
    GROUP BY t.id, t.name
    ORDER BY cnt DESC, t.name ASC
  `);
  res.json({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      school: student.school,
    },
    cohorts,
    programs,
    attendanceSummary,
    submissions: submissions.map((s) => ({
      ...s,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    })),
    projects: projectRows,
    artifacts: artifacts.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      artifactType: a.artifactType,
      visibility: a.visibility,
      createdAt: a.createdAt.toISOString(),
    })),
    feedbackHighlights: feedbackHighlights.map((f) => ({
      id: f.id,
      feedbackType: f.feedbackType,
      content: f.content,
      createdAt: f.createdAt.toISOString(),
    })),
    timeline: timeline.map((t) => ({
      id: t.id,
      sourceType: t.sourceType,
      title: t.title,
      description: t.description,
      activityDate: t.activityDate.toISOString(),
    })),
    skillTags: (tagRows.rows as any[]).map((r) => ({
      tagId: r.tag_id,
      name: r.tag_name,
      count: r.cnt,
    })),
  });
});

export default router;
