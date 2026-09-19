import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CalendarDays, CircleDollarSign, Clock3, Gauge, Inbox, ListTodo, Target, UserCheck, UserPlus as UserRoundSearch, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { useAuth } from "../auth/AuthContext";
import { Link } from "../router/Navigation";
import { api } from "../lib/api";
import type { BootstrapData, DealershipSummary, MyDayData } from "../types/domain";

const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

function Metric({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof Gauge; tone: string }) {
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{change}</small></div></article>;
}

export function OverviewPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ["dealership", "summary"], queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((result) => result.data) });
  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data),
    staleTime: 5 * 60_000,
    enabled: user?.role === "recruiter",
  });
  const employeeDay = useQuery({
    queryKey: ["customer-operations", "my-day", "overview"],
    queryFn: () => api<{ data: MyDayData }>("/customer-operations/my-day").then((result) => result.data),
    enabled: user?.role === "employee",
    refetchInterval: 60_000,
  });
  const data = summary.data;
  const isEmployee = user?.role === "employee";
  const isAssistant = user?.role === "virtual_assistant";
  const isRecruiter = user?.role === "recruiter";
  const targetTotal = (data?.target?.retailTarget ?? 0) + (data?.target?.wholesaleTarget ?? 0);
  const progress = isAssistant
    ? data?.leads.total ? Math.min(100, Math.round((data.leads.qualified / data.leads.total) * 100)) : 0
    : targetTotal ? Math.min(100, Math.round(((data?.sales.funded ?? 0) / targetTotal) * 100)) : 0;
  if (summary.isLoading || bootstrap.isLoading) return <PageSkeleton />;
  if (summary.isError || bootstrap.isError) return <ErrorState message="The workspace summary could not be loaded." />;
  const activeMembers = bootstrap.data?.team.filter((member) => member.isActive).length ?? 0;
  const salespeople = bootstrap.data?.team.filter((member) => member.isActive && member.role === "employee").length ?? 0;
  const hero = isEmployee
    ? { eyebrow: `${data?.period ?? "CURRENT MONTH"} · PERSONAL PERFORMANCE`, title: "Your sales desk, clearly prioritized.", description: "Work your assigned opportunities, record your deals, and track progress against your own target." }
    : isAssistant
      ? { eyebrow: `${data?.period ?? "CURRENT MONTH"} · LEAD OPERATIONS`, title: "Keep every opportunity moving.", description: "Manage the workspace intake queue, update lead status, and hand clean opportunities to the sales team." }
      : isRecruiter
        ? { eyebrow: `${data?.period ?? "CURRENT MONTH"} · PEOPLE & CAPACITY`, title: "A clear view of team readiness.", description: "Monitor active people, sales capacity, and pipeline health from one workspace-scoped view." }
        : { eyebrow: `${data?.period ?? "CURRENT MONTH"} PERFORMANCE`, title: "Your dealership is moving with purpose.", description: "Follow today’s opportunities and this month’s funded performance from one workspace." };

  return <div className="page-stack">
    <section className="welcome-band"><div><span>{hero.eyebrow}</span><h2>{hero.title}</h2><p>{hero.description}</p></div><div className="target-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><div><strong>{progress}%</strong><span>{isAssistant ? "qualified leads" : "of target"}</span></div></div></section>
    <section className="kpi-grid">
      {isEmployee ? <>
        <Metric label="My pipeline" value={String(data?.leads.total ?? 0)} change={`${data?.leads.qualified ?? 0} qualified now`} icon={UserRoundSearch} tone="violet" />
        <Metric label="My funded deals" value={String(data?.sales.funded ?? 0)} change={`${targetTotal} personal target`} icon={Gauge} tone="blue" />
        <Metric label="My gross profit" value={currency(data?.sales.grossProfitCents ?? 0)} change="Current funded deals" icon={CircleDollarSign} tone="amber" />
        <Metric label="My commission" value={currency(data?.sales.commissionCents ?? 0)} change="Calculated from funded deals" icon={Target} tone="coral" />
      </> : isAssistant ? <>
        <Metric label="Lead queue" value={String(data?.leads.total ?? 0)} change="Workspace opportunities" icon={ListTodo} tone="violet" />
        <Metric label="New intake" value={String(data?.leads.new ?? 0)} change="Needs first action" icon={UserRoundSearch} tone="blue" />
        <Metric label="Qualified" value={String(data?.leads.qualified ?? 0)} change="Ready for sales follow-up" icon={UserCheck} tone="amber" />
        <Metric label="Converted" value={String(data?.leads.converted ?? 0)} change="Successful hand-offs" icon={Target} tone="coral" />
      </> : isRecruiter ? <>
        <Metric label="Active team" value={String(activeMembers)} change="Workspace members" icon={Users} tone="violet" />
        <Metric label="Sales capacity" value={String(salespeople)} change="Active salespeople" icon={UserCheck} tone="blue" />
        <Metric label="Open opportunities" value={String(data?.leads.total ?? 0)} change={`${data?.leads.new ?? 0} new intake`} icon={UserRoundSearch} tone="amber" />
        <Metric label="Funded deals" value={String(data?.sales.funded ?? 0)} change="Current month" icon={Gauge} tone="coral" />
      </> : <>
        <Metric label="Pipeline leads" value={String(data?.leads.total ?? 0)} change={`${data?.leads.qualified ?? 0} qualified now`} icon={UserRoundSearch} tone="violet" />
        <Metric label="Funded this month" value={String(data?.sales.funded ?? 0)} change={`${targetTotal} combined target`} icon={Gauge} tone="blue" />
        <Metric label="Gross profit" value={currency(data?.sales.grossProfitCents ?? 0)} change="Current funded deals" icon={CircleDollarSign} tone="amber" />
        <Metric label="Commission earned" value={currency(data?.sales.commissionCents ?? 0)} change="Calculated in basis points" icon={Target} tone="coral" />
      </>}
    </section>
    {isEmployee && <section className="employee-today-grid">
      <article className="surface employee-today-panel">
        <div className="surface-head"><div><span>TODAY · CUSTOMER OPERATIONS</span><h3>Keep the sales desk moving.</h3></div><Link to="/app/my-day">Open My day <ArrowRight size={15} /></Link></div>
        {employeeDay.isLoading ? <div className="inline-loading" aria-label="Loading today’s customer operations"><span className="loading-spinner" />Loading today’s work…</div> : employeeDay.isError ? <div className="empty-state"><AlertCircle size={22} /><strong>Today’s work is temporarily unavailable</strong><span>Open My day to retry the operational queue.</span></div> : <div className="today-metrics">
          <Link to="/app/appointments"><CalendarDays size={17} /><span><strong>{employeeDay.data?.counts.appointmentsToday ?? 0}</strong><small>Appointments today</small></span></Link>
          <Link to="/app/follow-ups"><ListTodo size={17} /><span><strong>{employeeDay.data?.counts.dueToday ?? 0}</strong><small>Follow-ups due</small></span></Link>
          <Link to="/app/follow-ups"><Clock3 size={17} /><span><strong>{employeeDay.data?.counts.overdue ?? 0}</strong><small>Overdue follow-ups</small></span></Link>
          <Link to="/app/inbox"><Inbox size={17} /><span><strong>{employeeDay.data?.counts.escalations ?? 0}</strong><small>Open handoffs</small></span></Link>
        </div>}
      </article>
      <article className="surface employee-next-action"><span>NEXT BEST ACTION</span>{employeeDay.data?.priority[0] ? <><h3>{employeeDay.data.priority[0].firstName} {employeeDay.data.priority[0].lastName}</h3><p>{employeeDay.data.priority[0].note ?? "Customer follow-up"}</p><small>{employeeDay.data.priority[0].priority} priority · {new Date(employeeDay.data.priority[0].dueAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</small><Link to="/app/follow-ups">Open follow-up <ArrowRight size={15} /></Link></> : employeeDay.isLoading ? <div className="inline-loading"><span className="loading-spinner" />Finding next action…</div> : <div className="empty-state"><strong>No priority action waiting</strong><span>Your follow-up queue is clear.</span></div>}</article>
    </section>}
    <section className="dashboard-grid">
      <article className="surface wide"><div className="surface-head"><div><span>PIPELINE</span><h3>Recent opportunities</h3></div><Link to="/app/leads">Open pipeline <ArrowRight size={15} /></Link></div><div className="data-list">{data?.recentLeads.map((lead) => <div className="data-row" key={lead.id}><span className="avatar small">{lead.firstName[0]}{lead.lastName[0]}</span><div><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.vehicleInterest ?? "Vehicle preference pending"}</small></div><span className={`status-chip ${lead.status}`}>{lead.status}</span><time>{new Date(lead.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</time></div>)}</div></article>
      {isAssistant ? <article className="surface"><div className="surface-head"><div><span>LEAD QUALITY</span><h3>Qualification progress</h3></div></div><div className="progress-summary"><div><strong>{data?.leads.qualified ?? 0}</strong><span>of {data?.leads.total ?? 0} opportunities</span></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><dl><div><dt>New intake</dt><dd>{data?.leads.new ?? 0}</dd></div><div><dt>Contacted</dt><dd>{Math.max((data?.leads.total ?? 0) - (data?.leads.new ?? 0) - (data?.leads.qualified ?? 0) - (data?.leads.converted ?? 0), 0)}</dd></div><div><dt>Converted</dt><dd>{data?.leads.converted ?? 0}</dd></div></dl></div></article> : <article className="surface"><div className="surface-head"><div><span>{isRecruiter ? "TEAM PERFORMANCE" : "MONTHLY TARGET"}</span><h3>{isRecruiter ? "Funded deal progress" : "Funded deal progress"}</h3></div></div><div className="progress-summary"><div><strong>{data?.sales.funded ?? 0}</strong><span>of {targetTotal || "—"} deals</span></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><dl><div><dt>Retail goal</dt><dd>{data?.target?.retailTarget ?? "—"}</dd></div><div><dt>Wholesale goal</dt><dd>{data?.target?.wholesaleTarget ?? "—"}</dd></div><div><dt>Gross profit goal</dt><dd>{data?.target ? currency(data.target.grossProfitTargetCents) : "—"}</dd></div></dl></div></article>}
      {!isAssistant && <article className="surface wide"><div className="surface-head"><div><span>RECENT ACTIVITY</span><h3>Latest funded sales</h3></div><Link to="/app/sales">View all sales <ArrowRight size={15} /></Link></div><div className="data-list">{data?.recentSales.map((sale) => <div className="data-row sales-row" key={sale.id}><span className="sale-mark">{sale.externalSaleId.slice(-2)}</span><div><strong>{sale.customerName}</strong><small>{sale.vehicleDescription}</small></div><span className={`status-chip ${sale.status}`}>{sale.status}</span><b>{currency(sale.salePriceCents)}</b></div>)}</div></article>}
      <article className="surface insight-card"><span>{isRecruiter ? "PEOPLE INSIGHT" : isAssistant ? "LEAD INSIGHT" : "OPERATIONS INSIGHT"}</span><h3>{isRecruiter ? `${activeMembers} active people are ready for the current workload.` : isAssistant ? `${data?.leads.new ?? 0} new leads need a first response.` : `${data?.leads.new ?? 0} new leads need a first response.`}</h3><p>{isRecruiter ? "Review role coverage and active capacity before the next hiring or allocation decision." : isAssistant ? "Fast, accurate intake keeps the sales team focused on qualified opportunities." : "Fast follow-up is visible to the whole team and every status change is recorded for accountability."}</p><Link to={isRecruiter ? "/app/team" : "/app/leads"}>{isRecruiter ? "Review team capacity" : "Review new leads"} <ArrowRight size={15} /></Link></article>
    </section>
  </div>;
}

export function PageSkeleton() { return <div className="page-stack"><div className="skeleton hero" /><div className="kpi-grid">{[1,2,3,4].map((item) => <div className="skeleton card" key={item} />)}</div><div className="skeleton table" /></div>; }
export function ErrorState({ message }: { message: string }) { return <div className="error-state"><strong>We could not load this workspace</strong><p>{message} Confirm the API is running and your local CORS origins match.</p><button onClick={() => location.reload()}>Try again</button></div>; }
