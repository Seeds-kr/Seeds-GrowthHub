import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  peopleProfilesTable,
  PEOPLE_KINDS,
  studentsTable,
  canViewMemberContacts,
  type PeopleKind,
} from "@workspace/db";
import {
  requireAdmin,
  requireStudent,
  requireMentor,
  optionalAuth,
} from "../lib/auth";

const router: IRouter = Router();

function toIso(p: typeof peopleProfilesTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function publicView(
  p: typeof peopleProfilesTable.$inferSelect,
  includeContact: boolean,
) {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    roleTitle: p.roleTitle,
    affiliation: p.affiliation,
    bio: p.bio,
    photoUrl: p.photoUrl,
    tags: p.tags,
    displayOrder: p.displayOrder,
    // Phone is only included for authenticated members. Non-members never
    // see it, even if a logged-in user reshares the JSON response.
    phone: includeContact ? p.phone : null,
  };
}

const KindParam = z.enum(PEOPLE_KINDS);

// Public: list profiles by kind, only public ones, ordered by displayOrder.
// If the request carries a valid session for a member-role user, phone numbers
// are included; otherwise they are stripped.
router.get("/people/:kind", optionalAuth, async (req, res) => {
  const parsed = KindParam.safeParse(req.params.kind);
  if (!parsed.success) {
    res.status(404).json({ error: "Unknown kind" });
    return;
  }
  const rows = await db
    .select()
    .from(peopleProfilesTable)
    .where(
      and(
        eq(peopleProfilesTable.kind, parsed.data),
        eq(peopleProfilesTable.isPublic, true),
      ),
    )
    .orderBy(asc(peopleProfilesTable.displayOrder), asc(peopleProfilesTable.id));
  const includeContact = req.sessionUser
    ? canViewMemberContacts(req.sessionUser)
    : false;
  res.json({ items: rows.map((r) => publicView(r, includeContact)) });
});

