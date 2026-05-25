import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import path from "node:path";
import { createUser, modules, testDataDir, waitForRun } from "./helpers/server";

async function pathExists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function waitForTaskStatus(task_id: string, owner_id: string, status: string) {
  const started_at = Date.now();
  while (Date.now() - started_at < 2000) {
    const task = await modules.tasks.getTask(task_id, owner_id);
    if (task?.status === status) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return modules.tasks.getTask(task_id, owner_id);
}

describe("run lifecycle", () => {
  test("queues and completes a manual run with result and logs", async () => {
    const owner_id = await createUser("run_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Manual run task",
      trigger: "manual",
      env: [
        { name: "DEVO_RUN_INPUT", value: '{"bad":true}' },
        { name: "TASK_SECRET", value: "task-secret" }
      ],
      code: `export function run(payload, ctx) {
  console.log("manual payload", payload.value);
  return {
    ok: true,
    value: payload.value,
    trigger: ctx.trigger,
    taskSecret: process.env.TASK_SECRET,
    leakedAuthSecret: process.env.AUTH_SECRET ?? null,
    leakedSiteUrl: process.env.SITE_URL ?? null,
    leakedDataDir: process.env.DEVO_DATA_DIR ?? null,
    taskDirPresent: Boolean(process.env.DEVO_TASK_DIR)
  };
}`
    });

    const queued = await modules.runner.enqueueTaskRun(task.id, { value: 42 }, owner_id);
    expect(queued.status).toBe("queued");

    const finished = await waitForRun(queued.id);
    expect(finished.status).toBe("success");
    expect(finished.result).toEqual({
      ok: true,
      value: 42,
      trigger: "manual",
      taskSecret: "task-secret",
      leakedAuthSecret: null,
      leakedSiteUrl: null,
      leakedDataDir: null,
      taskDirPresent: true
    });
    expect(finished.logs.some((entry) => entry.message.includes("manual payload"))).toBeTrue();
    expect(await pathExists(path.join(testDataDir, "tasks", task.id, "runs"))).toBeFalse();
  });

  test("claims queued runs from the database-backed queue", async () => {
    const owner_id = await createUser("db_queue_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Durable queue task",
      trigger: "manual",
      code: `export function run() {
  console.log("claimed from database queue");
  return { durable: true };
}`
    });
    const run = await modules.runs.createRun({ task, payload: { source: "test" } });

    let snapshot = await modules.runner.queueSnapshot(owner_id);
    expect(snapshot.queued.some((job) => job.run_id === run.id)).toBeTrue();

    await modules.runner.startRunner();

    const finished = await waitForRun(run.id);
    expect(finished.status).toBe("success");
    expect(finished.result).toEqual({ durable: true });

    snapshot = await modules.runner.queueSnapshot(owner_id);
    expect(snapshot.queued.some((job) => job.run_id === run.id)).toBeFalse();
  });

  test("marks task execution errors failed with useful logs", async () => {
    const owner_id = await createUser("run_failure_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Failing run task",
      trigger: "manual",
      code: `export function run() {
  console.error("about to fail");
  throw new Error("expected task failure");
}`
    });

    const queued = await modules.runner.enqueueTaskRun(task.id, { source: "failure-test" }, owner_id);
    const failed = await waitForRun(queued.id, ["failed"]);
    const updatedTask = await waitForTaskStatus(task.id, owner_id, "failed");

    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Process exited");
    expect(
      failed.logs.some((entry) => entry.level === "error" && entry.message.includes("expected task failure"))
    ).toBeTrue();
    expect(failed.logs.some((entry) => entry.message.includes("about to fail"))).toBeTrue();
    expect(updatedTask?.status).toBe("failed");
  });

  test("marks missing handlers failed before returning success", async () => {
    const owner_id = await createUser("run_missing_handler_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Missing handler task",
      trigger: "manual",
      code: "export const value = 1;"
    });

    const queued = await modules.runner.enqueueTaskRun(task.id, {}, owner_id);
    const failed = await waitForRun(queued.id, ["failed"]);

    expect(failed.status).toBe("failed");
    expect(failed.logs.some((entry) => entry.message.includes("Task must export run()"))).toBeTrue();
  });

  test("marks interrupted running rows failed during cleanup", async () => {
    const owner_id = await createUser("stale_run_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Interrupted run task",
      trigger: "manual"
    });
    const run = await modules.runs.createRun({ task });

    await modules.runs.updateRun(run.id, {
      status: "running",
      worker: "stale-worker",
      started_at: new Date(Date.now() - 1000).toISOString()
    });

    const cleaned = await modules.runs.failInterruptedRuns("Run was interrupted by server restart");
    const updated = await modules.runs.getRun(run.id, owner_id);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(updated?.status).toBe("failed");
    expect(updated?.error).toBe("Run was interrupted by server restart");
    expect(updated?.logs.some((entry) => entry.message === "Run was interrupted by server restart")).toBeTrue();
  });

  test("lists paginated run summaries without loading logs", async () => {
    const owner_id = await createUser("run_summary_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Run summary task",
      trigger: "manual"
    });

    const first = await modules.runs.createRun({ task, payload: { index: 1 } });
    await modules.runs.appendRunLog(first.id, {
      time: new Date().toISOString(),
      level: "info",
      message: "summary list should not include this log"
    });
    await modules.runs.createRun({ task, payload: { index: 2 } });

    const page = await modules.runs.listRuns(owner_id, { limit: 1 });
    expect(page).toHaveLength(1);
    expect(page[0].logs).toEqual([]);

    const fullRun = await modules.runs.getRun(first.id, owner_id);
    expect(fullRun?.logs.some((entry) => entry.message === "summary list should not include this log")).toBeTrue();
  });
});

