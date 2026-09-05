import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CircleDollarSign, Pencil, Plus, Target, Users as UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { api } from "../lib/api";
import type { BootstrapData, CommissionRule, DealershipSummary, MonthlyTargetRecord } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
function useSummary() {
  return useQuery({ queryKey: ["dealership", "summary"], queryFn: () => api<{ data: DealershipSummary }>("/dealership/summary").then((result) => result.data) });
}
function displayPerson(value: { firstName: string | null; lastName: string | null; email: string | null }, fallback: string) {
  return [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || fallback;
}

type CommissionForm = {
  userId: string;
  name: string;
  retailRate: string;
  wholesaleRate: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

function newCommission(): CommissionForm {
  return { userId: "", name: "", retailRate: "25", wholesaleRate: "20", isActive: true, effectiveFrom: today(), effectiveTo: "" };
}

export function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const summary = useSummary();
  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data),
    staleTime: 5 * 60_000,
  });
  const rules = useQuery({
    queryKey: ["dealership", "admin", "commission-rules"],
    queryFn: () => api<{ data: CommissionRule[] }>("/dealership/admin/commission-rules").then((result) => result.data),
    enabled: isAdmin,
  });
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState<CommissionForm>(newCommission);
  const [modalOpen, setModalOpen] = useState(false);

  const save = useMutation({
    mutationFn: ({ rule, value }: { rule: CommissionRule | null; value: CommissionForm }) => {
      const common = {
        name: value.name.trim(),
        retailRateBasisPoints: Math.round(Number(value.retailRate) * 100),
        wholesaleRateBasisPoints: Math.round(Number(value.wholesaleRate) * 100),
        effectiveTo: value.effectiveTo ? new Date(`${value.effectiveTo}T12:00:00`).toISOString() : null,
      };
      if (rule) {
        return api(`/dealership/admin/commission-rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...common, isActive: value.isActive }),
        });
      }
      return api("/dealership/admin/commission-rules", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          userId: value.userId || null,
          effectiveFrom: new Date(`${value.effectiveFrom}T12:00:00`).toISOString(),
        }),
      });
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.rule ? "Commission rule updated" : "Commission rule created");
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["dealership", "admin", "commission-rules"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(newCommission());
    setModalOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setEditing(rule);
    setForm({
      userId: rule.userId ?? "",
      name: rule.name,
      retailRate: String(rule.retailRateBasisPoints / 100),
      wholesaleRate: String(rule.wholesaleRateBasisPoints / 100),
      isActive: rule.isActive,
      effectiveFrom: rule.effectiveFrom.slice(0, 10),
      effectiveTo: rule.effectiveTo?.slice(0, 10) ?? "",
    });
    setModalOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (![form.retailRate, form.wholesaleRate].every((value) => Number.isFinite(Number(value)))) {
      toast.error("Enter valid commission percentages");
      return;
    }
    save.mutate({ rule: editing, value: form });
  }

  if (summary.isLoading || bootstrap.isLoading || (isAdmin && rules.isLoading)) return <PageSkeleton />;
  if (summary.isError || bootstrap.isError || (isAdmin && rules.isError)) return <ErrorState message="Commission data is unavailable." />;

  return <div className="page-stack">
    <FeatureDashboard icon={CircleDollarSign} eyebrow="EARNINGS" title="Commission transparency" description="Commission is calculated from funded gross profit using integer basis points—avoiding floating-point money errors." metrics={[{ label: "Earned this month", value: currency(summary.data?.sales.commissionCents ?? 0) }, { label: "Funded deals", value: String(summary.data?.sales.funded ?? 0) }, { label: "Calculation", value: "Gross × rate" }]} />
    {isAdmin && <section className="surface management-surface">
      <div className="surface-head"><div><span>COMMISSION POLICY</span><h3>Effective-dated rules</h3></div><button className="primary-action" onClick={openCreate}><Plus size={16} />New rule</button></div>
      {rules.data?.length ? <div className="management-list">{rules.data.map((rule) => <article key={rule.id}><div><strong>{rule.name}</strong><small>{displayPerson(rule, "Workspace default")} · from {new Date(rule.effectiveFrom).toLocaleDateString("en-CA")}</small></div><div className="rule-rates"><span>Retail <b>{rule.retailRateBasisPoints / 100}%</b></span><span>Wholesale <b>{rule.wholesaleRateBasisPoints / 100}%</b></span></div><span className={`status-chip ${rule.isActive ? "funded" : "cancelled"}`}>{rule.isActive ? "active" : "inactive"}</span><button className="small-action" onClick={() => openEdit(rule)}><Pencil size={14} />Manage</button></article>)}</div> : <div className="empty-state"><CircleDollarSign /><strong>No commission rules</strong><span>Create a default or salesperson-specific rule.</span></div>}
    </section>}
    <WorkflowModal open={modalOpen} eyebrow="COMPENSATION POLICY" title={editing ? "Manage commission rule" : "Create commission rule"} description="Rates are stored as exact basis points, where 25% equals 2,500 basis points." busy={save.isPending} onClose={() => { if (!save.isPending) setModalOpen(false); }}>
      <form className="workflow-form" onSubmit={submit}><div className="form-grid">
        <label className="form-span">Rule name<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Standard sales commission" /></label>
        {!editing && <label className="form-span">Applies to<select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}><option value="">Workspace default</option>{bootstrap.data?.team.filter((member) => member.isActive && member.role === "employee").map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>}
        <label>Retail rate (%)<input required type="number" min="0" max="100" step=".01" value={form.retailRate} onChange={(event) => setForm({ ...form, retailRate: event.target.value })} /></label>
        <label>Wholesale rate (%)<input required type="number" min="0" max="100" step=".01" value={form.wholesaleRate} onChange={(event) => setForm({ ...form, wholesaleRate: event.target.value })} /></label>
        {!editing && <label>Effective from<input required type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>}
        <label>Effective until<input type="date" min={form.effectiveFrom} value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></label>
        {editing && <label>Status<select value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm({ ...form, isActive: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
      </div><footer className="modal-actions"><button type="button" className="filter-button" disabled={save.isPending} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="primary-action" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save rule"}</button></footer></form>
    </WorkflowModal>
  </div>;
}

type TargetForm = { userId: string; month: string; retailTarget: string; wholesaleTarget: string; grossProfitTarget: string };
function newTarget(): TargetForm { return { userId: "", month: currentMonth(), retailTarget: "12", wholesaleTarget: "3", grossProfitTarget: "55000" }; }

export function TargetsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const summary = useSummary();
  const bootstrap = useQuery({ queryKey: ["dealership", "bootstrap"], queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data), staleTime: 5 * 60_000 });
  const [month, setMonth] = useState(currentMonth);
  const targets = useQuery({
    queryKey: ["dealership", "admin", "targets", month],
    queryFn: () => api<{ data: MonthlyTargetRecord[] }>(`/dealership/admin/targets?month=${month}`).then((result) => result.data),
    enabled: isAdmin,
  });
  const [editing, setEditing] = useState<MonthlyTargetRecord | null>(null);
  const [form, setForm] = useState<TargetForm>(newTarget);
  const [modalOpen, setModalOpen] = useState(false);
  const save = useMutation({
    mutationFn: (value: TargetForm) => api("/dealership/admin/targets", {
      method: "PUT",
      body: JSON.stringify({
        userId: value.userId || null,
        month: value.month,
        retailTarget: Number(value.retailTarget),
        wholesaleTarget: Number(value.wholesaleTarget),
        grossProfitTargetCents: Math.round(Number(value.grossProfitTarget) * 100),
      }),
    }),
    onSuccess: async () => {
      toast.success(editing ? "Monthly target updated" : "Monthly target saved");
      setModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "admin", "targets"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "summary"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() { setEditing(null); setForm({ ...newTarget(), month }); setModalOpen(true); }
  function openEdit(target: MonthlyTargetRecord) {
    setEditing(target);
    setForm({ userId: target.userId ?? "", month: target.month, retailTarget: String(target.retailTarget), wholesaleTarget: String(target.wholesaleTarget), grossProfitTarget: String(target.grossProfitTargetCents / 100) });
    setModalOpen(true);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (![form.retailTarget, form.wholesaleTarget, form.grossProfitTarget].every((value) => Number.isFinite(Number(value)))) {
      toast.error("Enter valid target values");
      return;
    }
    save.mutate(form);
  }

  if (summary.isLoading || bootstrap.isLoading || (isAdmin && targets.isLoading)) return <PageSkeleton />;
  if (summary.isError || bootstrap.isError || (isAdmin && targets.isError)) return <ErrorState message="Target data is unavailable." />;

  return <div className="page-stack">
    <FeatureDashboard icon={Target} eyebrow="GOALS" title="Monthly performance targets" description="Retail, wholesale, and gross-profit targets are scoped by workspace and salesperson." metrics={[{ label: "Retail target", value: String(summary.data?.target?.retailTarget ?? "—") }, { label: "Wholesale target", value: String(summary.data?.target?.wholesaleTarget ?? "—") }, { label: "Gross target", value: summary.data?.target ? currency(summary.data.target.grossProfitTargetCents) : "—" }]} />
    {isAdmin && <section className="surface management-surface">
      <div className="surface-head"><div><span>GOAL PLANNING</span><h3>Monthly salesperson targets</h3></div><div className="head-actions"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><button className="primary-action" onClick={openCreate}><Plus size={16} />Set target</button></div></div>
      {targets.data?.length ? <div className="management-list">{targets.data.map((target) => <article key={target.id}><div><strong>{displayPerson(target, "Workspace target")}</strong><small>{target.month} · updated {new Date(target.updatedAt).toLocaleDateString("en-CA")}</small></div><div className="rule-rates"><span>Retail <b>{target.retailTarget}</b></span><span>Wholesale <b>{target.wholesaleTarget}</b></span><span>Gross <b>{currency(target.grossProfitTargetCents)}</b></span></div><button className="small-action" onClick={() => openEdit(target)}><Pencil size={14} />Edit</button></article>)}</div> : <div className="empty-state"><Target /><strong>No targets for {month}</strong><span>Set a workspace or salesperson target.</span></div>}
    </section>}
    <WorkflowModal open={modalOpen} eyebrow="PERFORMANCE PLANNING" title={editing ? "Edit monthly target" : "Set monthly target"} description="Targets are unique per workspace, salesperson, and month." busy={save.isPending} onClose={() => { if (!save.isPending) setModalOpen(false); }}>
      <form className="workflow-form" onSubmit={submit}><div className="form-grid">
        <label>Month<input required type="month" disabled={Boolean(editing)} value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} /></label>
        <label>Applies to<select disabled={Boolean(editing)} value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}><option value="">Workspace-wide target</option>{bootstrap.data?.team.filter((member) => member.isActive && member.role === "employee").map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>
        <label>Retail deals<input required type="number" min="0" max="1000" step="1" value={form.retailTarget} onChange={(event) => setForm({ ...form, retailTarget: event.target.value })} /></label>
        <label>Wholesale deals<input required type="number" min="0" max="1000" step="1" value={form.wholesaleTarget} onChange={(event) => setForm({ ...form, wholesaleTarget: event.target.value })} /></label>
        <label className="form-span">Gross profit target (CAD)<input required type="number" min="0" max="20000000" step=".01" value={form.grossProfitTarget} onChange={(event) => setForm({ ...form, grossProfitTarget: event.target.value })} /></label>
      </div><footer className="modal-actions"><button type="button" className="filter-button" disabled={save.isPending} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="primary-action" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save target"}</button></footer></form>
    </WorkflowModal>
  </div>;
}

export function AnalyticsPage() {
  const summary = useSummary();
  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="Analytics are unavailable." />;
  const conversion = summary.data?.leads.total ? Math.round(summary.data.leads.converted / summary.data.leads.total * 100) : 0;
  const sales = summary.data?.sales;
  const maximum = Math.max(sales?.revenueCents ?? 0, sales?.grossProfitCents ?? 0, sales?.commissionCents ?? 0, 1);
  const bars = [
    { label: "Funded revenue", value: sales?.revenueCents ?? 0 },
    { label: "Gross profit", value: sales?.grossProfitCents ?? 0 },
    { label: "Commission", value: sales?.commissionCents ?? 0 },
  ];
  return <div className="page-stack">
    <FeatureDashboard icon={BarChart3} eyebrow="DECISION SUPPORT" title="Performance analytics" description="Operational metrics are calculated server-side from indexed PostgreSQL records, not trusted browser totals." metrics={[{ label: "Lead conversion", value: `${conversion}%` }, { label: "Funded revenue", value: currency(sales?.revenueCents ?? 0) }, { label: "Gross profit", value: currency(sales?.grossProfitCents ?? 0) }]} />
    <section className="surface analytics-panel"><div className="surface-head"><div><span>MONTHLY VALUE FLOW</span><h3>Funded financial performance</h3></div></div><div className="metric-bars">{bars.map((item) => <div key={item.label}><header><span>{item.label}</span><strong>{currency(item.value)}</strong></header><div><i style={{ width: `${Math.max(item.value / maximum * 100, item.value ? 3 : 0)}%` }} /></div></div>)}</div></section>
  </div>;
}

function FeatureDashboard({ icon: Icon, eyebrow, title, description, metrics }: { icon: typeof UsersRound; eyebrow: string; title: string; description: string; metrics: Array<{ label: string; value: string }> }) {
  return <><section className="feature-hero"><div className="feature-icon"><Icon /></div><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></section><section className="feature-metrics">{metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</section></>;
}
