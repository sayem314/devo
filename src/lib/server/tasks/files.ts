import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Selectable } from "kysely";
import type { Database } from "../db";
import { DATA_DIR } from "../paths";
import { defaultPackageJson, defaultTaskCode } from "./defaults";
import { formatEnv, normalizeEnv, parseEnvText } from "./env-file";
import { normalizeWebhookPath, triggerType } from "./triggers";
import type { DevoTask, TriggerConfig } from "../types";

type TaskRow = Selectable<Database["task"]>;

export const paths = {
  dataDir: DATA_DIR,
  tasksDir: path.join(DATA_DIR, "tasks"),
  taskDir: (task_id: string) => path.join(DATA_DIR, "tasks", task_id),
  taskMainFile: (task_id: string) => path.join(DATA_DIR, "tasks", task_id, "main.ts"),
  taskEnvFile: (task_id: string) => path.join(DATA_DIR, "tasks", task_id, ".env"),
  taskPackageFile: (task_id: string) => path.join(DATA_DIR, "tasks", task_id, "package.json")
};

// Task metadata is stored in SQLite; editable source files live on disk under DATA_DIR/tasks.
let ensuringDataFiles: Promise<void> | undefined;
let dataFilesReady = false;

export async function ensureDataFiles() {
  if (dataFilesReady) return;
  if (ensuringDataFiles) return ensuringDataFiles;

  ensuringDataFiles = (async () => {
    await mkdir(paths.tasksDir, { recursive: true });
  })();

  try {
    await ensuringDataFiles;
    dataFilesReady = true;
  } finally {
    ensuringDataFiles = undefined;
  }
}

async function readText(file: string, fallback = "") {
  try {
    return await readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

async function writeText(file: string, value: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
}

function taskRowTrigger(row: TaskRow): TriggerConfig {
  if (row.trigger_type === "webhook") {
    return { type: "webhook", path: normalizeWebhookPath(row.webhook_path || undefined, row.id) };
  }

  if (row.trigger_type === "cron") {
    return {
      type: "cron",
      expression: row.trigger_expression || "0 9 * * *",
      timezone: row.trigger_timezone || "UTC"
    };
  }

  return { type: "manual" };
}

export async function writeTaskFiles(task: DevoTask) {
  await Promise.all([
    writeText(paths.taskMainFile(task.id), `${task.code.trim()}\n`),
    writeText(paths.taskEnvFile(task.id), `${formatEnv(normalizeEnv(task.env))}\n`),
    writeText(paths.taskPackageFile(task.id), `${(task.package_json || defaultPackageJson(task.id)).trim()}\n`)
  ]);
}

export async function readTaskFiles(row: TaskRow): Promise<DevoTask> {
  const trigger = taskRowTrigger(row);
  const code = await readText(paths.taskMainFile(row.id), defaultTaskCode(triggerType(trigger)));
  const env = parseEnvText(await readText(paths.taskEnvFile(row.id)));
  const package_json = await readText(paths.taskPackageFile(row.id), defaultPackageJson(row.id));

  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    env,
    package_json: package_json.trimEnd(),
    trigger,
    status: row.status,
    version: row.version,
    code: code.trimEnd(),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at || undefined,
    last_scheduled_at: row.last_scheduled_at || undefined,
    next_scheduled_at: row.next_scheduled_at || undefined,
    schedule_key: row.schedule_key || undefined,
    schedule_error: row.schedule_error || undefined
  };
}
