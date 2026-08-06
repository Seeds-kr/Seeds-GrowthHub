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

/**
 * Narrowed in W7 from `private | team_visible | admin_only`.
 *
 * `team_visible` was a DEAD VALUE: every attachment route is `requireAdmin`,
 * `attachmentsTable` is referenced in no other file, and no student or mentor
 * surface reads it — so the value promised a team audience that nothing could
 * ever serve (visibility-policy §4.2 forbids exactly this).
 *
 * It was removed rather than given a reader because there is no student-facing
 * attachment surface to serve: uploads come from the MarkdownEditor paste path
 * (meeting/document context) and from finance receipts, both ops-only. Adding a
 * student download route would have built a reader for an audience the product
 * does not have — the same mistake pointing the other way.
 *
 * Restore `team_visible` together with the student route that reads it, in one
 * change, when students actually own attachments.
 */
export const ATTACHMENT_VISIBILITIES = ["private", "admin_only"] as const;
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
