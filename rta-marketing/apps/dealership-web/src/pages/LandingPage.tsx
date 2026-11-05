import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertCircle, ArrowDown, ArrowRight, ArrowUpRight, BarChart3,
  Car, Check, ChevronDown, CircleDollarSign, Database, ExternalLink,
  Layers, Loader2, Menu, MessageSquare, Search, ShieldCheck, Sparkles,
  Target, Users, Workflow, X, Zap,
} from "lucide-react";
import { Link } from "../router/Navigation";
import { openRtaAssistant } from "@rta/assistant-ui";
import { api } from "../lib/api";
import { PublicVehicleCard } from "../components/PublicVehicleCard";
import { PublicVehicleGridSkeleton } from "../components/PublicVehicleGridSkeleton";
import type { PublicInventoryResponse } from "../types/domain";
import "../landing.css";
import "../landing-experience.css";
import "../landing-next.css";

const githubUrl = import.meta.env.VITE_GITHUB_URL ?? "https://github.com/Zebishah/Rta-mark";

export function LandingNav({ browsePage = false }: { browsePage?: boolean }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const section = (id: string) => browsePage ? `/#${id}` : `#${id}`;
  return <header ref={header} className="landing-nav">
    <a className="landing-brand" href={browsePage ? "/" : "#top"} aria-label="RTA home">
      <span className="landing-brand-mark"><Car size={19} strokeWidth={2} /></span>
      <span>RTA<span className="landing-brand-dot">.</span></span>
    </a>
    <nav id="landing-navigation" className={`landing-nav-links${open ? " is-open" : ""}`} aria-label="Primary navigation">
      <a href={section("solutions")} onClick={() => setOpen(false)}>The platform</a>
      <a href={section("ai-intelligence")} onClick={() => setOpen(false)}>RTA intelligence</a>
      <Link to="/inventory" onClick={() => setOpen(false)}>Find a vehicle</Link>
      <a href={section("operations")} onClick={() => setOpen(false)}>For dealerships</a>
      <a href={section("architecture")} onClick={() => setOpen(false)}>Under the hood</a>
      <Link className="landing-nav-cta" to="/login" onClick={() => setOpen(false)}>Explore live demo <ArrowUpRight size={15} /></Link>
    </nav>
    <button ref={trigger} aria-controls="landing-navigation" className="landing-menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? <X size={21} /> : <Menu size={21} />}
    </button>
  </header>;
}

function VehicleStage() {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stage.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element) return;
    let frame = 0;
    function reset() {
      cancelAnimationFrame(frame);
      element!.style.removeProperty("--stage-x");
      element!.style.removeProperty("--stage-y");
    }
    function move(event: PointerEvent) {
      if (motion.matches || event.pointerType !== "mouse") return;
      const rect = element!.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element!.style.setProperty("--stage-x", `${x * 12}deg`);
        element!.style.setProperty("--stage-y", `${-y * 8}deg`);
      });
    }
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", reset);
    motion.addEventListener("change", reset);
    return () => {
      reset();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", reset);
      motion.removeEventListener("change", reset);
    };
  }, []);
  return <div className="rta-vehicle-stage" ref={stage}>
    <div className="rta-stage-dimension">
      <div className="rta-orbital-system" aria-hidden="true">
        <div className="rta-orbit-glow" /><div className="rta-orbit rta-orbit--outer" />
        <div className="rta-orbit rta-orbit--inner" /><div className="rta-orbit rta-orbit--vertical" />
        <span className="rta-orbit-point rta-orbit-point--one" /><span className="rta-orbit-point rta-orbit-point--two" />
        <div className="rta-stage-floor" /><span className="rta-stage-word">CONNECTED</span>
      </div>
      <img className="rta-stage-car" src="/rta-hero-vehicle.webp" alt="Graphite performance SUV floating above an illuminated orbital platform" width={1774} height={887} fetchPriority="high" decoding="async" />
      <div className="rta-stage-label" aria-hidden="true"><span className="rta-status-dot" /> VEHICLE INTELLIGENCE<span>01 / CONNECTED</span></div>
      <button className="rta-signal-card" type="button" onClick={() => openRtaAssistant("How can RTA connect lead context with matching vehicles?")}>
        <span className="rta-signal-icon"><Sparkles size={17} /></span>
        <span><small>RTA INTELLIGENCE</small><strong>Every signal. Connected.</strong><span>People + vehicles + possibilities</span></span>
        <ArrowUpRight size={16} />
      </button>
      <Link to="/inventory" className="rta-vehicle-tag"><span><Car size={15} /></span><div><small>YOUR NEXT RIGHT TURN</small><strong>Discover. Compare. Decide.</strong></div><ArrowUpRight size={15} /></Link>
    </div>
    <div className="rta-stage-coordinate" aria-hidden="true"><span>RTA INTELLIGENCE SYSTEM</span><span>EST. FOR THE NEXT ERA ↗</span></div>
  </div>;
}

