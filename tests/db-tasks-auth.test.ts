import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import path from "node:path";
import { createUser, modules, testDataDir } from "./helpers/server";

describe("database migrations", () => {
  test("create expected application tables", async () => {
    const db = await modules.db.getDb();
    const [users, aiSettings, tasks, runs, logs] = await Promise.all([
      db.selectFrom("user").select("id").limit(1).execute(),
      db.selectFrom("ai_setting").select("owner_id").limit(1).execute(),
      db.selectFrom("task").select("id").limit(1).execute(),
      db.selectFrom("run").select("id").limit(1).execute(),
      db.selectFrom("run_log").select("run_id").limit(1).execute()
    ]);

    expect(Array.isArray(users)).toBeTrue();
    expect(Array.isArray(aiSettings)).toBeTrue();
    expect(Array.isArray(tasks)).toBeTrue();
    expect(Array.isArray(runs)).toBeTrue();
    expect(Array.isArray(logs)).toBeTrue();
  });
});

describe("task CRUD", () => {
  test("creates, reads, updates, scopes, and deletes tasks", async () => {
    const owner_id = await createUser("crud_owner");
    const otherOwnerId = await createUser("crud_other");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "CRUD task",
      description: "Original description",
      trigger: "manual",
      code: "export function run() { return { ok: true }; }"
    });

    expect(task.id).toStartWith("task_");
    expect((await modules.tasks.getTask(task.id, owner_id))?.name).toBe("CRUD task");
    expect(await modules.tasks.getTask(task.id, otherOwnerId)).toBeUndefined();

    const updated = await modules.tasks.updateTask(task.id, owner_id, {
      name: "Updated CRUD task",
      version: task.version + 1
    });

    expect(updated?.name).toBe("Updated CRUD task");
    expect(updated?.version).toBe(2);

    await modules.tasks.deleteTask(task.id, owner_id);
    expect(await modules.tasks.getTask(task.id, owner_id)).toBeUndefined();
  });
});

describe("task save", () => {
  test("rolls back task file edits when an update fails", async () => {
    const owner_id = await createUser("save_rollback_owner");
    const existing = await modules.tasks.createTask({
      owner_id,
      name: "Rollback source",
      trigger: "manual",
      package_json: JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2),
      code: "export function run() { return { ok: true }; }"
    });
    const conflicting = await modules.tasks.createTask({
      owner_id,
      name: "Webhook owner",
      trigger: "webhook",
      trigger_value: "/webhooks/shared-save-rollback-secret"
    });
    const conflictingPath = conflicting.trigger.type === "webhook" ? conflicting.trigger.path : "";
    const changedPackageJson = JSON.stringify(
      { private: true, type: "module", dependencies: {}, devoRollbackProbe: true },
      null,
      2
    );

    await expect(
      modules.taskSave.updateTaskFromInput({
        existing,
        owner_id,
        patch: { trigger: { type: "webhook", path: conflictingPath } },
        code: existing.code,
        package_json: changedPackageJson
      })
    ).rejects.toThrow("Webhook path is already used by another task");

    const restored = await modules.tasks.getTask(existing.id, owner_id);
    expect(restored?.package_json).toBe(existing.package_json);
    expect(restored?.trigger.type).toBe("manual");
  });
});

describe("auth ownership", () => {
  test("prevents cross-user task and run access", async () => {
    const owner_id = await createUser("ownership_owner");
    const otherOwnerId = await createUser("ownership_other");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Owned task",
      trigger: "manual",
      code: "export function run() { return { ownerOnly: true }; }"
    });
    const run = await modules.runs.createRun({ task, payload: { ownerOnly: true } });

    expect(await modules.tasks.getTask(task.id, otherOwnerId)).toBeUndefined();
    expect(await modules.runs.getRun(run.id, otherOwnerId)).toBeUndefined();
    expect(await modules.runner.cancelRun(run.id, otherOwnerId)).toBeUndefined();
    expect(await modules.runner.retryRun(run.id, otherOwnerId)).toBeUndefined();
    await expect(modules.runner.enqueueTaskRun(task.id, {}, otherOwnerId)).rejects.toThrow("Task not found");
    expect((await modules.runs.getRun(run.id, owner_id))?.status).toBe("queued");
  });
});

describe("user administration", () => {
  test("deletes user-owned auth rows, settings, tasks, runs, logs, and task files", async () => {
    const admin = await modules.authUsers.createUser({
      name: "Cleanup Admin",
      email: `cleanup-admin-${Date.now()}@example.com`,
      password: "password123",
      role: "admin"
    });
    const owner = await modules.authUsers.createUser({
      name: "Cleanup User",
      email: `cleanup-user-${Date.now()}@example.com`,
      password: "password123",
      role: "user"
    });
    const task = await modules.tasks.createTask({
      owner_id: owner.id,
      name: "User cleanup task",
      trigger: "manual"
    });
    const run = await modules.runs.createRun({ task });
    await modules.runs.appendRunLog(run.id, {
      time: new Date().toISOString(),
      level: "info",
      message: "cleanup log"
    });

    const db = await modules.db.getDb();
    const timestamp = Date.now();
    await db
      .insertInto("session")
      .values({
        id: `session_${timestamp}`,
        token: `token_${timestamp}`,
        user_id: owner.id,
        expires_at: timestamp + 1000,
        ip_address: null,
        user_agent: null,
        created_at: timestamp,
        updated_at: timestamp
      })
      .execute();
    await db
      .insertInto("verification")
      .values({
        id: `verification_${timestamp}`,
        identifier: owner.email,
        value: "token",
        expires_at: timestamp + 1000,
        created_at: timestamp,
        updated_at: timestamp
      })
      .execute();
    await db
      .insertInto("ai_setting")
      .values({
        owner_id: owner.id,
        provider: "openai",
        default_model: "gpt-5.2",
        base_url: "https://api.openai.com/v1",
        api_key: "secret",
        models_json: "[]",
        models_updated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .execute();

    const taskDir = path.join(testDataDir, "tasks", task.id);
    await access(taskDir);

    await modules.authUsers.deleteUser(owner.id, admin.id);

    const [user, account, session, verification, aiSetting, deletedTask, deletedRun, deletedLogs] = await Promise.all([
      db.selectFrom("user").select("id").where("id", "=", owner.id).executeTakeFirst(),
      db.selectFrom("account").select("id").where("user_id", "=", owner.id).execute(),
      db.selectFrom("session").select("id").where("user_id", "=", owner.id).execute(),
      db.selectFrom("verification").select("id").where("identifier", "=", owner.email).execute(),
      db.selectFrom("ai_setting").select("owner_id").where("owner_id", "=", owner.id).execute(),
      db.selectFrom("task").select("id").where("owner_id", "=", owner.id).execute(),
      db.selectFrom("run").select("id").where("owner_id", "=", owner.id).execute(),
      db.selectFrom("run_log").select("run_id").where("run_id", "=", run.id).execute()
    ]);

    expect(user).toBeUndefined();
    expect(account).toHaveLength(0);
    expect(session).toHaveLength(0);
    expect(verification).toHaveLength(0);
    expect(aiSetting).toHaveLength(0);
    expect(deletedTask).toHaveLength(0);
    expect(deletedRun).toHaveLength(0);
    expect(deletedLogs).toHaveLength(0);
    await expect(access(taskDir)).rejects.toThrow();
  });
});
