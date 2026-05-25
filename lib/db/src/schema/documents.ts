import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const DOC_TYPES = [
  "general",
  "meeting_note",
  "event_checklist",
  "recruitment_checklist",
  "finance",
  "onboarding",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_VISIBILITIES = ["admin_only", "mentor_visible"] as const;
export type DocVisibility = (typeof DOC_VISIBILITIES)[number];

/**
 * Internal GrowthHub documents. Markdown is source of truth.
 * Always admin-only at the route layer; `visibility` is stored for
 * future mentor surface. NEVER exposed to students.
 */
export const documentsTable = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull().default(""),
    docType: text("doc_type").notNull().default("general").$type<DocType>(),
    isTemplate: boolean("is_template").notNull().default(false),
    visibility: text("visibility")
      .notNull()
      .default("admin_only")
      .$type<DocVisibility>(),
    /** Polymorphic link to a related object (e.g. "meeting", "session", "project"). */
    linkedObjectType: text("linked_object_type"),
    linkedObjectId: integer("linked_object_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byType: index("documents_type_idx").on(t.docType),
    byTemplate: index("documents_template_idx").on(t.isTemplate),
  }),
);
export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = typeof documentsTable.$inferInsert;

/**
 * Append-only version snapshots. A new row is inserted whenever title
 * or contentMd changes on PATCH. version_no is monotonically increasing
 * per documentId, starting at 1 (first version captured at create time).
 */
export const documentVersionsTable = pgTable(
  "document_versions",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),
    editedBy: integer("edited_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("document_versions_unique").on(t.documentId, t.versionNo),
  }),
);
export type DocumentVersion = typeof documentVersionsTable.$inferSelect;
export type InsertDocumentVersion = typeof documentVersionsTable.$inferInsert;
