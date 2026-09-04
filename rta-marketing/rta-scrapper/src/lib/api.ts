const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");
const CSRF_KEY = "rta-csrf-token";

export function setCsrfToken(token: string | null): void {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
  else sessionStorage.removeItem(CSRF_KEY);
}

function demoSessionId(): string {
  const key = "rta-demo-session-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const csrfToken = sessionStorage.getItem(CSRF_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-demo-session-id": demoSessionId(),
      ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "x-csrf-token": csrfToken } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(response.status, payload?.error?.message ?? "The request could not be completed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
