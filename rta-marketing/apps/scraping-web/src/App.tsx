import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RtaAssistant, type AssistantAnswer, type AssistantRequest } from "@rta/assistant-ui";

type Site = { id: number; name: string; baseUrl: string; itemCount: number; lastScrapedAt: string | null };
type Item = { id: number; title: string; price: string | null; year: string | null; mileage: string | null; city: string | null; listingUrl: string; thumbnailUrl: string | null; scrapedAt: string };
type JobStatus = "queued" | "scraping" | "retrying" | "completed" | "failed";
type ActiveJob = { jobId: string; siteKey: string; limit: number; status: JobStatus; attempt?: number; maxAttempts?: number; elapsedMs?: number; progressStage?: string | null; requestedCount?: number; foundCount?: number | null; failedReason?: string | null };
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const dealershipWebUrl = import.meta.env.VITE_DEALERSHIP_WEB_URL ?? "http://localhost:5173";
const scrapeControlBase = import.meta.env.PROD ? "" : apiUrl;
const dealershipApiUrl = (import.meta.env.VITE_DEALERSHIP_API_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");

function scrapeControlPath(path: string): string {
  return `${scrapeControlBase}${path}`;
}

function sourceKey(site: Site): string {
  if (site.baseUrl.includes("pakwheels.com")) return "pakwheels";
  if (site.baseUrl.includes("olx.com.pk")) return "olx-pakistan";
  return "demo-synthetic";
}

function formatElapsed(milliseconds = 0): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1_000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function stageLabel(stage?: string | null): string {
  return ({ "checking-source": "checking source", "configured-delay": "respecting source delay", "launching-browser": "launching browser", "loading-page": "loading page", extracting: "extracting listings", saving: "saving results" } as Record<string, string>)[stage ?? ""] ?? "working";
}

function jobLabel(job: ActiveJob): string {
  if (job.status === "retrying") return `Retrying · attempt ${job.attempt ?? 1} of ${job.maxAttempts ?? 2}`;
  if (job.status === "scraping") return `Scraping · ${formatElapsed(job.elapsedMs)}`;
  if (job.status === "queued") return `Queued · ${formatElapsed(job.elapsedMs)}`;
  return job.status === "completed" ? "Completed" : "Failed";
}

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [selected, setSelected] = useState<{ site: Site; items: Item[] } | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [scrapeLimit, setScrapeLimit] = useState(5);
  const [authorized, setAuthorized] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutDialog = useRef<HTMLDialogElement>(null);
  const sessionVersion = useRef(0);
  const [accessCode, setAccessCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    const dialog = logoutDialog.current;
    if (logoutOpen && dialog && !dialog.open) dialog.showModal();
    else if (!logoutOpen && dialog?.open) dialog.close();
  }, [logoutOpen]);

  const loadSites = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/sites`);
    if (!response.ok) throw new Error("API request failed");
    const value = await response.json() as { data: Site[] };
    setSites(value.data);
    setSourcesLoaded(true);
  }, []);

  const loadScrapeStatus = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/scrape/status`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load scrape status");
    const value = await response.json() as { data: { activeJob: ActiveJob | null } };
    setActiveJob(value.data.activeJob);
    setStatusLoaded(true);
  }, []);

  const loadScrapeSession = useCallback(async () => {
    const version = sessionVersion.current;
    const response = await fetch(scrapeControlPath("/api/scrape-session"), { credentials: "include" });
    if (!response.ok) return;
    const value = await response.json() as { data: { authenticated: boolean } };
    if (version === sessionVersion.current) setAuthorized(value.data.authenticated);
  }, []);

  useEffect(() => {
    void loadSites().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "API unavailable"));
    void loadScrapeStatus().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load scrape status"));
    void loadScrapeSession().catch(() => setError("Access status could not be checked. Refresh the page to try again."));
  }, [loadScrapeSession, loadScrapeStatus, loadSites]);

  useEffect(() => {
    if (!activeJob || !["queued", "scraping", "retrying"].includes(activeJob.status)) return undefined;
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
            if (value.data.status === "completed") setNotice(`${value.data.siteKey} completed. Requested: ${value.data.requestedCount ?? value.data.limit}; found: ${value.data.foundCount ?? 0}. Results refreshed.`);
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
    if (!authorized || (activeJob && ["queued", "scraping", "retrying"].includes(activeJob.status))) return;
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
    if (unlocking) return;
    sessionVersion.current += 1;
    setUnlocking(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(scrapeControlPath("/api/scrape-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(import.meta.env.PROD ? { accessCode } : { token: accessCode }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "Too many access attempts. Try again later." : "Scrape access was not accepted.");
      setAccessCode("");
      setAuthorized(true);
      setNotice("Scrape access enabled for this browser session.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not enable scrape access");
    } finally {
      setUnlocking(false);
    }
  }

  async function logoutScraping(): Promise<void> {
    if (loggingOut) return;
    sessionVersion.current += 1;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch(scrapeControlPath("/api/scrape-session/logout"), { method: "POST", credentials: "include" });
      if (!response.ok && response.status !== 401) throw new Error("Access could not be ended. Please try again.");
      setAuthorized(false);
      setAccessCode("");
      setLogoutOpen(false);
      setNotice("Scrape access ended.");
      setError("");
    } catch (reason) {
      setLogoutError(reason instanceof Error ? reason.message : "Access could not be ended. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  const workerBusy = Boolean(activeJob && ["queued", "scraping", "retrying"].includes(activeJob.status));

  async function askAssistant(input: AssistantRequest): Promise<AssistantAnswer> {
    const response = await fetch(`${dealershipApiUrl}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await response.json() as { data?: AssistantAnswer; error?: { message?: string } };
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "The assistant is temporarily unavailable.");
    return payload.data;
  }

  return (
    <main className="scraping-monitor">
      <RtaAssistant authenticated={false} path="/scraping-monitor" request={askAssistant} productLabel="Dealer Flow Scraping Assistant" />
      <header>
        <div className="monitor-brand-row"><a className="monitor-brand" href={dealershipWebUrl}><span>R</span>Dealer Flow<span className="monitor-brand-label">VEHICLE INTELLIGENCE</span></a><a className="monitor-workspace-link" href={`${dealershipWebUrl}/login`}>Open dealership workspace ↗</a></div><p className="eyebrow">YOUR CONNECTED VEHICLE DATA WORKSPACE</p>
        <h1>Better data.<br /><span>A clearer next move.</span></h1>
        <p className="monitor-lede">Monitor approved vehicle sources, collect current listings, and keep every acquisition run in view.</p>
        <label className="limit-control">Vehicles per run
          <input type="number" min="1" max="10" value={scrapeLimit} onChange={(event) => setScrapeLimit(Math.min(Math.max(Number(event.target.value) || 1, 1), 10))} />
        </label>
        <section className="access-panel">
          {authorized ? (
            <div className="access-active"><span>Scrape access enabled for this browser session.</span><button type="button" onClick={() => { setLogoutError(""); setLogoutOpen(true); }}>End access</button></div>
          ) : (
            <form onSubmit={(event) => void unlockScraping(event)}>
              <label>Private acquisition access code
                <input type="password" autoComplete="off" disabled={unlocking} required value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Enter the private access code" />
              </label>
              <button type="submit" disabled={!accessCode.trim() || unlocking}>{unlocking ? "Unlocking…" : "Unlock scraping"}</button>
            </form>
          )}
          <small>Acquisition controls require a private access session. Explore the connected product in the <a href={`${dealershipWebUrl}/login`}>dealership demo</a> or <a href={`${dealershipWebUrl}/request-access`}>request full access</a>.</small>
        </section>
      </header>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <section className="monitor-summary" aria-label="Acquisition overview"><article><span>Connected sources</span><strong>{sourcesLoaded ? sites.length : "—"}</strong><small>Available data sources</small></article><article><span>Collected listings</span><strong>{sourcesLoaded ? sites.reduce((total, site) => total + site.itemCount, 0) : "—"}</strong><small>Persisted source records</small></article><article><span>Acquisition status</span><strong>{!statusLoaded ? "Unknown" : workerBusy ? "Processing" : "Idle"}</strong><small>{!statusLoaded ? "Waiting for status" : workerBusy ? "A run is in progress" : "No acquisition run in progress"}</small></article></section>
      <div className="monitor-section-heading"><div><span className="eyebrow">ACQUISITION CONTROL</span><h2>Your vehicle sources</h2></div><p>Inspect listings. Follow each run.</p></div>
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
                {activeJob?.siteKey === sourceKey(site) ? jobLabel(activeJob) : workerBusy ? "Worker busy" : "Ready"}
              </span>
              {activeJob?.siteKey === sourceKey(site) && <small>{activeJob.progressStage ? stageLabel(activeJob.progressStage) : `up to ${activeJob.limit} vehicles`}</small>}
            </div>
            <button className="scrape-button" disabled={workerBusy || !authorized} onClick={() => void triggerScrape(site)}>
              {activeJob?.siteKey === sourceKey(site) && ["scraping", "retrying"].includes(activeJob.status) ? activeJob.status === "retrying" ? "Retrying…" : "Scraping…" : activeJob?.siteKey === sourceKey(site) && activeJob.status === "queued" ? "Queued…" : workerBusy ? "Worker busy" : "Scrape now"}
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
      <dialog ref={logoutDialog} className="access-confirmation" aria-labelledby="end-access-title" aria-describedby="end-access-description" aria-busy={loggingOut} onCancel={(event) => { event.preventDefault(); if (!loggingOut) setLogoutOpen(false); }}>
        <span className="eyebrow">ACQUISITION ACCESS</span>
        <h2 id="end-access-title">End access for this browser?</h2>
        <p id="end-access-description">You’ll need the private access code to start another run. Runs already in progress will continue.</p>
        {logoutError && <p className="error" role="alert">{logoutError}</p>}
        <footer><button type="button" autoFocus disabled={loggingOut} onClick={() => setLogoutOpen(false)}>Keep access</button><button type="button" className="confirm-end-access" disabled={loggingOut} onClick={() => void logoutScraping()}>{loggingOut ? "Ending access…" : "End access"}</button></footer>
      </dialog>
    </main>
  );
}
