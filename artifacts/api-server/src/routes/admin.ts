import { Router, type IRouter } from "express";
import { createRateLimit, clientIp } from "../lib/rate-limit";
import { parseStrict } from "../lib/strict-body";
import { and, asc, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import {
  AdminLoginBody,
  UpdateApplicationBody,
} from "@workspace/api-zod";
import {
  db,
  applicationsTable,
  APPLICATION_STATUSES,
  APPLICATION_LIFECYCLE_STATUSES,
  FINAL_DECISIONS,
  type ApplicationStatus,
  type ApplicationLifecycleStatus,
  type FinalDecision,
  evaluationAssignmentsTable,
  evaluationsTable,
  interviewsTable,
  INTERVIEW_STATUSES,
  type InterviewStatus,
  decisionLogsTable,
  usersTable,
  getEffectiveRoles,
  getOpsRoles,
} from "@workspace/db";
import { audit } from "../lib/audit";
import {
  authenticateUser,
  clearSessionCookie,
  getCurrentUser,
  requireOpsRole,
  setSessionCookie,
} from "../lib/auth";

// ADR-002: 모집/선발 데이터는 recruiting 담당 + program_lead 만 접근.
const requireRecruiting = requireOpsRole("recruiting");

const router: IRouter = Router();

/**
 * Brute-force gate on the only unauthenticated credential endpoint.
 *
 * Keyed on IP **and** submitted email together. IP alone lets one attacker
 * behind a shared NAT lock out a whole office; email alone lets anyone lock a
 * known admin out of their own account by spraying failures at it. The pair
 * limits the actual attack — one source guessing one account.
 *
 * Counts every attempt, not just failures: a limiter that resets on success
 * lets an attacker interleave a known-good login to clear their budget.
 */
const loginRateLimit = createRateLimit({
  windowMs: 5 * 60_000,
  max: 10,
  keyFor: (req) => {
    const email =
      typeof (req.body as any)?.email === "string"
        ? (req.body as any).email.trim().toLowerCase()
        : "";
    return `${clientIp(req)}|${email}`;
  },
  message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});

router.post("/admin/login", loginRateLimit, async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const roles = getEffectiveRoles(user);
  setSessionCookie(res, { userId: user.id, role: user.role, roles });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles,
    opsRoles: getOpsRoles(user),
  });
});

router.post("/admin/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/admin/me", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles: getEffectiveRoles(user),
    opsRoles: getOpsRoles(user),
  });
});

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    typeof value === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}
function isLifecycleStatus(v: unknown): v is ApplicationLifecycleStatus {
  return (
    typeof v === "string" &&
    (APPLICATION_LIFECYCLE_STATUSES as readonly string[]).includes(v)
  );
}
function isFinalDecision(v: unknown): v is FinalDecision {
  return typeof v === "string" && (FINAL_DECISIONS as readonly string[]).includes(v);
}
function isInterviewStatus(v: unknown): v is InterviewStatus {
  return typeof v === "string" && (INTERVIEW_STATUSES as readonly string[]).includes(v);
}

router.get("/admin/applications/stats", requireRecruiting, async (_req, res) => {
  const rows = await db
    .select({
      // 단계 기준으로 센다. 레거시 `status` 는 단계와 결과를 섞고 있어
      // 합격자가 계속 submitted 로 잡혔다(이슈 #4).
      stage: applicationsTable.applicationStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(applicationsTable)
    .groupBy(applicationsTable.applicationStatus);
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  res.json({
    total,
    byStage: APPLICATION_LIFECYCLE_STATUSES.map((stage) => ({
      stage,
      count: Number(rows.find((r) => r.stage === stage)?.count ?? 0),
    })),
  });
});

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).replace(/\r?\n/g, " ");
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get("/admin/applications/export", requireRecruiting, async (req, res) => {
  const rows = await db
    .select()
    .from(applicationsTable)
    .orderBy(desc(applicationsTable.submittedAt));
  const headers = [
    "id",
    "name",
    "email",
    "phone",
    "school",
    "grade",
    "birth_year",
    "interest_area",
    "motivation",
    "experience",
    "problem_awareness",
    "expectation",
    "privacy_consent",
    "status",
    "application_status",
    "final_decision",
    "admin_note",
    "submitted_at",
    "updated_at",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.name,
        r.email,
        r.phone,
        r.school,
        r.grade,
        r.birthYear,
        r.interestArea,
        r.motivation,
        r.experience,
        r.problemAwareness,
        r.expectation,
        r.privacyConsent,
        r.status,
        r.applicationStatus,
        r.finalDecision,
        r.adminNote ?? "",
        r.submittedAt.toISOString(),
        r.updatedAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = "\uFEFF" + lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="seeds-applications-${new Date()
      .toISOString()
      .slice(0, 10)}.csv"`,
  );
  // Exporting the applicant roster is exactly the kind of sensitive action the
  // audit trail exists for. Row count only — never the rows themselves.
  audit({
    action: "data_export",
    req,
    targetType: "application",
    note: `applications CSV export · ${rows.length} rows`,
  });
  res.send(csv);
});

