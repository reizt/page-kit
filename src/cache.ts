import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { fetchCache, type CacheRow } from "./schema.js";

export type Cache = ReturnType<typeof createCache>;

export function createCache(databasePath = process.env.DATABASE_PATH ?? "./data/cache.db") {
  if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fetch_cache (
      url TEXT PRIMARY KEY NOT NULL, final_url TEXT NOT NULL, title TEXT NOT NULL,
      markdown TEXT NOT NULL, status_code INTEGER NOT NULL, content_type TEXT NOT NULL,
      rendered INTEGER NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fetch_cache_expires_at_idx ON fetch_cache (expires_at);
  `);
  const db = drizzle(sqlite);
  return {
    getValid(url: string, now = new Date()): CacheRow | undefined {
      const row = db.select().from(fetchCache).where(eq(fetchCache.url, url)).get();
      return row && row.expiresAt.getTime() > now.getTime() ? row : undefined;
    },
    set(row: CacheRow): void {
      db.insert(fetchCache).values(row).onConflictDoUpdate({
        target: fetchCache.url,
        set: row,
      }).run();
    },
    close(): void { sqlite.close(); },
  };
}
