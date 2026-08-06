import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const COMM_CHANNELS = ["email", "sms", "discord", "manual"] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];

export const COMM_STATUSES = ["queued", "sent", "failed", "bounced"] as const;
export type CommStatus = (typeof COMM_STATUSES)[number];

/**
 * Outbound communication history (docs/design/04 §6, 05 §5).
 *
 * Deliberately stores NO message body — only subject/template and outcome.
 * That keeps the personal-data surface small while still answering "did this
 * person get told, and when".
 *
 * `channel='manual'` lets ops record an out-of-band notice (a DM, a phone
 * call) so the record is complete before any sending integration exists.
 * Discord webhook dispatches also land here, which is why W10 needs no new
 * table of its own.
 */
export const communicationLogsTable = pgTable(
  "communication_logs",
  {
    id: serial("id").primaryKey(),
    recipientType: text("recipient_type"),
    recipientId: integer("recipient_id"),
    /** Address/handle/channel name, for audit. Never a message body. */
    recipientAddress: text("recipient_address"),
    channel: text("channel").notNull().$type<CommChannel>(),
    templateId: text("template_id"),
    subject: text("subject"),
    relatedObjectType: text("related_object_type"),
    relatedObjectId: integer("related_object_id"),
    status: text("status").notNull().default("queued").$type<CommStatus>(),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byRelated: index("communication_logs_related_idx").on(
      t.relatedObjectType,
      t.relatedObjectId,
    ),
    byChannel: index("communication_logs_channel_idx").on(
      t.channel,
      t.createdAt,
    ),
    /** Supports the "did we already notify about X today" dedupe check. */
    byTemplate: index("communication_logs_template_idx").on(
      t.templateId,
      t.createdAt,
    ),
  }),
);

export type CommunicationLog = typeof communicationLogsTable.$inferSelect;
export type InsertCommunicationLog =
  typeof communicationLogsTable.$inferInsert;
