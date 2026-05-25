CREATE TABLE IF NOT EXISTS "task" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "prompt" text DEFAULT '' NOT NULL,
  "trigger_type" text NOT NULL,
  "trigger_expression" text,
  "trigger_timezone" text,
  "webhook_path" text,
  "status" text NOT NULL,
  "version" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "last_run_at" text,
  "last_scheduled_at" text,
  "next_scheduled_at" text,
  "schedule_key" text,
  "schedule_error" text,
  FOREIGN KEY ("owner_id") REFERENCES "user" ("id") ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "task_owner_id_idx" ON "task" ("owner_id");
CREATE INDEX IF NOT EXISTS "task_status_idx" ON "task" ("status");
CREATE INDEX IF NOT EXISTS "task_trigger_type_idx" ON "task" ("trigger_type");
CREATE INDEX IF NOT EXISTS "task_created_at_idx" ON "task" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "task_webhook_path_unique" ON "task" ("webhook_path");
