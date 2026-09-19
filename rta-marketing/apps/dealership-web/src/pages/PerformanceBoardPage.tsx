import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Target, UserPlus } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { DealershipSummary, MyDayData } from "../types/domain";
import { NavLink } from "../router/Navigation";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const money = (cents: number) => new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(cents / 100);

export function PerformanceBoardPage() {
  const { user } = useAuth();
  const summary = useQuery({
    queryKey: ["dealership", "summary"],
    queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((value) => value.data),
    refetchInterval: 30_000,
  });
  const operations = useQuery({
    queryKey: ["customer-operations", "my-day", "performance-board"],
    queryFn: () => api<{ data: MyDayData }>("/customer-operations/my-day").then((value) => value.data),
    enabled: user?.role === "employee" || user?.role === "admin",
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
  const boardProgress = user?.role === "virtual_assistant"
    ? data.leads.total ? Math.min(100, Math.round(data.leads.qualified / data.leads.total * 100)) : 0
    : fundedProgress;

  return <div className="performance-board">
    <section className="board-hero">
      <div><span>LIVE PERFORMANCE · {data.period}</span><h2>{user?.role === "virtual_assistant" ? "Lead momentum, visible at a glance." : "Dealership momentum, visible to the whole team."}</h2><p>Automatically refreshes every 30 seconds from PostgreSQL.</p></div>
      <div className="board-score"><strong>{boardProgress}%</strong><span>{user?.role === "virtual_assistant" ? "qualified leads" : "funded target"}</span></div>
    </section>
    <section className="board-metrics">
      <article><UserPlus /><span>Pipeline leads</span><strong>{data.leads.total}</strong><small>{data.leads.new} awaiting first action</small></article>
      {user?.role === "virtual_assistant" ? <>
        <article><UserPlus /><span>New intake</span><strong>{data.leads.new}</strong><small>Awaiting first action</small></article>
        <article><Target /><span>Qualified leads</span><strong>{data.leads.qualified}</strong><small>Ready for sales follow-up</small></article>
        <article><Target /><span>Converted leads</span><strong>{data.leads.converted}</strong><small>Successful hand-offs</small></article>
      </> : <>
        <article><CircleDollarSign /><span>Funded deals</span><strong>{data.sales.funded}</strong><small>{targetDeals ? `${targetDeals} monthly target` : "No target configured"}</small></article>
        <article><Target /><span>Gross profit</span><strong>{money(data.sales.grossProfitCents)}</strong><small>{grossProgress}% of monthly target</small></article>
        <article><CircleDollarSign /><span>Commission earned</span><strong>{money(data.sales.commissionCents)}</strong><small>On funded sales</small></article>
      </>}
    </section>
    <section className="board-columns">
      <article className="surface board-list"><header><div><span>PIPELINE</span><h3>Recent opportunities</h3></div><NavLink to="/app/leads">Open pipeline <ArrowRight size={15} /></NavLink></header>{data.recentLeads.map((lead) => <div key={lead.id}><b>{lead.firstName[0]}{lead.lastName[0]}</b><span><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.vehicleInterest ?? "Vehicle not selected"}</small></span><em className={`status-chip ${lead.status}`}>{lead.status}</em></div>)}</article>
      {user?.role === "employee" ? <article className="surface board-list"><header><div><span>CUSTOMER OPERATIONS</span><h3>Today’s work</h3></div><NavLink to="/app/my-day">Open My day <ArrowRight size={15} /></NavLink></header><div><b>{operations.data?.counts.appointmentsToday ?? "—"}</b><span><strong>Appointments today</strong><small>Prepare for the next customer moment</small></span><em><NavLink to="/app/appointments">Appointments</NavLink></em></div><div><b>{operations.data?.counts.dueToday ?? "—"}</b><span><strong>Follow-ups due</strong><small>{operations.data?.counts.overdue ?? "—"} overdue follow-ups</small></span><em><NavLink to="/app/follow-ups">Follow-ups</NavLink></em></div><div><b>{operations.data?.counts.escalations ?? "—"}</b><span><strong>Open handoffs</strong><small>Manager and VA context</small></span><em><NavLink to="/app/inbox">Inbox</NavLink></em></div></article> : user?.role !== "virtual_assistant" ? <article className="surface board-list"><header><div><span>FUNDED ACTIVITY</span><h3>Latest sales</h3></div><NavLink to="/app/sales">Open ledger <ArrowRight size={15} /></NavLink></header>{data.recentSales.map((sale) => <div key={sale.id}><b>{sale.externalSaleId.slice(-2)}</b><span><strong>{sale.customerName}</strong><small>{sale.vehicleDescription}</small></span><em>{money(sale.salePriceCents)}</em></div>)}</article> : <article className="surface board-list"><header><div><span>CUSTOMER OPERATIONS</span><h3>Keep the queue moving</h3></div><NavLink to="/app/my-day">Open My day <ArrowRight size={15} /></NavLink></header><div><b>01</b><span><strong>Work today’s priority queue</strong><small>Overdue follow-ups and appointment confirmations</small></span><em><NavLink to="/app/follow-ups">Follow-ups</NavLink></em></div><div><b>02</b><span><strong>Coordinate a clean handoff</strong><small>Give sales the context they need to close</small></span><em><NavLink to="/app/inbox">Operations inbox</NavLink></em></div><div><b>03</b><span><strong>Review your operating rhythm</strong><small>Contacts, bookings, and completed customer moments</small></span><em><NavLink to="/app/my-performance">Performance</NavLink></em></div></article>}
    </section>
  </div>;
}
