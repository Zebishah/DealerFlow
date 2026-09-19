import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DealershipAnalytics } from "../types/domain";
import { ChartEmptyState } from "./charts/ChartEmptyState";
import { ChartTooltip } from "./charts/ChartTooltip";
import {
  buildAcquisitionChartData,
  buildPipelineChartData,
  formatCompactCurrency,
  formatCount,
  formatCurrency,
  formatPercentage,
  monthTitle,
  type AnalyticsMonth,
  usePrefersReducedMotion,
} from "./charts/chart-formatters";

export { buildAnalyticsTimeline } from "./charts/chart-formatters";
export type { AnalyticsMonth } from "./charts/chart-formatters";
export { buildAcquisitionChartData, buildPipelineChartData, formatCurrency, formatPercentage } from "./charts/chart-formatters";

const chartHeight = 248;
const axisColor = "#919bad";
const gridColor = "#edf0f5";

function ChartSummary({ children }: { children: string }) {
  return <p className="analytics-chart-summary sr-only">{children}</p>;
}

export function RevenueTrendChart({ points }: { points: AnalyticsMonth[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const hasSales = points.some((point) => point.revenueCents > 0 || point.grossProfitCents > 0 || point.fundedSales > 0);
  const summary = points.map((point) => `${monthTitle(point)}: ${formatCurrency(point.revenueCents)} revenue, ${formatCurrency(point.grossProfitCents)} gross profit`).join("; ");

  if (!hasSales) return <ChartEmptyState title="No funded revenue yet" detail="Revenue trend data will appear after funded deals are recorded." />;

  return <div className="analytics-chart-wrap" role="group" aria-label="Monthly funded revenue and gross profit for the last six months">
    <ChartSummary>{summary}</ChartSummary>
    <div className="analytics-legend"><span><i className="analytics-legend-revenue" />Revenue</span><span><i className="analytics-legend-profit" />Gross profit</span></div>
    <div className="analytics-recharts-frame">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={points} margin={{ top: 12, right: 8, left: 4, bottom: 2 }}>
          <defs><linearGradient id="analytics-revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#635bdf" stopOpacity={0.22} /><stop offset="100%" stopColor="#635bdf" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatCompactCurrency} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ChartTooltip valueFormat="currency" showMargin />} cursor={{ stroke: "#cfd3e1", strokeDasharray: "4 4" }} />
          <Area type="monotone" dataKey="revenueCents" name="Revenue" stroke="#6159dc" strokeWidth={3} fill="url(#analytics-revenue-fill)" dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 3 }} isAnimationActive={!reducedMotion} animationDuration={650} />
          <Line type="monotone" dataKey="grossProfitCents" name="Gross profit" stroke="#32a77a" strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 3 }} isAnimationActive={!reducedMotion} animationDuration={650} />
          <ReferenceLine y={0} stroke="#dfe3eb" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div className="analytics-hover-stats" role="status"><strong>Interactive revenue trend</strong><span>Hover a month for revenue, gross profit and margin.</span></div>
  </div>;
}

export function LeadPipelineChart({ data }: { data: DealershipAnalytics["leadPipeline"] }) {
  const reducedMotion = usePrefersReducedMotion();
  const chartData = useMemo(() => buildPipelineChartData(data), [data]);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (!data.length || total === 0) return <ChartEmptyState title="No pipeline activity yet" detail="Lead stages will appear here when your workspace has active records." />;

  return <div className="analytics-chart-wrap analytics-horizontal-chart" role="group" aria-label="Lead pipeline by status">
    <ChartSummary>{chartData.map((stage) => `${stage.label}: ${formatCount(stage.count)} leads, ${formatPercentage(stage.percentage)}`).join("; ")}</ChartSummary>
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 35, left: 8, bottom: 4 }} barCategoryGap="22%">
        <CartesianGrid stroke={gridColor} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickFormatter={formatCount} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={72} tick={{ fill: "#566177", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip showPercentage />} cursor={{ fill: "#f8f8ff" }} />
        <Bar dataKey="count" name="Leads" radius={[0, 5, 5, 0]} isAnimationActive={!reducedMotion} animationDuration={550}>
          {chartData.map((stage) => <Cell key={stage.key} fill={stage.color} />)}
          <LabelList dataKey="count" position="right" formatter={(value) => formatCount(Number(value ?? 0))} fill="#30394f" fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <p className="analytics-chart-footnote">{formatCount(total)} leads across all pipeline stages</p>
  </div>;
}

export function LeadSourceChart({ data }: { data: DealershipAnalytics["leadSources"] }) {
  const reducedMotion = usePrefersReducedMotion();
  const chartData = useMemo(() => buildAcquisitionChartData(data), [data]);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (!data.length || total === 0) return <ChartEmptyState title="No acquisition activity yet" detail="Lead sources will be ranked here as new leads arrive." />;

  return <div className="analytics-chart-wrap analytics-horizontal-chart" role="group" aria-label="Lead acquisition sources">
    <ChartSummary>{chartData.map((source) => `${source.source}: ${formatCount(source.count)} leads, ${formatPercentage(source.percentage)}`).join("; ")}</ChartSummary>
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 48 + 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 35, left: 8, bottom: 4 }} barCategoryGap="24%">
        <CartesianGrid stroke={gridColor} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickFormatter={formatCount} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="source" width={90} tick={{ fill: "#566177", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip showPercentage />} cursor={{ fill: "#f8f8ff" }} />
        <Bar dataKey="count" name="Leads" radius={[0, 5, 5, 0]} isAnimationActive={!reducedMotion} animationDuration={550}>
          {chartData.map((source, index) => <Cell key={source.source} fill={["#6057dc", "#3886d6", "#d99636", "#39a77b"][index % 4]} />)}
          <LabelList dataKey="count" position="right" formatter={(value) => formatCount(Number(value ?? 0))} fill="#30394f" fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <p className="analytics-chart-footnote">Lead source for records created in the last six months</p>
  </div>;
}

export function MonthlyActivityChart({ points }: { points: AnalyticsMonth[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const hasActivity = points.some((point) => point.leads > 0 || point.fundedSales > 0);
  if (!hasActivity) return <ChartEmptyState title="No monthly activity yet" detail="Leads and funded deals will appear here for the selected period." />;

  return <div className="analytics-activity-wrap" role="group" aria-label="Monthly lead volume and funded deals for the last six months">
    <ChartSummary>{points.map((point) => `${monthTitle(point)}: ${formatCount(point.leads)} leads, ${formatCount(point.fundedSales)} funded deals`).join("; ")}</ChartSummary>
    <ResponsiveContainer width="100%" height={248}>
      <BarChart data={points} margin={{ top: 12, right: 8, left: 0, bottom: 2 }} barGap={5}>
        <CartesianGrid stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickFormatter={formatCount} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
        <Tooltip content={<ChartTooltip showConversion />} cursor={{ fill: "#f8f8ff" }} />
        <Legend verticalAlign="top" align="left" height={30} iconType="circle" wrapperStyle={{ color: "#778197", fontSize: "10px" }} />
        <Bar dataKey="leads" name="Leads" fill="#6259de" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={550} />
        <Bar dataKey="fundedSales" name="Funded deals" fill="#39ad80" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={550} />
      </BarChart>
    </ResponsiveContainer>
    <div className="analytics-hover-stats" role="status"><strong>Interactive monthly activity</strong><span>Hover a month for leads, funded deals and conversion.</span></div>
    <p className="analytics-chart-footnote">Conversion is calculated only for months with at least one lead.</p>
  </div>;
}
