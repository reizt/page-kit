import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { AppError } from "./errors.js";

function isBlockedIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isBlockedIpv6(ip: string): boolean {
  const value = ip.toLowerCase().split("%")[0];
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("::ffff:") && isBlockedIpv4(value.slice(7))
  );
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  return version === 4 ? isBlockedIpv4(ip) : version === 6 ? isBlockedIpv6(ip) : true;
}

export function parsePublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("INVALID_URL", "URL is invalid", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("BLOCKED_URL", "Only http and https URLs are allowed", 400);
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new AppError("BLOCKED_URL", "The destination is not allowed", 400);
  }
  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new AppError("BLOCKED_URL", "The destination is not allowed", 400);
  }
  return url;
}

export async function assertPublicUrl(input: string): Promise<URL> {
  const url = parsePublicUrl(input);
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError("FETCH_FAILED", "Could not resolve the destination", 502);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new AppError("BLOCKED_URL", "The destination is not allowed", 400);
  }
  return url;
}

export function normalizeUrl(input: string): string {
  const url = parsePublicUrl(input);
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}
