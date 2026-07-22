import { Readability } from "@mozilla/readability";
import { DOMParser } from "linkedom";
import TurndownService from "turndown";
import { AppError } from "./errors";

export interface ExtractedPage {
  title: string;
  contentHtml: string;
  textContent: string;
  markdown: string;
}

const REMOVED_ELEMENTS = "script,style,noscript,iframe,nav,footer,form,button";

function absolutizeUrls(root: Element, baseUrl: string): void {
  for (const [selector, attribute] of [
    ["a[href]", "href"],
    ["img[src]", "src"],
  ] as const) {
    for (const element of root.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      try {
        element.setAttribute(attribute, new URL(value, baseUrl).toString());
      } catch {
        /* keep malformed URLs */
      }
    }
  }
}

export function extractPage(html: string, finalUrl: string): ExtractedPage {
  try {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const parsedTitle =
      parsed.querySelector("title")?.textContent?.trim() ?? "";
    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const parsedBody =
      bodyMatch?.[1] ??
      html
        .replace(/<!doctype[^>]*>/gi, "")
        .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
        .replace(/<\/?html\b[^>]*>/gi, "");
    const document = new DOMParser().parseFromString(
      `<!doctype html><html><head><title></title></head><body>${parsedBody}</body></html>`,
      "text/html",
    );
    const titleElement = document.querySelector("title");
    if (titleElement) titleElement.textContent = parsedTitle;
    document
      .querySelectorAll(REMOVED_ELEMENTS)
      .forEach((node: { remove(): void }) => {
        node.remove();
      });
    const article = new Readability(
      document.cloneNode(true) as unknown as Document,
    ).parse();
    const fallbackTitle = parsedTitle;
    const contentHtml = article?.content || document.body?.innerHTML || "";
    const fragment = new DOMParser().parseFromString(
      `<div id="page-kit-content">${contentHtml}</div>`,
      "text/html",
    );
    const wrapper = fragment.querySelector("#page-kit-content");
    if (!wrapper) throw new Error("Missing content root");
    wrapper
      .querySelectorAll(REMOVED_ELEMENTS)
      .forEach((node: { remove(): void }) => {
        node.remove();
      });
    absolutizeUrls(wrapper as unknown as Element, finalUrl);

    const turndown = new TurndownService({
      codeBlockStyle: "fenced",
      headingStyle: "atx",
      bulletListMarker: "-",
    });
    turndown.addRule("table", {
      filter: "table",
      replacement: (_content, node) => {
        const rows = Array.from((node as HTMLElement).querySelectorAll("tr"));
        const values = rows.map((row) =>
          Array.from(row.querySelectorAll("th,td")).map((cell) =>
            turndown
              .turndown(cell as unknown as HTMLElement)
              .replace(/\|/g, "\\|")
              .replace(/\s*\n\s*/g, " ")
              .trim(),
          ),
        );
        if (!values[0]?.length) return "";
        const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
        return `\n\n${line(values[0])}\n${line(values[0].map(() => "---"))}${values
          .slice(1)
          .map((row) => `\n${line(row)}`)
          .join("")}\n\n`;
      },
    });
    const markdown = turndown
      .turndown(wrapper as unknown as HTMLElement)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      title: article?.title?.trim() || fallbackTitle,
      contentHtml: wrapper.innerHTML,
      textContent: (article?.textContent || wrapper.textContent || "").trim(),
      markdown,
    };
  } catch {
    throw new AppError("PARSE_FAILED", "Could not parse the HTML", 422);
  }
}

export function needsRendering(html: string, textContent: string): boolean {
  const normalized = textContent.replace(/\s+/g, " ").trim();
  if (normalized.length < 200) return true;
  if (
    /enable javascript|javascript (?:is )?required|javascriptを有効/i.test(
      normalized,
    )
  )
    return true;
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const visibleTextLength = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .trim().length;
  return scriptCount > 20 && scriptCount * 100 > visibleTextLength;
}
