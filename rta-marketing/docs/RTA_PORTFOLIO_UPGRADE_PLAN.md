# RTA Portfolio Upgrade Plan

> Historical baseline and upgrade record. Some findings describe the pre-hardening implementation and are intentionally retained as audit evidence; verify current behavior against the source, current API reference, and CI workflow before treating a finding as open.

Audit date: 2026-09-03

Audited repository: `Zebishah/Rta-mark`

Audited ref: `main` at `f7bb793c51e4b814f50ab9ce57fd27dc15593f7c`

This document records only behavior verified in the repository. It proposes a controlled renovation; it does not claim that proposed features already exist.

## 1. Repository and history baseline

- The private repository has two commits. The latest commit, `f7bb793`, adds the current frontend, backend, and scraper application.
- GitHub exposes only the `main` branch at audit time.
- The repository root is `rta-marketing/` and contains three applications:
  - `backend/`: Express 4, CommonJS, Firebase Admin, Puppeteer, FTP inventory synchronization, Swagger, and Jest.
  - `frontend/`: a legacy React/Vite dealership CRM covering authentication, leads, sales, commissions, employees, virtual assistants, inventory, and a TV dashboard.
  - `rta-scrapper/`: the recruiter-relevant React/TypeScript/Vite vehicle search interface.
- The root README contains only a title. There is no architecture documentation, CI workflow, Docker setup, license file, deployment guide, or contributor guide.
- The committed `frontend/package-lock.json` is empty, so the legacy frontend does not have a reproducible install.

## 2. Verified vehicle-search functionality

The dedicated vehicle-search UI accepts make, model, keyword, year, price, mileage, color, transmission, postal-code, and radius filters. It sends a synchronous `POST /api/scrape/run` request and renders normalized cards, source tabs, client-side pagination, a saved-cars drawer, and basic price analytics.

The backend builds source-specific URLs and opens one Puppeteer browser with one page per enabled source. The pages run in parallel. The response is returned only after all sources complete or the route-level three-minute timeout fires.

Verified active sources:

| Source | Acquisition | Pagination/loading | Extraction |
|---|---|---|---|
| AutoTrader | Puppeteer DOM | Progressive scroll | DOM selectors |
| AutoPlanet | Puppeteer DOM | Lazy-load scrolling | DOM selectors and `data-*` fields |
| Humberview VW | Puppeteer DOM | UI pagination | JSON-LD plus DOM fields |
| Yorkdale VW | Puppeteer DOM | `page` query navigation | `data-*` attributes plus DOM fields |

CarGurus has a configuration file, URL builder, and a file named `carguru.scraper.js`, but it is not wired into `buildUrls` or `scrapeAllSites`. The so-called scraper only builds a URL; it does not extract listings. CarGurus must therefore not be advertised as a supported source.

## 3. Current request lifecycle

1. `rta-scrapper/src/components/FilterPanel.tsx` collects filters.
2. `useScrape.ts` removes empty values and sends one fetch request to `/api/scrape/run`.
3. `routes/scrape.routes.js` builds four source URLs and starts a three-minute timer.
4. `services/scraper.service.js` launches a new browser for the request and opens source pages in parallel.
5. Each source scraper navigates/scrolls/paginates and extracts an unvalidated object array.
6. The backend returns raw arrays, source URLs, original filters, durations, and per-source errors.
7. `App.tsx` normalizes records in the browser, stores all results in React state, filters/paginates them locally, and calculates summary data.
8. `useGlobalSavedCars.ts` reads and writes one global Firestore `saved_cars` collection directly from every client.

There is no persisted listing catalog, scrape-run model, durable job state, database-backed search, source observation history, canonical cross-source deduplication, stale-listing lifecycle, retry queue, dead-letter state, cancellation, or replay.

## 4. Baseline verification results

Runtime used for the audit: Node `v24.19.0`, npm `11.9.0`.

