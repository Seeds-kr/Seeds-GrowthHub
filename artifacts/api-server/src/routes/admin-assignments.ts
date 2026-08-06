import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { CreateAssignmentBody } from "@workspace/api-zod";
import {
  db,
  evaluationAssignmentsTable,
  usersTable,
  applicationsTable,
} from "@workspace/db";
import { getEffectiveRoles } from "@workspace/db";
import { requireOpsRole } from "../lib/auth";

// ADR-002: recruiting 담당 운영진 + program_lead 만 접근.
const requireRecruiting = requireOpsRole("recruiting");

const router: IRouter = Router();

router.post(
  "/admin/applications/:id/assignments",
  requireRecruiting,
  async (req, res) => {
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = CreateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid assignment" });
      return;
    }
    // Validate the assignee exists, is active, and is admin or mentor (the
    // evaluator role was removed; only admins/mentors can carry out evaluations).
    const [evaluator] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parsed.data.evaluatorId))
      .limit(1);
    if (
      !evaluator ||
      !evaluator.isActive ||
      !(
        getEffectiveRoles(evaluator).includes("admin") ||
        getEffectiveRoles(evaluator).includes("mentor")
      )
    ) {
      res.status(400).json({ error: "Invalid evaluator (must be admin or mentor)" });
      return;
    }
    const [app] = await db
      .select({ id: applicationsTable.id })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, appId))
      .limit(1);
    if (!app) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Race-safe: rely on the unique index (application_id, evaluator_id, stage).
    // ON CONFLICT DO NOTHING returns no row when the assignment already exists,
    // which we map to a deterministic 409.
    const inserted = await db
      .insert(evaluationAssignmentsTable)
      .values({
        applicationId: appId,
        evaluatorId: parsed.data.evaluatorId,
        stage: parsed.data.stage,
        assignedBy: req.sessionUser!.id,
        status: "assigned",
      })
      .onConflictDoNothing({
        target: [
          evaluationAssignmentsTable.applicationId,
          evaluationAssignmentsTable.evaluatorId,
          evaluationAssignmentsTable.stage,
        ],
      })
      .returning();
    if (inserted.length === 0) {
      res.status(409).json({ error: "Already assigned" });
      return;
    }
    const row = inserted[0];
    res.status(201).json({
      id: row.id,
      applicationId: row.applicationId,
      evaluatorId: row.evaluatorId,
      evaluatorName: evaluator.name,
      evaluatorEmail: evaluator.email,
      stage: row.stage,
      status: row.status,
      assignedAt: row.assignedAt.toISOString(),
    });
  },
);

router.delete(
  "/admin/applications/:appId/assignments/:assignmentId",
  requireRecruiting,
  async (req, res) => {
    const appId = Number(req.params.appId);
    const id = Number(req.params.assignmentId);
    if (!Number.isFinite(appId) || !Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [removed] = await db
      .delete(evaluationAssignmentsTable)
      .where(
        and(
          eq(evaluationAssignmentsTable.id, id),
          eq(evaluationAssignmentsTable.applicationId, appId),
        ),
      )
      .returning({ id: evaluationAssignmentsTable.id });
    if (!removed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
