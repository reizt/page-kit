import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache, type Cache } from "../src/cache.js";
import { createFetchService } from "../src/service.js";

const html = `<!doctype html><html><head><title>Example</title></head><body><article>
  <h1>Example</h1><p>${"This is enough useful article content for a normal extraction. ".repeat(10)}</p>
</article></body></html>`;

describe("fetch service cache", () => {
  let cache: Cache;
  afterEach(() => cache?.close());

  it("returns a valid cached response", async () => {
    cache = createCache(":memory:");
    const httpFetch = vi.fn(async () => ({ html, finalUrl: "https://example.com/", statusCode: 200, contentType: "text/html" }));
    const service = createFetchService(cache, { httpFetch });
    await service({ url: "https://example.com", render: "never" });
    const result = await service({ url: "https://example.com", render: "never" });
    expect(result.metadata.cached).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it("force bypasses the cache", async () => {
    cache = createCache(":memory:");
    const httpFetch = vi.fn(async () => ({ html, finalUrl: "https://example.com/", statusCode: 200, contentType: "text/html" }));
    const service = createFetchService(cache, { httpFetch });
    await service({ url: "https://example.com", render: "never" });
    const result = await service({ url: "https://example.com", render: "never", force: true });
    expect(result.metadata.cached).toBe(false);
    expect(httpFetch).toHaveBeenCalledTimes(2);
  });
});
