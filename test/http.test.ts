import { describe, expect, it } from "vitest";
import { fetchHtml } from "../src/http";

const validate = async (url: string) => new URL(url);

describe("HTTP fetch", () => {
  it("rejects non-HTML content", async () => {
    const mock = async () =>
      new Response("{}", { headers: { "content-type": "application/json" } });
    await expect(
      fetchHtml("https://example.com", mock, 1000, 100, validate),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });
  });

  it("rejects oversized responses", async () => {
    const mock = async () =>
      new Response("x".repeat(101), {
        headers: { "content-type": "text/html" },
      });
    await expect(
      fetchHtml("https://example.com", mock, 1000, 100, validate),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
