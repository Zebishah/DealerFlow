import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowDown, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Car, Check, Columns, ExternalLink, Heart, LayoutDashboard, Menu, Plus,
  Search, ShieldCheck, Sparkles, Users, X,
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

const githubUrl =
  import.meta.env.VITE_GITHUB_URL ?? "https://github.com/Zebishah/Rta-mark";

// The public inventory route shares these pieces. Keep its compact catalog navigation intact.
export function LandingNav({ browsePage = false }: { browsePage?: boolean }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const section = (id: string) => (browsePage ? `/#${id}` : `#${id}`);
  return (
    <header ref={header} className="landing-nav">
      <a
        className="landing-brand"
        href={browsePage ? "/" : "#top"}
        aria-label="RTA home"
      >
        <span className="landing-brand-mark">
          <Car size={19} strokeWidth={2} />
        </span>
        <span>
          RTA<span className="landing-brand-dot">.</span>
        </span>
      </a>
      <nav
        id="landing-navigation"
        className={`landing-nav-links${open ? " is-open" : ""}`}
        aria-label="Primary navigation"
      >
        <a href={section("solutions")} onClick={() => setOpen(false)}>
          The platform
        </a>
        <a href={section("ai-intelligence")} onClick={() => setOpen(false)}>
          RTA intelligence
        </a>
        <Link to="/inventory" onClick={() => setOpen(false)}>
          Find a vehicle
        </Link>
        <a href={section("operations")} onClick={() => setOpen(false)}>
          For dealerships
        </a>
        <a href={section("architecture")} onClick={() => setOpen(false)}>
          Under the hood
        </a>
        <Link
          className="landing-nav-cta"
          to="/login"
          onClick={() => setOpen(false)}
        >
          Explore live demo <ArrowUpRight size={15} />
        </Link>
      </nav>
      <button
        ref={trigger}
        aria-controls="landing-navigation"
        className="landing-menu-button"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
}

function StudioHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", dismiss); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  return (
    <header className="studio-header" ref={header}>
      <a className="studio-brand" href="#top" aria-label="RTA home"><span><Car size={23} /></span>RTA<span className="studio-brand-dot">.</span></a>
      <button ref={trigger} className="studio-menu" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-controls="studio-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav id="studio-navigation" className={open ? "is-open" : ""} aria-label="Primary navigation">
        <a href="#solutions" onClick={() => setOpen(false)}>The platform</a>
        <a href="#operations" onClick={() => setOpen(false)}>For dealerships</a>
        <a href="#ai-intelligence" onClick={() => setOpen(false)}>Intelligence</a>
        <a href="#architecture" onClick={() => setOpen(false)}>The engineering</a>
        <Link to="/login" className="studio-nav-cta" onClick={() => setOpen(false)}>Explore the demo <ArrowUpRight size={17} /></Link>
      </nav>
    </header>
  );
}

function StudioHero() {
  return (
    <section className="studio-hero studio-frame" id="top" aria-labelledby="studio-title">
      <div className="studio-hero-copy">
        <span className="studio-eyebrow"><i /> THE DEALERSHIP. CONNECTED.</span>
        <h1 id="studio-title">Great deals<br />start with<br /><span>real connections.</span></h1>
        <p>From the first enquiry to handing over the keys. RTA connects your leads, sales, people, and vehicles in one clear workspace.</p>
        <div className="studio-actions"><Link className="studio-button studio-button--dark" to="/login">Step inside RTA <ArrowUpRight size={19} /></Link><a className="studio-text-link" href="#solutions">See how it works <ArrowDown size={17} /></a></div>
        <span className="studio-hero-note">Built for dealership teams. Open for you to explore.</span>
      </div>
      <div className="studio-hero-visual">
        <img src="/images/dealership-handover.jpg" alt="A dealership adviser handing car keys to a smiling customer in a showroom" width={1800} height={1200} fetchPriority="high" />
        <span className="studio-photo-label">PEOPLE FIRST. EVERY STEP OF THE DEAL.</span>
        <div className="studio-handover"><span><Check size={21} /></span><div><strong>More than a transaction.</strong><p>A customer. A conversation. A new beginning.</p></div><ArrowUpRight size={21} /></div>
      </div>
      <div className="studio-hero-baseline"><span>ONE PLATFORM. THE WHOLE DEALERSHIP.</span><div><span>Customer relationships</span><i /><span>Vehicle intelligence</span><i /><span>Team performance</span></div></div>
    </section>
  );
}

