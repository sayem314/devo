import { Agent, OpenAIProvider, Runner, setTracingDisabled, type AgentInputItem } from "@openai/agents";
import { z } from "zod";
import type { AiSettings } from "../settings/ai";
import { providerConfig } from "../settings/ai-providers";
import type { AiProvider, TriggerType } from "../types";

type AgentFiles = {
  code: string;
  env_text: string;
  package_json_text: string;
};

type AgentMessage = {
  role: "user" | "agent";
  text: string;
};

export type TaskAgentInput = {
  message: string;
  mode: "create" | "edit";
  messages?: AgentMessage[];
  task: {
    id: string;
    name: string;
    description: string;
    trigger: TriggerType;
    timezone: string;
    webhook_path: string;
  };
  files: AgentFiles;
};

export type TaskAgentResult = {
  message: string;
  provider: AiProvider;
  files: AgentFiles;
};

const AgentResultSchema = z.object({
  message: z.string().min(1),
  files: z.object({
    code: z.string().min(1),
    env_text: z.string(),
    package_json_text: z.string().min(1)
  })
});

const RECENT_CHAT_MESSAGE_LIMIT = 6;
const MAX_CHAT_MESSAGE_CHARS = 2000;

setTracingDisabled(true);

const SYSTEM_PROMPT = `You are Devo's precise TypeScript task coding agent.

Devo task model:
- A task is one executable TypeScript module: main.ts.
- All task logic must stay in main.ts. Do not create, mention, or depend on extra local source files.
- The only editable file outputs are main.ts, .env, and package.json.
- Task name, description, trigger type, cron schedule, timezone, and webhook URL are edited in the Devo UI, not in files.
- Devo runs the task as a separate local child process from the task directory.
- Runtime is configured by the Devo server and may be Bun or Node.

Handler contract:
- Manual tasks export run(payload, ctx).
- Cron tasks export cron(ctx).
- Webhook tasks export webhook(req: Request, ctx).
- Match the current task trigger exactly: webhook exports webhook, cron exports cron, manual exports run.
- Webhook handlers receive a standard Request. Use req.text() for raw body or req.json() for JSON.
- ctx contains run_id, task_id, and trigger.

File rules:
- Return all editable files every time, even unchanged ones.
- main.ts must be complete and self-contained.
- .env must contain only KEY=value placeholders for secrets/config, comments, and blank lines.
- Access task env values with process.env.KEY.
- package.json must be valid JSON and include "type": "module".
- If dependencies are required, add them to package.json dependencies.

Code rules:
- Do not invent Devo.* globals.
- Prefer standard TypeScript, Web, and Node APIs. Use Bun-only APIs only when the user explicitly asks for them.
- Use console.log/console.error for run logs.
- Return JSON-serializable values from handlers when possible.
- Keep generated code practical, readable, and concise.
- Avoid tiny pass-through functions and one-use wrappers. Inline simple expressions and single-call helpers unless a helper is reused or clearly improves parsing, validation, error handling, or domain clarity.
- The response message should briefly summarize what changed and mention any required env vars or dependencies.`;

const JSON_TEXT_OUTPUT_PROMPT = `${SYSTEM_PROMPT}

Output rules:
- Return only valid JSON. Do not wrap it in markdown.
- The JSON must have this exact shape:
{
  "message": "brief summary",
  "files": {
    "code": "complete main.ts source",
    "env_text": "complete .env source",
    "package_json_text": "complete package.json source"
  }
}`;

function validateGeneratedFiles(files: AgentFiles) {
  try {
    const package_json = JSON.parse(files.package_json_text) as unknown;
    if (!package_json || typeof package_json !== "object" || Array.isArray(package_json)) {
      throw new Error("package.json must contain an object.");
    }
    if ("type" in package_json && (package_json as { type?: unknown }).type !== "module") {
      throw new Error('package.json type must be "module".');
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`package.json is invalid: ${error.message}`);
    throw error;
  }

  for (const [index, line] of files.env_text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");
    if (separatorIndex <= 0) throw new Error(`.env line ${index + 1} must use KEY=value.`);
    const key = withoutExport.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`.env line ${index + 1} has an invalid variable name.`);
    }
  }
}

function assertAiSettings(settings: AiSettings) {
  const config = providerConfig(settings.provider);
  const model = settings.model || config.default_model;
  const base_url = settings.base_url || config.default_base_url;

  if (!settings.api_key) {
    throw new Error("AI provider API key is not configured.");
  }

  if (!model) {
    throw new Error("AI provider model is not configured.");
  }

  if (settings.provider === "openai-compatible" && !base_url) {
    throw new Error("Custom OpenAI-compatible provider base URL is not configured.");
  }

  return { model, base_url };
}

function trimChatText(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHAT_MESSAGE_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_CHAT_MESSAGE_CHARS)}\n[message truncated]`;
}

function recentAgentMessages(messages: AgentMessage[] | undefined, currentMessage: string): AgentInputItem[] {
  const normalized = (messages || [])
    .map((message) => ({
      role: message.role,
      text: trimChatText(message.text)
    }))
    .filter((message) => message.text);

  const last = normalized.at(-1);
  if (last?.role === "user" && last.text === trimChatText(currentMessage)) {
    normalized.pop();
  }

  return normalized.slice(-RECENT_CHAT_MESSAGE_LIMIT).map((message) =>
    message.role === "agent"
      ? {
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: message.text }]
        }
      : {
          role: "user",
          content: message.text
        }
  );
}

function buildPrompt(input: TaskAgentInput) {
  return `Update this Devo task from the user's request.

Mode: ${input.mode}

Current task:
${JSON.stringify(input.task, null, 2)}

Current files:
${JSON.stringify(input.files, null, 2)}

User request:
${input.message}`;
}

function parseTextAgentOutput(output: string) {
  const trimmed = output.trim();
  const json = trimmed.startsWith("```")
    ? trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    : trimmed;

  try {
    return AgentResultSchema.parse(JSON.parse(json));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`AI provider returned invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

export async function generateTaskEdit(input: TaskAgentInput, settings: AiSettings): Promise<TaskAgentResult> {
  const { model, base_url } = assertAiSettings(settings);
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      apiKey: settings.api_key,
      baseURL: base_url,
      useResponses: false
    })
  });
  const inputItems: AgentInputItem[] = [
    ...recentAgentMessages(input.messages, input.message),
    { role: "user", content: buildPrompt(input) }
  ];
  const modelSettings = {
    temperature: 0.2,
    maxTokens: 5000
  };

  // Some OpenAI-compatible providers reject structured response_format, so use strict JSON text there.
  const parsed =
    settings.provider === "openai"
      ? AgentResultSchema.parse(
          (
            await runner.run(
              new Agent({
                name: "Devo task coding agent",
                instructions: SYSTEM_PROMPT,
                model,
                modelSettings,
                outputType: AgentResultSchema
              }),
              inputItems,
              { maxTurns: 4 }
            )
          ).finalOutput
        )
      : parseTextAgentOutput(
          (
            (
              await runner.run(
                new Agent({
                  name: "Devo task coding agent",
                  instructions: JSON_TEXT_OUTPUT_PROMPT,
                  model,
                  modelSettings
                }),
                inputItems,
                { maxTurns: 4 }
              )
            ).finalOutput || ""
          ).trim()
        );

  const files = {
    code: parsed.files.code.trim(),
    env_text: parsed.files.env_text,
    package_json_text: parsed.files.package_json_text.trim()
  };

  validateGeneratedFiles(files);

  return {
    provider: settings.provider,
    message: parsed.message,
    files
  };
}
