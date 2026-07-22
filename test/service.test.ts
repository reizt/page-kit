import { describe, expect, it, vi } from "vitest";
import type { Cache } from "../src/cache";
import type { CacheRow } from "../src/schema";
import { createFetchService } from "../src/service";

const html = `<!doctype html><html><head><title>Example</title></head><body><article>
  <h1>Example</h1><p>${"This is enough useful article content for a normal extraction. ".repeat(10)}</p>
</article></body></html>`;

function memoryCache(): Cache {
  const rows = new Map<string, CacheRow>();
  return {
    async getValid(url, now = new Date()) {
      const row = rows.get(url);
      return row && row.expiresAt > now ? row : undefined;
    },
    async set(row) {
      rows.set(row.url, row);
    },
  };
}

describe("fetch service cache", () => {
  it("returns a valid cached response", async () => {
    const httpFetch = vi.fn(async () => ({
      html,
      finalUrl: "https://example.com/",
      statusCode: 200,
      contentType: "text/html",
    }));
    const service = createFetchService(memoryCache(), { httpFetch });
    await service({ url: "https://example.com", render: "never" });
    const result = await service({
      url: "https://example.com",
      render: "never",
    });
    expect(result.metadata.cached).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it("force bypasses the cache", async () => {
    const httpFetch = vi.fn(async () => ({
      html,
      finalUrl: "https://example.com/",
      statusCode: 200,
      contentType: "text/html",
    }));
    const service = createFetchService(memoryCache(), { httpFetch });
    await service({ url: "https://example.com", render: "never" });
    const result = await service({
      url: "https://example.com",
      render: "never",
      force: true,
    });
    expect(result.metadata.cached).toBe(false);
    expect(httpFetch).toHaveBeenCalledTimes(2);
  });
});
