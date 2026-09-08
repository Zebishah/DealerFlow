export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");

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

  let response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

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
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string; requestId?: string };
    } | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "The request could not be completed",
      payload?.error?.requestId,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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
