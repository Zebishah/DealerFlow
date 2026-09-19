import { useEffect, useState } from "react";
import type { DealershipAnalytics } from "../../types/domain";

export type AnalyticsMonth = {
  key: string;
  label: string;
  revenueCents: number;
  grossProfitCents: number;
  fundedSales: number;
  leads: number;
  convertedLeads: number;
};

export const PIPELINE_STAGES: ReadonlyArray<{
  key: DealershipAnalytics["leadPipeline"][number]["status"];
  label: string;
  color: string;
}> = [
  { key: "new", label: "New", color: "#5b54dc" },
  { key: "contacted", label: "Contacted", color: "#3985d8" },
  { key: "qualified", label: "Qualified", color: "#d99432" },
  { key: "converted", label: "Converted", color: "#35a477" },
  { key: "lost", label: "Closed lost", color: "#a6adbb" },
];

export function buildAnalyticsTimeline(data: DealershipAnalytics, now = new Date()): AnalyticsMonth[] {
  const salesByMonth = new Map(data.monthlySales.map((item) => [item.month, item]));
  const leadsByMonth = new Map(data.monthlyLeads.map((item) => [item.month, item]));
  const currentMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 5 + index, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const sales = salesByMonth.get(key);
    const leads = leadsByMonth.get(key);
    return {
      key,
      label: month.toLocaleDateString("en-CA", { month: "short" }),
      revenueCents: sales?.revenueCents ?? 0,
      grossProfitCents: sales?.grossProfitCents ?? 0,
      fundedSales: sales?.fundedSales ?? 0,
      leads: leads?.total ?? 0,
      convertedLeads: leads?.converted ?? 0,
    };
  });
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCompactCurrency(cents: number): string {
  const amount = cents / 100;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}m`;
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

export function formatCount(count: number): string {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(count);
}

export function formatPercentage(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export function monthTitle(point: Pick<AnalyticsMonth, "key">): string {
  return new Date(`${point.key}-01T00:00:00Z`).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function grossMargin(grossProfitCents: number, revenueCents: number): number | null {
  return revenueCents > 0 ? grossProfitCents / revenueCents : null;
}

export function buildPipelineChartData(data: DealershipAnalytics["leadPipeline"]) {
  const counts = new Map(data.map((item) => [item.status, item.count]));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: counts.get(stage.key) ?? 0,
    percentage: total > 0 ? (counts.get(stage.key) ?? 0) / total : 0,
  }));
}

export function buildAcquisitionChartData(data: DealershipAnalytics["leadSources"]) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return [...data]
    .map((item) => ({ ...item, percentage: total > 0 ? item.count / total : 0 }))
    .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source));
}

export function monthlyConversion(point: Pick<AnalyticsMonth, "leads" | "convertedLeads">): number | null {
  return point.leads > 0 ? point.convertedLeads / point.leads : null;
}

export function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}