| Area | Command | Result |
|---|---|---|
| Backend install | `PUPPETEER_SKIP_DOWNLOAD=true npm ci --offline --ignore-scripts` | Passed; 706 packages installed. Several deprecated transitive/direct packages were reported. Browser download was intentionally skipped for the audit. |
| Backend tests | `npm test -- --runInBand` | Failed: 5/5 suites failed; only two tests reached assertions and both failed. |
| Backend lint | `npm run lint` | Missing script. |
| Backend typecheck | `npm run typecheck` | Missing script; backend is JavaScript. |
| Backend build | `npm run build` | Missing script. |
| Scraper UI install | `npm ci --offline --ignore-scripts` | Passed; 406 packages installed. |
| Scraper UI build/typecheck | `npm run build` | Passed: TypeScript and Vite completed; 1,406 modules transformed. Main JS bundle is 659.82 kB (189.51 kB gzip) and triggers Vite's chunk-size warning. |
| Scraper UI lint | `npm run lint` | Failed because the project has no ESLint configuration. |
| Scraper UI tests | N/A | No test script or tests exist. |
| Legacy frontend install | `npm ci --offline` | Failed because the committed lockfile is empty. A normal install also could not be performed in the restricted audit runtime. |
| Legacy frontend build/lint | `npm run build`, `npm run lint` | Not runnable because dependencies cannot be reproducibly installed; both commands returned missing executables. |
| JavaScript syntax | `node --check` over backend JS files | Passed; this does not detect runtime errors. |

Backend test failures are caused by stale tests and import-time side effects:

- Firebase configuration calls `.replace` on an absent private key during module import.
- FTP configuration is validated during module import before tests can supply mocks/environment.
- `parserService.test.js` imports a service that does not exist.
- Firestore tests expect an old return ID and a removed `batchWriteRecords` method.
- The API test creates a separate Express instance, imports a server that starts listening and scheduling immediately, and asserts an outdated response contract.
- The storage mock does not match the shape consumed by `firebaseAdmin.js`.

## 5. Confirmed correctness and reliability problems

### Scraping lifecycle

- A scrape occupies an HTTP request for up to three minutes. This couples browser work to client/network timeouts and makes reliable retries impossible.
- Sending the 408 response does not cancel the browser or source scrapers; work continues after the client has been told it timed out.
- Every request launches a new browser. There is no concurrency limit, admission control, queue, or backpressure, so a few users can exhaust CPU and memory.
- Browser launch is configured with `headless: false`, making common container/server deployment unsuitable.
- Chrome is started with `--disable-web-security` and sandbox-disabling flags. These should not be default production settings.
- AutoPlanet navigates once in the orchestrator and again inside its scraper.
- Source errors are converted into empty source results, while the top-level response can still say `success: true`.
- No explicit per-source retry policy distinguishes transient navigation failures from permanent parsing/selector failures.
- There is no durable progress, partial-result checkpoint, cancellation signal, dead-letter state, replay, or reconciliation.
- No source-specific rate/concurrency policy is enforced.
- Error screenshots use fixed working-directory filenames and can overwrite one another.

### Source adapters and parsing

- Dispatch uses an `if/else` chain rather than a typed adapter contract.
- Builders, acquisition, parsing, normalization, and persistence are inconsistently separated.
- Extracted objects are not schema-validated before returning them.
- Source field shapes differ, and canonical normalization happens only in the browser.
- `humberview.scraper.js` references undefined `heading` and `searchValue` variables when no filters are detected; that branch throws instead of returning the intended empty result.
- AutoTrader uses a synchronous busy-wait inside `page.evaluate`, blocking the page main thread.
- Pagination success is inferred from selectors/counts without a durable record of partial coverage.
- CarGurus files are dead/incomplete code and misrepresent source coverage.

### Identity, deduplication, and data quality

- The only UI ID logic is `source + adId/VIN`, falling back to `source + array index`; the fallback changes between runs.
- There is no database uniqueness constraint or idempotent upsert.
- There is no cross-source vehicle identity. The same VIN can appear as separate records.
- Conversely, records without VIN cannot safely be merged merely from title text; a conservative fingerprint policy is required.
- `normalizeCar` forces `isUsed: true`, discarding the source value.
- Price, year, and odometer remain display strings rather than canonical numeric values and currencies/units.
- Normalization discards useful source data such as VIN, stock number, trim, transmission, drivetrain, and engine.
- The UI's price-distribution boundaries overlap, so exact boundary prices can be counted twice.
- Saved records do not add `savedAt`, but the snapshot is sorted by `savedAt`; this can produce invalid ordering.

### Persistence and search

- Scraped listings are never persisted; every user repeats expensive live scraping.
- Search, source filtering, and pagination are entirely in memory on the client.
- Firestore stores logs and globally saved cars, but there are no schema constraints, migrations, or documented security rules.
- There is no record of `first_seen_at`, `last_seen_at`, price history, source run, validation outcome, or stale/removal status.

## 6. Confirmed security and privacy risks

Critical items must be resolved before any public demo:

