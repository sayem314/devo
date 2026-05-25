CREATE TABLE IF NOT EXISTS "ai_setting" (
  "owner_id" text NOT NULL,
  "provider" text DEFAULT 'openai' NOT NULL,
  "default_model" text DEFAULT '' NOT NULL,
  "base_url" text,
  "api_key" text,
  "models_json" text,
  "models_updated_at" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  PRIMARY KEY ("owner_id", "provider"),
  FOREIGN KEY ("owner_id") REFERENCES "user" ("id") ON UPDATE no action ON DELETE cascade
);
