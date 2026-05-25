import { error, json } from "@sveltejs/kit";
import { taskTypeLibs } from "$lib/server/tasks/type-libs";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const result = await taskTypeLibs(params.id, locals.user!.id);
  if (!result) throw error(404, "Task not found");
  return json(result, {
    headers: {
      "cache-control": "private, max-age=30"
    }
  });
};
