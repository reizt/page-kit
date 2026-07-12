import { Hono } from "hono";
import type { Cache } from "./cache.js";
import { AppError } from "./errors.js";
import { createFetchService, type FetchRequest } from "./service.js";

function isFetchRequest(value: unknown): value is FetchRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.url === "string" &&
    (body.render === undefined || ["auto", "never", "always"].includes(String(body.render))) &&
    (body.force === undefined || typeof body.force === "boolean")
  );
}

export function createApp(cache: Cache, service = createFetchService(cache)) {
  const app = new Hono();

  app.post("/fetch", async (context) => {
    let body: unknown;
    try { body = await context.req.json(); } catch {
      throw new AppError("INVALID_REQUEST", "Request body must be valid JSON", 400);
    }
    if (!isFetchRequest(body)) throw new AppError("INVALID_REQUEST", "Request body is invalid", 400);
    const data = await service(body);
    return context.json({ success: true as const, data });
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
