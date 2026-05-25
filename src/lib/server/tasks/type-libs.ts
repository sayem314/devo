import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { paths } from "./files";
import { getTask } from "./store";

type PackageJson = {
  name?: string;
  types?: string;
  typings?: string;
  main?: string;
  module?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export type TaskTypeLib = {
  path: string;
  content: string;
};

const maxFilesPerPackage = 160;
const maxFileBytes = 512 * 1024;
const maxPackages = 32;
const maxTotalBytes = 2 * 1024 * 1024;
const importPattern = /(?:from\s+|import\s*\(\s*|import\s+type\s*\(\s*|path\s*=\s*)["']([^"']+)["']/g;
const tripleSlashPattern = /\/\/\/\s*<reference\s+path=["']([^"']+)["']/g;

type CollectionBudget = {
  totalBytes: number;
  truncated: boolean;
};

async function readText(file: string) {
  try {
    const info = await stat(file);
    if (info.size > maxFileBytes) return undefined;
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

async function readJson<T>(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function fileExists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function dependencyNames(package_json: string) {
  try {
    const parsed = JSON.parse(package_json) as PackageJson;
    return Array.from(
      new Set([
        ...Object.keys(parsed.dependencies || {}),
        ...Object.keys(parsed.devDependencies || {}),
        ...Object.keys(parsed.optionalDependencies || {})
      ])
    ).sort();
  } catch {
    return [];
  }
}

function packageNameFromSpecifier(specifier: string) {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("node:") ||
    specifier.startsWith("bun:")
  ) {
    return undefined;
  }

  const [first, second] = specifier.split("/");
  if (!first) return undefined;
  return first.startsWith("@") && second ? `${first}/${second}` : first;
}

function packagePath(taskDir: string, packageName: string) {
  return path.join(taskDir, "node_modules", ...packageName.split("/"));
}

function typeEntry(package_json: PackageJson) {
  return package_json.types || package_json.typings || package_json.main || package_json.module || "index.d.ts";
}

function declarationCandidates(file: string) {
  const ext = path.extname(file);
  const withoutExt = ext ? file.slice(0, -ext.length) : file;

  if (file.endsWith(".d.ts") || file.endsWith(".d.mts") || file.endsWith(".d.cts")) return [file];
  if (
    file.endsWith(".js") ||
    file.endsWith(".mjs") ||
    file.endsWith(".cjs") ||
    file.endsWith(".ts") ||
    file.endsWith(".mts") ||
    file.endsWith(".cts")
  ) {
    return [`${withoutExt}.d.ts`, `${withoutExt}.d.mts`, `${withoutExt}.d.cts`];
  }

  return [
    file,
    `${file}.d.ts`,
    `${file}.d.mts`,
    `${file}.d.cts`,
    path.join(file, "index.d.ts"),
    path.join(file, "index.d.mts"),
    path.join(file, "index.d.cts")
  ];
}

async function resolveDeclaration(fromFile: string, specifier: string) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of declarationCandidates(base)) {
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
}

function referencedSpecifiers(source: string) {
  const refs = new Set<string>();

  for (const pattern of [importPattern, tripleSlashPattern]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      refs.add(match[1]);
    }
  }

  return refs;
}

function libPath(taskDir: string, file: string) {
  const relative = path.relative(taskDir, file).split(path.sep).join("/");
  return `file:///${relative}`;
}

function moduleSpecifierForDeclaration(root: string, file: string) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  return `./${relative.replace(/\.d\.(ts|mts|cts)$/, "")}`;
}

function addLib(libs: TaskTypeLib[], budget: CollectionBudget, lib: TaskTypeLib) {
  const bytes = new TextEncoder().encode(lib.content).byteLength;
  if (budget.totalBytes + bytes > maxTotalBytes) {
    budget.truncated = true;
    return false;
  }

  budget.totalBytes += bytes;
  libs.push(lib);
  return true;
}

async function collectPackageTypes(
  taskDir: string,
  packageName: string,
  budget: CollectionBudget
): Promise<{ libs: TaskTypeLib[]; referencedPackages: string[] }> {
  const root = packagePath(taskDir, packageName);
  const manifest = await readJson<PackageJson>(path.join(root, "package.json"));

  if (!manifest) return { libs: [], referencedPackages: [] };

  const entry = await resolveDeclaration(path.join(root, "package.json"), `./${typeEntry(manifest)}`);
  if (!entry) return { libs: [], referencedPackages: [] };

  const queue = [entry];
  const seen = new Set<string>();
  const referencedPackages = new Set<string>();
  const libs: TaskTypeLib[] = [];
  const rootIndex = path.join(root, "index.d.ts");
  if (entry !== rootIndex) {
    addLib(libs, budget, {
      path: libPath(taskDir, rootIndex),
      content: `export * from ${JSON.stringify(moduleSpecifierForDeclaration(root, entry))};\nexport { default } from ${JSON.stringify(moduleSpecifierForDeclaration(root, entry))};\n`
    });
  }

  while (queue.length > 0 && seen.size < maxFilesPerPackage) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    const content = await readText(file);
    if (!content) continue;

    if (!addLib(libs, budget, { path: libPath(taskDir, file), content })) break;

    for (const specifier of referencedSpecifiers(content)) {
      if (specifier.startsWith(".")) {
        const resolved = await resolveDeclaration(file, specifier);
        if (resolved && !seen.has(resolved)) queue.push(resolved);
      } else {
        const referencedPackage = packageNameFromSpecifier(specifier);
        if (referencedPackage && referencedPackage !== packageName) referencedPackages.add(referencedPackage);
      }
    }
  }

  if (seen.size >= maxFilesPerPackage) budget.truncated = true;
  return { libs, referencedPackages: Array.from(referencedPackages).sort() };
}

export async function taskTypeLibs(task_id: string, owner_id: string) {
  const task = await getTask(task_id, owner_id);
  if (!task) return undefined;

  const taskDir = paths.taskDir(task_id);
  const pending = dependencyNames(task.package_json).filter((name) => packageNameFromSpecifier(name) === name);
  const packages: string[] = [];
  const seen = new Set<string>();
  const libs: TaskTypeLib[] = [];
  const budget: CollectionBudget = { totalBytes: 0, truncated: false };

  while (pending.length > 0 && packages.length < maxPackages && !budget.truncated) {
    const packageName = pending.shift();
    if (!packageName || seen.has(packageName)) continue;
    seen.add(packageName);
    packages.push(packageName);

    const result = await collectPackageTypes(taskDir, packageName, budget);
    libs.push(...result.libs);
    for (const referencedPackage of result.referencedPackages) {
      if (!seen.has(referencedPackage)) pending.push(referencedPackage);
    }
  }

  if (pending.length > 0) budget.truncated = true;

  return {
    packages,
    libs,
    truncated: budget.truncated
  };
}
