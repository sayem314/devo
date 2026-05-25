import { enqueueTaskRun } from "../runtime/runner";
import { appEnv } from "../config/env";
import { listScheduledTasks, updateTaskSchedule } from "../tasks/store";
import type { DevoTask } from "../types";

const nicknames: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *"
};
const monthNames = new Map(
  ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((name, index) => [
    name,
    index + 1
  ])
);
const weekdayNames = new Map(
  [
    ["SUN", "SUNDAY"],
    ["MON", "MONDAY"],
    ["TUE", "TUESDAY"],
    ["WED", "WEDNESDAY"],
    ["THU", "THURSDAY"],
    ["FRI", "FRIDAY"],
    ["SAT", "SATURDAY"]
  ].flatMap(([shortName, fullName], index) => [
    [shortName, index],
    [fullName, index]
  ])
);
const interval_ms = appEnv.DEVO_SCHEDULER_INTERVAL_MS;
const now = () => new Date();

let started = false;
let ticking = false;
let last_tick_at: string | undefined;
let last_error: string | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
const timezoneFormatters = new Map<string, Intl.DateTimeFormat>();

function normalizeCronExpression(expression: string) {
  const normalized = expression.trim();
  return nicknames[normalized.toLowerCase()] || normalized;
}

function fieldValue(value: string, names?: Map<string, number>) {
  const named = names?.get(value.toUpperCase());
  const parsed = named ?? Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Invalid cron field value "${value}".`);
  return parsed;
}

function parseField(
  field: string,
  min: number,
  max: number,
  names?: Map<string, number>,
  normalize?: (value: number) => number
) {
  const values = new Set<number>();

  for (const item of field.split(",")) {
    const [range, stepValue] = item.split("/");
    const step = stepValue ? Number(stepValue) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step "${item}".`);

    let start: number;
    let end: number;
    if (range === "*") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      const [from, to] = range.split("-");
      start = fieldValue(from, names);
      end = fieldValue(to, names);
    } else {
      start = fieldValue(range, names);
      end = start;
    }

    if (start < min || end > max || start > end) throw new Error(`Cron field "${item}" is out of range.`);

    for (let value = start; value <= end; value += step) {
      values.add(normalize ? normalize(value) : value);
    }
  }

  return values;
}

function parseCron(expression: string) {
  const parts = normalizeCronExpression(expression).split(/\s+/);
  if (parts.length !== 5) throw new Error("Cron expression must use 5 fields: minute hour day month weekday.");

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    day: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12, monthNames),
    weekday: parseField(parts[4], 0, 7, weekdayNames, (value) => (value === 7 ? 0 : value)),
    dayIsAny: parts[2] === "*",
    weekdayIsAny: parts[4] === "*"
  };
}

function timezoneFormatter(timezone: string) {
  const key = timezone.trim() || "UTC";
  const cached = timezoneFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: key,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  timezoneFormatters.set(key, formatter);
  return formatter;
}

