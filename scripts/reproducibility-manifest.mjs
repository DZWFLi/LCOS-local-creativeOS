import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_NAME = "MANIFEST.sha256";
const EXCLUDED = new Set([MANIFEST_NAME]);
const GENERATED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".pytest_cache",
  "__pycache__",
]);
const TEXT_EXTENSIONS = new Set([
  ".bat", ".cmd", ".css", ".csv", ".html", ".js", ".json", ".jsx",
  ".md", ".mjs", ".ps1", ".sh", ".sql", ".svg", ".toml", ".ts",
  ".tsx", ".txt", ".xml", ".yaml", ".yml",
]);
const TEXT_FILENAMES = new Set([
  ".editorconfig", ".gitattributes", ".gitignore", "LICENSE", "README",
]);

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter(Boolean)
    .filter((file) => !EXCLUDED.has(file))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function assertSafeTrackedPaths(files) {
  const normalized = new Map();
  const violations = [];

  for (const file of files) {
    const segments = file.split("/");
    if (
      segments.some((segment) => GENERATED_SEGMENTS.has(segment)) ||
      file.endsWith(".pyc") ||
      segments.some((segment) => segment.endsWith(".egg-info"))
    ) {
      violations.push(`generated artifact is tracked: ${file}`);
    }

    const collisionKey = file.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = normalized.get(collisionKey);
    if (previous && previous !== file) {
      violations.push(`normalized path collision: ${previous} <> ${file}`);
    } else {
      normalized.set(collisionKey, file);
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }
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
    if (!match) {
      throw new Error(`invalid manifest entry: ${line}`);
    }
    const [, hash, file] = match;
    if (path.isAbsolute(file) || file.split("/").includes("..")) {
      throw new Error(`unsafe manifest path: ${file}`);
    }
    return { file, hash };
  });
  assertSafeTrackedPaths(entries.map(({ file }) => file));
  return entries;
}

async function main() {
  const mode = process.argv[2] ?? "write";
  const manifestPath = path.join(ROOT, MANIFEST_NAME);

  if (mode === "write") {
    const files = trackedFiles();
    assertSafeTrackedPaths(files);
    const expected = await buildManifest(files);
    await writeFile(manifestPath, expected, "utf8");
    process.stdout.write(`wrote ${MANIFEST_NAME} for ${files.length} tracked files\n`);
    return;
  }

  if (mode === "verify") {
    const actual = await readFile(manifestPath, "utf8");
    const entries = parseManifest(actual);
    for (const { file, hash } of entries) {
      const content = await readCanonicalContent(file);
      const actualHash = createHash("sha256").update(content).digest("hex");
      if (actualHash !== hash) {
        throw new Error(`hash mismatch: ${file}`);
      }
    }
    process.stdout.write(`verified ${MANIFEST_NAME} for ${entries.length} files\n`);
    return;
  }

  throw new Error(`unknown mode: ${mode}`);
}

await main();