- `/disableUser`, `/enableUser`, and `/deleteUser` have no authentication or authorization and accept arbitrary UIDs.
- `/api/scrape/run` is public, expensive, unvalidated, and unlimited, enabling resource-exhaustion abuse.
- The legacy frontend treats any authenticated user as sufficient for admin routes; it does not enforce the role in route guards.
- Saved cars are globally readable/writable through direct client Firestore access. No Firestore rules are committed for verification.
- A live Firebase client configuration and original Firebase project identifiers are committed in `frontend/src/config/firebaseConfig.js`. Firebase API keys are not equivalent to server secrets, but the original project must still be detached from the portfolio and its rules/allowed domains reviewed.
- The lead API secret is accepted as a query parameter, which is likely to leak through URLs and logs.
- FTP uses unencrypted mode (`secure: false`) and verbose protocol logging.
- Uploaded inventory files are made public unconditionally.
- Raw error messages, generated source URLs, and filters are returned to clients.
- CORS can allow origin-less requests and one lead route explicitly enables all origins.
- There is no request authentication middleware, RBAC middleware, rate limiting, security-header middleware, centralized error boundary, or request ID.
- Stack traces and page state may be written to Firestore logs without a retention/redaction policy.
- The repo mixes company CRM workflows and customer-oriented field structures into a project intended for public recruiter inspection. Although no actual database records were found, this code should be reviewed and removed from the sanitized portfolio scope.

## 7. Frontend and UX assessment

Useful existing work to preserve:

- Responsive filter form with dependent make/model options.
- Clear loading, empty, error, and result states.
- Source tabs, vehicle cards, saved drawer, and price summary.
- TypeScript in the dedicated scraper UI.
- TanStack Query mutation state.

Professional gaps:

- There is no recruiter-facing landing page, product explanation, architecture/engineering page, or guided demo.
- There is no vehicle detail view or multi-vehicle comparison despite comparison being a core portfolio goal.
- There is no source-health/freshness view or scrape-run progress/history.
- Loading messages simulate stages using timers rather than showing real job progress.
- Results cannot be deep-linked or restored from URL state.
- Pagination is client-side and requires loading every result first.
- Errors hide actionable run/source status from legitimate operators while the API leaks raw errors.
- Saved cars are not scoped to a user/session and have duplicate/race risks.
- The analytics panel is hidden below a `2xl` viewport and uses a nonstandard `w-78` class.
- TypeScript uses pervasive `any`, so source contracts are not enforced.
- The app has no component, hook, accessibility, or end-to-end tests.
- The main JS bundle exceeds Vite's warning threshold.

## 8. Recommended target product

The portfolio version should be a focused vehicle-intelligence platform, separate from the unrelated dealership CRM. Public visitors should explore a safe seeded/snapshot catalog immediately. Authenticated operators should be able to start controlled live ingestion, see genuine progress, inspect source-level failures, and replay eligible failed source jobs.

Recommended recruiter-visible flows:

1. Landing page explains aggregation, normalization, provenance, and freshness.
2. Catalog supports indexed search/filter/sort with cursor pagination.
3. Vehicle detail shows canonical attributes and source offers/provenance.
4. Compare view supports up to three or four vehicles.
5. Saved vehicles are scoped to a demo session or authenticated user.
6. Operations view shows each source, last successful sync, last run status, durations, discovered/valid/inserted/updated/unchanged/invalid/stale counts, and safe error categories.
7. Run detail shows real progress and partial success without exposing selectors or stack traces.

## 9. Recommended architecture

Keep the system a modular monolith with a separate worker process. Microservices would add deployment and contract overhead without solving a demonstrated need.

Suggested boundaries:

- `web`: React/TypeScript UI.
- `api`: HTTP endpoints, authentication/RBAC, catalog queries, and run commands.
- `worker`: browser acquisition and ingestion jobs.
- `contracts`: Zod request, response, raw-listing, and canonical-listing schemas shared by API and web.
- `sources`: one adapter per external website.
- `ingestion`: orchestration, validation, normalization, identity resolution, persistence, and stale reconciliation.

Source adapter responsibilities:

- Stable source ID and display metadata.
- Supported filter mapping.
- Acquisition mode and browser requirements.
- Search/list discovery and pagination.
- Raw extraction.
- Raw schema validation.
- Canonical normalization.
- Timeout, concurrency, and retry/error classification policy.

Use Playwright/Puppeteer only for pages that genuinely require browser execution. Direct HTTP/HTML parsing should be introduced only after verifying it is supported and reliable for a specific source.

