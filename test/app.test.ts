import type { ExecutionContext } from "hono";
import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app";

const service = async (request: { url: string }) => ({
  url: request.url,
  finalUrl: request.url,
  title: "Test",
  markdown: "Body",
  metadata: {
    statusCode: 200,
    contentType: "text/html",
    rendered: false,
    cached: false,
    fetchedAt: new Date(0).toISOString(),
  },
});

const env = {} as Env;

describe("GET /", () => {
  it("serves the Markdown conversion UI", async () => {
    const response = await createApp(service).request("/", {}, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Markdownに変換");
    expect(html).toContain("color-scheme: dark");
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Preview");
    expect(html).toContain("fetch('/fetch'");
    expect(html).not.toContain("APIキー");
    expect(html).not.toContain("authorization");
  });
});

describe("POST /fetch", () => {
  it("fetches without application-level authentication", async () => {
    const response = await createApp(service).request(
      "/fetch",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { title: "Test", previewHtml: "<p>Body</p>\n" },
    });
  });

  it("rejects invalid input", async () => {
    const response = await createApp(service).request(
      "/fetch",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: 1 }),
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "INVALID_REQUEST" },
    });
  });
});

describe("POST /mcp", () => {
  it("lists and invokes fetch_page", async () => {
    const app = createApp(service);
    const executionContext: ExecutionContext = {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    };
    const request = async (body: object) =>
      app.request(
        "/mcp",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify(body),
        },
        env,
        executionContext,
      );

    const listResponse = await request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      result: { tools: [{ name: "fetch_page" }] },
    });

    const callResponse = await request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "fetch_page",
        arguments: { url: "https://example.com", render: "never" },
      },
    });
    expect(callResponse.status).toBe(200);
    expect(await callResponse.json()).toMatchObject({
      result: {
        content: [
          { type: "text", text: expect.stringContaining("Title: Test") },
        ],
      },
    });
  });
});
