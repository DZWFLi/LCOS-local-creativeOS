#!/usr/bin/env node
import { readFile, readdir, lstat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { bridgeRequest, coreRequest, jsonBody } from "./lib/client.mjs";

const [group = "help", action, ...rest] = process.argv.slice(2);
const option = (name) => {
  const index = rest.indexOf(`--${name}`);
  return index < 0 ? undefined : rest[index + 1];
};
const positional = rest.filter((value, index) => !value.startsWith("--") && !rest[index - 1]?.startsWith("--"));

try {
  let result;
  if (group === "project" && action === "list") {
    result = await coreRequest("/projects");
  } else if (group === "project" && action === "show") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/graph`);
  } else if (group === "context" && action === "get") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/active-context`);
  } else if (group === "manifest" && action === "build") {
    const projectId = required(positional[0], "project id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/context-manifests/v0`, {
      method: "POST",
      ...jsonBody({
        ...(option("target") ? { targetArtifactId: option("target") } : {}),
        contextArtifactIds: (active.contextArtifacts || active.selectedArtifacts || []).map((item) => item.artifactId),
        ...(option("output") ? { requestedOutput: option("output") } : {}),
      }),
    });
  } else if (group === "run" && action === "list") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/runs?limit=${encodeURIComponent(option("limit") || "20")}`);
  } else if (group === "run" && action === "show") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/review`);
  } else if (group === "run" && action === "sync") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/sync`, { method: "POST", ...jsonBody({}) });
  } else if (group === "resource" && action === "list") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/resources`);
  } else if (group === "resource" && action === "show") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/resources/${encodeURIComponent(required(positional[1], "resource id"))}`);
  } else if (group === "resource" && action === "read") {
    const projectId = required(positional[0], "project id");
    const resourceId = required(positional[1], "resource id");
    const query = new URLSearchParams();
    if (option("path")) query.set("path", option("path"));
    if (option("offset")) query.set("offset", option("offset"));
    if (option("limit")) query.set("limit", option("limit"));
    if (option("format")) query.set("format", option("format"));
    const suffix = query.size === 0 ? "" : `?${query.toString()}`;
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/content${suffix}`);
  } else if (group === "resource" && action === "reanalyze") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/resources/${encodeURIComponent(required(positional[1], "resource id"))}/reanalyze`, { method: "POST" });
  } else if (group === "resource" && action === "match") {
    const projectId = required(positional[0], "project id");
    const instruction = required(option("instruction"), "--instruction");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resources/match`, {
      method: "POST",
      ...jsonBody({
        instruction,
        ...(option("output") ? { outputIntent: option("output") } : {}),
        ...(option("limit") ? { limit: Number(option("limit")) } : {}),
      }),
    });
  } else if (group === "resource" && action === "import") {
    const projectId = required(positional[0], "project id");
    const source = required(positional[1], "path or url");
    const graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`);
    const scopes = graph?.scopes || [];
    const scopeId = scopes.find((scope) => scope.kind === "root")?.id || scopes[0]?.id || "";
    const importRequestId = `cli-${Date.now().toString(36)}`;
    const fallbackName = source.split(/[\\/]/).filter(Boolean).pop() || "resource";
    if (/^https?:\/\//i.test(source)) {
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resources/import-url`, {
        method: "POST",
        ...jsonBody({
          url: source,
          scopeId,
          ...(option("name") ? { title: option("name") } : {}),
        }),
      });
    } else if (/\.zip$/i.test(source)) {
      const bytes = await readFile(source);
      const form = new FormData();
      form.set("file", new Blob([bytes]), basename(source));
      form.set("importRequestId", importRequestId);
      form.set("scopeId", scopeId);
      form.set("position.x", option("x") || "180");
      form.set("position.y", option("y") || "160");
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resources/import-archive`, {
        method: "POST",
        body: form,
      });
    } else {
      const files = await collectDirectory(source);
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resources/import-directory`, {
        method: "POST",
        ...jsonBody({
          importRequestId,
          rootName: option("name") || fallbackName,
          scopeId,
          files,
        }),
      });
    }
  } else if (group === "task" && action === "claim") {
    result = await bridgeRequest("/v1/tasks/claim-next", {
      method: "POST",
      ...jsonBody({ provider: option("provider") || "workbuddy", workerId: option("worker") || "local-agent" }),
    });
  } else if (group === "task" && action === "start") {
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(positional[0], "task id"))}/running`, {
      method: "POST",
      ...jsonBody({ workerId: option("worker") || "local-agent" }),
    });
  } else if (group === "task" && action === "submit") {
    const taskId = required(positional[0], "task id");
    const resultPath = required(positional[1], "result envelope path");
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(taskId)}/result`, {
      method: "POST",
      ...jsonBody(JSON.parse(await readFile(resultPath, "utf8"))),
    });
  } else if (group === "task" && action === "show") {
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(positional[0], "task id"))}`);
  } else if (group === "open") {
    const projectId = action;
    result = { url: `http://127.0.0.1:5173/?agent=1${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}` };
  } else {
    printHelp();
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`lcos: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

async function collectDirectory(root) {
  const files = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= 200) return;
      const full = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await lstat(full);
      if (info.size > 10 * 1024 * 1024) continue;
      const bytes = await readFile(full);
      files.push({
        path: relative(root, full).split(sep).join("/"),
        content: bytes.toString("base64"),
      });
    }
  };
  await walk(root);
  return files;
}

function printHelp() {
  process.stdout.write(`LCOS Agent CLI

Project truth:
  lcos project list
  lcos project show <project-id>
  lcos context get <project-id>
  lcos manifest build <project-id> [--target <artifact-id>] [--output <description>]
  lcos run list <project-id> [--limit 20]
  lcos run show <run-id>
  lcos run sync <run-id>
  lcos resource list <project-id>
  lcos resource show <project-id> <resource-id>
  lcos resource read <project-id> <resource-id> [--path name] [--offset N] [--limit N] [--format text|raw|json_tree]
  lcos resource reanalyze <project-id> <resource-id>
  lcos resource import <project-id> <path-or-url> [--name rootName]
  lcos resource match <project-id> --instruction "..." [--output create|revise|analyze] [--limit 8]
  lcos open [project-id]

Agent pull:
  lcos task claim [--provider workbuddy] [--worker local-agent]
  lcos task start <task-id> [--worker local-agent]
  lcos task submit <task-id> <result-envelope.json>
  lcos task show <task-id>

Environment:
  LCOS_CORE_URL=http://127.0.0.1:43121
  LCOS_BRIDGE_URL=http://127.0.0.1:43122
`);
}