// Public: a single profile by id (kind in path is for URL symmetry with the
// frontend; the lookup is by id). Returns 404 unless the row exists, matches
// the requested kind, AND is_public=true. Phone gating same as the list.
router.get("/people/:kind/:id", optionalAuth, async (req, res) => {
  const parsedKind = KindParam.safeParse(req.params.kind);
  const id = Number(req.params.id);
  if (!parsedKind.success || !Number.isFinite(id) || id <= 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(peopleProfilesTable)
    .where(
      and(
        eq(peopleProfilesTable.id, id),
        eq(peopleProfilesTable.kind, parsedKind.data),
        eq(peopleProfilesTable.isPublic, true),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const includeContact = req.sessionUser
    ? canViewMemberContacts(req.sessionUser)
    : false;
  res.json(publicView(row, includeContact));
});

// Allow http(s) URLs or internal storage paths (/api/storage/objects/... or
// /objects/...). Blocks javascript:/data: vectors.
const PhotoUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (s) =>
      s === "" ||
      /^https?:\/\//i.test(s) ||
      s.startsWith("/api/storage/") ||
      s.startsWith("/objects/"),
    { message: "photoUrl must be http(s) or an internal storage path" },
  )
  .nullable()
  .optional();

// Admin schema (all fields, kind required on create only).
const AdminBody = z.object({
  kind: KindParam,
  userId: z.number().int().positive().nullable().optional(),
  studentId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  roleTitle: z.string().trim().max(200).nullable().optional(),
  affiliation: z.string().trim().max(200).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  photoUrl: PhotoUrl,
  phone: z.string().trim().max(30).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  displayOrder: z.number().int().min(-10000).max(10000).optional(),
  isPublic: z.boolean().optional(),
});

router.get("/admin/people", requireAdmin, async (req, res) => {
  const kindQ = req.query.kind as string | undefined;
  const where =
    kindQ && (PEOPLE_KINDS as readonly string[]).includes(kindQ)
      ? eq(peopleProfilesTable.kind, kindQ as PeopleKind)
      : undefined;
  const rows = await db
    .select()
    .from(peopleProfilesTable)
    .where(where as any)
    .orderBy(
      asc(peopleProfilesTable.kind),
      asc(peopleProfilesTable.displayOrder),
      asc(peopleProfilesTable.id),
    );
  res.json({ items: rows.map(toIso), total: rows.length });
});

router.post("/admin/people", requireAdmin, async (req, res) => {
  const parsed = AdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db
      .insert(peopleProfilesTable)
      .values({
        kind: parsed.data.kind,
        userId: parsed.data.userId ?? null,
        studentId: parsed.data.studentId ?? null,
        name: parsed.data.name,
        roleTitle: parsed.data.roleTitle ?? null,
        affiliation: parsed.data.affiliation ?? null,
        bio: parsed.data.bio ?? null,
        photoUrl: parsed.data.photoUrl ?? null,
        phone: parsed.data.phone ?? null,
        tags: parsed.data.tags ?? [],
        displayOrder: parsed.data.displayOrder ?? 0,
        isPublic: parsed.data.isPublic ?? false,
      })
      .returning();
    res.status(201).json(toIso(row));
  } catch (e: any) {
    if (e?.cause?.code === "23505" || String(e?.message ?? "").includes("duplicate")) {
      res.status(409).json({ error: "Profile already exists for this user/student" });
      return;
    }
    throw e;
  }
});

router.patch("/admin/people/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = AdminBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "kind", "userId", "studentId", "name", "roleTitle", "affiliation",
    "bio", "photoUrl", "phone", "tags", "displayOrder", "isPublic",
  ] as const) {
    if (k in parsed.data) patch[k] = (parsed.data as any)[k];
  }
  const [row] = await db
    .update(peopleProfilesTable)
    .set(patch)
    .where(eq(peopleProfilesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete("/admin/people/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(peopleProfilesTable)
    .where(eq(peopleProfilesTable.id, id))
    .returning({ id: peopleProfilesTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

// Student self-profile (member kind only). GET lazy-creates a row for me.
async function getOrCreateMyMemberProfile(userId: number) {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);
  if (!student) return null;
  const [existing] = await db
    .select()
    .from(peopleProfilesTable)
    .where(eq(peopleProfilesTable.studentId, student.id))
    .limit(1);
  if (existing) return { student, profile: existing };
  // Race-safe insert: if a concurrent request already created the row, skip
  // the insert and re-select. The unique index on student_id guarantees one row.
  const inserted = await db
    .insert(peopleProfilesTable)
    .values({
      kind: "member",
      studentId: student.id,
      userId: student.userId,
      name: student.name,
      roleTitle: null,
      affiliation: student.school ?? null,
      bio: null,
      photoUrl: null,
      tags: [],
      displayOrder: 0,
      isPublic: false,
    })
    .onConflictDoNothing({ target: peopleProfilesTable.studentId })
    .returning();
  if (inserted.length > 0) return { student, profile: inserted[0] };
  const [reread] = await db
    .select()
    .from(peopleProfilesTable)
    .where(eq(peopleProfilesTable.studentId, student.id))
    .limit(1);
  return reread ? { student, profile: reread } : null;
}

router.get("/student/profile", requireStudent, async (req, res) => {
  const r = await getOrCreateMyMemberProfile(req.sessionUser!.id);
  if (!r) {
    res.status(404).json({ error: "Student record not found" });
    return;
  }
  res.json(toIso(r.profile));
});

const SelfBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  roleTitle: z.string().trim().max(200).nullable().optional(),
  affiliation: z.string().trim().max(200).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  photoUrl: PhotoUrl,
  phone: z.string().trim().max(30).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  isPublic: z.boolean().optional(),
});

router.patch("/student/profile", requireStudent, async (req, res) => {
  const parsed = SelfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const r = await getOrCreateMyMemberProfile(req.sessionUser!.id);
  if (!r) {
    res.status(404).json({ error: "Student record not found" });
    return;
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "name", "roleTitle", "affiliation", "bio", "photoUrl", "phone", "tags", "isPublic",
  ] as const) {
    if (k in parsed.data) patch[k] = (parsed.data as any)[k];
  }
  const [row] = await db
    .update(peopleProfilesTable)
    .set(patch)
    .where(eq(peopleProfilesTable.id, r.profile.id))
    .returning();
  res.json(toIso(row));
});

// Mentor self-profile. Unlike students, mentor profiles are NOT lazy-created
// — an admin must first create a `people_profiles` row with kind=mentor and
// link it to the mentor's user via userId. Returns 404 with a friendly message
// otherwise so the mentor can ask an admin to set them up.
router.get("/mentor/profile", requireMentor, async (req, res) => {
  const [row] = await db
    .select()
    .from(peopleProfilesTable)
    .where(
      and(
        eq(peopleProfilesTable.userId, req.sessionUser!.id),
        eq(peopleProfilesTable.kind, "mentor"),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({
      error:
        "Mentor profile not set up. Please ask an admin to create your profile in /admin/people.",
    });
    return;
  }
  res.json(toIso(row));
});

router.patch("/mentor/profile", requireMentor, async (req, res) => {
  const parsed = SelfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [existing] = await db
    .select()
    .from(peopleProfilesTable)
    .where(
      and(
        eq(peopleProfilesTable.userId, req.sessionUser!.id),
        eq(peopleProfilesTable.kind, "mentor"),
      ),
    )
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Mentor profile not set up" });
    return;
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "name", "roleTitle", "affiliation", "bio", "photoUrl", "phone", "tags", "isPublic",
  ] as const) {
    if (k in parsed.data) patch[k] = (parsed.data as any)[k];
  }
  const [row] = await db
    .update(peopleProfilesTable)
    .set(patch)
    .where(eq(peopleProfilesTable.id, existing.id))
    .returning();
  res.json(toIso(row));
});

export default router;
