import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { Insertable, Updateable } from "kysely";
import { getDb, type Database } from "../db";
import { normalizeEnv } from "./env-file";
import { defaultPackageJson, defaultTaskCode } from "./defaults";
import { ensureDataFiles, paths, readTaskFiles, writeTaskFiles } from "./files";
import { defaultTriggerConfig, triggerType } from "./triggers";
import type { DevoTask, TaskStatus, TriggerType } from "../types";

type TaskInsert = Insertable<Database["task"]>;
type TaskUpdate = Updateable<Database["task"]>;

function taskDbValues(task: DevoTask): TaskInsert {
  return {
    id: task.id,
    owner_id: task.owner_id,
    name: task.name,
    description: task.description,
    prompt: task.prompt,
    trigger_type: triggerType(task.trigger),
    trigger_expression: task.trigger.type === "cron" ? task.trigger.expression : null,
    trigger_timezone: task.trigger.type === "cron" ? task.trigger.timezone : null,
    webhook_path: task.trigger.type === "webhook" ? task.trigger.path : null,
    status: task.status,
    version: task.version,
    created_at: task.created_at,
    updated_at: task.updated_at,
    last_run_at: task.last_run_at || null,
    last_scheduled_at: task.last_scheduled_at || null,
    next_scheduled_at: task.next_scheduled_at || null,
    schedule_key: task.schedule_key || null,
    schedule_error: task.schedule_error || null
  };
}

async function writeTask(task: DevoTask) {
  // Files are the editable buffers; the DB row is the indexed metadata used for lists, auth, and scheduling.
  await writeTaskFiles(task);
  const db = await getDb();
  const values = taskDbValues(task);
  const updates: TaskUpdate = { ...values };
  await db
    .insertInto("task")
    .values(values)
    .onConflict((oc) => oc.column("id").doUpdateSet(updates))
    .execute();
}

export async function getTaskByWebhookPathForExecution(webhook_path: string) {
  await ensureDataFiles();
  const db = await getDb();
  const row = await db.selectFrom("task").selectAll().where("webhook_path", "=", webhook_path).executeTakeFirst();
  if (!row) return undefined;
  return readTaskFiles(row);
}

export async function isWebhookPathAvailable(webhook_path: string, excludeTaskId?: string) {
  await ensureDataFiles();
  const db = await getDb();
  let query = db.selectFrom("task").select("id").where("webhook_path", "=", webhook_path);
  if (excludeTaskId) query = query.where("id", "!=", excludeTaskId);
  const existing = await query.executeTakeFirst();
  return !existing;
}

export async function createTask(input: {
  owner_id: string;
  name: string;
  description?: string;
  prompt?: string;
  trigger: TriggerType;
  trigger_value?: string;
  timezone?: string;
  env?: unknown;
  package_json?: string;
  code?: string;
  status?: TaskStatus;
}) {
  await ensureDataFiles();
  const timestamp = new Date().toISOString();
  const task_id = `task_${randomUUID().slice(0, 8)}`;
  const trigger = defaultTriggerConfig(input.trigger, task_id, input.trigger_value, input.timezone);
  if (trigger.type === "webhook" && !(await isWebhookPathAvailable(trigger.path))) {
    throw new Error("Webhook path is already used by another task");
  }
  const task: DevoTask = {
    id: task_id,
    owner_id: input.owner_id,
    name: input.name.trim(),
    description: input.description?.trim() || input.prompt?.trim() || "Local TypeScript automation.",
    prompt: input.prompt?.trim() || "",
    env: normalizeEnv(input.env),
    package_json: input.package_json?.trim() || defaultPackageJson(task_id),
    trigger,
    status: input.status || "deployed",
    version: 1,
    code: input.code?.trim() || defaultTaskCode(input.trigger),
    created_at: timestamp,
    updated_at: timestamp
  };
  await writeTask(task);
  return task;
}

export async function listTasks(owner_id: string) {
  await ensureDataFiles();
  const db = await getDb();
  const rows = await db
    .selectFrom("task")
    .selectAll()
    .where("owner_id", "=", owner_id)
    .orderBy("created_at", "desc")
    .execute();
  return Promise.all(rows.map(readTaskFiles));
}

export async function getTask(task_id: string, owner_id: string) {
  await ensureDataFiles();
  const db = await getDb();
  const row = await db
    .selectFrom("task")
    .selectAll()
    .where("id", "=", task_id)
    .where("owner_id", "=", owner_id)
    .executeTakeFirst();
  if (!row) return undefined;
  return readTaskFiles(row);
}

export async function getTaskForExecution(task_id: string) {
  await ensureDataFiles();
  const db = await getDb();
  const row = await db.selectFrom("task").selectAll().where("id", "=", task_id).executeTakeFirst();
  if (!row) return undefined;
  return readTaskFiles(row);
}

export async function listScheduledTasks() {
  await ensureDataFiles();
  const db = await getDb();
  const rows = await db
    .selectFrom("task")
    .selectAll()
    .where("trigger_type", "=", "cron")
    .where("status", "=", "deployed")
    .execute();
  return Promise.all(rows.map(readTaskFiles));
}

export async function updateTask(task_id: string, owner_id: string, patch: Partial<DevoTask>) {
  await ensureDataFiles();
  const task = await getTask(task_id, owner_id);
  if (!task) return undefined;
  const updated = {
    ...task,
    ...patch,
    id: task.id,
    owner_id: task.owner_id,
    updated_at: new Date().toISOString()
  };
  if (updated.trigger.type === "webhook" && !(await isWebhookPathAvailable(updated.trigger.path, task_id))) {
    throw new Error("Webhook path is already used by another task");
  }
  await writeTask(updated);
  return updated;
}

export async function deleteTask(task_id: string, owner_id: string) {
  await ensureDataFiles();
  const db = await getDb();
  await db.deleteFrom("task").where("id", "=", task_id).where("owner_id", "=", owner_id).execute();
  await rm(paths.taskDir(task_id), { recursive: true, force: true });
}

export async function updateTaskSchedule(
  task_id: string,
  patch: Pick<Partial<DevoTask>, "last_scheduled_at" | "next_scheduled_at" | "schedule_key" | "schedule_error">
) {
  await ensureDataFiles();
  const db = await getDb();
  const values: TaskUpdate = {
    last_scheduled_at: patch.last_scheduled_at || null,
    next_scheduled_at: patch.next_scheduled_at || null,
    schedule_key: patch.schedule_key || null,
    schedule_error: patch.schedule_error || null,
    updated_at: new Date().toISOString()
  };
  await db.updateTable("task").set(values).where("id", "=", task_id).execute();
}
