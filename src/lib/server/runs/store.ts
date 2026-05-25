import { randomUUID } from "node:crypto";
import type { Insertable, Selectable, Updateable } from "kysely";
import { getDb, type Database } from "../db";
import { ensureDataFiles } from "../tasks/files";
import { triggerType } from "../tasks/triggers";
import type { DevoRun, DevoRunLog, DevoTask } from "../types";

type RunRow = Selectable<Database["run"]>;
type RunInsert = Insertable<Database["run"]>;
type RunUpdate = Updateable<Database["run"]>;
type RunLogRow = Selectable<Database["run_log"]>;
type RunQueueRow = Pick<
  RunRow,
  "id" | "task_id" | "task_name" | "owner_id" | "status" | "worker" | "queued_at" | "started_at"
>;
export type RunListOptions = {
  limit?: number;
  offset?: number;
  task_id?: string;
  trigger?: DevoRun["trigger"];
};
export type RunStats = {
  total: number;
  queued: number;
  running: number;
  failed: number;
};
export type RunQueueJob = {
  run_id: string;
  task_id: string;
  task_name: string;
  owner_id: string;
  status: "queued" | "running";
  worker: string;
  queued_at: string;
  started_at?: string;
};

function runDbValues(run: DevoRun): RunInsert {
  return {
    id: run.id,
    owner_id: run.owner_id,
    task_id: run.task_id,
    task_name: run.task_name,
    trigger: run.trigger,
    status: run.status,
    worker: run.worker,
    queued_at: run.queued_at,
    started_at: run.started_at || null,
    finished_at: run.finished_at || null,
    duration_ms: run.duration_ms ?? null,
    payload_json: run.payload === undefined ? null : JSON.stringify(run.payload),
    result_json: run.result === undefined ? null : JSON.stringify(run.result),
    error: run.error || null
  };
}

function parseJsonValue(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function runFromRow(row: RunRow, logs: RunLogRow[]): DevoRun {
  return {
    id: row.id,
    owner_id: row.owner_id,
    task_id: row.task_id,
    task_name: row.task_name,
    trigger: row.trigger,
    status: row.status,
    worker: row.worker,
    queued_at: row.queued_at,
    started_at: row.started_at || undefined,
    finished_at: row.finished_at || undefined,
    duration_ms: row.duration_ms ?? undefined,
    payload: parseJsonValue(row.payload_json),
    result: parseJsonValue(row.result_json),
    error: row.error || undefined,
    logs: logs.map((entry) => ({ time: entry.time, level: entry.level, message: entry.message }))
  };
}

async function insertRunLog(runId: string, log: DevoRunLog) {
  const db = await getDb();
  await db
    .insertInto("run_log")
    .values({ run_id: runId, ...log })
    .execute();
}

function queueJobFromRow(row: RunQueueRow): RunQueueJob {
  return {
    run_id: row.id,
    task_id: row.task_id,
    task_name: row.task_name,
    owner_id: row.owner_id,
    status: row.status as "queued" | "running",
    worker: row.worker,
    queued_at: row.queued_at,
    started_at: row.started_at || undefined
  };
}

export async function createRun(input: { task: DevoTask; payload?: unknown }) {
  await ensureDataFiles();
  const queued_at = new Date().toISOString();
  const run: DevoRun = {
    id: `run_${randomUUID().slice(0, 8)}`,
    owner_id: input.task.owner_id,
    task_id: input.task.id,
    task_name: input.task.name,
    trigger: triggerType(input.task.trigger),
    status: "queued",
    worker: "pending",
    queued_at,
    payload: input.payload,
    logs: [{ time: queued_at, level: "info", message: "queued run" }]
  };

  const db = await getDb();
  await db.insertInto("run").values(runDbValues(run)).execute();
  await db
    .insertInto("run_log")
    .values(run.logs.map((entry) => ({ run_id: run.id, ...entry })))
    .execute();

  return run;
}

export async function getRun(runId: string, owner_id: string) {
  await ensureDataFiles();
  const db = await getDb();
  const row = await db
    .selectFrom("run")
    .selectAll()
    .where("id", "=", runId)
    .where("owner_id", "=", owner_id)
    .executeTakeFirst();
  if (!row) return undefined;
  const logs = await db.selectFrom("run_log").selectAll().where("run_id", "=", runId).orderBy("id").execute();
  return runFromRow(row, logs);
}

export async function getRunForExecution(runId: string) {
  await ensureDataFiles();
  const db = await getDb();
  const row = await db.selectFrom("run").selectAll().where("id", "=", runId).executeTakeFirst();
  if (!row) return undefined;
  const logs = await db.selectFrom("run_log").selectAll().where("run_id", "=", runId).orderBy("id").execute();
  return runFromRow(row, logs);
}

export async function updateRun(runId: string, patch: Partial<Omit<DevoRun, "logs">> & { logs?: DevoRunLog[] }) {
  await ensureDataFiles();
  const run = await getRunForExecution(runId);
  if (!run) return undefined;
  const updated = { ...run, ...patch, logs: patch.logs || run.logs };
  const db = await getDb();
  const values: RunUpdate = runDbValues(updated);
  await db.updateTable("run").set(values).where("id", "=", runId).execute();
  if (patch.logs) {
    await db.deleteFrom("run_log").where("run_id", "=", runId).execute();
    if (patch.logs.length > 0) {
      await db
        .insertInto("run_log")
        .values(patch.logs.map((entry) => ({ run_id: runId, ...entry })))
        .execute();
    }
  }
  return updated;
}

export async function appendRunLog(runId: string, log: DevoRunLog) {
  await ensureDataFiles();
  const run = await getRunForExecution(runId);
  if (!run) return undefined;
  await insertRunLog(runId, log);
  const updated = { ...run, logs: [...run.logs, log] };
  return updated;
}

export async function claimNextQueuedRun(worker: string, started_at: string) {
  await ensureDataFiles();
  const db = await getDb();

  while (true) {
    const row = await db
      .selectFrom("run")
      .select(["id", "task_id", "task_name", "owner_id", "status", "worker", "queued_at", "started_at"])
      .where("status", "=", "queued")
      .orderBy("queued_at", "asc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return undefined;

    const result = await db
      .updateTable("run")
      .set({
        status: "running",
        worker,
        started_at: started_at
      })
      .where("id", "=", row.id)
      .where("status", "=", "queued")
      .executeTakeFirst();

    // Compare-and-swap claim: if another worker got this row first, loop and try the next queued run.
    if (Number(result.numUpdatedRows ?? 0) > 0) {
      return queueJobFromRow({
        ...row,
        status: "running",
        worker,
        started_at: started_at
      });
    }
  }
}

export async function cancelQueuedRun(runId: string, owner_id: string, finished_at: string, reason: string) {
  await ensureDataFiles();
  const db = await getDb();
  const result = await db
    .updateTable("run")
    .set({
      status: "canceled",
      finished_at: finished_at,
      duration_ms: 0,
      error: reason
    })
    .where("id", "=", runId)
    .where("owner_id", "=", owner_id)
    .where("status", "=", "queued")
    .executeTakeFirst();

  if (Number(result.numUpdatedRows ?? 0) === 0) return false;
  await insertRunLog(runId, { time: finished_at, level: "warn", message: reason });
  return true;
}

export async function failInterruptedRuns(reason: string) {
  await ensureDataFiles();
  const db = await getDb();
  const rows = await db.selectFrom("run").selectAll().where("status", "=", "running").execute();
  const finished_at = new Date().toISOString();

  for (const row of rows) {
    const started_at = row.started_at || row.queued_at;
    const duration_ms = Math.max(0, new Date(finished_at).getTime() - new Date(started_at).getTime());
    await db
      .updateTable("run")
      .set({
        status: "failed",
        finished_at: finished_at,
        duration_ms: duration_ms,
        error: reason
      })
      .where("id", "=", row.id)
      .where("status", "=", "running")
      .execute();
    await insertRunLog(row.id, { time: finished_at, level: "error", message: reason });
  }

  return rows.length;
}

export async function listActiveRunJobs(owner_id?: string) {
  await ensureDataFiles();
  const db = await getDb();
  let query = db
    .selectFrom("run")
    .select(["id", "task_id", "task_name", "owner_id", "status", "worker", "queued_at", "started_at"])
    .where("status", "in", ["queued", "running"] as const)
    .orderBy("queued_at", "asc");

  if (owner_id) {
    query = query.where("owner_id", "=", owner_id);
  }

  const rows = await query.execute();
  return rows.map(queueJobFromRow);
}

export async function listRuns(owner_id: string, options: RunListOptions = {}) {
  await ensureDataFiles();
  const db = await getDb();
  let query = db.selectFrom("run").selectAll().where("owner_id", "=", owner_id).orderBy("queued_at", "desc");

  if (options.task_id) query = query.where("task_id", "=", options.task_id);
  if (options.trigger) query = query.where("trigger", "=", options.trigger);

  const limit = Number.isFinite(options.limit) ? Math.min(100, Math.max(1, Math.floor(options.limit || 25))) : 25;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset || 0)) : 0;
  const rows = await query.limit(limit).offset(offset).execute();

  // List views intentionally skip logs; detail views call getRun() when full logs are needed.
  return rows.map((row) => runFromRow(row, []));
}

