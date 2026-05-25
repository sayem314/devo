import { formatDuration, formatTime } from "$lib/server/format";
import { getRunStats, listRuns } from "$lib/server/runs/store";
import { queueSnapshot } from "$lib/server/runtime/runner";
import { schedulerSnapshot } from "$lib/server/scheduler";
import { listTasks } from "$lib/server/tasks/store";
import { triggerType } from "$lib/server/tasks/triggers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user_id = locals.user!.id;
  const tasks = (await listTasks(user_id)).map((task) => ({
    ...task,
    trigger: triggerType(task.trigger),
    last_run: formatTime(task.last_run_at)
  }));
  const [run_stats, run_rows, queue] = await Promise.all([
    getRunStats(user_id),
    listRuns(user_id, { limit: 6 }),
    queueSnapshot(user_id)
  ]);
  const scheduler = schedulerSnapshot();
  const runs = run_rows.map((run) => ({
    ...run,
    time: formatTime(run.started_at || run.queued_at),
    duration: formatDuration(run.duration_ms)
  }));

  return {
    tasks,
    runs,
    queue,
    scheduler: {
      ...scheduler,
      last_tick: formatTime(scheduler.last_tick_at)
    },
    stats: {
      tasks: tasks.length,
      deployed: tasks.filter((task) => task.status === "deployed").length,
      queued: queue.queued.length,
      running: queue.active_count,
      failures: run_stats.failed
    }
  };
};
