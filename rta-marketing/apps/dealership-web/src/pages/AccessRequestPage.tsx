import { ArrowLeft, ArrowRight, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { AuthStory } from "../components/AuthPageLayout";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Link, Redirect } from "../router/Navigation";
import { useAuth } from "../auth/AuthContext";

const permissionOptions = [
  ["view", "View dashboards and records"],
  ["create", "Create records"],
  ["edit", "Edit records"],
  ["upload_documents", "Upload documents"],
  ["run_scrape", "Run approved scraping"],
  ["admin_evaluation", "Admin-level evaluation"],
] as const;

export function AccessRequestPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    company: "",
    jobTitle: "",
    email: "",
    linkedInUrl: "",
    reason: "",
    platformScope: ["dealership", "scraping"],
    requestedPermissions: ["view"],
    requestedDuration: "3_days",
    message: "",
  });

  if (user && !user.isDemoRecruiter) return <Redirect to="/app/overview" />;

  function toggle(name: "platformScope" | "requestedPermissions", value: string) {
    setForm((current) => ({
      ...current,
      [name]: current[name].includes(value)
        ? current[name].filter((item) => item !== value)
        : [...current[name], value],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/access-requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          linkedInUrl: form.linkedInUrl || undefined,
          message: form.message || undefined,
        }),
      });
      setSubmitted(true);
      toast.success("Access request submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page access-request-page">
    <AuthStory evaluation />
    <section className="login-panel access-request-panel">
      <div className="login-form-wrap access-request-form-wrap">
        <Link className="access-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
        {submitted ? <div className="auth-success access-request-success"><CheckCircle2 size={40} /><span className="eyebrow">REQUEST RECEIVED</span><h2>We’ll review your request.</h2><p>Your request has been sent for approval. If access is approved, you’ll receive a secure invitation with the exact permissions granted.</p><Link className="auth-primary-link" to="/login">Return to sign in <ArrowRight size={16} /></Link></div> : <>
          <div className="access-request-heading"><span className="eyebrow">EVALUATION ACCESS</span><h2>Request full access</h2><p>Tell us what you want to evaluate. Approved access is scoped, time-limited, and never turns an external reviewer into an administrator.</p></div>
          <form className="access-request-form" onSubmit={(event) => void submit(event)}>
            <div className="form-grid"><label>Full name<input required maxLength={120} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Work email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Company<input required maxLength={160} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label><label>Job title / role<input required maxLength={120} value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></label><label className="form-span">LinkedIn URL <span className="optional-label">(optional)</span><input type="url" maxLength={500} placeholder="https://linkedin.com/in/..." value={form.linkedInUrl} onChange={(event) => setForm({ ...form, linkedInUrl: event.target.value })} /></label><label className="form-span">What do you want to evaluate?<textarea required minLength={20} maxLength={2000} rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example: dealership workflows and the vehicle ingestion pipeline." /></label>
              <fieldset className="form-span"><legend>Platform scope</legend><div className="choice-grid">{([['dealership', 'Dealership platform'], ['scraping', 'Vehicle data platform']] as const).map(([value, label]) => <label key={value} className="choice-card"><input type="checkbox" checked={form.platformScope.includes(value)} onChange={() => toggle("platformScope", value)} /><span><Check size={13} />{label}</span></label>)}</div></fieldset>
              <fieldset className="form-span"><legend>Requested permissions</legend><div className="choice-grid choice-grid--three">{permissionOptions.map(([value, label]) => <label key={value} className="choice-card"><input type="checkbox" checked={form.requestedPermissions.includes(value)} onChange={() => toggle("requestedPermissions", value)} /><span><Check size={13} />{label}</span></label>)}</div></fieldset>
              <label>Requested duration<select value={form.requestedDuration} onChange={(event) => setForm({ ...form, requestedDuration: event.target.value })}><option value="24_hours">24 hours</option><option value="3_days">3 days</option><option value="7_days">7 days</option></select></label><label>Additional message <span className="optional-label">(optional)</span><input maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
            </div>
            <button type="submit" className="submit-button" disabled={busy || !form.platformScope.length || !form.requestedPermissions.length}>{busy ? "Submitting request…" : <>Submit access request <ArrowRight size={17} /></>}</button>
          </form>
          <p className="access-request-note"><ShieldCheck size={14} /> Access is reviewed by an RTA administrator and expires automatically.</p>
        </>}
      </div>
    </section>
  </main>;
}
