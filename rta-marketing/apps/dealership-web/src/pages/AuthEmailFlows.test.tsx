import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthEmailConfirmation } from "../components/AuthEmailConfirmation";
import { api } from "../lib/api";
import { NavigationProvider } from "../router/Navigation";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResendVerificationPage } from "./ResendVerificationPage";
import { SignupPage } from "./SignupPage";

vi.mock("../lib/api", () => ({ api: vi.fn() }));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.mocked(api).mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("shows the requested reset email and next steps, then lets the user correct the address", async () => {
  vi.mocked(api).mockResolvedValue({ data: {} });
  render(<NavigationProvider><ForgotPasswordPage /></NavigationProvider>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "driver@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  const heading = await screen.findByRole("heading", { name: "Check your inbox." });
  expect(heading).toHaveFocus();
  expect(screen.getByText("driver@example.com")).toBeVisible();
  expect(screen.getByText(/If this email belongs to a verified RTA account/)).toBeVisible();
  expect(screen.getByText(/spam or junk/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  expect(screen.getByRole("button", { name: "Resend email in 60s" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Use a different email address" }));
  expect(screen.getByLabelText("Email address")).toHaveValue("driver@example.com");
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "correct@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByText("correct@example.com")).toBeVisible();
  expect(vi.mocked(api).mock.lastCall).toEqual(["/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: "correct@example.com" }) }]);
});

it("keeps a failed request on the form with an accessible error and allows retrying", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("Too many requests. Try again later."));
  render(<NavigationProvider><ForgotPasswordPage /></NavigationProvider>);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "driver@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Try again later.");
  expect(screen.queryByRole("heading", { name: "Check your inbox." })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
});

it("prefills verification requests and confirms the submitted address", async () => {
  window.history.replaceState({}, "", "/resend-verification?email=driver%2Bdemo%40example.com");
  vi.mocked(api).mockResolvedValue({ data: {} });
  render(<NavigationProvider><ResendVerificationPage /></NavigationProvider>);
  expect(screen.getByLabelText("Email address")).toHaveValue("driver+demo@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
  expect(await screen.findByRole("heading", { name: "Check your inbox." })).toBeVisible();
  expect(screen.getByText("driver+demo@example.com")).toBeVisible();
  expect(screen.getByText(/If this account still needs verification/)).toBeVisible();
  expect(api).toHaveBeenCalledWith("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: "driver+demo@example.com" }) });
});

it.each(["sent", "pending"] as const)("uses the signup delivery status when email delivery is %s", async (emailDelivery) => {
  vi.mocked(api).mockResolvedValue({ data: { email: "driver@example.com", emailDelivery } });
  render(<NavigationProvider><SignupPage /></NavigationProvider>);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "RTA Driver" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "driver@example.com" } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a-long-private-password" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-long-private-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("heading", { name: emailDelivery === "sent" ? "Check your inbox." : "One more step." })).toBeVisible();
  expect(screen.getByText("driver@example.com")).toBeVisible();
  if (emailDelivery === "pending") {
    expect(screen.getByText(/couldn’t send the verification email yet/)).toBeVisible();
    expect(screen.queryByText(/We sent a verification link/)).not.toBeInTheDocument();
  } else {
    expect(screen.getByText("We sent a verification link to:")).toBeVisible();
  }
});

it.each([
  ["reset", "/auth/forgot-password"],
  ["verification", "/auth/resend-verification"],
] as const)("resends %s emails after the cooldown without duplicate requests", async (purpose, endpoint) => {
  vi.useFakeTimers();
  let completeRequest!: (value: unknown) => void;
  vi.mocked(api).mockImplementation(() => new Promise((resolve) => { completeRequest = resolve; }));
  render(<NavigationProvider><AuthEmailConfirmation purpose={purpose} email="driver@example.com" delivery="pending" /></NavigationProvider>);
  expect(screen.getByRole("button", { name: "Resend email in 60s" })).toBeDisabled();
  act(() => vi.advanceTimersByTime(60_000));
  fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  expect(api).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "POST", body: JSON.stringify({ email: "driver@example.com" }) });
  await act(async () => { completeRequest({ data: {} }); });
  expect(screen.getByRole("status")).toHaveTextContent("Another email has been requested.");
  expect(screen.getByRole("button", { name: "Resend email in 60s" })).toBeDisabled();
  expect(screen.queryByText(/couldn’t send the verification email yet/)).not.toBeInTheDocument();
});

it("keeps resend failures visible and retryable without claiming an email was sent", async () => {
  vi.useFakeTimers();
  vi.mocked(api).mockRejectedValue(new Error("Email service is unavailable"));
  render(<NavigationProvider><AuthEmailConfirmation purpose="verification" email="driver@example.com" /></NavigationProvider>);
  act(() => vi.advanceTimersByTime(60_000));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend email" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("Email service is unavailable");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(screen.getByRole("button", { name: "Resend email" })).toBeEnabled();
});