const tourPanels = [
  { id: "leads", name: "Sales pipeline", Icon: Users, heading: "Every opportunity has a next move.", text: "Keep lead ownership, customer interest, and deal progress together. Give the next conversation the context it deserves." },
  { id: "daily", name: "Daily operations", Icon: CalendarDays, heading: "Know what needs your attention today.", text: "Move from a role-aware overview into appointments, follow-ups, and customer handoffs. A clear daily queue keeps the team moving." },
  { id: "performance", name: "Team performance", Icon: BarChart3, heading: "See the work. Understand the result.", text: "Bring sales, funded deals, target pacing, commissions, and personal performance into the same picture." },
  { id: "vehicles", name: "Vehicle intelligence", Icon: Car, heading: "The right car starts with a clearer search.", text: "Explore approved-source listings, save a shortlist, and compare vehicles side by side before the next customer conversation." },
] as const;

function WorkspacePreview({ mode }: { mode: typeof tourPanels[number]["id"] }) {
  const title = tourPanels.find((panel) => panel.id === mode)!.name;
  return (
    <div className="studio-app-preview">
      <div className="studio-preview-top"><span className="studio-preview-brand">RTA<span>.</span></span><span>Dealership workspace</span><span className="studio-demo-tag">Example view</span></div>
      <div className="studio-preview-body">
        <aside aria-hidden="true"><span className="is-selected"><LayoutDashboard size={18} /></span><Users size={18} /><CalendarDays size={18} /><Car size={18} /><BarChart3 size={18} /></aside>
        <div className="studio-preview-main">
          <div className="studio-preview-title"><div><span>YOUR WORKSPACE / OVERVIEW</span><h3>{title}</h3></div><span className="studio-avatar">RT</span></div>
          {mode === "leads" && <>
            <div className="studio-mini-stats"><div><span>New enquiry</span><strong>Connect</strong></div><div><span>Follow-up</span><strong>Progress</strong></div><div><span>Sale</span><strong>Complete</strong></div></div>
            <div className="studio-preview-table"><div><span>Opportunity</span><span>Next step</span><span>Stage</span></div>{[["Vehicle enquiry", "First conversation", "New"], ["Customer shortlist", "Arrange a viewing", "Contacted"], ["Showroom appointment", "Confirm follow-up", "Qualified"]].map(([lead, step, stage]) => <div key={lead}><strong>{lead}</strong><span>{step}</span><span className="studio-status">{stage}</span></div>)}</div>
          </>}
          {mode === "daily" && <div className="studio-day-list">{[["09:00", "Start with your priorities", "My day · next actions"], ["11:30", "Meet the customer", "Appointments · showroom visit"], ["14:00", "Keep the conversation going", "Follow-ups · customer callback"], ["Next", "Give the team the context", "Inbox · handoffs & escalations"]].map(([time, name, detail]) => <div key={time}><span>{time}</span><div><strong>{name}</strong><p>{detail}</p></div><ArrowUpRight size={17} /></div>)}</div>}
          {mode === "performance" && <>
            <div className="studio-mini-stats"><div><span>Deal progress</span><strong>Sales</strong></div><div><span>Goal pacing</span><strong>Targets</strong></div><div><span>Team rewards</span><strong>Commissions</strong></div></div>
            <div className="studio-chart"><span>Activity & outcomes</span><div aria-hidden="true">{[30, 49, 39, 66, 52, 78, 64, 88, 72, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><p>Illustrative trend · explore your workspace for actual reporting</p></div>
          </>}
          {mode === "vehicles" && <div className="studio-preview-vehicles">{[["Romans International", "Source listings", "/vehicle-preview-q5.webp"], ["Tom Hartley", "Saved & compared", "/vehicle-preview-a4.webp"]].map(([source, label, img]) => <div key={source}><img src={img} alt="Illustrative vehicle in the inventory workspace" loading="lazy" /><strong>{source}</strong><span>{label}</span></div>)}<p><Search size={16} /> Search · shortlist · compare up to four vehicles</p></div>}
          <div className="studio-preview-bottom"><ShieldCheck size={14} /><span>Role-aware views. Shared dealership context.</span></div>
        </div>
      </div>
    </div>
  );
}

function ProductTour() {
  const [active, setActive] = useState(0);
  const panel = tourPanels[active]!;
  return (
    <section className="studio-tour" id="solutions" aria-labelledby="tour-title">
      <div className="studio-frame">
        <div className="studio-section-heading"><div><span className="studio-eyebrow">A CLOSER LOOK AT THE PRODUCT</span><h2 id="tour-title">One workspace.<br />A better working day.</h2></div><p>Sales teams, managers, and virtual assistants get a connected view of the work—with the right access for their role.</p></div>
        <div className="studio-tour-layout">
          <div className="studio-tour-controls">
            <div className="studio-tour-tabs" role="tablist" aria-label="Explore the RTA workspace" aria-orientation="vertical">{tourPanels.map(({ id, name, Icon }, index) => <button key={id} id={`workspace-tab-${id}`} type="button" role="tab" aria-selected={active === index} aria-controls="workspace-tour-panel" tabIndex={active === index ? 0 : -1} className={active === index ? "is-active" : ""} onClick={() => setActive(index)} onKeyDown={(event) => {
              let next = index;
              if (["ArrowDown", "ArrowRight"].includes(event.key)) next = (index + 1) % tourPanels.length;
              else if (["ArrowUp", "ArrowLeft"].includes(event.key)) next = (index - 1 + tourPanels.length) % tourPanels.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tourPanels.length - 1;
              else return;
              event.preventDefault(); setActive(next); document.getElementById(`workspace-tab-${tourPanels[next]!.id}`)?.focus();
            }}><Icon size={21} /><span>{name}</span><ArrowUpRight size={17} /></button>)}</div>
            <div className="studio-tour-caption"><h3>{panel.heading}</h3><p>{panel.text}</p><Link to="/login">Explore the live demo <ArrowRight size={17} /></Link></div>
          </div>
          <div role="tabpanel" id="workspace-tour-panel" aria-labelledby={`workspace-tab-${panel.id}`} tabIndex={0}><WorkspacePreview mode={panel.id} /><p className="studio-preview-disclaimer">Illustrative workspace preview. Sign in to explore the working product.</p></div>
        </div>
      </div>
    </section>
  );
}

function OperationsStory() {
  return (
    <section className="studio-operations studio-frame" id="operations" aria-labelledby="operations-title">
      <div className="studio-story-photo"><img src="/images/dealership-documents.jpg" alt="A dealership adviser reviewing paperwork with a customer beside a car" width={1400} height={933} loading="lazy" /><span>THE CONVERSATION IS WHERE IT STARTS.</span></div>
      <div className="studio-story-copy"><span className="studio-eyebrow">CUSTOMER RELATIONSHIPS & DAILY OPERATIONS</span><h2 id="operations-title">Make the next<br />conversation<br /><em>a better one.</em></h2><p>A lead is more than a name in a list. It’s a customer with questions, a vehicle in mind, and a next step your team needs to remember.</p><div className="studio-story-points"><div><span>01</span><p><strong>Keep ownership clear.</strong> Work leads through the pipeline with visible status and responsibility.</p></div><div><span>02</span><p><strong>Follow through.</strong> Plan appointments and follow-ups from a focused daily queue.</p></div><div><span>03</span><p><strong>Hand over the context.</strong> Keep inbox items, escalations, and assistant handoffs visible.</p></div></div><Link className="studio-text-link" to="/login">See customer operations <ArrowUpRight size={18} /></Link></div>
    </section>
  );
}

function PerformanceStory() {
  return (
    <section className="studio-performance" aria-labelledby="performance-title"><div className="studio-frame studio-performance-layout">
      <div className="studio-story-copy"><span className="studio-eyebrow">SALES, PEOPLE & PERFORMANCE</span><h2 id="performance-title">From a good<br />conversation<br /><em>to a clear result.</em></h2><p>See how the work is progressing, where the team stands, and what needs attention. RTA connects the sales ledger with the people behind each deal.</p><ul className="studio-check-list"><li><Check size={18} /> Sales records and funded deal tracking</li><li><Check size={18} /> Targets, pacing, and commissions</li><li><Check size={18} /> Analytics and personal performance</li><li><Check size={18} /> A shared team performance board</li></ul><Link className="studio-text-link" to="/login">Explore sales & performance <ArrowUpRight size={18} /></Link></div>
      <div className="studio-performance-photo"><img src="/images/dealership-consultation.jpg" alt="A sales adviser and customer discussing a vehicle together inside a dealership" width={1400} height={933} loading="lazy" /><div><span><Users size={22} /></span><p><strong>A shared view of progress.</strong>From the showroom floor to the manager’s desk.</p></div></div>
    </div></section>
  );
}

const workspaceAreas = [
  { title: "Your day & your customers", description: "The work that keeps relationships moving.", items: ["Role-aware overview dashboard", "Lead pipeline & ownership", "My day priority queue", "Appointments", "Follow-ups", "Operations inbox & handoffs"] },
  { title: "Sales & team performance", description: "A connected view of activity and outcomes.", items: ["Sales & funded deals", "Targets & goal pacing", "Commission records", "Analytics", "My performance", "Team performance board"] },
  { title: "Vehicles & acquisition", description: "Find the options. Understand the source.", items: ["Public vehicle discovery", "Workspace inventory", "Saved vehicle shortlist", "Compare up to four vehicles", "On-demand acquisition", "Source controls & run diagnostics"] },
  { title: "People, access & records", description: "The structure behind a well-run workspace.", items: ["Team management & roles", "Virtual-assistant operations", "Workspace configuration", "Private documents", "Audit history", "Access request review"] },
];
function WorkspaceMap() {
  return (
    <section className="studio-map studio-frame" id="workspace" aria-labelledby="map-title"><div className="studio-section-heading"><div><span className="studio-eyebrow">THE FULL PICTURE</span><h2 id="map-title">A place for every part<br />of your dealership.</h2></div><p>Explore what’s already inside RTA. Each workspace view is available according to role and permissions.</p></div><div className="studio-map-list">{workspaceAreas.map((area, index) => <details key={area.title} open={index === 0}><summary><span className="studio-map-number">0{index + 1}</span><span><strong>{area.title}</strong><small>{area.description}</small></span><Plus size={24} /></summary><div className="studio-map-detail"><ul>{area.items.map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul></div></details>)}</div></section>
  );
}

function IntelligenceSection() {
  const prompts = ["Which leads need attention?", "What should the team focus on today?", "Help me understand our sales performance."];
  return (
    <section className="studio-intelligence" id="ai-intelligence" aria-labelledby="intelligence-title"><div className="studio-frame studio-intelligence-layout"><div><span className="studio-eyebrow"><Sparkles size={17} /> RTA INTELLIGENCE</span><h2 id="intelligence-title">Your workspace.<br /><em>In conversation.</em></h2><p>Ask about leads, inventory, sales, and performance in everyday language. RTA’s built-in assistant uses authorized workspace data to help you understand what’s happening.</p><span className="studio-ai-note"><ShieldCheck size={18} /> Read-only assistance. Access follows your permissions.</span></div><div className="studio-questions"><span>START WITH A QUESTION</span>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => openRtaAssistant(prompt)}>{prompt}<ArrowUpRight size={21} /></button>)}<p>Try the assistant here. Sign in for workspace-specific answers.</p></div></div></section>
  );
}

