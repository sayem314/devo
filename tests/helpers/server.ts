import { afterAll, beforeAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const workspace = await mkdtemp(path.join(tmpdir(), "devo-tests-"));
export const testDataDir = path.join(workspace, ".devo");

process.env.DEVO_DATA_DIR = testDataDir;
process.env.DEVO_WORKERS = "1";
process.env.DEVO_TASK_TIMEOUT_MS = "5000";
process.env.DEVO_TASK_MAX_OUTPUT_BYTES = "1048576";
process.env.DEVO_TASK_MAX_LOG_LINE_BYTES = "8192";
process.env.AUTH_SECRET = "server-secret-should-not-reach-task";
process.env.ORIGIN = "http://devo.test";

type ServerModules = {
  db: typeof import("../../src/lib/server/db/index");
  agent: typeof import("../../src/lib/server/ai/task-agent");
  authUsers: typeof import("../../src/lib/server/auth/users");
  aiSettings: typeof import("../../src/lib/server/settings/ai");
  runs: typeof import("../../src/lib/server/runs/store");
  taskSave: typeof import("../../src/lib/server/tasks/save");
  tasks: typeof import("../../src/lib/server/tasks/store");
  runner: typeof import("../../src/lib/server/runtime/runner");
  scheduler: typeof import("../../src/lib/server/scheduler");
  triggers: typeof import("../../src/lib/server/tasks/triggers");
  terminalRoute: typeof import("../../src/routes/api/tasks/[id]/terminal/+server");
  webhookRoute: typeof import("../../src/routes/webhooks/[id]/+server");
};

export const modules: ServerModules = {
  db: await import("../../src/lib/server/db/index"),
  agent: await import("../../src/lib/server/ai/task-agent"),
  authUsers: await import("../../src/lib/server/auth/users"),
  aiSettings: await import("../../src/lib/server/settings/ai"),
  runs: await import("../../src/lib/server/runs/store"),
  taskSave: await import("../../src/lib/server/tasks/save"),
  tasks: await import("../../src/lib/server/tasks/store"),
  runner: await import("../../src/lib/server/runtime/runner"),
  scheduler: await import("../../src/lib/server/scheduler"),
  triggers: await import("../../src/lib/server/tasks/triggers"),
  terminalRoute: await import("../../src/routes/api/tasks/[id]/terminal/+server"),
  webhookRoute: await import("../../src/routes/webhooks/[id]/+server")
};

let userSeq = 0;

export async function createUser(prefix = "user") {
  userSeq += 1;
  const id = `${prefix}_${userSeq}`;
  const now = Date.now();
  const db = await modules.db.getDb();
  await db
    .insertInto("user")
    .values({
      id,
      name: `Test ${userSeq}`,
      email: `${id}@example.com`,
      email_verified: 1,
      created_at: now,
      updated_at: now
    })
    .execute();
  return id;
}

export async function waitForRun(
  runId: string,
  expected: Array<"success" | "failed" | "canceled"> = ["success"],
  timeout_ms = 5000
) {
  const started_at = Date.now();
  while (Date.now() - started_at < timeout_ms) {
    const run = await modules.runs.getRunForExecution(runId);
    if (run && expected.includes(run.status as "success" | "failed" | "canceled")) return run;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const run = await modules.runs.getRunForExecution(runId);
  throw new Error(`Run ${runId} did not finish. Last status: ${run?.status ?? "missing"}`);
}

beforeAll(async () => {
  await modules.db.migrateDatabase();
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});
