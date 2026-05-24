import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  applicationsTable,
  APPLICATION_STATUSES,
  usersTable,
  studentsTable,
  studentCohortsTable,
  cohortsTable,
  sessionsTable,
  assignmentsTable,
  assignmentSubmissionsTable,
  announcementsTable,
  programsTable,
  projectsTable,
  activityRecordsTable,
  feedbackTable,
  mvp4ArtifactsTable,
  accountActivationTokensTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    appByStatusRows,
    appLast7Row,
    activeStudentsRow,
    pendingActivationRow,
    evaluatorsRow,
    activeCohortsRow,
    cohortList,
    upcomingSessions,
    sessionsLast30Row,
    assignmentsActiveRow,
    dueSoonAssignments,
    pendingReviewRow,
    projectsActiveRow,
    activityLast30Row,
    feedbackLast30Row,
    artifactsLast30Row,
    publishedAnnRow,
    recentAnnouncements,
  ] = await Promise.all([
    db
      .select({
        status: applicationsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(applicationsTable)
      .groupBy(applicationsTable.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .where(gte(applicationsTable.submittedAt, past7d)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
      .where(and(eq(studentsTable.isActive, true), eq(usersTable.isActive, true))),
    db
      .select({ count: sql<number>`count(distinct ${accountActivationTokensTable.userId})::int` })
      .from(accountActivationTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, accountActivationTokensTable.userId))
      .where(
        and(
          eq(usersTable.isActive, false),
          isNull(accountActivationTokensTable.usedAt),
          gte(accountActivationTokensTable.expiresAt, now),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isActive, true),
          sql`(${usersTable.role} = 'mentor' or 'mentor' = ANY(${usersTable.extraRoles}))`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cohortsTable)
      .where(eq(cohortsTable.status, "active")),
    db
      .select({
        id: cohortsTable.id,
        name: cohortsTable.name,
        status: cohortsTable.status,
        startDate: cohortsTable.startDate,
        endDate: cohortsTable.endDate,
        studentCount: sql<number>`count(${studentCohortsTable.studentId})::int`,
      })
      .from(cohortsTable)
      .leftJoin(studentCohortsTable, eq(studentCohortsTable.cohortId, cohortsTable.id))
      .where(eq(cohortsTable.status, "active"))
      .groupBy(cohortsTable.id)
      .orderBy(asc(cohortsTable.startDate)),
    db
      .select({
        id: sessionsTable.id,
        title: sessionsTable.title,
        scheduledAt: sessionsTable.scheduledAt,
        sessionType: sessionsTable.sessionType,
        status: sessionsTable.status,
        cohortName: cohortsTable.name,
        programName: programsTable.name,
      })
      .from(sessionsTable)
      .leftJoin(cohortsTable, eq(cohortsTable.id, sessionsTable.cohortId))
      .leftJoin(programsTable, eq(programsTable.id, sessionsTable.programId))
      .where(
        and(
          gte(sessionsTable.scheduledAt, now),
          eq(sessionsTable.status, "scheduled"),
        ),
      )
      .orderBy(asc(sessionsTable.scheduledAt))
      .limit(5),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionsTable)
      .where(gte(sessionsTable.scheduledAt, past30d)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.status, "published")),
    db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        dueAt: assignmentsTable.dueAt,
        cohortName: cohortsTable.name,
        submissions: sql<number>`(select count(*)::int from ${assignmentSubmissionsTable} s where s.assignment_id = ${assignmentsTable.id} and s.status in ('submitted','late','reviewed'))`,
        totalStudents: sql<number>`(select count(*)::int from ${studentCohortsTable} sc where sc.cohort_id = ${assignmentsTable.cohortId})`,
      })
      .from(assignmentsTable)
      .leftJoin(cohortsTable, eq(cohortsTable.id, assignmentsTable.cohortId))
      .where(
        and(
          eq(assignmentsTable.status, "published"),
          gte(assignmentsTable.dueAt, now),
        ),
      )
      .orderBy(asc(assignmentsTable.dueAt))
      .limit(5),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(assignmentSubmissionsTable)
      .where(
        sql`${assignmentSubmissionsTable.status} in ('submitted','late')`,
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(
        sql`${projectsTable.status} in ('ideation','in_progress','submitted','presented')`,
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityRecordsTable)
      .where(gte(activityRecordsTable.createdAt, past30d)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedbackTable)
      .where(gte(feedbackTable.createdAt, past30d)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mvp4ArtifactsTable)
      .where(gte(mvp4ArtifactsTable.createdAt, past30d)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(announcementsTable)
      .where(eq(announcementsTable.isPublished, true)),
    db
      .select({
        id: announcementsTable.id,
        title: announcementsTable.title,
        targetType: announcementsTable.targetType,
        publishedAt: announcementsTable.publishedAt,
      })
      .from(announcementsTable)
      .where(eq(announcementsTable.isPublished, true))
      .orderBy(desc(announcementsTable.publishedAt))
      .limit(5),
  ]);

  // Note: in7d is currently only used by `dueSoonAssignments` indirectly via
  // the limit 5; we surface upcoming windows in the frontend description text.
  void in7d;

  const appTotal = appByStatusRows.reduce((s, r) => s + Number(r.count), 0);

  res.json({
    generatedAt: now.toISOString(),
    applications: {
      total: appTotal,
      byStatus: APPLICATION_STATUSES.map((status) => ({
        status,
        count: Number(appByStatusRows.find((r) => r.status === status)?.count ?? 0),
      })),
      last7d: Number(appLast7Row[0]?.count ?? 0),
    },
    members: {
      activeStudents: Number(activeStudentsRow[0]?.count ?? 0),
      pendingActivation: Number(pendingActivationRow[0]?.count ?? 0),
      mentors: Number(evaluatorsRow[0]?.count ?? 0),
    },
    cohorts: {
      activeCount: Number(activeCohortsRow[0]?.count ?? 0),
      active: cohortList.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        studentCount: Number(c.studentCount),
      })),
    },
    sessions: {
      upcoming: upcomingSessions.map((s) => ({
        id: s.id,
        title: s.title,
        scheduledAt: s.scheduledAt,
        sessionType: s.sessionType,
        status: s.status,
        cohortName: s.cohortName,
        programName: s.programName,
      })),
      last30dCount: Number(sessionsLast30Row[0]?.count ?? 0),
    },
    assignments: {
      activeCount: Number(assignmentsActiveRow[0]?.count ?? 0),
      pendingReview: Number(pendingReviewRow[0]?.count ?? 0),
      dueSoon: dueSoonAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt,
        cohortName: a.cohortName,
        submissions: Number(a.submissions),
        totalStudents: Number(a.totalStudents),
      })),
    },
    activity: {
      activeProjects: Number(projectsActiveRow[0]?.count ?? 0),
      activityRecordsLast30d: Number(activityLast30Row[0]?.count ?? 0),
      feedbackLast30d: Number(feedbackLast30Row[0]?.count ?? 0),
      artifactsLast30d: Number(artifactsLast30Row[0]?.count ?? 0),
    },
    announcements: {
      publishedCount: Number(publishedAnnRow[0]?.count ?? 0),
      recent: recentAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        targetType: a.targetType,
        publishedAt: a.publishedAt,
      })),
    },
    windowDays: { upcoming: 7, recent: 30 },
  });
});

export default router;
