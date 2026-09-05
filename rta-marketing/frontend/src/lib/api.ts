const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

let csrfToken: string | null = sessionStorage.getItem("rta-csrf-token");

export function setCsrfToken(value: string | null): void {
  csrfToken = value;
  if (value) sessionStorage.setItem("rta-csrf-token", value);
  else sessionStorage.removeItem("rta-csrf-token");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrfToken && init.method && init.method !== "GET") headers.set("x-csrf-token", csrfToken);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(response.status, payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "The request could not be completed");
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
