import {
  ArrowRight,
  BarChart3,
  Car as CarFront,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  if (user) return <Redirect to={loginReturnPath()} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
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
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function enterDemo() {
    setSubmitting(true);
    try {
      await demoLogin();
      navigate(loginReturnPath(), { replace: true });
      toast.success("Recruiter demo opened");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Demo access is unavailable",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <span>
            <CarFront />
          </span>
          <strong>RTA Operations</strong>
        </div>
        <div className="story-copy">
          <span className="eyebrow">DEALERSHIP INTELLIGENCE PLATFORM</span>
          <h1>Turn every lead, sale, and market signal into action.</h1>
          <p>
            A secure operating system for dealership teams—combining CRM
            workflows, commission visibility, and real-time vehicle acquisition.
          </p>
          <div className="story-points">
            <span>
              <CheckCircle2 />
              Role-specific workspaces
            </span>
            <span>
              <CheckCircle2 />
              Auditable sales operations
            </span>
            <span>
              <CheckCircle2 />
              Vehicle intelligence workflows
            </span>
          </div>
        </div>
        <div className="story-metrics">
          <div>
            <BarChart3 />
            <span>
              <strong>One source of truth</strong>
              <small>PostgreSQL-backed operations</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <strong>Secure by design</strong>
              <small>HttpOnly sessions and RBAC</small>
            </span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="mobile-brand">
            <CarFront />
            RTA Operations
          </span>
          <div>
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Use the account assigned to your dealership role.</p>
          </div>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
                <strong>Recruiter demo</strong>
                <small>
                  Explore every dashboard with safe, read-only access.
                </small>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void enterDemo()}
              disabled={submitting}
            >
              Enter recruiter demo <ArrowRight size={14} />
            </button>
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