## 10. Persistence model and migrations

PostgreSQL is recommended because the portfolio needs constrained identity, indexed catalog queries, per-source observations, run history, and analytics. Drizzle or Prisma are both acceptable; Drizzle fits the user's existing TypeScript portfolio stack.

Proposed tables:

- `users`: identity and role when authentication is enabled.
- `sources`: source key, display name, enabled status, rate/concurrency configuration.
- `scrape_runs`: request/idempotency key, status, filters, timestamps, aggregate counts, cancellation metadata.
- `source_runs`: one row per source per run with attempt count, status, progress, metrics, safe error category, and timing.
- `vehicles`: canonical identity and normalized attributes; VIN is unique when present.
- `listings`: source offer with `source_id + external_id` unique, vehicle link, price, odometer, dealer, first/last-seen timestamps, and lifecycle status.
- `listing_observations`: optional append-only price/availability history tied to run.
- `ingestion_rejections`: bounded/redacted validation failures for operator investigation.
- `saved_vehicles`: unique `(user_id, vehicle_id)` or demo-session equivalent.

Correctness rules:

- Unique `(source_id, external_id)` makes repeated delivery idempotent.
- VIN can link offers across sources when present and valid.
- VIN-less matching remains conservative and explainable; uncertain matches stay separate.
- One ingestion transaction upserts a validated listing and its observation atomically.
- Run finalization marks listings not seen according to a measured grace policy; a single missing run must not immediately delete a listing.

An outbox is not recommended initially because the HR Intelligence project already demonstrates it and RTA can reliably demonstrate queue idempotency plus reconciliation. Add an outbox only if a committed database state must atomically guarantee publication of another event and simpler reconciliation is insufficient.

## 11. Background jobs and recovery

- `POST /api/v1/scrape-runs` validates filters, applies RBAC/rate limits, creates an idempotent run, queues work, and returns `202` with a run ID.
- A BullMQ worker processes per-source jobs with bounded concurrency.
- Each job carries a stable `runId + sourceId` identity and can safely be delivered more than once.
- Retry only transient navigation/network/rate-limit errors with exponential backoff and jitter.
- Parsing/validation/selector errors fail without blind retry and enter a visible dead-letter/needs-attention state.
- Apply per-source timeouts, browser-context isolation, cancellation checks, and guaranteed page/context cleanup.
- Store progress and partial counts in `source_runs`; the UI polls or uses server-sent events for real status.
- Provide controlled replay for failed source runs and a reconciler for queued/stuck runs.
- For the public demo, default to fixtures/snapshots so recruiter traffic does not repeatedly hit third-party sites. Restrict live scraping to operators and quotas.

## 12. API, security, and observability changes

- Add Zod validation and response schemas.
- Separate `app` construction from `server` startup for testing.
- Add centralized typed errors, safe public messages, and request IDs.
- Add Helmet, strict CORS allowlists, JSON body limits, and endpoint-specific rate limits.
- Implement server-side authentication and RBAC; frontend route guards are only UX, not authorization.
- Remove or isolate legacy lead/user/FTP endpoints from the focused portfolio API.
- Never return generated diagnostic URLs, selectors, stack traces, or private run logs publicly.
- Replace Firestore logging with structured logs (for example Pino) plus persisted safe run metrics. Add `/health/live` and `/health/ready`.
- Configure secrets only through validated environment variables; add sanitized `.env.example` files.
- Remove unused CAPTCHA/adblocker packages and avoid presenting CAPTCHA bypass as a portfolio feature.
- Document responsible scraping: terms/robots review, clear user agent where appropriate, source quotas, and no bypass of access controls.

## 13. Testing strategy

### Unit tests

- Filter schemas and canonical normalization.
- Each URL builder, including boundary/encoding cases.
- Identity/deduplication rules and idempotent upsert behavior.
- Retry/error classification and stale-listing state transitions.
- Price/odometer/year parsing.

### Parser contract tests

- Store small sanitized HTML/JSON fixtures for each source.
- Verify selectors and parsing against fixtures without network access.
- Include empty, malformed, changed-field, missing-image, and pagination fixtures.

### Integration tests

- PostgreSQL repositories and unique constraints using an isolated test database.
- API authentication/RBAC, validation, rate-limit behavior, cursor pagination, and run state transitions.
- BullMQ duplicate delivery, retry, cancellation, partial failure, and stuck-job recovery with isolated Redis.

### End-to-end tests

