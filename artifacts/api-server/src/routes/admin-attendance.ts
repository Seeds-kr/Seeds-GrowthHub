import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  attendanceRecordsTable,
  sessionsTable,
  studentsTable,
  ATTENDANCE_STATUSES,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

/**
 * W8 — cohort-wide attendance rollup.
 *
 * Entry has always been per session (`PUT /admin/sessions/:id/attendance`), so
 * "who is falling behind" could only be answered by opening every session in
 * turn. This aggregates the same rows; it writes nothing.
 *
 * `requireAdmin` rather than an ops role: attendance is general operations, and
 * no OPS_ROLE in the W1 split owns it. Deliberately NOT gated on `recruiting` —
 * that would hide it from the very people running sessions.
 */
router.get("/admin/attendance", requireAdmin, async (req, res) => {
  const rawCohort = req.query.cohortId;
  if (typeof rawCohort !== "string" || rawCohort.length === 0) {
    res.status(400).json({ error: "cohortId required" });
    return;
  }
  const cohortId = Number(rawCohort);
  if (!Number.isFinite(cohortId)) {
    res.status(400).json({ error: "Invalid cohortId" });
    return;
  }

  // Sessions in scope. Counted from the session list, not from attendance rows,
  // so a session nobody was marked for still counts against the denominator —
  // otherwise a forgotten roll call silently inflates everyone's rate.
  const sessions = await db
    .select({ id: sessionsTable.id, title: sessionsTable.title })
    .from(sessionsTable)
    .where(eq(sessionsTable.cohortId, cohortId));

  if (sessions.length === 0) {
    res.json({ sessionCount: 0, students: [], totals: emptyTotals() });
    return;
  }

  const rows = await db
    .select({
      studentId: attendanceRecordsTable.studentId,
      studentName: studentsTable.name,
      status: attendanceRecordsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(attendanceRecordsTable)
    .innerJoin(
      sessionsTable,
      eq(attendanceRecordsTable.sessionId, sessionsTable.id),
    )
    .innerJoin(
      studentsTable,
      eq(attendanceRecordsTable.studentId, studentsTable.id),
    )
    .where(and(eq(sessionsTable.cohortId, cohortId)))
    .groupBy(
      attendanceRecordsTable.studentId,
      studentsTable.name,
      attendanceRecordsTable.status,
    );

  const byStudent = new Map<
    number,
    { studentId: number; studentName: string; counts: Record<string, number> }
  >();
  for (const r of rows) {
    let entry = byStudent.get(r.studentId);
    if (!entry) {
      entry = {
        studentId: r.studentId,
        studentName: r.studentName,
        counts: emptyTotals(),
      };
      byStudent.set(r.studentId, entry);
    }
    entry.counts[r.status] = r.count;
  }

  const sessionCount = sessions.length;
  const students = [...byStudent.values()]
    .map((s) => {
      const marked = ATTENDANCE_STATUSES.reduce(
        (n, k) => n + (s.counts[k] ?? 0),
        0,
      );
      // `excused` counts as neither attended nor missed — it is removed from
      // the denominator instead of quietly scoring as an absence.
      const excused = s.counts.excused ?? 0;
      const denom = sessionCount - excused;
      const attended = (s.counts.present ?? 0) + (s.counts.late ?? 0);
      return {
        ...s,
        marked,
        unmarked: sessionCount - marked,
        attendanceRate:
          denom > 0 ? Math.round((attended / denom) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => {
      // Lowest rate first — this screen exists to surface who is slipping.
      if (a.attendanceRate === null) return 1;
      if (b.attendanceRate === null) return -1;
      return a.attendanceRate - b.attendanceRate;
    });

  const totals = emptyTotals();
  for (const s of byStudent.values()) {
    for (const k of ATTENDANCE_STATUSES) totals[k] += s.counts[k] ?? 0;
  }

  res.json({ sessionCount, students, totals });
});

function emptyTotals(): Record<string, number> {
  const t: Record<string, number> = {};
  for (const s of ATTENDANCE_STATUSES) t[s] = 0;
  return t;
}

export default router;
