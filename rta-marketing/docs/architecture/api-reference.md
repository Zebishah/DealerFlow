# API reference

Base path: `/api/v1`

The API uses an opaque HTTP-only session cookie. Authenticated state-changing requests also require the latest `x-csrf-token`. Retriable create commands documented below require an `Idempotency-Key` header.

## Response conventions

Successful collection:

```json
{ "data": [], "meta": { "nextCursor": null } }
```

Successful resource:

```json
{ "data": { "id": "resource-id" } }
```

Safe error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid values",
    "details": [],
    "requestId": "request-id"
  }
}
```

Money is transported as integer cents. Commission percentages are stored as integer basis points. Timestamps are ISO 8601 UTC strings.

## Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Create an opaque server session |
| GET | `/auth/session` | Authenticated | Restore session and rotate CSRF token |
| POST | `/auth/csrf` | Authenticated | Rotate CSRF token |
| GET | `/auth/capabilities` | Public | Read demo/live feature switches |
| PATCH | `/auth/profile` | Authenticated | Update own profile |
| POST | `/auth/change-password` | Authenticated | Change password and revoke other sessions |
| POST | `/auth/logout` | Authenticated | Revoke current session |

## Dealership operations

| Method | Path | Roles | Important behavior |
|---|---|---|---|
| GET | `/dealership/bootstrap` | Workspace users | Reference data and role-safe team view |
| GET | `/dealership/summary` | Workspace users | Monthly operational KPIs |
| GET | `/dealership/leads` | Admin, employee, assistant, recruiter | Filtered lead pipeline |
| POST | `/dealership/leads` | Admin, employee, assistant | Idempotent lead creation |
| PATCH | `/dealership/leads/:id` | Admin, employee, assistant | Version-checked update |
| GET | `/dealership/sales` | Admin, employee, assistant, recruiter | Scoped sales ledger |
| POST | `/dealership/sales` | Admin, employee, assistant | Idempotent sale creation and commission calculation |
| PATCH | `/dealership/sales/:id` | Admin, employee, assistant | Version-checked update |
| GET | `/dealership/roles` | Authenticated | Assignable role metadata |

## Administration

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET/POST | `/dealership/users` | Admin | List or create workspace users |
| PATCH | `/dealership/users/:id` | Admin | Update role, profile or active state |
| GET/POST | `/dealership/lead-sources` | Admin | Manage lead-source reference data |
| PATCH | `/dealership/lead-sources/:id` | Admin | Update a lead source |
| GET/POST | `/dealership/finance-providers` | Admin | Manage finance providers |
| PATCH | `/dealership/finance-providers/:id` | Admin | Update a finance provider |
| GET/PUT | `/dealership/targets` | Admin, employee read | Read or set monthly targets |
| GET/POST | `/dealership/commission-rules` | Admin, employee read | Read or create effective-dated rules |
| PATCH | `/dealership/commission-rules/:id` | Admin | Update a commission rule |
| GET | `/dealership/audit-events` | Admin | Cursor-paginated audit history |

## Customer operations

These endpoints are workspace-scoped and protected by session, role, CSRF for
writes, and optimistic version checks for state transitions. They model CRM
activity only; they do not send SMS, email, or external chat messages.

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/customer-operations/my-day` | Admin, employee, assistant, recruiter | Personal/workspace operational counts and priority follow-ups |
| GET/POST | `/customer-operations/appointments` | Admin, employee, assistant, recruiter | List or schedule customer appointments |
| PATCH | `/customer-operations/appointments/:id` | Admin, employee, assistant | Confirm or transition an appointment with version protection |
| GET/POST | `/customer-operations/follow-ups` | Admin, employee, assistant, recruiter | List or create CRM follow-up intent |
| PATCH | `/customer-operations/follow-ups/:id` | Admin, employee, assistant | Complete or transition a follow-up with version protection |
| GET/POST | `/customer-operations/leads/:leadId/activities` | Workspace roles / write-capable roles | Read or record contact notes and lead timeline activity |
| GET/POST | `/customer-operations/inbox` | Admin, employee, assistant, recruiter | Read or create internal operational handoffs |
| GET | `/customer-operations/inbox/:id` | Thread participants/admin | Read a thread and its internal messages |
| POST | `/customer-operations/inbox/:id/accept` | Assigned employee/assistant | Accept an assigned handoff and record the timeline event |
| POST | `/customer-operations/inbox/:id/messages` | Thread participants/admin | Add an internal operational reply |
| PATCH | `/customer-operations/inbox/:id` | Admin | Assign, reprioritize, resolve, or reopen a handoff |
| GET | `/customer-operations/performance` | Admin, employee, assistant, recruiter | Real customer-engagement activity metrics; employee/assistant scope is self-only |
| GET | `/customer-operations/admin-overview` | Admin, recruiter | Workspace employee and VA workload and operational totals |
| GET | `/customer-operations/notifications` | Workspace roles | Derived overdue, appointment, and handoff notifications |