export async function getRunStats(owner_id: string): Promise<RunStats> {
  await ensureDataFiles();
  const db = await getDb();
  const rows = await db
    .selectFrom("run")
    .select((eb) => ["status", eb.fn.countAll<number>().as("count")])
    .where("owner_id", "=", owner_id)
    .groupBy("status")
    .execute();
  const count = (status: string) => Number(rows.find((row) => row.status === status)?.count || 0);

  return {
    total: rows.reduce((total, row) => total + Number(row.count || 0), 0),
    queued: count("queued"),
    running: count("running"),
    failed: count("failed")
  };
}

export async function applyRunRetention(options: { retentionDays?: number; max_runs_per_task?: number }) {
  await ensureDataFiles();
  const db = await getDb();
  const deleteIds = new Set<string>();
  const retentionDays = Math.max(0, Math.floor(options.retentionDays || 0));
  const max_runs_per_task = Math.max(0, Math.floor(options.max_runs_per_task || 0));

  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db
      .selectFrom("run")
      .select("id")
      .where("queued_at", "<", cutoff)
      .where("status", "not in", ["queued", "running"] as const)
      .execute();
    for (const row of rows) deleteIds.add(row.id);
  }

  if (max_runs_per_task > 0) {
    const tasks = await db.selectFrom("run").select("task_id").groupBy("task_id").execute();
    for (const task of tasks) {
      const rows = await db
        .selectFrom("run")
        .select("id")
        .where("task_id", "=", task.task_id)
        .where("status", "not in", ["queued", "running"] as const)
        .orderBy("queued_at", "desc")
        .execute();
      for (const row of rows.slice(max_runs_per_task)) deleteIds.add(row.id);
    }
  }

  if (deleteIds.size === 0) return 0;

  // run_log rows are removed by ON DELETE cascade from run.
  await db
    .deleteFrom("run")
    .where("id", "in", [...deleteIds])
    .execute();
  return deleteIds.size;
}
