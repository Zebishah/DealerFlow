import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Car, ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { PublicVehicleCard } from "../components/PublicVehicleCard";
import { PublicVehicleGridSkeleton } from "../components/PublicVehicleGridSkeleton";
import { api } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { Link } from "../router/Navigation";
import type { PublicInventoryResponse } from "../types/domain";
import { LandingFooter, LandingNav } from "./LandingPage";
import "../landing.css";

const pageSize = 24;
type Filters = { q: string; siteKey: string; minYear: string; maxYear: string; minPrice: string; maxPrice: string; maxMileage: string };
const emptyFilters: Filters = { q: "", siteKey: "", minYear: "", maxYear: "", minPrice: "", maxPrice: "", maxMileage: "" };

export function PublicInventoryPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [offset, setOffset] = useState(0);
  const appliedFilters = useDebouncedValue(filters);
  const inventory = useQuery({
    queryKey: ["public-inventory", appliedFilters, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      return api<PublicInventoryResponse>(`/scraping-results/public?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setOffset(0);
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    setOffset(0);
  };
  const result = inventory.data;
  const items = result?.data.items ?? [];
  const sources = result?.data.sources ?? [];
  const total = result?.page.total ?? 0;

  return <main className="landing-page public-inventory-page">
    <LandingNav browsePage />
    <section className="public-inventory-hero">
      <div className="landing-section-frame">
        <p className="landing-eyebrow">REAL VEHICLES · LIVE SOURCE LISTINGS</p>
        <h1>Find your next<br /><span>vehicle signal.</span></h1>
        <p>Browse current vehicles collected from Romans International, Tom Hartley and Redline Specialist Cars. Open original listings freely; sign in to compare vehicles in RTA.</p>
        <div className="public-inventory-hero-meta"><span aria-live="polite">{inventory.isLoading ? <><Loader2 size={15} className="spin" /> Loading matching listings</> : <><Car size={15} /> {total.toLocaleString()} matching listings</>}</span><Link to="/login?next=%2Finventory">Sign in <ArrowRight size={14} /></Link></div>
      </div>
    </section>

    <section className="landing-section public-inventory-content">
      <div className="landing-section-frame">
        <div className="public-inventory-title"><div><p className="landing-eyebrow">PUBLIC INVENTORY</p><h2>Search live listings</h2></div><span><SlidersHorizontal size={15} /> {sources.length} approved sources</span></div>
        <div className="public-inventory-filters">
          <label className="public-inventory-search"><span>Search make, model, keyword or location</span><div><Search size={17} /><input type="search" value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Try Ferrari, 488, London…" /></div></label>
          <label><span>Source</span><select value={filters.siteKey} onChange={(event) => updateFilter("siteKey", event.target.value)}><option value="">All live sources</option>{sources.map((source) => <option key={source.siteKey} value={source.siteKey}>{source.name}</option>)}</select></label>
          <label><span>Year from</span><input type="number" min="1980" value={filters.minYear} onChange={(event) => updateFilter("minYear", event.target.value)} placeholder="Any" /></label>
          <label><span>Year to</span><input type="number" min="1980" value={filters.maxYear} onChange={(event) => updateFilter("maxYear", event.target.value)} placeholder="Any" /></label>
          <label><span>Listed amount from</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} placeholder="Any" /></label>
          <label><span>Listed amount to</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} placeholder="Any" /></label>
          <label><span>Maximum mileage</span><input type="number" min="0" value={filters.maxMileage} onChange={(event) => updateFilter("maxMileage", event.target.value)} placeholder="Any" /></label>
          <button type="button" onClick={clearFilters}>Clear filters</button>
        </div>
        <p className="public-inventory-currency-note">Price filters use the numeric amount shown by each source; currencies are displayed as listed and are not converted.</p>

        {inventory.isError && <div className="public-inventory-state" role="alert"><AlertCircle size={24} /><strong>Inventory couldn’t be loaded.</strong><span>Check your connection and try again.</span><button type="button" disabled={inventory.isFetching} onClick={() => void inventory.refetch()}>{inventory.isFetching ? "Retrying…" : "Try again"}</button></div>}
        {inventory.isLoading && <PublicVehicleGridSkeleton count={9} variant="browse" />}
        {!inventory.isLoading && !inventory.isError && items.length > 0 && <>
          {inventory.isFetching && <div className="public-inventory-refresh" role="status"><Loader2 size={14} className="spin" /> Updating results…</div>}
          <div className="public-inventory-grid" aria-busy={inventory.isFetching}>{items.map((item) => <PublicVehicleCard item={item} key={item.id} />)}</div>
        </>}
        {!inventory.isLoading && !inventory.isError && items.length === 0 && <div className="public-inventory-state"><Car size={25} /><strong>No vehicles match those filters.</strong><span>Try a broader search or clear your filters.</span><button type="button" onClick={clearFilters}>Clear filters</button></div>}

        {result && total > 0 && <div className="public-inventory-pagination"><span>Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total.toLocaleString()}</span><div><button type="button" disabled={offset === 0 || inventory.isFetching} onClick={() => setOffset((current) => Math.max(0, current - pageSize))}><ChevronLeft size={16} /> Previous</button><button type="button" disabled={!result.page.hasMore || inventory.isFetching} onClick={() => setOffset((current) => current + pageSize)}>More vehicles <ChevronRight size={16} /></button></div></div>}
        <div className="public-inventory-login-cta"><div><span className="landing-eyebrow">READY TO COMPARE?</span><strong>Save vehicles and compare them side by side in RTA.</strong></div><Link className="landing-button landing-button--primary" to="/login?next=%2Finventory">Sign in to compare <ArrowRight size={15} /></Link></div>
      </div>
    </section>
    <LandingFooter browsePage />
  </main>;
}
