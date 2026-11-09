import { resolveApiBase } from "./api-base";

export const API_URL = resolveApiBase({
  apiUrl: import.meta.env.VITE_API_URL,
  production: import.meta.env.PROD,
  hostname: window.location.hostname,
  sameOrigin: import.meta.env.VITE_API_SAME_ORIGIN === "true",
});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

let csrfToken: string | null = sessionStorage.getItem("rta-csrf-token");
let csrfRefreshPromise: Promise<boolean> | null = null;

export function setCsrfToken(value: string | null): void {
  csrfToken = value;
  if (value) sessionStorage.setItem("rta-csrf-token", value);
  else sessionStorage.removeItem("rta-csrf-token");
}

async function refreshCsrfToken(): Promise<boolean> {
  if (!csrfRefreshPromise) {
    csrfRefreshPromise = fetch(`${API_URL}/auth/csrf`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const payload = await response.json() as { data?: { csrfToken?: string } };
        const nextToken = payload.data?.csrfToken;
        if (!nextToken) return false;
        setCsrfToken(nextToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        csrfRefreshPromise = null;
      });
  }
  return csrfRefreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrfToken && init.method && init.method !== "GET") headers.set("x-csrf-token", csrfToken);

  const send = async (requestHeaders: Headers): Promise<Response> => {
    try {
      return await fetch(`${API_URL}${path}`, {
        ...init,
        headers: requestHeaders,
        credentials: "include",
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError(0, "NETWORK_ERROR", "We couldn’t connect to Dealer Flow. Check your connection and try again.");
    }
  };

  let response = await send(headers);

  // A CSRF token is session-bound and can be rotated by another tab or by
  // the session bootstrap request. Refresh it once, then retry the original
  // JSON request without weakening server-side CSRF enforcement.
  if (
    !response.ok &&
    init.method &&
    init.method !== "GET" &&
    (response.status === 403 || response.status === 401)
  ) {
    const payload = await response.clone().json().catch(() => null) as { error?: { code?: string } } | null;
    const csrfFailure = payload?.error?.code === "CSRF_INVALID" || payload?.error?.code === "CSRF_REQUIRED";
    if (csrfFailure && await refreshCsrfToken()) {
      const retryHeaders = new Headers(init.headers);
      if (init.body && !retryHeaders.has("content-type")) retryHeaders.set("content-type", "application/json");
      const refreshedToken = sessionStorage.getItem("rta-csrf-token");
      if (refreshedToken) retryHeaders.set("x-csrf-token", refreshedToken);
      response = await send(retryHeaders);
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string; requestId?: string };
    } | null;
    const detail = payload?.error?.message;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      response.status >= 500
        ? "Dealer Flow couldn’t complete the request. Please try again shortly."
        : (typeof detail === "string" && detail.trim()) || (response.status === 429
          ? "Too many requests. Wait a moment and try again."
          : "The request could not be completed. Please try again."),
      payload?.error?.requestId ?? response.headers.get("x-request-id") ?? undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(502, "INVALID_RESPONSE", "Dealer Flow returned an unexpected response. Please try again.", response.headers.get("x-request-id") ?? undefined);
  }
}

export function idempotentJson(
  method: "POST" | "PATCH",
  value: unknown,
  idempotencyKey: string = crypto.randomUUID(),
): RequestInit {
  return {
    method,
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(value),
  };
}
