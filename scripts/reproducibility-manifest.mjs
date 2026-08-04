import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_NAME = "MANIFEST.sha256";
const EXCLUDED_FILES = new Set([
  MANIFEST_NAME,
  ".dev-launcher/target.json",
]);
const GENERATED_SEGMENTS = new Set([
  ".git",
  ".dev-launcher",
  ".codex-runtime",
  ".workbuddy",
  ".pytest_cache",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "test-results",
  "logs",
]);
const EXCLUDED_SUFFIXES = [
  ".pyc",
  ".pyo",
  ".log",
  ".sqlite",
  ".sqlite3",
  ".db",
  ".failed.partial",
];
const TEXT_EXTENSIONS = new Set([
  ".bat", ".cmd", ".css", ".csv", ".example", ".html", ".js", ".json",
  ".jsx", ".md", ".mjs", ".ps1", ".py", ".sh", ".sha256", ".sql",
  ".svg", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
]);
const TEXT_FILENAMES = new Set([
  ".editorconfig", ".gitattributes", ".gitignore", "LICENSE", "README",
]);

function isExcluded(file) {
  const normalized = file.split(path.sep).join("/");
  if (EXCLUDED_FILES.has(normalized)) return true;
  const segments = normalized.split("/");
  if (segments.some((segment) => GENERATED_SEGMENTS.has(segment) || segment.endsWith(".egg-info"))) return true;
  if (EXCLUDED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  if (/\.(zip|7z|tar|tgz|gz)$/i.test(normalized)) return true;
  return false;
}

async function filesystemFiles(directory = ROOT, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (isExcluded(relative)) continue;
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic link is not allowed in source manifest: ${relative}`);
    }
    if (entry.isDirectory()) {
      files.push(...await filesystemFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

async function trackedFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = output
      .split("\0")
      .filter(Boolean)
      .filter((file) => !isExcluded(file))
      .sort((left, right) => left.localeCompare(right, "en"));
    if (files.length > 0) return files;
  } catch {
    // A distributed source ZIP intentionally has no .git directory.
  }
  return filesystemFiles();
}

function assertSafeTrackedPaths(files) {
  const normalized = new Map();
  const violations = [];

  for (const file of files) {
    if (path.isAbsolute(file) || file.split("/").includes("..") || isExcluded(file)) {
      violations.push(`unsafe or generated path: ${file}`);
      continue;
    }
    const collisionKey = file.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = normalized.get(collisionKey);
    if (previous && previous !== file) {
      violations.push(`normalized path collision: ${previous} <> ${file}`);
    } else {
      normalized.set(collisionKey, file);
    }
  }

  if (violations.length > 0) throw new Error(violations.join("\n"));
}

async function readCanonicalContent(file) {
  const content = await readFile(path.join(ROOT, file));
  const basename = path.basename(file);
  if (!TEXT_FILENAMES.has(basename) && !TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) {
    return content;
  }
  return Buffer.from(content.toString("utf8").replace(/\r\n?/g, "\n"), "utf8");
}

async function buildManifest(files) {
  const lines = [];
  for (const file of files) {
    const content = await readCanonicalContent(file);
    const hash = createHash("sha256").update(content).digest("hex");
    lines.push(`${hash}  ${file}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseManifest(content) {
  const entries = content.trimEnd().split(/\r?\n/).filter(Boolean).map((line) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) throw new Error(`invalid manifest entry: ${line}`);
    const [, hash, file] = match;
    return { file, hash };
  });
  assertSafeTrackedPaths(entries.map(({ file }) => file));
  return entries;
}

async function main() {
  const mode = process.argv[2] ?? "write";
  const manifestPath = path.join(ROOT, MANIFEST_NAME);

  if (mode === "write") {
    const files = await trackedFiles();
    assertSafeTrackedPaths(files);
    await writeFile(manifestPath, await buildManifest(files), "utf8");
    process.stdout.write(`wrote ${MANIFEST_NAME} for ${files.length} source files\n`);
    return;
  }

  if (mode === "verify") {
    const actual = await readFile(manifestPath, "utf8");
    const entries = parseManifest(actual);
    const expectedFiles = await trackedFiles();
    const actualFiles = entries.map(({ file }) => file);
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      const missing = expectedFiles.filter((file) => !actualFiles.includes(file));
      const stale = actualFiles.filter((file) => !expectedFiles.includes(file));
      throw new Error(`manifest file set mismatch\nmissing=${missing.join(",") || "none"}\nstale=${stale.join(",") || "none"}`);
    }
    for (const { file, hash } of entries) {
      const content = await readCanonicalContent(file);
      const actualHash = createHash("sha256").update(content).digest("hex");
      if (actualHash !== hash) throw new Error(`hash mismatch: ${file}`);
    }
    process.stdout.write(`verified ${MANIFEST_NAME} for ${entries.length} source files\n`);
    return;
  }

  throw new Error(`unknown mode: ${mode}`);
}

await main();