function LiveInventory() {
  const inventory = useQuery({ queryKey: ["public-inventory", "featured"], queryFn: () => api<PublicInventoryResponse>("/scraping-results/public?limit=4"), staleTime: 60_000 });
  const vehicles = inventory.data?.data.items.slice(0, 4) ?? [];
  return (
    <section className="studio-inventory studio-frame" id="inventory" aria-labelledby="inventory-title"><div className="studio-section-heading"><div><span className="studio-eyebrow">VEHICLE DISCOVERY, CONNECTED</span><h2 id="inventory-title">Find the car.<br />Keep the possibilities.</h2></div><div><p>Browse collected listings from Romans International, Tom Hartley, and Redline Specialist Cars. Sign in to save and compare your shortlist.</p><Link className="studio-text-link" to="/inventory">Browse all vehicles <ArrowUpRight size={18} /></Link></div></div>
      {vehicles.length > 0 && <div className="landing-vehicle-cards studio-live-grid" aria-busy={inventory.isFetching}>{vehicles.map((vehicle) => <PublicVehicleCard key={vehicle.id} item={vehicle} />)}</div>}
      {inventory.isLoading && <PublicVehicleGridSkeleton count={4} variant="featured" />}
      {inventory.isError && <div className="studio-inventory-state" role="alert"><AlertCircle size={28} /><div><strong>Live listings are unavailable right now.</strong><p>You can retry or open the vehicle collection.</p></div><button type="button" disabled={inventory.isFetching} onClick={() => void inventory.refetch()}>{inventory.isFetching ? "Retrying…" : "Try again"}</button><Link to="/inventory">Browse vehicles <ArrowRight size={17} /></Link></div>}
      {!inventory.isLoading && !inventory.isError && vehicles.length === 0 && <div className="studio-inventory-state"><Car size={30} /><div><strong>The collection is waiting for its next arrivals.</strong><p>Collected source listings appear here when available.</p></div><Link to="/inventory">Explore vehicle discovery <ArrowUpRight size={17} /></Link></div>}
      <div className="studio-inventory-foot"><span><Search size={18} /> Discover</span><span><Heart size={18} /> Save your shortlist</span><span><Columns size={18} /> Compare side by side</span><span><ExternalLink size={18} /> Visit the original source</span></div>
    </section>
  );
}

