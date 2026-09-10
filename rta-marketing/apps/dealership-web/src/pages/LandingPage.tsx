import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Layers,
  Menu,
  Search,
  ServerCog,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "../router/Navigation";
import "../landing.css";

const landingLinks = {
  dealership: "/login",
  // Scraping is initiated from the authenticated dealership dashboard.
  scraping: "/app/acquisition",
  github: import.meta.env.VITE_GITHUB_URL ?? "https://github.com/Zebishah/Rta-mark",
};

const platformStats = [
  ["06", "demo leads"],
  ["04", "funded deals"],
  ["06", "fixture vehicles"],
  ["03", "lead sources"],
];

const previewVehicles = [
  { title: "2024 Example Atlas Comfortline", year: "2024", price: "$39,900", mileage: "12,300 km", source: "AutoTrader · sanitized preview", tone: "blue", image: "/vehicle-preview-blue.webp" },
  { title: "2023 Example CX-5 GT", year: "2023", price: "$34,980", mileage: "27,400 km", source: "AutoPlanet · sanitized preview", tone: "red", image: "/vehicle-preview-red.webp" },
  { title: "2024 Example Golf GTI", year: "2024", price: "$43,895", mileage: "6,200 km", source: "Humberview · sanitized preview", tone: "silver", image: "/vehicle-preview-white.webp" },
  { title: "2022 Example Tiguan Comfortline", year: "2022", price: "$32,995", mileage: "38,800 km", source: "Yorkdale VW · sanitized preview", tone: "green", image: "/vehicle-preview-green.webp" },
];

const operationModules = [
  ["Leads", "Capture and manage follow-up work", "leads"],
  ["Inventory", "Search, save and compare vehicles", "inventory"],
  ["Sales", "Record deals with idempotent writes", "sales"],
  ["Targets", "Track sales goals and performance", "targets"],
  ["Commissions", "Keep commission visibility close to sales", "commissions"],
  ["Team", "Workspace-scoped people and roles", "team"],
  ["Documents", "Private employee document workflows", "documents"],
  ["Audit", "Review business-critical mutations", "audit"],
];

const reliabilityItems = [
  ["BullMQ queueing", "Separate browser-heavy work from HTTP requests"],
  ["Redis locking", "Prevent overlapping manual scrape runs"],
  ["Retry and backoff", "Give transient jobs a controlled second chance"],
  ["Input validation", "Allowlisted sources and bounded scrape limits"],
  ["Rate limiting", "Keep public and authentication endpoints bounded"],
  ["Idempotent writes", "Avoid duplicate operational records on retries"],
  ["Worker concurrency", "Keep browser work to one controlled task"],
  ["Browser cleanup", "Close managed Chromium after each run"],
  ["Graceful shutdown", "Release resources when the worker stops"],
  ["Health checks", "Keep service and worker readiness observable"],
  ["Audit logging", "Record sensitive and business-critical mutations"],
];

const productAreas: Array<[string, string, string[]]> = [
  ["Customers & leads", "Lead management, customer context and follow-up status", ["Lead pipeline", "Statuses", "Assignment"]],
  ["Vehicles", "Persisted listings that can be searched, saved and compared", ["Inventory", "Vehicle detail", "Compare"]],
  ["Sales", "Funded deal records connected to people, vehicles and delivery", ["Sales workspace", "Funded deals", "History"]],
  ["Performance", "Targets, commissions and server-calculated reporting", ["Targets", "Commissions", "Analytics"]],
  ["People & operations", "Workspace roles, private documents and traceable activity", ["Team", "Documents", "Audit history"]],
];

const businessProblems: Array<[LucideIcon, string, string]> = [
  [Users, "Leads need consistent follow-up", "Bring opportunity status, ownership and vehicle interest into one visible workflow."],
  [Car, "Inventory needs usable structure", "Turn vehicle information into searchable records the dealership team can act on."],
  [Target, "Managers need performance context", "Keep targets, funded sales, commissions and activity close to the operating view."],
  [FileText, "People and records need control", "Give roles, employee documents and important changes a clear operational home."],
];

