import { json } from "@sveltejs/kit";
import { listRuns } from "$lib/server/runs/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  const limit = Number(url.searchParams.get("limit") || 25);
  const offset = Number(url.searchParams.get("offset") || 0);
  return json({ runs: await listRuns(locals.user!.id, { limit, offset }) });
};
