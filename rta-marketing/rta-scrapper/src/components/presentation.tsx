import { ArrowRight, Car, Loader2, type LucideIcon } from "lucide-react";
import type { ScrapeRun } from "../types/platform";
import { formatRelativeTime } from "../lib/format";

export function StatusPill({ status }: { status: string | null }) {
  const normalized = status ?? "idle";
  return <span className={`status status-${normalized}`}><i />{normalized.replace("_", " ")}</span>;
}

export function Metric({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return <div className="metric-card"><div className="metric-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

export function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: () => void }) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={action}>View all <ArrowRight size={15} /></button>}</div>;
}

export function RunTable({ runs, compact = false }: { runs: ScrapeRun[]; compact?: boolean }) {
  if (!runs.length) return <Empty title="No acquisition runs yet" />;
  return <div className="run-list">{runs.slice(0, compact ? 4 : 10).map((run) => <div className="run-row" key={run.id}><div className="run-id"><strong>RUN-{run.id.slice(0, 8).toUpperCase()}</strong><span>{formatRelativeTime(run.createdAt)} · {run.mode}</span></div><div className="run-progress"><div><span>{run.completedSourceCount}/{run.sourceCount} sources</span><span>{run.discoveredCount} listings</span></div><div className="progress-track"><i style={{ width: `${run.sourceCount ? (run.completedSourceCount / run.sourceCount) * 100 : 0}%` }} /></div></div><StatusPill status={run.status} /></div>)}</div>;
}

export function Loading() { return <div className="loading" role="status"><Loader2 className="spin" />Loading market intelligence…</div>; }

export function Empty({ title, message = "Run an acquisition to populate the catalog." }: { title: string; message?: string }) {
  return <div className="empty"><Car size={34} /><strong>{title}</strong><span>{message}</span></div>;
}
