import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  communicationLogsTable,
  usersTable,
  COMM_CHANNELS,
  COMM_STATUSES,
} from "@workspace/db";
import { requireAnyOpsRole } from "../lib/auth";

const router: IRouter = Router();

/**
 * 발송 이력 (설계 00 §3.2 · W7/W10).
 *
 * `communication_logs` 는 W10 부터 채워지고 있는데(`lib/notify.ts` 가 Discord
 * 발송마다 한 줄 남긴다) 보는 화면이 없었다. 쓰기만 있고 읽기가 없는 테이블은
 * 사실상 없는 것과 같다 — 무엇이 나갔는지 확인할 방법이 없으면 "안 갔다"는
 * 제보를 받았을 때 확인할 자리가 없다.
 *
 * READ ONLY. 발송 이력은 일어난 일의 기록이라 고칠 것이 아니다. 재발송이
 * 필요하면 그건 새 발송이지 기존 행의 수정이 아니다.
 *
 * 게이트는 `recruiting`/`community` 둘 중 하나(visibility-policy §4.2). 둘 다
 * 무언가를 보내는 역할이고, 보낸 것을 확인하는 것은 보내는 일의 일부다.
 */
const requireComms = requireAnyOpsRole("recruiting", "community");

const PAGE_SIZE_MAX = 100;

const ListQuery = z.object({
  channel: z.enum(COMM_CHANNELS).optional(),
  status: z.enum(COMM_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
});

router.get("/admin/communications", requireComms, async (req, res) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const q = parsed.data;
  const conds = [];
  if (q.channel) conds.push(eq(communicationLogsTable.channel, q.channel));
  if (q.status) conds.push(eq(communicationLogsTable.status, q.status));
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(communicationLogsTable)
    .where(where);

  const rows = await db
    .select({
      id: communicationLogsTable.id,
      channel: communicationLogsTable.channel,
      status: communicationLogsTable.status,
      templateId: communicationLogsTable.templateId,
      subject: communicationLogsTable.subject,
      recipientType: communicationLogsTable.recipientType,
      recipientAddress: communicationLogsTable.recipientAddress,
      relatedObjectType: communicationLogsTable.relatedObjectType,
      relatedObjectId: communicationLogsTable.relatedObjectId,
      failureReason: communicationLogsTable.failureReason,
      sentAt: communicationLogsTable.sentAt,
      createdAt: communicationLogsTable.createdAt,
      createdByName: usersTable.name,
    })
    .from(communicationLogsTable)
    .leftJoin(usersTable, eq(usersTable.id, communicationLogsTable.createdBy))
    .where(where)
    .orderBy(desc(communicationLogsTable.createdAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  // 실패가 몇 건인지는 목록을 넘겨 가며 세는 것이 아니라 한눈에 보여야 한다 —
  // 발송 이력을 여는 이유가 대개 "뭐가 안 갔지"이기 때문이다.
  const byStatus = await db
    .select({
      status: communicationLogsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(communicationLogsTable)
    .groupBy(communicationLogsTable.status);

  res.json({
    items: rows.map((r) => ({
      ...r,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      createdByName: r.createdByName ?? null,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    summary: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
  });
});

export default router;
