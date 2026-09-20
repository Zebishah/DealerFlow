import {
  Activity,
  BarChart3,
  Car,
  ChevronDown,
  CircleDollarSign,
  CalendarDays,
  FileText,
  Gauge,
  Heart,
  LogOut,
  Menu,
  MessageSquare,
  Inbox,
  ListChecks,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserPlus,
  UserCheck,
  Users,
  X,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { BootstrapData, UserRole } from "../types/domain";
import { NavLink, useNavigation } from "../router/Navigation";
import { PasswordChangeModal } from "./PasswordChangeModal";
import { openRtaAssistant } from "@rta/assistant-ui";

const nav = [
  { to: "/app/overview", label: "Overview", icon: Gauge, roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/leads", label: "Lead pipeline", icon: UserPlus, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/my-day", label: "My day", icon: ListChecks, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/appointments", label: "Appointments", icon: CalendarDays, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/follow-ups", label: "Follow-ups", icon: ListChecks, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/inbox", label: "Operations inbox", icon: Inbox, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/my-performance", label: "My performance", icon: BarChart3, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/va-operations", label: "Team operations", icon: Users, roles: ["admin", "recruiter"] },
  { to: "/app/sales", label: "Sales", icon: CircleDollarSign, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/team", label: "Team", icon: Users, roles: ["admin", "recruiter"] },
  { to: "/app/configuration", label: "Configuration", icon: SlidersHorizontal, roles: ["admin", "recruiter"] },
  { to: "/app/audit", label: "Audit history", icon: ShieldCheck, roles: ["admin", "recruiter"] },
  { to: "/app/commissions", label: "Commissions", icon: CircleDollarSign, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/targets", label: "Targets", icon: Target, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/performance-board", label: "Performance board", icon: Gauge, roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/documents", label: "Documents", icon: FileText, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/inventory", label: "Vehicle intelligence", icon: Car, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/saved-vehicles", label: "Saved vehicles", icon: Heart, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/compare", label: "Compare vehicles", icon: SlidersHorizontal, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/acquisition", label: "Scraping workspace", icon: Activity, roles: ["admin", "operator", "recruiter"] },
  { to: "/app/source-control", label: "Source controls", icon: ShieldCheck, roles: ["admin", "operator"] },
  { to: "/app/access-requests", label: "Access requests", icon: UserCheck, roles: ["admin"] },
] as const;

const pageTitles: Record<string, [string, string]> = {
  overview: ["Command centre", "Dealership performance at a glance"],
  leads: ["Lead pipeline", "Qualify, assign, and convert every opportunity"],
  "my-day": ["My day", "Prioritize the next customer action"],
  appointments: ["Appointments", "Book and confirm customer moments"],
  "follow-ups": ["Follow-ups", "Keep every customer thread moving"],
  inbox: ["Operations inbox", "Coordinate handoffs across the dealership"],
  "my-performance": ["My performance", "Customer engagement activity and outcomes"],
  "va-operations": ["Team operations", "Sales and BDC workload oversight"],
  sales: ["Sales workspace", "Track funded deals, gross profit, and delivery"],
  team: ["Team operations", "People, roles, and workload visibility"],
  configuration: ["Workspace configuration", "Lead sources and finance reference data"],
  audit: ["Audit history", "Trace important operational changes"],
  settings: ["Account settings", "Profile and credential security"],
  commissions: ["Commission control", "Transparent earnings and approval workflow"],
  targets: ["Monthly targets", "Align goals with measurable progress"],
  analytics: ["Performance analytics", "Decision-ready dealership trends"],
  "performance-board": ["Performance board", "Auto-refreshing team visibility"],
  documents: ["Employee documents", "Private insurance and compliance records"],
  inventory: ["Vehicle intelligence", "Search and compare persisted scraper listings"],
  "saved-vehicles": ["Saved vehicles", "Your private vehicle shortlist"],
  compare: ["Compare vehicles", "Evaluate scraped attributes side by side"],
  acquisition: ["Scraping workspace", "Collect and inspect persisted vehicle listings"],
  "scraping-results": ["Scraping workspace", "Collect and inspect persisted vehicle listings"],
  "source-control": ["Source controls", "Operational kill switches for acquisition adapters"],
  "access-requests": ["Access requests", "Review scoped recruiter evaluation access"],
};

function initials(firstName: string | null, lastName: string | null, email: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim().toUpperCase() || email.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { navigate, path } = useNavigation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`rta-read-notifications:${user.id}`) ?? "[]") as unknown;
      setReadNotificationIds(Array.isArray(stored) && stored.every((item): item is string => typeof item === "string") ? stored : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [user]);
  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((value) => value.data),
    staleTime: 5 * 60_000,
    enabled: Boolean(user?.workspaceId),
  });
  const notifications = useQuery({
    queryKey: ["customer-operations", "notifications"],
    queryFn: () => api<{ data: { unreadCount: number; items: Array<{ id: string; title: string; body: string; href: string }> } }>("/customer-operations/notifications").then((value) => value.data),
    enabled: Boolean(user?.workspaceId && ["admin", "employee", "virtual_assistant", "recruiter"].includes(user.role)),
    refetchInterval: 60_000,
  });
  if (!user) return null;
  const key = path.split("/").at(-1) ?? "overview";
  const [title, subtitle] = pageTitles[key] ?? pageTitles.overview!;
  const items = nav.filter((item) => (item.roles as readonly UserRole[]).includes(user.role));
  const workspace = bootstrap.data?.workspace;
  const contextualPrompts: Record<string, string> = {
    "my-day": user.role === "employee" ? "What should I prioritize today?" : "What should I work on first today?",
    appointments: user.role === "employee" ? "What appointments need preparation?" : "Which appointments still need confirmation?",
    "follow-ups": user.role === "employee" ? "What follow-ups are overdue?" : "What follow-ups are overdue and why?",
    inbox: user.role === "employee" ? "Summarize this handoff." : "Summarize the open customer handoffs that need attention.",
    "my-performance": "Summarize my customer engagement performance.",
    "va-operations": user.role === "admin" ? "Which team members have overdue work or manager requests need attention?" : "Which virtual assistants have overdue work or open escalations?",
  };
  const askPrompt = contextualPrompts[key] ?? `Explain the most useful intelligence available on the ${title.toLowerCase()} page.`;
  const intelligencePaths = ["/app/inventory", "/app/saved-vehicles", "/app/compare", "/app/acquisition", "/app/source-control", "/app/access-requests"];
  const customerOpsPaths = ["/app/my-day", "/app/appointments", "/app/follow-ups", "/app/inbox", "/app/my-performance", "/app/va-operations"];
  const performancePaths = ["/app/commissions", "/app/targets", "/app/analytics", "/app/performance-board"];
  const resourcePaths = ["/app/documents"];
  const workspacePaths = ["/app/overview", "/app/leads", "/app/sales"];
  const administrationPaths = ["/app/team", "/app/configuration", "/app/audit"];
  const notificationItems = notifications.data?.items?.filter((item) => !readNotificationIds.includes(item.id)) ?? [];

  function renderNavGroup(label: string, paths: string[]) {
    const groupItems = items.filter((item) => paths.includes(item.to));
    if (!groupItems.length) return null;
    return <><p>{label}</p>{groupItems.map(({ to, label: itemLabel, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{itemLabel}</span></NavLink>)}</>;
  }

  function markNotificationRead(id: string) {
    setReadNotificationIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      if (user) localStorage.setItem(`rta-read-notifications:${user.id}`, JSON.stringify(next.slice(-100)));
      return next;
    });
  }

  function markAllNotificationsRead() {
    const ids = notifications.data?.items.map((item) => item.id) ?? [];
    setReadNotificationIds(ids);
    if (user) localStorage.setItem(`rta-read-notifications:${user.id}`, JSON.stringify(ids));
  }

  async function signOut() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    }
  }

  return <div className="app-frame">
    <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`side-nav ${mobileOpen ? "open" : ""}`}>
      <div className="brand-row"><div className="brand-symbol"><Car size={22} /></div><div><strong>RTA</strong><span>OPERATIONS</span></div><button onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button></div>
      <div className="workspace-card"><span>WORKSPACE</span><strong>{workspace?.name ?? (user.workspaceId ? "Loading workspace…" : "Platform operations")}</strong><small><i />{user.workspaceId ? "Workspace operations" : "Acquisition control plane"}</small></div>
      <nav aria-label="Primary navigation">
        {renderNavGroup("WORKSPACE", workspacePaths)}
        {renderNavGroup("CUSTOMER OPERATIONS", customerOpsPaths)}
        {renderNavGroup("PERFORMANCE", performancePaths)}
        {renderNavGroup("RESOURCES", resourcePaths)}
        {renderNavGroup("INTELLIGENCE", intelligencePaths)}
        {renderNavGroup("ADMINISTRATION", administrationPaths)}
      </nav>
      <div className="side-status"><span><i />API connected</span><small>PostgreSQL · Redis · Apify</small></div>
    </aside>
    <main className="workspace-main">
      <header className="top-nav">
        <div><span>RTA AUTOMOTIVE GROUP</span><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="top-actions">
          <button className="ai-header-control" type="button" onClick={() => openRtaAssistant(askPrompt)}><MessageSquare size={15} /><span>Ask RTA AI</span></button>
          <div className="notification-wrap"><button className="notification-control" type="button" onClick={() => setNotificationsOpen((value) => !value)} aria-label={`${notificationItems.length} customer operations notifications`}><Inbox size={16} />{notificationItems.length > 0 && <b>{notificationItems.length}</b>}</button>{notificationsOpen && <div className="notification-menu"><header><strong>Notifications</strong>{notificationItems.length > 0 && <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>}</header>{notificationItems.length > 0 ? notificationItems.slice(0, 6).map((item) => <button className="notification-item" type="button" key={item.id} onClick={() => { markNotificationRead(item.id); setNotificationsOpen(false); navigate(item.href); }}><strong>{item.title}</strong><span>{item.body}</span></button>) : <p className="notification-empty">You are all caught up.</p>}</div>}</div>
          <div className="profile-wrap">
            <button className="profile-control" onClick={() => setProfileOpen((value) => !value)}><b>{initials(user.firstName, user.lastName, user.email)}</b><span><strong>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}</strong><small>{user.role.replace("_", " ")}</small></span><ChevronDown size={15} /></button>
            {profileOpen && <div className="profile-menu"><button onClick={() => { setProfileOpen(false); navigate("/app/settings"); }}><Settings2 size={16} />Account settings</button><button onClick={() => void signOut()}><LogOut size={16} />Sign out</button></div>}
          </div>
        </div>
      </header>
      {user.isDemoRecruiter && <div className="demo-access-banner"><ShieldAlert size={16} /><div><strong>Recruiter Demo Mode</strong><span>You can explore all product areas. Sensitive and destructive actions require approved access.</span></div><button type="button" onClick={() => navigate("/request-access")}>Request full access</button></div>}
      <div className="page-content">{children}</div>
    </main>
    <PasswordChangeModal />
  </div>;
}