function HeroSection() {
  return <section className="rta-hero" id="top">
    <div className="rta-hero-grid" aria-hidden="true" /><div className="rta-hero-halo" aria-hidden="true" />
    <div className="landing-section-frame rta-hero-layout">
      <div className="rta-hero-copy">
        <a className="rta-release-pill" href="#ai-intelligence"><span className="rta-status-dot" /> THE INTELLIGENT DEALERSHIP <span className="rta-release-arrow"><ArrowUpRight size={13} /></span></a>
        <h1>Your dealership.<br />One intelligent<br /><em>advantage.</em></h1>
        <p>Your customers, cars, and team. Finally connected.<br className="rta-desktop-break" /> Meet the AI-powered platform built for your next move.</p>
        <div className="landing-hero-actions">
          <Link className="landing-button landing-button--primary" to="/signup">Get started with RTA <ArrowUpRight size={17} /></Link>
          <Link className="landing-button landing-button--ghost" to="/inventory"><Car size={16} /> Explore vehicles</Link>
        </div>
        <div className="rta-hero-assurance"><ShieldCheck size={14} /><span>Built for dealership teams.</span><span className="rta-assurance-divider" /><Link to="/login">Take the live tour <ArrowRight size={12} /></Link></div>
      </div>
      <VehicleStage />
    </div>
    <div className="landing-section-frame rta-hero-bottom"><a href="#solutions"><span className="rta-scroll-icon"><ArrowDown size={14} /></span> A smarter way forward</a><p>ONE PLATFORM.<span>EVERY NEXT MOVE.</span></p><span className="rta-hero-edition">RTA / THE CONNECTED EDITION</span></div>
  </section>;
}

const workspaceViews = [
  { id: "leads", label: "Sales pipeline", Icon: Users, title: "Every opportunity, in focus.", description: "Know who needs a follow-up, where each conversation stands, and what comes next.", metric: "06", metricLabel: "Demo leads", secondMetric: "03", secondLabel: "Lead sources", rows: [["New enquiry", "Customer conversation", "New"], ["Vehicle shortlist", "Match the right inventory", "Qualified"], ["Next follow-up", "Keep the conversation moving", "In progress"]] },
  { id: "vehicles", label: "Vehicle intelligence", Icon: Car, title: "A clearer view of inventory.", description: "Bring approved source listings into one searchable view. Save your options and compare the details.", metric: "06", metricLabel: "Fixture vehicles", secondMetric: "03", secondLabel: "Approved sources", rows: [["Romans International", "Search collected listings", "Source"], ["Tom Hartley", "Explore vehicle details", "Source"], ["Redline Specialist Cars", "Build your shortlist", "Source"]] },
  { id: "performance", label: "Team performance", Icon: BarChart3, title: "See the work behind the wins.", description: "Keep funded deals, targets, and commissions connected to the people moving your dealership forward.", metric: "04", metricLabel: "Demo funded deals", secondMetric: "01", secondLabel: "Connected workspace", rows: [["Funded sales", "Connected deal records", "Recorded"], ["Sales targets", "Individual and team progress", "Visible"], ["Commission overview", "Clarity on every funded deal", "Tracked"]] },
] as const;

