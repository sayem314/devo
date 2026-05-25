import { cancelRun, queueSnapshot } from "$lib/server/runtime/runner";
import { formatTime } from "$lib/server/format";
import { schedulerSnapshot } from "$lib/server/scheduler";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user_id = locals.user!.id;
  const snapshot = await queueSnapshot(user_id);
  const scheduler = schedulerSnapshot();

  return {
    snapshot,
    scheduler: {
      ...scheduler,
      last_tick: formatTime(scheduler.last_tick_at)
    },
    items: [
      ...snapshot.running.map((job) => {
        return { ...job, state: "running", task: job.task_name || job.task_id, worker: job.worker };
      }),
      ...snapshot.queued.map((job) => {
        return { ...job, state: "queued", task: job.task_name || job.task_id, worker: "pending" };
      })
    ]
  };
};

export const actions: Actions = {
  cancel: async ({ request, locals }) => {
    const form = await request.formData();
    const run_id = String(form.get("run_id") || "");
    if (!run_id) return fail(400, { message: "Missing run id" });

    const result = await cancelRun(run_id, locals.user!.id);
    if (!result) return fail(404, { message: "Run not found" });
    if (!result.canceled) return fail(409, { message: "Run is already finished" });

    return { message: "Run canceled" };
  }
};
