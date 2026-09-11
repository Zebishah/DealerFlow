# RTA authentication and recruiter access

The dealership API owns the primary account boundary. It uses database-backed, HttpOnly sessions, CSRF tokens, workspace roles and server-side permissions. The scraping API remains a separate access-code/Redis-session service; it does not receive dealership cookies or pretend to be SSO.

## User experiences

- **Recruiter demo:** `/login` → **Enter recruiter demo**. This is a seeded, verified `recruiter` account with broad read access and no destructive privileges.
- **Normal signup:** `/signup` → email verification through Brevo → normal `viewer` access to a private demo workspace.
- **Requested recruiter access:** **Request full access** → admin review → exact, expiring grants → secure Brevo invitation/setup link.

## Render dealership API variables

Set these on the Render dealership API only:

```ini
BREVO_API_KEY=your_brevo_transactional_api_key
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

`BREVO_API_KEY` is server-only. The implementation calls Brevo's HTTPS endpoint `https://api.brevo.com/v3/smtp/email`; it does not use SMTP, Nodemailer or Resend.

For a fresh demo database, provide the seed values while explicitly running the seed command. Render does not run `db:seed` automatically when these variables are saved:

```ini
SEED_DEMO_DATA=true
SEED_DEMO_PASSWORD=the_same_value_as_DEMO_RECRUITER_PASSWORD
SEED_RECRUITER_EMAIL=recruiter.demo@rta.local
```

## Vercel variables

Dealership web:

```ini
VITE_API_URL=https://rta-dealership-api.onrender.com/api/v1
```

Scraping web:

```ini
VITE_API_URL=https://rta-scraping-api.onrender.com
VITE_DEALERSHIP_WEB_URL=https://rta-dealership-web.vercel.app
```

Never add `BREVO_API_KEY`, database credentials, session secrets or scraping tokens to Vercel or any `VITE_*` variable.

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
