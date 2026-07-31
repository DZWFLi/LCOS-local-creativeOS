#!/usr/bin/env node
import { readFile } from "node:fs/promises";
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
