import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Car as CarFront, Database, Loader2 as LoaderCircle, Play, Search, ServerCog } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";
import { api, idempotentJson } from "../lib/api";
import type { CatalogVehicle, IntelligenceSummary } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const currency = (cents: number | null) => cents === null ? "Price unavailable" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const summary = useQuery({ queryKey: ["intelligence", "summary"], queryFn: () => api<{ data: IntelligenceSummary }>("/dashboard/summary").then((result) => result.data) });
  const catalog = useQuery({ queryKey: ["catalog", search, source], queryFn: () => { const params = new URLSearchParams({ limit: "24", sort: "newest" }); if (search) params.set("q", search); if (source) params.set("source", source); return api<{ data: CatalogVehicle[]; page: { total: number } }>(`/vehicles?${params}`); } });
  if (catalog.isLoading) return <PageSkeleton />;
  if (catalog.isError) return <ErrorState message="The normalized inventory catalog is unavailable." />;
  return <div className="page-stack"><section className="intelligence-banner"><div><span>MARKET INTELLIGENCE</span><h2>Search every acquired listing from one reliable catalog.</h2><p>Source records are validated, normalized, deduplicated, and retained with provenance.</p></div><div><Database /><strong>{catalog.data?.page.total ?? 0}</strong><span>active source listings</span></div></section><section className="page-toolbar"><div className="search-control"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search make, model, trim, or keyword" /></div><select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All acquisition sources</option>{summary.data?.sourceHealth.map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}</select></section>{catalog.data?.data.length ? <section className="vehicle-grid">{catalog.data.data.map((car) => <article className="vehicle-card" key={car.listingId}><div className="vehicle-photo">{car.imageUrl ? <img src={car.imageUrl} alt={`${car.year} ${car.make} ${car.model}`} loading="lazy" /> : <CarFront size={42} />}<span>{car.sourceName}</span></div><div className="vehicle-info"><small>{car.isUsed ? "PRE-OWNED" : "NEW"} · {car.year}</small><h3>{car.make} {car.model}</h3><p>{car.trim ?? car.title}</p><strong>{currency(car.priceCents)}</strong><div><span>{car.odometerKm === null ? "Mileage unavailable" : `${car.odometerKm.toLocaleString()} km`}</span><span>{car.location ?? "Ontario"}</span></div></div></article>)}</section> : <div className="empty-state surface"><CarFront /><strong>No inventory matches your search</strong><span>Run an acquisition or adjust the filters.</span></div>}</div>;
}

