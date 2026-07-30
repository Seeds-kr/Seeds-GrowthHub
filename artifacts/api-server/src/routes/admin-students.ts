import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  applicationsTable,
  usersTable,
  studentsTable,
  studentCohortsTable,
  studentProgramsTable,
  cohortsTable,
  programsTable,
  attendanceRecordsTable,
  sessionsTable,
  assignmentSubmissionsTable,
  assignmentsTable,
} from "@workspace/db";
import { requireAdmin, hashPassword, requireOpsRole } from "../lib/auth";
import { issueActivationToken } from "../lib/activation";

const router: IRouter = Router();

// ADR-002: these two return applicant roster data (name/email/school/decision),
// the same class the recruiting gate protects elsewhere. Student CRUD below
// stays on requireAdmin (read-wide).
const requireRecruiting = requireOpsRole("recruiting");

// MVP4: password is now optional. When omitted, the user is created in an
// inactive state with a random unguessable placeholder hash, and an activation
// token (magic link) is issued. The admin shares the activation URL with the
// student, who picks their own password at /activate/:token.
const ConvertBody = z.object({
  password: z.string().min(8).max(200).optional(),
});

router.post(
  "/admin/applications/:id/convert-to-student",
  requireRecruiting,
  async (req, res) => {
    const appId = Number(req.params.id);
    if (!Number.isFinite(appId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = ConvertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, appId))
      .limit(1);
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (app.finalDecision !== "accepted") {
      res
        .status(400)
        .json({ error: "Only accepted applications can be converted" });
      return;
    }
    const [existing] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.applicationId, appId))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Already converted", studentId: existing.id });
      return;
    }
    const email = app.email.trim().toLowerCase();
    const [emailUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (emailUser) {
      res
        .status(409)
        .json({ error: "Email already used by another user account" });
      return;
    }
    try {
      const useMagicLink = !parsed.data.password;
      // For magic-link flow, store an unguessable random hash so direct login
      // is impossible until the user activates and picks a real password.
      const initialPassword =
        parsed.data.password ??
        (await import("node:crypto")).randomBytes(48).toString("base64url");
      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(usersTable)
          .values({
            name: app.name,
            email,
            passwordHash: await hashPassword(initialPassword),
            role: "student",
            isActive: !useMagicLink,
          })
          .returning();
        const [student] = await tx
          .insert(studentsTable)
          .values({
            userId: user.id,
            applicationId: appId,
            name: app.name,
            email,
            phone: app.phone,
            school: app.school,
            isActive: true,
          })
          .returning();
        return { user, student };
      });
      let activation:
        | { activationToken: string; activationPath: string; expiresAt: string }
        | undefined;
      if (useMagicLink) {
        const { token, expiresAt } = await issueActivationToken({
          userId: result.user.id,
          createdBy: req.sessionUser!.id,
        });
        activation = {
          activationToken: token,
          activationPath: `/activate/${token}`,
          expiresAt: expiresAt.toISOString(),
        };
      }
      res.status(201).json({
        id: result.student.id,
        userId: result.user.id,
        applicationId: appId,
        name: result.student.name,
        email: result.student.email,
        ...(activation ?? {}),
      });
    } catch (err) {
      req.log.error({ err }, "convert to student failed");
      res.status(500).json({ error: "Failed to convert" });
    }
  },
);

router.get("/admin/students", requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const cohortId = req.query.cohortId
    ? Number(req.query.cohortId)
    : undefined;
  const isActive =
    req.query.isActive === "true"
      ? true
      : req.query.isActive === "false"
        ? false
        : undefined;
  const conds = [];
  if (q) {
    conds.push(
      or(
        ilike(studentsTable.name, `%${q}%`),
        ilike(studentsTable.email, `%${q}%`),
        ilike(studentsTable.school, `%${q}%`),
      ),
    );
  }
  if (typeof isActive === "boolean") {
    conds.push(eq(studentsTable.isActive, isActive));
  }
  let baseQuery = db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      applicationId: studentsTable.applicationId,
      name: studentsTable.name,
      email: studentsTable.email,
      phone: studentsTable.phone,
      school: studentsTable.school,
      isActive: studentsTable.isActive,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .$dynamic();
  if (cohortId && Number.isFinite(cohortId)) {
    baseQuery = baseQuery.innerJoin(
      studentCohortsTable,
      and(
        eq(studentCohortsTable.studentId, studentsTable.id),
        eq(studentCohortsTable.cohortId, cohortId),
      ),
    );
  }
  if (conds.length > 0) baseQuery = baseQuery.where(and(...conds));
  const rows = await baseQuery.orderBy(desc(studentsTable.createdAt));
  res.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: rows.length,
  });
});

