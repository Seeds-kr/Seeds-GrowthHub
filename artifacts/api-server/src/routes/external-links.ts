import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  externalLinksTable,
  studentsTable,
  EXTERNAL_LINK_VISIBILITIES,
  LINK_TYPES,
} from "@workspace/db";
import { requireAdmin, requireStudent, requireAdminOrMentor } from "../lib/auth";
import { audit } from "../lib/audit";
import { HttpUrl } from "../lib/safe-url";
import { getStudentIdForUser, studentOnTeam } from "../lib/team-scope";
import {
  isLinkParentType,
  linkTargetExists,
  mentorLinkFilter,
  opsCanReachParent,
  opsVisibilityFilter,
  parentLabel,
  studentLinkFilter,
  type LinkParentType,
} from "../lib/external-link-scope";

const router: IRouter = Router();

/**
 * External reference links (docs/design/04 §4, W7).
 *
 * Read access is the INTERSECTION of parent reachability and link visibility —
 * see visibility-policy §5.1 and `lib/external-link-scope.ts`. No route filters
 * on `visibility` alone.
 *
 * Writes WERE ops-only. That is no longer true — design 06 §7 added a student
 * write path scoped to the caller's own project/study.
 *
 * The old reasoning was that this table is operational context ("Discord 채널,
 * Drive 운영자료, 참고 문서") and a project's headline URLs live in columns on
 * `projects`. What it missed: with Notion dropped (ADR-010), a team's Drive
 * folders and issue boards have nowhere else to go, and the columns on
 * `projects` are three fixed slots (github/demo/deck), not a list. Saying
 * "GrowthHub manages the links" while only ops could add one made ops the
 * bottleneck for every team's reference material.
 *
 * Students may only reach `project`/`study` parents they are a member of, and
 * may only choose `team_visible`/`cohort_visible` — see §7 and the student
 * routes at the bottom of this file.
 */

const CreateBody = z.object({
  url: HttpUrl,
  title: z.string().trim().min(1).max(300),
  linkType: z.enum(LINK_TYPES).optional(),
  description: z.string().max(4000).nullable().optional(),
  linkedObjectType: z.string().max(50),
  linkedObjectId: z.number().int().positive(),
  visibility: z.enum(EXTERNAL_LINK_VISIBILITIES).optional(),
});

const UpdateBody = z.object({
  url: HttpUrl.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  linkType: z.enum(LINK_TYPES).optional(),
  description: z.string().max(4000).nullable().optional(),
  visibility: z.enum(EXTERNAL_LINK_VISIBILITIES).optional(),
  /** Manual freshness confirmation. `true` stamps now, `false` clears. */
  freshnessChecked: z.boolean().optional(),
});

/**
 * Which visibility values make sense for a given parent. A `cohort_visible`
 * link on a `meeting` would claim an audience the parent never grants — the
 * student would still be filtered out on read, leaving a value that silently
 * does nothing. Rejecting at write time keeps the stored value honest.
 */
function visibilityAllowedForParent(
  type: LinkParentType,
  visibility: string,
): boolean {
  if (visibility === "private" || visibility === "admin_only") return true;
  switch (type) {
    case "project":
    case "study":
      return visibility === "team_visible" || visibility === "cohort_visible";
    case "session":
    case "cohort":
    case "program":
      return visibility === "cohort_visible";
    default:
      // meeting / document / application / finance_record / ops_task /
      // student / user have no student or team audience at all.
      return false;
  }
}

// ---- Ops -----------------------------------------------------------------

