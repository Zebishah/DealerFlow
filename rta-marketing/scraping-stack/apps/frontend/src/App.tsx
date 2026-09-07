import { useCallback, useEffect, useState } from "react";

type Site = { id: number; name: string; baseUrl: string; itemCount: number; lastScrapedAt: string | null };
type Item = { id: number; title: string; price: string | null; year: string | null; mileage: string | null; city: string | null; listingUrl: string; thumbnailUrl: string | null; scrapedAt: string };
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function sourceKey(site: Site): string {
  if (site.baseUrl.includes("pakwheels.com")) return "pakwheels";
  if (site.baseUrl.includes("olx.com.pk")) return "olx-pakistan";
  return "demo-synthetic";
}

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<{ site: Site; items: Item[] } | null>(null);
  const [triggeringSite, setTriggeringSite] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/sites`);
    if (!response.ok) throw new Error("API request failed");
    const value = await response.json() as { data: Site[] };
    setSites(value.data);
  }, []);

  useEffect(() => {
    void loadSites().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "API unavailable"));
  }, [loadSites]);

  async function openSite(site: Site): Promise<void> {
    try {
      const response = await fetch(`${apiUrl}/api/sites/${site.id}`);
      if (!response.ok) throw new Error("Site request failed");
      const value = await response.json() as { data: { site: Site; items: Item[] } };
      setSelected(value.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load site results");
    }
  }

  async function triggerScrape(site: Site): Promise<void> {
    setTriggeringSite(site.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/scrape/${sourceKey(site)}`, { method: "POST" });
      const value = await response.json() as { data?: { jobId: string }; error?: string };
      if (!response.ok) throw new Error(value.error ?? "Could not queue scrape");
      setNotice(`${site.name} queued successfully (job ${value.data?.jobId}). Results will refresh after the worker finishes.`);
      window.setTimeout(() => { void loadSites(); }, 10_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not queue scrape");
    } finally {
      setTriggeringSite(null);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">RTA AUTOMOTIVE GROUP</p>
        <h1>Scraping monitor</h1>
        <p>Trigger real PakWheels and OLX crawls from the dashboard. Jobs run through BullMQ and persist results in Neon.</p>
      </header>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <section className="grid">
        {sites.map((site) => (
          <article className="site-card" key={site.id}>
            <button className="site-link" onClick={() => void openSite(site)}>
              <h2>{site.name}</h2>
              <span>{site.itemCount} items</span>
              <small>{site.lastScrapedAt ? new Date(site.lastScrapedAt).toLocaleString() : "Not scraped yet"}</small>
            </button>
            <button className="scrape-button" disabled={triggeringSite === site.id} onClick={() => void triggerScrape(site)}>
              {triggeringSite === site.id ? "Queuing…" : "Scrape now"}
            </button>
          </article>
        ))}
      </section>
      {selected && (
        <section className="results">
          <button onClick={() => setSelected(null)}>← All sites</button>
          <h2>{selected.site.name}</h2>
          {selected.items.length ? (
            <ul>
              {selected.items.map((item) => (
                <li key={item.id}>
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" loading="lazy" />}
                  <div>
                    <a href={item.listingUrl} target="_blank" rel="noreferrer">{item.title}</a>
                    <span>{[item.price, item.year, item.mileage, item.city].filter(Boolean).join(" · ") || "Details unavailable"}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p>No scraped items yet.</p>}
        </section>
      )}
    </main>
  );
}
