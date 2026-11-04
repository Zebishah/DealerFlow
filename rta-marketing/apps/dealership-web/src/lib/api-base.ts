const localApi = "http://localhost:5000/api/v1";
export const sameOriginApiPath = "/rta-api";

export function resolveApiBase({ apiUrl, production, hostname, sameOrigin = false }: {
  apiUrl?: string;
  production: boolean;
  hostname: string;
  sameOrigin?: boolean;
}): string {
  // The Vercel gateway keeps the HttpOnly session on the website's origin.
  // Direct Render requests depend on third-party cookies, which browsers may block.
  if (production && (sameOrigin || hostname.endsWith(".vercel.app"))) return sameOriginApiPath;
  return (apiUrl?.trim() || localApi).replace(/\/+$/, "");
}
