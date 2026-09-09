import { timingSafeEqual } from "node:crypto";

export const SCRAPE_LOCK_RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
export const SCRAPE_LOCK_REFRESH_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end";
export const SCRAPE_LOCK_KEY = "rta:scrape:active";

export function secretsEqual(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isScrapeTokenValid(expected: string | undefined, provided: unknown): boolean {
  return Boolean(expected && typeof provided === "string" && secretsEqual(expected, provided));
}

export function rateLimitDecision(count: number, maximum: number, ttlMs: number): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  return { allowed: count <= maximum, retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1_000)), remaining: Math.max(0, maximum - count) };
}

export function manualScrapeJobId(siteKey: string): string {
  return `manual-${siteKey}`;
}

export function canReleaseScrapeLock(currentOwner: string | null, requestedOwner: string): boolean {
  return currentOwner !== null && currentOwner === requestedOwner;
}

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const octets = hostname.split(".").map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168 ||
    first === 100 && second >= 64 && second <= 127 || first >= 224;
}

function isPrivateIpv6(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  const mappedIpv4 = value.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4[1]) : false;
}

export function assertSafeScraperUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("scraper URLs must use HTTP or HTTPS");
  if (url.username || url.password) throw new Error("scraper URLs cannot contain credentials");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname === "host.docker.internal") {
    throw new Error("scraper URL hostname is not public");
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) throw new Error("scraper URL hostname is not public");
}
