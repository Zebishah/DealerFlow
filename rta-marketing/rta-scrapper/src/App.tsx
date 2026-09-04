import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, BarChart3, Car, ChevronLeft, ChevronRight, Database, Gauge, Heart, Layers, Loader2, Play, Search, ServerCog, ShieldCheck, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, setCsrfToken } from "./lib/api";
import type { Capabilities, CatalogResponse, CatalogVehicle, DashboardSummary, UserSession, VehicleDetail } from "./types/platform";
import { formatMoney as money, formatNumber as number, formatRelativeTime as relative } from "./lib/format";
import { Empty, Loading, Metric, PanelTitle, RunTable, StatusPill } from "./components/presentation";
import { CompareView, VehicleCard, VehicleDetailDialog } from "./components/vehicles";

type View = "overview" | "catalog" | "operations" | "saved" | "compare";
const PAGE_SIZE = 12;

export function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [compare, setCompare] = useState<CatalogVehicle[]>([]);
  const [runMode, setRunMode] = useState<"fixture" | "live">("fixture");
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const summary = useQuery({ queryKey: ["dashboard"], queryFn: () => api<{ data: DashboardSummary }>("/dashboard/summary").then((r) => r.data), refetchInterval: (state) => state.state.data?.activeRuns ? 3_000 : 20_000 });
  const catalog = useQuery({ queryKey: ["catalog", query, source, sort, offset], queryFn: () => { const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort }); if (query) params.set("q", query); if (source) params.set("source", source); return api<CatalogResponse>(`/vehicles?${params}`); } });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => api<{ data: CatalogVehicle[] }>("/saved-vehicles").then((r) => r.data) });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: () => api<{ data: Capabilities }>("/auth/capabilities").then((r) => r.data) });
  const session = useQuery({ queryKey: ["session"], queryFn: async () => { const current = await api<{ data: UserSession }>("/auth/session"); const csrf = await api<{ data: { csrfToken: string } }>("/auth/csrf", { method: "POST" }); setCsrfToken(csrf.data.csrfToken); return current.data; }, retry: false });
  const vehicleDetail = useQuery({ queryKey: ["vehicle", selectedVehicleId], queryFn: () => api<{ data: VehicleDetail }>(`/vehicles/${selectedVehicleId}`).then((response) => response.data), enabled: Boolean(selectedVehicleId) });
  const login = useMutation({
    mutationFn: () => api<{ data: UserSession & { csrfToken: string } }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    onSuccess: async ({ data: loginData }) => { setCsrfToken(loginData.csrfToken); setPassword(""); setShowLogin(false); await queryClient.invalidateQueries({ queryKey: ["session"] }); toast.success("Operator session started"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const logout = useMutation({ mutationFn: () => api<void>("/auth/logout", { method: "POST" }), onSuccess: async () => { setCsrfToken(null); await queryClient.invalidateQueries({ queryKey: ["session"] }); toast.success("Signed out"); } });
  const createRun = useMutation({
    mutationFn: () => api<{ data: { id: string } }>("/scrape-runs", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ filters: query ? { keyword: query } : {}, mode: runMode }) }),
    onSuccess: async () => { toast.success(`${runMode === "live" ? "Live" : "Fixture"} run queued across enabled sources`); setView("operations"); await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveVehicle = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }) => api<void>(`/saved-vehicles/${id}`, { method: remove ? "DELETE" : "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["saved"] }), onError: (error: Error) => toast.error(error.message),
  });

  const savedIds = useMemo(() => new Set((saved.data ?? []).map((item) => item.vehicleId)), [saved.data]);
  const vehicles = view === "saved" ? (saved.data ?? []) : (catalog.data?.data ?? []);
  const nav: Array<{ id: View; label: string; icon: typeof Gauge }> = [
    { id: "overview", label: "Overview", icon: Gauge }, { id: "catalog", label: "Catalog", icon: Car },
    { id: "operations", label: "Operations", icon: Activity }, { id: "saved", label: "Saved", icon: Heart },
    { id: "compare", label: `Compare${compare.length ? ` (${compare.length})` : ""}`, icon: Layers },
  ];
  function submitSearch(event: FormEvent) { event.preventDefault(); setOffset(0); setQuery(search.trim()); setView("catalog"); }
  function toggleCompare(car: CatalogVehicle) { setCompare((items) => { if (items.some((item) => item.vehicleId === car.vehicleId)) return items.filter((item) => item.vehicleId !== car.vehicleId); if (items.length === 3) { toast.error("Compare up to three vehicles"); return items; } return [...items, car]; }); }
  const data = summary.data;
  const canRunLive = Boolean(capabilities.data?.liveScrapingAllowed && session.data?.user.role === "operator");
  function requestRun() { if (runMode === "live" && !canRunLive) { setShowLogin(true); return; } createRun.mutate(); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Car size={22} /></span><span>RTA <b>Intelligence</b></span></div>
      <div className="workspace"><small>WORKSPACE</small><strong>Vehicle market lab</strong><span>Portfolio environment</span></div>
      <nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={18} />{item.label}</button>)}</nav>
      <div className="system-card"><div><ShieldCheck size={17} /><strong>Demo-safe mode</strong></div><p>Fixture data is public. Live acquisition requires operator access.</p></div>
      <div className="sidebar-foot"><span className="online-dot" />{summary.isSuccess ? "API connected" : summary.isError ? "API unavailable" : "Checking system status"}</div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><p>Vehicle intelligence platform</p><h1>{nav.find((item) => item.id === view)?.label}</h1></div><div className="top-actions"><span className="environment"><i /> {runMode.toUpperCase()}</span><select aria-label="Acquisition mode" value={runMode} onChange={(event) => setRunMode(event.target.value as "fixture" | "live")}><option value="fixture">Fixture mode</option><option value="live" disabled={!capabilities.data?.liveScrapingAllowed}>Live mode</option></select>{session.data ? <button className="text-button" onClick={() => logout.mutate()}>{session.data.user.email}</button> : <button className="text-button" onClick={() => setShowLogin(true)}>Operator login</button>}<button className="primary-button" disabled={createRun.isPending} onClick={requestRun}>{createRun.isPending ? <Loader2 className="spin" size={17} /> : <Play size={17} />}Run acquisition</button></div></header>
      <section className="content">
        {summary.isError && <div className="error-banner"><AlertCircle size={18} />API is unavailable. Confirm VITE_API_URL and that the backend is running.</div>}
        {view === "overview" && <>
          <div className="hero-panel"><div><span className="kicker"><Sparkles size={15} /> MARKET SIGNALS, NORMALIZED</span><h2>One reliable view of Ontario vehicle inventory.</h2><p>Acquire listings asynchronously, deduplicate vehicles, and follow source health without blocking a browser request.</p></div><form className="hero-search" onSubmit={submitSearch}><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search make, model, or keyword" /><button>Explore catalog</button></form></div>
          <div className="metrics-grid"><Metric icon={Car} label="Active listings" value={number(data?.activeListings ?? 0)} note={`${number(data?.canonicalVehicles ?? 0)} canonical vehicles`} /><Metric icon={BarChart3} label="Average price" value={money(data?.averagePriceCents ?? null)} note="Across active inventory" /><Metric icon={Activity} label="Successful runs" value={number(data?.successfulRuns ?? 0)} note={`${data?.activeRuns ?? 0} currently active`} /><Metric icon={Database} label="Enabled sources" value={`${data?.sourceHealth.filter((s) => s.enabled).length ?? 0}/${data?.sourceHealth.length ?? 0}`} note="Configured acquisition adapters" /></div>
          <div className="two-column"><section className="panel"><PanelTitle title="Source health" subtitle="Live operational status across adapters" /><div className="source-list">{(data?.sourceHealth ?? []).map((item) => <div className="source-row" key={item.key}><div className="source-logo">{item.name.slice(0, 2).toUpperCase()}</div><div><strong>{item.name}</strong><span>Last success {relative(item.lastSuccessAt)}</span></div><StatusPill status={item.latestStatus} /></div>)}</div></section><section className="panel"><PanelTitle title="Recent runs" subtitle="Durable work tracked by source" action={() => setView("operations")} /><RunTable runs={data?.recentRuns ?? []} compact /></section></div>
        </>}
        {(view === "catalog" || view === "saved") && <>
          <div className="toolbar"><form className="catalog-search" onSubmit={submitSearch}><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the normalized catalog" /></form>{view === "catalog" && <><select value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }}><option value="">All sources</option>{(data?.sourceHealth ?? []).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Recently seen</option><option value="price_asc">Price: low first</option><option value="price_desc">Price: high first</option><option value="year_desc">Newest model year</option></select></>}</div>
          <div className="section-heading"><div><h2>{view === "saved" ? "Your shortlist" : "Normalized inventory"}</h2><p>{view === "saved" ? `${vehicles.length} vehicles saved in this workspace` : `${number(catalog.data?.page.total ?? 0)} source listings available`}</p></div></div>
          {catalog.isLoading && view === "catalog" ? <Loading /> : vehicles.length === 0 ? <Empty title={view === "saved" ? "No saved vehicles yet" : "No listings match these filters"} /> : <div className="vehicle-grid">{vehicles.map((car) => <VehicleCard key={`${car.listingId}-${car.vehicleId}`} car={car} saved={savedIds.has(car.vehicleId)} compared={compare.some((item) => item.vehicleId === car.vehicleId)} onSave={() => saveVehicle.mutate({ id: car.vehicleId, remove: savedIds.has(car.vehicleId) })} onCompare={() => toggleCompare(car)} onView={() => setSelectedVehicleId(car.vehicleId)} />)}</div>}
          {view === "catalog" && (catalog.data?.page.total ?? 0) > PAGE_SIZE && <div className="pagination"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} />Previous</button><span>{Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil((catalog.data?.page.total ?? 0) / PAGE_SIZE)}</span><button disabled={!catalog.data?.page.hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>Next<ChevronRight size={17} /></button></div>}
        </>}
        {view === "operations" && <section className="panel operations-panel"><PanelTitle title="Acquisition runs" subtitle="SQS-backed jobs continue independently of HTTP requests" /><div className="operations-callout"><ServerCog size={22} /><div><strong>Asynchronous by design</strong><p>The API publishes one job per source. Workers retry temporary failures while every result is stored idempotently.</p></div><button className="primary-button" onClick={requestRun} disabled={createRun.isPending}><Play size={16} />New {runMode} run</button></div><RunTable runs={data?.recentRuns ?? []} /></section>}
        {view === "compare" && <CompareView items={compare} remove={(id) => setCompare((items) => items.filter((item) => item.vehicleId !== id))} />}
      </section>
    </main>
    {showLogin && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowLogin(false)}><form className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); login.mutate(); }}><button type="button" className="remove-compare" aria-label="Close login" onClick={() => setShowLogin(false)}><X size={17} /></button><ShieldCheck size={26} /><h2 id="login-title">Operator access</h2><p>Sign in to enable protected live acquisition controls.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button className="primary-button" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button></form></div>}
    {selectedVehicleId && <VehicleDetailDialog detail={vehicleDetail.data} loading={vehicleDetail.isLoading} onClose={() => setSelectedVehicleId(null)} />}
  </div>;
}
