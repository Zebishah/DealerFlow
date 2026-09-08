export type UserRole = "operator" | "viewer" | "admin" | "employee" | "virtual_assistant" | "recruiter";

export interface SessionUser {
  id: string;
  workspaceId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

export interface BootstrapData {
  workspace: { id: string; name: string; mode: "demo" | "live" };
  user: SessionUser;
  team: Array<SessionUser & { isActive: boolean }>;
  leadSources: Array<{ id: string; name: string }>;
  financeProviders: Array<{ id: string; name: string }>;
}

export interface DealershipSummary {
  period: string;
  leads: { total: number; new: number; qualified: number; converted: number };
  sales: { total: number; funded: number; revenueCents: number; grossProfitCents: number; commissionCents: number };
  target: { retailTarget: number; wholesaleTarget: number; grossProfitTargetCents: number } | null;
  recentLeads: Array<{ id: string; firstName: string; lastName: string; status: string; vehicleInterest: string | null; createdAt: string }>;
  recentSales: Array<{ id: string; externalSaleId: string; customerName: string; vehicleDescription: string; status: string; salePriceCents: number; soldAt: string }>;
}

export interface Lead {
  id: string;
  sourceId: string | null;
  assignedToUserId: string | null;
  externalReference: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vehicleInterest: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SaleStatus = "draft" | "submitted" | "approved" | "rejected" | "funded" | "cancelled";

export interface Sale {
  id: string;
  workspaceId: string;
  salespersonId: string;
  createdByUserId: string | null;
  leadId: string | null;
  financeProviderId: string | null;
  externalSaleId: string;
  type: "retail" | "wholesale";
  status: SaleStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicleVin: string | null;
  vehicleDescription: string;
  salePriceCents: number;
  grossProfitCents: number;
  commissionRateBasisPoints: number;
  commissionAmountCents: number;
  soldAt: string;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceHealth {
  key: string;
  name: string;
  enabled: boolean;
  liveEnabled: boolean;
  latestStatus: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface ScrapeRun {
  id: string;
  mode: "fixture" | "live";
  status: string;
  sourceCount: number;
  completedSourceCount: number;
  discoveredCount: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface IntelligenceSummary {
  activeListings: number;
  canonicalVehicles: number;
  averagePriceCents: number | null;
  activeRuns: number;
  successfulRuns: number;
  sourceHealth: SourceHealth[];
  recentRuns: ScrapeRun[];
}

export interface CatalogVehicle {
  listingId: string;
  vehicleId: string;
  source: string;
  sourceName: string;
  title: string;
  url: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  priceCents: number | null;
  currency: string;
  odometerKm: number | null;
  imageUrl: string | null;
  dealerName: string | null;
  location: string | null;
  isUsed: boolean;
  lastSeenAt: string;
}

export interface ScrapingSite {
  id: number;
  name: string;
  baseUrl: string;
  itemCount: number;
  lastScrapedAt: string | null;
}

export interface ScrapedListing {
  id: number;
  siteId: number;
  siteName: string;
  title: string;
  price: string | null;
  year: string | null;
  mileage: string | null;
  city: string | null;
  listingUrl: string;
  thumbnailUrl: string | null;
  scrapedAt: string;
}

export interface SavedScrapedListing extends ScrapedListing {
  savedId: string;
  savedAt: string;
}

export interface ScrapingResultsResponse {
  data: {
    items: ScrapedListing[];
    sites: ScrapingSite[];
  };
  page: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}


export interface AdminUser extends SessionUser {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NamedResource {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyTargetRecord {
  id: string;
  userId: string | null;
  month: string;
  retailTarget: number;
  wholesaleTarget: number;
  grossProfitTargetCents: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  updatedAt: string;
}

export interface CommissionRule {
  id: string;
  userId: string | null;
  name: string;
  retailRateBasisPoints: number;
  wholesaleRateBasisPoints: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorUserId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  actorEmail: string | null;
}


export interface EmployeeDocument {
  id: string;
  userId: string;
  kind: "insurance" | "drivers_license" | "omvic" | "employment" | "other";
  status: "pending" | "verified" | "rejected";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}
