import { error, json } from "@sveltejs/kit";
import { defaultPackageJson } from "$lib/server/tasks/defaults";
import { normalizeEnv } from "$lib/server/tasks/env-file";
import { createTaskFromInput, taskSaveErrorData } from "$lib/server/tasks/save";
import { listTasks } from "$lib/server/tasks/store";
import type { RequestHandler } from "./$types";
import type { TriggerType } from "$lib/server/types";

export const GET: RequestHandler = async ({ locals }) => json({ tasks: await listTasks(locals.user!.id) });

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json();
  const trigger: TriggerType =
    body.trigger === "webhook" || body.trigger === "cron" || body.trigger === "manual" ? body.trigger : "manual";
  const package_json = typeof body.package_json === "string" ? body.package_json : defaultPackageJson("api-task");
  try {
    const { task } = await createTaskFromInput({
      owner_id: locals.user!.id,
      name: body.name || "Untitled task",
      description: body.description,
      prompt: body.prompt,
      trigger,
      trigger_value: body.schedule || body.trigger_value,
      timezone: body.timezone,
      env: normalizeEnv(body.env),
      package_json,
      code: typeof body.code === "string" ? body.code : undefined
    });
    return json({ task }, { status: 201 });
  } catch (createError) {
    const data = taskSaveErrorData(createError, "Could not create task");
    throw error(data.status, data.message);
  }
};
