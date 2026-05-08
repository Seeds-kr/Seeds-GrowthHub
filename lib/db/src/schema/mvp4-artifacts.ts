import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { projectsTable } from "./projects";
import { assignmentSubmissionsTable } from "./assignments";
import { usersTable } from "./users";

export const ARTIFACT_TYPES = [
  "link",
  "document",
  "presentation",
  "video",
  "code",
  "image",
  "report",
  "other",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_VISIBILITIES = [
  "private",
  "student_visible",
  "cohort_visible",
  "admin_only",
] as const;
export type ArtifactVisibility = (typeof ARTIFACT_VISIBILITIES)[number];

// Note: table name is "artifacts"; the JS export uses `mvp4ArtifactsTable` to
// avoid confusion with the monorepo "artifacts/" directory in tooling.
export const mvp4ArtifactsTable = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => studentsTable.id, {
    onDelete: "set null",
  }),
  projectId: integer("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),
  assignmentSubmissionId: integer("assignment_submission_id").references(
    () => assignmentSubmissionsTable.id,
    { onDelete: "set null" },
  ),
  title: text("title").notNull(),
  description: text("description"),
  artifactType: text("artifact_type")
    .notNull()
    .default("link")
    .$type<ArtifactType>(),
  url: text("url").notNull(),
  visibility: text("visibility")
    .notNull()
    .default("student_visible")
    .$type<ArtifactVisibility>(),
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type Mvp4Artifact = typeof mvp4ArtifactsTable.$inferSelect;
export type InsertMvp4Artifact = typeof mvp4ArtifactsTable.$inferInsert;