router.get("/admin/applications", requireRecruiting, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filters = [] as ReturnType<typeof eq>[];
  if (q.length > 0) {
    const like = `%${q}%`;
    const orFilter = or(
      ilike(applicationsTable.name, like),
      ilike(applicationsTable.email, like),
      ilike(applicationsTable.school, like),
    );
    if (orFilter) filters.push(orFilter);
  }
  if (isLifecycleStatus(req.query.applicationStatus)) {
    filters.push(eq(applicationsTable.applicationStatus, req.query.applicationStatus));
  }
  if (isFinalDecision(req.query.finalDecision)) {
    filters.push(eq(applicationsTable.finalDecision, req.query.finalDecision));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const apps = await db
    .select()
    .from(applicationsTable)
    .where(where)
    .orderBy(desc(applicationsTable.submittedAt))
    .limit(500);

  const ids = apps.map((a) => a.id);
  const docStage = "document_review" as const;

  // Aggregate doc-review evals per app
  type Agg = { applicationId: number; avgScore: number | null; completed: number };
  let evalAgg: Map<number, Agg> = new Map();
  if (ids.length > 0) {
    const aggRows = await db
      .select({
        applicationId: evaluationsTable.applicationId,
        avgScore: sql<number | null>`avg(${evaluationsTable.overallScore})::float`,
        completed: sql<number>`count(*)::int`,
      })
      .from(evaluationsTable)
      .where(
        and(
          inArray(evaluationsTable.applicationId, ids),
          eq(evaluationsTable.stage, docStage),
        ),
      )
      .groupBy(evaluationsTable.applicationId);
    evalAgg = new Map(
      aggRows.map((r) => [
        r.applicationId,
        { applicationId: r.applicationId, avgScore: r.avgScore, completed: Number(r.completed) },
      ]),
    );
  }

  // Aggregate doc-review assignments per app
  let assignedAgg: Map<number, number> = new Map();
  if (ids.length > 0) {
    const aRows = await db
      .select({
        applicationId: evaluationAssignmentsTable.applicationId,
        assigned: sql<number>`count(*)::int`,
      })
      .from(evaluationAssignmentsTable)
      .where(
        and(
          inArray(evaluationAssignmentsTable.applicationId, ids),
          eq(evaluationAssignmentsTable.stage, docStage),
        ),
      )
      .groupBy(evaluationAssignmentsTable.applicationId);
    assignedAgg = new Map(aRows.map((r) => [r.applicationId, Number(r.assigned)]));
  }

  // Interview status per app
  let interviewMap: Map<number, InterviewStatus> = new Map();
  if (ids.length > 0) {
    const iRows = await db
      .select({
        applicationId: interviewsTable.applicationId,
        status: interviewsTable.status,
      })
      .from(interviewsTable)
      .where(inArray(interviewsTable.applicationId, ids));
    interviewMap = new Map(iRows.map((r) => [r.applicationId, r.status]));
  }

  let items = apps.map((a) => {
    const ev = evalAgg.get(a.id);
    const assignedCount = assignedAgg.get(a.id) ?? 0;
    const completedCount = ev?.completed ?? 0;
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      school: a.school,
      grade: a.grade,
      interestArea: a.interestArea,
      status: a.status,
      applicationStatus: a.applicationStatus,
      finalDecision: a.finalDecision,
      avgDocReviewScore: ev?.avgScore ?? null,
      evaluationsAssigned: assignedCount,
      evaluationsCompleted: completedCount,
      interviewStatus: interviewMap.get(a.id) ?? ("not_scheduled" as InterviewStatus),
      submittedAt: a.submittedAt.toISOString(),
    };
  });

  // evaluationCompletion filter
  const ec = req.query.evaluationCompletion;
  if (ec === "none") {
    items = items.filter((i) => i.evaluationsCompleted === 0);
  } else if (ec === "partial") {
    items = items.filter(
      (i) => i.evaluationsCompleted > 0 && i.evaluationsCompleted < i.evaluationsAssigned,
    );
  } else if (ec === "complete") {
    items = items.filter(
      (i) => i.evaluationsAssigned > 0 && i.evaluationsCompleted >= i.evaluationsAssigned,
    );
  }
  // interviewStatus filter
  if (isInterviewStatus(req.query.interviewStatus)) {
    items = items.filter((i) => i.interviewStatus === req.query.interviewStatus);
  }

  res.json({ items, total: items.length });
});