export function AcquisitionPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canRunLive = user?.role === "admin" || user?.role === "operator";
  const [mode, setMode] = useState<"fixture" | "live">(canRunLive ? "live" : "fixture");
  const [selectedSources, setSelectedSources] = useState<string[]>(["autotrader"]);
  const [filters, setFilters] = useState({
    make: "",
    model: "",
    keyword: "",
    minYear: "",
    maxYear: "",
    maxPrice: "",
    maxMileage: "",
    postalCode: "",
    radiusKm: "",
  });

  const summary = useQuery({
    queryKey: ["intelligence", "summary"],
    queryFn: () => api<{ data: IntelligenceSummary }>("/dashboard/summary").then((result) => result.data),
    refetchInterval: (query) => query.state.data?.activeRuns ? 3_000 : 15_000,
  });

  const run = useMutation({
    mutationFn: (idempotencyKey: string) => {
      const normalizedFilters = Object.fromEntries(
        Object.entries(filters)
          .filter(([, value]) => value.trim() !== "")
          .map(([key, value]) => [
            key,
            ["minYear", "maxYear", "maxPrice", "maxMileage", "radiusKm"].includes(key) ? Number(value) : value.trim(),
          ]),
      );
      return api("/scrape-runs", idempotentJson("POST", {
        mode,
        sources: selectedSources,
        filters: normalizedFilters,
      }, idempotencyKey));
    },
    onSuccess: async () => {
      toast.success(`${mode === "live" ? "Live" : "Fixture"} acquisition queued for ${selectedSources.length} source${selectedSources.length === 1 ? "" : "s"}`);
      await queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: (runId: string) => api(`/scrape-runs/${runId}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      toast.success("Acquisition cancellation requested");
      await queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSource(key: string, allowed: boolean) {
    if (!allowed) return;
    setSelectedSources((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function changeMode(nextMode: "fixture" | "live") {
    if (nextMode === "live" && !canRunLive) return;
    setMode(nextMode);
    if (nextMode === "live") {
      const liveKeys = new Set(summary.data?.sourceHealth.filter((source) => source.liveEnabled).map((source) => source.key));
      setSelectedSources((current) => current.filter((key) => liveKeys.has(key)));
    }
  }

  if (summary.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState message="Acquisition status is unavailable." />;

  const availableSources = summary.data?.sourceHealth ?? [];

  return <div className="page-stack">
    <section className="operations-hero">
      <div><span>ASYNCHRONOUS ACQUISITION</span><h2>Run source adapters without tying work to an HTTP request.</h2><p>The API persists the run and transactional outbox records before a dispatcher publishes one SQS message for each selected source.</p></div>
      <div className="run-control">
        <label>Acquisition mode
          <select value={mode} onChange={(event) => changeMode(event.target.value as "fixture" | "live")}>
            {canRunLive && <option value="live">Live websites</option>}
            <option value="fixture">Verified fixtures</option>
          </select>
        </label>
        <button onClick={() => run.mutate(crypto.randomUUID())} disabled={run.isPending || selectedSources.length === 0}>
          {run.isPending ? <LoaderCircle className="spin" /> : <Play />}
          {selectedSources.length ? `Queue ${selectedSources.length} source${selectedSources.length === 1 ? "" : "s"}` : "Select a source"}
        </button>
      </div>
    </section>

    {mode === "live" && <div className="warning-banner"><AlertTriangle /><span><strong>Live mode contacts third-party websites.</strong> Validate one source at a time first, use conservative delays, and respect source terms and access controls.</span></div>}

    <section className="surface acquisition-filters">
      <div className="surface-head"><div><span>SEARCH SCOPE</span><h3>Optional acquisition filters</h3></div><button className="filter-button" onClick={() => setFilters({ make: "", model: "", keyword: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "", postalCode: "", radiusKm: "" })}>Clear filters</button></div>
      <div className="compact-form-grid">
        <label>Make<input value={filters.make} onChange={(event) => setFilters({ ...filters, make: event.target.value })} placeholder="Volkswagen" /></label>
        <label>Model<input value={filters.model} onChange={(event) => setFilters({ ...filters, model: event.target.value })} placeholder="Tiguan" /></label>
        <label>Keyword<input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="Comfortline" /></label>
        <label>Minimum year<input type="number" min="1980" max={new Date().getFullYear() + 1} value={filters.minYear} onChange={(event) => setFilters({ ...filters, minYear: event.target.value })} /></label>
        <label>Maximum year<input type="number" min="1980" max={new Date().getFullYear() + 1} value={filters.maxYear} onChange={(event) => setFilters({ ...filters, maxYear: event.target.value })} /></label>
        <label>Maximum price (CAD)<input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} /></label>
        <label>Maximum mileage (km)<input type="number" min="0" value={filters.maxMileage} onChange={(event) => setFilters({ ...filters, maxMileage: event.target.value })} /></label>
        <label>Postal code<input maxLength={7} value={filters.postalCode} onChange={(event) => setFilters({ ...filters, postalCode: event.target.value.toUpperCase() })} placeholder="M5V 3A8" /></label>
        <label>Radius (km)<input type="number" min="10" max="500" value={filters.radiusKm} onChange={(event) => setFilters({ ...filters, radiusKm: event.target.value })} /></label>
      </div>
    </section>

    <section className="operations-grid">
      <article className="surface">
        <div className="surface-head"><div><span>SOURCE SELECTION</span><h3>Acquisition adapters</h3></div><small>{selectedSources.length}/{availableSources.length} selected</small></div>
        <div className="source-list">
          {availableSources.map((source) => {
            const allowed = source.enabled && (mode === "fixture" || source.liveEnabled);
            const selected = selectedSources.includes(source.key);
            return <button type="button" className={`source-item source-choice ${selected ? "selected" : ""}`} key={source.key} disabled={!allowed} onClick={() => toggleSource(source.key, allowed)}>
              <span className="source-check">{selected ? "✓" : ""}</span>
              <div><strong>{source.name}</strong><small>{allowed ? mode === "live" ? "Live acquisition enabled" : "Fixture adapter available" : mode === "live" ? "Live acquisition disabled" : "Source disabled"}</small></div>
              <span className={`status-chip ${source.latestStatus ?? "idle"}`}>{source.latestStatus ?? "idle"}</span>
            </button>;
          })}
        </div>
      </article>

      <article className="surface">
        <div className="surface-head"><div><span>RECENT RUNS</span><h3>Durable job history</h3></div></div>
        <div className="run-list">
          {summary.data?.recentRuns.map((item) => <div className="run-item" key={item.id}>
            <ServerCog />
            <div><strong>RUN-{item.id.slice(0, 8).toUpperCase()}</strong><small>{item.mode} · {new Date(item.createdAt).toLocaleString("en-CA")}</small><div className="progress-bar"><i style={{ width: `${item.sourceCount ? item.completedSourceCount / item.sourceCount * 100 : 0}%` }} /></div></div>
            <div className="run-status-actions"><span className={`status-chip ${item.status}`}>{item.status}</span>{canRunLive && ["queued", "running"].includes(item.status) && <button disabled={cancel.isPending} onClick={() => cancel.mutate(item.id)}>Cancel</button>}</div>
          </div>)}
        </div>
      </article>
    </section>

    <section className="architecture-note"><Activity /><div><strong>Production-shaped local verification</strong><p>Local and Lambda workers consume the same SQS contract and execute the same validation, normalization, retry, and idempotent database-upsert code.</p></div></section>
  </div>;
}
