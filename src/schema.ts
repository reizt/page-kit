import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fetchCache = sqliteTable(
  "fetch_cache",
  {
    url: text("url").primaryKey(),
    finalUrl: text("final_url").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    statusCode: integer("status_code").notNull(),
    contentType: text("content_type").notNull(),
    rendered: integer("rendered", { mode: "boolean" }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("fetch_cache_expires_at_idx").on(table.expiresAt)],
);

export type CacheRow = typeof fetchCache.$inferSelect;
