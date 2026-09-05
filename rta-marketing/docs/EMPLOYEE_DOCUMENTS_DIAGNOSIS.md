# Employee Documents loading diagnosis

The list request is:

```text
GET /api/v1/dealership/documents
```

This handler authenticates the session, enforces the `admin` or `employee`
role, and reads `employee_documents` joined to `users` in PostgreSQL. It
does not call S3. Missing `S3_DOCUMENT_BUCKET` or AWS object permissions can
break upload, download, or delete operations, but cannot directly break the
metadata list query.

The repository contains migration `0003_employee_documents.sql`. The latest
CI run applied it successfully to CI's temporary PostgreSQL database. That does
not prove it has been applied to Neon.

Run the migration against the direct Neon endpoint:

```bash
cd rta-marketing/backend
NODE_OPTIONS=--dns-result-order=ipv4first npm run db:migrate
```

Then verify only non-secret connection metadata and table presence:

```sql
select to_regclass('public.employee_documents') as employee_documents_table;
```

Interpret the failing browser request before changing configuration:

- `500 INTERNAL_ERROR` plus PostgreSQL `relation "employee_documents" does
  not exist`: migration `0003` is missing from the API database.
- `401 AUTH_REQUIRED`: the session cookie is absent/expired or not sent.
- `403 ROLE_REQUIRED`: the signed-in role is not `admin` or `employee`.
- `403 CORS_ORIGIN_DENIED` or a failed preflight: fix `CORS_ORIGINS`.
- `503 DOCUMENT_STORAGE_UNAVAILABLE`: relevant to an S3 operation, not the
  list handler.

The frontend now displays the HTTP status, safe error code, and request ID so
the corresponding backend log can be located without exposing secrets.
