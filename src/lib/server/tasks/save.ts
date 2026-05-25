import { fileLabel, validateCronExpression, validateEditorFiles, validatePackageJson } from "$lib/tasks/validation";
import type { DevoEnvVar, DevoTask, TaskStatus, TriggerType } from "../types";
import { normalizeEnv, parseEnvText } from "./env-file";
import { writeTaskFiles } from "./files";
import { createTask, updateTask } from "./store";
import { defaultTriggerConfig, displayTrigger, triggerType } from "./triggers";

export type TaskEditorSaveInput = {
  name: string;
  description: string;
  prompt: string;
  trigger: TriggerType;
  trigger_value: string;
  timezone: string;
  env: DevoEnvVar[];
  package_json: string;
  code: string;
};

export type TaskSettingsDefaults = {
  name: string;
  description: string;
  trigger: TriggerType;
  trigger_value: string;
  timezone: string;
};

export class TaskSaveError extends Error {
  status: number;

  constructor(
    message: string,
    options: {
      status?: number;
    } = {}
  ) {
    super(message);
    this.name = "TaskSaveError";
    this.status = options.status || 400;
  }
}

function normalizeSaveError(error: unknown, fallback: string) {
  if (error instanceof TaskSaveError) return error;
  return new TaskSaveError(error instanceof Error ? error.message : fallback);
}

export function taskSaveErrorData(error: unknown, fallback = "Could not save task") {
  const normalized = normalizeSaveError(error, fallback);
  return {
    status: normalized.status,
    message: normalized.message
  };
}

function validateTaskSource(package_json: string, code?: string) {
  if (code !== undefined && !code.trim()) throw new TaskSaveError("Task code is required");
  if (!package_json.trim()) throw new TaskSaveError("package.json is required");

  const packageError = validatePackageJson(package_json);
  if (packageError) throw new TaskSaveError(packageError);
}

function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new TaskSaveError(`Invalid timezone "${timezone}"`);
  }
}

function validateTaskSettings(input: Pick<TaskEditorSaveInput, "name" | "trigger" | "trigger_value" | "timezone">) {
  if (!input.name) throw new TaskSaveError("Task name is required");

  if (input.trigger === "cron") {
    try {
      validateCronExpression(input.trigger_value);
      validateTimezone(input.timezone);
    } catch (error) {
      throw new TaskSaveError(error instanceof Error ? error.message : "Invalid schedule");
    }
  }
}

export function readTaskEditorSaveForm(form: FormData, defaults: TaskSettingsDefaults): TaskEditorSaveInput {
  const formString = (key: string, fallback = "") => {
    const value = form.get(key);
    return value === null ? fallback : String(value).trim();
  };
  const triggerValue = formString("trigger", defaults.trigger);

  const name = formString("name", defaults.name);
  const description = formString("description", defaults.description);
  const prompt = String(form.get("prompt") || "").trim();
  const trigger =
    triggerValue === "webhook" || triggerValue === "cron" || triggerValue === "manual"
      ? triggerValue
      : defaults.trigger;
  const trigger_value = trigger === "manual" ? "" : formString("trigger_value", defaults.trigger_value);
  const timezone = trigger === "cron" ? formString("timezone", defaults.timezone || "UTC") || "UTC" : "UTC";
  const env_text = String(form.get("env_text") || "");
  const package_json = String(form.get("package_json") || "").trim();
  const code = String(form.get("code") || "").trim();

  if (!package_json) throw new TaskSaveError("package.json is required");
  const firstIssue = validateEditorFiles({ env_text, package_json_text: package_json }).find(
    (issue) => issue.severity !== "warning"
  );
  if (firstIssue) throw new TaskSaveError(`${fileLabel(firstIssue.file)}: ${firstIssue.message}`);

  validateTaskSettings({ name, trigger, trigger_value, timezone });
  validateTaskSource(package_json, code);

  let env: DevoEnvVar[] = [];
  if (env_text) {
    env = parseEnvText(env_text);
  } else {
    try {
      env = normalizeEnv(JSON.parse(String(form.get("env") || "[]")));
    } catch {
      env = [];
    }
  }

  return {
    name,
    description,
    prompt,
    trigger,
    trigger_value,
    timezone,
    env,
    package_json,
    code
  };
}

export async function createTaskFromInput(input: {
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
  if (input.package_json !== undefined) validateTaskSource(input.package_json, input.code);

  let task: DevoTask;
  try {
    task = await createTask({
      owner_id: input.owner_id,
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      trigger: input.trigger,
      trigger_value: input.trigger_value,
      timezone: input.timezone,
      env: input.env,
      package_json: input.package_json,
      code: input.code,
      status: input.status
    });
  } catch (error) {
    throw normalizeSaveError(error, "Could not create task");
  }

  return { task };
}

export async function createTaskFromEditorForm(owner_id: string, form: FormData, defaults: TaskSettingsDefaults) {
  const input = readTaskEditorSaveForm(form, defaults);
  return createTaskFromInput({
    owner_id,
    name: input.name,
    prompt: input.prompt,
    description: input.description || input.prompt,
    trigger: input.trigger,
    trigger_value: input.trigger_value,
    timezone: input.timezone,
    env: input.env,
    package_json: input.package_json,
    code: input.code,
    status: "draft"
  });
}

export async function updateTaskFromInput(input: {
  existing: DevoTask;
  owner_id: string;
  patch: Partial<DevoTask>;
  code?: string;
  package_json?: string;
  failureMessage?: string;
}) {
  const patch = { ...input.patch };

  if (input.code !== undefined || input.package_json !== undefined) {
    patch.code = input.code?.trim() ?? input.existing.code;
    patch.package_json = input.package_json?.trim() ?? input.existing.package_json;
    validateTaskSource(patch.package_json, patch.code);
  }

  if (Object.keys(patch).length === 0) return { task: input.existing };
  patch.version = input.existing.version + 1;

  try {
    const task = await updateTask(input.existing.id, input.owner_id, patch);
    if (!task) throw new TaskSaveError("Task not found", { status: 404 });
    return { task };
  } catch (error) {
    // updateTask writes files before the DB upsert; restore the previous files if the DB save fails.
    await writeTaskFiles(input.existing).catch(() => undefined);
    throw normalizeSaveError(error, input.failureMessage || "Could not save task");
  }
}

export async function updateTaskFromEditorForm(existing: DevoTask, owner_id: string, form: FormData) {
  const input = readTaskEditorSaveForm(form, {
    name: existing.name,
    description: existing.description,
    trigger: triggerType(existing.trigger),
    trigger_value: displayTrigger(existing.trigger),
    timezone: existing.trigger.type === "cron" ? existing.trigger.timezone : "UTC"
  });

  return updateTaskFromInput({
    existing,
    owner_id,
    patch: {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      env: input.env,
      trigger: defaultTriggerConfig(input.trigger, existing.id, input.trigger_value, input.timezone),
      status: "deployed",
      last_scheduled_at: undefined,
      next_scheduled_at: undefined,
      schedule_key: undefined,
      schedule_error: undefined
    },
    code: input.code,
    package_json: input.package_json,
    failureMessage: "Could not save task"
  });
}
