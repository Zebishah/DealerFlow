import { BarChart3, Car, CheckCircle2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthStory() {
  return <section className="login-story">
    <div className="login-brand"><span><Car /></span><strong>RTA Operations</strong></div>
    <div className="story-copy"><span className="eyebrow">DEALERSHIP INTELLIGENCE PLATFORM</span><h1>Turn every lead, sale, and market signal into action.</h1><p>A secure operating system for dealership teams—combining CRM workflows, commission visibility, and real-time vehicle acquisition.</p><div className="story-points"><span><CheckCircle2 />Role-specific workspaces</span><span><CheckCircle2 />Auditable sales operations</span><span><CheckCircle2 />SQS-backed market intelligence</span></div></div>
    <div className="story-metrics"><div><BarChart3 /><span><strong>One source of truth</strong><small>PostgreSQL-backed operations</small></span></div><div><ShieldCheck /><span><strong>Secure by design</strong><small>HttpOnly sessions and RBAC</small></span></div></div>
  </section>;
}

export function AuthPageLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`auth-page auth-split-page ${className}`}><AuthStory /><section className="auth-split-panel"><section className="auth-card">{children}</section></section></main>;
}
