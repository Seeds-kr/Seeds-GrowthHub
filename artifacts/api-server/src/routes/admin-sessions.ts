import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sessionsTable,
  SESSION_TYPES,
  SESSION_STATUSES,
  ATTENDANCE_STATUSES,
  cohortsTable,
  programsTable,
  attendanceRecordsTable,
  studentsTable,
  studentCohortsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateSession = z.object({
  cohortId: z.number().int().positive(),
  programId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  locationOrLink: z.string().max(500).nullable().optional(),
  sessionType: z.enum(SESSION_TYPES).optional(),
  status: z.enum(SESSION_STATUSES).optional(),
});

router.get("/admin/sessions", requireAdmin, async (req, res) => {
  const cohortId = req.query.cohortId
    ? Number(req.query.cohortId)
    : undefined;
  const programId = req.query.programId
    ? Number(req.query.programId)
    : undefined;
  const status = req.query.status as string | undefined;
  const fromIso = req.query.from as string | undefined;
  const toIso = req.query.to as string | undefined;
  const conds = [];
  if (cohortId && Number.isFinite(cohortId))
    conds.push(eq(sessionsTable.cohortId, cohortId));
  if (programId && Number.isFinite(programId))
    conds.push(eq(sessionsTable.programId, programId));
  if (status && (SESSION_STATUSES as readonly string[]).includes(status))
    conds.push(
      eq(sessionsTable.status, status as (typeof SESSION_STATUSES)[number]),
    );
  if (fromIso) conds.push(gte(sessionsTable.scheduledAt, new Date(fromIso)));
  if (toIso) conds.push(lte(sessionsTable.scheduledAt, new Date(toIso)));
  let q = db
    .select({
      id: sessionsTable.id,
      cohortId: sessionsTable.cohortId,
      cohortName: cohortsTable.name,
      programId: sessionsTable.programId,
      programName: programsTable.name,
      title: sessionsTable.title,
      scheduledAt: sessionsTable.scheduledAt,
      durationMinutes: sessionsTable.durationMinutes,
      locationOrLink: sessionsTable.locationOrLink,
      sessionType: sessionsTable.sessionType,
      status: sessionsTable.status,
    })
    .from(sessionsTable)
    .innerJoin(cohortsTable, eq(sessionsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(sessionsTable.programId, programsTable.id))
    .$dynamic();
  if (conds.length > 0) q = q.where(and(...conds));
  const rows = await q.orderBy(desc(sessionsTable.scheduledAt));
  res.json({
    items: rows.map((r) => ({
      ...r,
      scheduledAt: r.scheduledAt.toISOString(),
    })),
    total: rows.length,
  });
});

router.post("/admin/sessions", requireAdmin, async (req, res) => {
  const parsed = CreateSession.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(sessionsTable)
    .values({
      cohortId: parsed.data.cohortId,
      programId: parsed.data.programId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMinutes: parsed.data.durationMinutes ?? 60,
      locationOrLink: parsed.data.locationOrLink ?? null,
      sessionType: parsed.data.sessionType ?? "workshop",
      status: parsed.data.status ?? "scheduled",
    })
    .returning();
  res.status(201).json({
    ...row,
    scheduledAt: row.scheduledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.get("/admin/sessions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...session,
    scheduledAt: session.scheduledAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
});

router.patch("/admin/sessions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = CreateSession.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "scheduledAt" && typeof v === "string") {
      updates.scheduledAt = new Date(v);
    } else {
      updates[k] = v;
    }
  }
  const [row] = await db
    .update(sessionsTable)
    .set(updates)
    .where(eq(sessionsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    scheduledAt: row.scheduledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

// Attendance for a session: returns roster (students in cohort) + records
router.get(
  "/admin/sessions/:id/attendance",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const roster = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        email: studentsTable.email,
      })
      .from(studentCohortsTable)
      .innerJoin(
        studentsTable,
        eq(studentCohortsTable.studentId, studentsTable.id),
      )
      .where(eq(studentCohortsTable.cohortId, session.cohortId))
      .orderBy(asc(studentsTable.name));
    const records = await db
      .select()
      .from(attendanceRecordsTable)
      .where(eq(attendanceRecordsTable.sessionId, id));
    const recByStudent = new Map(records.map((r) => [r.studentId, r]));
    res.json({
      session: {
        ...session,
        scheduledAt: session.scheduledAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      roster: roster.map((s) => {
        const rec = recByStudent.get(s.id);
        return {
          studentId: s.id,
          name: s.name,
          email: s.email,
          status: rec?.status ?? null,
          note: rec?.note ?? null,
          recordId: rec?.id ?? null,
          markedAt: rec?.markedAt ? rec.markedAt.toISOString() : null,
        };
      }),
    });
  },
);

const MarkAttendanceBody = z.object({
  records: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(ATTENDANCE_STATUSES),
        note: z.string().max(1000).nullable().optional(),
      }),
    )
    .min(1),
});

router.put(
  "/admin/sessions/:id/attendance",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = MarkAttendanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [session] = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const now = new Date();
    const inserted: typeof attendanceRecordsTable.$inferSelect[] = [];
    for (const r of parsed.data.records) {
      const [row] = await db
        .insert(attendanceRecordsTable)
        .values({
          sessionId: id,
          studentId: r.studentId,
          status: r.status,
          note: r.note ?? null,
          markedBy: req.sessionUser!.id,
          markedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            attendanceRecordsTable.sessionId,
            attendanceRecordsTable.studentId,
          ],
          set: {
            status: r.status,
            note: r.note ?? null,
            markedBy: req.sessionUser!.id,
            updatedAt: now,
          },
        })
        .returning();
      inserted.push(row);
    }
    res.json({
      records: inserted.map((r) => ({
        ...r,
        markedAt: r.markedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  },
);

export default router;
