import { error, json } from "@sveltejs/kit";
import { normalizeEnv } from "$lib/server/tasks/env-file";
import { taskSaveErrorData, updateTaskFromInput } from "$lib/server/tasks/save";
import { getTask } from "$lib/server/tasks/store";
import { defaultTriggerConfig, normalizeTrigger } from "$lib/server/tasks/triggers";
import type { DevoTask, TaskStatus } from "$lib/server/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const task = await getTask(params.id, locals.user!.id);
  if (!task) throw error(404, "Task not found");
  return json({ task });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const body = await request.json();
  const existing = await getTask(params.id, locals.user!.id);
  if (!existing) throw error(404, "Task not found");
  const patch: Partial<DevoTask> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.prompt === "string") patch.prompt = body.prompt.trim();
  if (body.status === "draft" || body.status === "deployed" || body.status === "failed")
    patch.status = body.status as TaskStatus;
  if ("trigger" in body) {
    if (
      typeof body.trigger === "string" &&
      body.trigger !== "webhook" &&
      body.trigger !== "cron" &&
      body.trigger !== "manual"
    ) {
      throw error(400, "Invalid trigger");
    }
    try {
      patch.trigger =
        typeof body.trigger === "string"
          ? defaultTriggerConfig(body.trigger, params.id, body.schedule || body.trigger_value, body.timezone)
          : normalizeTrigger(body.trigger, params.id, body.schedule);
    } catch (triggerError) {
      throw error(400, triggerError instanceof Error ? triggerError.message : "Invalid trigger");
    }
    patch.last_scheduled_at = undefined;
    patch.next_scheduled_at = undefined;
    patch.schedule_key = undefined;
    patch.schedule_error = undefined;
  }
  if ("env" in body) patch.env = normalizeEnv(body.env);

  const codeChanged = typeof body.code === "string";
  const packageChanged = typeof body.package_json === "string";

  let task;
  try {
    task = (
      await updateTaskFromInput({
        existing,
        owner_id: locals.user!.id,
        patch,
        code: codeChanged ? body.code : undefined,
        package_json: packageChanged ? body.package_json : undefined,
        failureMessage: "Could not update task"
      })
    ).task;
  } catch (updateError) {
    const data = taskSaveErrorData(updateError, "Could not update task");
    throw error(data.status, data.message);
  }
  return json({ task });
};
