import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sessionsTable,
  SESSION_TYPES,
  SESSION_STATUSES,
  SESSION_PREP_STATUSES,
  ATTENDANCE_STATUSES,
  cohortsTable,
  programsTable,
  attendanceRecordsTable,
  studentsTable,
  studentCohortsTable,
  usersTable,
  documentsTable,
  opsTasksTable,
  OPS_TASK_PRIORITIES,
  type SessionMaterial,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const MaterialSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(2000).url(),
});

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
  ownerId: z.number().int().positive().nullable().optional(),
  prepStatus: z.enum(SESSION_PREP_STATUSES).optional(),
  isPublished: z.boolean().optional(),
  checklistDocumentId: z.number().int().positive().nullable().optional(),
  materials: z.array(MaterialSchema).max(50).optional(),
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
      ownerId: sessionsTable.ownerId,
      ownerName: usersTable.name,
      prepStatus: sessionsTable.prepStatus,
      isPublished: sessionsTable.isPublished,
      checklistDocumentId: sessionsTable.checklistDocumentId,
    })
    .from(sessionsTable)
    .innerJoin(cohortsTable, eq(sessionsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(sessionsTable.programId, programsTable.id))
    .leftJoin(usersTable, eq(sessionsTable.ownerId, usersTable.id))
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
      ownerId: parsed.data.ownerId ?? null,
      prepStatus: parsed.data.prepStatus ?? "not_started",
      isPublished: parsed.data.isPublished ?? true,
      checklistDocumentId: parsed.data.checklistDocumentId ?? null,
      materials: parsed.data.materials ?? [],
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
  const [row] = await db
    .select({
      session: sessionsTable,
      cohortName: cohortsTable.name,
      programName: programsTable.name,
      ownerName: usersTable.name,
      ownerEmail: usersTable.email,
    })
    .from(sessionsTable)
    .innerJoin(cohortsTable, eq(sessionsTable.cohortId, cohortsTable.id))
    .leftJoin(programsTable, eq(sessionsTable.programId, programsTable.id))
    .leftJoin(usersTable, eq(sessionsTable.ownerId, usersTable.id))
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const s = row.session;
  let checklist: {
    id: number;
    title: string;
    docType: string;
    archivedAt: string | null;
  } | null = null;
  if (s.checklistDocumentId) {
    const [doc] = await db
      .select({
        id: documentsTable.id,
        title: documentsTable.title,
        docType: documentsTable.docType,
        archivedAt: documentsTable.archivedAt,
      })
      .from(documentsTable)
      .where(eq(documentsTable.id, s.checklistDocumentId))
      .limit(1);
    if (doc) {
      checklist = {
        id: doc.id,
        title: doc.title,
        docType: doc.docType,
        archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
      };
    }
  }
  const [attCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      present: sql<number>`sum(case when ${attendanceRecordsTable.status} = 'present' then 1 else 0 end)::int`,
      late: sql<number>`sum(case when ${attendanceRecordsTable.status} = 'late' then 1 else 0 end)::int`,
      absent: sql<number>`sum(case when ${attendanceRecordsTable.status} = 'absent' then 1 else 0 end)::int`,
      excused: sql<number>`sum(case when ${attendanceRecordsTable.status} = 'excused' then 1 else 0 end)::int`,
    })
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.sessionId, id));
  const followUps = await db
    .select({
      id: opsTasksTable.id,
      title: opsTasksTable.title,
      status: opsTasksTable.status,
      priority: opsTasksTable.priority,
      assigneeId: opsTasksTable.assigneeId,
      assigneeName: usersTable.name,
      dueDate: opsTasksTable.dueDate,
      createdAt: opsTasksTable.createdAt,
    })
    .from(opsTasksTable)
    .leftJoin(usersTable, eq(opsTasksTable.assigneeId, usersTable.id))
    .where(
      and(
        eq(opsTasksTable.linkedObjectType, "session"),
        eq(opsTasksTable.linkedObjectId, id),
      ),
    )
    .orderBy(desc(opsTasksTable.createdAt));
  res.json({
    ...s,
    scheduledAt: s.scheduledAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    cohortName: row.cohortName,
    programName: row.programName,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    checklist,
    attendanceSummary: {
      total: attCounts?.total ?? 0,
      present: attCounts?.present ?? 0,
      late: attCounts?.late ?? 0,
      absent: attCounts?.absent ?? 0,
      excused: attCounts?.excused ?? 0,
    },
    followUps: followUps.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
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
    } else if (k === "materials" && v !== undefined) {
      updates.materials = v as SessionMaterial[];
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

// Follow-up action items linked to a session (uses ops_tasks polymorphic link).
router.get(
  "/admin/sessions/:id/action-items",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select({
        id: opsTasksTable.id,
        title: opsTasksTable.title,
        description: opsTasksTable.description,
        status: opsTasksTable.status,
        priority: opsTasksTable.priority,
        assigneeId: opsTasksTable.assigneeId,
        assigneeName: usersTable.name,
        dueDate: opsTasksTable.dueDate,
        createdAt: opsTasksTable.createdAt,
      })
      .from(opsTasksTable)
      .leftJoin(usersTable, eq(opsTasksTable.assigneeId, usersTable.id))
      .where(
        and(
          eq(opsTasksTable.linkedObjectType, "session"),
          eq(opsTasksTable.linkedObjectId, id),
        ),
      )
      .orderBy(desc(opsTasksTable.createdAt));
    res.json({
      items: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  },
);

const CreateActionItem = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(OPS_TASK_PRIORITIES).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

router.post(
  "/admin/sessions/:id/action-items",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
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
    const parsed = CreateActionItem.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [row] = await db
      .insert(opsTasksTable)
      .values({
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        priority: parsed.data.priority ?? "medium",
        assigneeId: parsed.data.assigneeId ?? null,
        dueDate: parsed.data.dueDate ?? null,
        linkedObjectType: "session",
        linkedObjectId: id,
        createdBy: req.sessionUser!.id,
      })
      .returning();
    res.status(201).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
