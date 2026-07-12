import { CACHE_TTL_MS } from "./constants.js";
import type { Cache } from "./cache.js";
import { extractPage, needsRendering } from "./extract.js";
import { fetchHtml, type HtmlResponse } from "./http.js";
import { renderHtml } from "./browser.js";
import { normalizeUrl } from "./url.js";

export type RenderMode = "auto" | "never" | "always";

export interface FetchRequest {
  url: string;
  render?: RenderMode;
  force?: boolean;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  title: string;
  markdown: string;
  metadata: {
    statusCode: number;
    contentType: string;
    rendered: boolean;
    cached: boolean;
    fetchedAt: string;
  };
}

interface Dependencies {
  httpFetch?: (url: string) => Promise<HtmlResponse>;
  render?: (url: string) => Promise<HtmlResponse>;
  now?: () => Date;
}

export function createFetchService(cache: Cache, dependencies: Dependencies = {}) {
  const httpFetch = dependencies.httpFetch ?? fetchHtml;
  const render = dependencies.render ?? renderHtml;
  const now = dependencies.now ?? (() => new Date());

  return async (request: FetchRequest): Promise<FetchResult> => {
    const url = normalizeUrl(request.url);
    const cached = request.force ? undefined : cache.getValid(url, now());
    if (cached) {
      return {
        url,
        finalUrl: cached.finalUrl,
        title: cached.title,
        markdown: cached.markdown,
        metadata: {
          statusCode: cached.statusCode,
          contentType: cached.contentType,
          rendered: cached.rendered,
          cached: true,
          fetchedAt: cached.fetchedAt.toISOString(),
        },
      };
    }

    const mode = request.render ?? "auto";
    let response = mode === "always" ? await render(url) : await httpFetch(url);
    let rendered = mode === "always";
    let extracted = extractPage(response.html, response.finalUrl);
    if (mode === "auto" && needsRendering(response.html, extracted.textContent)) {
      response = await render(url);
      rendered = true;
      extracted = extractPage(response.html, response.finalUrl);
    }

    const fetchedAt = now();
    cache.set({
      url,
      finalUrl: response.finalUrl,
      title: extracted.title,
      markdown: extracted.markdown,
      statusCode: response.statusCode,
      contentType: response.contentType,
      rendered,
      fetchedAt,
      expiresAt: new Date(fetchedAt.getTime() + CACHE_TTL_MS),
    });
    return {
      url,
      finalUrl: response.finalUrl,
      title: extracted.title,
      markdown: extracted.markdown,
      metadata: {
        statusCode: response.statusCode,
        contentType: response.contentType,
        rendered,
        cached: false,
        fetchedAt: fetchedAt.toISOString(),
      },
    };
  };
}
