import { and, eq, sql } from "drizzle-orm";
import {
  db,
  documentsTable,
  meetingsTable,
  MEETING_TYPES,
  type MeetingType,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * Meeting-note templates (ADR-006).
 *
 * Templates are stored as `documents` rows with `is_template = true` and
 * `linked_object_type = 'meeting_type'`, NOT hardcoded here. Ops staff edit
 * them at /admin/documents and the change takes effect on the next meeting
 * without a deploy. The constants below are only the first-run seed.
 *
 * Decisions are NOT part of the template body — they live in
 * `meetings.decisions_md`, enforced across every type.
 */

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  general: "일반 회의",
  ops: "운영 회의",
  planning: "기획 회의",
  retro: "회고",
  mentor: "멘토 회의",
  external: "외부 미팅",
  other: "기타",
};

const SEEDS: Record<MeetingType, string[]> = {
  general: ["안건", "논의", "보류 / 후속 논의"],
  ops: ["지난 액션 점검", "이번 주 운영 현황", "리스크"],
  planning: ["배경 / 문제", "옵션 검토", "트레이드오프"],
  retro: ["잘된 것", "아쉬운 것", "배운 것"],
  mentor: ["팀별 상태 공유", "멘토 요청사항", "운영 지원 필요"],
  external: ["참석자 / 소속", "논의 내용", "합의사항"],
  other: ["내용"],
};

function seedBody(type: MeetingType): string {
  return SEEDS[type].map((h) => `## ${h}\n\n`).join("");
}

const LINKED_TYPE = "meeting_type";

/** Title used to find a type's template row. */
function templateTitle(type: MeetingType): string {
  return `${MEETING_TYPE_LABEL[type]} 템플릿`;
}

/**
 * Create any missing template documents. Idempotent and non-destructive: an
 * existing row is left exactly as ops edited it.
 */
export async function bootstrapMeetingTemplates(): Promise<void> {
  let created = 0;
  for (const type of MEETING_TYPES) {
    const [existing] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.isTemplate, true),
          eq(documentsTable.linkedObjectType, LINKED_TYPE),
          eq(documentsTable.title, templateTitle(type)),
        ),
      )
      .limit(1);
    if (existing) continue;

    await db.insert(documentsTable).values({
      title: templateTitle(type),
      contentMd: seedBody(type),
      docType: "meeting_note",
      isTemplate: true,
      visibility: "admin_only",
      linkedObjectType: LINKED_TYPE,
    });
    created++;
  }
  if (created > 0) {
    logger.info({ created }, "seeded meeting-note templates");
  }
}

/** Body to start a new meeting of this type with. Empty if ops deleted it. */
export async function templateBodyFor(type: MeetingType): Promise<string> {
  const [row] = await db
    .select({ contentMd: documentsTable.contentMd })
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.isTemplate, true),
        eq(documentsTable.linkedObjectType, LINKED_TYPE),
        eq(documentsTable.title, templateTitle(type)),
      ),
    )
    .limit(1);
  return row?.contentMd ?? "";
}

/**
 * One-time backfill: fold the legacy fixed sections into `bodyMd`.
 *
 * Only touches rows where bodyMd is still empty AND at least one legacy field
 * has content, so it is safe to run on every boot and never clobbers edits.
 * `decisionsMd` is deliberately untouched — it remains its own column.
 */
export async function backfillMeetingBodies(): Promise<void> {
  const rows = await db
    .select({
      id: meetingsTable.id,
      agendaMd: meetingsTable.agendaMd,
      notesMd: meetingsTable.notesMd,
      pendingMd: meetingsTable.pendingMd,
    })
    .from(meetingsTable)
    .where(
      and(
        eq(meetingsTable.bodyMd, ""),
        sql`(${meetingsTable.agendaMd} <> '' OR ${meetingsTable.notesMd} <> '' OR ${meetingsTable.pendingMd} <> '')`,
      ),
    );

  for (const r of rows) {
    const parts: string[] = [];
    if (r.agendaMd.trim()) parts.push(`## 안건\n\n${r.agendaMd.trim()}`);
    if (r.pendingMd.trim())
      parts.push(`## 보류 / 후속 논의\n\n${r.pendingMd.trim()}`);
    if (r.notesMd.trim()) parts.push(`## 메모\n\n${r.notesMd.trim()}`);
    await db
      .update(meetingsTable)
      .set({ bodyMd: parts.join("\n\n"), updatedAt: new Date() })
      .where(eq(meetingsTable.id, r.id));
  }

  if (rows.length > 0) {
    logger.info({ count: rows.length }, "backfilled meetings.body_md");
  }
}
