import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { SetFinalDecisionBody } from "@workspace/api-zod";
import {
  db,
  applicationsTable,
  decisionLogsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.patch(
  "/admin/applications/:id/final-decision",
  requireAdmin,
  async (req, res) => {
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = SetFinalDecisionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid decision" });
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length === 0) {
      res.status(400).json({ error: "Decision reason is required" });
      return;
    }

    try {
      const updated = await db.transaction(async (tx) => {
        // SELECT ... FOR UPDATE to serialize concurrent decision changes.
        const [app] = await tx
          .select({
            id: applicationsTable.id,
            finalDecision: applicationsTable.finalDecision,
          })
          .from(applicationsTable)
          .where(eq(applicationsTable.id, appId))
          .for("update");
        if (!app) {
          throw Object.assign(new Error("not_found"), { code: "NOT_FOUND" });
        }
        const previous = app.finalDecision;
        const [row] = await tx
          .update(applicationsTable)
          .set({
            finalDecision: parsed.data.finalDecision,
            applicationStatus:
              parsed.data.finalDecision === "withdrawn"
                ? "withdrawn"
                : "final_decision_made",
            updatedAt: new Date(),
          })
          .where(eq(applicationsTable.id, appId))
          .returning();
        await tx.insert(decisionLogsTable).values({
          applicationId: appId,
          previousDecision: previous,
          newDecision: parsed.data.finalDecision,
          changedBy: req.sessionUser!.id,
          reason,
        });
        return row;
      });
      res.json({
        ...updated,
        submittedAt: updated.submittedAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "NOT_FOUND") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      req.log.error({ err }, "failed to set final decision");
      res.status(500).json({ error: "Failed to set final decision" });
    }
    void sql; // keep import for future raw queries
  },
);

export default router;
