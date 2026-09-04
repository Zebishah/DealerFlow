import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { AcquisitionPage, InventoryPage } from "./pages/IntelligencePages";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { AnalyticsPage, CommissionsPage, TargetsPage, TeamPage } from "./pages/OperationsPages";
import { OverviewPage } from "./pages/OverviewPage";
import { SalesPage } from "./pages/SalesPage";
import { Redirect, useNavigation } from "./router/Navigation";

const pages: Record<string, () => JSX.Element> = {
  "/app/overview": OverviewPage,
  "/app/leads": LeadsPage,
  "/app/sales": SalesPage,
  "/app/team": TeamPage,
  "/app/commissions": CommissionsPage,
  "/app/targets": TargetsPage,
  "/app/analytics": AnalyticsPage,
  "/app/inventory": InventoryPage,
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
