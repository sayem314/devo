import { formatDuration, formatTime } from "$lib/server/format";
import { getRunStats, listRuns } from "$lib/server/runs/store";
import { cancelRun, queueSnapshot, retryRun } from "$lib/server/runtime/runner";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

function pageHref(page: number) {
  return page <= 1 ? "/runs" : `/runs?page=${page}`;
}

function paginationItems(currentPage: number, totalPages: number) {
  const pages = new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages]);
  const visiblePages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<{ type: "page"; page: number; href: string } | { type: "ellipsis"; key: string }> = [];

  for (const page of visiblePages) {
    const previous = items.at(-1);
    if (previous?.type === "page" && page - previous.page > 1) {
      items.push({ type: "ellipsis", key: `${previous.page}-${page}` });
    }
    items.push({ type: "page", page, href: pageHref(page) });
  }

  return items;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const user_id = locals.user!.id;
  const limit = 25;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const offset = (page - 1) * limit;
  const [run_stats, run_rows, queue] = await Promise.all([
    getRunStats(user_id),
    listRuns(user_id, { limit, offset }),
    queueSnapshot(user_id)
  ]);
  const runs = run_rows.map((run) => ({
    ...run,
    started: formatTime(run.started_at || run.queued_at),
    duration: formatDuration(run.duration_ms)
  }));

  return {
    runs,
    pagination: {
      page,
      limit,
      total: run_stats.total,
      totalPages: Math.max(1, Math.ceil(run_stats.total / limit)),
      items: paginationItems(page, Math.max(1, Math.ceil(run_stats.total / limit))),
      hasPrevious: page > 1,
      hasNext: offset + runs.length < run_stats.total,
      previousHref: pageHref(page - 1),
      nextHref: pageHref(page + 1)
    },
    queue,
    stats: {
      total: run_stats.total,
      queued: run_stats.queued,
      running: run_stats.running,
      failed: run_stats.failed
    }
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
  },
  retry: async ({ request, locals }) => {
    const form = await request.formData();
    const run_id = String(form.get("run_id") || "");
    if (!run_id) return fail(400, { message: "Missing run id" });

    try {
      const run = await retryRun(run_id, locals.user!.id);
      if (!run) return fail(404, { message: "Run not found" });
    } catch (error) {
      return fail(409, { message: error instanceof Error ? error.message : "Could not retry run" });
    }

    throw redirect(303, "/runs");
  }
};
