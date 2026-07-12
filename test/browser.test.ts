import { expect, it } from "vitest";
import { closeBrowser, renderHtml } from "../src/browser.js";

const browserIt = process.env.RUN_BROWSER_TESTS === "1" ? it : it.skip;

browserIt("renders a page with Chromium", async () => {
  try {
    const result = await renderHtml("https://example.com");
    expect(result.html).toContain("Example Domain");
  } finally {
    await closeBrowser();
  }
});
