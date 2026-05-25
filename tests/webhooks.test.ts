import { describe, expect, test } from "bun:test";
import { createUser, modules, waitForRun } from "./helpers/server";

describe("webhook execution", () => {
  test("generates opaque webhook paths instead of task id endpoints", async () => {
    const owner_id = await createUser("webhook_secret_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Generated webhook task",
      trigger: "webhook",
      code: "export async function webhook() { return Response.json({ ok: true }); }"
    });

    const webhook_path = task.trigger.type === "webhook" ? task.trigger.path : "";
    expect(webhook_path).toStartWith("/webhooks/whsec_");
    expect(webhook_path).not.toBe(`/webhooks/${task.id}`);

    let taskIdWebhookStatus = 0;
    try {
      await modules.webhookRoute.POST({
        params: { id: task.id },
        request: new Request(`http://devo.test/webhooks/${task.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        })
      } as Parameters<typeof modules.webhookRoute.POST>[0]);
    } catch (error) {
      taskIdWebhookStatus = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    }

    expect(taskIdWebhookStatus).toBe(404);
  });

  test("resolves stored webhook path and enqueues executable webhook run", async () => {
    const owner_id = await createUser("webhook_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Webhook task",
      trigger: "webhook",
      trigger_value: "orders-created",
      code: `export async function webhook(req, ctx) {
        const rawBody = await req.text();
        const body = JSON.parse(rawBody);
        const url = new URL(req.url);
        return Response.json({
          ok: true,
          orderId: body.orderId,
          hmac: req.headers.get("x-shopify-hmac-sha256"),
          shop: url.searchParams.get("shop"),
          tags: url.searchParams.getAll("tag"),
          trigger: ctx.trigger,
          rawBody
        });
      }`
    });

    expect(task.trigger.type === "webhook" ? task.trigger.path : "").toBe("/webhooks/orders-created");

    const response = await modules.webhookRoute.POST({
      params: { id: "orders-created" },
      request: new Request("http://devo.test/webhooks/orders-created?shop=dev-store&tag=paid&tag=vip", {
        method: "POST",
        headers: { "content-type": "application/json", "x-shopify-hmac-sha256": "signature" },
        body: JSON.stringify({ orderId: 1001 })
      })
    } as Parameters<typeof modules.webhookRoute.POST>[0]);

    expect(response.status).toBe(202);
    const body = (await response.json()) as { run_id: string; status: string };
    expect(body.status).toBe("queued");

    const finished = await waitForRun(body.run_id);
    expect(finished.status).toBe("success");
    const result = finished.result as { status: number; headers: Record<string, string>; body: string };
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(result.body)).toEqual({
      ok: true,
      orderId: 1001,
      hmac: "signature",
      shop: "dev-store",
      tags: ["paid", "vip"],
      trigger: "webhook",
      rawBody: JSON.stringify({ orderId: 1001 })
    });
  });

  test("prevents webhook secret reuse across users", async () => {
    const owner_id = await createUser("webhook_scope_owner");
    const otherOwnerId = await createUser("webhook_scope_other");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Scoped webhook task",
      trigger: "webhook",
      trigger_value: "shared-secret",
      code: "export async function webhook() { return Response.json({ ok: true }); }"
    });

    expect(task.trigger.type === "webhook" ? task.trigger.path : "").toBe("/webhooks/shared-secret");
    await expect(
      modules.tasks.createTask({
        owner_id: otherOwnerId,
        name: "Conflicting webhook task",
        trigger: "webhook",
        trigger_value: "shared-secret",
        code: "export async function webhook() { return Response.json({ ok: true }); }"
      })
    ).rejects.toThrow("Webhook path is already used");
  });

  test("rejects stale webhook secrets after rotation", async () => {
    const owner_id = await createUser("webhook_rotate_owner");
    const task = await modules.tasks.createTask({
      owner_id,
      name: "Rotated webhook task",
      trigger: "webhook",
      trigger_value: "old-secret",
      code: "export async function webhook() { return Response.json({ ok: true }); }"
    });
    const oldPath = task.trigger.type === "webhook" ? task.trigger.path : "";
    const rotatedTrigger = modules.triggers.defaultTriggerConfig("webhook", task.id, "new-secret");
    const updated = await modules.tasks.updateTask(task.id, owner_id, { trigger: rotatedTrigger });

    expect(oldPath).toBe("/webhooks/old-secret");
    expect(updated?.trigger.type === "webhook" ? updated.trigger.path : "").toBe("/webhooks/new-secret");

    let oldSecretStatus = 0;
    try {
      await modules.webhookRoute.POST({
        params: { id: "old-secret" },
        request: new Request("http://devo.test/webhooks/old-secret", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        })
      } as Parameters<typeof modules.webhookRoute.POST>[0]);
    } catch (error) {
      oldSecretStatus = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    }

    expect(oldSecretStatus).toBe(404);
  });
});
