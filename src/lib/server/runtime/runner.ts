import {
  appendRunLog,
  applyRunRetention,
  cancelQueuedRun,
  claimNextQueuedRun,
  createRun,
  failInterruptedRuns,
  getRun,
  listActiveRunJobs
} from "../runs/store";
import { getTask, getTaskForExecution, updateTask } from "../tasks/store";
import { executeRunJob, killProcessTree, markRunCanceled } from "./executor";
import { log, now, runtimeLabel, runtimeLimits, type RunningJob } from "./shared";

const running = new Map<string, RunningJob>();
let workerSeq = 0;
let drainActive = false;
let drainRequested = false;
let startPromise: Promise<void> | undefined;

export async function enqueueTaskRun(task_id: string, payload?: unknown, owner_id?: string) {
  const task = owner_id ? await getTask(task_id, owner_id) : await getTaskForExecution(task_id);
  if (!task) throw new Error("Task not found");
  const run = await createRun({ task, payload });
  requestDrain();
  return run;
}

export async function cancelRun(run_id: string, owner_id: string) {
  const active = running.get(run_id);
  if (active && active.owner_id === owner_id) {
    active.cancelRequested = true;
    active.cancelReason = "Canceled by user";
    await appendRunLog(run_id, log("warn", "Cancellation requested by user"));
    if (active.child) {
      killProcessTree(active.child);
    }
    return { canceled: true, state: "running" as const };
  }

  const run = await getRun(run_id, owner_id);
  if (!run) return undefined;
  if (run.status === "queued") {
    const finished_at = now();
    const canceled = await cancelQueuedRun(run_id, owner_id, finished_at, "Canceled by user before execution");
    if (!canceled) return cancelRun(run_id, owner_id);
    await updateTask(run.task_id, owner_id, { last_run_at: finished_at });
    return { canceled: true, state: "queued" as const };
  }
  if (run.status === "running") {
    await markRunCanceled(
      { run_id, task_id: run.task_id, owner_id },
      run.started_at,
      "Canceled stale run with no active worker"
    );
    return { canceled: true, state: run.status };
  }

  return { canceled: false, state: run.status };
}

export async function retryRun(run_id: string, owner_id: string) {
  const run = await getRun(run_id, owner_id);
  if (!run) return undefined;
  if (run.status === "queued" || run.status === "running") {
    throw new Error("Run is still active");
  }

  const task = await getTask(run.task_id, owner_id);
  if (!task) throw new Error("Task no longer exists");
  return enqueueTaskRun(task.id, run.payload, owner_id);
}

export async function startRunner() {
  startPromise ??= (async () => {
    // Queue state lives in the DB; only live child-process handles are in memory.
    await failInterruptedRuns("Run was interrupted by server restart");
    await applyRunRetention({
      retentionDays: runtimeLimits.run_retention_days,
      max_runs_per_task: runtimeLimits.max_runs_per_task
    });
    requestDrain();
  })().catch((error) => {
    startPromise = undefined;
    throw error;
  });

  return startPromise;
}

export async function queueSnapshot(owner_id?: string) {
  const activeJobs = await listActiveRunJobs(owner_id);
  const queued = activeJobs.filter((job) => job.status === "queued");
  const runningJobs = activeJobs
    .filter((job) => job.status === "running")
    .map((job) => {
      const active = running.get(job.run_id);
      if (!active || (owner_id && active.owner_id !== owner_id)) return job;
      const { child: _child, ...serializableActive } = active;
      return { ...job, ...serializableActive };
    });

  return {
    max_workers: runtimeLimits.max_workers,
    runtime: runtimeLabel(),
    queued,
    running: runningJobs,
    active_count: runningJobs.length
  };
}

function requestDrain() {
  drainRequested = true;
  if (!drainActive) void drainQueue();
}

async function drainQueue() {
  if (drainActive) return;
  drainActive = true;

  try {
    while (drainRequested) {
      drainRequested = false;

      while (running.size < runtimeLimits.max_workers) {
        const started_at = now();
        workerSeq += 1;
        const worker = `worker-${String(workerSeq).padStart(2, "0")}`;
        const job = await claimNextQueuedRun(worker, started_at);
        if (!job) break;

        const runningJob = { run_id: job.run_id, task_id: job.task_id, owner_id: job.owner_id, worker, started_at };
        running.set(job.run_id, runningJob);
        void executeRunJob(runningJob, running, requestDrain);
      }
    }
  } finally {
    drainActive = false;
    if (drainRequested && running.size < runtimeLimits.max_workers) requestDrain();
  }
}
