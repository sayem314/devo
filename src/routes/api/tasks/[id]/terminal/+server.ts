import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { error } from "@sveltejs/kit";
import { appEnv, hostRuntimeEnv } from "$lib/server/config/env";
import { taskEnvMap } from "$lib/server/tasks/env-file";
import { paths } from "$lib/server/tasks/files";
import { getTask } from "$lib/server/tasks/store";
import type { RequestHandler } from "./$types";

const encoder = new TextEncoder();

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const task = await getTask(params.id, locals.user!.id);
  if (!task) throw error(404, "Task not found");

  const body = (await request.json().catch(() => ({}))) as { command?: unknown };
  const line = typeof body.command === "string" ? body.command.trim() : "";
  if (!line) throw error(400, "Command is required");

  const taskDir = paths.taskDir(task.id);
  const shell =
    process.platform === "win32"
      ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", line] }
      : { command: process.env.SHELL || "/bin/sh", args: ["-lc", line] };

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (value: string) => {
          controller.enqueue(encoder.encode(value));
        };

        write(`$ ${line}\n`);

        const child = spawn(shell.command, shell.args, {
          cwd: taskDir,
          env: {
            ...hostRuntimeEnv(),
            ...taskEnvMap(task),
            DEVO_TASK_ID: task.id,
            DEVO_TASK_DIR: taskDir
          },
          stdio: ["ignore", "pipe", "pipe"]
        });

        let outputBytes = 0;
        let closed = false;
        const timeout = setTimeout(() => {
          write(`\nCommand timed out after ${appEnv.DEVO_TERMINAL_TIMEOUT_MS}ms; killing process.\n`);
          child.kill("SIGKILL");
        }, appEnv.DEVO_TERMINAL_TIMEOUT_MS);

        const close = () => {
          if (closed) return;
          closed = true;
          clearTimeout(timeout);
          controller.close();
        };

        const writeChunk = (chunk: Buffer | string) => {
          const bytes = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
          outputBytes += bytes;
          if (outputBytes > appEnv.DEVO_TASK_MAX_OUTPUT_BYTES) {
            write(`\nOutput exceeded ${appEnv.DEVO_TASK_MAX_OUTPUT_BYTES} bytes; killing process.\n`);
            child.kill("SIGKILL");
            return;
          }
          controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
        };

        child.stdout?.on("data", writeChunk);
        child.stderr?.on("data", writeChunk);
        child.once("error", (terminalError) => {
          write(`\n${terminalError.message}\n`);
          close();
        });
        child.once("exit", (code, signal) => {
          const exitMessage = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
          write(`\nProcess exited with ${exitMessage}.\n`);
          close();
        });

        request.signal.addEventListener("abort", () => {
          child.kill("SIGKILL");
          close();
        });
      }
    }),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
};
