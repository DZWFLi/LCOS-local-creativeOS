#!/usr/bin/env node
import readline from "node:readline";
import { coreRequest, bridgeRequest, jsonBody } from "./lib/client.mjs";

const SERVER = { name: "local-creative-os", version: "0.1.0" };
const tools = [
  tool("open_lcos", "Return the loopback URL for the LCOS visual project canvas.", {
    projectId: { type: "string" },
  }),
  tool("list_lcos_projects", "List Local Core projects.", {}),
  tool("get_lcos_project", "Read the canonical Project Graph snapshot.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("get_lcos_active_context", "Read the latest stable Canvas selection and resolved artifacts.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("build_lcos_context_manifest", "Freeze an immutable ContextManifest from Project Truth.", {
    projectId: { type: "string" },
    targetArtifactId: { type: "string" },
    requestedOutput: { type: "string" },
  }, ["projectId"]),
  tool("list_lcos_runs", "List canonical Runs and pending returns for a project.", {
    projectId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  }, ["projectId"]),
  tool("get_lcos_run", "Read one canonical Run review projection.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("sync_lcos_run", "Synchronize one Run with its bound provider task.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("claim_lcos_task", "Pull one Light Bridge task pending assignment for a provider.", {
    provider: { type: "string" },
    worker_id: { type: "string" },
  }, ["provider", "worker_id"]),
  tool("start_lcos_task", "Mark a Light Bridge task running.", {
    task_id: { type: "string" },
    worker_id: { type: "string" },
  }, ["task_id"]),
  tool("get_lcos_task", "Read one Light Bridge task and its result state.", {
    task_id: { type: "string" },
  }, ["task_id"]),
  tool("get_lcos_task_by_run", "Find a Light Bridge task by LCOS run ID.", {
    lcos_run_id: { type: "string" },
  }, ["lcos_run_id"]),
  tool("submit_lcos_result", "Post a provider execution result back into Light Bridge.", {
    task_id: { type: "string" },
    result: { type: "object" },
  }, ["task_id", "result"]),
  tool("cancel_lcos_task", "Request cancellation of a Light Bridge task.", {
    task_id: { type: "string" },
  }, ["task_id"]),
];

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { return; }
  void handle(message).catch((error) => replyError(message.id, -32603, error instanceof Error ? error.message : String(error)));
});

async function handle({ id, method, params }) {
  if (method === "initialize") {
    return reply(id, {
      protocolVersion: params?.protocolVersion || "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: SERVER,
      instructions: "Read LCOS Project Truth and ActiveContext before acting. A Run uses an immutable ContextManifest; never treat live selection changes as silent mutations to a running task.",
    });
  }
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools });
  if (method !== "tools/call") return id === undefined ? undefined : replyError(id, -32601, "Method not found");
  const args = params?.arguments || {};
  let value;
  switch (params?.name) {
    case "open_lcos":
      value = { url: `http://127.0.0.1:5173/?agent=1${args.projectId ? `&project=${encodeURIComponent(args.projectId)}` : ""}` };
      break;
    case "list_lcos_projects":
      value = await coreRequest("/projects");
      break;
    case "get_lcos_project":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/graph`);
      break;
    case "get_lcos_active_context":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/active-context`);
      break;
    case "build_lcos_context_manifest":
      {
        const projectId = required(args.projectId, "projectId");
        const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
        value = await coreRequest(`/projects/${encodeURIComponent(projectId)}/context-manifests/v0`, {
        method: "POST",
        ...jsonBody({
          ...(args.targetArtifactId ? { targetArtifactId: args.targetArtifactId } : {}),
          contextArtifactIds: (active.contextArtifacts || active.selectedArtifacts || []).map((item) => item.artifactId),
          ...(args.requestedOutput ? { requestedOutput: args.requestedOutput } : {}),
        }),
      });
      }
      break;
    case "list_lcos_runs":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/runs?limit=${encodeURIComponent(args.limit || 20)}`);
      break;
    case "get_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/review`);
      break;
    case "sync_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/sync`, { method: "POST", ...jsonBody({}) });
      break;
    case "claim_lcos_task":
      value = await bridgeRequest("/v1/tasks/claim-next", {
        method: "POST",
        ...jsonBody({
          provider: required(args.provider, "provider"),
          workerId: required(args.worker_id, "worker_id"),
        }),
      });
      break;
    case "start_lcos_task":
      value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/running`, {
        method: "POST",
        ...jsonBody({ workerId: args.worker_id || null }),
      });
      break;
    case "get_lcos_task":
      value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}`);
      break;
    case "get_lcos_task_by_run":
      value = await bridgeRequest(`/v1/tasks/by-run/${encodeURIComponent(required(args.lcos_run_id, "lcos_run_id"))}`);
      break;
    case "submit_lcos_result":
      value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/result`, {
        method: "POST",
        ...jsonBody(args.result),
      });
      break;
    case "cancel_lcos_task":
      value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/cancel`, {
        method: "POST",
        ...jsonBody({}),
      });
      break;
    default:
      return replyError(id, -32602, `Unknown tool: ${params?.name || ""}`);
  }
  return reply(id, {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  });
}

function tool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, additionalProperties: false, ...(required.length ? { required } : {}) } };
}

function required(value, name) {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
