import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, ArrowRight, BarChart3, Car, Check, ChevronLeft, ChevronRight, Database, Gauge, Heart, Layers, Loader2, Play, Search, ServerCog, ShieldCheck, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, setCsrfToken } from "./lib/api";
import type { Capabilities, CatalogResponse, CatalogVehicle, DashboardSummary, ScrapeRun, UserSession } from "./types/platform";

type View = "overview" | "catalog" | "operations" | "saved" | "compare";
const PAGE_SIZE = 12;
const money = (cents: number | null) => cents === null ? "Price unavailable" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
const number = (value: number) => new Intl.NumberFormat("en-CA").format(value);
const relative = (value: string | null) => {
  if (!value) return "No run yet";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

function StatusPill({ status }: { status: string | null }) {
  const normalized = status ?? "idle";
  return <span className={`status status-${normalized}`}><i />{normalized.replace("_", " ")}</span>;
}

function VehicleCard({ car, saved, compared, onSave, onCompare }: { car: CatalogVehicle; saved: boolean; compared: boolean; onSave: () => void; onCompare: () => void }) {
  return <article className="vehicle-card">
    <div className="vehicle-image">
      {car.imageUrl ? <img src={car.imageUrl} alt="" loading="lazy" /> : <Car size={46} />}
      <span className="source-badge">{car.sourceName}</span>
      <button className={`icon-button ${saved ? "active" : ""}`} onClick={onSave} aria-label="Save vehicle"><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="vehicle-body">
      <div className="vehicle-eyebrow"><span>{car.isUsed ? "Pre-owned" : "New"}</span><span>Updated {relative(car.lastSeenAt)}</span></div>
      <h3>{car.year} {car.make} {car.model}</h3><p className="trim">{car.trim || car.title}</p>
      <div className="vehicle-price">{money(car.priceCents)}</div>
      <div className="vehicle-meta"><span>{car.odometerKm === null ? "Mileage n/a" : `${number(car.odometerKm)} km`}</span><span>{car.location || "Ontario"}</span></div>
      <div className="card-actions">
        <button className={`compare-button ${compared ? "selected" : ""}`} onClick={onCompare}>{compared ? <Check size={15} /> : <Layers size={15} />}{compared ? "Added" : "Compare"}</button>
        <button className="text-button">View intelligence <ArrowRight size={15} /></button>
      </div>
    </div>
  </article>;
}

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

  const summary = useQuery({ queryKey: ["dashboard"], queryFn: () => api<{ data: DashboardSummary }>("/dashboard/summary").then((r) => r.data), refetchInterval: (state) => state.state.data?.activeRuns ? 3_000 : 20_000 });
  const catalog = useQuery({ queryKey: ["catalog", query, source, sort, offset], queryFn: () => { const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort }); if (query) params.set("q", query); if (source) params.set("source", source); return api<CatalogResponse>(`/vehicles?${params}`); } });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => api<{ data: CatalogVehicle[] }>("/saved-vehicles").then((r) => r.data) });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: () => api<{ data: Capabilities }>("/auth/capabilities").then((r) => r.data) });
  const session = useQuery({ queryKey: ["session"], queryFn: async () => { const current = await api<{ data: UserSession }>("/auth/session"); const csrf = await api<{ data: { csrfToken: string } }>("/auth/csrf", { method: "POST" }); setCsrfToken(csrf.data.csrfToken); return current.data; }, retry: false });
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
      <div className="sidebar-foot"><span className="online-dot" />All systems operational</div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><p>Vehicle intelligence platform</p><h1>{nav.find((item) => item.id === view)?.label}</h1></div><div className="top-actions"><span className="environment"><i /> {runMode.toUpperCase()}</span><select aria-label="Acquisition mode" value={runMode} onChange={(event) => setRunMode(event.target.value as "fixture" | "live")}><option value="fixture">Fixture mode</option><option value="live" disabled={!capabilities.data?.liveScrapingAllowed}>Live mode</option></select>{session.data ? <button className="text-button" onClick={() => logout.mutate()}>{session.data.user.email}</button> : <button className="text-button" onClick={() => setShowLogin(true)}>Operator login</button>}<button className="primary-button" disabled={createRun.isPending} onClick={requestRun}>{createRun.isPending ? <Loader2 className="spin" size={17} /> : <Play size={17} />}Run acquisition</button></div></header>
      <section className="content">
        {summary.isError && <div className="error-banner"><AlertCircle size={18} />API is unavailable. Confirm VITE_API_URL and that the backend is running.</div>}
        {view === "overview" && <>
          <div className="hero-panel"><div><span className="kicker"><Sparkles size={15} /> MARKET SIGNALS, NORMALIZED</span><h2>One reliable view of Ontario vehicle inventory.</h2><p>Acquire listings asynchronously, deduplicate vehicles, and follow source health without blocking a browser request.</p></div><form className="hero-search" onSubmit={submitSearch}><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search make, model, or keyword" /><button>Explore catalog</button></form></div>
          <div className="metrics-grid"><Metric icon={Car} label="Active listings" value={number(data?.activeListings ?? 0)} note={`${number(data?.canonicalVehicles ?? 0)} canonical vehicles`} /><Metric icon={BarChart3} label="Average price" value={money(data?.averagePriceCents ?? null)} note="Across active inventory" /><Metric icon={Activity} label="Successful runs" value={number(data?.successfulRuns ?? 0)} note={`${data?.activeRuns ?? 0} currently active`} /><Metric icon={Database} label="Sources online" value={`${data?.sourceHealth.filter((s) => s.enabled).length ?? 0}/4`} note="Validated adapters" /></div>
          <div className="two-column"><section className="panel"><PanelTitle title="Source health" subtitle="Live operational status across adapters" /><div className="source-list">{(data?.sourceHealth ?? []).map((item) => <div className="source-row" key={item.key}><div className="source-logo">{item.name.slice(0, 2).toUpperCase()}</div><div><strong>{item.name}</strong><span>Last success {relative(item.lastSuccessAt)}</span></div><StatusPill status={item.latestStatus} /></div>)}</div></section><section className="panel"><PanelTitle title="Recent runs" subtitle="Durable work tracked by source" action={() => setView("operations")} /><RunTable runs={data?.recentRuns ?? []} compact /></section></div>
        </>}
        {(view === "catalog" || view === "saved") && <>
          <div className="toolbar"><form className="catalog-search" onSubmit={submitSearch}><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the normalized catalog" /></form>{view === "catalog" && <><select value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }}><option value="">All sources</option>{(data?.sourceHealth ?? []).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Recently seen</option><option value="price_asc">Price: low first</option><option value="price_desc">Price: high first</option><option value="year_desc">Newest model year</option></select></>}</div>
          <div className="section-heading"><div><h2>{view === "saved" ? "Your shortlist" : "Normalized inventory"}</h2><p>{view === "saved" ? `${vehicles.length} vehicles saved to this browser session` : `${number(catalog.data?.page.total ?? 0)} source listings available`}</p></div></div>
          {catalog.isLoading && view === "catalog" ? <Loading /> : vehicles.length === 0 ? <Empty title={view === "saved" ? "No saved vehicles yet" : "No listings match these filters"} /> : <div className="vehicle-grid">{vehicles.map((car) => <VehicleCard key={`${car.listingId}-${car.vehicleId}`} car={car} saved={savedIds.has(car.vehicleId)} compared={compare.some((item) => item.vehicleId === car.vehicleId)} onSave={() => saveVehicle.mutate({ id: car.vehicleId, remove: savedIds.has(car.vehicleId) })} onCompare={() => toggleCompare(car)} />)}</div>}
          {view === "catalog" && (catalog.data?.page.total ?? 0) > PAGE_SIZE && <div className="pagination"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} />Previous</button><span>{Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil((catalog.data?.page.total ?? 0) / PAGE_SIZE)}</span><button disabled={!catalog.data?.page.hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>Next<ChevronRight size={17} /></button></div>}
        </>}
        {view === "operations" && <section className="panel operations-panel"><PanelTitle title="Acquisition runs" subtitle="SQS-backed jobs continue independently of HTTP requests" /><div className="operations-callout"><ServerCog size={22} /><div><strong>Asynchronous by design</strong><p>The API publishes one job per source. Workers retry temporary failures while every result is stored idempotently.</p></div><button className="primary-button" onClick={requestRun} disabled={createRun.isPending}><Play size={16} />New {runMode} run</button></div><RunTable runs={data?.recentRuns ?? []} /></section>}
        {view === "compare" && <CompareView items={compare} remove={(id) => setCompare((items) => items.filter((item) => item.vehicleId !== id))} />}
      </section>
    </main>
    {showLogin && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowLogin(false)}><form className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); login.mutate(); }}><button type="button" className="remove-compare" aria-label="Close login" onClick={() => setShowLogin(false)}><X size={17} /></button><ShieldCheck size={26} /><h2 id="login-title">Operator access</h2><p>Sign in to enable protected live acquisition controls.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button className="primary-button" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button></form></div>}
  </div>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Gauge; label: string; value: string; note: string }) { return <div className="metric-card"><div className="metric-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>; }
function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: () => void }) { return <div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={action}>View all <ArrowRight size={15} /></button>}</div>; }
function RunTable({ runs, compact = false }: { runs: ScrapeRun[]; compact?: boolean }) { if (!runs.length) return <Empty title="No acquisition runs yet" />; return <div className="run-list">{runs.slice(0, compact ? 4 : 10).map((run) => <div className="run-row" key={run.id}><div className="run-id"><strong>RUN-{run.id.slice(0, 8).toUpperCase()}</strong><span>{relative(run.createdAt)} · {run.mode}</span></div><div className="run-progress"><div><span>{run.completedSourceCount}/{run.sourceCount} sources</span><span>{run.discoveredCount} listings</span></div><div className="progress-track"><i style={{ width: `${run.sourceCount ? (run.completedSourceCount / run.sourceCount) * 100 : 0}%` }} /></div></div><StatusPill status={run.status} /></div>)}</div>; }
function CompareView({ items, remove }: { items: CatalogVehicle[]; remove: (id: string) => void }) { return <section className="panel"><PanelTitle title="Vehicle comparison" subtitle="Evaluate up to three normalized vehicles side by side" />{items.length === 0 ? <Empty title="Choose vehicles from the catalog to compare" /> : <div className="compare-grid">{items.map((car) => <div className="compare-column" key={car.vehicleId}><button className="remove-compare" onClick={() => remove(car.vehicleId)}><X size={16} /></button><div className="compare-title"><span>{car.year}</span><h3>{car.make} {car.model}</h3><p>{car.trim || "Standard trim"}</p></div><dl><div><dt>Best price</dt><dd>{money(car.priceCents)}</dd></div><div><dt>Mileage</dt><dd>{car.odometerKm === null ? "n/a" : `${number(car.odometerKm)} km`}</dd></div><div><dt>Dealer</dt><dd>{car.dealerName || "Not supplied"}</dd></div><div><dt>Source</dt><dd>{car.sourceName}</dd></div><div><dt>Condition</dt><dd>{car.isUsed ? "Pre-owned" : "New"}</dd></div></dl></div>)}</div>}</section>; }
function Loading() { return <div className="loading"><Loader2 className="spin" />Loading market intelligence…</div>; }
function Empty({ title }: { title: string }) { return <div className="empty"><Car size={34} /><strong>{title}</strong><span>Run fixture acquisition to populate a safe public demo.</span></div>; }
