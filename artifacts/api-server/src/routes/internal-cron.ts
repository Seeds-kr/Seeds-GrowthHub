import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq, isNull, lt, ne, sql, inArray, gte, lte } from "drizzle-orm";
import {
  db,
  opsTasksTable,
  financeRecordsTable,
  sessionsTable,
  projectStatusChecksTable,
  communicationLogsTable,
} from "@workspace/db";
import { notifyDiscord } from "../lib/notify";
import { logger } from "./../lib/logger";

const router: IRouter = Router();

/**
 * Scheduled digests (design/05 §5.4).
 *
 * Called by an external scheduler (Replit Scheduled Deployments or cron), not
 * by a worker process. Immediate alerts (N2/N3) fire from their own mutation
 * routes instead.
 *
 * Auth is a shared secret header, NOT a session — the caller is a machine.
 */
const requireCronSecret: RequestHandler = (req, res, next) => {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return;
  }
  const given = req.header("x-cron-secret")?.trim();
  if (!given || given !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

/** Guard against a scheduler firing twice: one digest per template per day. */
async function alreadySentToday(templateId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ id: communicationLogsTable.id })
    .from(communicationLogsTable)
    .where(
      and(
        eq(communicationLogsTable.templateId, templateId),
        eq(communicationLogsTable.status, "sent"),
        gte(communicationLogsTable.createdAt, startOfDay),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Daily ops digest — N1 (overdue tasks), N5 (finance awaiting action),
 * N7 (sessions in the next 3 days).
 *
 * Counts and titles only. No student data crosses into the payload.
 */
router.post("/internal/cron/daily-digest", requireCronSecret, async (_req, res) => {
  const templateId = "daily_digest";
  if (await alreadySentToday(templateId)) {
    res.json({ ok: true, skipped: "already sent today" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const in3d = new Date(Date.now() + 3 * 86_400_000);

  const [overdue, pendingFinance, upcoming, openSupport] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(opsTasksTable)
      .where(
        and(
          lt(opsTasksTable.dueDate, today),
          ne(opsTasksTable.status, "done"),
          ne(opsTasksTable.status, "canceled"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(financeRecordsTable)
      .where(
        inArray(financeRecordsTable.status, [
          "requested",
          "under_review",
          "approved",
        ]),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionsTable)
      .where(
        and(
          gte(sessionsTable.scheduledAt, new Date()),
          lte(sessionsTable.scheduledAt, in3d),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectStatusChecksTable)
      .where(
        and(
          eq(projectStatusChecksTable.needsOpsSupport, true),
          isNull(projectStatusChecksTable.opsResolvedAt),
        ),
      ),
  ]);

  const lines: string[] = [];
  const n = (r: { count: number }[]) => r[0]?.count ?? 0;
  if (n(overdue) > 0) lines.push(`⏰ 지연 작업 ${n(overdue)}건`);
  if (n(openSupport) > 0) lines.push(`🔴 팀 지원 요청 ${n(openSupport)}건`);
  if (n(pendingFinance) > 0) lines.push(`💳 정산 대기 ${n(pendingFinance)}건`);
  if (n(upcoming) > 0) lines.push(`📅 3일 내 일정 ${n(upcoming)}건`);

  // Silence beats noise: nothing pending means no message at all.
  if (lines.length === 0) {
    res.json({ ok: true, skipped: "nothing to report" });
    return;
  }

  const sent = await notifyDiscord({
    channel: "ops",
    templateId,
    content: `오늘의 운영 요약 — ${lines.join(" · ")}`,
    description: "GrowthHub 운영 대시보드에서 자세히 확인하세요.",
    path: "/admin/ops-dashboard",
  });

  logger.info({ sent, lines }, "daily digest");
  res.json({ ok: true, sent, items: lines.length });
});

/**
 * Weekly mentor nudge — N4. Teams whose last status check is older than 14
 * days. Sent to the mentor channel; project titles only, no student data.
 */
router.post("/internal/cron/weekly-mentor-nudge", requireCronSecret, async (_req, res) => {
  const templateId = "weekly_mentor_nudge";
  if (await alreadySentToday(templateId)) {
    res.json({ ok: true, skipped: "already sent today" });
    return;
  }

  const past14d = new Date(Date.now() - 14 * 86_400_000);
  const stale = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectStatusChecksTable)
    .where(lt(projectStatusChecksTable.checkedAt, past14d));

  const count = stale[0]?.count ?? 0;
  if (count === 0) {
    res.json({ ok: true, skipped: "nothing to report" });
    return;
  }

  const sent = await notifyDiscord({
    channel: "mentor",
    templateId,
    content: `이번 주 상태체크가 필요한 팀이 있습니다.`,
    description: "담당 팀 화면에서 상태 하나만 골라도 제출됩니다 (30초).",
    path: "/mentor/teams",
  });

  res.json({ ok: true, sent });
});

export default router;