router.get("/admin/students/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [s] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, id))
    .limit(1);
  if (!s) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const application = s.applicationId
    ? (
        await db
          .select()
          .from(applicationsTable)
          .where(eq(applicationsTable.id, s.applicationId))
          .limit(1)
      )[0] ?? null
    : null;
  const cohorts = await db
    .select({
      id: cohortsTable.id,
      name: cohortsTable.name,
      status: cohortsTable.status,
      joinedAt: studentCohortsTable.joinedAt,
    })
    .from(studentCohortsTable)
    .innerJoin(cohortsTable, eq(studentCohortsTable.cohortId, cohortsTable.id))
    .where(eq(studentCohortsTable.studentId, id))
    .orderBy(asc(cohortsTable.id));
  const programs = await db
    .select({
      id: programsTable.id,
      name: programsTable.name,
      cohortId: programsTable.cohortId,
      status: programsTable.status,
    })
    .from(studentProgramsTable)
    .innerJoin(programsTable, eq(studentProgramsTable.programId, programsTable.id))
    .where(eq(studentProgramsTable.studentId, id));
  const attendance = await db
    .select({
      id: attendanceRecordsTable.id,
      sessionId: attendanceRecordsTable.sessionId,
      sessionTitle: sessionsTable.title,
      scheduledAt: sessionsTable.scheduledAt,
      status: attendanceRecordsTable.status,
      note: attendanceRecordsTable.note,
    })
    .from(attendanceRecordsTable)
    .innerJoin(sessionsTable, eq(attendanceRecordsTable.sessionId, sessionsTable.id))
    .where(eq(attendanceRecordsTable.studentId, id))
    .orderBy(desc(sessionsTable.scheduledAt));
  const submissions = await db
    .select({
      id: assignmentSubmissionsTable.id,
      assignmentId: assignmentSubmissionsTable.assignmentId,
      assignmentTitle: assignmentsTable.title,
      status: assignmentSubmissionsTable.status,
      submittedAt: assignmentSubmissionsTable.submittedAt,
      feedback: assignmentSubmissionsTable.feedback,
    })
    .from(assignmentSubmissionsTable)
    .innerJoin(
      assignmentsTable,
      eq(assignmentSubmissionsTable.assignmentId, assignmentsTable.id),
    )
    .where(eq(assignmentSubmissionsTable.studentId, id));
  // Summary counts
  const attCounts = {
    present: attendance.filter((a) => a.status === "present").length,
    late: attendance.filter((a) => a.status === "late").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    excused: attendance.filter((a) => a.status === "excused").length,
    total: attendance.length,
  };
  res.json({
    student: {
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    },
    application: application
      ? {
          ...application,
          submittedAt: application.submittedAt.toISOString(),
          updatedAt: application.updatedAt.toISOString(),
        }
      : null,
    cohorts: cohorts.map((c) => ({
      ...c,
      joinedAt: c.joinedAt.toISOString(),
    })),
    programs,
    attendance: attendance.map((a) => ({
      ...a,
      scheduledAt: a.scheduledAt.toISOString(),
    })),
    attendanceSummary: attCounts,
    submissions: submissions.map((s2) => ({
      ...s2,
      submittedAt: s2.submittedAt ? s2.submittedAt.toISOString() : null,
    })),
  });
});

const PatchStudentBody = z.object({
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
  school: z.string().optional(),
});
router.patch("/admin/students/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = PatchStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.school !== undefined) updates.school = parsed.data.school;
  const [updated] = await db
    .update(studentsTable)
    .set(updates)
    .where(eq(studentsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Sync user.isActive
  if (parsed.data.isActive !== undefined) {
    await db
      .update(usersTable)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(usersTable.id, updated.userId));
  }
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

const MembershipBody = z.object({ cohortId: z.number().int().positive() });
router.post(
  "/admin/students/:id/cohorts",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = MembershipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const inserted = await db
      .insert(studentCohortsTable)
      .values({ studentId: id, cohortId: parsed.data.cohortId })
      .onConflictDoNothing({
        target: [studentCohortsTable.studentId, studentCohortsTable.cohortId],
      })
      .returning();
    if (inserted.length === 0) {
      res.status(409).json({ error: "Already in cohort" });
      return;
    }
    res.status(201).json({
      id: inserted[0].id,
      studentId: id,
      cohortId: parsed.data.cohortId,
    });
  },
);

const ProgramMembershipBody = z.object({
  programId: z.number().int().positive(),
});
router.post(
  "/admin/students/:id/programs",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = ProgramMembershipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const inserted = await db
      .insert(studentProgramsTable)
      .values({ studentId: id, programId: parsed.data.programId })
      .onConflictDoNothing({
        target: [studentProgramsTable.studentId, studentProgramsTable.programId],
      })
      .returning();
    if (inserted.length === 0) {
      res.status(409).json({ error: "Already in program" });
      return;
    }
    res.status(201).json({
      id: inserted[0].id,
      studentId: id,
      programId: parsed.data.programId,
    });
  },
);

// List accepted applications not yet converted (for the convert UI)
router.get(
  "/admin/applications-accepted-pending",
  requireRecruiting,
  async (_req, res) => {
    const rows = await db
      .select({
        id: applicationsTable.id,
        name: applicationsTable.name,
        email: applicationsTable.email,
        school: applicationsTable.school,
        finalDecision: applicationsTable.finalDecision,
        studentId: studentsTable.id,
      })
      .from(applicationsTable)
      .leftJoin(
        studentsTable,
        eq(studentsTable.applicationId, applicationsTable.id),
      )
      .where(
        and(
          eq(applicationsTable.finalDecision, "accepted"),
          sql`${studentsTable.id} is null`,
        ),
      );
    res.json({ items: rows, total: rows.length });
  },
);

export default router;
