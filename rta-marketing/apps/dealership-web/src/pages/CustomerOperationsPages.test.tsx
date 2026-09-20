import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationProvider } from "../router/Navigation";
import { MyDayPage } from "./CustomerOperationsPages";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ api: mocks.api }));

afterEach(() => {
  cleanup();
  mocks.api.mockReset();
});

describe("customer operations", () => {
  it("renders real My Day counts and priority work with an empty-state-safe queue", async () => {
    mocks.api.mockResolvedValue({ data: {
      counts: { newLeads: 3, dueToday: 2, overdue: 1, appointmentsToday: 1, confirmations: 1, escalations: 0 },
      priority: [{ id: "follow-up-1", leadId: "lead-1", firstName: "Ethan", lastName: "Brown", status: "qualified", dueAt: "2026-09-20T10:30:00.000Z", priority: "urgent", note: "Confirm finance questions" }],
    } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<NavigationProvider><QueryClientProvider client={queryClient}><MyDayPage /></QueryClientProvider></NavigationProvider>);

    expect(await screen.findByText("My day, clearly prioritized.")).toBeInTheDocument();
    expect(screen.getByText("Ethan Brown")).toBeInTheDocument();
    expect(screen.getByText("Confirm finance questions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(await screen.findByRole("dialog", { name: /Ethan Brown/i })).toBeInTheDocument();
    expect(screen.getByText("Open follow-up queue")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith("/customer-operations/my-day");
    queryClient.clear();
  });
});
