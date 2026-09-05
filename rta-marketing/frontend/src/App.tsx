import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { AcquisitionPage, SourceControlPage } from "./pages/IntelligencePages";
import { CompareVehiclesPage, InventoryPage, SavedVehiclesPage } from "./pages/VehicleWorkspacePages";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { AnalyticsPage, CommissionsPage, TargetsPage } from "./pages/OperationsPages";
import { TeamPage } from "./pages/TeamPage";
import { AuditPage, ConfigurationPage } from "./pages/AdminPages";
import { OverviewPage } from "./pages/OverviewPage";
import { SalesPage } from "./pages/SalesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PerformanceBoardPage } from "./pages/PerformanceBoardPage";
import { Redirect, useNavigation } from "./router/Navigation";
import type { UserRole } from "./types/domain";

const pages: Record<string, () => JSX.Element> = {
  "/app/overview": OverviewPage,
  "/app/leads": LeadsPage,
  "/app/sales": SalesPage,
  "/app/team": TeamPage,
  "/app/configuration": ConfigurationPage,
  "/app/audit": AuditPage,
  "/app/settings": ProfilePage,
  "/app/commissions": CommissionsPage,
  "/app/targets": TargetsPage,
  "/app/analytics": AnalyticsPage,
  "/app/performance-board": PerformanceBoardPage,
  "/app/inventory": InventoryPage,
  "/app/saved-vehicles": SavedVehiclesPage,
  "/app/compare": CompareVehiclesPage,
  "/app/acquisition": AcquisitionPage,
  "/app/source-control": SourceControlPage,
};

const routeRoles: Record<string, UserRole[]> = {
  "/app/overview": ["admin", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/leads": ["admin", "employee", "virtual_assistant", "recruiter"],
  "/app/sales": ["admin", "employee", "virtual_assistant", "recruiter"],
  "/app/team": ["admin", "recruiter"],
  "/app/configuration": ["admin"],
  "/app/audit": ["admin"],
  "/app/settings": ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/commissions": ["admin", "employee"],
  "/app/targets": ["admin", "employee"],
  "/app/analytics": ["admin", "employee", "recruiter"],
  "/app/performance-board": ["admin", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/inventory": ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/saved-vehicles": ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/compare": ["admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"],
  "/app/acquisition": ["admin", "operator", "recruiter"],
  "/app/source-control": ["admin", "operator"],
};

export function App() {
  const { user, loading } = useAuth();
  const { path } = useNavigation();
  if (loading) return <div className="boot-screen"><span className="boot-logo">RTA</span><i /><p>Preparing your workspace…</p></div>;
  if (path === "/login") return <LoginPage />;
  if (!user) return <Redirect to="/login" />;
  const normalizedPath = path.startsWith("/AdminLayout") || path.startsWith("/EmployeeLayout") || path.startsWith("/VirtualAssistantLayout") ? "/app/overview" : path;
  const platformPaths = new Set(["/app/inventory", "/app/saved-vehicles", "/app/compare", "/app/acquisition", "/app/source-control", "/app/settings"]);
  if (!user.workspaceId && !platformPaths.has(normalizedPath)) return <Redirect to="/app/acquisition" />;
  const allowedRoles = routeRoles[normalizedPath];
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.workspaceId ? "/app/overview" : "/app/acquisition"} />;
  }
  const Page = pages[normalizedPath];
  if (!Page) return <Redirect to="/app/overview" />;
  return <AppShell><Page /></AppShell>;
}
