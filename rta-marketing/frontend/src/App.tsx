import {
  appRoutes,
  canAccessRoute,
  defaultPath,
  resolveLegacyPath,
} from "./app/routes";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { Redirect, useNavigation } from "./router/Navigation";

export function App() {
  const { user, loading } = useAuth();
  const { path } = useNavigation();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-logo">RTA</span>
        <i />
        <p>Preparing your workspace…</p>
      </div>
    );
  }

  if (path === "/login") return <LoginPage />;
  if (!user) return <Redirect to="/login" />;

  const normalizedPath = resolveLegacyPath(path);
  const route = appRoutes[normalizedPath];
  const fallbackPath = defaultPath(user.workspaceId);

  if (!route) return <Redirect to={fallbackPath} />;
  if (!canAccessRoute(route, user.role, user.workspaceId)) {
    return <Redirect to={fallbackPath} />;
  }

  const Page = route.component;
  return (
    <AppShell>
      <Page />
    </AppShell>
  );
}
