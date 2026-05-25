import { randomBytes } from "node:crypto";
import type { TriggerConfig, TriggerType } from "../types";

export const DEFAULT_CRON_EXPRESSION = "0 9 * * *";
export const DEFAULT_TIMEZONE = "UTC";
const WEBHOOK_PATH_PATTERN = /^\/webhooks\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function webhookSecretSlug() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function triggerType(trigger: TriggerConfig): TriggerType {
  return trigger.type;
}

export function normalizeWebhookPath(value: string | undefined, task_id: string) {
  const raw = value?.trim();
  if (!raw) return `/webhooks/${task_id}`;

  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) path = new URL(raw).pathname;
  } catch {}

  if (!path.startsWith("/")) path = path.startsWith("webhooks/") ? `/${path}` : `/webhooks/${path}`;
  if (!path.startsWith("/webhooks/")) path = `/webhooks/${path.replace(/^\/+/, "")}`;

  if (!WEBHOOK_PATH_PATTERN.test(path)) {
    throw new Error("Webhook path must be /webhooks/{slug} using letters, numbers, underscores, or hyphens.");
  }

  return path;
}

export function defaultTriggerConfig(
  type: TriggerType,
  task_id: string,
  value?: string,
  timezone = DEFAULT_TIMEZONE
): TriggerConfig {
  if (type === "webhook") {
    return {
      type,
      path: normalizeWebhookPath(value || webhookSecretSlug(), task_id)
    };
  }

  if (type === "cron") {
    return {
      type,
      expression: value?.trim() || DEFAULT_CRON_EXPRESSION,
      timezone: timezone.trim() || DEFAULT_TIMEZONE
    };
  }

  return { type };
}

export function normalizeTrigger(input: unknown, task_id: string, legacySchedule?: string): TriggerConfig {
  if (typeof input === "object" && input !== null && "type" in input) {
    const trigger = input as Partial<TriggerConfig> & { type?: unknown };

    if (trigger.type === "webhook") {
      const path = typeof trigger.path === "string" ? trigger.path : undefined;
      const generated = defaultTriggerConfig("webhook", task_id);
      return {
        type: "webhook",
        path: path
          ? normalizeWebhookPath(path, task_id)
          : generated.type === "webhook"
            ? generated.path
            : normalizeWebhookPath(undefined, task_id)
      };
    }

    if (trigger.type === "cron") {
      return {
        type: "cron",
        expression:
          typeof trigger.expression === "string" && trigger.expression
            ? trigger.expression
            : legacySchedule || DEFAULT_CRON_EXPRESSION,
        timezone: typeof trigger.timezone === "string" && trigger.timezone ? trigger.timezone : DEFAULT_TIMEZONE
      };
    }

    if (trigger.type === "manual") return { type: "manual" };
  }

  if (input === "webhook" || input === "cron" || input === "manual") {
    return defaultTriggerConfig(input, task_id, legacySchedule);
  }

  return { type: "manual" };
}

export function displayTrigger(trigger: TriggerConfig) {
  if (trigger.type === "webhook") return trigger.path;
  if (trigger.type === "cron") return trigger.expression;
  return "Manual";
}

export function handlerNameForTrigger(trigger: TriggerConfig) {
  if (trigger.type === "webhook") return "webhook";
  if (trigger.type === "cron") return "cron";
  return "run";
}
