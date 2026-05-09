import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const accountActivationTokensTable = pgTable(
  "account_activation_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenHashIdx: index("account_activation_tokens_token_hash_idx").on(
      t.tokenHash,
    ),
    userIdIdx: index("account_activation_tokens_user_id_idx").on(t.userId),
  }),
);

export type AccountActivationToken =
  typeof accountActivationTokensTable.$inferSelect;
export type InsertAccountActivationToken =
  typeof accountActivationTokensTable.$inferInsert;
