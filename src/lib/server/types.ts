export type TriggerType = "webhook" | "cron" | "manual";
export type TaskRuntime = "bun" | "node";
export type TaskStatus = "draft" | "deployed" | "failed";
export type RunStatus = "queued" | "running" | "success" | "failed" | "canceled";
export type AiProvider = "openai" | "anthropic" | "deepseek" | "kimi" | "glm" | "openrouter" | "openai-compatible";

export type TriggerConfig =
  | {
      type: "manual";
    }
  | {
      type: "webhook";
      path: string;
    }
  | {
      type: "cron";
      expression: string;
      timezone: string;
    };

export type DevoTask = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  prompt: string;
  env: DevoEnvVar[];
  package_json: string;
  trigger: TriggerConfig;
  status: TaskStatus;
  version: number;
  code: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  last_scheduled_at?: string;
  next_scheduled_at?: string;
  schedule_key?: string;
  schedule_error?: string;
};

export type DevoRunLog = {
  time: string;
  level: "info" | "warn" | "error" | "result";
  message: string;
};

export type DevoRun = {
  id: string;
  owner_id: string;
  task_id: string;
  task_name: string;
  trigger: TriggerType;
  status: RunStatus;
  worker: string;
  queued_at: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  payload?: unknown;
  result?: unknown;
  error?: string;
  logs: DevoRunLog[];
};

export type DevoEnvVar = {
  name: string;
  value: string;
};

export type DevoWebhookPayload<TBody = unknown> = {
  source: "webhook";
  method: string;
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: TBody;
  raw_body: string;
  received_at: string;
};
