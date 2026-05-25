import { fail, redirect } from "@sveltejs/kit";
import { formatTime } from "$lib/server/format";
import { enqueueTaskRun } from "$lib/server/runtime/runner";
import { deleteTask, listTasks } from "$lib/server/tasks/store";
import { displayTrigger, triggerType } from "$lib/server/tasks/triggers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const tasks = (await listTasks(locals.user!.id)).map((task) => {
    const webhook_path = task.trigger.type === "webhook" ? task.trigger.path : "";
    return {
      ...task,
      trigger: triggerType(task.trigger),
      last_run: formatTime(task.last_run_at),
      last_scheduled: formatTime(task.last_scheduled_at),
      next_run: formatTime(task.next_scheduled_at),
      schedule_error: task.schedule_error || "",
      timezone: task.trigger.type === "cron" ? task.trigger.timezone : "",
      displaySchedule: displayTrigger(task.trigger),
      webhook_path,
      webhook_url: webhook_path ? new URL(webhook_path, url.origin).toString() : ""
    };
  });

  return {
    tasks,
    stats: {
      total: tasks.length,
      deployed: tasks.filter((task) => task.status === "deployed").length,
      scheduled: tasks.filter((task) => task.trigger === "cron").length,
      scheduleErrors: tasks.filter((task) => task.schedule_error).length
    }
  };
};

export const actions: Actions = {
  run: async ({ locals, request }) => {
    const form = await request.formData();
    const task_id = String(form.get("task_id") || "");
    if (!task_id) return fail(400, { message: "Missing task id" });
    await enqueueTaskRun(task_id, { source: "tasks-page", at: new Date().toISOString() }, locals.user!.id);
    throw redirect(303, "/runs");
  },
  delete: async ({ locals, request }) => {
    const form = await request.formData();
    const task_id = String(form.get("task_id") || "");
    if (!task_id) return fail(400, { message: "Missing task id" });
    await deleteTask(task_id, locals.user!.id);
    throw redirect(303, "/tasks");
  }
};
