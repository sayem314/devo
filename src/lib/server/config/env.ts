import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Task child processes get only this allowlist plus per-task env vars, not the full server environment.
const HOST_ENV_ALLOWLIST = [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SystemRoot",
  "ComSpec",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "BUN_INSTALL",
  "BUN_INSTALL_CACHE_DIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME"
];

const numericEnv = (schema: z.ZodNumber, fallback: number) =>
  z
    .preprocess((value) => (value === "" || value === undefined ? undefined : value), z.coerce.number().pipe(schema))
    .default(fallback);

function parseDotenvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return undefined;

  const source = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
  const separatorIndex = source.indexOf("=");
  if (separatorIndex <= 0) return undefined;

  const key = source.slice(0, separatorIndex).trim();
  let value = source.slice(separatorIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return undefined;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadDotenv() {
  let source: string;
  try {
    source = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/)) {
    const parsed = parseDotenvLine(line);
    // Real process env wins over .env so deployment-provided secrets are not shadowed by local files.
    if (parsed && process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

const envSchema = z.object({
  AUTH_SECRET: z.string().trim().min(16, "AUTH_SECRET must be at least 16 characters."),
  SITE_URL: z.url("SITE_URL must be a valid URL.").trim(),
  DEVO_DATA_DIR: z.string().trim().min(1).default(".devo"),
  DEVO_TASK_RUNTIME: z.enum(["auto", "bun", "node"]).default("auto"),
  DEVO_WORKERS: numericEnv(z.number().int().positive(), 2),
  DEVO_TASK_TIMEOUT_MS: numericEnv(z.number().int().positive(), 30000),
  DEVO_TASK_MAX_OUTPUT_BYTES: numericEnv(z.number().int().positive(), 1024 * 1024),
  DEVO_TASK_MAX_LOG_LINE_BYTES: numericEnv(z.number().int().positive(), 16 * 1024),
  DEVO_TERMINAL_TIMEOUT_MS: numericEnv(z.number().int().positive(), 120000),
  DEVO_SCHEDULER_INTERVAL_MS: numericEnv(z.number().int().positive(), 15000),
  DEVO_RUN_RETENTION_DAYS: numericEnv(z.number().int().min(0), 30),
  DEVO_MAX_RUNS_PER_TASK: numericEnv(z.number().int().min(0), 100)
});

function buildTimeDefaults() {
  if (process.env.npm_lifecycle_event !== "build") return {};

  return {
    AUTH_SECRET: "devo-build-time-placeholder-secret",
    SITE_URL: "http://127.0.0.1:5173"
  };
}

function parseAppEnv() {
  loadDotenv();
  const result = envSchema.safeParse({ ...buildTimeDefaults(), ...process.env });
  if (result.success) return result.data;

  const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid Devo environment: ${message}`);
}

export const appEnv = parseAppEnv();

export function hostRuntimeEnv() {
  const env: Record<string, string> = {};

  for (const key of HOST_ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }

  return env;
}
