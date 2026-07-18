import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod";
import { renderHtml } from "./browser.js";
import { createD1Cache } from "./cache.js";
import { AppError } from "./errors.js";
import { createFetchService, type FetchRequest, type FetchResult } from "./service.js";

export interface Env {
  API_KEY: string;
  DB: D1Database;
  BROWSER: import("@cloudflare/playwright").BrowserWorker;
}

export type FetchService = (request: FetchRequest) => Promise<FetchResult>;

function isFetchRequest(value: unknown): value is FetchRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.url === "string" &&
    (body.render === undefined || ["auto", "never", "always"].includes(String(body.render))) &&
    (body.force === undefined || typeof body.force === "boolean")
  );
}

function serviceFromEnv(env: Env): FetchService {
  return createFetchService(createD1Cache(env.DB), {
    render: (url) => renderHtml(url, env.BROWSER),
  });
}

function createMcpServer(service: FetchService): McpServer {
  const server = new McpServer({ name: "page-kit", version: "0.2.0" });
  server.registerTool(
    "fetch_page",
    {
      description: "Fetch one public HTML page and return its main content as Markdown. Use after web search identifies a relevant URL.",
      inputSchema: {
        url: z.url().describe("Public HTTP or HTTPS URL to fetch"),
        render: z.enum(["auto", "never", "always"]).default("auto")
          .describe("Whether to use Browser Run for JavaScript rendering"),
        force: z.boolean().default(false).describe("Ignore a valid cached result"),
      },
    },
    async ({ url, render, force }) => {
      try {
        const result = await service({ url, render, force });
        return {
          content: [{
            type: "text" as const,
            text: [
              `Source: ${result.finalUrl}`,
              `Title: ${result.title}`,
              `Fetched: ${result.metadata.fetchedAt} (cached=${result.metadata.cached}, rendered=${result.metadata.rendered})`,
              "",
              result.markdown,
            ].join("\n"),
          }],
        };
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("FETCH_FAILED", "An unexpected error occurred", 500);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `${appError.code}: ${appError.message}` }],
        };
      }
    },
  );
  return server;
}

export function createApp(overrideService?: FetchService) {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (context, next) => {
    if (!context.env.API_KEY) throw new AppError("FETCH_FAILED", "API key is not configured", 500);
    if (context.req.header("authorization") !== `Bearer ${context.env.API_KEY}`) {
      return context.json({
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Bearer authentication failed" },
      }, 401);
    }
    await next();
  });

  app.post("/fetch", async (context) => {
    let body: unknown;
    try { body = await context.req.json(); } catch {
      throw new AppError("INVALID_REQUEST", "Request body must be valid JSON", 400);
    }
    if (!isFetchRequest(body)) throw new AppError("INVALID_REQUEST", "Request body is invalid", 400);
    const data = await (overrideService ?? serviceFromEnv(context.env))(body);
    return context.json({ success: true as const, data });
  });

  app.all("/mcp", async (context) => {
    const server = createMcpServer(overrideService ?? serviceFromEnv(context.env));
    return createMcpHandler(server, { route: "/mcp", enableJsonResponse: true })(
      context.req.raw,
      context.env,
      context.executionCtx as any,
    );
  });

  app.notFound((context) => context.json({
    success: false as const,
    error: { code: "INVALID_REQUEST", message: "Route not found" },
  }, 404));

  app.onError((error, context) => {
    const appError = error instanceof AppError
      ? error
      : new AppError("FETCH_FAILED", "An unexpected error occurred", 500);
    return context.json({
      success: false as const,
      error: { code: appError.code, message: appError.message },
    }, appError.status as 400);
  });

  return app;
}
