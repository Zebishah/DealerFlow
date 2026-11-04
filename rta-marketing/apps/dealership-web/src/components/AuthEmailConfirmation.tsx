import { ArrowLeft, ArrowRight, Mail, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Link } from "../router/Navigation";

type EmailDelivery = "sent" | "pending" | "requested";

interface AuthEmailConfirmationProps {
  email: string;
  purpose: "reset" | "verification";
  delivery?: EmailDelivery;
  onChangeEmail?: () => void;
}

export function AuthEmailConfirmation({ email, purpose, delivery = "requested", onChangeEmail }: AuthEmailConfirmationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [emailDelivery, setEmailDelivery] = useState(delivery);
  const [retryAt, setRetryAt] = useState(() => Date.now() + 60_000);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const isReset = purpose === "reset";

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const updateCountdown = () => setSecondsLeft(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  async function resend() {
    if (sending || Date.now() < retryAt) return;
    setSending(true);
    setError("");
    setResent(false);
    try {
      await api(`/auth/${isReset ? "forgot-password" : "resend-verification"}`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setEmailDelivery("requested");
      setResent(true);
      setRetryAt(Date.now() + 60_000);
      setSecondsLeft(60);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send the email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="auth-success auth-email-confirmation" aria-labelledby="email-confirmation-heading">
      <span className="auth-email-icon"><Mail size={28} aria-hidden="true" /></span>
      <span className="eyebrow">{emailDelivery === "pending" ? "ACCOUNT CREATED" : isReset ? "PASSWORD RESET" : "EMAIL VERIFICATION"}</span>
      <h1 id="email-confirmation-heading" ref={heading} tabIndex={-1}>
        {emailDelivery === "pending" ? "One more step." : "Check your inbox."}
      </h1>
      <p>
        {emailDelivery === "sent"
          ? "We sent a verification link to:"
          : emailDelivery === "pending"
            ? "Your account is created, but we couldn’t send the verification email yet. Your email address is:"
            : isReset
              ? "If this email belongs to a verified RTA account, you’ll receive a password reset link:"
              : "If this account still needs verification, you’ll receive a verification link:"}
      </p>
      <strong className="auth-email-address">{email}</strong>
      <p>{isReset ? "Open the email and select the reset link to choose a new password." : "Open the email and select the verification link, then return here to sign in."}</p>
      <div className="auth-email-help">
        <strong>{emailDelivery === "pending" ? "Send your verification link" : "Can’t find the email?"}</strong>
        <p>{emailDelivery === "pending" ? "Wait a minute, then try sending it again below." : "Allow a few minutes for it to arrive, and check your spam or junk folder. You can request another email below."}</p>
      </div>
      <div className="auth-email-feedback" role="status" aria-live="polite">
        {resent && "Another email has been requested. If the account is eligible, check your inbox and use the newest link."}
      </div>
      {error && <p className="auth-email-error" role="alert">{error}</p>}
      <div className="auth-email-actions">
        <button type="button" className="submit-button" disabled={sending || secondsLeft > 0} onClick={() => void resend()}>
          <RefreshCw size={16} aria-hidden="true" />
          {sending ? "Sending…" : secondsLeft > 0 ? `Resend email in ${secondsLeft}s` : "Resend email"}
        </button>
        <Link className="auth-primary-link" to="/login">Back to sign in <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {onChangeEmail && <button type="button" className="auth-back-button auth-email-change" onClick={onChangeEmail}><ArrowLeft size={15} aria-hidden="true" /> Use a different email address</button>}
    </section>
  );
}
