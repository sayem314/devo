import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { hostRuntimeEnv } from "../config/env";
import { appendRunLog, getRunForExecution, updateRun } from "../runs/store";
import { paths } from "../tasks/files";
import { taskEnvMap } from "../tasks/env-file";
import { getTask, updateTask } from "../tasks/store";
import { triggerType } from "../tasks/triggers";
import {
  formatBytes,
  log,
  now,
  runtimeCommand,
  runtimeLimits,
  taskRuntime,
  type RunJob,
  type RunningJob
} from "./shared";

// This tiny bridge runs inside the task process, imports user code, and emits one structured result line.
const taskRunnerSource = `const taskEntry = process.env.DEVO_TASK_ENTRY;
if (!taskEntry) {
  throw new Error("Missing DEVO_TASK_ENTRY");
}

const taskModule = await import(taskEntry);
const input = JSON.parse(process.env.DEVO_RUN_INPUT || "{}");
const handlerName = input.trigger === "webhook" ? "webhook" : input.trigger === "cron" ? "cron" : "run";
const handler = taskModule[handlerName] || taskModule.run || taskModule.default;

if (typeof handler !== "function") {
  throw new Error("Task must export " + handlerName + "(), run(), or default function");
}

const ctx = {
  run_id: input.run_id,
  task_id: input.task_id,
  trigger: input.trigger
};

let result;
if (input.trigger === "webhook") {
  const webhook = input.payload?.source === "webhook"
    ? input.payload
    : {
        source: "webhook",
        method: "POST",
        url: "http://devo.local/webhook/" + input.task_id,
        path: "/webhook/" + input.task_id,
        query: {},
        headers: { "content-type": "application/json" },
        body: input.payload || {},
        raw_body: JSON.stringify(input.payload || {}),
        received_at: new Date().toISOString()
      };
  const requestHeaders = { ...(webhook.headers || {}) };
  // These hop-by-hop/original host headers do not apply to the reconstructed local Request.
  delete requestHeaders["content-length"];
  delete requestHeaders["connection"];
  delete requestHeaders["host"];
  const method = webhook.method || "POST";
  const request = new Request(webhook.url || "http://devo.local/webhook/" + input.task_id, {
    method,
    headers: requestHeaders,
    body: method === "GET" || method === "HEAD" ? undefined : webhook.raw_body
  });
  result = await handler(request, ctx);
} else if (input.trigger === "cron") {
  result = await handler(ctx);
} else {
  result = await handler(input.payload || {}, ctx);
}

if (result instanceof Response) {
  result = {
    status: result.status,
    headers: Object.fromEntries(result.headers.entries()),
    body: await result.text()
  };
}

console.log(JSON.stringify({ __devo: "result", result }));
`;

function parseOutputLine(line: string) {
  try {
    const parsed = JSON.parse(line) as { __devo?: string; result?: unknown };
    if (parsed.__devo === "result") {
      const resultMessage = JSON.stringify(parsed.result);
      return log("result", formatLogMessage(resultMessage === undefined ? "undefined" : resultMessage).message);
    }
  } catch {}

  return log("info", formatLogMessage(line).message);
}

function chunkByteLength(chunk: Uint8Array | string) {
  return typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
}

function formatLogMessage(message: string) {
  const bytes = Buffer.byteLength(message);
  if (bytes <= runtimeLimits.max_log_line_bytes) return { message, truncated: false, bytes };

  const suffix = `... [truncated; original ${formatBytes(bytes)}, limit ${formatBytes(runtimeLimits.max_log_line_bytes)}]`;
  const suffixBytes = Buffer.byteLength(suffix);
  const keepBytes = Math.max(0, runtimeLimits.max_log_line_bytes - suffixBytes);
  const prefix = Buffer.from(message).subarray(0, keepBytes).toString("utf8");
  return { message: `${prefix}${suffix}`, truncated: true, bytes };
}

function parseResultLine(line: string) {
  try {
    const parsed = JSON.parse(line) as { __devo?: string; result?: unknown };
    if (parsed.__devo === "result") {
      const resultMessage = JSON.stringify(parsed.result);
      return {
        isResult: true,
        result:
          resultMessage !== undefined && Buffer.byteLength(resultMessage) <= runtimeLimits.max_log_line_bytes
            ? parsed.result
            : undefined
      };
    }
  } catch {}

  return { isResult: false, result: undefined };
}

