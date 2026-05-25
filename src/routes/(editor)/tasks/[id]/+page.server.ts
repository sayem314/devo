import { error, fail, redirect } from "@sveltejs/kit";
import { formatDuration, formatTime } from "$lib/server/format";
import { listRuns } from "$lib/server/runs/store";
import { enqueueTaskRun } from "$lib/server/runtime/runner";
import { listAiProviderSettings, publicAiProviderSettings } from "$lib/server/settings/ai";
import { AI_PROVIDERS } from "$lib/server/settings/ai-providers";
import { taskSaveErrorData, updateTaskFromEditorForm } from "$lib/server/tasks/save";
import { getTask } from "$lib/server/tasks/store";
import { displayTrigger, triggerType } from "$lib/server/tasks/triggers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const task = await getTask(params.id, locals.user!.id);
  if (!task) throw error(404, "Task not found");
  const webhook_path = task.trigger.type === "webhook" ? task.trigger.path : "";
  const webhook_deliveries =
    task.trigger.type === "webhook"
      ? (await listRuns(locals.user!.id, { task_id: task.id, trigger: "webhook", limit: 5 })).map((run) => ({
          id: run.id,
          status: run.status,
          queued: formatTime(run.queued_at),
          duration: formatDuration(run.duration_ms),
          error: run.error || ""
        }))
      : [];

  return {
    ai_providers: AI_PROVIDERS,
    ai_settings: (await listAiProviderSettings(locals.user!.id)).map(publicAiProviderSettings),
    webhook_deliveries,
    task: {
      ...task,
      env: task.env,
      trigger: triggerType(task.trigger),
      schedule: displayTrigger(task.trigger),
      timezone: task.trigger.type === "cron" ? task.trigger.timezone : "UTC",
      last_run: formatTime(task.last_run_at),
      last_scheduled: formatTime(task.last_scheduled_at),
      next_run: formatTime(task.next_scheduled_at),
      schedule_error: task.schedule_error,
      webhook_path,
      webhook_url: webhook_path ? new URL(webhook_path, url.origin).toString() : ""
    }
  };
};

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    const form = await request.formData();
    const existing = await getTask(params.id, locals.user!.id);
    if (!existing) throw error(404, "Task not found");

    try {
      await updateTaskFromEditorForm(existing, locals.user!.id, form);
    } catch (saveError) {
      const data = taskSaveErrorData(saveError, "Could not save task");
      if (data.status === 404) throw error(404, data.message);
      return fail(data.status, data);
    }

    throw redirect(303, `/tasks/${params.id}`);
  },
  run: async ({ locals, params }) => {
    await enqueueTaskRun(params.id, { source: "task-editor", at: new Date().toISOString() }, locals.user!.id);
    throw redirect(303, "/runs");
  }
};
