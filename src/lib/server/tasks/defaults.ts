import type { TriggerType } from "../types";

export function defaultTaskCode(trigger: TriggerType) {
  if (trigger === "webhook") {
    return `import { writeFile } from "node:fs/promises";

export async function webhook(req: Request, ctx: DevoWebhookContext) {
  const raw_body = await req.text();
  const payload = JSON.parse(raw_body);
  const taskDir = process.env.DEVO_TASK_DIR || ".";

  await writeFile(\`\${taskDir}/latest-webhook-payload.json\`, JSON.stringify(payload, null, 2));
  console.log("received webhook payload", {
    keys: Object.keys(payload),
    run_id: ctx.run_id,
    signature: req.headers.get("x-webhook-signature")
  });

  return Response.json({ ok: true, stored: true });
}`;
  }

  if (trigger === "cron") {
    return `import { readFile, writeFile } from "node:fs/promises";

export async function cron(ctx) {
  const taskDir = process.env.DEVO_TASK_DIR || ".";
  const stateFile = \`\${taskDir}/cron-state.json\`;
  const previous = await readFile(stateFile, "utf8").then(JSON.parse).catch(() => null);
  const current_run = new Date().toISOString();

  await writeFile(stateFile, JSON.stringify({ current_run }, null, 2));
  console.log("cron executed", { previous_run: previous?.current_run, current_run, run_id: ctx.run_id });
  return { ok: true, previous_run: previous?.current_run, current_run };
}`;
  }

  return `export async function run(payload, ctx) {
  console.log("manual task executed", { run_id: ctx.run_id, payload });

  return { ok: true, echo: payload };
}`;
}

export function defaultPackageJson(task_id = "task") {
  return `${JSON.stringify(
    {
      name: `devo-${task_id}`,
      private: true,
      type: "module",
      dependencies: {}
    },
    null,
    2
  )}\n`;
}
