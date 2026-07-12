import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { AppError } from "./errors.js";

export interface ExtractedPage {
  title: string;
  contentHtml: string;
  textContent: string;
  markdown: string;
}

const REMOVED_ELEMENTS = "script,style,noscript,iframe,nav,footer,form,button";

function absolutizeUrls(root: Element, baseUrl: string): void {
  for (const [selector, attribute] of [["a[href]", "href"], ["img[src]", "src"]] as const) {
    for (const element of root.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      try { element.setAttribute(attribute, new URL(value, baseUrl).toString()); } catch { /* keep malformed URLs */ }
    }
  }
}

export function extractPage(html: string, finalUrl: string): ExtractedPage {
  try {
    const dom = new JSDOM(html, { url: finalUrl });
    const document = dom.window.document;
    document.querySelectorAll(REMOVED_ELEMENTS).forEach((node) => node.remove());
    const article = new Readability(document.cloneNode(true) as Document).parse();
    const fallbackTitle = document.title.trim();
    const contentHtml = article?.content || document.body?.innerHTML || "";
    const fragment = JSDOM.fragment(contentHtml);
    const wrapper = document.createElement("div");
    wrapper.append(fragment.cloneNode(true));
    wrapper.querySelectorAll(REMOVED_ELEMENTS).forEach((node) => node.remove());
    absolutizeUrls(wrapper, finalUrl);

    const turndown = new TurndownService({
      codeBlockStyle: "fenced",
      headingStyle: "atx",
      bulletListMarker: "-",
    });
    turndown.use(gfm);
    const markdown = turndown.turndown(wrapper.innerHTML)
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
  if (/enable javascript|javascript (?:is )?required|javascriptを有効/i.test(normalized)) return true;
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const visibleTextLength = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim().length;
  return scriptCount > 20 && scriptCount * 100 > visibleTextLength;
}
