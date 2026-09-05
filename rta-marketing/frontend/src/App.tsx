import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { AcquisitionPage } from "./pages/IntelligencePages";
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
};

export function App() {
  const { user, loading } = useAuth();
  const { path } = useNavigation();
  if (loading) return <div className="boot-screen"><span className="boot-logo">RTA</span><i /><p>Preparing your workspace…</p></div>;
  if (path === "/login") return <LoginPage />;
  if (!user) return <Redirect to="/login" />;
  const normalizedPath = path.startsWith("/AdminLayout") || path.startsWith("/EmployeeLayout") || path.startsWith("/VirtualAssistantLayout") ? "/app/overview" : path;
  const Page = pages[normalizedPath];
  if (!Page) return <Redirect to="/app/overview" />;
  return <AppShell><Page /></AppShell>;
}
