type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[^"'();]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?(?:[^"']+?\s+from\s+)["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g
];

const builtinModules = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib"
]);

function packageNameFromSpecifier(specifier: string) {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("node:") ||
    specifier.startsWith("bun:") ||
    specifier.includes("://")
  ) {
    return undefined;
  }

  const [first, second] = specifier.split("/");
  const packageName = first.startsWith("@") && second ? `${first}/${second}` : first;
  if (builtinModules.has(packageName)) return undefined;
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) return undefined;
  return packageName;
}

export function detectPackageImports(source: string) {
  const packages = new Set<string>();
  const searchableSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(searchableSource))) {
      const packageName = packageNameFromSpecifier(match[1]);
      if (packageName) packages.add(packageName);
    }
  }

  return Array.from(packages).sort();
}

export function dependencyNamesFromPackageJson(package_json: string) {
  const parsed = JSON.parse(package_json) as PackageJsonLike;
  return new Set([
    ...Object.keys(parsed.dependencies || {}),
    ...Object.keys(parsed.devDependencies || {}),
    ...Object.keys(parsed.optionalDependencies || {})
  ]);
}

export function missingPackageImports(source: string, package_json: string) {
  try {
    const existing = dependencyNamesFromPackageJson(package_json);
    return detectPackageImports(source).filter((packageName) => !existing.has(packageName));
  } catch {
    return [];
  }
}
