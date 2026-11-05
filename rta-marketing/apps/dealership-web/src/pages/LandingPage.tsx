import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Car,
  ChevronDown,
  ExternalLink,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  Sparkles,
  Users,
  X,
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

const chapters = [
  { id: "top", number: "01", label: "The cover" },
  { id: "solutions", number: "02", label: "The thought" },
  { id: "operations", number: "03", label: "The hand-off" },
  { id: "ai-intelligence", number: "04", label: "The signal" },
  { id: "inventory", number: "05", label: "The collection" },
  { id: "workspace", number: "06", label: "Inside the workspace" },
  { id: "architecture", number: "07", label: "The craft" },
] as const;

function JournalHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="journal-header">
      <a className="journal-wordmark" href="#top" aria-label="RTA home">
        <span className="journal-logo-icon">
          <Car size={19} />
        </span>
        <span>
          RTA<span>.</span>
        </span>
        <small>THE DEALERSHIP JOURNAL</small>
      </a>
      <button
        className="journal-menu-toggle"
        type="button"
        aria-controls="journal-navigation"
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav
        id="journal-navigation"
        className={`journal-nav-links${open ? " is-open" : ""}`}
        aria-label="Journal chapters"
      >
        <a href="#solutions" onClick={close}>
          The idea <span>01</span>
        </a>
        <a href="#operations" onClick={close}>
          The hand-off <span>02</span>
        </a>
        <a href="#ai-intelligence" onClick={close}>
          Intelligence <span>03</span>
        </a>
        <a href="#workspace" onClick={close}>
          Inside RTA <span>04</span>
        </a>
        <Link to="/inventory" onClick={close}>
          The collection <ArrowUpRight size={12} />
        </Link>
        <Link className="journal-nav-entry" to="/login" onClick={close}>
          Enter RTA <ArrowUpRight size={14} />
        </Link>
      </nav>
    </header>
  );
}

function ChapterRail({ active }: { active: string }) {
  return (
    <nav className="chapter-rail" aria-label="Page chapters">
      <span className="chapter-rail-label">CHAPTER</span>
      {chapters.map((chapter) => (
        <a
          key={chapter.id}
          href={`#${chapter.id}`}
          className={chapter.id === active ? "is-current" : ""}
          aria-label={`${chapter.number}. ${chapter.label}`}
          aria-current={chapter.id === active ? "location" : undefined}
        >
          <span>{chapter.number}</span>
          <i />
        </a>
      ))}
      <span className="chapter-rail-tail">RTA / MMXXVI</span>
    </nav>
  );
}

function CoverChapter() {
  return (
    <section className="journal-cover" id="top" aria-labelledby="journal-title">
      <img
        className="journal-cover-image"
        src="/rta-journal-cover.webp"
        alt="A graphite grand tourer outside a glass showroom at blue hour, reflected in the rain-dark street"
        width={1774}
        height={887}
        fetchPriority="high"
        decoding="async"
      />
      <div className="journal-cover-shade" aria-hidden="true" />
      <div className="journal-cover-caption">
        <span>RTA JOURNAL</span>
        <span>FIELD NOTES / 001</span>
        <span>DEALERSHIP, RECONSIDERED</span>
      </div>
      <div className="journal-cover-body">
        <span className="journal-overline">
          <i /> AN OPERATING SYSTEM FOR THE MODERN DEALERSHIP
        </span>
        <h1 id="journal-title">
          The dealership,
          <br />
          in a different
          <br />
          <em>gear.</em>
        </h1>
        <p>
          There’s a better way to connect the people, the cars, and every
          conversation in between.
        </p>
        <div className="journal-cover-actions">
          <Link to="/login">
            Step inside RTA <ArrowUpRight size={17} />
          </Link>
          <span>BUILT FOR THE PEOPLE WHO MOVE IT FORWARD.</span>
        </div>
      </div>
      <div className="journal-cover-vertical" aria-hidden="true">
        RTA / 01 — THE CONNECTED EDITION
      </div>
      <a className="journal-scroll-note" href="#solutions">
        <span>TURN THE PAGE</span>
        <ArrowDown size={16} />
      </a>
      <span className="journal-cover-folio" aria-hidden="true">
        01
      </span>
    </section>
  );
}

