#!/usr/bin/env node
import readline from "node:readline";
import { coreRequest, bridgeRequest, jsonBody } from "./lib/client.mjs";

const SERVER = { name: "local-creative-os", version: "0.2.0" };
const activeContextPath = (projectId, workspaceId, afterVersion) => {
  const query = new URLSearchParams();
  if (workspaceId) query.set("workspaceId", workspaceId);
  if (afterVersion !== undefined) query.set("afterVersion", String(afterVersion));
  return `/projects/${encodeURIComponent(projectId)}/active-context${query.size ? `?${query}` : ""}`;
};
const contextProposalsPath = (projectId, workspaceId) => {
  const query = new URLSearchParams();
  if (workspaceId) query.set("workspaceId", workspaceId);
  return `/projects/${encodeURIComponent(projectId)}/context-proposals${query.size ? `?${query}` : ""}`;
};
const activeContextMutation = (active, workspaceId, patch = {}) => ({
  ...(workspaceId ? { workspaceId } : {}),
  scopeId: active.scopeId || "",
  selectedViewIds: active.selectedViewIds || [],
  pinnedContextIds: active.pinnedContextIds || [],
  excludedContextIds: active.excludedContextIds || [],
  ...(active.viewport ? {
    viewport: { x: active.viewport.x, y: active.viewport.y, zoom: active.viewport.zoom },
    visibleViewIds: active.viewport.visibleViewIds || [],
  } : {}),
  ...(active.targetArtifactId ? { targetArtifactId: active.targetArtifactId } : {}),
  ...(active.targetRevisionId ? { targetRevisionId: active.targetRevisionId } : {}),
  expectedVersion: active.version,
  updatedBy: "codex",
  ...patch,
});
const tools = [
  tool("open_lcos", "Return the loopback URL for the LCOS visual project canvas.", {
    projectId: { type: "string" },
  }),
  tool("bind_lcos_project", "Bind this Codex session to an LCOS Project + optional Workspace and return the current CanvasContextSnapshot.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
  }, ["projectId"]),
  tool("list_lcos_projects", "List Local Core projects.", {}),
  tool("get_lcos_project", "Read the canonical Project Graph snapshot.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("get_lcos_active_context", "Read the versioned Project + Workspace CanvasContextSnapshot from Local Core.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
  }, ["projectId"]),
  tool("watch_lcos_active_context", "Short-poll one Project + Workspace ActiveContext until version advances (max 1s hold).", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    afterVersion: { type: "number" },
  }, ["projectId", "afterVersion"]),
  tool("apply_lcos_context_command", "Apply an explicit reversible Context/Focus command using ActiveContext compare-and-swap. Use only when the user explicitly requested the change; otherwise submit a proposal.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    expectedVersion: { type: "number" },
    addViewIds: { type: "array", items: { type: "string" } },
    removeViewIds: { type: "array", items: { type: "string" } },
    focusViewId: { type: "string" },
    targetViewId: { type: "string" },
    clearTarget: { type: "boolean" },
  }, ["projectId", "expectedVersion"]),
  tool("select_lcos_views", "Replace the current Project + Workspace selection with an explicit ordered list of Canvas View IDs.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    viewIds: { type: "array", items: { type: "string" } },
  }, ["projectId", "viewIds"]),
  tool("focus_lcos_views", "Focus one Canvas View and make it the current selection without changing Project Truth.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    viewId: { type: "string" },
  }, ["projectId", "viewId"]),
  tool("move_lcos_view", "Move one Artifact View through the canonical mutation API using Project graph compare-and-swap.", {
    projectId: { type: "string" },
    viewId: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    baseVersion: { type: "number" },
  }, ["projectId", "viewId", "x", "y", "baseVersion"]),
  tool("get_lcos_run_context", "Read the frozen ContextManifest for one Run (never live ActiveContext).", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("list_lcos_pending_runs", "List Runs that still need a Codex executor (created/queued/running, bound).", {
    projectId: { type: "string" },
  }, ["projectId"]),
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
  tool("list_lcos_workspace_members", "List canonical Workspace memberships for a project.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("add_lcos_workspace_members", "Add Artifact Views to a Workspace (canonical membership).", {
    workspaceId: { type: "string" },
    viewIds: { type: "array", items: { type: "string" } },
    addedBy: { type: "string", enum: ["user", "agent", "run", "import"] },
  }, ["workspaceId", "viewIds"]),
  tool("remove_lcos_workspace_member", "Remove one Artifact View from a Workspace.", {
    workspaceId: { type: "string" },
    viewId: { type: "string" },
  }, ["workspaceId", "viewId"]),
  tool("move_lcos_workspace_member", "Move one Artifact View to another Workspace.", {
    workspaceId: { type: "string" },
    viewId: { type: "string" },
    toWorkspaceId: { type: "string" },
  }, ["workspaceId", "viewId", "toWorkspaceId"]),
  tool("propose_lcos_run", "Create a human-readable proposal. Agent may provide a full semantic plan; otherwise Core only applies obvious UI defaults.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    prompt: { type: "string" },
    intent: { type: "string", enum: ["analyze", "create", "revise"] },
    requestedProvider: { type: "string" },
    createAsNewNode: { type: "boolean" },
    contextItems: { type: "array", items: { type: "object" } },
    editTargets: { type: "array", items: { type: "object" } },
    resultPolicy: { type: "object" },
  }, ["projectId", "prompt"]),
  tool("validate_lcos_agent_plan", "Validate a structured Agent Plan without reinterpreting the user's creative intent.", {
    projectId: { type: "string" },
    plan: { type: "object" },
  }, ["projectId", "plan"]),
  tool("propose_lcos_context_change", "Codex proposes a Context/Target change; it never applies until the user accepts.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    baseContextVersion: { type: "number" },
    addViewIds: { type: "array", items: { type: "string" } },
    removeViewIds: { type: "array", items: { type: "string" } },
    targetViewId: { type: "string" },
    reason: { type: "string" },
  }, ["projectId", "baseContextVersion", "addViewIds", "removeViewIds", "reason"]),
  tool("accept_lcos_context_proposal", "User accepts a pending Codex context proposal; ActiveContext version advances.", {
    projectId: { type: "string" },
    proposalId: { type: "string" },
  }, ["projectId", "proposalId"]),
  tool("reject_lcos_context_proposal", "User rejects a pending Codex context proposal (audit kept).", {
    projectId: { type: "string" },
    proposalId: { type: "string" },
  }, ["projectId", "proposalId"]),
  tool("list_lcos_context_proposals", "List pending/resolved Codex context proposals for one Project + Workspace.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
  }, ["projectId"]),
  tool("get_lcos_provider_session", "Read the preferred provider session binding for a project.", {
    projectId: { type: "string" },
    provider: { type: "string", enum: ["codex", "workbuddy"] },
  }, ["projectId", "provider"]),
  tool("set_lcos_provider_session", "Register or refresh a project provider session binding.", {
    projectId: { type: "string" },
    provider: { type: "string", enum: ["codex", "workbuddy"] },
    externalSessionId: { type: "string" },
    origin: { type: "string", enum: ["manual", "watchdog"] },
    lastRunId: { type: "string" },
  }, ["projectId", "provider", "externalSessionId"]),
  tool("clear_lcos_provider_session", "Clear a stale/closed provider session binding.", {
    projectId: { type: "string" },
    provider: { type: "string", enum: ["codex", "workbuddy"] },
  }, ["projectId", "provider"]),
  tool("get_lcos_run_input_request", "Read the current unresolved question for one waiting LCOS Run.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("answer_lcos_run_input", "Answer a waiting LCOS Run and requeue the same Run for the same preferred provider session.", {
    runId: { type: "string" },
    requestId: { type: "string" },
    text: { type: "string" },
    selectedOptions: { type: "array", items: { type: "string" } },
  }, ["runId", "requestId"]),
  tool("request_lcos_user_input", "Pause one claimed Run with a real waiting_input request instead of failing or retrying it.", {
    runId: { type: "string" },
    requestId: { type: "string" },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    allowFreeText: { type: "boolean" },
    contextVersion: { type: "number" },
  }, ["runId", "requestId", "question"]),
  tool("list_lcos_runtime_providers", "Read Provider capability and availability before sending.", {}, []),
  tool("build_lcos_context_manifest", "Freeze an immutable ContextManifest from Project Truth.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
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
  tool("create_lcos_run", "Create a canonical Run with an explicit output intent (create/revise/analyze).", {
    projectId: { type: "string" },
    instruction: { type: "string" },
    outputIntent: { type: "string", enum: ["create", "revise", "analyze"] },
    targetArtifactId: { type: "string" },
    provider: { type: "string", enum: ["workbuddy", "codex"] },
  }, ["projectId", "instruction", "outputIntent"]),
  tool("dispatch_lcos_run", "Dispatch a canonical Run to the bound Bridge provider.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("recover_lcos_run", "Recover a Run whose dispatch outcome is uncertain.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("cancel_lcos_run", "Cancel one canonical Run and its bound Bridge task.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("finalize_lcos_run", "Finalize a reviewed Run with completed or retrying decision.", {
    runId: { type: "string" },
    decision: { type: "string", enum: ["completed", "retrying"] },
    comment: { type: "string" },
  }, ["runId", "decision"]),
  tool("accept_lcos_return", "Accept one pending Artifact Return against its expected base revision.", {
    returnId: { type: "string" },
    expectedBaseRevisionId: { type: "string" },
  }, ["returnId", "expectedBaseRevisionId"]),
  tool("reject_lcos_return", "Reject one pending Artifact Return and keep the Draft as evidence.", {
    returnId: { type: "string" },
  }, ["returnId"]),
  tool("retry_lcos_return", "Retry one pending Artifact Return as a new linked Run.", {
    returnId: { type: "string" },
    instruction: { type: "string" },
  }, ["returnId"]),
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
  tool("list_lcos_connectors", "List installed LCOS resource connectors and their read/write capabilities.", {}),
  tool("scan_lcos_obsidian_vault", "Open the native folder picker and read-only scan an Obsidian Vault. Call only after the user explicitly asks to connect or import a Vault.", {}),
  tool("import_lcos_obsidian_notes", "Copy selected Markdown notes from a prior read-only Obsidian scan into one LCOS Project. The source Vault is never modified.", {
    projectId: { type: "string" },
    scanId: { type: "string" },
    relativePaths: { type: "array", items: { type: "string" } },
    scopeId: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
  }, ["projectId", "scanId", "relativePaths", "scopeId"]),
  tool("lcos_resource_list", "List imported resources and their understanding status.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("lcos_resource_describe", "Read one resource descriptor (system understanding of the resource).", {
    projectId: { type: "string" },
    resourceId: { type: "string" },
  }, ["projectId", "resourceId"]),
  tool("lcos_resource_read", "Read resource content within safe bounds (never arbitrary host paths).", {
    projectId: { type: "string" },
    resourceId: { type: "string" },
    path: { type: "string" },
    offset: { type: "number" },
    limit: { type: "number" },
    format: { type: "string", enum: ["text", "raw", "json_tree"] },
  }, ["projectId", "resourceId"]),
  tool("lcos_resource_match", "Match resources against an instruction at Run time; returns candidates, never writes classifications.", {
    projectId: { type: "string" },
    instruction: { type: "string" },
    outputIntent: { type: "string", enum: ["create", "revise", "analyze"] },
    limit: { type: "number" },
  }, ["projectId", "instruction"]),
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
      instructions: "Read the Project + Workspace CanvasContextSnapshot before acting. Generate a structured Agent Plan, let Core validate safety/lifecycle, and never mutate a running Run's frozen ContextManifest.",
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
      value = await coreRequest(activeContextPath(required(args.projectId, "projectId"), args.workspaceId));
      break;
    case "bind_lcos_project":
      {
        const projectId = required(args.projectId, "projectId");
        const graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`);
        const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
        value = { projectId, project: graph.project, activeContext: active };
      }
      break;
    case "watch_lcos_active_context":
      value = await coreRequest(activeContextPath(
        required(args.projectId, "projectId"),
        args.workspaceId,
        Number(args.afterVersion ?? 0),
      ));
      break;
    case "apply_lcos_context_command":
      {
        const projectId = required(args.projectId, "projectId");
        const current = await coreRequest(activeContextPath(projectId, args.workspaceId));
        const views = new Map((current.nodes || []).map((node) => [node.viewId, node]));
        const removed = new Set(args.removeViewIds || []);
        const pinned = [...new Set([...(current.pinnedContextIds || []).filter((id) => !removed.has(id)), ...(args.addViewIds || [])])];
        const selectedViewIds = args.focusViewId ? [args.focusViewId] : current.selectedViewIds || [];
        let targetArtifactId = current.targetArtifactId || undefined;
        let targetRevisionId = current.targetRevisionId || undefined;
        if (args.clearTarget) {
          targetArtifactId = undefined;
          targetRevisionId = undefined;
        } else if (args.targetViewId) {
          const target = views.get(args.targetViewId);
          if (!target) throw new Error(`VIEW_NOT_IN_CONTEXT_SNAPSHOT: ${args.targetViewId}`);
          targetArtifactId = target.artifactId;
          targetRevisionId = target.revisionId;
        }
        value = await coreRequest(activeContextPath(projectId, args.workspaceId), {
          method: "PUT",
          ...jsonBody({
            ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
            scopeId: current.scopeId || "",
            selectedViewIds,
            pinnedContextIds: pinned,
            excludedContextIds: current.excludedContextIds || [],
            ...(current.viewport ? {
              viewport: { x: current.viewport.x, y: current.viewport.y, zoom: current.viewport.zoom },
              visibleViewIds: current.viewport.visibleViewIds || [],
            } : {}),
            ...(targetArtifactId ? { targetArtifactId } : {}),
            ...(targetRevisionId ? { targetRevisionId } : {}),
            expectedVersion: Number(args.expectedVersion),
            updatedBy: "codex",
          }),
        });
      }
      break;
    case "select_lcos_views": {
      const projectId = required(args.projectId, "projectId");
      const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
      value = await coreRequest(activeContextPath(projectId, args.workspaceId), {
        method: "PUT",
        ...jsonBody(activeContextMutation(active, args.workspaceId, {
          selectedViewIds: Array.isArray(args.viewIds) ? args.viewIds : [],
        })),
      });
      break;
    }
    case "focus_lcos_views": {
      const projectId = required(args.projectId, "projectId");
      const viewId = required(args.viewId, "viewId");
      const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
      value = await coreRequest(activeContextPath(projectId, args.workspaceId), {
        method: "PUT",
        ...jsonBody(activeContextMutation(active, args.workspaceId, { selectedViewIds: [viewId] })),
      });
      break;
    }
    case "move_lcos_view":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/graph`, {
        method: "POST",
        ...jsonBody({
          baseVersion: Number(args.baseVersion),
          ops: [{
            type: "move_artifact_view",
            viewId: required(args.viewId, "viewId"),
            x: Number(args.x),
            y: Number(args.y),
          }],
        }),
      });
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
    case "list_lcos_pending_runs":
      {
        const projectId = required(args.projectId, "projectId");
        const reviews = await coreRequest(`/projects/${encodeURIComponent(projectId)}/runs?limit=100`);
        value = reviews.filter((item) =>
          ["created", "queued", "running"].includes(item.run?.status)
          && item.dispatch?.status === "bound");
      }
      break;
    case "claim_lcos_run":
      {
        const runId = required(args.runId, "runId");
        const task = await codexTaskForRun(runId);
        value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/claim`, {
          method: "POST",
          ...jsonBody({ provider: "codex", workerId: required(args.workerId, "workerId") }),
        });
      }
      break;
    case "start_lcos_run":
      {
        const task = await codexTaskForRun(required(args.runId, "runId"));
        value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/running`, {
          method: "POST",
          ...jsonBody({ workerId: required(args.workerId, "workerId") }),
        });
      }
      break;
    case "heartbeat_lcos_run":
      {
        const task = await codexTaskForRun(required(args.runId, "runId"));
        value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/heartbeat`, {
          method: "POST",
          ...jsonBody({ workerId: required(args.workerId, "workerId") }),
        });
      }
      break;
    case "fail_lcos_run":
      {
        const runId = required(args.runId, "runId");
        const task = await codexTaskForRun(runId);
        value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/result`, {
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
    case "list_lcos_workspace_members":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/workspace-memberships`);
      break;
    case "add_lcos_workspace_members":
      value = await coreRequest(`/workspaces/${encodeURIComponent(required(args.workspaceId, "workspaceId"))}/members`, {
        method: "POST",
        ...jsonBody({
          viewIds: args.viewIds,
          ...(args.addedBy ? { addedBy: args.addedBy } : {}),
        }),
      });
      break;
    case "remove_lcos_workspace_member":
      value = await coreRequest(`/workspaces/${encodeURIComponent(required(args.workspaceId, "workspaceId"))}/members/${encodeURIComponent(required(args.viewId, "viewId"))}`, {
        method: "DELETE",
      });
      break;
    case "move_lcos_workspace_member":
      value = await coreRequest(`/workspaces/${encodeURIComponent(required(args.workspaceId, "workspaceId"))}/members/move`, {
        method: "POST",
        ...jsonBody({ viewId: required(args.viewId, "viewId"), toWorkspaceId: required(args.toWorkspaceId, "toWorkspaceId") }),
      });
      break;
    case "propose_lcos_run":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/runs/propose`, {
        method: "POST",
        ...jsonBody({
          ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
          prompt: required(args.prompt, "prompt"),
          ...(args.intent ? { intent: args.intent, decisionSource: "agent" } : {}),
          requestedProvider: args.requestedProvider || "auto",
          ...(typeof args.createAsNewNode === "boolean" ? { createAsNewNode: args.createAsNewNode } : {}),
          contextItems: args.contextItems || [],
          editTargets: args.editTargets || [],
          ...(args.resultPolicy ? { resultPolicy: args.resultPolicy } : {}),
        }),
      });
      break;
    case "validate_lcos_agent_plan":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/runs/validate-plan`, {
        method: "POST",
        ...jsonBody(args.plan),
      });
      break;
    case "propose_lcos_context_change":
      value = await coreRequest(contextProposalsPath(required(args.projectId, "projectId"), args.workspaceId), {
        method: "POST",
        ...jsonBody({
          ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
          baseContextVersion: Number(args.baseContextVersion),
          addViewIds: args.addViewIds || [],
          removeViewIds: args.removeViewIds || [],
          ...(args.targetViewId ? { targetViewId: args.targetViewId } : {}),
          reason: required(args.reason, "reason"),
        }),
      });
      break;
    case "accept_lcos_context_proposal":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/context-proposals/${encodeURIComponent(required(args.proposalId, "proposalId"))}/accept`, {
        method: "POST",
        ...jsonBody({}),
      });
      break;
    case "reject_lcos_context_proposal":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/context-proposals/${encodeURIComponent(required(args.proposalId, "proposalId"))}/reject`, {
        method: "POST",
        ...jsonBody({}),
      });
      break;
    case "list_lcos_context_proposals":
      value = await coreRequest(contextProposalsPath(required(args.projectId, "projectId"), args.workspaceId));
      break;
    case "get_lcos_provider_session":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/provider-sessions/${encodeURIComponent(required(args.provider, "provider"))}`);
      break;
    case "set_lcos_provider_session":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/provider-sessions/${encodeURIComponent(required(args.provider, "provider"))}`, {
        method: "PUT",
        ...jsonBody({
          externalSessionId: required(args.externalSessionId, "externalSessionId"),
          origin: args.origin || "manual",
          status: "active",
          lastSeenAt: new Date().toISOString(),
          ...(args.lastRunId ? { lastRunId: args.lastRunId } : {}),
          failureCount: 0,
        }),
      });
      break;
    case "clear_lcos_provider_session":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/provider-sessions/${encodeURIComponent(required(args.provider, "provider"))}`, { method: "DELETE" });
      break;
    case "get_lcos_run_input_request":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/input-request`);
      break;
    case "answer_lcos_run_input":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/input-request`, {
        method: "POST",
        ...jsonBody({
          requestId: required(args.requestId, "requestId"),
          ...(typeof args.text === "string" && args.text ? { text: args.text } : {}),
          selectedOptions: Array.isArray(args.selectedOptions) ? args.selectedOptions : [],
        }),
      });
      break;
    case "request_lcos_user_input": {
      const runId = required(args.runId, "runId");
      const task = await codexTaskForRun(runId);
      value = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/result`, {
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
    case "list_lcos_runtime_providers":
      value = await coreRequest("/runtime/providers");
      break;
    case "build_lcos_context_manifest":
      {
        const projectId = required(args.projectId, "projectId");
        const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
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
    case "create_lcos_run":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/runs`, {
        method: "POST",
        ...jsonBody({
          instruction: required(args.instruction, "instruction"),
          outputIntent: required(args.outputIntent, "outputIntent"),
          ...(args.targetArtifactId ? { targetArtifactId: args.targetArtifactId } : {}),
          requestedProvider: args.provider || "workbuddy",
        }),
        timeoutMs: 60_000,
      });
      break;
    case "dispatch_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/dispatch`, {
        method: "POST",
        ...jsonBody({}),
        timeoutMs: 60_000,
      });
      break;
    case "recover_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/recover`, {
        method: "POST",
        ...jsonBody({}),
        timeoutMs: 60_000,
      });
      break;
    case "cancel_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/cancel`, {
        method: "POST",
        ...jsonBody({}),
      });
      break;
    case "finalize_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/finalize`, {
        method: "POST",
        ...jsonBody({
          decision: required(args.decision, "decision"),
          ...(args.comment ? { comment: args.comment } : {}),
        }),
      });
      break;
    case "accept_lcos_return":
      value = await coreRequest(`/artifact-returns/${encodeURIComponent(required(args.returnId, "returnId"))}/accept`, {
        method: "POST",
        ...jsonBody({ expectedBaseRevisionId: required(args.expectedBaseRevisionId, "expectedBaseRevisionId") }),
      });
      break;
    case "reject_lcos_return":
      value = await coreRequest(`/artifact-returns/${encodeURIComponent(required(args.returnId, "returnId"))}/reject`, {
        method: "POST",
        ...jsonBody({}),
      });
      break;
    case "retry_lcos_return":
      value = await coreRequest(`/artifact-returns/${encodeURIComponent(required(args.returnId, "returnId"))}/retry`, {
        method: "POST",
        ...jsonBody(args.instruction ? { instruction: args.instruction } : {}),
      });
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
    case "list_lcos_connectors":
      value = await coreRequest("/connectors");
      break;
    case "scan_lcos_obsidian_vault":
      value = await coreRequest("/connectors/obsidian/select-and-scan", { method: "POST", ...jsonBody({}) , timeoutMs: 120_000 });
      break;
    case "import_lcos_obsidian_notes":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/connectors/obsidian/import`, {
        method: "POST",
        ...jsonBody({
          scanId: required(args.scanId, "scanId"),
          relativePaths: Array.isArray(args.relativePaths) ? args.relativePaths : [],
          scopeId: required(args.scopeId, "scopeId"),
          position: {
            x: Number.isFinite(args.x) ? args.x : 180,
            y: Number.isFinite(args.y) ? args.y : 160,
          },
        }),
        timeoutMs: 180_000,
      });
      break;
    case "lcos_resource_list":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/resources`);
      break;
    case "lcos_resource_describe":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/resources/${encodeURIComponent(required(args.resourceId, "resourceId"))}/descriptor`);
      break;
    case "lcos_resource_read":
      {
        const query = new URLSearchParams();
        if (args.path) query.set("path", args.path);
        if (args.offset !== undefined) query.set("offset", String(args.offset));
        if (args.limit !== undefined) query.set("limit", String(args.limit));
        if (args.format) query.set("format", args.format);
        const suffix = query.size === 0 ? "" : `?${query.toString()}`;
        value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/resources/${encodeURIComponent(required(args.resourceId, "resourceId"))}/content${suffix}`);
      }
      break;
    case "lcos_resource_match":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/resources/match`, {
        method: "POST",
        ...jsonBody({
          instruction: required(args.instruction, "instruction"),
          ...(args.outputIntent ? { outputIntent: args.outputIntent } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
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

async function codexTaskForRun(runId) {
  const response = await bridgeRequest(`/v1/tasks/by-run/${encodeURIComponent(runId)}`);
  const task = response?.task ?? response;
  const taskId = task?.taskId ?? task?.task_id;
  if (!taskId) throw new Error(`TASK_NOT_FOUND: no Bridge Task for run ${runId}.`);
  const provider = String(task?.provider ?? task?.provider ?? "unknown").toLowerCase();
  if (provider !== "codex") {
    throw new Error(`PROVIDER_MISMATCH: run ${runId} task provider is ${provider}, expected codex.`);
  }
  return { taskId, lcosRunId: task?.lcosRunId ?? task?.lcos_run_id ?? runId };
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
