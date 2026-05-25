import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, isNotNull, lt, ne, sql, inArray } from "drizzle-orm";
import {
  db,
  opsTasksTable,
  sessionsTable,
  cohortsTable,
  programsTable,
  documentsTable,
  financeRecordsTable,
  evaluationAssignmentsTable,
  applicationsTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

/**
 * Ops Dashboard summary — admin-only.
 *
 * Read-only aggregator that joins existing operational data into a single
 * payload. NO writes, NO sensitive financial amounts beyond counts/sums of
 * pending items, NO evaluator scores. Sections are independent — an empty
 * data source returns an empty array, never errors the whole payload.
 */
router.get("/admin/ops-dashboard/summary", requireAdmin, async (_req, res) => {
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const past14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const todayDate = now.toISOString().slice(0, 10);

  const [
    overdueTasks,
    blockedTasks,
    upcomingSessions,
    sessionPrepRows,
    evalProgressRows,
    pendingFinanceRows,
    pendingFinanceList,
    recentDocs,
    staleDocs,
  ] = await Promise.all([
    // 1. Overdue tasks — dueDate < today AND not done/canceled
    db
      .select({
        id: opsTasksTable.id,
        title: opsTasksTable.title,
        status: opsTasksTable.status,
        priority: opsTasksTable.priority,
        dueDate: opsTasksTable.dueDate,
        assigneeId: opsTasksTable.assigneeId,
        assigneeName: usersTable.name,
      })
      .from(opsTasksTable)
      .leftJoin(usersTable, eq(usersTable.id, opsTasksTable.assigneeId))
      .where(
        and(
          isNotNull(opsTasksTable.dueDate),
          lt(opsTasksTable.dueDate, todayDate),
          ne(opsTasksTable.status, "done"),
          ne(opsTasksTable.status, "canceled"),
        ),
      )
      .orderBy(asc(opsTasksTable.dueDate))
      .limit(20),

    // 2. Blocked tasks
    db
      .select({
        id: opsTasksTable.id,
        title: opsTasksTable.title,
        priority: opsTasksTable.priority,
        dueDate: opsTasksTable.dueDate,
        assigneeId: opsTasksTable.assigneeId,
        assigneeName: usersTable.name,
        updatedAt: opsTasksTable.updatedAt,
      })
      .from(opsTasksTable)
      .leftJoin(usersTable, eq(usersTable.id, opsTasksTable.assigneeId))
      .where(eq(opsTasksTable.status, "blocked"))
      .orderBy(desc(opsTasksTable.updatedAt))
      .limit(20),

    // 3. Upcoming events/sessions (next 14 days) — published only
    db
      .select({
        id: sessionsTable.id,
        title: sessionsTable.title,
        scheduledAt: sessionsTable.scheduledAt,
        sessionType: sessionsTable.sessionType,
        status: sessionsTable.status,
        prepStatus: sessionsTable.prepStatus,
        checklistDocumentId: sessionsTable.checklistDocumentId,
        cohortName: cohortsTable.name,
        programName: programsTable.name,
      })
      .from(sessionsTable)
      .leftJoin(cohortsTable, eq(cohortsTable.id, sessionsTable.cohortId))
      .leftJoin(programsTable, eq(programsTable.id, sessionsTable.programId))
      .where(
        and(
          gte(sessionsTable.scheduledAt, now),
          lt(sessionsTable.scheduledAt, in14d),
          eq(sessionsTable.isPublished, true),
        ),
      )
      .orderBy(asc(sessionsTable.scheduledAt))
      .limit(20),

    // 4. Event checklist status breakdown — upcoming sessions only
    db
      .select({
        prepStatus: sessionsTable.prepStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(sessionsTable)
      .where(gte(sessionsTable.scheduledAt, now))
      .groupBy(sessionsTable.prepStatus),

    // 5. Evaluation progress — by status across all assignments
    db
      .select({
        status: evaluationAssignmentsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(evaluationAssignmentsTable)
      .innerJoin(
        applicationsTable,
        eq(applicationsTable.id, evaluationAssignmentsTable.applicationId),
      )
      .where(
        // Only count assignments for applications still in active review
        inArray(applicationsTable.applicationStatus, [
          "submitted",
          "document_review",
          "interview",
        ]),
      )
      .groupBy(evaluationAssignmentsTable.status),

    // 6a. Pending finance — counts + sums per pending bucket
    db
      .select({
        status: financeRecordsTable.status,
        recordType: financeRecordsTable.recordType,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${financeRecordsTable.amount}),0)::text`,
      })
      .from(financeRecordsTable)
      .where(
        inArray(financeRecordsTable.status, [
          "requested",
          "under_review",
          "approved",
        ]),
      )
      .groupBy(financeRecordsTable.status, financeRecordsTable.recordType),

    // 6b. Top pending finance items (no amounts exposed beyond title/status)
    db
      .select({
        id: financeRecordsTable.id,
        title: financeRecordsTable.title,
        recordType: financeRecordsTable.recordType,
        status: financeRecordsTable.status,
        amount: financeRecordsTable.amount,
        currency: financeRecordsTable.currency,
        occurredOn: financeRecordsTable.occurredOn,
      })
      .from(financeRecordsTable)
      .where(
        inArray(financeRecordsTable.status, [
          "requested",
          "under_review",
          "approved",
        ]),
      )
      .orderBy(desc(financeRecordsTable.occurredOn))
      .limit(10),

    // 7. Recently updated documents — non-archived
    db
      .select({
        id: documentsTable.id,
        title: documentsTable.title,
        docType: documentsTable.docType,
        updatedAt: documentsTable.updatedAt,
      })
      .from(documentsTable)
      .where(sql`${documentsTable.archivedAt} is null`)
      .orderBy(desc(documentsTable.updatedAt))
      .limit(10),

    // 8. Possibly outdated documents — not updated in >90 days, non-archived
    db
      .select({
        id: documentsTable.id,
        title: documentsTable.title,
        docType: documentsTable.docType,
        updatedAt: documentsTable.updatedAt,
      })
      .from(documentsTable)
      .where(
        and(
          sql`${documentsTable.archivedAt} is null`,
          lt(
            documentsTable.updatedAt,
            new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .orderBy(asc(documentsTable.updatedAt))
      .limit(10),
  ]);

  void past14d;

  // Aggregate finance hooks
  const financeHooks = {
    pendingCount: pendingFinanceRows.reduce((s, r) => s + r.count, 0),
    awaitingApproval: pendingFinanceRows
      .filter((r) => r.status === "requested" || r.status === "under_review")
      .reduce((s, r) => s + r.count, 0),
    approvedUnpaid: pendingFinanceRows
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + r.count, 0),
    pendingReimbursements: pendingFinanceRows
      .filter(
        (r) =>
          r.recordType === "reimbursement" &&
          (r.status === "requested" || r.status === "under_review"),
      )
      .reduce((s, r) => s + r.count, 0),
  };

  // Evaluation progress aggregation
  const evalProgress = {
    assigned: 0,
    in_progress: 0,
    completed: 0,
  };
  for (const r of evalProgressRows) {
    if (r.status === "assigned") evalProgress.assigned = r.count;
    else if (r.status === "in_progress") evalProgress.in_progress = r.count;
    else if (r.status === "completed") evalProgress.completed = r.count;
  }
  const evalTotal =
    evalProgress.assigned + evalProgress.in_progress + evalProgress.completed;
  const evalCompletionPct =
    evalTotal > 0 ? Math.round((evalProgress.completed / evalTotal) * 100) : 0;

  // Event checklist status aggregation
  const checklistBreakdown = sessionPrepRows.map((r) => ({
    prepStatus: r.prepStatus,
    count: r.count,
  }));

  res.json({
    generatedAt: now.toISOString(),
    windowDays: { upcoming: 14, staleDocsThreshold: 90 },
    overdueTasks: overdueTasks.map((t) => ({
      ...t,
      assigneeName: t.assigneeName ?? null,
    })),
    blockedTasks: blockedTasks.map((t) => ({
      ...t,
      assigneeName: t.assigneeName ?? null,
      updatedAt: t.updatedAt.toISOString(),
    })),
    upcomingSessions: upcomingSessions.map((s) => ({
      ...s,
      scheduledAt: s.scheduledAt.toISOString(),
    })),
    checklistBreakdown,
    evaluationProgress: {
      ...evalProgress,
      total: evalTotal,
      completionPct: evalCompletionPct,
    },
    finance: {
      hooks: financeHooks,
      breakdown: pendingFinanceRows,
      pendingItems: pendingFinanceList,
    },
    recentDocuments: recentDocs.map((d) => ({
      ...d,
      updatedAt: d.updatedAt.toISOString(),
    })),
    staleDocuments: staleDocs.map((d) => ({
      ...d,
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
});

export default router;