- Seeded demo search, filter, vehicle detail, compare, save/remove, and operations flows.
- Start run -> observe progress -> partial success/failure -> replay flow using deterministic fake adapters.

### Live smoke checks

- Run separately, manually or on a conservative schedule.
- Never make live external-site tests required for every pull request.
- Record source health without failing unrelated unit/fixture suites.

## 14. Benchmark and evidence strategy

Do not place numbers in the CV or README until measured. Capture:

- Search API p50/p95 latency on a fixed seeded catalog.
- Cursor-pagination response size and query plan before/after indexes.
- Worker memory and CPU at concurrency 1, 2, and a safe measured limit.
- Per-source run duration and extracted/valid/rejected ratios on controlled runs.
- Duplicate-delivery test proving one listing row per `(source, external_id)`.
- Deduplication precision/recall on a labeled fixture set.
- Web bundle size and Lighthouse performance/accessibility results.
- Recovery evidence for timeout, transient failure, malformed source data, duplicate job, and cancellation.

## 15. Expected implementation areas

The exact filenames should be finalized after the scope decision, but likely changes include:

- Root workspace/package configuration, README, environment examples, Docker Compose, and GitHub Actions.
- Backend bootstrap split (`app` versus `server`), configuration validation, middleware, modules, database schema/migrations, queue producer/worker, and source adapters.
- Existing builders and scrapers migrated behind contracts with fixture tests.
- `rta-scrapper` API hooks, types, pages/components, route structure, cancellation/progress handling, server pagination, compare flow, operations UI, and tests.
- Removal or archival of `frontend/` and unrelated lead/user/FTP code only after explicit approval.

## 16. Features intentionally not recommended now

- Microservices or Kubernetes: unjustified for the scale and harmful to demo maintainability.
- GraphQL: catalog filters and job commands are simpler and clearer as REST endpoints.
- Elasticsearch: PostgreSQL indexes/full-text search should be measured first.
- Kafka/event streaming: BullMQ plus PostgreSQL is sufficient for the demonstrated workflow.
- An outbox added solely as a buzzword: use only if atomic event publication becomes a real requirement.
- AI recommendations: they would distract from the project's stronger scraping, data-quality, and reliability story.
- Automatic CAPTCHA solving or access-control bypass.
- Fake live metrics or claims copied from development logs.

## 17. Proposed implementation order

### Phase 0: sanitize and focus

1. Create `portfolio-hardening` from the audited commit.
2. Decide whether to remove/archive the unrelated CRM and FTP inventory workflow.
3. Replace original branding/project identifiers and rotate/detach Firebase configuration.
4. Add a real README, architecture decision notes, environment examples, and reproducible workspace scripts.

### Phase 1: make the baseline trustworthy

1. Separate app/server bootstrapping and dependency injection boundaries.
2. Add validation, safe configuration loading, security middleware, and consistent errors.
3. Fix the Humberview runtime bug, environment typo, normalization errors, and price buckets.
4. Repair lint/typecheck/test scripts and make CI green.
5. Add URL-builder and parser-fixture tests before refactoring scrapers.

### Phase 2: durable ingestion

1. Add PostgreSQL schema/migrations and repositories.
2. Implement typed source adapters and server-side canonical normalization.
3. Add idempotent listing upserts, provenance, observations, and stale lifecycle.
4. Add BullMQ worker execution, bounded concurrency, retries, cancellation, progress, replay, and reconciliation.

### Phase 3: recruiter-facing product

1. Build landing/demo, indexed catalog, vehicle detail, comparison, and saved vehicles.
2. Build source health, run history, run detail, and safe replay UI.
3. Add URL state, cursor pagination, accessibility, error boundaries, skeletons, responsive analytics, and code splitting.

### Phase 4: evidence and release

1. Add integration/E2E/failure-injection coverage.
2. Run benchmarks and document only measured outcomes.
3. Add Docker/CI and a safe fixture-first hosted demo.
4. Perform final secrets, privacy, accessibility, and recruiter walkthrough audits.

## 18. Approval checkpoint

Before broad implementation, approve these decisions:

1. Focus the public repository on vehicle intelligence and remove/archive the unrelated dealership CRM and FTP/lead/user modules.
2. Use TypeScript across API, worker, shared contracts, and web.
3. Use PostgreSQL for listings/run history and Redis/BullMQ for durable background execution.
4. Keep live scraping operator-controlled while public recruiters use safe fixtures/snapshots by default.
5. Create the remote `portfolio-hardening` branch only after approval; do not modify `main`.
