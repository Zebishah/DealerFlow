import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, ChevronRight, Heart, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { WorkflowModal } from "../components/WorkflowModal";
import { api } from "../lib/api";
import type { CatalogVehicle, IntelligenceSummary } from "../types/domain";
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

type CatalogResponse = { data: CatalogVehicle[]; page: { total: number; hasNext: boolean; nextCursor: string | null; limit: number } };
const compareKey = "rta-compare-vehicles";
const currency = (value: number | null) => value === null
  ? "Price unavailable"
  : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value / 100);

function readComparison(): CatalogVehicle[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(compareKey) ?? "[]") as CatalogVehicle[];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeComparison(vehicles: CatalogVehicle[]) {
  localStorage.setItem(compareKey, JSON.stringify(vehicles.slice(0, 4)));
  window.dispatchEvent(new Event("rta-compare-changed"));
}

function useComparison() {
  const [items, setItems] = useState<CatalogVehicle[]>(readComparison);
  useEffect(() => {
    const refresh = () => setItems(readComparison());
    window.addEventListener("rta-compare-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rta-compare-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return items;
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
        : <Car size={42} />}
      <span>{vehicle.sourceName}</span>
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
  const compare = useComparison();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("newest");
  const deferredQuery = useDeferredValue(query);
  const [detailId, setDetailId] = useState<string | null>(null);

  const summary = useQuery({ queryKey: ["intelligence", "summary"], queryFn: () => api<{ data: IntelligenceSummary }>("/dashboard/summary").then((value) => value.data) });
  const saved = useQuery({ queryKey: ["saved-vehicles"], queryFn: () => api<{ data: CatalogVehicle[] }>("/saved-vehicles").then((value) => value.data) });
  const catalog = useInfiniteQuery({
    queryKey: ["catalog", deferredQuery, source, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "48", sort });
      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
      if (source) params.set("source", source);
      if (pageParam) params.set("cursor", pageParam);
      return api<CatalogResponse>(`/vehicles?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
  });
  const catalogItems = catalog.data?.pages.flatMap((page) => page.data) ?? [];
  const savedIds = useMemo(() => new Set(saved.data?.map((vehicle) => vehicle.vehicleId)), [saved.data]);
  const compareIds = useMemo(() => new Set(compare.map((vehicle) => vehicle.vehicleId)), [compare]);

  const toggleSave = useMutation({
    mutationFn: ({ id, isSaved }: { id: string; isSaved: boolean }) => api(`/saved-vehicles/${id}`, { method: isSaved ? "DELETE" : "POST" }),
    onSuccess: async (_data, variables) => {
      toast.success(variables.isSaved ? "Removed from saved vehicles" : "Vehicle saved");
      await queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleCompare(vehicle: CatalogVehicle) {
    const current = readComparison();
    if (current.some((item) => item.vehicleId === vehicle.vehicleId)) {
      writeComparison(current.filter((item) => item.vehicleId !== vehicle.vehicleId));
      toast.success("Removed from comparison");
      return;
    }
    if (current.length >= 4) {
      toast.error("Compare up to four vehicles at a time");
      return;
    }
    writeComparison([...current, vehicle]);
    toast.success("Added to comparison");
  }

  if (catalog.isLoading) return <PageSkeleton />;
  if (catalog.isError) return <ErrorState message="The normalized inventory catalog is unavailable." />;

  return <div className="page-stack">
    <section className="intelligence-banner"><div><span>MARKET INTELLIGENCE</span><h2>Search every acquired listing from one reliable catalog.</h2><p>Source records are validated, normalized, deduplicated, and retained with provenance.</p></div><div><Car /><strong>{catalog.data?.pages[0]?.page.total ?? 0}</strong><span>active source listings</span></div></section>
    <section className="page-toolbar">
      <div className="search-control"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model, trim, or keyword" /></div>
      <select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All acquisition sources</option>{summary.data?.sourceHealth.map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}</select>
      <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Recently seen</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="year_desc">Newest model year</option></select>
      <span className="selection-count">{compare.length}/4 selected</span>
    </section>
    {catalogItems.length ? <section className="vehicle-grid">{catalogItems.map((vehicle) => <VehicleCard key={vehicle.listingId} vehicle={vehicle} saved={savedIds.has(vehicle.vehicleId)} compared={compareIds.has(vehicle.vehicleId)} onSave={() => toggleSave.mutate({ id: vehicle.vehicleId, isSaved: savedIds.has(vehicle.vehicleId) })} onCompare={() => toggleCompare(vehicle)} onDetails={() => setDetailId(vehicle.vehicleId)} />)}</section> : <div className="empty-state surface"><Car /><strong>No inventory matches your search</strong><span>Run an acquisition or adjust the filters.</span></div>}
    {catalog.hasNextPage && <div className="pagination-actions"><button className="filter-button" type="button" onClick={() => catalog.fetchNextPage()} disabled={catalog.isFetchingNextPage}>{catalog.isFetchingNextPage ? "Loading more…" : "Load more vehicles"}</button></div>}
    <VehicleDetails vehicleId={detailId} onClose={() => setDetailId(null)} />
  </div>;
}

export function SavedVehiclesPage() {
  const queryClient = useQueryClient();
  const compare = useComparison();
  const [detailId, setDetailId] = useState<string | null>(null);
  const saved = useQuery({ queryKey: ["saved-vehicles"], queryFn: () => api<{ data: CatalogVehicle[] }>("/saved-vehicles").then((value) => value.data) });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/saved-vehicles/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Removed from saved vehicles"); await queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (saved.isLoading) return <PageSkeleton />;
  if (saved.isError) return <ErrorState message="Saved vehicles could not be loaded." />;
  const compareIds = new Set(compare.map((vehicle) => vehicle.vehicleId));
  return <div className="page-stack"><section className="page-intro"><div><span>PERSONAL SHORTLIST</span><h2>Saved vehicles.</h2><p>Your shortlist is isolated to your authenticated account and stored in PostgreSQL.</p></div></section>{saved.data?.length ? <section className="vehicle-grid">{saved.data.map((vehicle) => <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} saved compared={compareIds.has(vehicle.vehicleId)} onSave={() => remove.mutate(vehicle.vehicleId)} onCompare={() => { const current = readComparison(); if (compareIds.has(vehicle.vehicleId)) writeComparison(current.filter((item) => item.vehicleId !== vehicle.vehicleId)); else if (current.length < 4) writeComparison([...current, vehicle]); else toast.error("Compare up to four vehicles at a time"); }} onDetails={() => setDetailId(vehicle.vehicleId)} />)}</section> : <div className="empty-state surface"><Heart /><strong>No saved vehicles yet</strong><span>Save inventory from Vehicle intelligence to build a shortlist.</span></div>}<VehicleDetails vehicleId={detailId} onClose={() => setDetailId(null)} /></div>;
}

export function CompareVehiclesPage() {
  const items = useComparison();
  if (!items.length) return <div className="page-stack"><section className="page-intro"><div><span>DECISION WORKSPACE</span><h2>Vehicle comparison.</h2><p>Compare up to four normalized vehicles side by side.</p></div></section><div className="empty-state surface"><Plus /><strong>No vehicles selected</strong><span>Add vehicles from the intelligence catalog.</span></div></div>;
  const rows: Array<[string, (vehicle: CatalogVehicle) => string]> = [
    ["Price", (vehicle) => currency(vehicle.priceCents)],
    ["Year", (vehicle) => String(vehicle.year)],
    ["Condition", (vehicle) => vehicle.isUsed ? "Pre-owned" : "New"],
    ["Trim", (vehicle) => vehicle.trim ?? "Not provided"],
    ["Mileage", (vehicle) => vehicle.odometerKm === null ? "Unavailable" : `${vehicle.odometerKm.toLocaleString()} km`],
    ["Dealer", (vehicle) => vehicle.dealerName ?? "Unavailable"],
    ["Location", (vehicle) => vehicle.location ?? "Location unavailable"],
    ["Source", (vehicle) => vehicle.sourceName],
  ];
  return <div className="page-stack"><section className="page-intro"><div><span>DECISION WORKSPACE</span><h2>Vehicle comparison.</h2><p>Source-normalized attributes make meaningful differences easy to scan.</p></div><button className="filter-button" onClick={() => writeComparison([])}>Clear comparison</button></section><section className="surface comparison-table"><table><thead><tr><th>Attribute</th>{items.map((vehicle) => <th key={vehicle.vehicleId}><button aria-label={`Remove ${vehicle.make} ${vehicle.model}`} onClick={() => writeComparison(items.filter((item) => item.vehicleId !== vehicle.vehicleId))}><X size={15} /></button><span>{vehicle.year}</span><strong>{vehicle.make} {vehicle.model}</strong></th>)}</tr></thead><tbody>{rows.map(([label, format]) => <tr key={label}><th>{label}</th>{items.map((vehicle) => <td key={vehicle.vehicleId}>{format(vehicle)}</td>)}</tr>)}</tbody></table></section></div>;
}
