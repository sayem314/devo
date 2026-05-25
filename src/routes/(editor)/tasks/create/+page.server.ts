import { fail, redirect } from "@sveltejs/kit";
import { defaultPackageJson, defaultTaskCode } from "$lib/server/tasks/defaults";
import { listAiProviderSettings, publicAiProviderSettings } from "$lib/server/settings/ai";
import { AI_PROVIDERS } from "$lib/server/settings/ai-providers";
import { createTaskFromEditorForm, taskSaveErrorData } from "$lib/server/tasks/save";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  return {
    ai_providers: AI_PROVIDERS,
    ai_settings: (await listAiProviderSettings(locals.user!.id)).map(publicAiProviderSettings),
    task: {
      id: "new",
      name: "Untitled task",
      description: "Draft TypeScript automation.",
      prompt: "Build a webhook that receives Shopify orders and stores them in Postgres.",
      env: [],
      package_json: defaultPackageJson("new"),
      trigger: "webhook" as const,
      status: "draft" as const,
      schedule: "",
      timezone: "UTC",
      version: 0,
      code: defaultTaskCode("webhook"),
      last_run: "never",
      last_scheduled: "never",
      next_run: "never",
      schedule_error: "",
      webhook_path: "",
      webhook_url: ""
    }
  };
};

export const actions: Actions = {
  save: async ({ locals, request }) => {
    const form = await request.formData();
    let task_id: string;
    try {
      const { task } = await createTaskFromEditorForm(locals.user!.id, form, {
        name: "Untitled task",
        description: "Draft TypeScript automation.",
        trigger: "webhook",
        trigger_value: "",
        timezone: "UTC"
      });
      task_id = task.id;
    } catch (error) {
      const data = taskSaveErrorData(error, "Could not create task");
      return fail(data.status, data);
    }

    throw redirect(303, `/tasks/${task_id}`);
  }
};
