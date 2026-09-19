import { formatCount, formatCurrency, formatPercentage, grossMargin, monthlyConversion } from "./chart-formatters";

type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  valueFormat?: "currency" | "count";
  showPercentage?: boolean;
  showMargin?: boolean;
  showConversion?: boolean;
};

export function ChartTooltip({ active, label, payload, valueFormat = "count", showPercentage = false, showMargin = false, showConversion = false }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const firstPayload = payload[0]?.payload;
  const total = typeof firstPayload?.total === "number" ? firstPayload.total : undefined;
  const margin = showMargin && typeof firstPayload?.grossProfitCents === "number" && typeof firstPayload.revenueCents === "number"
    ? grossMargin(firstPayload.grossProfitCents, firstPayload.revenueCents)
    : null;
  const conversion = showConversion && typeof firstPayload?.leads === "number" && typeof firstPayload.convertedLeads === "number"
    ? monthlyConversion({ leads: firstPayload.leads, convertedLeads: firstPayload.convertedLeads })
    : null;
  return <div className="analytics-tooltip">
    <strong>{label}</strong>
    <div className="analytics-tooltip-rows">
      {payload.map((entry, index) => {
        const value = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
        const percentage = typeof firstPayload?.percentage === "number"
          ? firstPayload.percentage
          : total && total > 0 ? value / total : null;
        return <div className="analytics-tooltip-row" key={`${String(entry.dataKey ?? entry.name)}-${index}`}>
          <span><i style={{ backgroundColor: entry.color ?? "#6259de" }} />{entry.name ?? entry.dataKey}</span>
          <strong>{valueFormat === "currency" ? formatCurrency(value) : formatCount(value)}{showPercentage && percentage !== null ? ` · ${formatPercentage(percentage)}` : ""}</strong>
        </div>;
      })}
    </div>
    {margin !== null && <div className="analytics-tooltip-note">Gross margin {formatPercentage(margin, 1)}</div>}
    {conversion !== null && <div className="analytics-tooltip-note">Lead conversion {formatPercentage(conversion, 1)}</div>}
  </div>;
}
