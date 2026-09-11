ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "email_verification_token_hash" text,
  ADD COLUMN IF NOT EXISTS "email_verification_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "email_verification_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "password_reset_token_hash" text,
  ADD COLUMN IF NOT EXISTS "password_reset_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "access_invite_token_hash" text,
  ADD COLUMN IF NOT EXISTS "access_invite_expires_at" timestamp with time zone;

-- Existing seeded/production accounts already passed the old login boundary.
-- Preserve their access while making all newly registered users unverified.
UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
WHERE "email_verified_at" IS NULL;

CREATE INDEX IF NOT EXISTS "users_email_verification_hash_idx"
  ON "users" ("email_verification_token_hash");
CREATE INDEX IF NOT EXISTS "users_password_reset_hash_idx"
  ON "users" ("password_reset_token_hash");
CREATE INDEX IF NOT EXISTS "users_access_invite_hash_idx"
  ON "users" ("access_invite_token_hash");
