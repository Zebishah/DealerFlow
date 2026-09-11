import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";

export function ResendVerificationPage() {
  const initialEmail = new URLSearchParams(window.location.search).get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend email");
    } finally {
      setSubmitting(false);
    }
  }
  return <main className="auth-page"><section className="auth-card"><AuthBrand />{sent ? <div className="auth-success"><CheckCircle2 size={38} /><span className="eyebrow">REQUEST RECEIVED</span><h1>Check your inbox.</h1><p>If the account exists and still needs verification, a new email will be sent. You can safely close this page.</p><Link className="auth-primary-link" to="/login">Continue to sign in <ArrowRight size={16} /></Link></div> : <><div className="auth-card-heading"><span className="eyebrow">EMAIL VERIFICATION</span><h1>Resend the link.</h1><p>Enter your email and we will send a fresh verification link when needed.</p></div><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="submit-button" disabled={submitting}>{submitting ? "Sending…" : <>Resend verification email <ArrowRight size={17} /></>}</button></form><Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link></>}</section></main>;
}