function EngineeringSection() {
  return (
    <section className="studio-engineering studio-frame" id="architecture" aria-labelledby="engineering-title"><div><span className="studio-eyebrow">FOR THE CURIOUS. AND THE TECHNICALLY CURIOUS.</span><h2 id="engineering-title">Thought through.<br />From interface to infrastructure.</h2><p>RTA is a working full-stack product: dealership operations, vehicle acquisition, and a grounded assistant connected through a shared platform.</p><a className="studio-text-link" href={githubUrl} target="_blank" rel="noreferrer">Explore the code <ExternalLink size={17} /></a></div><div className="studio-engineering-details"><details><summary>The application <Plus size={20} /></summary><p>React and TypeScript interfaces backed by Node.js, Express, and PostgreSQL. Separate workflows support dealership teams, public vehicle discovery, and acquisition operations.</p></details><details><summary>Data & vehicle sourcing <Plus size={20} /></summary><p>Explicit, on-demand Apify collection from approved vehicle sources. Stored listings preserve their original source details, and acquisition views expose run status and diagnostics.</p></details><details><summary>Workspace boundaries <Plus size={20} /></summary><p>Role checks and workspace isolation control access. Private documents, access request review, and an audit history support accountable operations.</p></details><details><summary>The recruiter walkthrough <Plus size={20} /></summary><p>Use the recruiter demo on the sign-in screen to explore the implemented workflows. Source controls and administrator actions retain their role restrictions.</p><Link to="/login">Open the demo <ArrowUpRight size={16} /></Link></details></div></section>
  );
}

