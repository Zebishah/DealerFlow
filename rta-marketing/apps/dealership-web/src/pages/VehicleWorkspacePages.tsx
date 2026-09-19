import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, ChevronRight, Heart, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { ScrapedVehicleCard, ScrapedVehicleDetailsModal } from "../components/ScrapedVehicleCard";
import { WorkflowModal } from "../components/WorkflowModal";
import { api } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import type { CatalogVehicle, SavedScrapedListing, ScrapedListing, ScrapingResultsResponse, SessionUser } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type VehicleDetail = {
  id: string;
  vin: string | null;
  fingerprint: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  isUsed: boolean;
  offers: Array<{
    id: string;
    sourceName: string;
    url: string;
    title: string;
    priceCents: number | null;
    currency: string;
    odometerKm: number | null;
    dealerName: string | null;
    location: string | null;
    lastSeenAt: string;
  }>;
};

const compareKey = "rta-compare-vehicles";
function comparisonStorageKey(user: SessionUser | null): string {
  return `${compareKey}:${user?.id ?? "anonymous"}:${user?.workspaceId ?? "platform"}`;
}
const currency = (value: number | null) => value === null
  ? "Price unavailable"
  : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value / 100);

function readComparison(storageKey: string): CatalogVehicle[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as CatalogVehicle[];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeComparison(vehicles: CatalogVehicle[], storageKey: string) {
  localStorage.setItem(storageKey, JSON.stringify(vehicles.slice(0, 4)));
  window.dispatchEvent(new Event("rta-compare-changed"));
}

function useCatalogComparison() {
  const { user } = useAuth();
  const storageKey = comparisonStorageKey(user);
  const [comparison, setComparison] = useState<{ storageKey: string; items: CatalogVehicle[] }>(() => ({
    storageKey,
    items: readComparison(storageKey),
  }));
  useEffect(() => {
    const refresh = () => setComparison({ storageKey, items: readComparison(storageKey) });
    refresh();
    window.addEventListener("rta-compare-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rta-compare-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [storageKey]);
  return { items: comparison.storageKey === storageKey ? comparison.items : [], storageKey };
}

const scrapedCompareKey = "rta-compare-scraped-listings";
function scrapedComparisonStorageKey(user: SessionUser | null): string {
  return `${scrapedCompareKey}:${user?.id ?? "anonymous"}:${user?.workspaceId ?? "platform"}`;
}

function readScrapedComparison(storageKey: string): ScrapedListing[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as ScrapedListing[];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeScrapedComparison(items: ScrapedListing[], storageKey: string) {
  localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 4)));
  window.dispatchEvent(new Event("rta-scraped-compare-changed"));
}

function useScrapedComparison() {
  const { user } = useAuth();
  const storageKey = scrapedComparisonStorageKey(user);
  const [comparison, setComparison] = useState<{ storageKey: string; items: ScrapedListing[] }>(() => ({
    storageKey,
    items: readScrapedComparison(storageKey),
  }));
  useEffect(() => {
    const refresh = () => setComparison({ storageKey, items: readScrapedComparison(storageKey) });
    refresh();
    window.addEventListener("rta-scraped-compare-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rta-scraped-compare-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [storageKey]);
  return { items: comparison.storageKey === storageKey ? comparison.items : [], storageKey };
}

function VehicleCard({
  vehicle,
  saved,
  compared,
  onSave,
  onCompare,
  onDetails,
}: {
  vehicle: CatalogVehicle;
  saved: boolean;
  compared: boolean;
  onSave: () => void;
  onCompare: () => void;
  onDetails: () => void;
}) {
  return <article className="vehicle-card">
    <div className="vehicle-photo">
      {vehicle.imageUrl
        ? <img src={vehicle.imageUrl} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} loading="lazy" decoding="async" />
        : <div className="vehicle-photo-placeholder"><Car size={42} /><span>No image available</span></div>}
      <span className="vehicle-source-label">{vehicle.sourceName}</span>
      <button className={`vehicle-save ${saved ? "active" : ""}`} type="button" onClick={onSave} aria-label={saved ? "Remove saved vehicle" : "Save vehicle"}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="vehicle-info">
      <small>{vehicle.isUsed ? "PRE-OWNED" : "NEW"} · {vehicle.year}</small>
      <h3>{vehicle.make} {vehicle.model}</h3>
      <p>{vehicle.trim ?? vehicle.title}</p>
      <strong>{currency(vehicle.priceCents)}</strong>
      <div><span>{vehicle.odometerKm === null ? "Mileage unavailable" : `${vehicle.odometerKm.toLocaleString()} km`}</span><span>{vehicle.location ?? "Location unavailable"}</span></div>
      <footer className="vehicle-actions">
        <button type="button" className={compared ? "comparison-active" : ""} onClick={onCompare}>{compared ? "Added to compare" : "Compare"}</button>
        <button type="button" onClick={onDetails}>View offers <ChevronRight size={15} /></button>
      </footer>
    </div>
  </article>;
}

function VehicleDetails({ vehicleId, onClose }: { vehicleId: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["vehicle-detail", vehicleId],
    queryFn: () => api<{ data: VehicleDetail }>(`/vehicles/${vehicleId}`).then((value) => value.data),
    enabled: Boolean(vehicleId),
  });
  return <WorkflowModal open={Boolean(vehicleId)} eyebrow="NORMALIZED VEHICLE" title={detail.data ? `${detail.data.year} ${detail.data.make} ${detail.data.model}` : "Vehicle details"} description="One canonical vehicle with every active source offer and its provenance." onClose={onClose}>
    {detail.isLoading ? <div className="modal-loading">Loading current offers…</div> : detail.isError ? <ErrorState message="Vehicle details could not be loaded." /> : detail.data && <div className="vehicle-detail">
      <div className="detail-facts"><span><small>Condition</small><strong>{detail.data.isUsed ? "Pre-owned" : "New"}</strong></span><span><small>Trim</small><strong>{detail.data.trim ?? "Not provided"}</strong></span><span><small>VIN</small><strong>{detail.data.vin ?? "Not disclosed"}</strong></span><span><small>Active offers</small><strong>{detail.data.offers.length}</strong></span></div>
      <div className="offer-list">{detail.data.offers.map((offer) => <article key={offer.id}><div><strong>{offer.sourceName}</strong><span>{offer.dealerName ?? "Dealer unavailable"} · {offer.location ?? "Location unavailable"}</span></div><div><strong>{currency(offer.priceCents)}</strong><span>{offer.odometerKm === null ? "Mileage unavailable" : `${offer.odometerKm.toLocaleString()} km`}</span></div><a href={offer.url} target="_blank" rel="noreferrer">Open source</a></article>)}</div>
    </div>}
  </WorkflowModal>;
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const { items: compare, storageKey } = useScrapedComparison();
  const [query, setQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [selectedItem, setSelectedItem] = useState<ScrapedListing | null>(null);
  const savedScraped = useQuery({ queryKey: ["saved-scraped-vehicles"], queryFn: () => api<{ data: SavedScrapedListing[] }>("/saved-vehicles/scraped").then((value) => value.data) });
  const saveScraped = useMutation({
    mutationFn: ({ id, saved }: { id: number; saved: boolean }) => api(`/saved-vehicles/scraped/${id}`, { method: saved ? "DELETE" : "POST" }),
    onSuccess: async (_value, variables) => {
      toast.success(variables.saved ? "Removed from saved vehicles" : "Vehicle saved");
      await queryClient.invalidateQueries({ queryKey: ["saved-scraped-vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const filterValues = useMemo(() => ({ query, siteId, minYear, maxYear, maxPrice, maxMileage }), [maxMileage, maxPrice, maxYear, minYear, query, siteId]);
  const appliedFilters = useDebouncedValue(filterValues);
  const results = useInfiniteQuery({
    queryKey: ["scraped-inventory", appliedFilters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "48", offset: String(pageParam) });
      if (appliedFilters.query.trim()) params.set("q", appliedFilters.query.trim());
      if (appliedFilters.siteId) params.set("siteId", appliedFilters.siteId);
      if (appliedFilters.minYear) params.set("minYear", appliedFilters.minYear);
      if (appliedFilters.maxYear) params.set("maxYear", appliedFilters.maxYear);
      if (appliedFilters.maxPrice) params.set("maxPrice", appliedFilters.maxPrice);
      if (appliedFilters.maxMileage) params.set("maxMileage", appliedFilters.maxMileage);
      return api<ScrapingResultsResponse>(`/scraping-results?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.offset + lastPage.page.limit : undefined,
  });

  function toggleCompare(vehicle: ScrapedListing) {
    const current = readScrapedComparison(storageKey);
    if (current.some((item) => item.id === vehicle.id)) {
      writeScrapedComparison(current.filter((item) => item.id !== vehicle.id), storageKey);
      toast.success("Removed from comparison");
      return;
    }
    if (current.length >= 4) {
      toast.error("Compare up to four vehicles at a time");
      return;
    }
    writeScrapedComparison([...current, vehicle], storageKey);
    toast.success("Added to comparison");
  }

  if (results.isLoading) return <PageSkeleton />;
  if (results.isError) return <ErrorState message="Scraped vehicle inventory is unavailable." />;

  const firstPage = results.data?.pages[0];
  const sites = firstPage?.data.sites ?? [];
  const items = results.data?.pages.flatMap((page) => page.data.items) ?? [];
  const compareIds = new Set(compare.map((vehicle) => vehicle.id));
  const savedIds = new Set((savedScraped.data ?? []).map((vehicle) => vehicle.id));
  const clearFilters = () => { setQuery(""); setSiteId(""); setMinYear(""); setMaxYear(""); setMaxPrice(""); setMaxMileage(""); };

  return <div className="page-stack">
    <section className="intelligence-banner"><div><span>VEHICLE INTELLIGENCE</span><h2>Search every vehicle collected by the scraper.</h2><p>Approved international listings are stored in Neon with source, mileage, location, image, and original listing links preserved.</p></div><div><Car /><strong>{firstPage?.page.total ?? 0}</strong><span>scraped listings</span></div></section>
    <section className="page-toolbar">
      <div className="search-control"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle or city" /></div>
      <select value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">All scraping sites</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select>
      <input className="compact-filter-input" type="number" min="1980" value={minYear} onChange={(event) => setMinYear(event.target.value)} placeholder="Min year" aria-label="Minimum year" />
      <input className="compact-filter-input" type="number" min="1980" value={maxYear} onChange={(event) => setMaxYear(event.target.value)} placeholder="Max year" aria-label="Maximum year" />
      <button className="filter-button" type="button" onClick={clearFilters}>Clear filters</button>
      <span className="selection-count">{compare.length}/4 selected</span>
    </section>
    {items.length ? <section className="vehicle-grid">{items.map((vehicle) => <ScrapedVehicleCard key={vehicle.id} item={vehicle} saved={savedIds.has(vehicle.id)} onSave={() => saveScraped.mutate({ id: vehicle.id, saved: savedIds.has(vehicle.id) })} compared={compareIds.has(vehicle.id)} onCompare={() => toggleCompare(vehicle)} onDetails={() => setSelectedItem(vehicle)} />)}</section> : <div className="empty-state surface"><Car /><strong>No scraped vehicles match your search</strong><span>Run a scrape or adjust the filters.</span></div>}
    {results.hasNextPage && <div className="pagination-actions"><button className="filter-button" type="button" onClick={() => results.fetchNextPage()} disabled={results.isFetchingNextPage}>{results.isFetchingNextPage ? "Loading more…" : "Load more vehicles"}</button></div>}
    <ScrapedVehicleDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
  </div>;
}

export function SavedVehiclesPage() {
  const queryClient = useQueryClient();
  const { items: compare, storageKey } = useCatalogComparison();
  const { items: scrapedCompare, storageKey: scrapedStorageKey } = useScrapedComparison();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedScraped, setSelectedScraped] = useState<ScrapedListing | null>(null);
  const saved = useQuery({ queryKey: ["saved-vehicles"], queryFn: () => api<{ data: CatalogVehicle[] }>("/saved-vehicles").then((value) => value.data) });
  const savedScraped = useQuery({ queryKey: ["saved-scraped-vehicles"], queryFn: () => api<{ data: SavedScrapedListing[] }>("/saved-vehicles/scraped").then((value) => value.data) });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/saved-vehicles/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Removed from saved vehicles"); await queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeScraped = useMutation({
    mutationFn: (id: number) => api(`/saved-vehicles/scraped/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Removed from saved vehicles"); await queryClient.invalidateQueries({ queryKey: ["saved-scraped-vehicles"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (saved.isLoading || savedScraped.isLoading) return <PageSkeleton />;
  if (saved.isError || savedScraped.isError) return <ErrorState message="Saved vehicles could not be loaded." />;
  const compareIds = new Set(compare.map((vehicle) => vehicle.vehicleId));
  const scrapedCompareIds = new Set(scrapedCompare.map((vehicle) => vehicle.id));
  const hasSavedVehicles = Boolean(saved.data?.length || savedScraped.data?.length);
  return <div className="page-stack"><section className="page-intro"><div><span>PERSONAL SHORTLIST</span><h2>Saved vehicles.</h2><p>Your saved scraped listings are private to your account and remain available here until you remove them.</p></div></section>{savedScraped.data?.length ? <section className="saved-section"><div className="surface-head"><div><span>SCRAPED LISTINGS</span><h3>Saved from vehicle intelligence</h3></div><span className="status-chip completed">{savedScraped.data.length} saved</span></div><section className="vehicle-grid">{savedScraped.data.map((vehicle) => <ScrapedVehicleCard key={vehicle.id} item={vehicle} saved onSave={() => removeScraped.mutate(vehicle.id)} compared={scrapedCompareIds.has(vehicle.id)} onCompare={() => { const current = readScrapedComparison(scrapedStorageKey); if (scrapedCompareIds.has(vehicle.id)) writeScrapedComparison(current.filter((item) => item.id !== vehicle.id), scrapedStorageKey); else if (current.length < 4) writeScrapedComparison([...current, vehicle], scrapedStorageKey); else toast.error("Compare up to four vehicles at a time"); }} onDetails={() => setSelectedScraped(vehicle)} />)}</section></section> : null}{saved.data?.length ? <section className="saved-section"><div className="surface-head"><div><span>NORMALIZED INVENTORY</span><h3>Saved catalog vehicles</h3></div></div><section className="vehicle-grid">{saved.data.map((vehicle) => <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} saved compared={compareIds.has(vehicle.vehicleId)} onSave={() => remove.mutate(vehicle.vehicleId)} onCompare={() => { const current = readComparison(storageKey); if (compareIds.has(vehicle.vehicleId)) writeComparison(current.filter((item) => item.vehicleId !== vehicle.vehicleId), storageKey); else if (current.length < 4) writeComparison([...current, vehicle], storageKey); else toast.error("Compare up to four vehicles at a time"); }} onDetails={() => setDetailId(vehicle.vehicleId)} />)}</section></section> : null}{!hasSavedVehicles && <div className="empty-state surface"><Heart /><strong>No saved vehicles yet</strong><span>Use the heart button on a vehicle card to build your private shortlist.</span></div>}<VehicleDetails vehicleId={detailId} onClose={() => setDetailId(null)} /><ScrapedVehicleDetailsModal item={selectedScraped} onClose={() => setSelectedScraped(null)} /></div>;
}

export function CompareVehiclesPage() {
  const { items, storageKey } = useScrapedComparison();
  if (!items.length) return <div className="page-stack"><section className="page-intro"><div><span>DECISION WORKSPACE</span><h2>Vehicle comparison.</h2><p>Compare up to four scraped vehicles side by side.</p></div></section><div className="empty-state surface"><Plus /><strong>No vehicles selected</strong><span>Add vehicles from Vehicle intelligence to compare their scraped details.</span></div></div>;
  const rows: Array<[string, (vehicle: ScrapedListing) => string]> = [
    ["Price", (vehicle) => vehicle.price ?? "Unavailable"],
    ["Year", (vehicle) => vehicle.year ?? "Unavailable"],
    ["Mileage", (vehicle) => vehicle.mileage ?? "Unavailable"],
    ["City", (vehicle) => vehicle.city ?? "Unavailable"],
    ["Source", (vehicle) => vehicle.siteName],
    ["Scraped", (vehicle) => new Date(vehicle.scrapedAt).toLocaleDateString("en-CA")],
  ];
  return <div className="page-stack"><section className="page-intro"><div><span>DECISION WORKSPACE</span><h2>Compare scraped vehicles.</h2><p>Compare source records side by side before opening the original listings.</p></div><button className="filter-button" onClick={() => writeScrapedComparison([], storageKey)}>Clear comparison</button></section><section className="surface comparison-table"><table><thead><tr><th>Attribute</th>{items.map((vehicle) => <th key={vehicle.id}><button aria-label={`Remove ${vehicle.title}`} onClick={() => writeScrapedComparison(items.filter((item) => item.id !== vehicle.id), storageKey)}><X size={15} /></button><span>{vehicle.year ?? "Year unavailable"}</span><strong>{vehicle.title}</strong><a href={vehicle.listingUrl} target="_blank" rel="noreferrer">Open listing</a></th>)}</tr></thead><tbody>{rows.map(([label, format]) => <tr key={label}><th>{label}</th>{items.map((vehicle) => <td key={vehicle.id}>{format(vehicle)}</td>)}</tr>)}</tbody></table></section></div>;
}
