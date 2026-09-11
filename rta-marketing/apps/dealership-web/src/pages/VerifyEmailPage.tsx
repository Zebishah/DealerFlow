import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { Link } from "../router/Navigation";
import { AuthBrand } from "../components/AuthBrand";
import { AuthPageLayout } from "../components/AuthPageLayout";

type VerificationState = "verifying" | "verified" | "already_verified" | "expired" | "invalid";

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [state, setState] = useState<VerificationState>(token ? "verifying" : "invalid");
  useEffect(() => {
    if (!token) return;
    api<{ data: { status: "verified" | "already_verified" } }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((result) => setState(result.data.status))
      .catch((error) => setState(error instanceof ApiError && error.code === "VERIFICATION_TOKEN_EXPIRED" ? "expired" : "invalid"));
  }, [token]);
  if (state === "verifying") return <AuthPageLayout><section className="auth-state"><AuthBrand /><Loader2 className="spin" size={40} /><span className="eyebrow">VERIFYING</span><h1>Checking your link.</h1><p>One moment while we confirm your RTA account.</p></section></AuthPageLayout>;
  const success = state === "verified" || state === "already_verified";
  return <AuthPageLayout><section className="auth-state"><AuthBrand />{success ? <CheckCircle2 className="auth-state-icon" size={40} /> : <AlertCircle className="auth-state-icon auth-state-icon--error" size={40} />}<span className="eyebrow">{state === "expired" ? "LINK EXPIRED" : success ? "EMAIL READY" : "INVALID LINK"}</span><h1>{state === "verified" ? "Email verified." : state === "already_verified" ? "Already verified." : state === "expired" ? "This link has expired." : "This link is invalid."}</h1><p>{state === "verified" ? "Your account is ready. Continue to sign in." : state === "already_verified" ? "Your email is already verified. Continue to your workspace." : state === "expired" ? "Request a new verification email to continue." : "The link may have already been used or is not valid."}</p>{state === "expired" ? <Link className="auth-primary-link" to="/resend-verification">Send a new email <ArrowRight size={16} /></Link> : <Link className="auth-primary-link" to="/login">Continue to sign in <ArrowRight size={16} /></Link>}</section></AuthPageLayout>;
}
