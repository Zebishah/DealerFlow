import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthPageLayout } from "../components/AuthPageLayout";

type VerificationState = "verifying" | "verified" | "already_verified" | "expired" | "invalid" | "unavailable";
type VerificationResult = { data: { status: "verified" | "already_verified" } };

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [state, setState] = useState<VerificationState>(token ? "verifying" : "invalid");
  const [attempt, setAttempt] = useState(0);
  const request = useRef<{ token: string; promise: Promise<VerificationResult> } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    // Strict Mode can restart the effect; a single-use link must only be submitted once.
    if (request.current?.token !== token) {
      request.current = { token, promise: api<VerificationResult>(`/auth/verify-email?token=${encodeURIComponent(token)}`) };
    }
    request.current.promise
      .then((result) => { if (active) setState(result.data.status); })
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof ApiError && error.code === "VERIFICATION_TOKEN_EXPIRED" ? "expired"
          : error instanceof ApiError && error.code === "INVALID_VERIFICATION_TOKEN" ? "invalid" : "unavailable");
      });
    return () => { active = false; };
  }, [token, attempt]);

  useEffect(() => { if (state !== "verifying") heading.current?.focus(); }, [state]);

  function retry() {
    request.current = null;
    setState("verifying");
    setAttempt((value) => value + 1);
  }

  const success = state === "verified" || state === "already_verified";
  const title = state === "verifying" ? "Checking your link."
    : state === "verified" ? "Email verified."
      : state === "already_verified" ? "Already verified."
        : state === "expired" ? "This link has expired."
          : state === "unavailable" ? "We couldn’t check your link." : "This link is invalid.";

  return <AuthPageLayout><section className="auth-state"><AuthBrand />
    {state === "verifying" ? <Loader2 className="spin" size={40} aria-hidden="true" />
      : success ? <CheckCircle2 className="auth-state-icon" size={40} aria-hidden="true" />
        : <AlertCircle className="auth-state-icon auth-state-icon--error" size={40} aria-hidden="true" />}
    <span className="eyebrow">{state === "verifying" ? "VERIFYING" : success ? "EMAIL READY" : state === "unavailable" ? "PLEASE TRY AGAIN" : "LINK UNAVAILABLE"}</span>
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    <p role={state === "verifying" ? "status" : undefined}>{state === "verifying" ? "One moment while we confirm your RTA account."
      : success ? "Your email is verified. Continue to sign in."
        : state === "unavailable" ? "Check your connection and try again. Your verification link may still be valid."
          : state === "expired" ? "Request a new verification email to continue."
            : "This link may have already been used. Try signing in, or request a new verification email."}</p>
    {state === "unavailable" ? <button type="button" className="auth-primary-link" onClick={retry}>Try again <ArrowRight size={16} /></button>
      : state !== "verifying" && <Link className="auth-primary-link" to={success ? "/login" : "/resend-verification"}>{success ? "Continue to sign in" : "Send a new email"} <ArrowRight size={16} /></Link>}
    {!success && state !== "verifying" && <div><Link className="auth-back-link" to="/login">Back to sign in</Link></div>}
  </section></AuthPageLayout>;
}
