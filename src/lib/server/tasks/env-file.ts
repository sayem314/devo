import type { DevoEnvVar, DevoTask } from "../types";

export function normalizeEnv(input: unknown): DevoEnvVar[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const env: DevoEnvVar[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { name?: unknown; value?: unknown };
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    env.push({
      name,
      value: typeof entry.value === "string" ? entry.value : String(entry.value ?? "")
    });
  }

  return env;
}

export function formatEnv(env: DevoEnvVar[]) {
  return env.map((entry) => `${entry.name}=${entry.value}`).join("\n");
}

export function parseEnvText(source: string) {
  const env: DevoEnvVar[] = [];
  const seen = new Set<string>();

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = withoutExport.slice(0, separatorIndex).trim();
    let value = withoutExport.slice(separatorIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || seen.has(name)) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    seen.add(name);
    env.push({ name, value });
  }

  return env;
}

export function taskEnvMap(task: DevoTask) {
  return Object.fromEntries(task.env.map((env) => [env.name, env.value]));
}
