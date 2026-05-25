import { error, json } from "@sveltejs/kit";
import { enqueueTaskRun } from "$lib/server/runtime/runner";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const run = await enqueueTaskRun(params.id, payload, locals.user!.id);
    return json({ run }, { status: 202 });
  } catch (cause) {
    throw error(404, cause instanceof Error ? cause.message : "Task not found");
  }
};
