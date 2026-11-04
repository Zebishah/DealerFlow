# RTA authentication and recruiter access

The dealership API owns the primary account boundary. It uses database-backed, HttpOnly sessions, CSRF tokens, workspace roles and server-side permissions. The scraping API remains a separate access-code/Redis-session service; it does not receive dealership cookies or pretend to be SSO.

## User experiences

- **Recruiter demo:** `/login` → **Enter recruiter demo**. This is a seeded, verified `recruiter` account with broad read access and no destructive privileges.
- **Normal signup:** `/signup` → email verification through Resend → normal `viewer` access to a private demo workspace.
- **Requested recruiter access:** **Request full access** → admin review → exact, expiring grants → secure Resend invitation/setup link.

## Render dealership API variables

Set these on the Render dealership API only:

```ini
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=verified-sender@your-domain.example
EMAIL_FROM_NAME=RTA Automotive Group
DEALERSHIP_WEB_URL=https://rta-dealership-web.vercel.app
SCRAPING_WEB_URL=https://rta-scraping-web.vercel.app
ADMIN_NOTIFICATION_EMAIL=admin@your-domain.example
CORS_ORIGINS=https://rta-dealership-web.vercel.app,https://rta-scraping-web.vercel.app

DEMO_MODE=true
DEMO_RECRUITER_EMAIL=recruiter.demo@rta.local
DEMO_RECRUITER_PASSWORD=the_same_password_as_the_seeded_recruiter
```

`RESEND_API_KEY` is server-only. The implementation calls Resend's HTTPS endpoint `https://api.resend.com/emails` with Bearer authentication; no SMTP credentials or browser-side email key are required.

Use an `EMAIL_FROM` address on a domain verified in your Resend account.
The `onboarding@resend.dev` sender is for testing and can only deliver to the
email address associated with that Resend account; it is unsuitable for normal
customer verification, reset, or invitation messages.

To migrate an existing deployment, add `RESEND_API_KEY` to the **Render dealership
API** environment, verify the sending domain in Resend, update `EMAIL_FROM` if
needed, and redeploy the API. Remove the old `BREVO_API_KEY` variable after
switching. `EMAIL_FROM_NAME`, `ADMIN_NOTIFICATION_EMAIL`, and the frontend link
URLs keep their existing meanings. Vercel needs no Resend credentials.

Provider reference: [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).

For a fresh demo database, provide the seed values while explicitly running the seed command. Render does not run `db:seed` automatically when these variables are saved:

```ini
SEED_DEMO_DATA=true
SEED_DEMO_PASSWORD=the_same_value_as_DEMO_RECRUITER_PASSWORD
SEED_RECRUITER_EMAIL=recruiter.demo@rta.local
```

## Vercel variables

Dealership web uses the same-origin `/rta-api` gateway automatically on
production `*.vercel.app` hosts. Both the repository-level and
`apps/dealership-web/vercel.json` configurations forward that path to
`https://rta-dealership-api.onrender.com/api/v1` and disable response caching.
This lets the browser retain the HttpOnly session as a first-party cookie
without permitting third-party cookies. Existing absolute `VITE_API_URL`
settings do not bypass that gateway on Vercel.

For a custom domain on the same Vercel project:

```ini
VITE_API_SAME_ORIGIN=true
```

For local development or another host without the gateway, `VITE_API_URL`
continues to select the direct API. If the Render hostname changes, update
both Vercel rewrite destinations. Deploy the Vercel routing configuration
and the frontend build together, then sign in again; the old API-domain
cookie does not become a website-domain cookie automatically.

Scraping web:

```ini
VITE_API_URL=https://rta-scraping-api.onrender.com
VITE_DEALERSHIP_WEB_URL=https://rta-dealership-web.vercel.app
```

Never add `RESEND_API_KEY`, database credentials, session secrets or scraping tokens to Vercel or any `VITE_*` variable.

## Migration and seed

Run from a trusted environment using the dealership database URL:

```bash
npm run db:migrate --workspace=@rta/dealership-api
npm run db:seed --workspace=@rta/dealership-api
```

Run the migration with `DATABASE_MIGRATION_URL` set to Neon’s direct/non-pooled
URL. Run the seed with `DATABASE_URL` set to Neon’s pooled URL. Do not set
`DATABASE_URL` to the direct URL for the seed; direct connections can time out
even when the pooled endpoint is reachable.

Migration `0008_auth_email_flows.sql` adds hashed verification, reset and invitation-token fields. Existing accounts are marked verified during migration so the old login flow is not broken; new signups start unverified.

## API endpoints

- `POST /api/v1/auth/signup`
- `GET /api/v1/auth/verify-email?token=...`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/setup-access`
- `POST /api/v1/access-requests`
- `GET /api/v1/dealership/admin/access-requests`
- `PATCH /api/v1/dealership/admin/access-requests/:id`
- `POST /api/v1/dealership/admin/access-requests/:id/resend-notification`

Raw email tokens are never stored. Approval keeps the recruiter role separate from admin and records the exact grant list plus `approvedUntil`. Revocation deactivates the account and invalidates sessions. A temporary invitation link is single-use; no plaintext password is emailed.

Email delivery failures do not roll back signup or approval. The account remains recoverable through resend/notification actions, and logs contain only the use case, provider status and recipient domain—not tokens, passwords or API keys.

## Dashboard login succeeds but data requests return 401

The former cross-origin deployment could return `200` from `/auth/demo-login`
while the browser blocked the Render session cookie. The UI then entered the
workspace from the login response, but summary, bootstrap, and other protected
requests returned `401 AUTH_REQUIRED`.

The gateway removes this dependency on third-party cookies. Login and demo
login also verify `/auth/session` before updating the frontend user or redirecting.
A failed session check leaves the visitor on the sign-in screen with an error.
Session, CSRF, role, and workspace checks remain enforced by the API.

Verify after deployment:

1. In a browser that blocks third-party cookies, open `/login` and use a role preview.
2. Confirm `/rta-api/auth/demo-login`, `/rta-api/auth/session`, and the dashboard
   data requests return `200`.
3. Reload a protected page; the session and workspace data should still load.
4. Confirm `/rta-api/*` responses are not cached and the session cookie remains HttpOnly.

The deployment mechanism follows [Vercel external rewrites](https://vercel.com/docs/routing/rewrites#rewrites-to-external-origins).
The gateway uses a distinct prefix so it does not collide with the scraping
monitor's existing `/api` serverless function.

The fix was verified using the production frontend build with its configured
rewrite applied in a browser test, forwarding to the actual hosted API. With
Chromium third-party cookie restrictions enabled, the cookie was retained on
the frontend host, six seeded demo leads loaded, protected data requests
returned 200, and a page reload preserved the session. Hosted Vercel routing
still needs deployment and a post-deployment check.
