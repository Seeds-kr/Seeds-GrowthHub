import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// Legacy MVP1 status (kept for backward compatibility).
export const APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "interview",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// MVP2 lifecycle status (richer pipeline tracking).
export const APPLICATION_LIFECYCLE_STATUSES = [
  "submitted",
  "document_review",
  "document_review_completed",
  "interview",
  "interview_scheduled",
  "interview_completed",
  "final_decision_made",
  "withdrawn",
] as const;
export type ApplicationLifecycleStatus =
  (typeof APPLICATION_LIFECYCLE_STATUSES)[number];

export const FINAL_DECISIONS = [
  "pending",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
] as const;
export type FinalDecision = (typeof FINAL_DECISIONS)[number];

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  school: text("school").notNull(),
  grade: text("grade").notNull(),
  birthYear: integer("birth_year").notNull(),
  interestArea: text("interest_area").notNull(),
  motivation: text("motivation").notNull(),
  experience: text("experience").notNull(),
  problemAwareness: text("problem_awareness").notNull(),
  expectation: text("expectation").notNull(),
  privacyConsent: boolean("privacy_consent").notNull(),
  // Legacy MVP1 status (still used by /admin/applications PATCH).
  // `status` 컬럼은 2026-08-11 에 제거했다(이슈 #4).
  //
  // 단계(`applicationStatus`)와 결과(`finalDecision`)를 한 열거형에 섞고 있었다.
  // `/final-decision` 이 결과만 갱신하고 이건 그대로 둬서, 합격 처리한 지원서가
  // 목록·대시보드에서 계속 "제출 완료" 로 보였다. 두 축을 갈라 각각 쓰는 주체를
  // 하나로 두는 것으로 대신한다.
  // MVP2 lifecycle status.
  applicationStatus: text("application_status")
    .notNull()
    .default("submitted")
    .$type<ApplicationLifecycleStatus>(),
  // MVP2 final decision.
  finalDecision: text("final_decision")
    .notNull()
    .default("pending")
    .$type<FinalDecision>(),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = typeof applicationsTable.$inferInsert;
