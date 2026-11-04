import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { api, ApiError, setCsrfToken } from "../lib/api";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/api")>(),
  api: vi.fn(),
  setCsrfToken: vi.fn(),
}));

const session = { data: { user: { id: "user-1", workspaceId: "workspace-1", email: "driver@example.com" }, csrfToken: "session-csrf" } };
const request = vi.mocked(api);

function Harness() {
  const { user, loading, logout } = useAuth();
  const [error, setError] = useState("");
  return <><p>{user ? user.email : "Signed out"}</p><p>{loading ? "Loading" : "Ready"}</p><button onClick={() => void logout().catch((error: Error) => setError(error.message))}>Sign out</button>{error && <p role="alert">{error}</p>}</>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AuthProvider><Harness /></AuthProvider></QueryClientProvider>);
  return client;
}

beforeEach(() => { request.mockReset(); vi.mocked(setCsrfToken).mockClear(); });
afterEach(cleanup);

it("waits for server logout before removing the user, cached workspace data, and CSRF token", async () => {
  let finish!: () => void;
  request.mockResolvedValueOnce(session).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(undefined); }));
  const client = mount();
  expect(await screen.findByText("driver@example.com")).toBeVisible();
  client.setQueryData(["private", "records"], ["sensitive-data"]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(screen.getByText("driver@example.com")).toBeVisible();
  expect(client.getQueryData(["private", "records"])).toEqual(["sensitive-data"]);
  await act(async () => { finish(); });
  expect(screen.getByText("Signed out")).toBeVisible();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(setCsrfToken).toHaveBeenLastCalledWith(null);
  expect(request).toHaveBeenLastCalledWith("/auth/logout", { method: "POST" });
});

it("preserves the session and workspace data when logout fails", async () => {
  request.mockResolvedValueOnce(session).mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "Please try again"));
  const client = mount();
  await screen.findByText("driver@example.com");
  client.setQueryData(["private", "records"], ["sensitive-data"]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(screen.getByText("driver@example.com")).toBeVisible();
  expect(client.getQueryData(["private", "records"])).toEqual(["sensitive-data"]);
  expect(setCsrfToken).not.toHaveBeenCalledWith(null);
});

it("finishes local logout when the server session has already expired", async () => {
  request.mockResolvedValueOnce(session).mockRejectedValueOnce(new ApiError(401, "AUTH_REQUIRED", "Authentication is required"));
  const client = mount();
  await screen.findByText("driver@example.com");
  client.setQueryData(["private", "records"], ["sensitive-data"]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByText("Signed out")).toBeVisible();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(setCsrfToken).toHaveBeenLastCalledWith(null);
});

it("ignores a delayed session bootstrap response after logout", async () => {
  let finishSession!: () => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { finishSession = () => resolve(session); })).mockResolvedValueOnce(undefined);
  mount();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign out" })); });
  await act(async () => { finishSession(); });
  expect(screen.getByText("Signed out")).toBeVisible();
  expect(screen.queryByText("driver@example.com")).not.toBeInTheDocument();
  expect(setCsrfToken).not.toHaveBeenCalledWith("session-csrf");
});
