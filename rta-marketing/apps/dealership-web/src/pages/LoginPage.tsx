import {
  ArrowRight,
  Car as CarFront,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { AuthStory } from "../components/AuthPageLayout";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../types/domain";
import { ApiError } from "../lib/api";
import { Link, Redirect, useNavigation } from "../router/Navigation";

function loginReturnPath(): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")
    ? requested
    : "/app/overview";
}

export function LoginPage() {
  const { user, login, demoLogin } = useAuth();
  const { navigate } = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  if (user) return <Redirect to={loginReturnPath()} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage("");
    setVerificationEmail(null);
    try {
      await login(email, password);
      navigate(loginReturnPath(), { replace: true });
      toast.success("Welcome back");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "EMAIL_VERIFICATION_REQUIRED"
      )
        setVerificationEmail(email.trim());
      setErrorMessage(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function enterDemo() {
    await enterRoleDemo("recruiter");
  }

  async function enterRoleDemo(role: "recruiter" | "employee" | "virtual_assistant") {
    setSubmitting(true);
    try {
      await demoLogin(role);
      navigate(loginReturnPath(), { replace: true });
      toast.success(`${roleLabel(role)} preview opened`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Demo access is unavailable",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function roleLabel(role: UserRole): string {
    return role === "virtual_assistant" ? "Virtual assistant" : role === "employee" ? "Employee" : "Recruiter";
  }

  return (
    <main className="login-page">
      <AuthStory />
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="mobile-brand">
            <CarFront />
            RTA Operations
          </span>
          <div>
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Sign in to your dealership workspace and vehicle intelligence.</p>
          </div>
          <form onSubmit={submit} aria-busy={submitting}>
            <label>
              Email address
              <input
                disabled={submitting}
                type="email"
                autoComplete="email"
                placeholder="you@dealership.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  disabled={submitting}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
            <button className="submit-button" disabled={submitting}>
              {submitting ? (
                "Signing in…"
              ) : (
                <>
                  Sign in securely <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          {verificationEmail && (
            <div className="verification-required">
              <strong>Email verification required</strong>
              <span>
                Verify your email address before opening the workspace.
              </span>
              <Link
                to={`/resend-verification?email=${encodeURIComponent(verificationEmail)}`}
              >
                Resend verification email
              </Link>
            </div>
          )}
          <div className="auth-form-links">
            <span>
              New to RTA? <Link to="/signup">Create account</Link>
            </span>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <section className="recruiter-demo-card">
            <div>
              <ShieldCheck size={18} />
              <span>
                <strong>Take RTA for a test drive</strong>
                <small>
                  Recruiters and evaluators: explore the product with safe, seeded demo data.
                </small>
              </span>
            </div>
            <div className="role-preview-actions">
              <button type="button" onClick={() => void enterDemo()} disabled={submitting}>
                Recruiter preview <ArrowRight size={14} />
              </button>
              <button type="button" onClick={() => void enterRoleDemo("employee")} disabled={submitting}>
                Employee preview <ArrowRight size={14} />
              </button>
              <button type="button" onClick={() => void enterRoleDemo("virtual_assistant")} disabled={submitting}>
                Virtual assistant preview <ArrowRight size={14} />
              </button>
            </div>
            <Link className="request-access-link" to="/request-access">
              <span>Need broader access?</span> Request full access{" "}
              <ArrowRight size={13} />
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}
