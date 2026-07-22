import { describe, expect, it } from "vitest";
import { extractPage } from "../src/extract";

describe("HTML extraction", () => {
  it("converts article HTML to Markdown and absolute URLs", () => {
    const result = extractPage(
      `<!doctype html><title>Test</title><article>
      <h1>Heading</h1><p>${"Useful content. ".repeat(20)} <a href="/about">About</a></p>
      <table><tr><th>A</th></tr><tr><td>B</td></tr></table></article>`,
      "https://example.com/post",
    );
    expect(result.title).toContain("Test");
    expect(result.markdown).toMatch(/^#+ Heading/m);
    expect(result.markdown).toContain("https://example.com/about");
    expect(result.markdown).toContain("| A |");
  });

  it("falls back to body when Readability finds no article", () => {
    const result = extractPage(
      "<html><title>Fallback</title><body><div>Hello</div></body></html>",
      "https://example.com",
    );
    expect(result.title).toBe("Fallback");
    expect(result.markdown).toBe("Hello");
  });
});
