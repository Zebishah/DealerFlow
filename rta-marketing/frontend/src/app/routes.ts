import type { ComponentType } from "react";
import type { UserRole } from "../types/domain";
import { AuditPage, ConfigurationPage } from "../pages/AdminPages";
import { DocumentsPage } from "../pages/DocumentsPage";
import {
  AcquisitionPage,
  SourceControlPage,
} from "../pages/IntelligencePages";
import { LeadsPage } from "../pages/LeadsPage";
import {
  AnalyticsPage,
  CommissionsPage,
  TargetsPage,
} from "../pages/OperationsPages";
import { OverviewPage } from "../pages/OverviewPage";
import { PerformanceBoardPage } from "../pages/PerformanceBoardPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SalesPage } from "../pages/SalesPage";
import { TeamPage } from "../pages/TeamPage";
import {
  CompareVehiclesPage,
  InventoryPage,
  SavedVehiclesPage,
} from "../pages/VehicleWorkspacePages";

export interface AppRoute {
  component: ComponentType;
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
    roles: ["admin", "employee", "virtual_assistant", "recruiter"],
    workspace: "required",
  },
  "/app/team": {
    component: TeamPage,
    roles: ["admin", "recruiter"],
    workspace: "required",
  },
  "/app/configuration": {
    component: ConfigurationPage,
    roles: ["admin"],
    workspace: "required",
  },
  "/app/audit": {
    component: AuditPage,
    roles: ["admin"],
    workspace: "required",
  },
  "/app/settings": {
    component: ProfilePage,
    roles: allRoles,
    workspace: "optional",
  },
  "/app/commissions": {
    component: CommissionsPage,
    roles: ["admin", "employee"],
    workspace: "required",
  },
  "/app/targets": {
    component: TargetsPage,
    roles: ["admin", "employee"],
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
    roles: ["admin", "employee"],
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
    component: AcquisitionPage,
    roles: ["admin", "operator", "recruiter"],
    workspace: "optional",
  },
  "/app/source-control": {
    component: SourceControlPage,
    roles: ["admin", "operator"],
    workspace: "optional",
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
