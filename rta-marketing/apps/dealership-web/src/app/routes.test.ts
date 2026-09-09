import { describe, expect, it } from "vitest";
import {
  appRoutes,
  canAccessRoute,
  defaultPath,
  resolveLegacyPath,
} from "./routes";

describe("route authorization policy", () => {
  it("keeps workspace operations isolated from platform operators", () => {
    const overview = appRoutes["/app/overview"];
    const acquisition = appRoutes["/app/acquisition"];
    expect(overview).toBeDefined();
    expect(acquisition).toBeDefined();
    if (!overview || !acquisition) return;

    expect(canAccessRoute(overview, "admin", "workspace-1")).toBe(true);
    expect(canAccessRoute(overview, "operator", null)).toBe(false);
    expect(canAccessRoute(acquisition, "operator", null)).toBe(true);
    expect(canAccessRoute(acquisition, "viewer", "workspace-1")).toBe(false);
  });

  it("requires a workspace even when the user's role is otherwise allowed", () => {
    const documents = appRoutes["/app/documents"];
    expect(documents).toBeDefined();
    if (!documents) return;

    expect(canAccessRoute(documents, "employee", "workspace-1")).toBe(true);
    expect(canAccessRoute(documents, "employee", null)).toBe(false);
  });

  it("keeps role-specific dashboards and controls separated", () => {
    const sales = appRoutes["/app/sales"];
    const team = appRoutes["/app/team"];
    const acquisition = appRoutes["/app/acquisition"];
    const performance = appRoutes["/app/performance-board"];
    expect(sales && team && acquisition && performance).toBeTruthy();
    if (!sales || !team || !acquisition || !performance) return;

    expect(canAccessRoute(sales, "employee", "workspace-1")).toBe(true);
    expect(canAccessRoute(sales, "virtual_assistant", "workspace-1")).toBe(false);
    expect(canAccessRoute(team, "recruiter", "workspace-1")).toBe(true);
    expect(canAccessRoute(team, "employee", "workspace-1")).toBe(false);
    expect(canAccessRoute(acquisition, "recruiter", "workspace-1")).toBe(true);
    expect(canAccessRoute(acquisition, "virtual_assistant", "workspace-1")).toBe(false);
    expect(canAccessRoute(performance, "virtual_assistant", "workspace-1")).toBe(true);
  });

  it("resolves safe default and legacy destinations", () => {
    expect(defaultPath("workspace-1")).toBe("/app/overview");
    expect(defaultPath(null)).toBe("/app/acquisition");
    expect(resolveLegacyPath("/AdminLayout/users")).toBe("/app/overview");
    expect(resolveLegacyPath("/app/sales")).toBe("/app/sales");
  });
});
