import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Link, useNavigation } from "../router/Navigation";
import { AuthEmailConfirmation } from "../components/AuthEmailConfirmation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthPageLayout } from "../components/AuthPageLayout";

export function SignupPage() {
  const { navigate } = useNavigation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdAccount, setCreatedAccount] = useState<{ email: string; emailDelivery: "sent" | "pending" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrorMessage("");
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ data: { email: string; emailDelivery: "sent" | "pending" } }>("/auth/signup", { method: "POST", body: JSON.stringify({ fullName, email, password, confirmPassword }) });
      setCreatedAccount(result.data);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthPageLayout><AuthBrand />{createdAccount ? <AuthEmailConfirmation email={createdAccount.email} purpose="verification" delivery={createdAccount.emailDelivery} /> : <><div className="auth-card-heading"><span className="eyebrow">JOIN Dealer Flow</span><h1>Create your account.</h1><p>Create your Dealer Flow account to explore vehicle intelligence and access your authorized dealership workspace.</p></div><form className="auth-form" onSubmit={submit} aria-busy={submitting}><label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 14 characters.</small></label><label>Confirm password<input type="password" autoComplete="new-password" required minLength={14} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<button className="submit-button" disabled={submitting}>{submitting ? "Creating account…" : <>Create account <ArrowRight size={17} /></>}</button></form><div className="auth-form-links"><span>Already have an account? <Link to="/login">Sign in</Link></span><button type="button" className="auth-back-button" onClick={() => navigate("/")}><ArrowLeft size={14} /> Back to Dealer Flow</button></div></>}</AuthPageLayout>;
}
