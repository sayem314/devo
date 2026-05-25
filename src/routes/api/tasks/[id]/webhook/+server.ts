import { error, json } from "@sveltejs/kit";
import { getTask, updateTask } from "$lib/server/tasks/store";
import { defaultTriggerConfig, displayTrigger, triggerType } from "$lib/server/tasks/triggers";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  const task = await getTask(params.id, locals.user!.id);
  if (!task) throw error(404, "Task not found");

  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  const action = body.action === "disable" ? "disable" : body.action === "rotate" ? "rotate" : "";
  if (!action) throw error(400, "Invalid webhook action");

  const trigger =
    action === "rotate" ? defaultTriggerConfig("webhook", task.id) : defaultTriggerConfig("manual", task.id);
  const updated = await updateTask(task.id, locals.user!.id, {
    trigger,
    version: task.version + 1,
    last_scheduled_at: undefined,
    next_scheduled_at: undefined,
    schedule_key: undefined,
    schedule_error: undefined
  });

  if (!updated) throw error(404, "Task not found");
  const webhook_path = updated.trigger.type === "webhook" ? updated.trigger.path : "";
  return json({
    task: {
      id: updated.id,
      trigger: triggerType(updated.trigger),
      schedule: displayTrigger(updated.trigger),
      timezone: updated.trigger.type === "cron" ? updated.trigger.timezone : "UTC",
      webhook_path,
      webhook_url: webhook_path ? new URL(webhook_path, url.origin).toString() : "",
      version: updated.version
    }
  });
};
