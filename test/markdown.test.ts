import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown";

describe("Markdown rendering", () => {
  it("renders common Markdown elements", () => {
    const html = renderMarkdown("# Heading\n\n[Link](https://example.com)");
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("removes unsafe HTML and URLs", () => {
    const html = renderMarkdown(
      '<script>alert("xss")</script>\n\n[Link](javascript:alert(1))',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });
});
