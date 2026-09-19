import { describe, expect, it } from "vitest";
import {
  buildAcquisitionChartData,
  buildAnalyticsTimeline,
  buildPipelineChartData,
  formatCurrency,
  formatPercentage,
  grossMargin,
  monthlyConversion,
} from "./chart-formatters";

describe("analytics chart transformations", () => {
  it("fills the rolling six-month timeline without losing API values", () => {
    const timeline = buildAnalyticsTimeline({
      period: "last_6_months",
      monthlySales: [{ month: "2026-04", fundedSales: 2, revenueCents: 10_000_000, grossProfitCents: 1_200_000 }],
      monthlyLeads: [{ month: "2026-04", total: 5, converted: 1 }],
      leadPipeline: [],
      leadSources: [],
    }, new Date("2026-09-17T12:00:00Z"));

    expect(timeline).toHaveLength(6);
    expect(timeline[0]).toMatchObject({ key: "2026-04", revenueCents: 10_000_000, leads: 5, convertedLeads: 1 });
    expect(timeline[1]).toMatchObject({ key: "2026-05", revenueCents: 0, leads: 0, fundedSales: 0 });
  });

  it("keeps pipeline in business order and calculates shares from the total", () => {
    const result = buildPipelineChartData([
      { status: "lost", count: 2 },
      { status: "qualified", count: 3 },
      { status: "new", count: 5 },
    ]);
    expect(result.map((stage) => stage.label)).toEqual(["New", "Contacted", "Qualified", "Converted", "Closed lost"]);
    expect(result.find((stage) => stage.key === "qualified")).toMatchObject({ count: 3, percentage: 0.3 });
  });

  it("sorts acquisition sources by count while preserving each source value", () => {
    expect(buildAcquisitionChartData([
      { source: "Referral", count: 7 },
      { source: "Website", count: 12 },
    ])).toEqual([
      { source: "Website", count: 12, percentage: 12 / 19 },
      { source: "Referral", count: 7, percentage: 7 / 19 },
    ]);
  });

  it("handles safe currency, percentage, conversion, and zero-revenue cases", () => {
    expect(formatCurrency(10_000_000)).toContain("100,000");
    expect(formatPercentage(1 / 3)).toBe("33%");
    expect(grossMargin(1_200_000, 10_000_000)).toBe(0.12);
    expect(grossMargin(0, 0)).toBeNull();
    expect(monthlyConversion({ leads: 5, convertedLeads: 1 })).toBe(0.2);
    expect(monthlyConversion({ leads: 0, convertedLeads: 0 })).toBeNull();
  });
});
