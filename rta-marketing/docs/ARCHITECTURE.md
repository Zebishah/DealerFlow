# Architecture decisions

This document records design choices implemented in the portfolio branch. It avoids claims that cannot be demonstrated from code or test output.

## System boundary

RTA is a modular monolith with a separately deployed ingestion worker. The API owns authentication, catalog queries, run commands, and reliable job publication. The worker owns source acquisition, validation, normalization, identity resolution, and persistence.

Microservices were intentionally rejected: the current scale does not justify distributed ownership, service discovery, additional deployments, or cross-service contracts.

## Reliable job creation

A scrape request writes three kinds of records in one PostgreSQL transaction:

1. One `scrape_runs` aggregate.
2. One `source_runs` record per selected source.
3. One `job_outbox` record per source job.

The outbox dispatcher claims rows with `FOR UPDATE SKIP LOCKED`, publishes them to SQS, and records successful publication. Failed publications use bounded exponential backoff. An abandoned `processing` lease is reclaimed after two minutes.

This closes the failure window where PostgreSQL commits but the API process exits before calling SQS. If SQS accepts a job and the outbox acknowledgement fails, the job can be published twice; ingestion is designed to tolerate that.

## Idempotency and identity

- HTTP run creation requires an `Idempotency-Key`; `scrape_runs.idempotency_key` is unique.
- Source jobs have stable `sourceRunId` context and a versioned Zod contract.
- Listings use unique `(source_id, external_id)` identity.
- Observations use unique `(source_run_id, listing_id)` identity.
- VIN is the strongest cross-source vehicle identity when valid.
- VIN-less records use a conservative normalized fingerprint.

These constraints enforce correctness in PostgreSQL instead of relying only on application-level checks.

## Queue semantics

Amazon SQS provides durable at-least-once delivery. Lambda receives one message per batch and returns partial batch failure information. The event source mapping caps concurrency at two. Local workers use long polling and extend message visibility while a browser job is running.

The DLQ isolates repeatedly failing messages. A dedicated reconciliation Lambda consumes terminal DLQ records, marks the related source run `dead_letter`, and recomputes the parent acquisition run. CloudWatch alarms remain responsible for notifying operators.

## Security model

- Server-managed opaque sessions are stored as SHA-256 hashes.
- Session cookies are HTTP-only and configurable for secure cross-site production use.
- Mutations requiring operator authority also require a CSRF token.
- Live scraping has independent API and worker kill switches.
- Zod validates requests, queue messages, and raw listing records.
- Helmet, strict CORS, request limits, rate limiting, safe errors, request IDs, and structured redacted logging are enabled.
- AWS Lambda uses an IAM execution role; only the Render API requires producer credentials.

## Caching and performance

Redis is intentionally not used. TanStack Query provides browser-side request deduplication, stale-data caching, and background refresh. PostgreSQL indexes support current server-side filters. Adding Redis now would duplicate state, consume another quota, and introduce invalidation complexity without measured benefit.

If production measurements later show repeated expensive aggregate queries, add a short-lived server cache only for those measured endpoints, with explicit invalidation and hit-rate telemetry.

## Frontend organization

- `lib/` contains transport and formatting utilities.
- `types/` contains API-facing contracts.
- `components/` contains reusable presentation and vehicle components.
- `App.tsx` owns page-level orchestration and server-state composition.
- TanStack Query owns remote state; local React state is limited to navigation, filters, comparison, and authentication UI.

Loading, empty, API-error, mutation-pending, responsive, and authenticated/live-mode states are represented explicitly.

## Known boundary

The four browser extractors originated as JavaScript and remain isolated behind the typed `acquireListings` adapter. Colocated declaration contracts type their URL-builder and scraper exports, representative source-shaped fixtures exercise each parser boundary, and every result is converted to a typed raw contract and validated before ingestion. A full DOM-parser rewrite remains adapter-specific work that should only be undertaken with fresh saved HTML from verified source pages.
