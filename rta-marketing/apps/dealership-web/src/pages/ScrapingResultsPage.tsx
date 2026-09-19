import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Car, Database, Gauge, RefreshCw, Server, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { ScrapedVehicleCard, ScrapedVehicleDetailsModal } from "../components/ScrapedVehicleCard";
import { api, ApiError } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import type { OperationalHealth, OperationalSourceHealth, ScrapedListing, ScrapingResultsResponse, ScrapingSite, ScrapingStatusResponse } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

function displaySiteName(name: string): string {
  return name.replace(/^Demo Source \(synthetic data\)$/i, "Generated inventory");
}

function activeStatusLabel(status: NonNullable<ScrapingStatusResponse["data"]["activeJob"]>["status"]): string {
  if (status === "scraping") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Queued";
}

function isActiveStatus(status: string | undefined): boolean {
  return status === "queued" || status === "scraping";
}

export function ScrapingResultsPage() {
  const { user } = useAuth();
  const canTrigger = user?.role === "admin" || user?.role === "operator" || user?.role === "recruiter";
  const sourceHealth = useQuery({
    queryKey: ["operations", "source-health"],
    queryFn: () => api<{ data: OperationalSourceHealth[] }>("/operations/source-health"),
    enabled: Boolean(canTrigger),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const systemHealth = useQuery({
    queryKey: ["operations", "health"],
    queryFn: () => api<{ data: OperationalHealth }>("/operations/health"),
    enabled: Boolean(canTrigger),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const [filters, setFilters] = useState({ q: "", siteId: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "" });
  const [selectedItem, setSelectedItem] = useState<ScrapedListing | null>(null);
  const appliedFilters = useDebouncedValue(filters);
  const pendingRunId = useRef<string | null>(null);
  const results = useQuery({
    queryKey: ["scraping-results", appliedFilters],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "48" });
      if (appliedFilters.q.trim()) params.set("q", appliedFilters.q.trim());
      if (appliedFilters.siteId) params.set("siteId", appliedFilters.siteId);
      if (appliedFilters.minYear) params.set("minYear", appliedFilters.minYear);
      if (appliedFilters.maxYear) params.set("maxYear", appliedFilters.maxYear);
      if (appliedFilters.maxPrice) params.set("maxPrice", appliedFilters.maxPrice);
      if (appliedFilters.maxMileage) params.set("maxMileage", appliedFilters.maxMileage);
      return api<ScrapingResultsResponse>(`/scraping-results?${params.toString()}`);
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const scrapeStatus = useQuery({
    queryKey: ["scraping-status"],
    queryFn: () => api<ScrapingStatusResponse>("/scraping-results/status"),
    refetchInterval: (query) => isActiveStatus(query.state.data?.data.activeJob?.status) ? 4_000 : 30_000,
    refetchIntervalInBackground: false,
  });
  const activeJob = scrapeStatus.data?.data.activeJob ?? null;
  const scraperBusy = isActiveStatus(activeJob?.status);
  const trigger = useMutation({
    mutationFn: (siteId: number) => api<{ data: { jobId: string; runId: string; siteName: string } }>(`/scraping-results/${siteId}/trigger`, { method: "POST", body: JSON.stringify({ limit: 10 }) }),
    onSuccess: async (value) => {
      pendingRunId.current = value.data.runId || value.data.jobId;
      toast.success(`${displaySiteName(value.data.siteName)} queued`);
      await scrapeStatus.refetch();
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? `${error.code}: ${error.message}` : error.message);
    },
  });

  useEffect(() => {
    if (!activeJob || pendingRunId.current !== activeJob.runId || isActiveStatus(activeJob.status)) return;
    pendingRunId.current = null;
    void results.refetch();
    if (activeJob.status === "completed") {
      toast.success(`${displaySiteName(activeJob.siteKey)} scrape completed — ${activeJob.foundCount ?? 0} vehicles found`);
    } else {
      toast.error(`${displaySiteName(activeJob.siteKey)} scrape ${activeJob.status}: ${activeJob.failedReason ?? "The scrape did not complete."}`);
    }
  }, [activeJob, results]);

  if (results.isLoading) return <PageSkeleton />;
  if (results.isError || !results.data) return <ErrorState message={results.error instanceof Error ? results.error.message : "Scraping results are unavailable."} />;

  const { items, sites } = results.data.data;
  const healthRows = Array.isArray(sourceHealth.data?.data) ? sourceHealth.data.data : [];
  const healthBySource = new Map(healthRows.map((health) => [health.source, health]));
  const total = results.data.page.total;
  const clearFilters = () => setFilters({ q: "", siteId: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "" });
  const statusError = scrapeStatus.error instanceof ApiError ? `${scrapeStatus.error.code}: ${scrapeStatus.error.message}` : scrapeStatus.error instanceof Error ? scrapeStatus.error.message : null;

  return <div className="page-stack">
    <section className="operations-hero scraping-results-hero">
      <div><span>SCRAPING WORKSPACE</span><h2>Search approved international vehicle inventory.</h2><p>Live luxury vehicle inventory collected from approved international sources through the Apify scraping pipeline and persisted in Neon.</p></div>
      <div className="run-control scraping-hero-stats"><span>SAVED LISTINGS</span><strong>{total}</strong><small>{sites.length} scraping sites configured</small><button className="hero-secondary-action" onClick={() => results.refetch()}><RefreshCw size={14} />Refresh results</button></div>
    </section>

    {statusError && <div className="warning-banner" role="alert"><AlertTriangle size={18} /><span><strong>Scraping status unavailable.</strong> {statusError}</span></div>}
    {activeJob && <div className="warning-banner" role="status"><AlertTriangle size={18} /><span><strong>{activeStatusLabel(activeJob.status)}: {displaySiteName(activeJob.siteKey)}.</strong> {isActiveStatus(activeJob.status) ? `Up to ${activeJob.limit} vehicles are being collected.` : `${activeJob.foundCount ?? 0} vehicles found.`} {activeJob.progressStage ? `${activeJob.progressStage} · ` : ""}{activeJob.failedReason ?? ""}</span></div>}

    <SystemHealthPanel health={systemHealth.data?.data} loading={systemHealth.isLoading} error={systemHealth.isError} onRefresh={() => void systemHealth.refetch()} />

    <section className="surface scraping-filter-panel">
      <div className="surface-head"><div><span>SEARCH SCOPE</span><h3>Vehicle and site filters</h3></div><button className="filter-button" type="button" onClick={clearFilters}>Clear filters</button></div>
      <div className="scraping-filter-grid">
        <label className="scraping-search-field">Car name or keyword<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Ferrari Roma" /></label>
        <label>Scraping site<select value={filters.siteId} onChange={(event) => setFilters({ ...filters, siteId: event.target.value })}><option value="">All sites</option>{sites.map((site) => <option value={site.id} key={site.id}>{displaySiteName(site.name)}</option>)}</select></label>
        <label>Minimum year<input type="number" min="1980" value={filters.minYear} onChange={(event) => setFilters({ ...filters, minYear: event.target.value })} /></label>
        <label>Maximum year<input type="number" min="1980" value={filters.maxYear} onChange={(event) => setFilters({ ...filters, maxYear: event.target.value })} /></label>
        <label>Maximum price<input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} placeholder="500000" /></label>
        <label>Maximum mileage<input type="number" min="0" value={filters.maxMileage} onChange={(event) => setFilters({ ...filters, maxMileage: event.target.value })} placeholder="120000" /></label>
      </div>
    </section>

    <section className="operations-grid scraping-log-grid">
      <article className="surface"><div className="surface-head"><div><span>SOURCE HEALTH</span><h3>Scraping sites</h3></div><RefreshCw size={16} className={results.isFetching || sourceHealth.isFetching ? "spin" : ""} /></div><div className="source-list">{sites.map((site) => <SourceRow key={site.id} site={site} health={site.siteKey ? healthBySource.get(site.siteKey) : undefined} activeJob={activeJob} canTrigger={Boolean(canTrigger)} busy={scraperBusy || trigger.isPending} onTrigger={() => trigger.mutate(site.id)} />)}</div></article>
      <article className="surface"><div className="surface-head"><div><span>PIPELINE STATUS</span><h3>Recent scraper activity</h3></div><button className="filter-button" type="button" onClick={() => results.refetch()}>Refresh</button></div><div className="scraping-activity-list">{sites.map((site) => <div className="scraping-activity-row" key={site.id}><div><strong>{displaySiteName(site.name)}</strong><small>{site.lastScrapedAt ? new Date(site.lastScrapedAt).toLocaleString("en-CA") : "Waiting for first run"}</small></div><b>{site.itemCount}</b><span>records</span></div>)}</div></article>
    </section>

    <section className="surface data-surface"><div className="surface-head"><div><span>SCRAPED INVENTORY</span><h3>{total} matching listings</h3></div><small>{results.isFetching ? "Refreshing…" : "Persisted in Neon"}</small></div>{items.length ? <div className="scraping-result-grid">{items.map((item) => <ScrapedVehicleCard key={item.id} item={item} onDetails={() => setSelectedItem(item)} />)}</div> : <div className="empty-state"><Car /><strong>No listings match these filters</strong><span>Try clearing a filter or run a new scrape.</span></div>}</section>
    <ScrapedVehicleDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
  </div>;
}

function SourceRow({ site, health, activeJob, canTrigger, busy, onTrigger }: { site: ScrapingSite; health?: OperationalSourceHealth; activeJob: ScrapingStatusResponse["data"]["activeJob"]; canTrigger: boolean; busy: boolean; onTrigger: () => void }) {
  const live = site.executionProvider === "apify" && site.triggerable;
  const active = live && activeJob?.siteKey === site.siteKey && isActiveStatus(activeJob.status);
  const terminalStatus = live && activeJob?.siteKey === site.siteKey && !isActiveStatus(activeJob.status) ? activeStatusLabel(activeJob.status) : null;
  const healthLabel = health?.status === "healthy" ? "Healthy" : health?.status === "degraded" ? "Degraded" : health?.status === "failing" ? "Failing" : health?.status === "unknown" ? "Unknown" : null;
  const status = active ? activeStatusLabel(activeJob!.status) : terminalStatus ?? (live ? healthLabel ?? "connected" : "reference");
  const statusClass = active ? "queued" : live && health ? health.status : live ? "completed" : "";
  const diagnostic = health?.consecutiveFailures ? ` · ${health.consecutiveFailures} consecutive failures` : health?.lastDurationMs ? ` · ${Math.round(health.lastDurationMs / 1000)}s last run` : "";
  const telemetry = health ? `discovered ${formatMetric(health.recordsDiscovered)} · accepted ${formatMetric(health.recordsAccepted)} · rejected ${formatMetric(health.recordsRejected)} · parser ${health.parserVersion ?? "Not available"}` : "Telemetry not available";
  return <div className="source-item"><span className="source-monogram">{displaySiteName(site.name).slice(0, 2).toUpperCase()}</span><div><strong>{displaySiteName(site.name)}</strong><small>{site.itemCount.toLocaleString()} stored listings{site.lastScrapedAt ? ` · last run ${new Date(site.lastScrapedAt).toLocaleString("en-CA")}` : " · not run yet"}{diagnostic}</small><small className="source-telemetry">{telemetry}</small></div><span className={`status-chip ${statusClass}`}>{status}</span><button className="scrape-now-button" type="button" disabled={!canTrigger || !live || busy} onClick={onTrigger}>{active ? status : live ? "Scrape now" : "Reference only"}</button></div>;
}

function formatMetric(value: number | null): string {
  return value === null ? "Not available" : value.toLocaleString("en-CA");
}

function SystemHealthPanel({ health, loading, error, onRefresh }: { health?: OperationalHealth; loading: boolean; error: boolean; onRefresh: () => void }) {
  const database = health?.database;
  const redis = health?.redis;
  const apify = health?.apify;
  const ai = health?.ai;
  const dependencyStatus = health?.status === "healthy" ? "Healthy" : health?.status === "degraded" ? "Degraded" : health?.status === "unavailable" ? "Unavailable" : "Checking";
  const cards = [
    { label: "Database", value: database ? database.reachable ? "Healthy" : "Unavailable" : dependencyStatus, detail: database?.latencyMs === null || database?.latencyMs === undefined ? "Latency not available" : `${database.latencyMs} ms response`, icon: Database },
    { label: "Redis", value: redis ? !redis.configured ? "Disabled" : redis.reachable ? "Healthy" : "Unavailable" : dependencyStatus, detail: redis?.cacheHitRate === null || redis?.cacheHitRate === undefined ? "Cache hit rate not available" : `${Math.round(redis.cacheHitRate * 100)}% cache hit rate`, icon: Server },
    { label: "Apify", value: apify ? `${apify.runs24h} runs / 24h` : dependencyStatus, detail: apify ? `${apify.successful} successful · ${apify.failed} failed${apify.averageDurationMs === null ? "" : ` · ${Math.round(apify.averageDurationMs / 1000)}s average`}` : "Run telemetry not available", icon: Bot },
    { label: "AI services", value: ai ? `${ai.requests24h} requests / 24h` : dependencyStatus, detail: ai ? `${ai.providerFailures} provider failures · ${ai.fallbacks} fallbacks` : "Usage telemetry not available", icon: Sparkles },
  ];
  return <section className="surface system-health-panel"><div className="surface-head"><div><span>SYSTEM HEALTH</span><h3>Operational dependencies</h3></div><button className="filter-button" type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={13} className={loading ? "spin" : ""} />Refresh</button></div>{error ? <div className="inline-error" role="status"><Gauge size={16} />System health is temporarily unavailable.</div> : <div className="system-health-grid">{cards.map(({ label, value, detail, icon: Icon }) => <div className="system-health-card" key={label}><span className="system-health-icon"><Icon size={15} /></span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></div>)}</div>}</section>;
}
