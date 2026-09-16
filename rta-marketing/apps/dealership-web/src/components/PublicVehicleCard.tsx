import { Car, ExternalLink, ImageOff, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "../router/Navigation";
import { API_URL } from "../lib/api";
import type { ScrapedListing } from "../types/domain";

export function PublicVehicleCard({ item }: { item: ScrapedListing }) {
  const thumbnailUrl = item.thumbnailUrl?.trim() || null;
  const [imageUnavailable, setImageUnavailable] = useState(!thumbnailUrl);

  useEffect(() => setImageUnavailable(!thumbnailUrl), [item.id, thumbnailUrl]);

  return <article className="landing-vehicle-card public-vehicle-card">
    <div className="landing-vehicle-card-image">
      {thumbnailUrl && !imageUnavailable
        ? <img src={`${API_URL}/scraping-results/image?url=${encodeURIComponent(thumbnailUrl)}`} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageUnavailable(true)} />
        : <div className="public-vehicle-image-empty" aria-label="Vehicle image unavailable"><Car size={42} /><ImageOff size={16} /></div>}
      <span className="landing-vehicle-badge">{item.siteName}</span>
      {item.year && <span className="landing-vehicle-year">{item.year}</span>}
    </div>
    <div className="landing-vehicle-card-copy">
      <small>{item.city ? `${item.city} · ` : ""}{item.siteName}</small>
      <h4>{item.title}</h4>
      <div><strong>{item.price || "Price not listed"}</strong><span>{item.mileage || "Mileage not listed"}</span></div>
      <div className="public-vehicle-card-actions">
        <a className="landing-vehicle-card-link" href={item.listingUrl} target="_blank" rel="noreferrer">Open listing <ExternalLink size={13} /></a>
        <Link className="public-vehicle-compare-link" to="/login?next=%2Finventory" aria-label={`Sign in to compare ${item.title}`}><Lock size={12} /> Compare</Link>
      </div>
    </div>
  </article>;
}
