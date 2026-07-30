import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { UpsertInterviewBody } from "@workspace/api-zod";
import {
  db,
  interviewsTable,
  applicationsTable,
} from "@workspace/db";
import { requireOpsRole } from "../lib/auth";

// ADR-002: recruiting 담당 운영진 + program_lead 만 접근.
const requireRecruiting = requireOpsRole("recruiting");

const router: IRouter = Router();

router.put(
  "/admin/applications/:id/interview",
  requireRecruiting,
  async (req, res) => {
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = UpsertInterviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid interview data" });
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
    const scheduledAt = parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : null;
    const status = parsed.data.status ?? "not_scheduled";
    const now = new Date();
    // Race-safe upsert via the unique index on application_id.
    const [row] = await db
      .insert(interviewsTable)
      .values({
        applicationId: appId,
        scheduledAt,
        locationOrLink: parsed.data.locationOrLink ?? null,
        interviewerNote: parsed.data.interviewerNote ?? null,
        status,
      })
      .onConflictDoUpdate({
        target: interviewsTable.applicationId,
        set: {
          scheduledAt,
          locationOrLink: parsed.data.locationOrLink ?? null,
          interviewerNote: parsed.data.interviewerNote ?? null,
          status,
          updatedAt: now,
        },
      })
      .returning();
    res.json({
      id: row.id,
      applicationId: row.applicationId,
      scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      locationOrLink: row.locationOrLink,
      interviewerNote: row.interviewerNote,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
