import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCache, type Cache } from "../src/cache.js";

describe("POST /fetch", () => {
  let cache: Cache;
  afterEach(() => cache?.close());

  it("does not require bearer authentication", async () => {
    cache = createCache(":memory:");
    const app = createApp(cache, async (request) => ({
      url: request.url,
      finalUrl: request.url,
      title: "Test",
      markdown: "Body",
      metadata: { statusCode: 200, contentType: "text/html", rendered: false, cached: false, fetchedAt: new Date(0).toISOString() },
    }));
    const response = await app.request("/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { title: "Test" } });
  });

  it("rejects invalid input", async () => {
    cache = createCache(":memory:");
    const response = await createApp(cache).request("/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: 1 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "INVALID_REQUEST" } });
  });
});
