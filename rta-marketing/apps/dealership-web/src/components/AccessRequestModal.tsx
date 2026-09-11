import { Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

const permissionOptions = [
  ["view", "View dashboards and records"],
  ["create", "Create records"],
  ["edit", "Edit records"],
  ["upload_documents", "Upload documents"],
  ["run_scrape", "Run approved scraping"],
  ["admin_evaluation", "Admin-level evaluation"],
] as const;

export function AccessRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", company: "", jobTitle: "", email: "", linkedInUrl: "", reason: "", platformScope: ["dealership", "scraping"], requestedPermissions: ["view"], requestedDuration: "3_days", message: "" });
  if (!open) return null;

  function toggle(name: "platformScope" | "requestedPermissions", value: string) {
    setForm((current) => ({ ...current, [name]: current[name].includes(value) ? current[name].filter((item) => item !== value) : [...current[name], value] }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/access-requests", { method: "POST", body: JSON.stringify({ ...form, linkedInUrl: form.linkedInUrl || undefined, message: form.message || undefined }) });
      toast.success("Access request submitted");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  return <div className="access-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="access-modal" role="dialog" aria-modal="true" aria-labelledby="access-request-title">
      <header><div><span className="eyebrow">EVALUATION ACCESS</span><h2 id="access-request-title">Request full access</h2><p>Tell us what you want to evaluate. Approved access is scoped and time-limited.</p></div><button type="button" className="modal-close" aria-label="Close request form" onClick={onClose}><X size={18} /></button></header>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid"><label>Full name<input required maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Work email<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Company<input required maxLength={160} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label><label>Job title / role<input required maxLength={120} value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></label><label className="form-span">LinkedIn URL <span className="optional-label">(optional)</span><input type="url" maxLength={500} placeholder="https://linkedin.com/in/..." value={form.linkedInUrl} onChange={(event) => setForm({ ...form, linkedInUrl: event.target.value })} /></label><label className="form-span">What do you want to evaluate?<textarea required minLength={20} maxLength={2000} rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example: dealership workflows and the vehicle ingestion pipeline." /></label>
          <fieldset className="form-span"><legend>Platform scope</legend><div className="choice-grid">{([["dealership", "Dealership platform"], ["scraping", "Vehicle data platform"]] as const).map(([value, label]) => <label key={value} className="choice-card"><input type="checkbox" checked={form.platformScope.includes(value)} onChange={() => toggle("platformScope", value)} /><span><Check size={13} />{label}</span></label>)}</div></fieldset>
          <fieldset className="form-span"><legend>Requested permissions</legend><div className="choice-grid choice-grid--three">{permissionOptions.map(([value, label]) => <label key={value} className="choice-card"><input type="checkbox" checked={form.requestedPermissions.includes(value)} onChange={() => toggle("requestedPermissions", value)} /><span><Check size={13} />{label}</span></label>)}</div></fieldset>
          <label>Requested duration<select value={form.requestedDuration} onChange={(event) => setForm({ ...form, requestedDuration: event.target.value })}><option value="24_hours">24 hours</option><option value="3_days">3 days</option><option value="7_days">7 days</option></select></label><label>Additional message <span className="optional-label">(optional)</span><input maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        </div>
        <footer className="modal-actions"><button type="button" className="filter-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-action" disabled={busy || !form.platformScope.length || !form.requestedPermissions.length}>{busy ? "Submitting…" : "Submit request"}</button></footer>
      </form>
    </section>
  </div>;
}
