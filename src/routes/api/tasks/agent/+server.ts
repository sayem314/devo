import { generateTaskEdit } from "$lib/server/ai/task-agent";
import { getAiSettings } from "$lib/server/settings/ai";
import { json, type RequestHandler } from "@sveltejs/kit";

const encoder = new TextEncoder();

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const task = body.task && typeof body.task === "object" ? (body.task as Record<string, unknown>) : {};
  const files = body.files && typeof body.files === "object" ? (body.files as Record<string, unknown>) : {};
  const ai = body.ai && typeof body.ai === "object" ? (body.ai as Record<string, unknown>) : {};
  const messages = Array.isArray(body.messages)
    ? body.messages
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item) => item?.role === "user" || item?.role === "agent")
        .map((item) => ({
          role: item!.role as "user" | "agent",
          text: typeof item!.text === "string" ? item!.text.slice(0, 2000) : ""
        }))
        .filter((item) => item.text.trim())
    : [];
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const trigger =
    task.trigger === "webhook" || task.trigger === "cron" || task.trigger === "manual" ? task.trigger : "manual";

  if (!message) {
    return json({ message: "Message is required" }, { status: 400 });
  }

  async function runAgent() {
    const ai_settings = await getAiSettings(locals.user!.id, {
      provider: ai.provider,
      model: ai.model
    });
    return generateTaskEdit(
      {
        message,
        mode: body.mode === "create" ? "create" : "edit",
        messages,
        task: {
          id: typeof task.id === "string" ? task.id : "",
          name: typeof task.name === "string" ? task.name : "",
          description: typeof task.description === "string" ? task.description : "",
          trigger,
          timezone: typeof task.timezone === "string" && task.timezone ? task.timezone : "UTC",
          webhook_path: typeof task.webhook_path === "string" ? task.webhook_path : ""
        },
        files: {
          code: typeof files.code === "string" ? files.code : "",
          env_text: typeof files.env_text === "string" ? files.env_text : "",
          package_json_text: typeof files.package_json_text === "string" ? files.package_json_text : ""
        }
      },
      ai_settings
    );
  }

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent("status", { message: "Contacting selected model..." });
          const result = await runAgent();
          sendEvent("status", { message: "Applying generated file edits..." });
          sendEvent("result", result);
        } catch (error) {
          sendEvent("error", {
            message: error instanceof Error ? error.message : "Agent failed to update task"
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      }
    });
  }

  try {
    const result = await runAgent();
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return json(
      { message: message || "Agent failed to update task" },
      { status: /required|configured|invalid|must/i.test(message) ? 400 : 500 }
    );
  }
};
