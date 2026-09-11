ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "temporary_password_expires_at" timestamptz;
CREATE TYPE "public"."access_request_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'revoked');
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"company" text NOT NULL,
	"job_title" text NOT NULL,
	"email" text NOT NULL,
	"linkedin_url" text,
	"reason" text NOT NULL,
	"platform_scope" jsonb NOT NULL,
	"requested_permissions" jsonb NOT NULL,
	"requested_duration" text NOT NULL,
	"message" text,
	"status" "public"."access_request_status" DEFAULT 'pending' NOT NULL,
	"granted_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"reviewed_at" timestamptz,
	"reviewed_by_user_id" uuid,
	"provisioned_user_id" uuid,
	"approved_until" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null,
	CONSTRAINT "access_requests_provisioned_user_id_users_id_fk" FOREIGN KEY ("provisioned_user_id") REFERENCES "public"."users"("id") ON DELETE set null
);
CREATE INDEX "access_requests_status_created_idx" ON "access_requests" USING btree ("status", "created_at");
CREATE INDEX "access_requests_email_created_idx" ON "access_requests" USING btree ("email", "created_at");
CREATE INDEX "access_requests_provisioned_user_idx" ON "access_requests" USING btree ("provisioned_user_id");