async function loadApplicationDetail(id: number) {
  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id))
    .limit(1);
  if (!app) return null;

  const assignments = await db
    .select({
      id: evaluationAssignmentsTable.id,
      applicationId: evaluationAssignmentsTable.applicationId,
      evaluatorId: evaluationAssignmentsTable.evaluatorId,
      evaluatorName: usersTable.name,
      evaluatorEmail: usersTable.email,
      stage: evaluationAssignmentsTable.stage,
      status: evaluationAssignmentsTable.status,
      assignedAt: evaluationAssignmentsTable.assignedAt,
    })
    .from(evaluationAssignmentsTable)
    .innerJoin(usersTable, eq(evaluationAssignmentsTable.evaluatorId, usersTable.id))
    .where(eq(evaluationAssignmentsTable.applicationId, id))
    .orderBy(asc(evaluationAssignmentsTable.id));

  const evaluations = await db
    .select({
      id: evaluationsTable.id,
      applicationId: evaluationsTable.applicationId,
      evaluatorId: evaluationsTable.evaluatorId,
      evaluatorName: usersTable.name,
      stage: evaluationsTable.stage,
      motivationScore: evaluationsTable.motivationScore,
      problemAwarenessScore: evaluationsTable.problemAwarenessScore,
      initiativeScore: evaluationsTable.initiativeScore,
      collaborationScore: evaluationsTable.collaborationScore,
      fitScore: evaluationsTable.fitScore,
      overallScore: evaluationsTable.overallScore,
      recommendation: evaluationsTable.recommendation,
      comment: evaluationsTable.comment,
      submittedAt: evaluationsTable.submittedAt,
      updatedAt: evaluationsTable.updatedAt,
    })
    .from(evaluationsTable)
    .innerJoin(usersTable, eq(evaluationsTable.evaluatorId, usersTable.id))
    .where(eq(evaluationsTable.applicationId, id))
    .orderBy(asc(evaluationsTable.id));

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.applicationId, id))
    .limit(1);

  const logs = await db
    .select({
      id: decisionLogsTable.id,
      applicationId: decisionLogsTable.applicationId,
      previousDecision: decisionLogsTable.previousDecision,
      newDecision: decisionLogsTable.newDecision,
      changedBy: decisionLogsTable.changedBy,
      changedByName: usersTable.name,
      reason: decisionLogsTable.reason,
      createdAt: decisionLogsTable.createdAt,
    })
    .from(decisionLogsTable)
    .leftJoin(usersTable, eq(decisionLogsTable.changedBy, usersTable.id))
    .where(eq(decisionLogsTable.applicationId, id))
    .orderBy(desc(decisionLogsTable.createdAt));

  const docEvals = evaluations.filter((e) => e.stage === "document_review");
  const avgDocReviewScore =
    docEvals.length > 0
      ? docEvals.reduce((s, e) => s + e.overallScore, 0) / docEvals.length
      : null;

  return {
    ...app,
    submittedAt: app.submittedAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    assignments: assignments.map((a) => ({
      ...a,
      assignedAt: a.assignedAt.toISOString(),
    })),
    evaluations: evaluations.map((e) => ({
      ...e,
      submittedAt: e.submittedAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    interview: interview
      ? {
          ...interview,
          scheduledAt: interview.scheduledAt
            ? interview.scheduledAt.toISOString()
            : null,
          createdAt: interview.createdAt.toISOString(),
          updatedAt: interview.updatedAt.toISOString(),
        }
      : null,
    decisionLogs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    avgDocReviewScore,
  };
}

router.get("/admin/applications/:id", requireRecruiting, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const detail = await loadApplicationDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(detail);
});

router.patch("/admin/applications/:id", requireRecruiting, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // 모르는 키는 400 이다. 전에는 zod 가 조용히 버려서, `finalDecision` 처럼
  // 다른 라우트에 속한 필드를 보내도 200 이 나가고 아무것도 안 바뀌었다.
  // 이 엔드포인트의 유일한 호출자(admin/application-detail.tsx)는
  // status·adminNote 만 보낸다 — 조여도 깨지는 곳이 없다.
  const parsed = parseStrict(UpdateApplicationBody, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.applicationStatus !== undefined)
    update.applicationStatus = parsed.data.applicationStatus;
  if (parsed.data.adminNote !== undefined) update.adminNote = parsed.data.adminNote;
  const [row] = await db
    .update(applicationsTable)
    .set(update)
    .where(eq(applicationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
