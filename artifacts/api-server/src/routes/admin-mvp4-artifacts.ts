import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  mvp4ArtifactsTable,
  ARTIFACT_TYPES,
  ARTIFACT_VISIBILITIES,
  studentsTable,
  projectsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const Body = z.object({
  studentId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  studyId: z.number().int().positive().nullable().optional(),
  assignmentSubmissionId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(8000).nullable().optional(),
  artifactType: z.enum(ARTIFACT_TYPES).optional(),
  url: z.string().url().max(2000),
  visibility: z.enum(ARTIFACT_VISIBILITIES).optional(),
});

function toIso(a: typeof mvp4ArtifactsTable.$inferSelect) {
  return {
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/admin/artifacts", requireAdmin, async (req, res) => {
  const studentId = req.query.studentId
    ? Number(req.query.studentId)
    : undefined;
  const projectId = req.query.projectId
    ? Number(req.query.projectId)
    : undefined;
  const filters = [];
  if (studentId) filters.push(eq(mvp4ArtifactsTable.studentId, studentId));
  if (projectId) filters.push(eq(mvp4ArtifactsTable.projectId, projectId));
  const studyId = req.query.studyId ? Number(req.query.studyId) : undefined;
  if (studyId && Number.isFinite(studyId))
    filters.push(eq(mvp4ArtifactsTable.studyId, studyId));
  const rows = await db
    .select({
      a: mvp4ArtifactsTable,
      studentName: studentsTable.name,
      projectTitle: projectsTable.title,
    })
    .from(mvp4ArtifactsTable)
    .leftJoin(studentsTable, eq(mvp4ArtifactsTable.studentId, studentsTable.id))
    .leftJoin(projectsTable, eq(mvp4ArtifactsTable.projectId, projectsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(mvp4ArtifactsTable.createdAt));
  res.json({
    items: rows.map((row) => ({
      ...toIso(row.a),
      studentName: row.studentName,
      projectTitle: row.projectTitle,
    })),
    total: rows.length,
  });
});

router.post("/admin/artifacts", requireAdmin, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(mvp4ArtifactsTable)
    .values({
      studentId: parsed.data.studentId ?? null,
      projectId: parsed.data.projectId ?? null,
      studyId: parsed.data.studyId ?? null,
      assignmentSubmissionId: parsed.data.assignmentSubmissionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      artifactType: parsed.data.artifactType ?? "link",
      url: parsed.data.url,
      visibility: parsed.data.visibility ?? "student_visible",
      createdBy: req.sessionUser!.id,
    })
    .returning();
  res.status(201).json(toIso(row));
});

router.patch("/admin/artifacts/:id", requireAdmin, async (req, res) => {
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
  const [row] = await db
    .update(mvp4ArtifactsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mvp4ArtifactsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toIso(row));
});

router.delete("/admin/artifacts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = await db
    .delete(mvp4ArtifactsTable)
    .where(eq(mvp4ArtifactsTable.id, id))
    .returning({ id: mvp4ArtifactsTable.id });
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
