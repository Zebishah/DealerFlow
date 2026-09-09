import { useCallback, useEffect, useState } from "react";

type Site = { id: number; name: string; baseUrl: string; itemCount: number; lastScrapedAt: string | null };
type Item = { id: number; title: string; price: string | null; year: string | null; mileage: string | null; city: string | null; listingUrl: string; thumbnailUrl: string | null; scrapedAt: string };
type JobStatus = "queued" | "scraping" | "completed" | "failed";
type ActiveJob = { jobId: string; siteKey: string; limit: number; status: JobStatus; failedReason?: string | null };
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function sourceKey(site: Site): string {
  if (site.baseUrl.includes("pakwheels.com")) return "pakwheels";
  if (site.baseUrl.includes("olx.com.pk")) return "olx-pakistan";
  return "demo-synthetic";
}

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<{ site: Site; items: Item[] } | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [scrapeLimit, setScrapeLimit] = useState(10);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/sites`);
    if (!response.ok) throw new Error("API request failed");
    const value = await response.json() as { data: Site[] };
    setSites(value.data);
  }, []);

  const loadScrapeStatus = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/scrape/status`);
    if (!response.ok) throw new Error("Could not load scrape status");
    const value = await response.json() as { data: { activeJob: ActiveJob | null } };
    setActiveJob(value.data.activeJob);
  }, []);

  useEffect(() => {
    void loadSites().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "API unavailable"));
    void loadScrapeStatus().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load scrape status"));
  }, [loadScrapeStatus, loadSites]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "queued" && activeJob.status !== "scraping")) return undefined;
    const pollHandle = window.setInterval(() => {
      void fetch(`${apiUrl}/api/scrape/jobs/${encodeURIComponent(activeJob.jobId)}`)
        .then(async (response) => {
          if (response.status === 404) {
            setActiveJob(null);
            return null;
          }
          if (!response.ok) throw new Error("Could not refresh scrape status");
          return response.json() as Promise<{ data: ActiveJob }>;
        })
        .then((value) => {
          if (!value) return;
          setActiveJob(value.data);
          if (value.data.status === "completed" || value.data.status === "failed") {
            void loadSites();
            window.setTimeout(() => setActiveJob(null), 2500);
            if (value.data.status === "completed") setNotice(`${value.data.siteKey} completed. Results refreshed.`);
            else setError(value.data.failedReason ?? "Scrape failed after retries");
          }
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not refresh scrape status"));
    }, 2000);
    return () => window.clearInterval(pollHandle);
  }, [activeJob, loadSites]);

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
    if (activeJob && (activeJob.status === "queued" || activeJob.status === "scraping")) return;
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/scrape/${sourceKey(site)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: scrapeLimit }),
      });
      const value = await response.json() as { data?: ActiveJob; error?: string };
      if (value.data) setActiveJob(value.data);
      if (!response.ok) throw new Error(value.error ?? "Could not queue scrape");
      setNotice(`${site.name} queued for up to ${value.data?.limit ?? scrapeLimit} vehicles.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not queue scrape");
    }
  }

  const workerBusy = Boolean(activeJob && (activeJob.status === "queued" || activeJob.status === "scraping"));

  return (
    <main>
      <header>
        <p className="eyebrow">RTA AUTOMOTIVE GROUP</p>
        <h1>Scraping monitor</h1>
        <p>Trigger real PakWheels and OLX crawls from the dashboard. Jobs run through BullMQ and persist results in Neon.</p>
        <label className="limit-control">Vehicles per run
          <input type="number" min="1" max="20" value={scrapeLimit} onChange={(event) => setScrapeLimit(Math.min(Math.max(Number(event.target.value) || 1, 1), 20))} />
        </label>
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
            <div className="status-row">
              <span className={`job-status ${activeJob?.siteKey === sourceKey(site) ? activeJob.status : "idle"}`}>
                {activeJob?.siteKey === sourceKey(site) ? activeJob.status : workerBusy ? "Worker busy" : "Ready"}
              </span>
              {activeJob?.siteKey === sourceKey(site) && <small>up to {activeJob.limit} vehicles</small>}
            </div>
            <button className="scrape-button" disabled={workerBusy} onClick={() => void triggerScrape(site)}>
              {activeJob?.siteKey === sourceKey(site) && activeJob.status === "scraping" ? "Scraping…" : activeJob?.siteKey === sourceKey(site) && activeJob.status === "queued" ? "Queued…" : workerBusy ? "Worker busy" : "Scrape now"}
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
