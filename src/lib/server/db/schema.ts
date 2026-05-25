import type { ColumnType, Generated } from "kysely";
import type { AiProvider, RunStatus, TaskStatus, TriggerType } from "../types";

export type TimestampMs = ColumnType<number, number, number>;
export type TimestampText = ColumnType<string, string, string>;
export type JsonText = ColumnType<string | null, string | null | undefined, string | null | undefined>;

export type UserTable = {
  id: string;
  name: string;
  email: string;
  role: ColumnType<string, string | undefined, string | undefined>;
  email_verified: ColumnType<boolean, boolean | number, boolean | number>;
  image: string | null;
  created_at: TimestampMs;
  updated_at: TimestampMs;
};

export type SessionTable = {
  id: string;
  token: string;
  user_id: string;
  expires_at: TimestampMs;
  ip_address: string | null;
  user_agent: string | null;
  created_at: TimestampMs;
  updated_at: TimestampMs;
};

export type AccountTable = {
  id: string;
  account_id: string;
  provider_id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: TimestampMs | null;
  refresh_token_expires_at: TimestampMs | null;
  scope: string | null;
  password: string | null;
  created_at: TimestampMs;
  updated_at: TimestampMs;
};

export type VerificationTable = {
  id: string;
  identifier: string;
  value: string;
  expires_at: TimestampMs;
  created_at: TimestampMs;
  updated_at: TimestampMs;
};

export type AiSettingTable = {
  owner_id: string;
  provider: AiProvider;
  default_model: string;
  base_url: string | null;
  api_key: string | null;
  models_json: JsonText;
  models_updated_at: string | null;
  created_at: TimestampText;
  updated_at: TimestampText;
};

export type TaskTable = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  prompt: string;
  trigger_type: TriggerType;
  trigger_expression: string | null;
  trigger_timezone: string | null;
  webhook_path: string | null;
  status: TaskStatus;
  version: number;
  created_at: TimestampText;
  updated_at: TimestampText;
  last_run_at: string | null;
  last_scheduled_at: string | null;
  next_scheduled_at: string | null;
  schedule_key: string | null;
  schedule_error: string | null;
};

export type RunTable = {
  id: string;
  owner_id: string;
  task_id: string;
  task_name: string;
  trigger: TriggerType;
  status: RunStatus;
  worker: string;
  queued_at: TimestampText;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  payload_json: JsonText;
  result_json: JsonText;
  error: string | null;
};

export type RunLogTable = {
  id: Generated<number>;
  run_id: string;
  time: TimestampText;
  level: "info" | "warn" | "error" | "result";
  message: string;
};

export type Database = {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  ai_setting: AiSettingTable;
  task: TaskTable;
  run: RunTable;
  run_log: RunLogTable;
};
