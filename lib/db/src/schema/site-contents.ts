import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const siteContentsTable = pgTable("site_contents", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SiteContent = typeof siteContentsTable.$inferSelect;
export type InsertSiteContent = typeof siteContentsTable.$inferInsert;
