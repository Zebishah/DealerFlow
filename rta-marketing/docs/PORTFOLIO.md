# Dealer Flow portfolio brief

## One-sentence summary

Dealer Flow is a role-aware dealership operations platform that combines CRM workflows,
vehicle intelligence, grounded AI assistance, and controlled on-demand source
acquisition.

## What is live

- Vercel-hosted React/Vite dealership web app.
- Render-hosted Express API with session authentication, RBAC, CSRF, rate
  limits, safe errors, audit history, and request IDs.
- Neon PostgreSQL as the durable source of truth.
- Upstash Redis for distributed limits, AI quotas, and short-lived caches.
- Apify Actor runs for Romans International, Tom Hartley, and Redline
  Specialist Cars, with persisted run status and source-health telemetry.
- Read-only Dealer Flow AI tools for authorized analytics, leads, inventory, sales, and
  scrape diagnostics.

The customer-operations workflow gives the `virtual_assistant` role a focused
BDC responsibility: lead engagement → follow-up → appointment → handoff. The
admin role receives workspace-wide workload oversight, overdue work, appointment
and escalation visibility, while internal communication remains business-context
handoff threads linked to leads rather than a general chat system.

## Engineering signals

The repository demonstrates idempotent writes, bounded inputs, source contracts,
explicit manual acquisition, Apify reconciliation, operational health, safe
image proxying, responsive UI states, typed API boundaries, migrations, tests,
CI, and accessibility checks. Database writes remain server-side and the Actor
does not receive application secrets.

## Why the architecture is intentionally modest

The live path does not require a permanent scraper worker or a second queue.
Short-lived Actor runs isolate browser work, while the API remains responsible
for authorization, persistence, and reconciliation. BullMQ/Azure and
SQS/Lambda implementations are retained as clearly labeled reference paths so
the evolution is inspectable without pretending they are current runtime
dependencies.

## Recruiter walkthrough

1. Open the public landing page and browse the live inventory preview.
2. Sign in to the seeded recruiter demo and inspect analytics, inventory, and
   role-aware navigation.
3. Open Scraping workspace to see approved sources, system dependencies, source
   health, parser versions, and recent run activity.
4. Ask Dealer Flow AI a read-only question such as “Which leads need attention?” or
   “Explain the latest scrape failure.”
5. Review the architecture and legacy-reference documents for the boundary
   between the active path and retained engineering history.

## Known limitations

- Source websites can change markup; adapters require maintenance when their
  public contracts change.
- The shared scraper contract currently measures accepted records and explicit
  parser versions. Discovered and rejected counts remain unavailable where an
  adapter does not expose truthful raw-candidate and rejection counts.
- Dependency audit findings remain in the Apify/Crawlee and development-tool
  families where safe non-breaking upgrades were not available in this pass.
- The screenshot checklist is intentionally manual; no synthetic screenshots
  or production credentials are committed.

## Security and operational posture

Authentication, RBAC, CSRF protection, rate limits, audit history, safe error
envelopes, exact image-host allowlists, bounded Actor input, and server-side
secrets are part of the active path. Operational health reports availability
and source telemetry without exposing credentials, raw stack traces, or PII.
