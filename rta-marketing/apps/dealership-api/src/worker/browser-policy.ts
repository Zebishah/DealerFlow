/** Jitter adds to, never undercuts, the source's minimum interval. */
export function sourceDelay(minimumMs: number, jitterMs: number, random = Math.random): number {
  return minimumMs + Math.floor(random() * (jitterMs + 1));
}

export function safePageUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid URL]";
  }
}

export function proxyServer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (!["http:", "https:", "socks5:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("BROWSER_PROXY_SERVER must be an http(s) or socks5 origin; put credentials in separate variables");
  }
  return `${url.protocol}//${url.host}`;
}