router.get("/admin/external-links", requireAdmin, async (req, res) => {
  const user = req.sessionUser!;
  const type = req.query.linkedObjectType;
  const rawId = req.query.linkedObjectId;

  const conds = [opsVisibilityFilter(user)];

  if (typeof type === "string" && type.length > 0) {
    if (!isLinkParentType(type)) {
      res.status(400).json({ error: "Unknown linkedObjectType" });
      return;
    }
    if (!opsCanReachParent(user, type)) {
      // 404, not 403 — a denied filter should not confirm the type is gated.
      res.status(404).json({ error: "Not found" });
      return;
    }
    conds.push(eq(externalLinksTable.linkedObjectType, type));
    if (typeof rawId === "string" && rawId.length > 0) {
      const id = Number(rawId);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid linkedObjectId" });
        return;
      }
      conds.push(eq(externalLinksTable.linkedObjectId, id));
    }
  }

  const rows = await db
    .select()
    .from(externalLinksTable)
    .where(and(...conds))
    .orderBy(desc(externalLinksTable.createdAt));

  res.json({
    items: await Promise.all(
      rows.map(async (r) => ({
        ...r,
        parentLabel: await parentLabel(
          r.linkedObjectType as LinkParentType,
          r.linkedObjectId,
        ),
      })),
    ),
    total: rows.length,
  });
});

router.post("/admin/external-links", requireAdmin, async (req, res) => {
  const user = req.sessionUser!;
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;

  if (!isLinkParentType(d.linkedObjectType)) {
    res.status(422).json({ error: "Unknown linkedObjectType" });
    return;
  }
  if (!opsCanReachParent(user, d.linkedObjectType)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await linkTargetExists(d.linkedObjectType, d.linkedObjectId))) {
    res.status(422).json({ error: "Link target does not exist" });
    return;
  }

  const visibility = d.visibility ?? "admin_only";
  if (!visibilityAllowedForParent(d.linkedObjectType, visibility)) {
    res.status(422).json({
      error: `${d.linkedObjectType}에는 ${visibility} 공개범위를 쓸 수 없습니다. 이 대상에는 볼 수 있는 청중이 없습니다.`,
    });
    return;
  }

  const [row] = await db
    .insert(externalLinksTable)
    .values({
      url: d.url,
      title: d.title,
      linkType: d.linkType ?? "other",
      description: d.description ?? null,
      linkedObjectType: d.linkedObjectType,
      linkedObjectId: d.linkedObjectId,
      ownerId: user.id,
      visibility,
    })
    .returning();

  audit({
    action: "visibility_change",
    req,
    targetType: d.linkedObjectType,
    targetId: d.linkedObjectId,
    after: { visibility, linkType: row.linkType },
    note: `external_link created: ${row.title}`,
  });

  res.status(201).json(row);
});

