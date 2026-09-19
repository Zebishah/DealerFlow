import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeadPipelineChart, LeadSourceChart, MonthlyActivityChart, RevenueTrendChart } from "../AnalyticsCharts";
import { ChartTooltip } from "./ChartTooltip";

const emptyPoints = Array.from({ length: 6 }, (_, index) => ({
  key: `2026-0${index + 1}`,
  label: "Jan",
  revenueCents: 0,
  grossProfitCents: 0,
  fundedSales: 0,
  leads: 0,
  convertedLeads: 0,
}));

afterEach(cleanup);

describe("analytics chart empty states", () => {
  it("explains empty and zero-valued charts instead of rendering misleading visuals", () => {
    render(<>
      <RevenueTrendChart points={emptyPoints} />
      <LeadPipelineChart data={[]} />
      <LeadSourceChart data={[]} />
      <MonthlyActivityChart points={emptyPoints} />
    </>);

    expect(screen.getByText("No funded revenue yet")).toBeInTheDocument();
    expect(screen.getByText("No pipeline activity yet")).toBeInTheDocument();
    expect(screen.getByText("No acquisition activity yet")).toBeInTheDocument();
    expect(screen.getByText("No monthly activity yet")).toBeInTheDocument();
  });

  it("shows safe derived metrics in the shared tooltip", () => {
    render(<ChartTooltip
      active
      label="April 2026"
      showMargin
      showConversion
      valueFormat="currency"
      payload={[{
        name: "Revenue",
        dataKey: "revenueCents",
        value: 10_000_000,
        color: "#6159dc",
        payload: { revenueCents: 10_000_000, grossProfitCents: 1_200_000, leads: 5, convertedLeads: 1 },
      }]}
    />);

    expect(screen.getByText("Gross margin 12.0%")).toBeInTheDocument();
    expect(screen.getByText("Lead conversion 20.0%")).toBeInTheDocument();
  });
});
