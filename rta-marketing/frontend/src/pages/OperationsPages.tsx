import { useQuery } from "@tanstack/react-query";
import { BarChart3, CircleDollarSign, Target, Users as UsersRound } from "lucide-react";
import { api } from "../lib/api";
import type { BootstrapData, DealershipSummary } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

export function TeamPage() {
  const bootstrap = useQuery({ queryKey: ["dealership", "bootstrap"], queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data) });
  if (bootstrap.isLoading) return <PageSkeleton />;
  if (bootstrap.isError) return <ErrorState message="Team data is unavailable." />;
  return <div className="page-stack"><section className="page-intro"><div><span>PEOPLE & ACCESS</span><h2>One team, clear responsibilities.</h2><p>Workspace-scoped roles keep sensitive operations restricted while giving every contributor the context they need.</p></div></section><section className="team-grid">{bootstrap.data?.team.map((member) => <article className="team-card" key={member.id}><span className="avatar large">{member.firstName?.[0] ?? member.email[0]}{member.lastName?.[0] ?? ""}</span><div><h3>{[member.firstName, member.lastName].filter(Boolean).join(" ") || "Team member"}</h3><p>{member.email}</p><span className="role-chip">{member.role.replace("_", " ")}</span></div><i className={member.isActive ? "active" : ""} /></article>)}</section></div>;
}

function useSummary() { return useQuery({ queryKey: ["dealership", "summary"], queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((result) => result.data) }); }

export function CommissionsPage() {
  const summary = useSummary();
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="Commission data is unavailable." />;
  return <FeatureDashboard icon={CircleDollarSign} eyebrow="EARNINGS" title="Commission transparency" description="Commission is calculated from funded gross profit using integer basis points—avoiding floating-point money errors." metrics={[{ label: "Earned this month", value: currency(summary.data?.sales.commissionCents ?? 0) }, { label: "Funded deals", value: String(summary.data?.sales.funded ?? 0) }, { label: "Calculation", value: "Gross × rate" }]} />;
}

export function TargetsPage() {
  const summary = useSummary();
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="Target data is unavailable." />;
  return <FeatureDashboard icon={Target} eyebrow="GOALS" title="Monthly performance targets" description="Retail, wholesale, and gross-profit targets are scoped by workspace and salesperson." metrics={[{ label: "Retail target", value: String(summary.data?.target?.retailTarget ?? "—") }, { label: "Wholesale target", value: String(summary.data?.target?.wholesaleTarget ?? "—") }, { label: "Gross target", value: summary.data?.target ? currency(summary.data.target.grossProfitTargetCents) : "—" }]} />;
}

export function AnalyticsPage() {
  const summary = useSummary();
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="Analytics are unavailable." />;
  const conversion = summary.data?.leads.total ? Math.round(summary.data.leads.converted / summary.data.leads.total * 100) : 0;
  return <FeatureDashboard icon={BarChart3} eyebrow="DECISION SUPPORT" title="Performance analytics" description="Operational metrics are calculated server-side from indexed PostgreSQL records, not trusted browser totals." metrics={[{ label: "Lead conversion", value: `${conversion}%` }, { label: "Funded revenue", value: currency(summary.data?.sales.revenueCents ?? 0) }, { label: "Gross profit", value: currency(summary.data?.sales.grossProfitCents ?? 0) }]} />;
}

function FeatureDashboard({ icon: Icon, eyebrow, title, description, metrics }: { icon: typeof UsersRound; eyebrow: string; title: string; description: string; metrics: Array<{ label: string; value: string }> }) {
  return <div className="page-stack"><section className="feature-hero"><div className="feature-icon"><Icon /></div><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></section><section className="feature-metrics">{metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</section><section className="surface methodology"><h3>Built for trustworthy operations</h3><div><p><strong>Authoritative totals</strong><br />Metrics come from server-side queries scoped to the signed-in workspace and role.</p><p><strong>Exact money</strong><br />All financial amounts use integer cents and commission rates use basis points.</p><p><strong>Traceable changes</strong><br />Critical mutations create audit events and reject stale concurrent edits.</p></div></section></div>;
}
