import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  AdminLoginBody,
  UpdateApplicationBody,
} from "@workspace/api-zod";
import {
  db,
  applicationsTable,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@workspace/db";
import {
  clearSessionCookie,
  getSession,
  requireAdmin,
  setSessionCookie,
  verifyAdminCredentials,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/admin/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const { email, password } = parsed.data;
  if (!verifyAdminCredentials(email, password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  setSessionCookie(res, email);
  res.json({ email });
});

router.post("/admin/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/admin/me", (req, res) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ email: session.email });
});

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    typeof value === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

router.get("/admin/applications/stats", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      status: applicationsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(applicationsTable)
    .groupBy(applicationsTable.status);
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  res.json({
    total,
    byStatus: APPLICATION_STATUSES.map((status) => ({
      status,
      count: Number(rows.find((r) => r.status === status)?.count ?? 0),
    })),
  });
});

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).replace(/\r?\n/g, " ");
  // Prevent CSV formula injection in spreadsheet apps by prefixing
  // any value starting with =, +, -, @, or a tab/CR with a single quote.
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get("/admin/applications/export", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(applicationsTable)
    .orderBy(desc(applicationsTable.submittedAt));
  const headers = [
    "id",
    "name",
    "email",
    "phone",
    "school",
    "grade",
    "birth_year",
    "interest_area",
    "motivation",
    "experience",
    "problem_awareness",
    "expectation",
    "privacy_consent",
    "status",
    "admin_note",
    "submitted_at",
    "updated_at",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.name,
        r.email,
        r.phone,
        r.school,
        r.grade,
        r.birthYear,
        r.interestArea,
        r.motivation,
        r.experience,
        r.problemAwareness,
        r.expectation,
        r.privacyConsent,
        r.status,
        r.adminNote ?? "",
        r.submittedAt.toISOString(),
        r.updatedAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = "\uFEFF" + lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="seeds-applications-${new Date()
      .toISOString()
      .slice(0, 10)}.csv"`,
  );
  res.send(csv);
});

router.get("/admin/applications", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const statusParam = req.query.status;
  const filters = [] as ReturnType<typeof eq>[];
  if (q.length > 0) {
    const like = `%${q}%`;
    const orFilter = or(
      ilike(applicationsTable.name, like),
      ilike(applicationsTable.email, like),
      ilike(applicationsTable.school, like),
    );
    if (orFilter) filters.push(orFilter);
  }
  if (isApplicationStatus(statusParam)) {
    filters.push(eq(applicationsTable.status, statusParam));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await db
    .select({
      id: applicationsTable.id,
      name: applicationsTable.name,
      email: applicationsTable.email,
      school: applicationsTable.school,
      grade: applicationsTable.grade,
      interestArea: applicationsTable.interestArea,
      status: applicationsTable.status,
      submittedAt: applicationsTable.submittedAt,
    })
    .from(applicationsTable)
    .where(where)
    .orderBy(desc(applicationsTable.submittedAt))
    .limit(500);

  res.json({
    items: items.map((i) => ({
      ...i,
      submittedAt: i.submittedAt.toISOString(),
    })),
    total: items.length,
  });
});

router.get("/admin/applications/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.patch("/admin/applications/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.adminNote !== undefined)
    update.adminNote = parsed.data.adminNote;
  const [row] = await db
    .update(applicationsTable)
    .set(update)
    .where(eq(applicationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
