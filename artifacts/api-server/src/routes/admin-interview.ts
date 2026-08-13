import { Router, type IRouter } from "express";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { UpsertInterviewBody } from "@workspace/api-zod";
import {
  db,
  interviewsTable,
  applicationsTable,
  INTERVIEW_STATUSES,
} from "@workspace/db";
import { requireOpsRole } from "../lib/auth";

// ADR-002: recruiting 담당 운영진 + program_lead 만 접근.
const requireRecruiting = requireOpsRole("recruiting");

const router: IRouter = Router();

/**
 * W8 — schedule-wide interview list.
 *
 * The row and its upsert already existed; only a way to see them together was
 * missing, so results could be entered per application but never reviewed as a
 * schedule. Read-only: writes stay on
 * `PUT /admin/applications/:id/interview` so there is one write path.
 *
 * Same `recruiting` gate as the rest of the surface — this joins applicant
 * names, which is exactly the recruitment data W1 separates from other ops.
 */
router.get("/admin/interviews", requireRecruiting, async (req, res) => {
  const status = req.query.status;
  const conds: SQL[] = [];

  if (typeof status === "string" && status.length > 0) {
    if (!(INTERVIEW_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: "Unknown status" });
      return;
    }
    conds.push(eq(interviewsTable.status, status as any));
  }

  const rows = await db
    .select({
      id: interviewsTable.id,
      applicationId: interviewsTable.applicationId,
      applicantName: applicationsTable.name,
      applicantEmail: applicationsTable.email,
      applicationStatus: applicationsTable.applicationStatus,
      finalDecision: applicationsTable.finalDecision,
      scheduledAt: interviewsTable.scheduledAt,
      locationOrLink: interviewsTable.locationOrLink,
      interviewerNote: interviewsTable.interviewerNote,
      status: interviewsTable.status,
      updatedAt: interviewsTable.updatedAt,
    })
    .from(interviewsTable)
    .innerJoin(
      applicationsTable,
      eq(interviewsTable.applicationId, applicationsTable.id),
    )
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(interviewsTable.scheduledAt), asc(interviewsTable.id));

  const counts: Record<string, number> = {};
  for (const s of INTERVIEW_STATUSES) counts[s] = 0;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  res.json({
    items: rows.map((r) => ({
      ...r,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rows.length,
    counts,
  });
});

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
      .select({
        id: applicationsTable.id,
        // 최종 결정 뒤에는 단계를 되돌리지 않기 위해 함께 읽는다.
        applicationStatus: applicationsTable.applicationStatus,
      })
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

      // 면접 상태가 정해지면 지원서의 심사 단계도 함께 올린다.
      //
      // 전에는 면접을 잡아도 단계가 `submitted` 에 머물렀다. 운영진이 같은 사실을
      // 두 번 적어야 했고(면접 폼 + 상태 드롭다운), 한쪽만 적히면 갈라졌다.
      // 면접 기록이 곧 그 단계의 근거이므로 여기서 한 번만 쓴다.
      //
      // 최종 결정이 난 뒤에는 되돌리지 않는다 — 결정이 단계보다 뒤이고, 면접
      // 메모를 나중에 고쳤다고 `면접 완료` 로 후퇴하면 안 된다.
      const stage =
        status === "scheduled"
          ? "interview_scheduled"
          : status === "completed"
            ? "interview_completed"
            : null;
      if (
        stage &&
        app.applicationStatus !== "final_decision_made" &&
        app.applicationStatus !== "withdrawn"
      ) {
        await db
          .update(applicationsTable)
          .set({ applicationStatus: stage, updatedAt: now })
          .where(eq(applicationsTable.id, appId));
      }
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
