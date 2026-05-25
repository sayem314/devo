export type EditorFile = "env" | "package";

export type ValidationIssue = {
  file: EditorFile;
  line: number;
  column: number;
  message: string;
  severity?: "error" | "warning";
};

const CRON_NICKNAMES = new Set(["@yearly", "@annually", "@monthly", "@weekly", "@daily", "@midnight", "@hourly"]);

function positionToLineColumn(source: string, position: number) {
  const before = source.slice(0, Math.max(0, position));
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function parseErrorLocation(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (positionMatch) return positionToLineColumn(source, Number(positionMatch[1]));
  const lineColumnMatch = message.match(/line\s+(\d+).*column\s+(\d+)|at\s+(\d+):(\d+)/i);
  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1] || lineColumnMatch[3]),
      column: Number(lineColumnMatch[2] || lineColumnMatch[4])
    };
  }
  return { line: 1, column: 1 };
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function validateCronExpression(expression: string) {
  const trimmed = expression.trim();
  const nickname = trimmed.startsWith("@");
  if (!trimmed) throw new Error("Cron expression is required.");
  if (nickname && !CRON_NICKNAMES.has(trimmed)) {
    throw new Error("Cron nickname must be one of @hourly, @daily, @weekly, @monthly, or @yearly.");
  }
  if (!nickname && trimmed.split(/\s+/).length !== 5) {
    throw new Error("Cron expression must have 5 fields: minute hour day month weekday.");
  }
}

function validateEnvFile(env_text: string) {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();

  env_text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");
    if (separatorIndex <= 0) {
      issues.push({ file: "env", line: lineNumber, column: 1, message: "Expected KEY=value." });
      return;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();
    const value = withoutExport.slice(separatorIndex + 1).trim();
    const column = Math.max(1, line.indexOf(key) + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      issues.push({
        file: "env",
        line: lineNumber,
        column,
        message: "Environment variable names must match [A-Za-z_][A-Za-z0-9_]*."
      });
      return;
    }

    if ((value.startsWith('"') && !value.endsWith('"')) || (value.startsWith("'") && !value.endsWith("'"))) {
      issues.push({
        file: "env",
        line: lineNumber,
        column: Math.max(1, line.indexOf(value) + 1),
        message: "Quoted env values must close on the same line."
      });
    }

    const firstLine = seen.get(key);
    if (firstLine) {
      issues.push({
        file: "env",
        line: lineNumber,
        column,
        message: `Duplicate variable ${key}. First defined on line ${firstLine}.`
      });
    } else {
      seen.set(key, lineNumber);
    }
  });

  return issues;
}

function validatePackageFile(package_json_text: string) {
  const issues: ValidationIssue[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(package_json_text) as unknown;
  } catch (error) {
    const location = parseErrorLocation(package_json_text, error);
    return [
      {
        file: "package" as const,
        ...location,
        message: error instanceof Error ? error.message : "Invalid package.json"
      }
    ];
  }

  const package_json = objectValue(parsed);
  if (!package_json)
    return [{ file: "package" as const, line: 1, column: 1, message: "package.json must be an object." }];
  if (package_json.type && package_json.type !== "module") {
    issues.push({ file: "package", line: 1, column: 1, message: 'package.json type must be "module".' });
  }

  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    if (!(field in package_json)) continue;
    const dependencies = objectValue(package_json[field]);
    if (!dependencies) {
      issues.push({ file: "package", line: 1, column: 1, message: `${field} must be an object.` });
      continue;
    }
    for (const [name, version] of Object.entries(dependencies)) {
      if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) {
        issues.push({ file: "package", line: 1, column: 1, message: `Invalid package name "${name}" in ${field}.` });
      }
      if (typeof version !== "string") {
        issues.push({ file: "package", line: 1, column: 1, message: `${field}.${name} must use a string version.` });
      }
    }
  }

  return issues;
}

export function validatePackageJson(value: string) {
  return validatePackageFile(value)[0]?.message;
}

export function validateEditorFiles(input: { env_text: string; package_json_text: string }) {
  return [...validateEnvFile(input.env_text), ...validatePackageFile(input.package_json_text)];
}

export function fileLabel(file: EditorFile) {
  return file === "env" ? ".env" : "package.json";
}