const techGroups: Array<[string, string[]]> = [
  ["Frontend", ["React", "TypeScript", "Vite", "Vercel"]],
  ["Dealership backend", ["Node.js", "Express", "PostgreSQL", "Drizzle"]],
  ["Async and messaging", ["BullMQ", "Redis", "AWS SQS"]],
  ["Scraping worker", ["Azure VM", "Docker", "Playwright", "Chromium", "Cheerio", "Crawlee"]],
  ["Storage and cloud", ["Neon", "AWS S3", "AWS Lambda", "Render", "Northflank"]],
  ["Delivery", ["GitHub", "GHCR", "health checks", "rollback-ready deploys"]],
];

function LandingNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return <header className="landing-nav"><a className="landing-brand" href="#top" aria-label="RTA home"><span className="landing-brand-mark"><Car size={17} strokeWidth={2.5} /></span><span>RTA<span className="landing-brand-dot">.</span></span></a><nav className={open ? "landing-nav-links is-open" : "landing-nav-links"} aria-label="Primary navigation"><a href="#inventory" onClick={close}>Inventory</a><a href="#operations" onClick={close}>Operations</a><a href="#pipeline" onClick={close}>Vehicle data</a><a href="#architecture" onClick={close}>Architecture</a><Link className="landing-nav-cta" to={landingLinks.dealership} onClick={close}>Open workspace <ArrowUpRight size={15} /></Link></nav><button className="landing-menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button></header>;
}

function HeroSection() {
  return <section className="landing-hero" id="top"><div className="landing-hero-grid" /><div className="landing-hero-copy"><div className="landing-kicker"><span className="landing-kicker-line" /> AUTOMOTIVE OPERATIONS / DATA SYSTEMS</div><h1>Drive the<br /><em>dealership.</em><br />Power the <span>data.</span></h1><p className="landing-hero-lede">RTA combines dealership operations, vehicle inventory, sales workflows and controlled vehicle-data ingestion into one automotive platform.</p><div className="landing-hero-actions"><Link className="landing-button landing-button--primary" to={landingLinks.dealership}>Explore dealership dashboard <ArrowRight size={17} /></Link><a className="landing-button landing-button--ghost" href={landingLinks.scraping} target="_blank" rel="noreferrer">Explore vehicle data <ExternalLink size={15} /></a></div><div className="landing-hero-pills"><span><CheckCircle2 size={14} /> Inventory to operations</span><span><CheckCircle2 size={14} /> Manual data ingestion</span><span><CheckCircle2 size={14} /> Built for control</span></div></div><div className="landing-hero-visual" aria-label="Complete graphite crossover vehicle preview"><div className="landing-hero-orbit landing-hero-orbit--one" /><div className="landing-hero-orbit landing-hero-orbit--two" /><div className="landing-hero-label landing-hero-label--top"><span className="landing-live-dot" /> INVENTORY READY <strong>01 / 04</strong></div><div className="landing-hero-label landing-hero-label--bottom"><span>RTA / AUTOMOTIVE PLATFORM</span><strong>BUILT FOR THE NEXT TURN</strong></div><img src="/rta-hero-vehicle.png" alt="Graphite performance crossover vehicle" loading="eager" /></div><div className="landing-scroll-cue"><span>SCROLL TO EXPLORE</span><ChevronDown size={15} /></div></section>;
}