function ThoughtChapter() {
  const ideas = [
    {
      number: "01",
      verb: "Notice",
      text: "An enquiry is a person starting a conversation.",
      Icon: MessageSquare,
    },
    {
      number: "02",
      verb: "Connect",
      text: "The right vehicle turns interest into possibility.",
      Icon: Car,
    },
    {
      number: "03",
      verb: "Move",
      text: "A prepared team carries that moment forward.",
      Icon: Users,
    },
  ];
  return (
    <section
      className="journal-chapter thought-chapter"
      id="solutions"
      aria-labelledby="thought-title"
    >
      <div className="journal-index">
        <span>02</span>
        <i />
        THE IDEA
      </div>
      <div className="thought-head">
        <h2 id="thought-title">
          A customer doesn’t
          <br />
          think in <em>departments.</em>
        </h2>
        <p>
          They just want the right answer, the right car, and a team that
          already knows the story.
        </p>
      </div>
      <div className="journey-notes">
        {ideas.map(({ number, verb, text, Icon }) => (
          <article className="journey-note" key={number}>
            <span className="journey-note-number">{number}</span>
            <Icon size={19} strokeWidth={1.5} />
            <h3>
              {verb}
              <span>.</span>
            </h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="thought-route" aria-hidden="true">
        <span>ONE CUSTOMER</span>
        <svg viewBox="0 0 960 52" preserveAspectRatio="none">
          <path d="M1 27h225l35-14h245l31 18h216l32-14h174" />
          <circle cx="1" cy="27" r="4" />
          <circle cx="226" cy="27" r="4" />
          <circle cx="506" cy="31" r="4" />
          <circle cx="753" cy="31" r="4" />
          <circle cx="959" cy="17" r="4" />
        </svg>
        <span>ONE CONNECTED JOURNEY</span>
      </div>
    </section>
  );
}

const journeyStages = [
  {
    name: "First contact",
    note: "A new enquiry arrives. Its story begins.",
    signal: "A person, not a record.",
  },
  {
    name: "The right follow-up",
    note: "Give your team the context to make it personal.",
    signal: "The next conversation.",
  },
  {
    name: "A better match",
    note: "Connect what matters to the vehicles worth seeing.",
    signal: "The right vehicle.",
  },
  {
    name: "A sale that stays visible",
    note: "Keep the deal, the team, and its progress in view.",
    signal: "A shared result.",
  },
] as const;

function HandoffChapter() {
  const [active, setActive] = useState(0);
  const stage = journeyStages[active]!;
  return (
    <section
      className="journal-chapter handoff-chapter"
      id="operations"
      aria-labelledby="handoff-title"
    >
      <div className="handoff-backdrop" aria-hidden="true">
        <img src="/rta-dealership-showroom.webp" alt="" loading="lazy" />
        <span />
      </div>
      <div className="journal-index journal-index--light">
        <span>03</span>
        <i />
        THE HAND-OFF
      </div>
      <div className="handoff-content">
        <div className="handoff-title">
          <h2 id="handoff-title">
            A lead is
            <br />
            never <em>just a lead.</em>
          </h2>
          <p>
            Good dealerships understand what happens between first contact and
            the keys.
          </p>
        </div>
        <div className="handoff-sequence">
          <div className="handoff-wordmark">
            <span>RTA / CUSTOMER JOURNEY</span>
            <strong>{stage.signal}</strong>
            <i>{String(active + 1).padStart(2, "0")}</i>
          </div>
          <div
            className="handoff-tabs"
            role="tablist"
            aria-label="Explore a connected customer journey"
            aria-orientation="vertical"
          >
            {journeyStages.map((item, index) => (
              <button
                type="button"
                role="tab"
                id={`journey-tab-${index}`}
                aria-selected={active === index}
                aria-controls="journey-panel"
                tabIndex={active === index ? 0 : -1}
                className={active === index ? "is-active" : ""}
                key={item.name}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  let next = index;
                  if (event.key === "ArrowDown" || event.key === "ArrowRight")
                    next = (index + 1) % journeyStages.length;
                  else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
                    next =
                      (index - 1 + journeyStages.length) % journeyStages.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = journeyStages.length - 1;
                  else return;
                  event.preventDefault();
                  setActive(next);
                  document.getElementById(`journey-tab-${next}`)?.focus();
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.name}</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <div
            className="handoff-note"
            role="tabpanel"
            id="journey-panel"
            aria-labelledby={`journey-tab-${active}`}
          >
            <h3>{stage.name}.</h3>
            <p>{stage.note}</p>
          </div>
        </div>
      </div>
      <div className="handoff-baseline">
        <span>LEADS / INVENTORY / PEOPLE / PERFORMANCE</span>
        <span>ALL PART OF THE SAME STORY.</span>
      </div>
    </section>
  );
}

function SignalChapter() {
  const prompts = [
    "Which opportunities need my attention?",
    "Find a vehicle for this customer.",
    "What should the team focus on today?",
  ];
  return (
    <section
      className="journal-chapter signal-chapter"
      id="ai-intelligence"
      aria-labelledby="signal-title"
    >
      <div className="journal-index">
        <span>04</span>
        <i />
        THE SIGNAL
      </div>
      <div className="signal-layout">
        <div className="signal-editorial">
          <span className="signal-kicker">
            <Sparkles size={14} /> RTA INTELLIGENCE / BUILT IN
          </span>
          <h2 id="signal-title">
            The better
            <br />
            question is
            <br />
            <em>closer.</em>
          </h2>
          <p>
            A grounded, read-only assistant helps your team understand its
            leads, inventory, and performance in everyday language.
          </p>
          <button
            type="button"
            className="signal-open"
            onClick={() => openRtaAssistant(prompts[0])}
          >
            Ask RTA a question <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="signal-conversation">
          <span className="signal-conversation-label">
            A QUESTION FROM THE FLOOR <i>↗</i>
          </span>
          <blockquote>“{prompts[0]}”</blockquote>
          <div className="signal-answer">
            <span className="signal-answer-mark">
              <Sparkles size={17} />
            </span>
            <p>
              Connect lead context with recent conversations and current vehicle
              interest, then agree on the follow-up together.
            </p>
          </div>
          <span className="signal-context">
            READ-ONLY CONTEXT / YOUR WORKSPACE
          </span>
          <div className="signal-prompts">
            {prompts.slice(1).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => openRtaAssistant(prompt)}
              >
                {prompt}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InventoryChapter() {
  const inventory = useQuery({
    queryKey: ["public-inventory", "featured"],
    queryFn: () =>
      api<PublicInventoryResponse>("/scraping-results/public?limit=8"),
    staleTime: 60_000,
  });
  const vehicles = inventory.data?.data.items ?? [];
  return (
    <section
      className="journal-chapter collection-chapter"
      id="inventory"
      aria-labelledby="collection-title"
    >
      <div className="journal-index">
        <span>05</span>
        <i />
        THE COLLECTION
      </div>
      <div className="collection-heading">
        <h2 id="collection-title">
          Good finds.
          <br />
          <em>Clear choices.</em>
        </h2>
        <p>
          Explore recently collected listings from Romans International, Tom
          Hartley, and Redline Specialist Cars. Open source listings freely;
          sign in to save and compare.
        </p>
      </div>
      <div className="collection-toolbar">
        <div>
          <span className="collection-live-mark" />
          <span>LIVE SOURCE LISTINGS</span>
        </div>
        <Link to="/inventory">
          Browse every vehicle <ArrowUpRight size={15} />
        </Link>
      </div>
      {vehicles.length > 0 && (
        <div className="landing-vehicle-cards" aria-busy={inventory.isFetching}>
          {vehicles.map((vehicle) => (
            <PublicVehicleCard key={vehicle.id} item={vehicle} />
          ))}
        </div>
      )}
      {inventory.isFetching && !inventory.isLoading && (
        <div className="public-inventory-refresh" role="status">
          <Loader2 size={14} className="spin" /> Refreshing source listings…
        </div>
      )}
      {inventory.isLoading && (
        <PublicVehicleGridSkeleton count={4} variant="featured" />
      )}
      {inventory.isError && (
        <div className="public-inventory-state" role="alert">
          <AlertCircle size={24} />
          <strong>Live listings aren’t available right now.</strong>
          <span>Try again or browse all vehicles.</span>
          <button
            type="button"
            disabled={inventory.isFetching}
            onClick={() => void inventory.refetch()}
          >
            {inventory.isFetching ? "Retrying…" : "Try again"}
          </button>
          <Link to="/inventory">
            Browse all vehicles <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {!inventory.isLoading && !inventory.isError && vehicles.length === 0 && (
        <div className="public-inventory-state">
          <Car size={25} />
          <strong>No vehicles have landed just yet.</strong>
          <span>Current source listings appear here when available.</span>
          <Link to="/inventory">
            Open the collection <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {!inventory.isLoading && !inventory.isError && vehicles.length > 0 && (
        <p className="collection-footnote">
          <span>01 — 0{vehicles.length}</span>
          <span>RECENT LISTINGS, DIRECT FROM THE SOURCE</span>
          <Link to="/inventory">
            See the full collection <ArrowUpRight size={14} />
          </Link>
        </p>
      )}
    </section>
  );
}

function WorkspaceChapter() {
  const departments = [
    {
      number: "01",
      name: "The customer desk",
      summary: "Keep every conversation moving.",
      modules: ["Lead pipeline", "My day & priorities", "Appointments", "Follow-ups", "Team inbox & handoffs"],
      note: "From first enquiry to the next promised call.",
    },
    {
      number: "02",
      name: "The deal room",
      summary: "Make progress visible to the whole team.",
      modules: ["Sales & funded deals", "Targets", "Commissions", "Personal performance", "Team performance board"],
      note: "Track activity, outcomes, and the pace toward a goal.",
    },
    {
      number: "03",
      name: "The vehicle desk",
      summary: "Turn a broad search into a considered choice.",
      modules: ["Live inventory search", "Saved vehicles", "Side-by-side comparison", "Approved-source acquisition", "Source operations"],
      note: "Find, shortlist, compare, and inspect source listings.",
    },
    {
      number: "04",
      name: "The team & the record",
      summary: "Give each role a clear, accountable view.",
      modules: ["Role-aware overview", "Team & configuration", "Documents", "Audit history", "Virtual-assistant operations"],
      note: "Workspace access follows role permissions and recorded activity.",
    },
  ];
  return (
    <section className="journal-chapter workspace-chapter" id="workspace" aria-labelledby="workspace-title">
      <div className="journal-index">
        <span>06</span><i /> INSIDE THE WORKSPACE
      </div>
      <div className="workspace-heading">
        <div>
          <span className="workspace-kicker">A FIELD GUIDE TO RTA</span>
          <h2 id="workspace-title">The whole floor,<br />in <em>clear view.</em></h2>
        </div>
        <p>RTA brings the working parts of a dealership into one role-aware platform—from the first lead to team performance, live vehicle discovery, and the records behind each decision.</p>
      </div>
      <div className="workspace-index">
        <div className="workspace-index-head"><span>THE WORK / FOUR DESKS</span><span>OPEN THE LIVE WORKSPACE <ArrowUpRight size={13} /></span></div>
        {departments.map((department) => (
          <article className="workspace-row" key={department.number}>
            <span className="workspace-number">{department.number}</span>
            <div className="workspace-desk">
              <h3>{department.name}</h3>
              <p>{department.summary}</p>
              <span>{department.note}</span>
            </div>
            <ul>{department.modules.map((module) => <li key={module}>{module}</li>)}</ul>
            <Link className="workspace-open" to="/login" aria-label={`Explore ${department.name} in the RTA demo`}><ArrowUpRight size={17} /></Link>
          </article>
        ))}
      </div>
      <div className="workspace-foot">
        <span><i /> ROLE-AWARE VIEWS / SHARED WORKSPACE</span>
        <Link to="/login">Explore the recruiter demo <ArrowUpRight size={14} /></Link>
      </div>
    </section>
  );
}

function CraftChapter() {
  const links = [
    {
      name: "People & records",
      hint: "Roles, private documents, and an audit trail.",
    },
    {
      name: "Approved sources",
      hint: "Collection starts with a deliberate operator request.",
    },
    {
      name: "Grounded AI",
      hint: "Read-only tools, workspace permissions, no guessing.",
    },
  ];
  return (
    <section
      className="journal-chapter craft-chapter"
      id="architecture"
      aria-labelledby="craft-title"
    >
      <div className="journal-index journal-index--light">
        <span>07</span>
        <i />
        THE CRAFT
      </div>
      <div className="craft-heading">
        <h2 id="craft-title">
          Good design
          <br />
          has <em>good bones.</em>
        </h2>
        <p>Considered on the surface. Carefully engineered beneath.</p>
      </div>
      <div className="craft-ledger" id="pipeline">
        <div className="craft-ledger-head">
          <span>HOW RTA HOLDS TOGETHER</span>
          <span>THREE QUIETLY IMPORTANT THINGS</span>
        </div>
        {links.map(({ name, hint }, index) => (
          <div className="craft-ledger-row" key={name}>
            <span>0{index + 1}</span>
            <h3>{name}</h3>
            <p>{hint}</p>
            <span className="craft-ledger-arrow">
              <ArrowUpRight size={17} />
            </span>
          </div>
        ))}
      </div>
      <details className="craft-footnote">
        <summary>
          <span>
            <Layers size={16} /> A little further under the hood
          </span>
          <ChevronDown size={16} />
        </summary>
        <div>
          <p>
            React and TypeScript on the surface; Node.js, Express, and
            PostgreSQL behind the operation. Apify runs are explicitly requested
            and bounded. Workspace isolation, role checks, input validation, and
            rate limits protect authorized data.
          </p>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            Look through the engineering <ExternalLink size={13} />
          </a>
        </div>
      </details>
    </section>
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
              AI-powered dealership operations and vehicle intelligence,
              connected with intent.
            </p>
          </div>
          <div className="landing-footer-links">
            <a href={section("ai-intelligence")}>AI intelligence</a>
            <a href={section("inventory")}>Inventory</a>
            <a href={section("operations")}>Operations</a>
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
  const [activeChapter, setActiveChapter] = useState("top");
  useEffect(() => {
    const sections = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((section): section is HTMLElement => section !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActiveChapter(entry.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return (
    <main className="landing-page rta-journal">
      <JournalHeader />
      <ChapterRail active={activeChapter} />
      <CoverChapter />
      <ThoughtChapter />
      <HandoffChapter />
      <SignalChapter />
      <InventoryChapter />
      <WorkspaceChapter />
      <CraftChapter />
      <section className="journal-closer">
        <span className="journal-index journal-index--light">
          <span>07</span>
          <i />
          THE NEXT MOVE
        </span>
        <div>
          <h2>
            Tomorrow starts
            <br />
            with a <em>better move.</em>
          </h2>
          <Link to="/signup">
            Find your next gear <ArrowUpRight size={17} />
          </Link>
        </div>
        <span className="journal-closer-aside">
          RTA — BUILT AROUND THE WAY DEALERSHIPS ACTUALLY WORK.
        </span>
      </section>
      <LandingFooter />
    </main>
  );
}
