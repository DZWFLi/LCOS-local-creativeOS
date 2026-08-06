// Physical executor surface: only claim/start/heartbeat/fail/get-task/get-context/request-input/submit.
// CLI-first policy: everything the CLI can do stays out of MCP; this file is agent-native execution only.
import { coreRequest, jsonBody } from "./lib/client.mjs";

function tool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, additionalProperties: false, ...(required.length ? { required } : {}) } };
}

function required(value, name) {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
}

async function codexTaskForRun(runId) {
  const response = await coreRequest(`/executor/runs/${encodeURIComponent(runId)}/task`);
  const task = response?.task ?? response;
  const taskId = task?.taskId ?? task?.task_id;
  if (!taskId) throw new Error(`TASK_NOT_FOUND: no Bridge Task for run ${runId}.`);
  const provider = String(task?.provider ?? "unknown").toLowerCase();
  if (provider !== "codex") throw new Error(`PROVIDER_MISMATCH: run ${runId} task provider is ${provider}, expected codex.`);
  return { taskId, lcosRunId: task?.lcosRunId ?? task?.lcos_run_id ?? runId };
}

export const executorToolNames = new Set(["claim_lcos_run","start_lcos_run","heartbeat_lcos_run","fail_lcos_run","get_lcos_task","get_lcos_run_context","request_lcos_user_input","submit_lcos_result"]);

export const executorToolDefinitions = [
tool("claim_lcos_run", "Atomically claim the Bridge Task of one Codex Run (provider-isolated).", {
    runId: { type: "string" },
    workerId: { type: "string" },
  }, ["runId", "workerId"]),
tool("start_lcos_run", "Mark the claimed Codex Run Task as running.", {
    runId: { type: "string" },
    workerId: { type: "string" },
  }, ["runId", "workerId"]),
tool("heartbeat_lcos_run", "Renew the lease of the running Codex Run Task.", {
    runId: { type: "string" },
    workerId: { type: "string" },
  }, ["runId", "workerId"]),
tool("fail_lcos_run", "Submit a structured failed result for a Codex Run Task.", {
    runId: { type: "string" },
    summary: { type: "string" },
  }, ["runId", "summary"]),
tool("get_lcos_task", "Read one Light Bridge task and its result state.", {
    task_id: { type: "string" },
  }, ["task_id"]),
tool("get_lcos_run_context", "Read the frozen ContextManifest for one Run (never live ActiveContext).", {
    runId: { type: "string" },
  }, ["runId"]),
tool("request_lcos_user_input", "Pause one claimed Run with a real waiting_input request instead of failing or retrying it.", {
    runId: { type: "string" },
    requestId: { type: "string" },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    allowFreeText: { type: "boolean" },
    contextVersion: { type: "number" },
  }, ["runId", "requestId", "question"]),
tool("submit_lcos_result", "Post a provider execution result back into Light Bridge.", {
    task_id: { type: "string" },
    result: { type: "object" },
  }, ["task_id", "result"]),
];

export async function invokeExecutorTool(requestedTool, args) {
  let value;
  switch (requestedTool) {

    case "claim_lcos_run":
      {
        const runId = required(args.runId, "runId");
        const task = await codexTaskForRun(runId);
        value = await coreRequest(`/executor/tasks/${encodeURIComponent(task.taskId)}/claim`, {
          method: "POST",
          ...jsonBody({ provider: "codex", workerId: required(args.workerId, "workerId") }),
        });
      }
      break;

    case "start_lcos_run":
      {
        const task = await codexTaskForRun(required(args.runId, "runId"));
        value = await coreRequest(`/executor/tasks/${encodeURIComponent(task.taskId)}/running`, {
          method: "POST",
          ...jsonBody({ workerId: required(args.workerId, "workerId") }),
        });
      }
      break;

    case "heartbeat_lcos_run":
      {
        const task = await codexTaskForRun(required(args.runId, "runId"));
        value = await coreRequest(`/executor/tasks/${encodeURIComponent(task.taskId)}/heartbeat`, {
          method: "POST",
          ...jsonBody({ workerId: required(args.workerId, "workerId") }),
        });
      }
      break;

    case "fail_lcos_run":
      {
        const runId = required(args.runId, "runId");
        const task = await codexTaskForRun(runId);
        value = await coreRequest(`/executor/tasks/${encodeURIComponent(task.taskId)}/result`, {
          method: "POST",
          ...jsonBody({
            contractVersion: "bridge-result-v1",
            taskId: task.taskId,
            lcosRunId: task.lcosRunId ?? runId,
            providerStatus: "failed",
            summary: args.summary ?? "Task failed.",
            changedFiles: [],
          }),
        });
      }
      break;

    case "get_lcos_task":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}`);
      break;

    case "get_lcos_run_context":
      {
        const runId = required(args.runId, "runId");
        const review = await coreRequest(`/runs/${encodeURIComponent(runId)}/review`);
        value = await coreRequest(
          `/projects/${encodeURIComponent(review.run.projectId)}/context-manifests/v0/${encodeURIComponent(review.run.contextManifestId)}`
        );
      }
      break;

    case "request_lcos_user_input": {
      const runId = required(args.runId, "runId");
      const task = await codexTaskForRun(runId);
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(task.taskId)}/result`, {
        method: "POST",
        ...jsonBody({
          contractVersion: "bridge-result-v1",
          taskId: task.taskId,
          lcosRunId: task.lcosRunId,
          providerStatus: "waiting_input",
          summary: required(args.question, "question"),
          changedFiles: [],
          inputRequest: {
            requestId: required(args.requestId, "requestId"),
            question: required(args.question, "question"),
            options: Array.isArray(args.options) ? args.options : [],
            allowFreeText: args.allowFreeText !== false,
            ...(Number.isInteger(args.contextVersion) ? { contextVersion: args.contextVersion } : {}),
          },
        }),
      });
      break;
    }

    case "submit_lcos_result":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/result`, {
        method: "POST",
        ...jsonBody(args.result),
      });
      break;
    default:
      throw new Error(`Unknown executor tool: ${requestedTool}`);
  }
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}