export function LandingFooter({
  browsePage = false,
}: {
  browsePage?: boolean;
}) {
  const section = (id: string) => (browsePage ? `/#${id}` : `#${id}`);
  return (
    <footer className="landing-footer">
      <div className="landing-section-frame">
        <div className="landing-footer-main">
          <div>
            <a
              className="landing-brand"
              href={browsePage ? "/" : "#top"}
              aria-label="RTA home"
            >
              <span className="landing-brand-mark">
                <Car size={17} />
              </span>
              <span>
                RTA<span className="landing-brand-dot">.</span>
              </span>
            </a>
            <p>
              Leads, sales, vehicles, and people. One connected dealership workspace.
            </p>
          </div>
          <div className="landing-footer-links">
            <a href={section("ai-intelligence")}>AI intelligence</a>
            <a href={section("inventory")}>Inventory</a>
            <a href={section("operations")}>Operations</a>
            <a href={section("workspace")}>All features</a>
            <a href={section("architecture")}>How it works</a>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              GitHub <ExternalLink size={13} />
            </a>
            <Link to="/login">
              Sign in <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 RTA platform</span>
          <span>
            Dealership operations. Vehicle discovery. Connected intelligence.
          </span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page rta-studio">
      <StudioHeader />
      <StudioHero />
      <ProductTour />
      <OperationsStory />
      <PerformanceStory />
      <WorkspaceMap />
      <IntelligenceSection />
      <LiveInventory />
      <EngineeringSection />
      <section className="studio-final"><div className="studio-frame"><span className="studio-eyebrow">THE NEXT CONVERSATION STARTS HERE.</span><h2>Meet your dealership’s<br /><em>next working day.</em></h2><div className="studio-actions"><Link className="studio-button studio-button--orange" to="/login">Explore the live demo <ArrowUpRight size={20} /></Link><Link className="studio-button studio-button--outline" to="/signup">Get started with RTA <ArrowUpRight size={20} /></Link></div><p>Exploring for your dealership? Start with the demo.<br />Reviewing the project? Use recruiter access on the sign-in screen.</p></div></section>
      <LandingFooter />
    </main>
  );
}