## Private employee documents

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/dealership/documents` | Admin or owning employee | List authorized metadata |
| POST | `/dealership/documents/upload-intents` | Admin or employee | Authorize a constrained private S3 upload |
| POST | `/dealership/documents/complete` | Upload owner | Verify S3 metadata and register document |
| GET | `/dealership/documents/:id/download` | Admin or owner | Generate a short-lived download URL |
| PATCH | `/dealership/documents/:id/review` | Admin | Verify or reject a document |
| DELETE | `/dealership/documents/:id` | Admin or pending-document owner | Delete database and private S3 object |

The browser never receives AWS credentials. Upload intents constrain object key, MIME type, byte length, encryption header and expiry.

## Vehicle intelligence

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/vehicles` | Authenticated | Cursor-paginated canonical catalog search |
| GET | `/vehicles/:id` | Authenticated | Vehicle, source offers and price history |
| GET | `/saved-vehicles` | Authenticated | List the current user's saved vehicles |
| POST | `/saved-vehicles/:vehicleId` | Authenticated | Save idempotently |
| DELETE | `/saved-vehicles/:vehicleId` | Authenticated | Remove saved vehicle |
| GET | `/dashboard/summary` | Authenticated | Inventory and acquisition summary |

## Acquisition

| Method | Path | Roles | Important behavior |
|---|---|---|---|
| GET | `/scrape-runs` | Operator, admin, recruiter | List acquisition runs |
| GET | `/scrape-runs/:id` | Operator, admin, recruiter | Run and per-source progress |
| POST | `/scrape-runs` | Operator, admin | Idempotent transactional run creation |
| POST | `/scrape-runs/:id/cancel` | Operator, admin | Request cancellation |
| POST | `/scrape-runs/:id/sources/:sourceRunId/replay` | Operator, admin | Replay one failed terminal source |
| GET | `/sources` | Operator, admin, recruiter | Source health and kill-switch state |
| PATCH | `/sources/:key` | Operator, admin | Update enabled/live state and limits |

Run creation commits the run, source runs and outbox rows in one PostgreSQL transaction. Queue publication is asynchronous. Consumers tolerate SQS duplicate delivery.

Catalog responses include `page.limit`, `page.total`, `page.hasNext`, and `page.nextCursor`. Pass `nextCursor` back as the `cursor` query parameter with the same sort order; cursors are invalidated when the sort changes.

## Operational endpoints

| Method | Path | Database required | Purpose |
|---|---|---:|---|
| GET | `/health/live` | No | Process liveness |
| GET | `/health/ready` | Yes | PostgreSQL readiness |

## Common status codes

| Status | Meaning |
|---:|---|
| 200/201/204 | Success |
| 400 | Invalid request |
| 401 | Missing or invalid session |
| 403 | Role, workspace, CSRF or live-mode restriction |
| 404 | Resource or route not found |
| 409 | Idempotency or optimistic-concurrency conflict |
| 413 | Request/file size violation |
| 422 | Source record cannot be normalized safely |
| 429 | Rate limit reached |
| 500 | Unexpected safe server error |
| 502/504 | Upstream source failure or timeout |
| 503 | Required infrastructure is unavailable |
