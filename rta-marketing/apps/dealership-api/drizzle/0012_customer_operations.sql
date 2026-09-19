CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "method" text,
  "note" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_activities_lead_created_idx" ON "lead_activities" ("lead_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_activities_workspace_created_idx" ON "lead_activities" ("workspace_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "assigned_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "salesperson_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "scheduled_at" timestamptz NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled',
  "notes" text,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_workspace_scheduled_idx" ON "appointments" ("workspace_id", "scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_workspace_status_idx" ON "appointments" ("workspace_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_assigned_scheduled_idx" ON "appointments" ("assigned_user_id", "scheduled_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_at" timestamptz NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "priority" text NOT NULL DEFAULT 'normal',
  "note" text,
  "completed_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_workspace_due_idx" ON "follow_ups" ("workspace_id", "due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_assignee_status_due_idx" ON "follow_ups" ("assigned_to_user_id", "status", "due_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operations_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "subject" text NOT NULL,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "priority" text NOT NULL DEFAULT 'normal',
  "status" text NOT NULL DEFAULT 'open',
  "resolved_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_threads_workspace_status_updated_idx" ON "operations_threads" ("workspace_id", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_threads_assignee_status_idx" ON "operations_threads" ("assigned_to_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_threads_lead_idx" ON "operations_threads" ("lead_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operations_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL REFERENCES "operations_threads"("id") ON DELETE CASCADE,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_messages_thread_created_idx" ON "operations_messages" ("thread_id", "created_at");
