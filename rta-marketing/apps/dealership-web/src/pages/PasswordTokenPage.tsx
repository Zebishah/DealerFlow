import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";

export function PasswordTokenPage({ mode }: { mode: "reset" | "setup" }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSubmitting(true);
    try {
      await api(`/auth/${mode === "reset" ? "reset-password" : "setup-access"}`, { method: "POST", body: JSON.stringify({ token, password, confirmPassword }) });
      setDone(true);
    } catch (error) {
      setInvalid(error instanceof ApiError && (error.code === "INVALID_RESET_TOKEN" || error.code === "INVALID_ACCESS_INVITE"));
      toast.error(error instanceof Error ? error.message : "This link is no longer valid");
    } finally { setSubmitting(false); }
  }
  if (invalid) return <main className="auth-page"><section className="auth-card auth-state"><AuthBrand /><AlertCircle className="auth-state-icon auth-state-icon--error" size={40} /><span className="eyebrow">LINK UNAVAILABLE</span><h1>This link is invalid.</h1><p>Request a new link or return to sign in.</p><Link className="auth-primary-link" to={mode === "reset" ? "/forgot-password" : "/login"}>Continue <ArrowRight size={16} /></Link></section></main>;
  if (done) return <main className="auth-page"><section className="auth-card auth-state"><AuthBrand /><CheckCircle2 className="auth-state-icon" size={40} /><span className="eyebrow">SECURE ACCESS READY</span><h1>{mode === "reset" ? "Password reset." : "Access setup complete."}</h1><p>{mode === "reset" ? "Your password has been changed and previous sessions were signed out." : "Your account is verified and ready for scoped evaluation access."}</p><Link className="auth-primary-link" to="/login">Continue to sign in <ArrowRight size={16} /></Link></section></main>;
  return <main className="auth-page"><section className="auth-card"><AuthBrand /><div className="auth-card-heading"><span className="eyebrow">{mode === "reset" ? "ACCOUNT RECOVERY" : "ACCESS INVITATION"}</span><h1>{mode === "reset" ? "Choose a new password." : "Set your RTA password."}</h1><p>{mode === "reset" ? "Choose a new password for your RTA account." : "Create your private password to activate your approved evaluation access."}</p></div><form className="auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 14 characters.</small></label><label>Confirm password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="submit-button" disabled={submitting}>{submitting ? "Saving…" : <>Save password <ArrowRight size={17} /></>}</button></form><Link className="auth-back-link" to="/login">Back to sign in</Link></section></main>;
}

export function ResetPasswordPage() { return <PasswordTokenPage mode="reset" />; }
export function SetupAccessPage() { return <PasswordTokenPage mode="setup" />; }