async function consumeLines(
  stream: AsyncIterable<Uint8Array | string> | null,
  onLine: (line: string) => Promise<void>,
  beforeChunk?: (chunk: Uint8Array | string) => Promise<boolean>
) {
  if (!stream) return;

  const decoder = new TextDecoder();
  let buffered = "";

  for await (const chunk of stream) {
    if (beforeChunk && !(await beforeChunk(chunk))) break;
    buffered += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() || "";

    for (const line of lines.filter(Boolean)) {
      await onLine(line);
    }
  }

  buffered += decoder.decode();
  if (buffered.trim()) await onLine(buffered.trim());
}

function waitForExit(child: NonNullable<RunningJob["child"]>) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

export function killProcessTree(child: NonNullable<RunningJob["child"]>) {
  if (!child.pid) {
    child.kill("SIGKILL");
    return;
  }

  try {
    if (process.platform !== "win32") {
      // Children are started detached, so a negative PID kills the whole task process group.
      process.kill(-child.pid, "SIGKILL");
      return;
    }
  } catch {}

  child.kill("SIGKILL");
}

export async function markRunCanceled(job: RunJob, started_at: string | undefined, reason: string) {
  const finished_at = now();
  const run = await getRunForExecution(job.run_id);
  await updateRun(job.run_id, {
    status: "canceled",
    finished_at,
    duration_ms: started_at ? new Date(finished_at).getTime() - new Date(started_at).getTime() : 0,
    error: reason
  });
  await appendRunLog(job.run_id, log("warn", reason));
  if (run) {
    await updateTask(run.task_id, run.owner_id, { last_run_at: finished_at });
  }
}

