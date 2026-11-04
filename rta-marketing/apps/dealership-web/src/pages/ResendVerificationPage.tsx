import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthEmailConfirmation } from "../components/AuthEmailConfirmation";
import { AuthPageLayout } from "../components/AuthPageLayout";

export function ResendVerificationPage() {
  const initialEmail = new URLSearchParams(window.location.search).get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const submittedEmail = email.trim();
    setSubmitting(true);
    setError("");
    try {
      await api("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: submittedEmail }) });
      setSentEmail(submittedEmail);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not resend email");
    } finally {
      setSubmitting(false);
    }
  }

  function changeEmail() {
    setSentEmail(null);
    window.requestAnimationFrame(() => emailInput.current?.focus());
  }

  return (
    <AuthPageLayout>
      <AuthBrand />
      {sentEmail ? (
        <AuthEmailConfirmation email={sentEmail} purpose="verification" onChangeEmail={changeEmail} />
      ) : (
        <>
          <div className="auth-card-heading">
            <span className="eyebrow">EMAIL VERIFICATION</span>
            <h1>Resend the link.</h1>
            <p>Enter your email and we will send a fresh verification link when needed.</p>
          </div>
          <form className="auth-form" onSubmit={submit} aria-busy={submitting}>
            <label>Email address<input ref={emailInput} type="email" autoComplete="email" required value={email} disabled={submitting} onChange={(event) => setEmail(event.target.value)} /></label>
            {error && <p className="auth-email-error" role="alert">{error}</p>}
            <button className="submit-button" disabled={submitting}>
              {submitting ? "Sending…" : <>Resend verification email <ArrowRight size={17} /></>}
            </button>
          </form>
          <Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
        </>
      )}
    </AuthPageLayout>
  );
}
