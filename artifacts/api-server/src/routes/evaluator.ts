import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { SubmitEvaluationBody } from "@workspace/api-zod";
import {
  db,
  applicationsTable,
  evaluationAssignmentsTable,
  evaluationsTable,
  usersTable,
} from "@workspace/db";
import { requireEvaluator } from "../lib/auth";

const router: IRouter = Router();

router.get("/evaluator/assignments", requireEvaluator, async (req, res) => {
  const me = req.sessionUser!;
  const rows = await db
    .select({
      assignmentId: evaluationAssignmentsTable.id,
      applicationId: evaluationAssignmentsTable.applicationId,
      stage: evaluationAssignmentsTable.stage,
      assignmentStatus: evaluationAssignmentsTable.status,
      assignedAt: evaluationAssignmentsTable.assignedAt,
      applicantName: applicationsTable.name,
      applicantSchool: applicationsTable.school,
    })
    .from(evaluationAssignmentsTable)
    .innerJoin(
      applicationsTable,
      eq(evaluationAssignmentsTable.applicationId, applicationsTable.id),
    )
    .where(eq(evaluationAssignmentsTable.evaluatorId, me.id))
    .orderBy(asc(evaluationAssignmentsTable.id));

  // For each assignment determine if a matching evaluation exists
  const appIds = rows.map((r) => r.applicationId);
  let mine: { applicationId: number; stage: string }[] = [];
  if (appIds.length > 0) {
    mine = await db
      .select({
        applicationId: evaluationsTable.applicationId,
        stage: evaluationsTable.stage,
      })
      .from(evaluationsTable)
      .where(
        and(
          eq(evaluationsTable.evaluatorId, me.id),
          inArray(evaluationsTable.applicationId, appIds),
        ),
      );
  }
  const mineKey = new Set(mine.map((m) => `${m.applicationId}:${m.stage}`));

  res.json({
    items: rows.map((r) => ({
      assignmentId: r.assignmentId,
      applicationId: r.applicationId,
      applicantName: r.applicantName,
      applicantSchool: r.applicantSchool,
      stage: r.stage,
      assignmentStatus: r.assignmentStatus,
      hasEvaluation: mineKey.has(`${r.applicationId}:${r.stage}`),
      assignedAt: r.assignedAt.toISOString(),
    })),
    total: rows.length,
  });
});

async function getMyAssignments(evaluatorId: number, appId: number) {
  return db
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
    .where(
      and(
        eq(evaluationAssignmentsTable.applicationId, appId),
        eq(evaluationAssignmentsTable.evaluatorId, evaluatorId),
      ),
    );
}

router.get(
  "/evaluator/applications/:id",
  requireEvaluator,
  async (req, res) => {
    const me = req.sessionUser!;
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const myAssignments = await getMyAssignments(me.id, appId);
    if (myAssignments.length === 0) {
      res.status(403).json({ error: "Not assigned" });
      return;
    }
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, appId))
      .limit(1);
    if (!app) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const myEvals = await db
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
      .where(
        and(
          eq(evaluationsTable.applicationId, appId),
          eq(evaluationsTable.evaluatorId, me.id),
        ),
      );
    res.json({
      application: {
        ...app,
        submittedAt: app.submittedAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
      },
      myAssignments: myAssignments.map((a) => ({
        ...a,
        assignedAt: a.assignedAt.toISOString(),
      })),
      myEvaluations: myEvals.map((e) => ({
        ...e,
        submittedAt: e.submittedAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    });
  },
);

router.post(
  "/evaluator/applications/:id/evaluations",
  requireEvaluator,
  async (req, res) => {
    const me = req.sessionUser!;
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = SubmitEvaluationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid evaluation" });
      return;
    }
    // Verify the evaluator is assigned to this application for the stage
    const [assignment] = await db
      .select()
      .from(evaluationAssignmentsTable)
      .where(
        and(
          eq(evaluationAssignmentsTable.applicationId, appId),
          eq(evaluationAssignmentsTable.evaluatorId, me.id),
          eq(evaluationAssignmentsTable.stage, parsed.data.stage),
        ),
      )
      .limit(1);
    if (!assignment) {
      res.status(403).json({ error: "Not assigned for this stage" });
      return;
    }
    const values = {
      applicationId: appId,
      evaluatorId: me.id,
      stage: parsed.data.stage,
      motivationScore: parsed.data.motivationScore ?? null,
      problemAwarenessScore: parsed.data.problemAwarenessScore ?? null,
      initiativeScore: parsed.data.initiativeScore ?? null,
      collaborationScore: parsed.data.collaborationScore ?? null,
      fitScore: parsed.data.fitScore ?? null,
      overallScore: parsed.data.overallScore,
      recommendation: parsed.data.recommendation,
      comment: parsed.data.comment ?? null,
      updatedAt: new Date(),
    };
    // Race-safe upsert via unique index (application_id, evaluator_id, stage).
    const [row] = await db
      .insert(evaluationsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          evaluationsTable.applicationId,
          evaluationsTable.evaluatorId,
          evaluationsTable.stage,
        ],
        set: {
          motivationScore: values.motivationScore,
          problemAwarenessScore: values.problemAwarenessScore,
          initiativeScore: values.initiativeScore,
          collaborationScore: values.collaborationScore,
          fitScore: values.fitScore,
          overallScore: values.overallScore,
          recommendation: values.recommendation,
          comment: values.comment,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    // Mark the assignment completed
    await db
      .update(evaluationAssignmentsTable)
      .set({ status: "completed" })
      .where(eq(evaluationAssignmentsTable.id, assignment.id));

    res.json({
      id: row.id,
      applicationId: row.applicationId,
      evaluatorId: row.evaluatorId,
      evaluatorName: me.name,
      stage: row.stage,
      motivationScore: row.motivationScore,
      problemAwarenessScore: row.problemAwarenessScore,
      initiativeScore: row.initiativeScore,
      collaborationScore: row.collaborationScore,
      fitScore: row.fitScore,
      overallScore: row.overallScore,
      recommendation: row.recommendation,
      comment: row.comment,
      submittedAt: row.submittedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
