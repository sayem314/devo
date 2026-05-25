import { error, json } from "@sveltejs/kit";
import { getRun } from "$lib/server/runs/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const run = await getRun(params.id, locals.user!.id);
  if (!run) throw error(404, "Run not found");
  return json({ run });
};
