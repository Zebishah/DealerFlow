import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ApiError } from "../lib/api";
import { ErrorState } from "./OverviewPage";

afterEach(cleanup);

it("offers a full sign-in navigation when the workspace session has expired", () => {
  render(<ErrorState message="The workspace summary could not be loaded." error={new ApiError(401, "AUTH_REQUIRED", "Authentication is required")} />);
  expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login");
  expect(screen.getByText(/Your session has ended/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
});

it("keeps transient failures retryable without blaming the visitor's local CORS configuration", () => {
  render(<ErrorState message="The workspace summary could not be loaded." error={new ApiError(503, "UNAVAILABLE", "Unavailable")} />);
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.queryByText(/CORS/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Sign in again" })).not.toBeInTheDocument();
});
