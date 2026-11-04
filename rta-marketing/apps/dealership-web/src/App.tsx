import {
  appRoutes,
  canAccessRoute,
  defaultPath,
  resolveLegacyPath,
} from "./app/routes";
import { Suspense } from "react";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { PublicInventoryPage } from "./pages/PublicInventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage, SetupAccessPage } from "./pages/PasswordTokenPage";
import { ResendVerificationPage } from "./pages/ResendVerificationPage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AccessRequestPage } from "./pages/AccessRequestPage";
import { Redirect, useNavigation } from "./router/Navigation";

export function App() {
  const { path } = useNavigation();
  const { user, loading } = useAuth();

  // Keep the public product story independent from the authenticated API.
  // The session check can continue in the background while the landing page
  // renders immediately, even when the hosted API is asleep.
  if (path === "/") return <LandingPage />;
  if (path === "/inventory") return <PublicInventoryPage />;

  // Public account flows must stay usable while the session API is waking up.
  if (path === "/login") return <LoginPage />;
  if (path === "/signup") return <SignupPage />;
  if (path === "/verify-email") return <VerifyEmailPage />;
  if (path === "/resend-verification") return <ResendVerificationPage />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;
  if (path === "/setup-access") return <SetupAccessPage />;
  if (path === "/request-access") return <AccessRequestPage />;

  if (loading) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <span className="boot-logo">RTA</span>
        <i />
        <p>Preparing your workspace…</p>
      </div>
    );
  }

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
      <Suspense
        fallback={
          <div className="boot-screen route-loading">
            <span className="boot-logo">RTA</span>
            <i />
            <p>Loading workspace view…</p>
          </div>
        }
      >
        <Page />
      </Suspense>
    </AppShell>
  );
}
