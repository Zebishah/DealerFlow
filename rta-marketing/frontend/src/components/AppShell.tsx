import {
  Activity,
  BarChart3,
  Car,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Heart,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { BootstrapData, UserRole } from "../types/domain";
import { NavLink, useNavigation } from "../router/Navigation";

const nav = [
  { to: "/app/overview", label: "Overview", icon: Gauge, roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/leads", label: "Lead pipeline", icon: UserPlus, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/sales", label: "Sales", icon: CircleDollarSign, roles: ["admin", "employee", "virtual_assistant", "recruiter"] },
  { to: "/app/team", label: "Team", icon: Users, roles: ["admin", "recruiter"] },
  { to: "/app/configuration", label: "Configuration", icon: SlidersHorizontal, roles: ["admin"] },
  { to: "/app/audit", label: "Audit history", icon: ShieldCheck, roles: ["admin"] },
  { to: "/app/commissions", label: "Commissions", icon: CircleDollarSign, roles: ["admin", "employee"] },
  { to: "/app/targets", label: "Targets", icon: Target, roles: ["admin", "employee"] },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "employee", "recruiter"] },
  { to: "/app/performance-board", label: "Performance board", icon: Gauge, roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/inventory", label: "Vehicle intelligence", icon: Car, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/saved-vehicles", label: "Saved vehicles", icon: Heart, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/compare", label: "Compare vehicles", icon: SlidersHorizontal, roles: ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"] },
  { to: "/app/acquisition", label: "Acquisition", icon: Activity, roles: ["admin", "operator", "recruiter"] },
] as const;

const pageTitles: Record<string, [string, string]> = {
  overview: ["Command centre", "Dealership performance at a glance"],
  leads: ["Lead pipeline", "Qualify, assign, and convert every opportunity"],
  sales: ["Sales workspace", "Track funded deals, gross profit, and delivery"],
  team: ["Team operations", "People, roles, and workload visibility"],
  configuration: ["Workspace configuration", "Lead sources and finance reference data"],
  audit: ["Audit history", "Trace important operational changes"],
  settings: ["Account settings", "Profile and credential security"],
  commissions: ["Commission control", "Transparent earnings and approval workflow"],
  targets: ["Monthly targets", "Align goals with measurable progress"],
  analytics: ["Performance analytics", "Decision-ready dealership trends"],
  "performance-board": ["Performance board", "Auto-refreshing team visibility"],
  inventory: ["Vehicle intelligence", "Normalized inventory across Ontario sources"],
  "saved-vehicles": ["Saved vehicles", "Your private vehicle shortlist"],
  compare: ["Compare vehicles", "Evaluate normalized attributes side by side"],
  acquisition: ["Acquisition operations", "Observable SQS-backed scraping jobs"],
};

function initials(firstName: string | null, lastName: string | null, email: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim().toUpperCase() || email.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { navigate, path } = useNavigation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((value) => value.data),
    staleTime: 5 * 60_000,
    enabled: Boolean(user?.workspaceId),
  });
  if (!user) return null;
  const key = path.split("/").at(-1) ?? "overview";
  const [title, subtitle] = pageTitles[key] ?? pageTitles.overview!;
  const items = nav.filter((item) => (item.roles as readonly UserRole[]).includes(user.role));
  const workspace = bootstrap.data?.workspace;

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
      <div className="workspace-card"><span>WORKSPACE</span><strong>{workspace?.name ?? (user.workspaceId ? "Loading workspace…" : "Platform operations")}</strong><small><i />{workspace?.mode === "demo" ? "Portfolio demo data" : user.workspaceId ? "Live operations" : "Acquisition control plane"}</small></div>
      <nav aria-label="Primary navigation">
        <p>WORKSPACE</p>
        {items.filter((item) => !["/app/inventory", "/app/saved-vehicles", "/app/compare", "/app/acquisition"].includes(item.to)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{label}</span></NavLink>)}
        <p>INTELLIGENCE</p>
        {items.filter((item) => ["/app/inventory", "/app/saved-vehicles", "/app/compare", "/app/acquisition"].includes(item.to)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="side-status"><span><i />API connected</span><small>PostgreSQL · SQS · Lambda</small></div>
    </aside>
    <main className="workspace-main">
      <header className="top-nav">
        <div><span>RTA AUTOMOTIVE GROUP</span><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="top-actions">
          <div className="profile-wrap">
            <button className="profile-control" onClick={() => setProfileOpen((value) => !value)}><b>{initials(user.firstName, user.lastName, user.email)}</b><span><strong>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}</strong><small>{user.role.replace("_", " ")}</small></span><ChevronDown size={15} /></button>
            {profileOpen && <div className="profile-menu"><button onClick={() => { setProfileOpen(false); navigate("/app/settings"); }}><Settings2 size={16} />Account settings</button><button onClick={() => void signOut()}><LogOut size={16} />Sign out</button></div>}
          </div>
        </div>
      </header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
