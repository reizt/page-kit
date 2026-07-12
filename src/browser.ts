import { chromium, type Browser } from "playwright";
import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, USER_AGENT } from "./constants.js";
import { AppError } from "./errors.js";
import { assertPublicUrl } from "./url.js";
import type { HtmlResponse } from "./http.js";

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

export async function renderHtml(input: string): Promise<HtmlResponse> {
  await assertPublicUrl(input);
  const instance = await getBrowser();
  const context = await instance.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  try {
    await page.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) return route.abort();
      try {
        await assertPublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(input, { waitUntil: "domcontentloaded", timeout: FETCH_TIMEOUT_MS });
    if (!response?.ok()) throw new AppError("RENDER_FAILED", `Destination returned HTTP ${response?.status() ?? "unknown"}`, 502);
    await assertPublicUrl(page.url());
    const html = await page.content();
    if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new AppError("RESPONSE_TOO_LARGE", "Rendered HTML is too large", 413);
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
  }
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
}
