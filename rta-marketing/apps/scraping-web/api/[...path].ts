type Request = {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type Response = {
  status: (code: number) => Response;
  setHeader: (name: string, value: string) => void;
  json: (value: unknown) => void;
  send: (value: string) => void;
};

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function pathOf(request: Request): string {
  return new URL(request.url ?? "/api", "https://vercel.invalid").pathname.replace(/^\/api\/?/, "");
}

function jsonBody(request: Request): string | undefined {
  if (request.body === undefined) return undefined;
  return JSON.stringify(request.body && typeof request.body === "object" ? request.body : {});
}

async function forward(request: Request, response: Response, path: string): Promise<void> {
  const apiUrl = process.env.SCRAPE_API_URL;
  if (!apiUrl) return response.status(503).json({ error: "scrape API is unavailable" });
  const body = jsonBody(request);
  const upstream = await fetch(`${apiUrl.replace(/\/$/, "")}/api/${path}`, {
    method: request.method ?? "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(header(request, "cookie") ? { Cookie: header(request, "cookie") as string } : {}),
      ...(header(request, "x-forwarded-for") ? { "X-Forwarded-For": header(request, "x-forwarded-for") as string } : {}),
    },
    ...(body ? { body } : {}),
  });
  response.status(upstream.status);
  for (const name of ["content-type", "set-cookie", "cache-control", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining"]) {
    const value = upstream.headers.get(name);
    if (value) response.setHeader(name, value);
  }
  response.send(await upstream.text());
}

export default async function handler(request: Request, response: Response): Promise<void> {
  const path = pathOf(request);
  if (path === "scrape-session" || path === "scrape-session/logout") return forward(request, response, path);
  if (/^scrape\/[a-z0-9-]+$/.test(path)) return forward(request, response, path);
  return response.status(404).json({ error: "not found" });
}
