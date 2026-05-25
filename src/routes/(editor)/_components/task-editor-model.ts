export type EnvVar = {
  name: string;
  value: string;
};

export type TriggerType = "webhook" | "cron" | "manual";

export type TypeLib = {
  path: string;
  content: string;
};

export type AgentMessage = {
  role: "user" | "agent";
  text: string;
};

export type AgentResult = {
  message?: string;
  provider?: string;
  files?: {
    code?: string;
    env_text?: string;
    package_json_text?: string;
  };
};

export type RunPreview = {
  id: string;
  status: "queued" | "running" | "success" | "failed" | "canceled";
  error?: string;
  result?: unknown;
  logs: Array<{
    time: string;
    level: "info" | "warn" | "error" | "result";
    message: string;
  }>;
};

export type WebhookDelivery = {
  id: string;
  status: string;
  queued: string;
  duration: string;
  error: string;
};

export type AiProviderOption = {
  id: string;
  label: string;
  default_model: string;
};

export type AiProviderSettings = {
  provider: string;
  default_model: string;
  has_api_key: boolean;
  models: string[];
};

export type EditorTask = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  env: EnvVar[];
  package_json: string;
  trigger: TriggerType;
  status: "draft" | "deployed" | "failed";
  schedule: string;
  timezone: string;
  version: number;
  code: string;
  last_run: string;
  last_scheduled: string;
  next_run: string;
  schedule_error?: string;
  webhook_path: string;
  webhook_url: string;
};

export type TaskEditorForm = {
  message?: string;
} | null;

export type EditorTab = "task" | "env" | "package";

export type TaskTemplate = {
  trigger: TriggerType;
  label: string;
  name: string;
  description: string;
  prompt: string;
  schedule: string;
  package_json: string;
  code: string;
};

export function formatEnv(env: EnvVar[]) {
  if (env.length === 0) return "# DATABASE_URL=postgres://devo:devo@localhost:5432/devo";
  return env.map((item) => `${item.name}=${item.value}`).join("\n");
}

export function defaultPackageJson(packageName: string) {
  return `${JSON.stringify(
    {
      name: `devo-${packageName}`,
      private: true,
      type: "module",
      dependencies: {}
    },
    null,
    2
  )}\n`;
}

export function parseEnvText(value: string) {
  const env: EnvVar[] = [];
  const seen = new Set<string>();

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = withoutExport.slice(0, separatorIndex).trim();
    let envValue = withoutExport.slice(separatorIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    if ((envValue.startsWith('"') && envValue.endsWith('"')) || (envValue.startsWith("'") && envValue.endsWith("'"))) {
      envValue = envValue.slice(1, -1);
    }
    if (!name || seen.has(name)) continue;
    seen.add(name);
    env.push({ name, value: envValue });
  }

  return env;
}

export const taskTemplates: TaskTemplate[] = [
  {
    trigger: "webhook",
    label: "Webhook",
    name: "Webhook task",
    description: "Receives an HTTP request and stores the latest payload locally.",
    prompt: "Build a webhook that receives JSON and stores the payload.",
    schedule: "",
    package_json: defaultPackageJson("webhook-task"),
    code: `import { writeFile } from "node:fs/promises";

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
}`
  },
  {
    trigger: "cron",
    label: "Cron",
    name: "Scheduled task",
    description: "Runs on a cron schedule and records the last execution timestamp.",
    prompt: "Build a scheduled task that runs every day at 09:00.",
    schedule: "0 9 * * *",
    package_json: defaultPackageJson("scheduled-task"),
    code: `import { readFile, writeFile } from "node:fs/promises";

export async function cron(ctx) {
  const taskDir = process.env.DEVO_TASK_DIR || ".";
  const stateFile = \`\${taskDir}/cron-state.json\`;
  const previous = await readFile(stateFile, "utf8").then(JSON.parse).catch(() => null);
  const current_run = new Date().toISOString();

  await writeFile(stateFile, JSON.stringify({ current_run }, null, 2));
  console.log("cron executed", { previous_run: previous?.current_run, current_run, run_id: ctx.run_id });

  return { ok: true, previous_run: previous?.current_run, current_run };
}`
  },
  {
    trigger: "manual",
    label: "Manual",
    name: "Manual task",
    description: "Runs on demand with an optional payload.",
    prompt: "Build a manual task that accepts a payload and stores it.",
    schedule: "",
    package_json: defaultPackageJson("manual-task"),
    code: `export async function run(payload, ctx) {
  console.log("manual task executed", { run_id: ctx.run_id, payload });

  return { ok: true, echo: payload };
}`
  }
];