router.patch("/admin/external-links/:id", requireAdmin, async (req, res) => {
  const user = req.sessionUser!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [existing] = await db
    .select()
    .from(externalLinksTable)
    .where(eq(externalLinksTable.id, id))
    .limit(1);
  // Another owner's private link is invisible here too, so 404 rather than 403.
  if (
    !existing ||
    !opsCanReachParent(user, existing.linkedObjectType as LinkParentType) ||
    (existing.visibility === "private" && existing.ownerId !== user.id)
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const d = parsed.data;
  if (
    d.visibility !== undefined &&
    !visibilityAllowedForParent(
      existing.linkedObjectType as LinkParentType,
      d.visibility,
    )
  ) {
    res.status(422).json({
      error: `${existing.linkedObjectType}에는 ${d.visibility} 공개범위를 쓸 수 없습니다.`,
    });
    return;
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.url !== undefined) update.url = d.url;
  if (d.title !== undefined) update.title = d.title;
  if (d.linkType !== undefined) update.linkType = d.linkType;
  if (d.description !== undefined) update.description = d.description;
  if (d.visibility !== undefined) update.visibility = d.visibility;
  if (d.freshnessChecked !== undefined) {
    update.freshnessCheckedAt = d.freshnessChecked ? new Date() : null;
  }

  const [row] = await db
    .update(externalLinksTable)
    .set(update)
    .where(eq(externalLinksTable.id, id))
    .returning();

  if (d.visibility !== undefined && d.visibility !== existing.visibility) {
    audit({
      action: "visibility_change",
      req,
      targetType: existing.linkedObjectType,
      targetId: existing.linkedObjectId,
      before: { visibility: existing.visibility },
      after: { visibility: d.visibility },
      note: `external_link: ${row.title}`,
    });
  }

  res.json(row);
});

router.delete("/admin/external-links/:id", requireAdmin, async (req, res) => {
  const user = req.sessionUser!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(externalLinksTable)
    .where(eq(externalLinksTable.id, id))
    .limit(1);
  if (
    !existing ||
    !opsCanReachParent(user, existing.linkedObjectType as LinkParentType) ||
    (existing.visibility === "private" && existing.ownerId !== user.id)
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(externalLinksTable).where(eq(externalLinksTable.id, id));
  audit({
    action: "visibility_change",
    req,
    targetType: existing.linkedObjectType,
    targetId: existing.linkedObjectId,
    note: `external_link deleted: ${existing.title}`,
  });
  res.json({ ok: true });
});

// ---- Student -------------------------------------------------------------

/**
 * §6 checklist: membership is resolved into the WHERE clause, never filtered in
 * JS afterwards, and `admin_only`/other-owner `private` rows can never enter the
 * result because `studentLinkFilter` only ever emits membership-scoped branches.
 */
router.get("/student/external-links", requireStudent, async (req, res) => {
  const user = req.sessionUser!;
  const [student] = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.userId, user.id))
    .limit(1);
  if (!student) {
    res.json({ items: [], total: 0 });
    return;
  }

  const filter = await studentLinkFilter(user.id, student.id);
  if (!filter) {
    res.json({ items: [], total: 0 });
    return;
  }

  const rows = await db
    .select({
      id: externalLinksTable.id,
      url: externalLinksTable.url,
      title: externalLinksTable.title,
      linkType: externalLinksTable.linkType,
      description: externalLinksTable.description,
      linkedObjectType: externalLinksTable.linkedObjectType,
      linkedObjectId: externalLinksTable.linkedObjectId,
      visibility: externalLinksTable.visibility,
      freshnessCheckedAt: externalLinksTable.freshnessCheckedAt,
      createdAt: externalLinksTable.createdAt,
    })
    .from(externalLinksTable)
    .where(filter)
    .orderBy(desc(externalLinksTable.createdAt));

  res.json({ items: rows, total: rows.length });
});

// ---- Mentor --------------------------------------------------------------

/**
 * Scope-based per ADR-004: assigned projects only. A mentor with no active
 * assignment gets an empty list, not a 403 — holding the mentor role alone
 * opens nothing.
 */
router.get("/mentor/external-links", requireAdminOrMentor, async (req, res) => {
  const user = req.sessionUser!;
  const filter = await mentorLinkFilter(user.id);
  if (!filter) {
    res.json({ items: [], total: 0 });
    return;
  }

  const rows = await db
    .select({
      id: externalLinksTable.id,
      url: externalLinksTable.url,
      title: externalLinksTable.title,
      linkType: externalLinksTable.linkType,
      description: externalLinksTable.description,
      // The student route already returns this; the mentor route did not, which
      // left a caller unable to tell which team a link belongs to when a mentor
      // carries more than one. Not sensitive — mentor scope is already
      // project-only, so the value is always a project they were assigned.
      linkedObjectType: externalLinksTable.linkedObjectType,
      linkedObjectId: externalLinksTable.linkedObjectId,
      visibility: externalLinksTable.visibility,
      freshnessCheckedAt: externalLinksTable.freshnessCheckedAt,
      createdAt: externalLinksTable.createdAt,
    })
    .from(externalLinksTable)
    .where(filter)
    .orderBy(desc(externalLinksTable.createdAt));

  res.json({ items: rows, total: rows.length });
});

// ---- Student writes (design 06 §7) ---------------------------------------

