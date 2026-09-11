import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthPageLayout } from "../components/AuthPageLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request a reset");
    } finally {
      setSubmitting(false);
    }
  }
  return <AuthPageLayout><AuthBrand />{sent ? <div className="auth-success"><CheckCircle2 size={38} /><span className="eyebrow">REQUEST RECEIVED</span><h1>Check your inbox.</h1><p>If an account exists for that email address, we have sent password reset instructions.</p><Link className="auth-primary-link" to="/login">Back to sign in <ArrowRight size={16} /></Link></div> : <><div className="auth-card-heading"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your password.</h1><p>Enter your email and we will send a secure, single-use reset link.</p></div><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="submit-button" disabled={submitting}>{submitting ? "Sending…" : <>Send reset link <ArrowRight size={17} /></>}</button></form><Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link></>}</AuthPageLayout>;
}
