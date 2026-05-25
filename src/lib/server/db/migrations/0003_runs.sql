CREATE TABLE IF NOT EXISTS "run" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "task_id" text NOT NULL,
  "task_name" text NOT NULL,
  "trigger" text NOT NULL,
  "status" text NOT NULL,
  "worker" text NOT NULL,
  "queued_at" text NOT NULL,
  "started_at" text,
  "finished_at" text,
  "duration_ms" integer,
  "payload_json" text,
  "result_json" text,
  "error" text,
  FOREIGN KEY ("owner_id") REFERENCES "user" ("id") ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY ("task_id") REFERENCES "task" ("id") ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "run_owner_id_idx" ON "run" ("owner_id");
CREATE INDEX IF NOT EXISTS "run_task_id_idx" ON "run" ("task_id");
CREATE INDEX IF NOT EXISTS "run_status_idx" ON "run" ("status");
CREATE INDEX IF NOT EXISTS "run_queued_at_idx" ON "run" ("queued_at");
CREATE INDEX IF NOT EXISTS "run_owner_queued_at_idx" ON "run" ("owner_id", "queued_at" DESC);
CREATE INDEX IF NOT EXISTS "run_task_queued_at_idx" ON "run" ("task_id", "queued_at" DESC);

CREATE TABLE IF NOT EXISTS "run_log" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "run_id" text NOT NULL,
  "time" text NOT NULL,
  "level" text NOT NULL,
  "message" text NOT NULL,
  FOREIGN KEY ("run_id") REFERENCES "run" ("id") ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "run_log_run_id_idx" ON "run_log" ("run_id");
CREATE INDEX IF NOT EXISTS "run_log_run_id_id_idx" ON "run_log" ("run_id", "id");
