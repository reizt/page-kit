import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { fetchCache, type CacheRow } from "./schema.js";

export interface Cache {
  getValid(url: string, now?: Date): Promise<CacheRow | undefined>;
  set(row: CacheRow): Promise<void>;
}

export function createD1Cache(database: D1Database): Cache {
  const db = drizzle(database);
  return {
    async getValid(url: string, now = new Date()): Promise<CacheRow | undefined> {
      const row = await db.select().from(fetchCache).where(eq(fetchCache.url, url)).get();
      return row && row.expiresAt.getTime() > now.getTime() ? row : undefined;
    },
    async set(row: CacheRow): Promise<void> {
      await db.insert(fetchCache).values(row).onConflictDoUpdate({
        target: fetchCache.url,
        set: row,
      }).run();
    },
  };
}
