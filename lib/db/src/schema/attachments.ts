import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { LinkableType } from "./_linkable";

export const ATTACHMENT_VISIBILITIES = [
  "private",
  "team_visible",
  "admin_only",
] as const;
export type AttachmentVisibility = (typeof ATTACHMENT_VISIBILITIES)[number];

/**
 * Uploaded file metadata (docs/design/04 §5).
 *
 * The object itself is stored with ACL `visibility=private`, so it is NOT
 * reachable through the unauthenticated `GET /api/storage/objects/*` path that
 * serves avatars. Downloads go through `GET /api/attachments/:id/download`,
 * which re-checks this row's visibility and the caller's scope.
 *
 * Receipts attached to a finance_record are additionally gated on the
 * `finance` ops role — the default `admin_only` alone is not enough for them.
 */
export const attachmentsTable = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    /** Storage object path, e.g. /objects/uploads/<uuid>. NOT a public URL. */
    objectPath: text("object_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    linkedObjectType: text("linked_object_type")
      .notNull()
      .$type<LinkableType>(),
    linkedObjectId: integer("linked_object_id").notNull(),
    ownerId: integer("owner_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    visibility: text("visibility")
      .notNull()
      .default("admin_only")
      .$type<AttachmentVisibility>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byLinked: index("attachments_linked_idx").on(
      t.linkedObjectType,
      t.linkedObjectId,
    ),
  }),
);

export type Attachment = typeof attachmentsTable.$inferSelect;
export type InsertAttachment = typeof attachmentsTable.$inferInsert;
