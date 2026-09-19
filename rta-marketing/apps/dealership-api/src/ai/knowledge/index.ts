export interface KnowledgeEntry {
  id: string;
  topic: string;
  title: string;
  content: string;
  keywords: readonly string[];
}

export const knowledgeEntries: readonly KnowledgeEntry[] = [
  {
    id: "platform",
    topic: "product",
    title: "RTA Automotive Operations Platform",
    content: "RTA is a dealership operations platform for lead pipelines, sales, commissions, targets, team visibility, audit history, employee documents, and vehicle intelligence. It separates authenticated dealership operations from the manual vehicle-scraping subsystem.",
    keywords: ["rta", "platform", "product", "dealership", "crm", "what", "do"],
  },
  {
    id: "security",
    topic: "security",
    title: "Security and access control",
    content: "The dealership API uses server-managed opaque HTTP-only sessions, hashed session tokens, CSRF protection for mutations, workspace and role checks, safe errors, request limits, and audit events. Recruiter demo access is restricted and does not grant administrative mutation privileges.",
    keywords: ["security", "rbac", "role", "permission", "session", "csrf", "recruiter", "access"],
  },
  {
    id: "architecture",
    topic: "architecture",
    title: "Application architecture",
    content: "The dealership web app calls an Express API backed by Neon PostgreSQL, the durable source of truth. Approved vehicle scraping runs on demand in ephemeral Apify Actors. Upstash Redis is an API-side ephemeral layer for distributed rate limits, atomic AI quotas, and short-lived read caches; it does not run jobs. Older BullMQ/Azure scraper and AWS SQS/Lambda paths remain isolated reference architectures.",
    keywords: ["architecture", "technology", "stack", "postgres", "neon", "aws", "lambda", "sqs", "redis", "bullmq", "cloud"],
  },
  {
    id: "scraping",
    topic: "scraping",
    title: "Vehicle scraping workflow",
    content: "Live vehicle scraping is started on demand from the authenticated dealership dashboard through an allowlisted Apify Actor input. Each run is bounded by the requested vehicle limit, validates and normalizes source output, deduplicates records, and persists them to Neon. Upstash Redis protects API requests and quotas but does not run scraping jobs. The older manual-only API/worker path remains isolated reference architecture.",
    keywords: ["scrape", "scraping", "crawler", "source", "job", "pipeline", "duplicate", "deduplicate", "manual"],
  },
  {
    id: "reliability",
    topic: "reliability",
    title: "Reliable job creation",
    content: "A scrape run, its source runs, and PostgreSQL outbox records are created in one transaction. The outbox can publish to SQS when explicitly enabled. Idempotency keys, stable source-run identifiers, unique listing identities, and duplicate-tolerant ingestion protect against retries and at-least-once delivery.",
    keywords: ["idempotency", "duplicate", "outbox", "retry", "reliability", "queue", "job"],
  },
  {
    id: "demo",
    topic: "demo",
    title: "Recruiter demo",
    content: "The recruiter demo is a seeded, verified recruiter account with broad read access to sanitized demo workspace data. It can explore product workflows but cannot silently approve access, alter protected records, or bypass existing permissions.",
    keywords: ["recruiter", "demo", "portfolio", "show", "access"],
  },
  {
    id: "modules",
    topic: "help",
    title: "Main modules",
    content: "The dealership workspace includes Overview, Lead pipeline, Sales, Team, Configuration, Audit history, Commissions, Targets, Analytics, Performance board, Documents, Vehicle intelligence, Saved vehicles, Compare vehicles, Scraping workspace, and Source controls where the current role permits them.",
    keywords: ["module", "modules", "dashboard", "page", "feature", "navigate", "where"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

export function searchKnowledge(query: string, limit = 3): KnowledgeEntry[] {
  const normalized = normalize(query);
  const terms = normalized.split(/\s+/).filter((term) => term.length > 2);
  return knowledgeEntries
    .map((entry) => {
      const haystack = normalize(`${entry.title} ${entry.content} ${entry.keywords.join(" ")}`);
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}
