import { useCallback, useEffect, useState, type FormEvent } from "react";

type Site = { id: number; name: string; baseUrl: string; itemCount: number; lastScrapedAt: string | null };
type Item = { id: number; title: string; price: string | null; year: string | null; mileage: string | null; city: string | null; listingUrl: string; thumbnailUrl: string | null; scrapedAt: string };
type JobStatus = "queued" | "scraping" | "completed" | "failed";
type ActiveJob = { jobId: string; siteKey: string; limit: number; status: JobStatus; failedReason?: string | null };
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const dealershipWebUrl = import.meta.env.VITE_DEALERSHIP_WEB_URL ?? "http://localhost:5173";
const scrapeControlBase = import.meta.env.PROD ? "" : apiUrl;

function scrapeControlPath(path: string): string {
  return `${scrapeControlBase}${path}`;
}

function sourceKey(site: Site): string {
  if (site.baseUrl.includes("pakwheels.com")) return "pakwheels";
  if (site.baseUrl.includes("olx.com.pk")) return "olx-pakistan";
  return "demo-synthetic";
}

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<{ site: Site; items: Item[] } | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [scrapeLimit, setScrapeLimit] = useState(5);
  const [authorized, setAuthorized] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/sites`);
    if (!response.ok) throw new Error("API request failed");
    const value = await response.json() as { data: Site[] };
    setSites(value.data);
  }, []);

  const loadScrapeStatus = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/scrape/status`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load scrape status");
    const value = await response.json() as { data: { activeJob: ActiveJob | null } };
    setActiveJob(value.data.activeJob);
  }, []);

  const loadScrapeSession = useCallback(async () => {
    const response = await fetch(scrapeControlPath("/api/scrape-session"), { credentials: "include" });
    if (!response.ok) return;
    const value = await response.json() as { data: { authenticated: boolean } };
    setAuthorized(value.data.authenticated);
  }, []);

  useEffect(() => {
    void loadSites().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "API unavailable"));
    void loadScrapeStatus().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load scrape status"));
    void loadScrapeSession();
  }, [loadScrapeSession, loadScrapeStatus, loadSites]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "queued" && activeJob.status !== "scraping")) return undefined;
    const pollHandle = window.setInterval(() => {
      void fetch(`${apiUrl}/api/scrape/jobs/${encodeURIComponent(activeJob.jobId)}`, { credentials: "include" })
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
    if (!authorized || (activeJob && (activeJob.status === "queued" || activeJob.status === "scraping"))) return;
    setNotice("");
    setError("");
    try {
      const response = await fetch(scrapeControlPath(`/api/scrape/${sourceKey(site)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: scrapeLimit }),
      });
      const value = await response.json() as { data?: ActiveJob; error?: string };
      if (response.status === 401) setAuthorized(false);
      if (value.data) setActiveJob(value.data);
      if (!response.ok) throw new Error(value.error ?? "Could not queue scrape");
      setNotice(`${site.name} queued for up to ${value.data?.limit ?? scrapeLimit} vehicles.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not queue scrape");
    }
  }

  async function unlockScraping(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      const response = await fetch(scrapeControlPath("/api/scrape-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(import.meta.env.PROD ? { accessCode } : { token: accessCode }),
      });
      setAccessCode("");
      if (!response.ok) throw new Error(response.status === 429 ? "Too many access attempts. Try again later." : "Scrape access was not accepted.");
      setAuthorized(true);
      setNotice("Scrape access enabled for this browser session.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not enable scrape access");
    }
  }

  async function logoutScraping(): Promise<void> {
    await fetch(scrapeControlPath("/api/scrape-session/logout"), { method: "POST", credentials: "include" }).catch(() => undefined);
    setAuthorized(false);
    setNotice("Scrape access ended.");
  }

  const workerBusy = Boolean(activeJob && (activeJob.status === "queued" || activeJob.status === "scraping"));

  return (
    <main>
      <header>
        <p className="eyebrow">RTA AUTOMOTIVE GROUP</p>
        <h1>Scraping monitor</h1>
        <p>Trigger real PakWheels and OLX crawls from the dashboard. Jobs run through BullMQ and persist results in Neon.</p>
        <label className="limit-control">Vehicles per run
          <input type="number" min="1" max="10" value={scrapeLimit} onChange={(event) => setScrapeLimit(Math.min(Math.max(Number(event.target.value) || 1, 1), 10))} />
        </label>
        <section className="access-panel">
          {authorized ? (
            <div className="access-active"><span>Scrape access enabled for this browser session.</span><button type="button" onClick={() => void logoutScraping()}>End access</button></div>
          ) : (
            <form onSubmit={(event) => void unlockScraping(event)}>
              <label>Recruiter access code
                <input type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Enter the private access code" />
              </label>
              <button type="submit" disabled={!accessCode}>Unlock scraping</button>
            </form>
          )}
          <small>The code is exchanged for an HTTP-only session and is never stored in the frontend bundle. Recruiters can explore this surface through the <a href={`${dealershipWebUrl}/login?request=1`}>dealership demo</a> or <a href={`${dealershipWebUrl}/login?request=1`}>request full access</a>.</small>
        </section>
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
            <button className="scrape-button" disabled={workerBusy || !authorized} onClick={() => void triggerScrape(site)}>
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
