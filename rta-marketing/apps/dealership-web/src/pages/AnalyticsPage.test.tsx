import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "./OperationsPages";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../lib/api", () => ({ api: mocks.api }));

const analyticsResponse = {
  data: {
    period: "last_6_months" as const,
    monthlySales: [
      { month: "2026-04", fundedSales: 2, revenueCents: 10_000_000, grossProfitCents: 1_200_000 },
      { month: "2026-06", fundedSales: 3, revenueCents: 15_000_000, grossProfitCents: 2_000_000 },
      { month: "2026-09", fundedSales: 1, revenueCents: 5_000_000, grossProfitCents: 600_000 },
    ],
    monthlyLeads: [
      { month: "2026-04", total: 5, converted: 1 },
      { month: "2026-06", total: 8, converted: 2 },
      { month: "2026-09", total: 4, converted: 1 },
    ],
    leadPipeline: [
      { status: "new" as const, count: 5 },
      { status: "contacted" as const, count: 4 },
      { status: "qualified" as const, count: 3 },
      { status: "converted" as const, count: 4 },
      { status: "lost" as const, count: 2 },
    ],
    leadSources: [{ source: "Website", count: 12 }, { source: "Referral", count: 7 }],
  },
};

afterEach(() => {
  cleanup();
  mocks.api.mockReset();
});

describe("performance analytics", () => {
  it("renders charts and KPIs from the analytics API, filling missing months with zero activity", async () => {
    mocks.api.mockResolvedValue(analyticsResponse);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><AnalyticsPage /></QueryClientProvider>);

    expect(await screen.findByText("Performance analytics")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith("/dealership/analytics");
    expect(screen.getByRole("img", { name: /Monthly funded revenue and gross profit/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monthly lead volume and funded deals/ })).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Closed lost")).toBeInTheDocument();
    expect(document.querySelectorAll(".analytics-revenue-point")).toHaveLength(6);
    expect(document.querySelectorAll(".analytics-activity-month")).toHaveLength(6);
    queryClient.clear();
  });
});
