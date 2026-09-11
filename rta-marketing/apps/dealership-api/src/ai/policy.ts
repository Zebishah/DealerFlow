import type { UserRole } from "../db/schema.js";

const authenticatedRoles: readonly UserRole[] = [
  "admin",
  "operator",
  "employee",
  "virtual_assistant",
  "recruiter",
  "viewer",
];

const leadRoles: readonly UserRole[] = ["admin", "employee", "virtual_assistant", "recruiter"];
const salesRoles: readonly UserRole[] = ["admin", "operator", "employee", "recruiter"];
const scrapingRoles: readonly UserRole[] = ["admin", "operator", "recruiter"];

const roleByTool: Readonly<Record<string, readonly UserRole[]>> = {
  getPlatformHelp: [],
  getDashboardSummary: authenticatedRoles,
  searchLeads: leadRoles,
  getLeadSummary: leadRoles,
  getLeadNextAction: leadRoles,
  searchInventory: authenticatedRoles,
  getVehicleDetails: authenticatedRoles,
  recommendVehicles: authenticatedRoles,
  compareVehicleListings: authenticatedRoles,
  getMarketPriceExplanation: authenticatedRoles,
  getSalesSummary: salesRoles,
  getAnalyticsSummary: salesRoles,
  getPerformanceInsights: salesRoles,
  getScrapingStatus: scrapingRoles,
  troubleshootScraping: scrapingRoles,
};

export function isAssistantToolAllowed(toolName: string, role: UserRole | null | undefined): boolean {
  const roles = roleByTool[toolName];
  if (!roles) return false;
  if (roles.length === 0) return toolName === "getPlatformHelp";
  return role ? roles.includes(role) : false;
}

export function assistantToolRoles(toolName: string): readonly UserRole[] {
  return roleByTool[toolName] ?? [];
}
