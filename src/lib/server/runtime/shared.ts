import type { ChildProcess } from "node:child_process";
import { appEnv } from "../config/env";
import type { DevoRunLog, TaskRuntime } from "../types";

export type RunJob = {
  run_id: string;
  task_id: string;
  owner_id: string;
};

export type RunningJob = RunJob & {
  worker: string;
  started_at: string;
  child?: ChildProcess;
  cancelRequested?: boolean;
  cancelReason?: string;
};

export const runtimeLimits = {
  max_workers: appEnv.DEVO_WORKERS,
  timeout_ms: appEnv.DEVO_TASK_TIMEOUT_MS,
  max_output_bytes: appEnv.DEVO_TASK_MAX_OUTPUT_BYTES,
  max_log_line_bytes: appEnv.DEVO_TASK_MAX_LOG_LINE_BYTES,
  run_retention_days: appEnv.DEVO_RUN_RETENTION_DAYS,
  max_runs_per_task: appEnv.DEVO_MAX_RUNS_PER_TASK
};

export function hostTaskRuntime(): TaskRuntime {
  return (process.versions as NodeJS.ProcessVersions & { bun?: string }).bun ? "bun" : "node";
}

export function taskRuntime(): TaskRuntime {
  return appEnv.DEVO_TASK_RUNTIME === "auto" ? hostTaskRuntime() : appEnv.DEVO_TASK_RUNTIME;
}

export const now = () => new Date().toISOString();

export function log(level: DevoRunLog["level"], message: string): DevoRunLog {
  return { time: now(), level, message };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export function runtimeCommand(runtime: TaskRuntime, source: string) {
  if (runtime === "bun") {
    return {
      command: (process.versions as NodeJS.ProcessVersions & { bun?: string }).bun ? process.execPath : "bun",
      args: ["--eval", source]
    };
  }

  return {
    command: hostTaskRuntime() === "node" ? process.execPath : "node",
    args: ["--eval", source]
  };
}

export function runtimeLabel() {
  const selected = taskRuntime();
  return appEnv.DEVO_TASK_RUNTIME === "auto" ? `${selected} (auto)` : selected;
}
