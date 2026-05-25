import { error, json } from "@sveltejs/kit";
import { enqueueTaskRun } from "$lib/server/runtime/runner";
import { getTaskByWebhookPathForExecution } from "$lib/server/tasks/store";
import { normalizeWebhookPath } from "$lib/server/tasks/triggers";
import type { DevoWebhookPayload } from "$lib/server/types";
import type { RequestHandler } from "./$types";

function queryParams(url: URL) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }
  return query;
}

function parseBody(raw_body: string) {
  if (!raw_body) return {};
  try {
    return JSON.parse(raw_body) as unknown;
  } catch {
    return raw_body;
  }
}

async function webhookPayload(request: Request): Promise<DevoWebhookPayload> {
  const url = new URL(request.url);
  const raw_body = await request.text();
  return {
    source: "webhook",
    method: request.method,
    url: url.toString(),
    path: url.pathname,
    query: queryParams(url),
    headers: Object.fromEntries(request.headers.entries()),
    body: parseBody(raw_body),
    raw_body,
    received_at: new Date().toISOString()
  };
}

export const POST: RequestHandler = async ({ params, request }) => {
  let webhook_path: string;
  try {
    webhook_path = normalizeWebhookPath(params.id, params.id);
  } catch {
    throw error(404, "Task not found");
  }
  const task = await getTaskByWebhookPathForExecution(webhook_path);
  if (!task) throw error(404, "Task not found");
  // The opaque webhook path is the bearer secret; never fall back to task IDs here.
  if (task.trigger.type !== "webhook" || task.trigger.path !== webhook_path) throw error(404, "Task not found");

  const run = await enqueueTaskRun(task.id, await webhookPayload(request), task.owner_id);
  return json({ ok: true, run_id: run.id, status: run.status }, { status: 202 });
};
