/**
 * Single whitelist for polymorphic links (docs/design/04 §2).
 *
 * `audit_logs`, `attachments` and `external_links` all point at arbitrary
 * objects via (linked_object_type, linked_object_id). There is no FK, so the
 * type side is constrained here and the id side is validated at the app layer
 * on write.
 *
 * Orphans are expected and tolerated: a link whose target was deleted renders
 * as "대상 없음" rather than erroring, and audit rows are never cleaned up.
 */
export const LINKABLE_TYPES = [
  "cohort",
  "program",
  "session",
  "project",
  "study",
  "meeting",
  "ops_task",
  "document",
  "application",
  "finance_record",
  "student",
  "user",
  /** Meeting-note templates key off the meeting type rather than a row id. */
  "meeting_type",
  /** Discord/webhook targets in communication_logs. */
  "channel",
] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];

export function isLinkableType(v: unknown): v is LinkableType {
  return (
    typeof v === "string" && (LINKABLE_TYPES as readonly string[]).includes(v)
  );
}
