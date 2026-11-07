import { ArrowLeft, ArrowUpRight, Car, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "../router/Navigation";
import { openRtaAssistant } from "@rta/assistant-ui";

export function AuthStory({ evaluation = false }: { evaluation?: boolean }) {
  return <section className="login-story">
    <img className="auth-showroom-image" src="/rta-dealership-showroom.webp" alt="Cars displayed outside a contemporary dealership showroom" width={2172} height={724} />
    <div className="auth-story-shade" />
    <div className="auth-story-top"><Link className="login-brand" to="/"><span><Car /></span><strong>Dealer Flow<span className="auth-brand-period">.</span></strong><small>DEALERSHIP INTELLIGENCE</small></Link><Link className="auth-home-link" to="/"><ArrowLeft size={13} /> Back to home</Link></div>
    <div className="story-copy"><span className="eyebrow"><i /> {evaluation ? "EXPLORE WHAT’S POSSIBLE" : "YOUR INTELLIGENT ADVANTAGE"}</span><h1>{evaluation ? <>Step inside.<br /><em>See the bigger picture.</em></> : <>Great dealerships.<br /><em>Smarter possibilities.</em></>}</h1><p>{evaluation ? "Explore real dealership workflows, vehicle intelligence, and role-based workspaces. See the product in action, then take a closer look at how it’s built." : "The AI-powered platform for car dealerships. Bring customers, vehicles, sales, and your team together in one connected workspace."}</p><div className="story-points"><span><CheckCircle2 />Turn customer opportunities into next steps</span><span><CheckCircle2 />Discover, shortlist, and compare vehicles</span><span><CheckCircle2 />Ask Dealer Flow AI for a clearer perspective</span></div></div>
    <button className="auth-intelligence-note" type="button" onClick={() => openRtaAssistant("What can Dealer Flow help a dealership team do?")}><span><Zap size={18} /></span><div><small>MEET YOUR WORKSPACE INTELLIGENCE</small><strong>One question. A clearer next move.</strong><p>Explore what Dealer Flow AI can help you understand.</p></div><ArrowUpRight size={17} /></button>
    <div className="story-metrics"><span><ShieldCheck size={13} /> Secure access. Your authorized workspace.</span><span>PEOPLE. VEHICLES. POSSIBILITIES.</span></div>
  </section>;
}

export function AuthPageLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`auth-page auth-split-page ${className}`}><AuthStory /><section className="auth-split-panel"><section className="auth-card">{children}</section></section></main>;
}
