import { useState } from "react";
import type { DealershipAnalytics } from "../types/domain";

export type AnalyticsMonth = {
  key: string;
  label: string;
  revenueCents: number;
  grossProfitCents: number;
  fundedSales: number;
  leads: number;
  convertedLeads: number;
};

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

const money = (cents: number) => new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(cents / 100);
const monthTitle = (point: AnalyticsMonth) => new Date(`${point.key}-01T00:00:00Z`).toLocaleDateString("en-CA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function compactMoney(cents: number): string {
  const amount = cents / 100;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}m`;
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

export function RevenueTrendChart({ points }: { points: AnalyticsMonth[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 760;
  const height = 280;
  const left = 63;
  const right = 18;
  const top = 15;
  const bottom = 39;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...points.flatMap((point) => [point.revenueCents, point.grossProfitCents]), 1) * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalizedMax = maxValue / magnitude;
  const chartMax = (normalizedMax <= 1 ? 1 : normalizedMax <= 2 ? 2 : normalizedMax <= 5 ? 5 : 10) * magnitude;
  const x = (index: number) => left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / chartMax) * plotHeight;
  const linePath = (field: "revenueCents" | "grossProfitCents") => points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[field])}`)
    .join(" ");
  const revenueArea = `${linePath("revenueCents")} L ${x(points.length - 1)} ${top + plotHeight} L ${x(0)} ${top + plotHeight} Z`;
  const hasSales = points.some((point) => point.revenueCents > 0);
  const activePoint = activeIndex === null ? undefined : points[activeIndex];

  return <div className="analytics-chart-wrap">
    <div className="analytics-legend"><span><i className="analytics-legend-revenue" />Revenue</span><span><i className="analytics-legend-profit" />Gross profit</span></div>
    <svg className="analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Monthly funded revenue and gross profit for the last six months">
      <defs><linearGradient id="analytics-revenue-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#635bdf" stopOpacity=".22" /><stop offset="100%" stopColor="#635bdf" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((step) => {
        const value = chartMax * (1 - step / 3);
        const yPosition = top + plotHeight * (step / 3);
        return <g key={step}><line x1={left} x2={width - right} y1={yPosition} y2={yPosition} className="analytics-grid-line" /><text x={left - 10} y={yPosition + 4} textAnchor="end" className="analytics-axis-label">{compactMoney(value)}</text></g>;
      })}
      <path d={revenueArea} fill="url(#analytics-revenue-area)" />
      <path d={linePath("revenueCents")} className="analytics-revenue-line" />
      <path d={linePath("grossProfitCents")} className="analytics-profit-line" />
      {points.map((point, index) => <g
        key={point.key}
        className="analytics-line-month"
        role="button"
        tabIndex={0}
        aria-label={`${point.label}: revenue ${money(point.revenueCents)}, gross profit ${money(point.grossProfitCents)}, ${point.fundedSales} funded deals`}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(index)}
        onBlur={() => setActiveIndex(null)}
      >
        <circle cx={x(index)} cy={y(point.revenueCents)} r="12" className="analytics-point-hit-area" />
        <circle cx={x(index)} cy={y(point.grossProfitCents)} r="12" className="analytics-point-hit-area" />
        <circle cx={x(index)} cy={y(point.revenueCents)} r="4.5" className="analytics-revenue-point" />
        <circle cx={x(index)} cy={y(point.grossProfitCents)} r="4" className="analytics-profit-point" />
        <text x={x(index)} y={height - 11} textAnchor="middle" className="analytics-axis-label">{point.label}</text>
      </g>)}
      {!hasSales && <text x={left + plotWidth / 2} y={top + plotHeight / 2} textAnchor="middle" className="analytics-empty-chart-label">No funded sales in this period yet</text>}
    </svg>
    <div className="analytics-hover-stats" role="status" aria-live="polite">
      {activePoint ? <><strong>{monthTitle(activePoint)}</strong><span>Revenue {money(activePoint.revenueCents)} · Gross profit {money(activePoint.grossProfitCents)} · {activePoint.fundedSales} funded deals</span></> : <><strong>Explore the trend</strong><span>Hover over or focus a month to inspect its figures.</span></>}
    </div>
  </div>;
}

const pipelineStages: Array<{ key: DealershipAnalytics["leadPipeline"][number]["status"]; label: string; color: string }> = [
  { key: "new", label: "New", color: "#5b54dc" },
  { key: "contacted", label: "Contacted", color: "#3985d8" },
  { key: "qualified", label: "Qualified", color: "#d99432" },
  { key: "converted", label: "Converted", color: "#35a477" },
  { key: "lost", label: "Closed lost", color: "#a6adbb" },
];

