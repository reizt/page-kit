import { isIP } from "node:net";
import { AppError } from "./errors";

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
    (value.startsWith("::ffff:") && isBlockedIpv4(value.slice(7)))
  );
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  return version === 4
    ? isBlockedIpv4(ip)
    : version === 6
      ? isBlockedIpv6(ip)
      : true;
}

export function parsePublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("INVALID_URL", "URL is invalid", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      "BLOCKED_URL",
      "Only http and https URLs are allowed",
      400,
    );
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new AppError("BLOCKED_URL", "The destination is not allowed", 400);
  }
  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new AppError("BLOCKED_URL", "The destination is not allowed", 400);
  }
  return url;
}

interface DnsAnswer {
  data: string;
  type: number;
}
interface DnsResponse {
  Answer?: DnsAnswer[];
}

async function resolve(
  hostname: string,
  type: "A" | "AAAA",
): Promise<string[]> {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
    {
      headers: { accept: "application/dns-json" },
    },
  );
  if (!response.ok) throw new Error("DNS lookup failed");
  const data = await response.json<DnsResponse>();
  return (data.Answer ?? [])
    .filter((answer) => answer.type === (type === "A" ? 1 : 28))
    .map((answer) => answer.data);
}

export async function assertPublicUrl(input: string): Promise<URL> {
  const url = parsePublicUrl(input);
  if (isIP(url.hostname)) return url;
  let addresses: string[];
  try {
    addresses = (
      await Promise.all([
        resolve(url.hostname, "A"),
        resolve(url.hostname, "AAAA"),
      ])
    ).flat();
  } catch {
    throw new AppError(
      "FETCH_FAILED",
      "Could not resolve the destination",
      502,
    );
  }
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
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
