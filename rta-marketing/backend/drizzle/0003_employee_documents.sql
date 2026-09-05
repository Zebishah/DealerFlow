CREATE TYPE "public"."document_kind" AS ENUM('insurance', 'drivers_license', 'omvic', 'employment', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "employee_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "uploaded_by_user_id" uuid,
  "reviewed_by_user_id" uuid,
  "kind" "document_kind" NOT NULL,
  "status" "document_status" DEFAULT 'pending' NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "checksum_sha256" text,
  "expires_at" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_documents_storage_key_uq" ON "employee_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "employee_documents_workspace_user_idx" ON "employee_documents" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "employee_documents_workspace_status_idx" ON "employee_documents" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "employee_documents_expires_idx" ON "employee_documents" USING btree ("expires_at");