function PlatformSection() {
  const [active, setActive] = useState(0);
  const [horizontalTabs, setHorizontalTabs] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setHorizontalTabs(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const view = workspaceViews[active]!;
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  return <section className="landing-section rta-platform-section" id="solutions">
    <div className="landing-section-frame">
      <div className="rta-section-topline"><span className="landing-eyebrow">01 / THE CONNECTED PLATFORM</span><span>LESS FRICTION. MORE FORWARD.</span></div>
      <div className="landing-section-heading"><h2>Everything connected.<br /><span>Nothing in your way.</span></h2><p>Less tab-switching. More moving things forward. One considered workspace for the people, vehicles, and decisions behind every sale.</p></div>
      <div className="rta-workspace-showcase">
        <div className="rta-workspace-story">
          <div className="rta-view-tabs" role="tablist" aria-label="Explore the platform" aria-orientation={horizontalTabs ? "horizontal" : "vertical"}>
            {workspaceViews.map(({ id, label, Icon }, index) => <button ref={node => { tabs.current[index] = node; }} type="button" role="tab" id={`workspace-tab-${id}`} aria-controls="workspace-preview" aria-selected={active === index} tabIndex={active === index ? 0 : -1} className={active === index ? "is-active" : ""} key={id} onClick={() => setActive(index)} onKeyDown={event => {
              let next = index;
              if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % workspaceViews.length;
              else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + workspaceViews.length) % workspaceViews.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = workspaceViews.length - 1;
              else return;
              event.preventDefault(); setActive(next); tabs.current[next]?.focus();
            }}><Icon size={19} /><span>{label}</span><ArrowUpRight size={16} /></button>)}
          </div>
          <div className="rta-workspace-description" aria-live="polite"><span className="rta-tiny-index">0{active + 1} / ONE WORKSPACE</span><h3>{view.title}</h3><p>{view.description}</p></div>
          <Link className="landing-text-link" to="/login">Step inside the live demo <ArrowUpRight size={16} /></Link>
        </div>
        <div className="rta-preview-perspective"><div className="rta-command-window" id="workspace-preview" role="tabpanel" aria-labelledby={`workspace-tab-${view.id}`} tabIndex={0}>
          <div className="rta-command-toolbar"><span className="rta-window-dots"><i /><i /><i /></span><span><ShieldCheck size={11} /> rta / your-workspace</span><span className="rta-preview-badge">DEMO PREVIEW</span></div>
          <div className="rta-command-body"><aside className="rta-command-rail" aria-hidden="true"><span>R.</span><Layers size={17} /><Users size={17} /><Car size={17} /><BarChart3 size={17} /><div /><ShieldCheck size={17} /></aside>
            <div className="rta-command-main"><div className="rta-command-heading"><div><small>YOUR DEALERSHIP, AT A GLANCE</small><h3>{view.label}</h3></div><span className="rta-demo-avatar">R</span></div>
              <div className="rta-command-metrics"><div><span>{view.metricLabel}</span><strong>{view.metric}<span><Activity size={12} /> Demo workspace</span></strong><div className="rta-mini-chart" aria-hidden="true">{[35, 58, 42, 68, 50, 78, 65, 92, 80, 100].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div><div><span>{view.secondLabel}</span><strong>{view.secondMetric}</strong><span className="rta-metric-foot"><span className="rta-status-dot" /> Connected context</span></div></div>
              <div className="rta-command-rows">{view.rows.map(([title, subtitle, status], index) => <div key={title}><span className="rta-row-icon">{index === 0 ? <Users size={15} /> : index === 1 ? <Car size={15} /> : <Target size={15} />}</span><span><strong>{title}</strong><small>{subtitle}</small></span><span className="rta-row-status">{status}</span></div>)}</div>
              <div className="rta-command-ai"><Sparkles size={15} /><span>Your next move starts with a better question.</span><ArrowUpRight size={14} /></div>
            </div>
          </div>
        </div><span className="rta-preview-note"><ShieldCheck size={12} /> Illustrative preview · sanitized demo values</span></div>
      </div>
      <div className="rta-platform-features">{[{ Icon: Layers, label: "One shared workspace" }, { Icon: ShieldCheck, label: "Role-aware by design" }, { Icon: Zap, label: "Intelligence in context" }, { Icon: Workflow, label: "Connected from lead to sale" }].map(({ Icon, label }) => <span key={label}><Icon size={16} />{label}</span>)}</div>
    </div>
  </section>;
}

function IntelligenceSection() {
  const prompts = ["Which leads need attention?", "Find SUVs under $30,000.", "Who is behind target this month?"];
  return <section className="landing-section rta-intelligence-section" id="ai-intelligence"><div className="landing-section-frame">
    <div className="rta-section-topline"><span className="landing-eyebrow">02 / RTA INTELLIGENCE</span><span>A LITTLE LESS NOISE. A LOT MORE CLARITY.</span></div>
    <div className="rta-intelligence-layout">
      <div className="rta-intelligence-copy"><span className="rta-ai-symbol"><Sparkles size={24} /></span><h2>Good questions.<br /><span>Smarter next moves.</span></h2><p>The answer you need shouldn’t live five tabs away. Ask RTA in plain language and connect the dots across your dealership.</p><ul><li><Check size={15} /> Grounded in your authorized workspace data</li><li><Check size={15} /> Context across leads, vehicles, and performance</li><li><Check size={15} /> Read-only assistance. Your team stays in control.</li></ul><button type="button" className="landing-button landing-button--primary" onClick={() => openRtaAssistant("What can RTA AI help me understand?")}>Meet your intelligent advantage <Sparkles size={15} /></button></div>
      <div className="rta-ai-demo"><div className="rta-ai-demo-header"><span className="rta-status-dot" /> RTA INTELLIGENCE<span>ILLUSTRATIVE CONVERSATION</span></div><div className="rta-ai-core" aria-hidden="true"><div /><div /><div /><Sparkles size={29} /></div><div className="rta-ai-question"><MessageSquare size={15} /><span>What should my team focus on today?</span></div><div className="rta-ai-response"><span className="rta-ai-response-icon"><Sparkles size={15} /></span><div><strong>Start with the signals that matter.</strong><p>Review follow-ups, connect customers with matching inventory, and check progress against your team’s targets.</p><div className="rta-ai-context"><span><Users size={11} /> Leads</span><span><Car size={11} /> Inventory</span><span><BarChart3 size={11} /> Performance</span></div></div></div><div className="rta-ai-try"><span>MAKE IT YOUR QUESTION</span>{prompts.map(prompt => <button key={prompt} type="button" onClick={() => openRtaAssistant(prompt)}>{prompt}<ArrowUpRight size={14} /></button>)}</div><div className="rta-ai-demo-foot"><ShieldCheck size={12} /> Authorized context. Grounded answers.</div></div>
    </div>
  </div></section>;
}

function InventorySection() {
  const inventory = useQuery({ queryKey: ["public-inventory", "featured"], queryFn: () => api<PublicInventoryResponse>("/scraping-results/public?limit=8"), staleTime: 60_000 });
  const vehicles = inventory.data?.data.items ?? [];
  return <section className="landing-section landing-inventory rta-inventory-section" id="inventory"><div className="landing-section-frame">
    <div className="rta-section-topline"><span className="landing-eyebrow">03 / VEHICLE DISCOVERY</span><span>THE RIGHT CAR. A CLEARER CHOICE.</span></div>
    <div className="landing-section-heading"><h2>Your next right turn.<br /><span>Starts right here.</span></h2><p>Explore collected listings from Romans International, Tom Hartley, and Redline Specialist Cars. Discover your options, then sign in to save and compare.</p></div>
    <div className="landing-inventory-head"><div><span className="rta-status-dot" /><h3>Featured vehicles</h3></div><Link className="landing-text-link" to="/inventory">Explore all vehicles <ArrowUpRight size={16} /></Link></div>
    {vehicles.length > 0 && <div className="landing-vehicle-cards" aria-busy={inventory.isFetching}>{vehicles.map(vehicle => <PublicVehicleCard key={vehicle.id} item={vehicle} />)}</div>}
    {inventory.isFetching && !inventory.isLoading && <div className="public-inventory-refresh" role="status"><Loader2 size={14} className="spin" /> Refreshing featured vehicles…</div>}
    {inventory.isLoading && <PublicVehicleGridSkeleton count={4} variant="featured" />}
    {inventory.isError && <div className="public-inventory-state" role="alert"><AlertCircle size={24} /><strong>Live listings are temporarily unavailable.</strong><span>Please try again, or browse all inventory.</span><button type="button" disabled={inventory.isFetching} onClick={() => void inventory.refetch()}>{inventory.isFetching ? "Retrying…" : "Try again"}</button><Link to="/inventory">Open full inventory <ArrowRight size={14} /></Link></div>}
    {!inventory.isLoading && !inventory.isError && vehicles.length === 0 && <div className="public-inventory-state"><Car size={25} /><strong>No live vehicles to show just yet.</strong><span>Listings will appear here when a live source has current inventory.</span><Link to="/inventory">Browse all inventory <ArrowRight size={14} /></Link></div>}
    <div className="landing-inventory-cta"><span aria-live="polite">{inventory.isLoading ? <><Loader2 size={15} className="spin" /> Loading the latest source listings…</> : inventory.isError ? <><AlertCircle size={15} /> Listing count unavailable</> : vehicles.length === 0 ? <><Car size={17} /> No current listings</> : <><Car size={17} /> Showing {vehicles.length} current listings from the live sources.</>}</span><Link className="landing-text-link" to="/inventory">Find a vehicle <ArrowRight size={14} /></Link></div>
  </div></section>;
}

function OperationsSection() {
  const features = [
    { Icon: Users, title: "Every conversation, carried forward.", text: "Keep leads, customer context, and the next follow-up in one place." },
    { Icon: CircleDollarSign, title: "From opportunity to funded deal.", text: "Connect sales records, targets, and commissions to the work behind them." },
    { Icon: ShieldCheck, title: "The right people. The right access.", text: "Give your team focused roles, private documents, and traceable activity." },
  ];
  return <section className="landing-section rta-operations-section" id="operations"><div className="landing-section-frame">
    <div className="rta-section-topline"><span className="landing-eyebrow">04 / BUILT FOR THE FLOOR</span><span>PEOPLE. PROCESS. POSSIBILITIES.</span></div>
    <div className="rta-operations-layout"><div className="rta-showroom-visual"><img src="/rta-dealership-showroom.webp" alt="Glass-fronted dealership with vehicles displayed outside at dusk" width={2172} height={724} loading="lazy" /><div className="rta-showroom-shade" /><span className="rta-showroom-top"><span className="rta-status-dot" /> YOUR ENTIRE DEALERSHIP. CONNECTED.</span><div className="rta-showroom-bottom"><span className="rta-showroom-monogram">RTA.</span><p>Designed around<br /><em>your real world.</em></p><span>ONE CONNECTED OPERATION <ArrowUpRight size={17} /></span></div></div><div className="rta-operations-copy"><h2>Less managing tools.<br /><span>More moving forward.</span></h2><p>A dealership runs on people. Give yours a workspace that keeps the entire journey in view.</p><div className="rta-operation-features">{features.map(({ Icon, title, text }, index) => <article key={title}><span><Icon size={19} /></span><div><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p></div></article>)}</div><Link className="landing-text-link" to="/login">Explore dealership operations <ArrowUpRight size={16} /></Link></div></div>
  </div></section>;
}

function EngineeringSection() {
  const steps = [{ Icon: Search, name: "Approved sources", sub: "Romans · Tom Hartley · Redline" }, { Icon: Workflow, name: "Controlled collection", sub: "Explicit, bounded Apify runs" }, { Icon: Database, name: "Structured inventory", sub: "Persisted PostgreSQL records" }, { Icon: Sparkles, name: "Grounded intelligence", sub: "Authorized, read-only context" }];
  return <section className="landing-section rta-engineering-section" id="architecture"><div className="landing-section-frame">
    <div className="rta-section-topline"><span className="landing-eyebrow">05 / UNDER THE HOOD</span><span>CONSIDERED ON THE SURFACE. ENGINEERED BENEATH.</span></div>
    <div className="landing-section-heading"><h2>Intelligence has<br /><span>a strong foundation.</span></h2><p>Clear responsibilities. Controlled data. A connected architecture that makes the experience possible.</p></div>
    <div className="rta-data-flow" id="pipeline">{steps.map(({ Icon, name, sub }, index) => <div key={name}><span className="rta-flow-step">0{index + 1}</span><Icon size={24} /><h3>{name}</h3><p>{sub}</p>{index < steps.length - 1 && <ArrowRight className="rta-flow-connector" size={19} />}</div>)}</div>
    <details className="rta-engineering-details"><summary><span><Layers size={17} /> Explore the engineering</span><span>THE STACK & SAFEGUARDS <ChevronDown size={16} /></span></summary><div className="rta-engineering-detail-grid"><div><h3>A focused modern stack</h3><p>React and TypeScript on the surface. Node.js, Express, and PostgreSQL behind the operation. Apify handles explicit acquisition runs; Redis supports caching and coordination.</p><div className="rta-stack-tags">{["React", "TypeScript", "Node.js", "PostgreSQL", "Apify", "Redis"].map(item => <span key={item}>{item}</span>)}</div></div><div><h3>Control at every layer</h3><p>Workspace isolation, role checks, validated inputs, rate limits, and audit history keep access intentional. AI interprets approved data through read-only tools; operators initiate acquisition.</p><a href={githubUrl} target="_blank" rel="noreferrer" className="landing-text-link">Explore the source <ExternalLink size={14} /></a></div></div></details>
  </div></section>;
}

export function LandingFooter({ browsePage = false }: { browsePage?: boolean }) {
  const section = (id: string) => browsePage ? `/#${id}` : `#${id}`;
  return <footer className="landing-footer"><div className="landing-section-frame"><div className="landing-footer-main"><div><a className="landing-brand" href={browsePage ? "/" : "#top"} aria-label="RTA home"><span className="landing-brand-mark"><Car size={19} /></span><span>RTA<span className="landing-brand-dot">.</span></span></a><p>Dealership operations. Vehicle discovery.<br />Connected with intelligence.</p></div><div className="landing-footer-links"><a href={section("ai-intelligence")}>RTA intelligence</a><Link to="/inventory">Find a vehicle</Link><a href={section("operations")}>For dealerships</a><a href={section("architecture")}>Under the hood</a><a href={githubUrl} target="_blank" rel="noreferrer">GitHub <ExternalLink size={12} /></a><Link to="/login">Sign in <ArrowUpRight size={13} /></Link></div></div><div className="landing-footer-bottom"><span>© 2026 RTA platform</span><span>DESIGNED FOR THE NEXT TURN. <ArrowUpRight size={11} /></span></div></div></footer>;
}

export function LandingPage() {
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    const sections = page.current?.querySelectorAll<HTMLElement>(".landing-section");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!sections || !("IntersectionObserver" in window) || motion.matches) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); observer.unobserve(entry.target); }
    }), { threshold: .05 });
    sections.forEach(section => { section.classList.add("landing-reveal"); observer.observe(section); });
    const revealAll = () => { if (motion.matches) { sections.forEach(section => section.classList.add("is-revealed")); observer.disconnect(); } };
    motion.addEventListener("change", revealAll);
    return () => { observer.disconnect(); motion.removeEventListener("change", revealAll); sections.forEach(section => section.classList.remove("landing-reveal")); };
  }, []);
  return <main ref={page} className="landing-page rta-next"><LandingNav /><HeroSection /><PlatformSection /><IntelligenceSection /><InventorySection /><OperationsSection /><EngineeringSection /><section className="rta-final-section"><div className="rta-final-orbits" aria-hidden="true"><i /><i /><i /></div><div className="landing-section-frame"><span className="landing-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Make your<br />next move <em>intelligent.</em></h2><p>One platform. A clearer view. A world of possibility.</p><div className="landing-hero-actions"><Link className="landing-button landing-button--primary" to="/signup">Get started with RTA <ArrowUpRight size={17} /></Link><Link className="landing-button landing-button--ghost" to="/login">Take the live tour <ArrowRight size={16} /></Link></div></div></section><LandingFooter /></main>;
}
