import { json } from "@sveltejs/kit";
import { queueSnapshot } from "$lib/server/runtime/runner";
import { schedulerSnapshot } from "$lib/server/scheduler";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) =>
  json({ ...(await queueSnapshot(locals.user!.id)), scheduler: schedulerSnapshot() });