function PlatformStats() {
  return <section className="landing-stats" aria-label="Sanitized demo workspace snapshot"><div className="landing-section-frame landing-stats-inner"><p className="landing-stat-intro">Demo workspace<br /><span>seeded for the next move.</span></p>{platformStats.map(([value, label]) => <div className="landing-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>;
}

function BusinessProblemSection() {
  return <section className="landing-section landing-problem" id="problem"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">THE DEALERSHIP CHALLENGE</p><h2>Built around the way<br /><span>dealerships actually operate.</span></h2></div><p>Dealership work touches people, vehicles, money and documentation at the same time. RTA gives those connected responsibilities a shared operational surface.</p></div><div className="landing-problem-grid">{businessProblems.map(([Icon, title, text]) => <article key={title}><span className="landing-problem-icon"><Icon size={19} /></span><p className="landing-eyebrow">OPERATIONAL NEED</p><h3>{title}</h3><p>{text}</p></article>)}</div><div className="landing-problem-transition"><span><CheckCircle2 size={16} /> One operational platform</span><strong>RTA brings the workflows together.</strong></div></div></section>;
}

function ProductOverviewSection() {
  return <section className="landing-section landing-product-overview"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">THE PRODUCT</p><h2>One platform.<br /><span>Multiple dealership workflows.</span></h2></div><p>Each surface has a business purpose: move a lead forward, understand inventory, record a sale, support the team or keep the operation accountable.</p></div><div className="landing-product-map">{productAreas.map(([title, text, tags], index) => <article key={title}><div><span>0{index + 1}</span><h3>{title}</h3></div><p>{text}</p><footer>{tags.map((tag) => <span key={tag}>{tag}</span>)}</footer></article>)}</div></div></section>;
}

function InventorySection() {
  return <section className="landing-section landing-inventory" id="inventory"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">VEHICLE DISCOVERY</p><h2>Find the right<br /><span>vehicle signal.</span></h2></div><p>Searchable vehicle records sit next to the dealership workflows that make them useful. This first-look inventory uses sanitized preview data and never blocks first paint on a sleeping API.</p></div><div className="landing-inventory-search" aria-label="Inventory filter preview"><div><small>MAKE</small><span>Volkswagen</span></div><div><small>MODEL</small><span>Tiguan</span></div><div><small>YEAR</small><span>Any year</span></div><div><small>PRICE RANGE</small><span>Any price</span></div><div><small>MILEAGE</small><span>Any mileage</span></div><div><small>SOURCE</small><span>All sources</span></div><button type="button" aria-label="Preview search"><Search size={18} /></button></div><div className="landing-inventory-head"><div><p className="landing-eyebrow">SANITIZED PREVIEW DATA</p><h3>Featured vehicles</h3></div><span>Fields mirror persisted listing records <ArrowRight size={14} /></span></div><div className="landing-vehicle-cards">{previewVehicles.map((vehicle) => <article className="landing-vehicle-card" key={vehicle.title}><div className={`landing-vehicle-card-image landing-vehicle-card-image--${vehicle.tone}`}><img src={vehicle.image} alt={`${vehicle.title} preview`} loading="lazy" /><span className="landing-vehicle-badge">{vehicle.source.split(" · ")[0]}</span><span className="landing-vehicle-year">{vehicle.year}</span></div><div className="landing-vehicle-card-copy"><small>{vehicle.source}</small><h4>{vehicle.title}</h4><div><strong>{vehicle.price}</strong><span>{vehicle.mileage}</span></div></div></article>)}</div><div className="landing-inventory-cta"><span><Car size={17} /> Vehicle fields are drawn from the project listing contract.</span><a href={landingLinks.scraping} target="_blank" rel="noreferrer" className="landing-text-link">View vehicle data platform <ExternalLink size={14} /></a></div></div></section>;
}

function ProductWindow({ scraping = false }: { scraping?: boolean }) {
  return <div className={scraping ? "landing-product-window landing-product-window--scraping" : "landing-product-window"}><div className="landing-window-bar"><span /><span /><span /><small>{scraping ? "vehicle-intelligence / run" : "rta-operations / command-centre"}</small></div><div className="landing-window-body"><div className="landing-window-rail"><b>RTA</b><i /><i /><i /><i /><i /></div><div className="landing-window-main"><div className="landing-window-heading"><div><small>{scraping ? "SCRAPING WORKSPACE" : "DEALERSHIP INTELLIGENCE"}</small><h3>{scraping ? "Vehicle data pipeline" : "Dealership command centre"}</h3></div><span className="landing-window-avatar">RTA</span></div><div className="landing-window-cards"><span><small>{scraping ? "RECORDS READY" : "OPEN LEADS"}</small><strong>{scraping ? "Demo" : "Live"}</strong><em><Activity size={11} /> status</em></span><span><small>{scraping ? "SOURCES" : "THIS MONTH"}</small><strong>{scraping ? "03" : "Ops"}</strong><em><BarChart3 size={11} /> visible</em></span></div><div className="landing-window-table"><div><span />{scraping ? "OLX Pakistan" : "Lead management"}<b>{scraping ? "CONFIGURED" : "READY"}</b></div><div><span />{scraping ? "PakWheels" : "Sales pipeline"}<b>{scraping ? "CONFIGURED" : "READY"}</b></div><div><span />{scraping ? "Demo source" : "Audit history"}<b>{scraping ? "REFERENCE" : "READY"}</b></div></div></div></div></div>;
}

function OperationsSection() {
  return <section className="landing-section landing-operations" id="operations"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">DEALERSHIP OPERATIONS</p><h2>Everything your<br /><span>team needs to operate.</span></h2></div><p>RTA is more than an inventory screen. It gives each dealership role a focused workspace for the work around leads, vehicles, deals, people, documents and accountability.</p></div><div className="landing-operations-layout"><div className="landing-operations-window"><ProductWindow /><div className="landing-floating-card landing-floating-card--sales"><CircleDollarSign size={16} /><span><small>SALES VISIBILITY</small><strong>Deals stay connected</strong></span></div><div className="landing-floating-card landing-floating-card--team"><Users size={16} /><span><small>WORKSPACE ROLES</small><strong>People see their lane</strong></span></div></div><div className="landing-module-grid">{operationModules.map(([title, text, key], index) => <article key={key}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></div></section>;
}

function LeadFlowSection() {
  const steps = [["01", "Lead captured", "leads"], ["02", "Customer follow-up", "customer"], ["03", "Vehicle selected", "inventory"], ["04", "Sale recorded", "sales"], ["05", "Commission and audit", "reporting"]];
  return <section className="landing-section landing-lead-flow"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">THE OPERATIONAL LOOP</p><h2>From first contact<br /><span>to a recorded deal.</span></h2></div><p>A clean product workflow keeps the customer journey visible while targets, commissions, team activity and audit history remain close to the transaction.</p></div><div className="landing-step-flow">{steps.map(([number, title, key], index) => <div className="landing-step" key={key}><span>{number}</span><strong>{title}</strong>{index < steps.length - 1 && <ArrowRight size={17} />}</div>)}</div><div className="landing-flow-caption"><span><CheckCircle2 size={15} /> Product workflow, not a background scheduler</span><Link to="/login" className="landing-text-link">Open operations workspace <ArrowUpRight size={14} /></Link></div></div></section>;
}

function PerformanceSection() {
  return <section className="landing-section landing-performance"><div className="landing-section-frame"><div className="landing-performance-grid"><div><p className="landing-eyebrow">PERFORMANCE VISIBILITY</p><h2>Know what is moving.<br /><span>Know where to act.</span></h2><p>Targets, sales representatives, commissions, deal history and team performance are presented as operational surfaces—not decorative charts.</p><div className="landing-performance-links"><span><Target size={16} /> Sales targets</span><span><BarChart3 size={16} /> Performance analytics</span><span><CircleDollarSign size={16} /> Commission visibility</span><span><Activity size={16} /> Audit activity</span></div></div><div className="landing-analytics-card"><div className="landing-demo-label">DEMO PREVIEW · SANITIZED VALUES</div><div className="landing-analytics-top"><span><small>TEAM PERFORMANCE</small><strong>Operational view</strong></span><BarChart3 size={19} /></div><div className="landing-bars"><div><small>LEADS</small><i><b style={{ width: "72%" }} /></i></div><div><small>DEALS</small><i><b style={{ width: "55%" }} /></i></div><div><small>TARGETS</small><i><b style={{ width: "84%" }} /></i></div><div><small>COMMISSION</small><i><b style={{ width: "63%" }} /></i></div></div><div className="landing-analytics-foot"><span><Users size={14} /> Role-aware workspace</span><span><ShieldCheck size={14} /> Auditable activity</span></div></div></div></div></section>;
}

function TeamSection() {
  return <section className="landing-section landing-team"><div className="landing-section-frame"><div className="landing-team-layout"><div className="landing-team-visual"><div className="landing-team-card landing-team-card--main"><Users size={20} /><small>TEAM MANAGEMENT</small><strong>Workspace-scoped people</strong><span>Roles keep sensitive operations in the right hands.</span></div><div className="landing-team-card landing-team-card--doc"><FileText size={18} /><small>PRIVATE DOCUMENTS</small><strong>S3-backed access</strong><span>Short-lived links and review history.</span></div><div className="landing-team-card landing-team-card--audit"><ShieldCheck size={18} /><small>AUDIT HISTORY</small><strong>Every important change</strong><span>Actor, entity and server timestamp.</span></div></div><div><p className="landing-eyebrow">PEOPLE & ACCOUNTABILITY</p><h2>The operational layer<br /><span>behind every sale.</span></h2><p className="landing-team-copy">Manage dealership employees, role permissions and private documents from the same workspace that tracks performance. Sensitive mutations are designed to be visible and auditable.</p><div className="landing-role-list"><span>Admin</span><span>Employee</span><span>Recruiter</span><span>Virtual assistant</span><span>Viewer</span></div><Link to={landingLinks.dealership} className="landing-button landing-button--dark">Explore team operations <ArrowRight size={16} /></Link></div></div></div></section>;
}

function VisibilitySection() {
  return <section className="landing-section landing-visibility"><div className="landing-section-frame"><div className="landing-visibility-layout"><div><p className="landing-eyebrow">OPERATIONAL VISIBILITY</p><h2>Every important action<br /><span>stays traceable.</span></h2><p>Audit history gives managers a durable record of changes across the work that matters: people, documents, sales and operating configuration.</p><Link to="/login" className="landing-text-link">Review the operations workspace <ArrowUpRight size={14} /></Link></div><div className="landing-activity-card"><div className="landing-activity-head"><span>RECENT ACTIVITY</span><ShieldCheck size={16} /></div><div><span className="landing-activity-dot" /><p><strong>Sale status updated</strong><small>Funded deal · server recorded</small></p><time>Now</time></div><div><span className="landing-activity-dot" /><p><strong>Document review completed</strong><small>Employee record · access controlled</small></p><time>Today</time></div><div><span className="landing-activity-dot" /><p><strong>Target configuration changed</strong><small>Performance planning · audited</small></p><time>Today</time></div></div></div></div></section>;
}

function WhyScrapingSection() {
  return <section className="landing-section landing-why-scraping"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">WHY VEHICLE DATA</p><h2>Vehicle information<br /><span>without manual collection.</span></h2></div><p>Dealership operations are stronger when vehicle information is structured, searchable and available beside the workflows that use it. RTA connects approved sources to inventory intelligence through intentional manual runs.</p></div><div className="landing-transformation"><article><span>01</span><Search size={20} /><h3>Approved source</h3><p>A controlled request starts with an allowlisted vehicle source.</p></article><ArrowRight size={20} /><article><span>02</span><Database size={20} /><h3>Raw listing</h3><p>Vehicle details, pricing, mileage and source context are collected.</p></article><ArrowRight size={20} /><article><span>03</span><Layers size={20} /><h3>Usable inventory</h3><p>Normalized records return to searchable dealership surfaces.</p></article></div><div className="landing-why-note"><CheckCircle2 size={16} /> Scraping supports the product; it does not replace dealership operations.</div></div></section>;
}

function SourcesSection() {
  const sources = [["PakWheels", "Cheerio", "Configured source", "pakwheels"], ["OLX Pakistan", "Playwright + Chromium", "Configured source", "olx-pakistan"], ["Demo Source", "Cheerio", "Synthetic reference", "demo-synthetic"]];
  return <section className="landing-section landing-sources"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">APPROVED SOURCE CONTROL</p><h2>Know where the<br /><span>vehicle data comes from.</span></h2></div><p>Approved sources make vehicle acquisition understandable and controlled. Each connector exposes its collection method and stays subject to the same manual limits.</p></div><div className="landing-source-grid">{sources.map(([name, engine, status, key], index) => <article key={key}><div className="landing-source-top"><span>0{index + 1}</span><span className={status === "Synthetic reference" ? "landing-source-status landing-source-status--demo" : "landing-source-status"}>{status === "Synthetic reference" ? "Test data" : "Approved source"}</span></div><h3>{name}</h3><p>Vehicle listing connector</p><div><span>{engine}</span><span>{status === "Synthetic reference" ? "Synthetic" : "Allowlisted"}</span></div></article>)}</div></div></section>;
}

function PipelineSection() {
  return <section className="landing-section landing-pipeline" id="pipeline"><div className="landing-section-frame"><div className="landing-section-heading landing-section-heading--light"><div><p className="landing-eyebrow">VEHICLE DATA PLATFORM</p><h2>From public listings<br /><span>to structured data.</span></h2></div><p>Scraping is introduced after the product story: an explicit operator request enters a protected queue, reaches the Azure worker, and returns searchable records to the data dashboard.</p></div><div className="landing-pipeline-flow"><div className="landing-flow-node"><span className="landing-flow-number">01</span><Search size={22} /><strong>Approved sources</strong><small>Allowlisted pages</small></div><span className="landing-flow-arrow"><ArrowRight size={19} /></span><div className="landing-flow-node"><span className="landing-flow-number">02</span><Workflow size={22} /><strong>Scraping API</strong><small>Manual trigger</small></div><span className="landing-flow-arrow"><ArrowRight size={19} /></span><div className="landing-flow-node"><span className="landing-flow-number">03</span><Database size={22} /><strong>BullMQ + Redis</strong><small>Queue and lock</small></div><span className="landing-flow-arrow"><ArrowRight size={19} /></span><div className="landing-flow-node landing-flow-node--accent"><span className="landing-flow-number">04</span><Zap size={22} /><strong>Azure worker</strong><small>Cheerio / Playwright</small></div><span className="landing-flow-arrow"><ArrowRight size={19} /></span><div className="landing-flow-node"><span className="landing-flow-number">05</span><Layers size={22} /><strong>Neon records</strong><small>Searchable inventory</small></div></div><div className="landing-pipeline-note"><span><span className="landing-live-dot" /> MANUAL-ONLY MODE</span><span>5 default vehicles</span><span>10 hard maximum</span><span>One worker task</span><span>Browser closes after run</span></div><div className="landing-dealership-ingestion"><span><ServerCog size={17} /><strong>Dealership ingestion reference</strong></span><span>Dealership API <ArrowRight size={14} /> AWS SQS <ArrowRight size={14} /> AWS Lambda <ArrowRight size={14} /> processing / storage</span><small>Configuration-dependent showcase integration; separate from the BullMQ scraping path.</small></div></div></section>;
}

function AwsServicesSection() {
  return <section className="landing-section landing-aws"><div className="landing-section-frame"><div className="landing-aws-layout"><div><p className="landing-eyebrow">SEPARATE AWS SERVICES</p><h2>Different jobs.<br /><span>Purpose-built async paths.</span></h2><p>The dealership platform retains a separate SQS/Lambda ingestion path for showcase and configuration-dependent processing, while employee documents use private S3 storage.</p><div className="landing-aws-flow"><span>Dealership API</span><ArrowRight size={16} /><span>AWS SQS</span><ArrowRight size={16} /><span>AWS Lambda</span></div></div><div className="landing-storage-card"><FileText size={20} /><div><small>EMPLOYEE DOCUMENTS</small><strong>Private S3 storage</strong><span>Upload intents, metadata and access controls stay separate from vehicle scraping.</span></div><ShieldCheck size={18} /></div></div></div></section>;
}

function ReliabilitySection() {
  return <section className="landing-section landing-reliability"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">CONTROLLED DATA INGESTION</p><h2>Built for controlled,<br /><span>reliable processing.</span></h2></div><p>Reliability here means clear limits, observable state and predictable cleanup. The system is intentionally designed for portfolio-scale manual runs.</p></div><div className="landing-reliability-grid">{reliabilityItems.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><CheckCircle2 size={17} /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>;
}

function ArchitectureSection() {
  return <section className="landing-section landing-architecture" id="architecture"><div className="landing-section-frame"><div className="landing-section-heading landing-section-heading--light"><div><p className="landing-eyebrow">MULTI-CLOUD ARCHITECTURE</p><h2>The product stays clear<br /><span>because every layer has a job.</span></h2></div><p>Public interfaces, APIs, queues, workers and storage are separated so the dealership experience can stay focused while engineering depth remains visible.</p></div><div className="landing-architecture-map"><div className="landing-arch-column"><small>INTERFACES</small><span><Layers size={16} /> Dealership web <em>Vercel</em></span><span><Search size={16} /> Scraping web <em>Vercel</em></span></div><div className="landing-arch-connector"><i /><i /><i /></div><div className="landing-arch-column"><small>APPLICATIONS</small><span><ServerCog size={16} /> Dealership API <em>Render</em></span><span><Workflow size={16} /> Scraping API <em>Render</em></span><span><Zap size={16} /> Scraping worker <em>Azure VM</em></span></div><div className="landing-arch-connector"><i /><i /><i /></div><div className="landing-arch-column"><small>DATA / INTEGRATION</small><span><Database size={16} /> PostgreSQL <em>Neon</em></span><span><Activity size={16} /> Queue state <em>Northflank Redis</em></span><span><GitBranch size={16} /> Reference path <em>AWS SQS / Lambda / S3</em></span></div></div></div></section>;
}

function TechnologySection() {
  return <section className="landing-tech"><div className="landing-section-frame landing-tech-inner"><div><p className="landing-eyebrow">ENGINEERING FOUNDATION</p><h2>Modern pieces.<br /><span>Clear responsibilities.</span></h2></div><div className="landing-tech-groups">{techGroups.map(([group, technologies]) => <div key={group}><small>{group}</small>{technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>)}</div></div></section>;
}

function EngineeringContributionSection() {
  const contributions: Array<[LucideIcon, string, string]> = [[Workflow, "Asynchronous processing", "Kept browser-heavy acquisition outside request/response work with queues, locks and a dedicated worker."], [ShieldCheck, "Controlled execution", "Bounded manual runs, input validation, retries and one-worker concurrency protect a small production VM."], [GitBranch, "Multi-cloud delivery", "Connected Vercel, Render, Neon, Northflank, Azure and AWS responsibilities into deployable paths."], [Zap, "Safe operations", "Added health checks, graceful cleanup, audit visibility and rollback-ready deployment behavior."]];
  return <section className="landing-section landing-engineering"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">ENGINEERING OWNERSHIP</p><h2>What was actually<br /><span>engineered behind the product.</span></h2></div><p>The implementation work is visible in the product: dependable workflows for people and vehicles, with infrastructure that supports them without taking over the story.</p></div><div className="landing-engineering-grid">{contributions.map(([Icon, title, text], index) => <article key={title}><span className="landing-engineering-index">0{index + 1}</span><Icon size={21} /><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>;
}

function ProductResultSection() {
  return <section className="landing-section landing-result"><div className="landing-section-frame"><div className="landing-result-panel"><div><p className="landing-eyebrow">THE RESULT</p><h2>One operational view<br /><span>of the dealership.</span></h2></div><div><p>RTA connects vehicle intelligence with the work that follows: leads, sales, targets, commissions, employees, documents and traceable activity.</p><div className="landing-result-points"><span>Centralized operations</span><span>Structured vehicle information</span><span>Clearer sales visibility</span><span>Controlled data ingestion</span></div></div></div></div></section>;
}

function LivePreviewSection() {
  return <section className="landing-section landing-live-preview"><div className="landing-section-frame"><div className="landing-section-heading"><div><p className="landing-eyebrow">LIVE PRODUCT PREVIEW</p><h2>Two surfaces.<br /><span>One connected system.</span></h2></div><p>The product is split by responsibility: dealership teams operate the business, while the acquisition workspace controls approved vehicle-data runs.</p></div><div className="landing-preview-grid"><article><ProductWindow /><footer><span>01 / DEALERSHIP PLATFORM</span><strong>Command centre, leads, sales and team operations</strong></footer></article><article><ProductWindow scraping /><footer><span>02 / VEHICLE DATA PLATFORM</span><strong>Sources, processing status and searchable records</strong></footer></article></div></div></section>;
}

function ProductSplitCta() {
  return <section className="landing-product-split"><div className="landing-product-split-card"><span className="landing-split-number">01</span><p className="landing-eyebrow">DEALERSHIP OPERATIONS</p><h2>Run the floor<br /><span>with confidence.</span></h2><div><span>Leads</span><span>Sales</span><span>Targets</span><span>Commissions</span><span>Team</span><span>Documents</span><span>Audit</span><span>Inventory</span></div><Link to={landingLinks.dealership} className="landing-button landing-button--light">Open dealership dashboard <ArrowRight size={16} /></Link></div><div className="landing-product-split-card landing-product-split-card--dark"><span className="landing-split-number">02</span><p className="landing-eyebrow">VEHICLE DATA PLATFORM</p><h2>Power inventory<br /><span>with better signals.</span></h2><div><span>Sources</span><span>Queue</span><span>Worker</span><span>Listings</span><span>Scrape status</span></div><a href={landingLinks.scraping} target="_blank" rel="noreferrer" className="landing-button landing-button--outline-light">Open scraping dashboard <ExternalLink size={15} /></a></div></section>;
}

function LandingFooter() {
  return <footer className="landing-footer"><div className="landing-section-frame"><div className="landing-footer-main"><div><a className="landing-brand" href="#top"><span className="landing-brand-mark"><Car size={17} strokeWidth={2.5} /></span><span>RTA<span className="landing-brand-dot">.</span></span></a><p>Dealership operations and vehicle intelligence, connected with intent.</p></div><div className="landing-footer-links"><a href="#inventory">Inventory</a><a href="#operations">Operations</a><a href="#pipeline">Vehicle data</a><a href={landingLinks.github} target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a><Link to={landingLinks.dealership}>Sign in <ArrowUpRight size={13} /></Link></div></div><div className="landing-footer-bottom"><span>© 2026 RTA platform</span><span>Portfolio project · Product first, engineering underneath.</span></div></div></footer>;
}

export function LandingPage() {
  return <main className="landing-page"><LandingNav /><HeroSection /><PlatformStats /><BusinessProblemSection /><ProductOverviewSection /><InventorySection /><OperationsSection /><LeadFlowSection /><PerformanceSection /><TeamSection /><VisibilitySection /><WhyScrapingSection /><SourcesSection /><PipelineSection /><AwsServicesSection /><ReliabilitySection /><ArchitectureSection /><TechnologySection /><EngineeringContributionSection /><ProductResultSection /><LivePreviewSection /><ProductSplitCta /><section className="landing-final-cta"><div><p className="landing-eyebrow">RUN THE DEALERSHIP / POWER THE INVENTORY / CONTROL THE DATA</p><h2>Make the next turn<br /><span>with clarity.</span></h2><p>Explore the operating workspace or inspect the vehicle-data surface behind it.</p><div className="landing-hero-actions"><Link className="landing-button landing-button--primary" to={landingLinks.dealership}>Explore dealership <ArrowRight size={17} /></Link><a className="landing-button landing-button--light" href={landingLinks.scraping} target="_blank" rel="noreferrer">Explore vehicle data <ExternalLink size={15} /></a><a className="landing-button landing-button--outline-light" href="#architecture">View architecture <ArrowRight size={15} /></a></div></div><div className="landing-final-vehicle"><img src="/rta-hero-vehicle.png" alt="Complete graphite crossover vehicle" loading="lazy" /></div></section><LandingFooter /></main>;
}
