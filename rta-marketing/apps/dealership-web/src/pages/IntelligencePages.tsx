import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Car, ExternalLink, Play, RefreshCw, ServerCog } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { LoadingButton } from "../components/LoadingButton";
import toast from "react-hot-toast";
import { api, idempotentJson } from "../lib/api";
import type { IntelligenceSummary, ScrapedListing, ScrapingResultsResponse, ScrapingSite, SourceHealth } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type RunDetail = {
  id: string;
  mode: "fixture" | "live";
  status: string;
  sourceCount: number;
  completedSourceCount: number;
  failedSourceCount: number;
  discoveredCount: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  sources: Array<{
    id: string;
    sourceName: string;
    status: string;
    attemptCount: number;
    progressPercent: number;
    discoveredCount: number;
    validCount: number;
    insertedCount: number;
    updatedCount: number;
    rejectedCount: number;
    errorCode: string | null;
    errorMessage: string | null;
  }>;
};

function displayRunMode(mode: "fixture" | "live"): string {
  return mode === "live" ? "Live acquisition" : "Validation run";
}

export function AcquisitionPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canRunLive = user?.role === "admin" || user?.role === "operator";
  const [mode, setMode] = useState<"fixture" | "live">("fixture");
  const [selectedSources, setSelectedSources] = useState<string[]>(["autotrader"]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
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

  const runDetail = useQuery({
    queryKey: ["scrape-run", selectedRunId],
    queryFn: () => api<{ data: RunDetail }>(`/scrape-runs/${selectedRunId}`).then((value) => value.data),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => query.state.data && ["queued", "running"].includes(query.state.data.status) ? 2_000 : false,
  });

  const replay = useMutation({
    mutationFn: ({ runId, sourceRunId }: { runId: string; sourceRunId: string }) =>
      api(`/scrape-runs/${runId}/sources/${sourceRunId}/replay`, { method: "POST" }),
    onSuccess: async () => {
      toast.success("Failed source queued for replay");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["scrape-run", selectedRunId] }),
        queryClient.invalidateQueries({ queryKey: ["intelligence"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
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
      toast.success(`${mode === "live" ? "Live" : "Validation"} acquisition queued for ${selectedSources.length} source${selectedSources.length === 1 ? "" : "s"}`);
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
            <option value="fixture">Validation run</option>
          </select>
        </label>
        <LoadingButton onClick={() => run.mutate(crypto.randomUUID())} loading={run.isPending} loadingLabel="Queueing…" disabled={selectedSources.length === 0}>
          <Play />
          {selectedSources.length ? `Queue ${selectedSources.length} source${selectedSources.length === 1 ? "" : "s"}` : "Select a source"}
        </LoadingButton>
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
              <div><strong>{source.name}</strong><small>{allowed ? mode === "live" ? "Live acquisition enabled" : "Validation adapter ready" : mode === "live" ? "Live acquisition disabled" : "Source disabled"}</small></div>
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
            <button className="run-summary-button" type="button" onClick={() => setSelectedRunId(item.id)}><strong>RUN-{item.id.slice(0, 8).toUpperCase()}</strong><small>{displayRunMode(item.mode)} · {new Date(item.createdAt).toLocaleString("en-CA")}</small><div className="progress-bar"><i style={{ width: `${item.sourceCount ? item.completedSourceCount / item.sourceCount * 100 : 0}%` }} /></div></button>
            <div className="run-status-actions"><span className={`status-chip ${item.status}`}>{item.status}</span>{canRunLive && ["queued", "running"].includes(item.status) && <button disabled={cancel.isPending} onClick={() => cancel.mutate(item.id)}>Cancel</button>}</div>
          </div>)}
        </div>
      </article>
    </section>

    <section className="architecture-note"><Activity /><div><strong>Production-shaped local verification</strong><p>Local and Lambda workers consume the same SQS contract and execute the same validation, normalization, retry, and idempotent database-upsert code.</p></div></section>
    <WorkflowModal open={Boolean(selectedRunId)} eyebrow="RUN OBSERVABILITY" title={runDetail.data ? `RUN-${runDetail.data.id.slice(0, 8).toUpperCase()}` : "Acquisition run"} description="Per-source progress, retry attempts, normalization results, and operational errors." onClose={() => setSelectedRunId(null)}>
      {runDetail.isLoading ? <div className="modal-loading">Loading run telemetry…</div> : runDetail.isError ? <ErrorState message="Run telemetry could not be loaded." /> : runDetail.data && <div className="run-detail">
        <div className="detail-facts"><span><small>Status</small><strong className="capitalize">{runDetail.data.status}</strong></span><span><small>Discovered</small><strong>{runDetail.data.discoveredCount}</strong></span><span><small>Inserted</small><strong>{runDetail.data.insertedCount}</strong></span><span><small>Updated</small><strong>{runDetail.data.updatedCount}</strong></span></div>
        <div className="source-run-list">{runDetail.data.sources.map((sourceRun) => <article key={sourceRun.id}><div><strong>{sourceRun.sourceName}</strong><small>{sourceRun.discoveredCount} discovered · {sourceRun.validCount} valid · {sourceRun.rejectedCount} rejected · attempt {sourceRun.attemptCount}</small>{sourceRun.errorMessage && <p>{sourceRun.errorCode ? `${sourceRun.errorCode}: ` : ""}{sourceRun.errorMessage}</p>}</div><span className={`status-chip ${sourceRun.status}`}>{sourceRun.status}</span>{canRunLive && sourceRun.status === "failed" && <button disabled={replay.isPending} onClick={() => replay.mutate({ runId: runDetail.data!.id, sourceRunId: sourceRun.id })}>Replay</button>}</article>)}</div>
      </div>}
    </WorkflowModal>
  </div>;
}


type ScrapingFilters = {
  q: string;
  siteId: string;
  minYear: string;
  maxYear: string;
  maxPrice: string;
  maxMileage: string;
};

const emptyScrapingFilters: ScrapingFilters = { q: "", siteId: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "" };

function sourceIsTriggerable(site: ScrapingSite): boolean {
  return site.triggerable && site.executionProvider === "apify";
}

export function ScrapingResultsPage() {
  const [filters, setFilters] = useState<ScrapingFilters>(emptyScrapingFilters);
  const [triggeringSiteId, setTriggeringSiteId] = useState<number | null>(null);
  const { user } = useAuth();
  const canTrigger = user?.role === "admin" || user?.role === "operator";
  const query = useInfiniteQuery({
    queryKey: ["scraping-results", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "24", offset: String(pageParam) });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.siteId) params.set("siteId", filters.siteId);
      if (filters.minYear) params.set("minYear", filters.minYear);
      if (filters.maxYear) params.set("maxYear", filters.maxYear);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      if (filters.maxMileage) params.set("maxMileage", filters.maxMileage);
      return api<ScrapingResultsResponse>(`/scraping-results?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.offset + lastPage.page.limit : undefined,
    refetchInterval: 15_000,
  });
  const trigger = useMutation({
    mutationFn: (siteId: number) => api(`/scraping-results/${siteId}/trigger`, { method: "POST", body: JSON.stringify({ limit: 10 }) }),
    onMutate: (siteId) => setTriggeringSiteId(siteId),
    onSuccess: async (_data, siteId) => {
      toast.success("Scrape queued. New records will appear shortly.");
      setTriggeringSiteId(null);
      await query.refetch();
      void siteId;
    },
    onError: (error: Error) => {
      setTriggeringSiteId(null);
      toast.error(error.message);
    },
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="Scraping results are unavailable. Confirm the scraper API and Neon connection are running." />;

  const firstPage = query.data?.pages[0];
  const sites = firstPage?.data.sites ?? [];
  const items: ScrapedListing[] = query.data?.pages.flatMap((page) => page.data.items) ?? [];
  const total = firstPage?.page.total ?? 0;
  const clearFilters = () => setFilters(emptyScrapingFilters);

  return <div className="page-stack">
    <section className="operations-hero scraping-results-hero">
      <div><span>SCRAPING WORKSPACE</span><h2>Collect and review vehicle inventory.</h2><p>Run an approved international source through the Apify scraping pipeline, then search the vehicle records persisted in Neon.</p></div>
      <div className="run-control scraping-hero-stats"><span>SCRAPED VEHICLES</span><strong>{total}</strong><small>{sites.length} configured sources</small></div>
    </section>

    <section className="surface scraping-filter-panel">
      <div className="surface-head"><div><span>SEARCH SCOPE</span><h3>Vehicle filters</h3></div><button className="filter-button" type="button" onClick={clearFilters}>Clear filters</button></div>
      <div className="scraping-filter-grid">
        <label className="scraping-search-field">Car name or keyword<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Volkswagen Tiguan" /></label>
        <label>Scraping site<select value={filters.siteId} onChange={(event) => setFilters({ ...filters, siteId: event.target.value })}><option value="">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
        <label>Minimum year<input type="number" min="1980" value={filters.minYear} onChange={(event) => setFilters({ ...filters, minYear: event.target.value })} /></label>
        <label>Maximum year<input type="number" min="1980" value={filters.maxYear} onChange={(event) => setFilters({ ...filters, maxYear: event.target.value })} /></label>
        <label>Maximum price<input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} placeholder="50000" /></label>
        <label>Maximum mileage<input type="number" min="0" value={filters.maxMileage} onChange={(event) => setFilters({ ...filters, maxMileage: event.target.value })} placeholder="120000" /></label>
      </div>
    </section>

    <section className="surface scraping-site-grid"><div className="surface-head"><div><span>SCRAPER SOURCES</span><h3>Run a collection now</h3></div><RefreshCw size={16} className={query.isFetching ? "spin" : ""} /></div><div className="scraping-site-cards">{sites.map((site) => { const triggerable = sourceIsTriggerable(site); return <article className="scraping-site-card" key={site.id}><div className="source-monogram">{site.name.slice(0, 2).toUpperCase()}</div><div><strong>{site.name}</strong><small>{site.itemCount.toLocaleString()} stored listings{site.lastScrapedAt ? ` · last run ${new Date(site.lastScrapedAt).toLocaleString("en-CA")}` : " · not run yet"}</small></div><button className="small-action" type="button" disabled={!canTrigger || !triggerable || trigger.isPending} onClick={() => trigger.mutate(site.id)}>{triggeringSiteId === site.id ? "Queueing…" : triggerable ? "Scrape now" : "Unavailable"}</button></article>; })}</div></section>

    <section className="surface data-surface"><div className="surface-head"><div><span>SCRAPED INVENTORY</span><h3>{total.toLocaleString()} vehicle listings</h3></div><small>{query.isFetching ? "Refreshing…" : "Persisted in Neon"}</small></div>{items.length ? <div className="scraping-result-grid">{items.map((item) => <ScrapedResultCard key={item.id} item={item} />)}</div> : <div className="empty-state"><Car /><strong>No scraped vehicles match these filters</strong><span>Run a permitted source or clear a filter.</span></div>}{query.hasNextPage && <div className="pagination-actions"><button className="filter-button" type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading more…" : "Load more vehicles"}</button></div>}</section>
  </div>;
}

function ScrapedResultCard({ item }: { item: ScrapedListing }) {
  return <article className="scraping-result-card"><div className="scraping-result-photo">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} loading="lazy" /> : <div className="scraping-result-placeholder"><Car size={34} /><span>No image available</span></div>}<span className="scraping-result-source">{item.siteName}</span></div><div className="scraping-result-info"><small>{item.year ?? "YEAR UNAVAILABLE"}</small><h3>{item.title}</h3><p>{item.city ?? "Location unavailable"}</p><strong>{item.price ?? "Price unavailable"}</strong><div className="scraping-result-meta"><span>{item.mileage ?? "Mileage unavailable"}</span><span>{new Date(item.scrapedAt).toLocaleDateString("en-CA")}</span></div><a href={item.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open source listing</a></div></article>;
}

export function SourceControlPage() {
  const queryClient = useQueryClient();
  const sources = useQuery({
    queryKey: ["sources", "configuration"],
    queryFn: () => api<{ data: SourceHealth[] }>("/sources").then((value) => value.data),
  });
  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: Partial<Pick<SourceHealth, "enabled" | "liveEnabled">> }) =>
      api(`/sources/${key}`, { method: "PATCH", body: JSON.stringify(value) }),
    onSuccess: async () => {
      toast.success("Source safety controls updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sources", "configuration"] }),
        queryClient.invalidateQueries({ queryKey: ["intelligence"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (sources.isLoading) return <PageSkeleton />;
  if (sources.isError) return <ErrorState message="Source configuration is unavailable." />;
  return <div className="page-stack">
    <section className="page-intro"><div><span>ACQUISITION GOVERNANCE</span><h2>Source safety controls.</h2><p>Independent kill switches let operators stop an adapter or live network traffic immediately without redeploying code.</p></div></section>
    <section className="surface source-control-table">
      <div className="surface-head"><div><span>REGISTERED ADAPTERS</span><h3>{sources.data?.length ?? 0} acquisition sources</h3></div></div>
      {sources.data?.map((source) => <article key={source.key}><div><strong>{source.name}</strong><code>{source.key}</code></div><label>Adapter enabled<input type="checkbox" checked={source.enabled} disabled={update.isPending} onChange={(event) => update.mutate({ key: source.key, value: { enabled: event.target.checked } })} /></label><label>Live network access<input type="checkbox" checked={source.liveEnabled} disabled={update.isPending || !source.enabled} onChange={(event) => update.mutate({ key: source.key, value: { liveEnabled: event.target.checked } })} /></label><span className={`status-chip ${source.latestStatus ?? "idle"}`}>{source.latestStatus ?? "idle"}</span></article>)}
    </section>
    <div className="warning-banner"><AlertTriangle /><span><strong>Two controls are intentional.</strong> “Adapter enabled” disables every mode; “Live network access” only allows controlled third-party acquisition when the server-wide live-scraping switch is also enabled.</span></div>
  </div>;
}
