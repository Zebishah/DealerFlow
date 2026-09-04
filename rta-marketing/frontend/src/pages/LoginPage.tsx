import { ArrowRight, BarChart3, Car as CarFront, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { Redirect, useNavigation } from "../router/Navigation";

export function LoginPage() {
  const { user, login } = useAuth();
  const { navigate } = useNavigation();
  const [email, setEmail] = useState("admin@rta.demo");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Redirect to="/app/overview" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/app/overview", { replace: true });
      toast.success("Welcome back");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span><CarFront /></span><strong>RTA Operations</strong></div>
      <div className="story-copy"><span className="eyebrow">DEALERSHIP INTELLIGENCE PLATFORM</span><h1>Turn every lead, sale, and market signal into action.</h1><p>A secure operating system for dealership teams—combining CRM workflows, commission visibility, and real-time vehicle acquisition.</p><div className="story-points"><span><CheckCircle2 />Role-specific workspaces</span><span><CheckCircle2 />Auditable sales operations</span><span><CheckCircle2 />SQS-backed market intelligence</span></div></div>
      <div className="story-metrics"><div><BarChart3 /><span><strong>One source of truth</strong><small>PostgreSQL-backed operations</small></span></div><div><ShieldCheck /><span><strong>Secure by design</strong><small>HttpOnly sessions and RBAC</small></span></div></div>
    </section>
    <section className="login-panel"><div className="login-form-wrap"><span className="mobile-brand"><CarFront />RTA Operations</span><div><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your workspace</h2><p>Use the account assigned to your dealership role.</p></div><form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
      <div className="form-options"><label><input type="checkbox" />Remember this device</label><button type="button">Forgot password?</button></div>
      <button className="submit-button" disabled={submitting}>{submitting ? "Signing in…" : <>Sign in securely <ArrowRight size={18} /></>}</button>
    </form><div className="demo-note"><ShieldCheck size={18} /><span><strong>Portfolio reviewer?</strong><small>Ask the project owner for the seeded demo password. Credentials are never committed.</small></span></div></div></section>
  </main>;
}
