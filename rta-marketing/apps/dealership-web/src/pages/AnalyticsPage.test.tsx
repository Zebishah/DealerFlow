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
  vi.useRealTimers();
  mocks.api.mockReset();
});

describe("performance analytics", () => {
  it("renders charts and KPIs from the analytics API, filling missing months with zero activity", async () => {
    // Keep the six-month window aligned with this fixture as the real date changes.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));
    mocks.api.mockResolvedValue(analyticsResponse);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><AnalyticsPage /></QueryClientProvider>);

    expect(await screen.findByText("Performance analytics")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith("/dealership/analytics");
    expect(screen.getByRole("group", { name: /Monthly funded revenue and gross profit/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Monthly lead volume and funded deals/ })).toBeInTheDocument();
    expect(screen.getByText(/Website: 12 leads, 63%/)).toBeInTheDocument();
    expect(screen.getByText(/Closed lost: 2 leads, 11%/)).toBeInTheDocument();
    expect(screen.getByText(/April 2026: \$100,000 revenue, \$12,000 gross profit/)).toBeInTheDocument();
    expect(screen.getByText(/April 2026: 5 leads, 2 funded deals/)).toBeInTheDocument();
    expect(screen.getByText(/Conversion is calculated only for months with at least one lead/)).toBeInTheDocument();
    queryClient.clear();
  });
});
