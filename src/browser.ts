import { launch, type BrowserWorker } from "@cloudflare/playwright";
import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, USER_AGENT } from "./constants.js";
import { AppError } from "./errors.js";
import { assertPublicUrl, parsePublicUrl } from "./url.js";
import type { HtmlResponse } from "./http.js";

export async function renderHtml(input: string, binding: BrowserWorker): Promise<HtmlResponse> {
  await assertPublicUrl(input);
  const browser = await launch(binding, { keep_alive: 60_000 });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  try {
    await page.route("**/*", async (route: any) => {
      const request = route.request();
      if (["image", "media", "font"].includes(request.resourceType())) return route.abort();
      try {
        if (request.isNavigationRequest()) await assertPublicUrl(request.url());
        else parsePublicUrl(request.url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(input, {
      waitUntil: "domcontentloaded",
      timeout: FETCH_TIMEOUT_MS,
    });
    if (!response?.ok()) {
      throw new AppError("RENDER_FAILED", `Destination returned HTTP ${response?.status() ?? "unknown"}`, 502);
    }
    await assertPublicUrl(page.url());
    const html = await page.content();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      throw new AppError("RESPONSE_TOO_LARGE", "Rendered HTML is too large", 413);
    }
    return {
      html,
      finalUrl: page.url(),
      statusCode: response.status(),
      contentType: response.headers()["content-type"] ?? "text/html",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("RENDER_FAILED", "Could not render the destination", 502);
  } finally {
    await context.close();
    await browser.close();
  }
}
