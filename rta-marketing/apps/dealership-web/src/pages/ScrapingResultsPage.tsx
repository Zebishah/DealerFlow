import { useMutation, useQuery } from "@tanstack/react-query";
import { Car, RefreshCw } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { ScrapedVehicleCard, ScrapedVehicleDetailsModal } from "../components/ScrapedVehicleCard";
import { api } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import type { ScrapedListing, ScrapingResultsResponse, ScrapingSite } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

function displaySiteName(name: string): string {
  return name.replace(/^Demo Source \(synthetic data\)$/i, "Generated inventory");
}

function isLiveTriggerable(site: ScrapingSite): boolean {
  return /pakwheels\.com|olx\.com\.pk/i.test(site.baseUrl);
}

export function ScrapingResultsPage() {
  const { user } = useAuth();
  const canTrigger = user?.role === "admin" || user?.role === "operator";
  const [filters, setFilters] = useState({ q: "", siteId: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "" });
  const [selectedItem, setSelectedItem] = useState<ScrapedListing | null>(null);
  const appliedFilters = useDebouncedValue(filters);
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
    refetchInterval: 15_000,
  });
  const trigger = useMutation({
    mutationFn: (siteId: number) => api<{ data: { jobId: string | null; siteName: string } }>(`/scraping-results/${siteId}/trigger`, { method: "POST" }),
    onSuccess: async (value) => {
      toast.success(`${displaySiteName(value.data.siteName)} queued (job ${value.data.jobId ?? "accepted"})`);
      await results.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (results.isLoading) return <PageSkeleton />;
  if (results.isError || !results.data) return <ErrorState message={results.error instanceof Error ? results.error.message : "Scraping results are unavailable."} />;

  const { items, sites } = results.data.data;
  const total = results.data.page.total;
  const clearFilters = () => setFilters({ q: "", siteId: "", minYear: "", maxYear: "", maxPrice: "", maxMileage: "" });

  return <div className="page-stack">
    <section className="operations-hero scraping-results-hero">
      <div><span>SCRAPING WORKSPACE</span><h2>Search the listings collected by your workers.</h2><p>These are PakWheels and OLX records saved by the Docker/BullMQ scraper into Neon. Filter them without starting a new crawl.</p></div>
      <div className="run-control scraping-hero-stats"><span>SAVED LISTINGS</span><strong>{total}</strong><small>{sites.length} scraper sites connected</small><button className="hero-secondary-action" onClick={() => results.refetch()}><RefreshCw size={14} />Refresh results</button></div>
    </section>

    <section className="surface scraping-filter-panel">
      <div className="surface-head"><div><span>SEARCH SCOPE</span><h3>Vehicle and site filters</h3></div><button className="filter-button" type="button" onClick={clearFilters}>Clear filters</button></div>
      <div className="scraping-filter-grid">
        <label className="scraping-search-field">Car name or keyword<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Volkswagen Tiguan" /></label>
        <label>Scraping site<select value={filters.siteId} onChange={(event) => setFilters({ ...filters, siteId: event.target.value })}><option value="">All sites</option>{sites.map((site) => <option value={site.id} key={site.id}>{displaySiteName(site.name)}</option>)}</select></label>
        <label>Minimum year<input type="number" min="1980" value={filters.minYear} onChange={(event) => setFilters({ ...filters, minYear: event.target.value })} /></label>
        <label>Maximum year<input type="number" min="1980" value={filters.maxYear} onChange={(event) => setFilters({ ...filters, maxYear: event.target.value })} /></label>
        <label>Maximum price<input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} placeholder="50000" /></label>
        <label>Maximum mileage (km)<input type="number" min="0" value={filters.maxMileage} onChange={(event) => setFilters({ ...filters, maxMileage: event.target.value })} placeholder="120000" /></label>
      </div>
    </section>

    <section className="operations-grid scraping-log-grid">
      <article className="surface"><div className="surface-head"><div><span>SOURCE HEALTH</span><h3>Scraping sites</h3></div><RefreshCw size={16} className={results.isFetching ? "spin" : ""} /></div><div className="source-list">{sites.map((site) => { const triggerable = isLiveTriggerable(site); const isThisTriggering = trigger.isPending && trigger.variables === site.id; const anotherIsTriggering = trigger.isPending && !isThisTriggering; return <div className="source-item" key={site.id}><span className="source-monogram">{displaySiteName(site.name).slice(0, 2).toUpperCase()}</span><div><strong>{displaySiteName(site.name)}</strong><small>{site.lastScrapedAt ? `Last scrape ${new Date(site.lastScrapedAt).toLocaleString("en-CA")}` : "No scrape recorded"} · {site.itemCount} records</small></div><span className="status-chip completed">{triggerable ? "connected" : "reference"}</span><button className="scrape-now-button" type="button" disabled={!canTrigger || !triggerable || trigger.isPending} onClick={() => trigger.mutate(site.id)}>{isThisTriggering ? "Queueing…" : anotherIsTriggering && triggerable ? "Wait…" : triggerable ? "Scrape now" : "Reference only"}</button></div>; })}</div></article>
      <article className="surface"><div className="surface-head"><div><span>PIPELINE STATUS</span><h3>Recent scraper activity</h3></div><button className="filter-button" type="button" onClick={() => results.refetch()}>Refresh</button></div><div className="scraping-activity-list">{sites.map((site) => <div className="scraping-activity-row" key={site.id}><div><strong>{site.name}</strong><small>{site.lastScrapedAt ? new Date(site.lastScrapedAt).toLocaleString("en-CA") : "Waiting for first run"}</small></div><b>{site.itemCount}</b><span>records</span></div>)}</div></article>
    </section>

    <section className="surface data-surface"><div className="surface-head"><div><span>SCRAPED INVENTORY</span><h3>{total} matching listings</h3></div><small>{results.isFetching ? "Refreshing…" : "Persisted in Neon"}</small></div>{items.length ? <div className="scraping-result-grid">{items.map((item) => <ScrapedVehicleCard key={item.id} item={item} onDetails={() => setSelectedItem(item)} />)}</div> : <div className="empty-state"><Car /><strong>No listings match these filters</strong><span>Try clearing a filter or run a new scrape.</span></div>}</section>
    <ScrapedVehicleDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
  </div>;
}
