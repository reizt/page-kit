import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, USER_AGENT } from "./constants";
import { AppError } from "./errors";
import { assertPublicUrl } from "./url";

export interface HtmlResponse {
  html: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
}

export type FetchLike = typeof fetch;

export async function fetchHtml(
  input: string,
  fetcher: FetchLike = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
  maxBytes = MAX_HTML_BYTES,
  validateUrl: (input: string) => Promise<URL> = assertPublicUrl,
): Promise<HtmlResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = input;
  try {
    for (let redirects = 0; redirects <= 10; redirects++) {
      await validateUrl(current);
      const response = await fetcher(current, {
        redirect: "manual",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          throw new AppError(
            "FETCH_FAILED",
            "Redirect response has no location",
            502,
          );
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok)
        throw new AppError(
          "FETCH_FAILED",
          `Destination returned HTTP ${response.status}`,
          502,
        );
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
        throw new AppError(
          "UNSUPPORTED_CONTENT_TYPE",
          "Only HTML responses are supported",
          415,
        );
      }
      const declaredSize = Number(response.headers.get("content-length"));
      if (declaredSize > maxBytes)
        throw new AppError(
          "RESPONSE_TOO_LARGE",
          "HTML response is too large",
          413,
        );
      if (!response.body)
        throw new AppError(
          "FETCH_FAILED",
          "Destination returned an empty response",
          502,
        );

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new AppError(
            "RESPONSE_TOO_LARGE",
            "HTML response is too large",
            413,
          );
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return {
        html: new TextDecoder().decode(bytes),
        finalUrl: current,
        statusCode: response.status,
        contentType,
      };
    }
    throw new AppError("FETCH_FAILED", "Too many redirects", 502);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted)
      throw new AppError("TIMEOUT", "Fetch timed out", 504);
    throw new AppError("FETCH_FAILED", "Could not fetch the destination", 502);
  } finally {
    clearTimeout(timer);
  }
}
