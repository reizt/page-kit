import { describe, expect, it } from "vitest";
import { isBlockedIp, normalizeUrl, parsePublicUrl } from "../src/url.js";

describe("URL validation", () => {
  it("normalizes public URLs", () => {
    expect(normalizeUrl("HTTPS://Example.COM/path/#part")).toBe("https://example.com/path");
  });

  it.each(["file:///etc/passwd", "data:text/plain,test", "http://localhost", "http://test.local", "http://127.0.0.1"])(
    "blocks %s",
    (url) => expect(() => parsePublicUrl(url)).toThrow(),
  );

  it.each(["10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1"])(
    "blocks private address %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
});