export function LeadPipelineChart({ data }: { data: DealershipAnalytics["leadPipeline"] }) {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const counts = new Map(data.map((item) => [item.status, item.count]));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maximum = Math.max(...data.map((item) => item.count), 1);

  return <div className="analytics-pipeline-list" role="group" aria-label="Lead pipeline by status">
    {pipelineStages.map((stage) => {
      const count = counts.get(stage.key) ?? 0;
      const percentage = total ? Math.round((count / total) * 100) : 0;
      return <div
        className="analytics-pipeline-row"
        key={stage.key}
        role="group"
        tabIndex={0}
        aria-label={`${stage.label}: ${count} leads, ${percentage}% of pipeline`}
        onMouseEnter={() => setActiveStage(stage.key)}
        onMouseLeave={() => setActiveStage(null)}
        onFocus={() => setActiveStage(stage.key)}
        onBlur={() => setActiveStage(null)}
      >
        <div className="analytics-pipeline-label"><span><i style={{ backgroundColor: stage.color }} />{stage.label}</span><strong>{count.toLocaleString()}<small>{percentage}%</small></strong></div>
        <div className="analytics-pipeline-track"><i style={{ width: `${(count / maximum) * 100}%`, backgroundColor: stage.color }} /></div>
      </div>;
    })}
    <div className="analytics-hover-stats" role="status" aria-live="polite">
      {activeStage === null ? <><strong>Explore the pipeline</strong><span>Hover over or focus a stage to inspect its share.</span></> : (() => {
        const stage = pipelineStages.find((item) => item.key === activeStage);
        const count = counts.get(activeStage as DealershipAnalytics["leadPipeline"][number]["status"]) ?? 0;
        return <><strong>{stage?.label}</strong><span>{count.toLocaleString()} leads · {total ? Math.round((count / total) * 100) : 0}% of all pipeline records</span></>;
      })()}
    </div>
    <p className="analytics-chart-footnote">{total.toLocaleString()} leads across all pipeline stages</p>
  </div>;
}

export function LeadSourceChart({ data }: { data: DealershipAnalytics["leadSources"] }) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maximum = Math.max(...data.map((item) => item.count), 1);
  if (!data.length) return <div className="analytics-empty-state">No lead source activity to report yet.</div>;

  return <div className="analytics-source-list" role="group" aria-label="Lead acquisition sources">
    {data.map((item, index) => <div
      className="analytics-source-row"
      key={item.source}
      role="group"
      tabIndex={0}
      aria-label={`${item.source}: ${item.count} leads, ${total ? Math.round((item.count / total) * 100) : 0}% of sources`}
      onMouseEnter={() => setActiveSource(item.source)}
      onMouseLeave={() => setActiveSource(null)}
      onFocus={() => setActiveSource(item.source)}
      onBlur={() => setActiveSource(null)}
    >
      <div><span><i className={`analytics-source-dot analytics-source-dot--${index % 4}`} />{item.source}</span><strong>{item.count.toLocaleString()}</strong></div>
      <div className="analytics-source-track"><i style={{ width: `${(item.count / maximum) * 100}%` }} /></div>
    </div>)}
    <div className="analytics-hover-stats" role="status" aria-live="polite">
      {activeSource === null ? <><strong>Explore acquisition mix</strong><span>Hover over or focus a source to inspect its share.</span></> : (() => {
        const source = data.find((item) => item.source === activeSource);
        return <><strong>{activeSource}</strong><span>{source?.count.toLocaleString() ?? 0} leads · {total ? Math.round(((source?.count ?? 0) / total) * 100) : 0}% of sources in this period</span></>;
      })()}
    </div>
    <p className="analytics-chart-footnote">Lead source for records created in the last six months</p>
  </div>;
}

export function MonthlyActivityChart({ points }: { points: AnalyticsMonth[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maximum = Math.max(...points.flatMap((point) => [point.leads, point.fundedSales]), 1);
  const hasActivity = points.some((point) => point.leads || point.fundedSales);
  const activePoint = activeIndex === null ? undefined : points[activeIndex];

  return <div className="analytics-activity-wrap">
    <div className="analytics-legend"><span><i className="analytics-legend-leads" />Leads</span><span><i className="analytics-legend-deals" />Funded deals</span></div>
    <div className="analytics-activity-chart" role="group" aria-label="Monthly lead volume and funded deals for the last six months">
      {points.map((point, index) => <button
        type="button"
        className="analytics-activity-month"
        key={point.key}
        aria-label={`${point.label}: ${point.leads} leads, ${point.convertedLeads} converted ${point.convertedLeads === 1 ? "lead" : "leads"}, ${point.fundedSales} funded deals`}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(index)}
        onBlur={() => setActiveIndex(null)}
      >
        <div className="analytics-activity-bars">
          <i className="analytics-bar-leads" style={{ height: `${point.leads ? Math.max((point.leads / maximum) * 100, 4) : 0}%` }} />
          <i className="analytics-bar-deals" style={{ height: `${point.fundedSales ? Math.max((point.fundedSales / maximum) * 100, 4) : 0}%` }} />
        </div>
        <span>{point.label}</span>
      </button>)}
      {!hasActivity && <p className="analytics-empty-chart-label">No activity in this period yet</p>}
    </div>
    <div className="analytics-hover-stats" role="status" aria-live="polite">
      {activePoint ? <><strong>{monthTitle(activePoint)}</strong><span>{activePoint.leads} leads · {activePoint.convertedLeads} converted {activePoint.convertedLeads === 1 ? "lead" : "leads"} · {activePoint.fundedSales} funded deals · Revenue {money(activePoint.revenueCents)}</span></> : <><strong>Explore monthly activity</strong><span>Hover over or focus a month to inspect its figures.</span></>}
    </div>
  </div>;
}
