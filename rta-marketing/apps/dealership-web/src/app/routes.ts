import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { UserRole } from "../types/domain";

type RouteComponent = ComponentType | LazyExoticComponent<ComponentType>;

const AuditPage = lazy(async () => ({ default: (await import("../pages/AdminPages")).AuditPage }));
const ConfigurationPage = lazy(async () => ({ default: (await import("../pages/AdminPages")).ConfigurationPage }));
const DocumentsPage = lazy(async () => ({ default: (await import("../pages/DocumentsPage")).DocumentsPage }));
const ScrapingWorkspacePage = lazy(async () => ({ default: (await import("../pages/ScrapingResultsPage")).ScrapingResultsPage }));
const SourceControlPage = lazy(async () => ({ default: (await import("../pages/IntelligencePages")).SourceControlPage }));
const LeadsPage = lazy(async () => ({ default: (await import("../pages/LeadsPage")).LeadsPage }));
const AnalyticsPage = lazy(async () => ({ default: (await import("../pages/OperationsPages")).AnalyticsPage }));
const CommissionsPage = lazy(async () => ({ default: (await import("../pages/OperationsPages")).CommissionsPage }));
const TargetsPage = lazy(async () => ({ default: (await import("../pages/OperationsPages")).TargetsPage }));
const OverviewPage = lazy(async () => ({ default: (await import("../pages/OverviewPage")).OverviewPage }));
const PerformanceBoardPage = lazy(async () => ({ default: (await import("../pages/PerformanceBoardPage")).PerformanceBoardPage }));
const ProfilePage = lazy(async () => ({ default: (await import("../pages/ProfilePage")).ProfilePage }));
const SalesPage = lazy(async () => ({ default: (await import("../pages/SalesPage")).SalesPage }));
const TeamPage = lazy(async () => ({ default: (await import("../pages/TeamPage")).TeamPage }));
const CompareVehiclesPage = lazy(async () => ({ default: (await import("../pages/VehicleWorkspacePages")).CompareVehiclesPage }));
const InventoryPage = lazy(async () => ({ default: (await import("../pages/VehicleWorkspacePages")).InventoryPage }));
const SavedVehiclesPage = lazy(async () => ({ default: (await import("../pages/VehicleWorkspacePages")).SavedVehiclesPage }));
const AccessRequestsPage = lazy(async () => ({ default: (await import("../pages/AccessRequestsPage")).AccessRequestsPage }));

export interface AppRoute {
  component: RouteComponent;
  roles: readonly UserRole[];
  workspace: "required" | "optional";
}

const allRoles: readonly UserRole[] = [
  "admin",
  "operator",
  "employee",
  "virtual_assistant",
  "recruiter",
  "viewer",
];

export const appRoutes: Readonly<Record<string, AppRoute>> = {
  "/app/overview": {
    component: OverviewPage,
    roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"],
    workspace: "required",
  },
  "/app/leads": {
    component: LeadsPage,
    roles: ["admin", "employee", "virtual_assistant", "recruiter"],
    workspace: "required",
  },
  "/app/sales": {
    component: SalesPage,
    roles: ["admin", "employee", "recruiter"],
    workspace: "required",
  },
  "/app/team": {
    component: TeamPage,
    roles: ["admin", "recruiter"],
    workspace: "required",
  },
  "/app/configuration": {
    component: ConfigurationPage,
    roles: ["admin", "recruiter"],
    workspace: "required",
  },
  "/app/audit": {
    component: AuditPage,
    roles: ["admin", "recruiter"],
    workspace: "required",
  },
  "/app/settings": {
    component: ProfilePage,
    roles: allRoles,
    workspace: "optional",
  },
  "/app/commissions": {
    component: CommissionsPage,
    roles: ["admin", "employee", "recruiter"],
    workspace: "required",
  },
  "/app/targets": {
    component: TargetsPage,
    roles: ["admin", "employee", "recruiter"],
    workspace: "required",
  },
  "/app/analytics": {
    component: AnalyticsPage,
    roles: ["admin", "employee", "recruiter"],
    workspace: "required",
  },
  "/app/performance-board": {
    component: PerformanceBoardPage,
    roles: ["admin", "employee", "virtual_assistant", "recruiter", "viewer"],
    workspace: "required",
  },
  "/app/documents": {
    component: DocumentsPage,
    roles: ["admin", "employee", "recruiter"],
    workspace: "required",
  },
  "/app/inventory": {
    component: InventoryPage,
    roles: allRoles,
    workspace: "optional",
  },
  "/app/saved-vehicles": {
    component: SavedVehiclesPage,
    roles: allRoles,
    workspace: "optional",
  },
  "/app/compare": {
    component: CompareVehiclesPage,
    roles: allRoles,
    workspace: "optional",
  },
  "/app/acquisition": {
    component: ScrapingWorkspacePage,
    roles: ["admin", "operator", "recruiter"],
    workspace: "optional",
  },
  "/app/scraping-results": {
    component: ScrapingWorkspacePage,
    roles: ["admin", "operator", "recruiter"],
    workspace: "optional",
  },
  "/app/source-control": {
    component: SourceControlPage,
    roles: ["admin", "operator"],
    workspace: "optional",
  },
  "/app/access-requests": {
    component: AccessRequestsPage,
    roles: ["admin"],
    workspace: "required",
  },
};

export function canAccessRoute(
  route: AppRoute,
  role: UserRole,
  workspaceId: string | null,
): boolean {
  return (
    route.roles.includes(role) &&
    (route.workspace === "optional" || workspaceId !== null)
  );
}

export function resolveLegacyPath(path: string): string {
  return path.startsWith("/AdminLayout") ||
    path.startsWith("/EmployeeLayout") ||
    path.startsWith("/VirtualAssistantLayout")
    ? "/app/overview"
    : path;
}

export function defaultPath(
  workspaceId: string | null,
): "/app/overview" | "/app/acquisition" {
  return workspaceId ? "/app/overview" : "/app/acquisition";
}
