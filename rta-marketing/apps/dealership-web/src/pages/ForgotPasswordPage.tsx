import { LoadingButton } from "../components/LoadingButton";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthEmailConfirmation } from "../components/AuthEmailConfirmation";
import { AuthPageLayout } from "../components/AuthPageLayout";

export function ForgotPasswordPage() {
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
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: submittedEmail }) });
      setSentEmail(submittedEmail);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not request a reset");
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
        <AuthEmailConfirmation email={sentEmail} purpose="reset" onChangeEmail={changeEmail} />
      ) : (
        <>
          <div className="auth-card-heading">
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h1>Reset your password.</h1>
            <p>Enter your email and we will send a secure, single-use reset link.</p>
          </div>
          <form className="auth-form" onSubmit={submit} aria-busy={submitting}>
            <label>Email address<input ref={emailInput} type="email" autoComplete="email" required value={email} disabled={submitting} onChange={(event) => setEmail(event.target.value)} /></label>
            {error && <p className="auth-email-error" role="alert">{error}</p>}
            <LoadingButton className="submit-button" type="submit" loading={submitting} loadingLabel="Sending reset link…">Send reset link <ArrowRight size={17} /></LoadingButton>
          </form>
          <Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
        </>
      )}
    </AuthPageLayout>
  );
}
