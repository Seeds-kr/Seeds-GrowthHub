import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

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
  status: text("status").notNull().default("submitted").$type<ApplicationStatus>(),
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
