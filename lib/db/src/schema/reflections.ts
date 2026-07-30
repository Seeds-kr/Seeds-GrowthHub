import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const REFLECTION_TYPES = [
  "personal",
  "team",
  "project",
  "study",
  "event",
  "cohort_end",
] as const;
export type ReflectionType = (typeof REFLECTION_TYPES)[number];

/**
 * ADR-001 — the student chooses. Default is the narrowest value.
 *
 * `admin_only` IS DELIBERATELY ABSENT and must never be added.
 *
 * Growth v3 §12.2 asked how "회고는 평가에 쓰이지 않는다" could be guaranteed.
 * The answer is structural, not a UI promise: with no ops-facing value in the
 * enum, there is nothing for an ops-wide reflections screen to select on, and
 * no bulk-read endpoint may be built. The ONLY way ops ever sees a reflection
 * is if the student themselves widened it to `cohort_visible`.
 *
 * Team risk detection is `project_status_checks`' job, not this table's.
 */
export const REFLECTION_VISIBILITIES = [
  "private",
  "team_visible",
  "mentor_visible",
  "cohort_visible",
] as const;
export type ReflectionVisibility = (typeof REFLECTION_VISIBILITIES)[number];

/** Ordered narrow → wide, for the picker and for widening comparisons. */
export const REFLECTION_VISIBILITY_ORDER: ReflectionVisibility[] = [
  "private",
  "team_visible",
  "mentor_visible",
  "cohort_visible",
];

export const reflectionsTable = pgTable(
  "reflections",
  {
    id: serial("id").primaryKey(),
    /**
     * Owner. A reflection ALWAYS belongs to exactly one student — there is no
     * ops-authored reflection, which is part of why no ops screen exists.
     */
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    reflectionType: text("reflection_type")
      .notNull()
      .default("personal")
      .$type<ReflectionType>(),
    /** Polymorphic: project | study | session | cohort. Null = standalone. */
    targetType: text("target_type"),
    targetId: integer("target_id"),
    title: text("title"),
    contentMd: text("content_md").notNull(),
    visibility: text("visibility")
      .notNull()
      .default("private")
      .$type<ReflectionVisibility>(),
    reflectedOn: date("reflected_on"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byStudent: index("reflections_student_idx").on(t.studentId, t.createdAt),
    byTarget: index("reflections_target_idx").on(t.targetType, t.targetId),
  }),
);

export type Reflection = typeof reflectionsTable.$inferSelect;
export type InsertReflection = typeof reflectionsTable.$inferInsert;
