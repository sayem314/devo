import { formatDuration, formatTime } from "$lib/server/format";
import { getRun } from "$lib/server/runs/store";
import { cancelRun, retryRun } from "$lib/server/runtime/runner";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const run = await getRun(params.id, locals.user!.id);
  if (!run) throw error(404, "Run not found");

  return {
    run: {
      ...run,
      logs: run.logs.map((entry) => ({ ...entry, time: formatTime(entry.time) })),
      started: formatTime(run.started_at || run.queued_at),
      finished: formatTime(run.finished_at),
      duration: formatDuration(run.duration_ms)
    }
  };
};

export const actions: Actions = {
  cancel: async ({ params, locals }) => {
    const result = await cancelRun(params.id, locals.user!.id);
    if (!result) return fail(404, { message: "Run not found" });
    if (!result.canceled) return fail(409, { message: "Run is already finished" });

    return { message: "Run canceled" };
  },
  retry: async ({ params, locals }) => {
    try {
      const run = await retryRun(params.id, locals.user!.id);
      if (!run) return fail(404, { message: "Run not found" });
    } catch (retryError) {
      return fail(409, { message: retryError instanceof Error ? retryError.message : "Could not retry run" });
    }

    throw redirect(303, "/runs");
  }
};
