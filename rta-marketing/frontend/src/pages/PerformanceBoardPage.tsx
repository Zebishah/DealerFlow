import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Target, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import type { DealershipSummary } from "../types/domain";
import { NavLink } from "../router/Navigation";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const money = (cents: number) => new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(cents / 100);

export function PerformanceBoardPage() {
  const summary = useQuery({
    queryKey: ["dealership", "summary"],
    queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((value) => value.data),
    refetchInterval: 30_000,
  });
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError || !summary.data) return <ErrorState message="Performance board data is unavailable." />;

  const data = summary.data;
  const target = data.target;
  const targetDeals = (target?.retailTarget ?? 0) + (target?.wholesaleTarget ?? 0);
  const fundedProgress = targetDeals ? Math.min(100, Math.round(data.sales.funded / targetDeals * 100)) : 0;
  const grossProgress = target?.grossProfitTargetCents
    ? Math.min(100, Math.round(data.sales.grossProfitCents / target.grossProfitTargetCents * 100))
    : 0;

  return <div className="performance-board">
    <section className="board-hero">
      <div><span>LIVE PERFORMANCE · {data.period}</span><h2>Dealership momentum, visible to the whole team.</h2><p>Automatically refreshes every 30 seconds from PostgreSQL.</p></div>
      <div className="board-score"><strong>{fundedProgress}%</strong><span>funded target</span></div>
    </section>
    <section className="board-metrics">
      <article><UserPlus /><span>Pipeline leads</span><strong>{data.leads.total}</strong><small>{data.leads.new} awaiting first action</small></article>
      <article><CircleDollarSign /><span>Funded deals</span><strong>{data.sales.funded}</strong><small>{targetDeals ? `${targetDeals} monthly target` : "No target configured"}</small></article>
      <article><Target /><span>Gross profit</span><strong>{money(data.sales.grossProfitCents)}</strong><small>{grossProgress}% of monthly target</small></article>
      <article><CircleDollarSign /><span>Commission earned</span><strong>{money(data.sales.commissionCents)}</strong><small>On funded sales</small></article>
    </section>
    <section className="board-columns">
      <article className="surface board-list"><header><div><span>PIPELINE</span><h3>Recent opportunities</h3></div><NavLink to="/app/leads">Open pipeline <ArrowRight size={15} /></NavLink></header>{data.recentLeads.map((lead) => <div key={lead.id}><b>{lead.firstName[0]}{lead.lastName[0]}</b><span><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.vehicleInterest ?? "Vehicle not selected"}</small></span><em className={`status-chip ${lead.status}`}>{lead.status}</em></div>)}</article>
      <article className="surface board-list"><header><div><span>FUNDED ACTIVITY</span><h3>Latest sales</h3></div><NavLink to="/app/sales">Open ledger <ArrowRight size={15} /></NavLink></header>{data.recentSales.map((sale) => <div key={sale.id}><b>{sale.externalSaleId.slice(-2)}</b><span><strong>{sale.customerName}</strong><small>{sale.vehicleDescription}</small></span><em>{money(sale.salePriceCents)}</em></div>)}</article>
    </section>
  </div>;
}