describe("task terminal", () => {
  test("streams command output from the task directory with task env", async () => {
    const owner_id = await createUser("terminal_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Terminal task",
      trigger: "manual",
      env: [{ name: "TASK_TERMINAL_SECRET", value: "terminal-secret" }]
    });

    const response = await modules.terminalRoute.POST({
      locals: { user: { id: owner_id } },
      params: { id: task.id },
      request: new Request("http://devo.test/api/tasks/terminal", {
        method: "POST",
        body: JSON.stringify({ command: 'printf "$TASK_TERMINAL_SECRET" && pwd' })
      })
    } as Parameters<typeof modules.terminalRoute.POST>[0]);

    const output = await response.text();
    expect(output).toContain("$ printf");
    expect(output).toContain("terminal-secret");
    expect(output).toContain(path.join(testDataDir, "tasks", task.id));
    expect(output).toContain("Process exited with code 0.");
    expect(await pathExists(path.join(testDataDir, "tasks", task.id, ".devo-installed-package.json"))).toBeFalse();
  });
});

describe("cron scheduling", () => {
  test("computes next cron time in UTC and configured timezones", () => {
    const utcNext = modules.scheduler.parseNextCron("0 1 * * *", new Date("2026-05-10T00:00:00.000Z"), "UTC");
    expect(utcNext?.toISOString()).toBe("2026-05-10T01:00:00.000Z");

    const dhakaNext = modules.scheduler.parseNextCron("0 1 * * *", new Date("2026-05-09T18:00:00.000Z"), "Asia/Dhaka");
    expect(dhakaNext?.toISOString()).toBe("2026-05-09T19:00:00.000Z");
  });

  test("lists deployed cron tasks for scheduler pickup", async () => {
    const owner_id = await createUser("cron_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Cron task",
      trigger: "cron",
      trigger_value: "*/5 * * * *",
      timezone: "UTC"
    });

    const scheduledTasks = await modules.tasks.listScheduledTasks();
    expect(scheduledTasks.some((item) => item.id === task.id && item.trigger.type === "cron")).toBeTrue();
  });
});
