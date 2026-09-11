import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Link, useNavigation } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthPageLayout } from "../components/AuthPageLayout";

export function SignupPage() {
  const { navigate } = useNavigation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ data: { email: string } }>("/auth/signup", { method: "POST", body: JSON.stringify({ fullName, email, password, confirmPassword }) });
      setCreatedEmail(result.data.email);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthPageLayout><AuthBrand />{createdEmail ? <div className="auth-success"><CheckCircle2 size={38} /><span className="eyebrow">CHECK YOUR INBOX</span><h1>Verify your account.</h1><p>We sent a verification link to <strong>{createdEmail}</strong>. The link expires in 45 minutes.</p><Link className="auth-primary-link" to="/resend-verification">Resend email <ArrowRight size={16} /></Link><Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link></div> : <><div className="auth-card-heading"><span className="eyebrow">JOIN RTA</span><h1>Create your account.</h1><p>Open a secure workspace for dealership operations and vehicle intelligence.</p></div><form className="auth-form" onSubmit={submit}><label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 14 characters.</small></label><label>Confirm password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="submit-button" disabled={submitting}>{submitting ? "Creating account…" : <>Create account <ArrowRight size={17} /></>}</button></form><div className="auth-form-links"><span>Already have an account? <Link to="/login">Sign in</Link></span><button type="button" className="auth-back-button" onClick={() => navigate("/")}><ArrowLeft size={14} /> Back to RTA</button></div></>}</AuthPageLayout>;
}