function zonedParts(date: Date, timezone: string) {
  const values = Object.fromEntries(
    timezoneFormatter(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  const year = values.year;
  const month = values.month;
  const day = values.day;

  return {
    minute: values.minute,
    hour: values.hour,
    day,
    month,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  };
}

function dayMatches(cron: ReturnType<typeof parseCron>, parts: ReturnType<typeof zonedParts>) {
  if (cron.dayIsAny && cron.weekdayIsAny) return true;
  if (cron.dayIsAny) return cron.weekday.has(parts.weekday);
  if (cron.weekdayIsAny) return cron.day.has(parts.day);
  return cron.day.has(parts.day) || cron.weekday.has(parts.weekday);
}

export function parseNextCron(expression: string, relativeDate: Date | number, timezone = "UTC") {
  const cron = parseCron(expression);
  const start = relativeDate instanceof Date ? relativeDate.getTime() : relativeDate;
  const limit = start + 8 * 366 * 24 * 60 * 60 * 1000;
  let cursor = Math.floor(start / 60000) * 60000 + 60000;

  // Scan minute-by-minute in the task timezone; schedules are low volume in the self-hosted MVP.
  while (cursor <= limit) {
    const candidate = new Date(cursor);
    const parts = zonedParts(candidate, timezone);

    if (
      cron.minute.has(parts.minute) &&
      cron.hour.has(parts.hour) &&
      cron.month.has(parts.month) &&
      dayMatches(cron, parts)
    ) {
      return candidate;
    }

    cursor += 60000;
  }

  return null;
}

function schedule_key(task: DevoTask) {
  if (task.trigger.type !== "cron") return "";
  return `${task.trigger.expression}|${task.trigger.timezone}`;
}

function parseNext(expression: string, relativeDate: Date | number, timezone: string) {
  const next = parseNextCron(expression, relativeDate, timezone);
  if (!next) throw new Error("Cron expression has no next run within the supported range.");
  return next;
}

async function persistNext(task: DevoTask, key: string, relativeDate: Date | number) {
  try {
    const next = parseNext(
      task.trigger.type === "cron" ? task.trigger.expression : "",
      relativeDate,
      task.trigger.type === "cron" ? task.trigger.timezone : "UTC"
    );
    await updateTaskSchedule(task.id, {
      schedule_key: key,
      next_scheduled_at: next.toISOString(),
      schedule_error: undefined
    });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse cron expression.";
    await updateTaskSchedule(task.id, {
      schedule_key: key,
      next_scheduled_at: undefined,
      schedule_error: message
    });
    return message;
  }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  last_tick_at = now().toISOString();

  try {
    const currentTime = now();
    const tasks = await listScheduledTasks();
    const errors: string[] = [];

    for (const task of tasks) {
      if (task.status !== "deployed" || task.trigger.type !== "cron") continue;

      const key = schedule_key(task);
      const next_scheduled_at =
        task.schedule_key === key && task.next_scheduled_at ? new Date(task.next_scheduled_at) : undefined;
      const hasValidNext = next_scheduled_at && !Number.isNaN(next_scheduled_at.getTime());

      if (!hasValidNext) {
        // Persist parse errors so the UI can show why a schedule is not running.
        const error = await persistNext(task, key, currentTime);
        if (error) errors.push(`${task.name}: ${error}`);
        continue;
      }

      if (next_scheduled_at.getTime() > currentTime.getTime()) continue;

      const scheduledAt = next_scheduled_at.toISOString();
      // Enqueue before advancing next_scheduled_at so a failed enqueue does not skip this occurrence.
      await enqueueTaskRun(task.id, {
        source: "cron-scheduler",
        scheduledAt,
        timezone: task.trigger.timezone,
        triggeredAt: currentTime.toISOString()
      });

      try {
        const next = parseNext(task.trigger.expression, new Date(currentTime.getTime() + 1000), task.trigger.timezone);
        await updateTaskSchedule(task.id, {
          schedule_key: key,
          last_scheduled_at: scheduledAt,
          next_scheduled_at: next.toISOString(),
          schedule_error: undefined
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to parse cron expression.";
        await updateTaskSchedule(task.id, {
          schedule_key: key,
          last_scheduled_at: scheduledAt,
          next_scheduled_at: undefined,
          schedule_error: message
        });
        errors.push(`${task.name}: ${message}`);
      }
    }

    last_error = errors[0];
  } catch (error) {
    last_error = error instanceof Error ? error.message : "Scheduler tick failed.";
  } finally {
    ticking = false;
  }
}

export function startScheduler() {
  if (started) return;
  started = true;

  void tick();
  timer = setInterval(() => void tick(), interval_ms);
  timer.unref?.();
}

export function schedulerSnapshot() {
  return {
    started,
    interval_ms,
    last_tick_at,
    last_error
  };
}
