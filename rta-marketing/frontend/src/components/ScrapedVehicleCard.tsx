import { Car, ChevronRight, ExternalLink, Heart, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { WorkflowModal } from "./WorkflowModal";
import type { ScrapedListing } from "../types/domain";

const representativeVehicleImages = [
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=80",
];

function displaySiteName(name: string): string {
  return name.replace(/^Demo Source \(synthetic data\)$/i, "Generated inventory");
}

function ListingImage({ item }: { item: ScrapedListing }) {
  const fallbackUrl = representativeVehicleImages[Math.abs(item.id) % representativeVehicleImages.length] ?? representativeVehicleImages[0];
  const [sourceFailed, setSourceFailed] = useState(!item.thumbnailUrl);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(item.thumbnailUrl));

  useEffect(() => {
    setSourceFailed(!item.thumbnailUrl);
    setFallbackFailed(false);
    setLoading(Boolean(item.thumbnailUrl));
    if (!item.thumbnailUrl) return;
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setSourceFailed(true);
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [item.thumbnailUrl]);

  if (fallbackFailed) {
    return <div className="vehicle-photo-placeholder" aria-label="Image unavailable">
      <ImageOff size={38} aria-hidden="true" />
      <span>Image unavailable</span>
    </div>;
  }

  const imageSrc = sourceFailed
    ? fallbackUrl
    : item.thumbnailUrl
      ? `${API_URL}/scraping-results/image?url=${encodeURIComponent(item.thumbnailUrl)}`
      : fallbackUrl;
  return <>
    <img
      src={imageSrc}
      alt={item.title}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoading(false)}
      onError={() => {
        setLoading(false);
        if (sourceFailed) setFallbackFailed(true);
        else setSourceFailed(true);
      }}
    />
    {sourceFailed && <span className="vehicle-image-fallback-label">Representative image</span>}
    {loading && <div className="vehicle-image-loading" aria-label="Loading image"><Loader2 size={24} className="spin" /></div>}
  </>;
}

export function ScrapedVehicleCard({
  item,
  saved = false,
  compared = false,
  onSave,
  onCompare,
  onDetails,
}: {
  item: ScrapedListing;
  saved?: boolean;
  compared?: boolean;
  onSave?: () => void;
  onCompare?: () => void;
  onDetails?: () => void;
}) {
  const openDetails = () => onDetails?.();

  return <article
    className="vehicle-card scraped-vehicle-card"
    role={onDetails ? "button" : undefined}
    tabIndex={onDetails ? 0 : undefined}
    onClick={onDetails}
    onKeyDown={(event) => {
      if (onDetails && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openDetails();
      }
    }}
  >
    <div className="vehicle-photo">
      <ListingImage item={item} />
      <span className="vehicle-source-label">{displaySiteName(item.siteName)}</span>
      {onSave && <button className={`vehicle-save ${saved ? "active" : ""}`} type="button" onClick={(event) => { event.stopPropagation(); onSave(); }} aria-label={saved ? "Remove saved vehicle" : "Save vehicle"} title={saved ? "Remove from saved vehicles" : "Save vehicle"}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>}
    </div>
    <div className="vehicle-info">
      <small>{item.year ?? "YEAR UNAVAILABLE"}</small>
      <h3 title={item.title}>{item.title}</h3>
      <p>{item.city ?? "Location unavailable"}</p>
      <strong title={item.price ?? "Price unavailable"}>{item.price ?? "Price unavailable"}</strong>
      <div><span>{item.mileage ?? "Mileage unavailable"}</span><span>{new Date(item.scrapedAt).toLocaleDateString("en-CA")}</span></div>
      <footer className="vehicle-actions">
        {onCompare && <button
          type="button"
          className={compared ? "comparison-active" : ""}
          onClick={(event) => { event.stopPropagation(); onCompare(); }}
        >{compared ? "Added to compare" : "Compare"}</button>}
        <button type="button" className="vehicle-details-action" onClick={(event) => { event.stopPropagation(); openDetails(); }}>
          View details <ChevronRight size={15} />
        </button>
        <a
          className="vehicle-link-action"
          href={item.listingUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >Open listing <ExternalLink size={13} /></a>
      </footer>
    </div>
  </article>;
}

export function ScrapedVehicleDetailsModal({
  item,
  onClose,
}: {
  item: ScrapedListing | null;
  onClose: () => void;
}) {
  return <WorkflowModal
    open={Boolean(item)}
    eyebrow="SCRAPED VEHICLE"
    title={item?.title ?? "Vehicle details"}
    description="The complete listing record saved by the scraper, including source provenance and the original listing link."
    onClose={onClose}
  >
    {item && <div className="scraped-vehicle-details">
      <div className="scraped-detail-preview">
        <ListingImage item={item} />
        <span className="vehicle-source-label">{displaySiteName(item.siteName)}</span>
      </div>
      <div className="detail-facts scraped-detail-facts">
        <span><small>Price</small><strong>{item.price ?? "Unavailable"}</strong></span>
        <span><small>Year</small><strong>{item.year ?? "Unavailable"}</strong></span>
        <span><small>Mileage</small><strong>{item.mileage ?? "Unavailable"}</strong></span>
        <span><small>City</small><strong>{item.city ?? "Unavailable"}</strong></span>
        <span><small>Scraped</small><strong>{new Date(item.scrapedAt).toLocaleString("en-CA")}</strong></span>
        <span><small>Source</small><strong>{displaySiteName(item.siteName)}</strong></span>
      </div>
      <div className="scraped-detail-link">
        <a href={item.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open original listing</a>
      </div>
    </div>}
  </WorkflowModal>;
}

export function ScrapedVehicleEmptyImage() {
  return <div className="vehicle-photo-placeholder"><Car size={38} aria-hidden="true" /><span>Image unavailable</span></div>;
}