export async function executeRunJob(job: RunningJob, running: Map<string, RunningJob>, requestDrain: () => void) {
  const task = await getTask(job.task_id, job.owner_id);
  if (!task) {
    await updateRun(job.run_id, {
      status: "failed",
      finished_at: now(),
      duration_ms: 0,
      error: "Task not found"
    });
    await appendRunLog(job.run_id, log("error", "Task not found"));
    running.delete(job.run_id);
    requestDrain();
    return;
  }
  const queuedRun = await getRunForExecution(job.run_id);
  if (!queuedRun || queuedRun.status === "canceled") {
    running.delete(job.run_id);
    requestDrain();
    return;
  }
  const taskTrigger = triggerType(task.trigger);
  const selectedRuntime = taskRuntime();

  const { started_at, worker } = job;
  await appendRunLog(job.run_id, log("info", `started on ${worker}`));
  await appendRunLog(
    job.run_id,
    log(
      "info",
      `limits timeout=${runtimeLimits.timeout_ms}ms output=${formatBytes(runtimeLimits.max_output_bytes)} line=${formatBytes(runtimeLimits.max_log_line_bytes)}`
    )
  );

  const taskDir = paths.taskDir(task.id);
  const taskEntry = pathToFileURL(paths.taskMainFile(task.id)).href;

  const run = await getRunForExecution(job.run_id);

  let result: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const activeBeforeSpawn = running.get(job.run_id);
    if (activeBeforeSpawn?.cancelRequested) {
      await markRunCanceled(job, started_at, activeBeforeSpawn.cancelReason || "Canceled by user");
      running.delete(job.run_id);
      requestDrain();
      return;
    }

    const command = runtimeCommand(selectedRuntime, taskRunnerSource);
    await appendRunLog(
      job.run_id,
      log("info", `runtime=${selectedRuntime} command=${command.command} --eval <devo task runner>`)
    );

    const child = spawn(command.command, command.args, {
      cwd: taskDir,
      env: {
        ...hostRuntimeEnv(),
        ...taskEnvMap(task),
        DEVO_RUN_INPUT: JSON.stringify({
          run_id: job.run_id,
          task_id: task.id,
          trigger: taskTrigger,
          payload: run?.payload || {}
        }),
        DEVO_RUN_ID: job.run_id,
        DEVO_TASK_ID: task.id,
        DEVO_TRIGGER: taskTrigger,
        DEVO_TASK_ENTRY: taskEntry,
        DEVO_TASK_DIR: taskDir
      },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const activeJob = running.get(job.run_id);
    if (activeJob) {
      activeJob.child = child;
    }

    let timedOut = false;
    let outputLimitExceeded = false;
    let outputBytes = 0;
    let failureReason: string | undefined;
    timer = setTimeout(() => {
      timedOut = true;
      failureReason = `Process timed out after ${runtimeLimits.timeout_ms}ms`;
      appendRunLog(job.run_id, log("error", `${failureReason}; killing process`)).catch(() => undefined);
      killProcessTree(child);
    }, runtimeLimits.timeout_ms);

    const trackOutput = async (chunk: Uint8Array | string, streamName: "stdout" | "stderr") => {
      outputBytes += chunkByteLength(chunk);
      if (outputBytes <= runtimeLimits.max_output_bytes) return true;

      if (!outputLimitExceeded) {
        // Stop reading and kill the task once total output crosses the configured cap.
        outputLimitExceeded = true;
        failureReason = `Process output exceeded ${formatBytes(runtimeLimits.max_output_bytes)}`;
        await appendRunLog(job.run_id, log("error", `${failureReason} while reading ${streamName}; killing process`));
        killProcessTree(child);
      }

      return false;
    };

    const stdoutDone = consumeLines(
      child.stdout,
      async (line) => {
        const parsed = parseOutputLine(line);
        await appendRunLog(job.run_id, parsed);
        const parsedResult = parseResultLine(line);
        if (parsedResult.isResult) {
          result = parsedResult.result;
        }
      },
      (chunk) => trackOutput(chunk, "stdout")
    ).then(
      () => undefined,
      (error: unknown) => error
    );
    const stderrDone = consumeLines(
      child.stderr,
      async (line) => {
        await appendRunLog(job.run_id, log("error", formatLogMessage(line).message));
      },
      (chunk) => trackOutput(chunk, "stderr")
    ).then(
      () => undefined,
      (error: unknown) => error
    );
    const exit = await waitForExit(child);

    if (timer) clearTimeout(timer);
    const streamErrors = await Promise.all([stdoutDone, stderrDone]);
    for (const streamError of streamErrors) {
      if (streamError && !timedOut && !outputLimitExceeded) {
        await appendRunLog(
          job.run_id,
          log(
            "warn",
            `failed to read process output: ${streamError instanceof Error ? streamError.message : String(streamError)}`
          )
        );
      }
    }

    const finished_at = now();
    const duration_ms = new Date(finished_at).getTime() - new Date(started_at).getTime();
    const canceled = Boolean(running.get(job.run_id)?.cancelRequested);
    const cancelReason = running.get(job.run_id)?.cancelReason || "Canceled by user";
    const success = exit.code === 0 && !exit.signal && !timedOut && !outputLimitExceeded && !canceled;
    if (success) {
      await appendRunLog(job.run_id, log("info", `finished successfully in ${duration_ms}ms`));
    } else if (canceled) {
      await appendRunLog(job.run_id, log("warn", `${cancelReason} after ${duration_ms}ms`));
    } else {
      const exitDetail = exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`;
      const message = failureReason || `Process exited with ${exitDetail}`;
      await appendRunLog(job.run_id, log("error", `${message} after ${duration_ms}ms`));
    }
    await updateRun(job.run_id, {
      status: success ? "success" : canceled ? "canceled" : "failed",
      finished_at,
      duration_ms,
      result,
      error: success
        ? undefined
        : canceled
          ? cancelReason
          : failureReason ||
            (exit.signal
              ? `Process exited with signal ${exit.signal}`
              : `Process exited with ${exit.code ?? "unknown"}`)
    });
    await updateTask(task.id, task.owner_id, {
      status: success || canceled ? task.status : "failed",
      last_run_at: finished_at
    });
    running.delete(job.run_id);
    requestDrain();
  } catch (error) {
    if (timer) clearTimeout(timer);
    const finished_at = now();
    const message = error instanceof Error ? error.message : String(error);
    await updateRun(job.run_id, {
      status: "failed",
      finished_at,
      duration_ms: new Date(finished_at).getTime() - new Date(started_at).getTime(),
      error: message
    });
    await appendRunLog(job.run_id, log("error", message));
    await updateTask(task.id, task.owner_id, { status: "failed", last_run_at: finished_at });
    running.delete(job.run_id);
    requestDrain();
  }
}
