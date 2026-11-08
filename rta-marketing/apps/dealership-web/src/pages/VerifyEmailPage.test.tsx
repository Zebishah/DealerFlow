import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, ApiError } from "../lib/api";
import { NavigationProvider } from "../router/Navigation";
import { VerifyEmailPage } from "./VerifyEmailPage";

vi.mock("../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/api")>(), api: vi.fn() }));
beforeEach(() => {
  vi.mocked(api).mockReset();
  window.history.replaceState({}, "", "/verify-email#token=single-use-token");
});
afterEach(cleanup);

it("submits a single-use verification token once when Strict Mode restarts the effect", async () => {
  vi.mocked(api).mockResolvedValue({ data: { status: "verified" } });
  render(<StrictMode><NavigationProvider><VerifyEmailPage /></NavigationProvider></StrictMode>);
  expect(await screen.findByRole("heading", { name: "Email verified." })).toBeVisible();
  expect(api).toHaveBeenCalledExactlyOnceWith("/auth/verify-email", { method: "POST", body: JSON.stringify({ token: "single-use-token" }) });
  expect(window.location.href).not.toContain("single-use-token");
});

it("offers a retry for connection failures and preserves the verification token", async () => {
  vi.mocked(api).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ data: { status: "verified" } });
  render(<NavigationProvider><VerifyEmailPage /></NavigationProvider>);
  expect(await screen.findByRole("heading", { name: "We couldn’t check your link." })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Email verified." })).toBeVisible();
  expect(api).toHaveBeenCalledTimes(2);
});

it.each(["INVALID_VERIFICATION_TOKEN", "VERIFICATION_TOKEN_EXPIRED"])("offers a fresh email for %s", async (code) => {
  vi.mocked(api).mockRejectedValueOnce(new ApiError(400, code, "Link unavailable"));
  render(<NavigationProvider><VerifyEmailPage /></NavigationProvider>);
  expect(await screen.findByRole("link", { name: "Send a new email" })).toHaveAttribute("href", "/resend-verification");
  expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
});
