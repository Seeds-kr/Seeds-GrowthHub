import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  studiesTable,
  studyMembersTable,
  studentsTable,
  cohortsTable,
  programsTable,
  mvp4ArtifactsTable,
  STUDY_STATUSES,
} from "@workspace/db";
import { requireAdmin, requireOpsRole } from "../lib/auth";

const router: IRouter = Router();

/**
 * Study administration (docs/design/03 §4). Mirrors admin-projects.ts.
 *
 * NOTE: there is intentionally no reflections counterpart to this file —
 * see ADR-001 and the comment at the top of routes/student-growth.ts.
 */

const Body = z.object({
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  topic: z.string().max(300).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  leaderStudentId: z.number().int().positive().nullable().optional(),
  weeklyPlanMd: z.string().max(40000).optional(),
  status: z.enum(STUDY_STATUSES).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

const MemberBody = z.object({
  studentId: z.number().int().positive(),
  role: z.string().max(100).nullable().optional(),
  participationNote: z.string().max(8000).nullable().optional(),
});

function toIso(s: typeof studiesTable.$inferSelect) {
  return {
    ...s,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/admin/studies", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;
  const rows = await db
    .select({
      study: studiesTable,
      cohortName: cohortsTable.name,
      programName: programsTable.name,
      leaderName: studentsTable.name,
    })
    .from(studiesTable)
    .leftJoin(cohortsTable, eq(studiesTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(studiesTable.programId, programsTable.id))
    .leftJoin(studentsTable, eq(studiesTable.leaderStudentId, studentsTable.id))
    .where(
      cohortId && Number.isFinite(cohortId)
        ? eq(studiesTable.cohortId, cohortId)
        : undefined,
    )
    .orderBy(desc(studiesTable.id));

  res.json({
    items: rows.map((r) => ({
      ...toIso(r.study),
      cohortName: r.cohortName ?? null,
      programName: r.programName ?? null,
      leaderName: r.leaderName ?? null,
    })),
    total: rows.length,
  });
});

router.post("/admin/studies", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(studiesTable)
    .values({
      cohortId: d.cohortId,
      programId: d.programId ?? null,
      title: d.title,
      topic: d.topic ?? null,
      description: d.description ?? null,
      leaderStudentId: d.leaderStudentId ?? null,
      weeklyPlanMd: d.weeklyPlanMd ?? "",
      status: d.status ?? "planned",
      startedAt: d.startedAt ? new Date(d.startedAt) : null,
      endedAt: d.endedAt ? new Date(d.endedAt) : null,
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.get("/admin/studies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [study] = await db
    .select()
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const members = await db
    .select({
      id: studyMembersTable.id,
      studentId: studyMembersTable.studentId,
      studentName: studentsTable.name,
      role: studyMembersTable.role,
      participationNote: studyMembersTable.participationNote,
    })
    .from(studyMembersTable)
    .innerJoin(studentsTable, eq(studyMembersTable.studentId, studentsTable.id))
    .where(eq(studyMembersTable.studyId, id));
  const artifacts = await db
    .select()
    .from(mvp4ArtifactsTable)
    .where(eq(mvp4ArtifactsTable.studyId, id))
    .orderBy(desc(mvp4ArtifactsTable.createdAt));

  res.json({
    study: toIso(study),
    members,
    artifacts: artifacts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
});

router.patch("/admin/studies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = Body.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(d)) {
    if (k === "startedAt" || k === "endedAt") {
      update[k] = v ? new Date(v as string) : null;
    } else {
      update[k] = v;
    }
  }
  const [row] = await db
    .update(studiesTable)
    .set(update)
    .where(eq(studiesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

/** Archive rather than delete, per ERD v3 §13. */
router.post("/admin/studies/:id/archive", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .update(studiesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(studiesTable.id, id))
    .returning({ id: studiesTable.id });
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

/**
 * 스터디 개설 요청 심사 (design 06 §10).
 *
 * Gated on the `growth` ops role, not plain admin: 설계 00 §2.3 이 성장경험
 * 담당에게 "프로젝트·스터디·피드백"을 배정해 뒀고, 승인은 그 역할이 하는 일이다.
 * 열람은 여전히 모든 운영진에게 열려 있다 — 막는 것은 결정뿐이다.
 */
const requireGrowth = requireOpsRole("growth");

const ReviewBody = z.object({
  // 반려에는 사실상 필수다(아래 참조). 승인에서는 없어도 된다.
  note: z.string().trim().max(2000).optional(),
});

router.post("/admin/studies/:id/approve", requireGrowth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ReviewBody.safeParse(req.body ?? {});
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [study] = await db
    .select()
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // 이미 굴러가는 스터디를 다시 "승인"하면 status 가 planned 로 되돌아가
  // 진행 중이던 것이 예정으로 바뀐다. 심사는 proposed 에만 있는 단계다.
  if (study.status !== "proposed") {
    res.status(409).json({ error: "심사 대기 중인 제안이 아닙니다.", status: study.status });
    return;
  }
  const [row] = await db
    .update(studiesTable)
    .set({
      status: "planned",
      reviewNote: parsed.data.note ?? null,
      reviewedBy: req.sessionUser!.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(studiesTable.id, id))
    .returning({ id: studiesTable.id, status: studiesTable.status });
  res.json(row);
});

router.post("/admin/studies/:id/reject", requireGrowth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ReviewBody.safeParse(req.body ?? {});
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  // 반려 사유를 강제한다. "안 됩니다"로 끝나면 학생은 무엇을 고쳐 다시 낼지
  // 모르고, 대개 다시 내지 않는다. 반려는 종료가 아니라 되돌려 보내는 것이다.
  if (!parsed.data.note) {
    res.status(422).json({ error: "반려 사유를 적어 주세요. 학생이 고쳐서 다시 낼 수 있어야 합니다." });
    return;
  }
  const [study] = await db
    .select({ status: studiesTable.status })
    .from(studiesTable)
    .where(eq(studiesTable.id, id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (study.status !== "proposed") {
    res.status(409).json({ error: "심사 대기 중인 제안이 아닙니다.", status: study.status });
    return;
  }
  const [row] = await db
    .update(studiesTable)
    .set({
      status: "rejected",
      reviewNote: parsed.data.note,
      reviewedBy: req.sessionUser!.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(studiesTable.id, id))
    .returning({ id: studiesTable.id, status: studiesTable.status });
  res.json(row);
});

router.post("/admin/studies/:id/members", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = MemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db
      .insert(studyMembersTable)
      .values({
        studyId: id,
        studentId: parsed.data.studentId,
        role: parsed.data.role ?? null,
        participationNote: parsed.data.participationNote ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")) {
      res.status(409).json({ error: "Already a member" });
    } else throw e;
  }
});

router.delete(
  "/admin/studies/:id/members/:memberId",
  requireAdmin,
  async (req, res) => {
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .delete(studyMembersTable)
      .where(eq(studyMembersTable.id, memberId))
      .returning({ id: studyMembersTable.id });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