/**
 * A student may only attach links to a `project`/`study` they are ON, and only
 * with an audience they themselves can see.
 *
 * `admin_only` and `private` are excluded deliberately: `admin_only` would let
 * a student create a row they cannot read back (it would vanish on the next
 * page load, which reads as a bug), and `private` on a team parent means
 * "visible to me alone", which defeats the point of pinning it to the team.
 * Ops keeps the full four-value vocabulary on its own routes.
 */
const STUDENT_LINK_VISIBILITIES = ["team_visible", "cohort_visible"] as const;

const StudentCreateBody = z.object({
  url: HttpUrl,
  title: z.string().trim().min(1).max(300),
  linkType: z.enum(LINK_TYPES).optional(),
  description: z.string().max(4000).nullable().optional(),
  ownerType: z.enum(["project", "study"]),
  ownerId: z.number().int().positive(),
  visibility: z.enum(STUDENT_LINK_VISIBILITIES).optional(),
});

const StudentUpdateBody = z.object({
  url: HttpUrl.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  linkType: z.enum(LINK_TYPES).optional(),
  description: z.string().max(4000).nullable().optional(),
  visibility: z.enum(STUDENT_LINK_VISIBILITIES).optional(),
});

/**
 * Resolve the caller to a team-member student, or null.
 * Shared by all three student write routes so the membership re-check cannot
 * be forgotten in one of them.
 */
async function studentMemberOf(
  userId: number,
  ownerType: "project" | "study",
  ownerId: number,
): Promise<number | null> {
  const studentId = await getStudentIdForUser(userId);
  if (!studentId) return null;
  return (await studentOnTeam(studentId, ownerType, ownerId)) ? studentId : null;
}

router.post("/student/external-links", requireStudent, async (req, res) => {
  const parsed = StudentCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const d = parsed.data;
  if (!(await studentMemberOf(req.sessionUser!.id, d.ownerType, d.ownerId))) {
    // 404 not 403 — same rule as the rest of the team surfaces.
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await linkTargetExists(d.ownerType, d.ownerId))) {
    res.status(422).json({ error: "연결 대상이 존재하지 않습니다." });
    return;
  }

  const [row] = await db
    .insert(externalLinksTable)
    .values({
      url: d.url,
      title: d.title,
      linkType: d.linkType ?? "other",
      description: d.description ?? null,
      linkedObjectType: d.ownerType,
      linkedObjectId: d.ownerId,
      ownerId: req.sessionUser!.id,
      visibility: d.visibility ?? "team_visible",
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/student/external-links/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = StudentUpdateBody.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [existing] = await db
    .select()
    .from(externalLinksTable)
    .where(eq(externalLinksTable.id, id))
    .limit(1);
  // Only team-parented links are reachable here at all — a student must never
  // be able to edit a link hanging off a meeting or a finance record.
  if (
    !existing ||
    (existing.linkedObjectType !== "project" &&
      existing.linkedObjectType !== "study") ||
    !(await studentMemberOf(
      req.sessionUser!.id,
      existing.linkedObjectType,
      existing.linkedObjectId,
    ))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const d = parsed.data;
  const [row] = await db
    .update(externalLinksTable)
    .set({
      ...(d.url !== undefined ? { url: d.url } : {}),
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.linkType !== undefined ? { linkType: d.linkType } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.visibility !== undefined ? { visibility: d.visibility } : {}),
      updatedAt: new Date(),
    })
    .where(eq(externalLinksTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/student/external-links/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(externalLinksTable)
    .where(eq(externalLinksTable.id, id))
    .limit(1);
  if (
    !existing ||
    (existing.linkedObjectType !== "project" &&
      existing.linkedObjectType !== "study") ||
    !(await studentMemberOf(
      req.sessionUser!.id,
      existing.linkedObjectType,
      existing.linkedObjectId,
    ))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(externalLinksTable).where(eq(externalLinksTable.id, id));
  res.json({ ok: true });
});

export default router;
