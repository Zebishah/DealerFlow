import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Gauge, Target, UserPlus as UserRoundSearch } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "../router/Navigation";
import { api } from "../lib/api";
import type { DealershipSummary } from "../types/domain";

const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

function Metric({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof Gauge; tone: string }) {
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{change}</small></div></article>;
}

export function OverviewPage() {
  const summary = useQuery({ queryKey: ["dealership", "summary"], queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((result) => result.data) });
  const data = summary.data;
  const targetTotal = (data?.target?.retailTarget ?? 0) + (data?.target?.wholesaleTarget ?? 0);
  const progress = targetTotal ? Math.min(100, Math.round(((data?.sales.funded ?? 0) / targetTotal) * 100)) : 0;
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="The dealership summary could not be loaded." />;

  return <div className="page-stack">
    <section className="welcome-band"><div><span>{data?.period ?? "CURRENT MONTH"} PERFORMANCE</span><h2>Your dealership is moving with purpose.</h2><p>Follow today’s opportunities and this month’s funded performance from one workspace.</p></div><div className="target-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><div><strong>{progress}%</strong><span>of target</span></div></div></section>
    <section className="kpi-grid">
      <Metric label="Pipeline leads" value={String(data?.leads.total ?? 0)} change={`${data?.leads.qualified ?? 0} qualified now`} icon={UserRoundSearch} tone="violet" />
      <Metric label="Funded this month" value={String(data?.sales.funded ?? 0)} change={`${targetTotal} combined target`} icon={Gauge} tone="blue" />
      <Metric label="Gross profit" value={currency(data?.sales.grossProfitCents ?? 0)} change="Current funded deals" icon={CircleDollarSign} tone="amber" />
      <Metric label="Commission earned" value={currency(data?.sales.commissionCents ?? 0)} change="Calculated in basis points" icon={Target} tone="coral" />
    </section>
    <section className="dashboard-grid">
      <article className="surface wide"><div className="surface-head"><div><span>PIPELINE</span><h3>Recent opportunities</h3></div><Link to="/app/leads">Open pipeline <ArrowRight size={15} /></Link></div><div className="data-list">{data?.recentLeads.map((lead) => <div className="data-row" key={lead.id}><span className="avatar small">{lead.firstName[0]}{lead.lastName[0]}</span><div><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.vehicleInterest ?? "Vehicle preference pending"}</small></div><span className={`status-chip ${lead.status}`}>{lead.status}</span><time>{new Date(lead.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</time></div>)}</div></article>
      <article className="surface"><div className="surface-head"><div><span>MONTHLY TARGET</span><h3>Funded deal progress</h3></div></div><div className="progress-summary"><div><strong>{data?.sales.funded ?? 0}</strong><span>of {targetTotal || "—"} deals</span></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><dl><div><dt>Retail goal</dt><dd>{data?.target?.retailTarget ?? "—"}</dd></div><div><dt>Wholesale goal</dt><dd>{data?.target?.wholesaleTarget ?? "—"}</dd></div><div><dt>Gross profit goal</dt><dd>{data?.target ? currency(data.target.grossProfitTargetCents) : "—"}</dd></div></dl></div></article>
      <article className="surface wide"><div className="surface-head"><div><span>RECENT ACTIVITY</span><h3>Latest funded sales</h3></div><Link to="/app/sales">View all sales <ArrowRight size={15} /></Link></div><div className="data-list">{data?.recentSales.map((sale) => <div className="data-row sales-row" key={sale.id}><span className="sale-mark">{sale.externalSaleId.slice(-2)}</span><div><strong>{sale.customerName}</strong><small>{sale.vehicleDescription}</small></div><span className={`status-chip ${sale.status}`}>{sale.status}</span><b>{currency(sale.salePriceCents)}</b></div>)}</div></article>
      <article className="surface insight-card"><span>OPERATIONS INSIGHT</span><h3>{data?.leads.new ?? 0} new leads need a first response.</h3><p>Fast follow-up is visible to the whole team and every status change is recorded for accountability.</p><Link to="/app/leads">Review new leads <ArrowRight size={15} /></Link></article>
    </section>
  </div>;
}

export function PageSkeleton() { return <div className="page-stack"><div className="skeleton hero" /><div className="kpi-grid">{[1,2,3,4].map((item) => <div className="skeleton card" key={item} />)}</div><div className="skeleton table" /></div>; }
export function ErrorState({ message }: { message: string }) { return <div className="error-state"><strong>We could not load this workspace</strong><p>{message} Confirm the API is running and your local CORS origins match.</p><button onClick={() => location.reload()}>Try again</button></div>; }
