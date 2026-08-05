#!/usr/bin/env node
import { open, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { coreRequest, jsonBody } from "./lib/client.mjs";
import { serveStdioMcp } from "./lib/mcp-stdio-runtime.mjs";

const ROLE = process.env.LCOS_MCP_ROLE === "executor" ? "executor" : "agent";
const SERVER = { name: ROLE === "executor" ? "lcos-executor" : "local-creative-os", version: "0.5.0" };
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2024-11-05"];
const CONVERSATION_CHUNK_BYTES = 4 * 1024 * 1024;
const EXECUTOR_TOOL_NAMES = new Set([
  "get_lcos_run_context",
  "claim_lcos_run", "start_lcos_run", "heartbeat_lcos_run", "fail_lcos_run", "request_lcos_user_input",
  "claim_lcos_task", "start_lcos_task", "get_lcos_task", "get_lcos_task_by_run", "submit_lcos_result", "cancel_lcos_task",
]);
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
  tool("set_lcos_viewport", "Move the Agent browser camera without changing Project semantic truth. This updates only versioned navigation context.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    zoom: { type: "number" },
    visibleViewIds: { type: "array", items: { type: "string" } },
  }, ["projectId", "x", "y", "zoom"]),
  tool("create_lcos_relation", "Create one canonical Artifact-to-Artifact relation between two Canvas Views. Use only for a user-authorized semantic relation.", {
    projectId: { type: "string" },
    sourceViewId: { type: "string" },
    targetViewId: { type: "string" },
    kind: { type: "string" },
  }, ["projectId", "sourceViewId", "targetViewId", "kind"]),
  tool("open_lcos_preview", "Focus a Canvas View and return its latest preview metadata. Optionally generate a thumbnail through Local Core.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
    viewId: { type: "string" },
    generate: { type: "boolean" },
    includeContent: { type: "boolean" },
  }, ["projectId", "viewId"]),
  tool("get_lcos_canvas_observation", "Render an on-demand SVG visual supplement from the structured Canvas snapshot. The SVG is untrusted observation data, not Project Truth.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
  }, ["projectId"]),
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
  tool("import_lcos_conversation", "Import an explicitly user-provided Codex JSONL conversation as a raw timeline. Parsing and FTS5 indexing are local and do not call a model.", {
    projectId: { type: "string" },
    filePath: { type: "string" },
    scopeId: { type: "string" },
    workspaceId: { type: "string" },
    title: { type: "string" },
  }, ["projectId", "filePath", "scopeId"]),
  tool("import_lcos_manual_conversation", "Import a manually supplied conversation timeline. Entries stay linear and are indexed without model calls.", {
    projectId: { type: "string" },
    scopeId: { type: "string" },
    workspaceId: { type: "string" },
    title: { type: "string" },
    entries: { type: "array", items: { type: "object" } },
  }, ["projectId", "scopeId", "entries"]),
  tool("export_lcos_conversation", "Export one conversation projection to an explicit local JSON file. Raw messages are included only when requested.", {
    projectId: { type: "string" },
    conversationId: { type: "string" },
    outputPath: { type: "string" },
    includeMessages: { type: "boolean" },
  }, ["projectId", "conversationId", "outputPath"]),
  tool("list_lcos_conversations", "List imported conversation timelines for one Project.", { projectId: { type: "string" } }, ["projectId"]),
  tool("get_lcos_conversation", "Read one conversation outline, pinned decisions and recent messages.", { projectId: { type: "string" }, conversationId: { type: "string" } }, ["projectId", "conversationId"]),
  tool("search_lcos_conversations", "Search raw conversation messages with FTS5 and optional local semantic index.", { projectId: { type: "string" }, query: { type: "string" }, semantic: { type: "boolean" }, limit: { type: "number" } }, ["projectId", "query"]),
  tool("read_lcos_conversation_messages", "Read a page of raw timeline messages.", { projectId: { type: "string" }, conversationId: { type: "string" }, offset: { type: "number" }, limit: { type: "number" }, pinnedOnly: { type: "boolean" } }, ["projectId", "conversationId"]),
  tool("list_lcos_conversation_sections", "List the zero-token rule-derived sections for one conversation.", { projectId: { type: "string" }, conversationId: { type: "string" } }, ["projectId", "conversationId"]),
  tool("refresh_lcos_conversation_sections", "Rebuild only unlocked rule-derived sections. User-locked sections and titles are preserved.", { projectId: { type: "string" }, conversationId: { type: "string" } }, ["projectId", "conversationId"]),
  tool("rename_lcos_conversation_section", "Rename and lock one conversation section so later rule refreshes do not overwrite it.", { projectId: { type: "string" }, conversationId: { type: "string" }, sectionId: { type: "string" }, title: { type: "string" }, lockedByUser: { type: "boolean" } }, ["projectId", "conversationId", "sectionId", "title"]),
  tool("read_lcos_conversation_section", "Read a section and its exact source messages for on-demand annotation.", { projectId: { type: "string" }, conversationId: { type: "string" }, sectionId: { type: "string" } }, ["projectId", "conversationId", "sectionId"]),
  tool("annotate_lcos_conversation_section", "Store a small source-hash-guarded section annotation.", { projectId: { type: "string" }, conversationId: { type: "string" }, sectionId: { type: "string" }, sourceHash: { type: "string" }, title: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, todos: { type: "array", items: { type: "string" } }, involvedFiles: { type: "array", items: { type: "string" } } }, ["projectId", "conversationId", "sectionId", "sourceHash", "title"]),
  tool("pin_lcos_conversation_message", "Promote one raw message to a high-signal Decision node on Canvas.", { projectId: { type: "string" }, conversationId: { type: "string" }, messageId: { type: "string" }, scopeId: { type: "string" }, workspaceId: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, ["projectId", "conversationId", "messageId", "scopeId"]),
  tool("get_lcos_conversation_semantic_index", "Read Ollama/sqlite-vec semantic index status.", { projectId: { type: "string" } }, ["projectId"]),
  tool("build_lcos_conversation_semantic_index", "Build or refresh the optional local semantic index without blocking raw import.", { projectId: { type: "string" }, model: { type: "string" }, sessionId: { type: "string" }, force: { type: "boolean" }, batchSize: { type: "number" } }, ["projectId"]),
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

const visibleTools = tools.filter((item) => ROLE === "executor" ? EXECUTOR_TOOL_NAMES.has(item.name) : !EXECUTOR_TOOL_NAMES.has(item.name));

serveStdioMcp({
  serverInfo: SERVER,
  instructions: ROLE === "executor"
    ? "This server is only for provider execution: claim, start, heartbeat, request input, submit, fail or cancel. Project and Canvas operations belong to local-creative-os."
    : "Read the Project + Workspace CanvasContextSnapshot before acting. Generate a structured Agent Plan, let Core validate safety/lifecycle, and never mutate a running Run's frozen ContextManifest.",
  protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
  tools: visibleTools,
  callTool: invokeTool,
});

async function invokeTool(requestedTool, args) {
  let value;
  switch (requestedTool) {
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
    case "set_lcos_viewport": {
      const projectId = required(args.projectId, "projectId");
      const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
      const zoom = Number(args.zoom);
      if (!Number.isFinite(zoom) || zoom < 0.05 || zoom > 8) throw new Error("VIEWPORT_ZOOM_OUT_OF_RANGE");
      value = await coreRequest(activeContextPath(projectId, args.workspaceId), {
        method: "PUT",
        ...jsonBody(activeContextMutation(active, args.workspaceId, {
          viewport: { x: Number(args.x), y: Number(args.y), zoom },
          visibleViewIds: Array.isArray(args.visibleViewIds) ? args.visibleViewIds : [],
        })),
      });
      break;
    }
    case "create_lcos_relation": {
      const projectId = required(args.projectId, "projectId");
      const sourceViewId = required(args.sourceViewId, "sourceViewId");
      const targetViewId = required(args.targetViewId, "targetViewId");
      if (sourceViewId === targetViewId) throw new Error("RELATION_SELF_REFERENCE_NOT_ALLOWED");
      const graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`);
      const sourceView = graph.artifactViews?.find((view) => String(view.id) === sourceViewId);
      const targetView = graph.artifactViews?.find((view) => String(view.id) === targetViewId);
      if (!sourceView || !targetView) throw new Error("RELATION_VIEW_NOT_FOUND");
      const relationId = `rel-${randomUUID()}`;
      const now = new Date().toISOString();
      value = await coreRequest(`/projects/${encodeURIComponent(projectId)}/relations/${encodeURIComponent(relationId)}`, {
        method: "PUT",
        ...jsonBody({
          id: relationId,
          projectId,
          sourceEntityType: "artifact",
          sourceEntityId: String(sourceView.artifactId),
          targetEntityType: "artifact",
          targetEntityId: String(targetView.artifactId),
          kind: required(args.kind, "kind").trim(),
          createdAt: now,
          updatedAt: now,
        }),
      });
      break;
    }
    case "open_lcos_preview": {
      const projectId = required(args.projectId, "projectId");
      const viewId = required(args.viewId, "viewId");
      const graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`);
      const view = graph.artifactViews?.find((item) => String(item.id) === viewId);
      if (!view) throw new Error("PREVIEW_VIEW_NOT_FOUND");
      const revisionId = view.revisionId;
      if (!revisionId) throw new Error("PREVIEW_REVISION_NOT_FOUND");
      const active = await coreRequest(activeContextPath(projectId, args.workspaceId));
      await coreRequest(activeContextPath(projectId, args.workspaceId), {
        method: "PUT",
        ...jsonBody(activeContextMutation(active, args.workspaceId, { selectedViewIds: [viewId] })),
      });
      let records = await coreRequest(`/projects/${encodeURIComponent(projectId)}/preview-records`);
      let record = records.find((item) => String(item.revisionId) === String(revisionId) && item.previewProfile === "thumbnail");
      if ((!record || record.status !== "ready") && args.generate === true) {
        record = await coreRequest(`/projects/${encodeURIComponent(projectId)}/previews`, {
          method: "POST",
          ...jsonBody({ revisionId: String(revisionId), previewProfile: "thumbnail" }),
          timeoutMs: 120_000,
        });
        records = await coreRequest(`/projects/${encodeURIComponent(projectId)}/preview-records`);
        record = records.find((item) => String(item.revisionId) === String(revisionId) && item.previewProfile === "thumbnail") || record;
      }
      const content = args.includeContent === true && record?.status === "ready"
        ? await coreRequest(`/projects/${encodeURIComponent(projectId)}/preview-records/${encodeURIComponent(String(record.id))}/content`)
        : undefined;
      value = {
        viewId,
        revisionId: String(revisionId),
        record: record ?? null,
        ...(content === undefined ? {} : { content }),
        browserUrl: `http://127.0.0.1:5173/?agent=1&project=${encodeURIComponent(projectId)}&focus=${encodeURIComponent(viewId)}`,
      };
      break;
    }
    case "get_lcos_canvas_observation": {
      const projectId = required(args.projectId, "projectId");
      const query = new URLSearchParams();
      if (args.workspaceId) query.set("workspaceId", args.workspaceId);
      value = await coreRequest(`/projects/${encodeURIComponent(projectId)}/canvas-observation${query.size ? `?${query}` : ""}`);
      break;
    }
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
      value = await coreRequest("/executor/tasks/claim-next", {
        method: "POST",
        ...jsonBody({
          provider: required(args.provider, "provider"),
          workerId: required(args.worker_id, "worker_id"),
        }),
      });
      break;
    case "start_lcos_task":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/running`, {
        method: "POST",
        ...jsonBody({ workerId: args.worker_id || null }),
      });
      break;
    case "get_lcos_task":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}`);
      break;
    case "get_lcos_task_by_run":
      value = await coreRequest(`/executor/runs/${encodeURIComponent(required(args.lcos_run_id, "lcos_run_id"))}/task`);
      break;
    case "submit_lcos_result":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/result`, {
        method: "POST",
        ...jsonBody(args.result),
      });
      break;
    case "cancel_lcos_task":
      value = await coreRequest(`/executor/tasks/${encodeURIComponent(required(args.task_id, "task_id"))}/cancel`, {
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
    case "import_lcos_conversation":
      value = await importConversationFile({
        projectId: required(args.projectId, "projectId"),
        filePath: required(args.filePath, "filePath"),
        scopeId: required(args.scopeId, "scopeId"),
        ...(args.workspaceId ? { workspaceId: String(args.workspaceId) } : {}),
        ...(args.title ? { title: String(args.title) } : {}),
      });
      break;
    case "import_lcos_manual_conversation":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/import-manual`, {
        method: "POST",
        ...jsonBody({
          scopeId: required(args.scopeId, "scopeId"),
          ...(args.workspaceId ? { workspaceId: String(args.workspaceId) } : {}),
          ...(args.title ? { title: String(args.title) } : {}),
          entries: Array.isArray(args.entries) ? args.entries : [],
        }),
        timeoutMs: 600_000,
      });
      break;
    case "export_lcos_conversation": {
      const projectId = required(args.projectId, "projectId");
      const conversationId = required(args.conversationId, "conversationId");
      const outputPath = resolve(required(args.outputPath, "outputPath"));
      const exported = await coreRequest(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/export?includeMessages=${args.includeMessages === false ? "false" : "true"}`, { timeoutMs: 120_000 });
      await writeFile(outputPath, `${JSON.stringify(exported, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      value = { outputPath, conversationId, rawTimelineIncluded: args.includeMessages !== false };
      break;
    }
    case "list_lcos_conversations":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations`);
      break;
    case "get_lcos_conversation":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}`);
      break;
    case "search_lcos_conversations": {
      const query = new URLSearchParams({ q: required(args.query, "query") });
      if (args.semantic === false) query.set("semantic", "false");
      if (args.limit !== undefined) query.set("limit", String(args.limit));
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/search?${query}`);
      break;
    }
    case "read_lcos_conversation_messages": {
      const query = new URLSearchParams();
      if (args.offset !== undefined) query.set("offset", String(args.offset));
      if (args.limit !== undefined) query.set("limit", String(args.limit));
      if (args.pinnedOnly === true) query.set("pinnedOnly", "true");
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/messages?${query}`);
      break;
    }
    case "list_lcos_conversation_sections":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections`);
      break;
    case "refresh_lcos_conversation_sections":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/refresh`, { method: "POST", ...jsonBody({}) });
      break;
    case "rename_lcos_conversation_section":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/${encodeURIComponent(required(args.sectionId, "sectionId"))}`, {
        method: "PATCH",
        ...jsonBody({ title: required(args.title, "title"), lockedByUser: args.lockedByUser !== false }),
      });
      break;
    case "read_lcos_conversation_section":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/${encodeURIComponent(required(args.sectionId, "sectionId"))}/source`);
      break;
    case "annotate_lcos_conversation_section":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/${encodeURIComponent(required(args.sectionId, "sectionId"))}/annotation`, { method: "POST", ...jsonBody({ sourceHash: required(args.sourceHash, "sourceHash"), title: required(args.title, "title"), decisions: args.decisions || [], todos: args.todos || [], involvedFiles: args.involvedFiles || [], annotatedBy: "agent" }) });
      break;
    case "pin_lcos_conversation_message":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/messages/${encodeURIComponent(required(args.messageId, "messageId"))}/pin`, { method: "POST", ...jsonBody({ scopeId: required(args.scopeId, "scopeId"), ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}), ...(args.title ? { title: args.title } : {}), ...(args.summary ? { summary: args.summary } : {}), ...(Number.isFinite(args.x) ? { x: args.x } : {}), ...(Number.isFinite(args.y) ? { y: args.y } : {}) }) });
      break;
    case "get_lcos_conversation_semantic_index":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/semantic-index`);
      break;
    case "build_lcos_conversation_semantic_index":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/semantic-index`, { method: "POST", ...jsonBody({ ...(args.model ? { model: args.model } : {}), ...(args.sessionId ? { sessionId: args.sessionId } : {}), ...(typeof args.force === "boolean" ? { force: args.force } : {}), ...(args.batchSize !== undefined ? { batchSize: args.batchSize } : {}) }), timeoutMs: 300_000 });
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
      throw new Error(`Unknown tool: ${requestedTool}`);
  }
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

async function importConversationFile({ projectId, filePath, scopeId, workspaceId, title }) {
  const absolutePath = resolve(filePath);
  const handle = await open(absolutePath, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Conversation source must be a regular file.");
    if (stat.size <= 0 || stat.size > 512 * 1024 * 1024) throw new Error("Conversation source must be 1 byte to 512 MiB.");
    const created = await coreRequest(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions`, {
      method: "POST",
      ...jsonBody({
        sourceKind: "codex",
        sourceFileName: basename(absolutePath),
        expectedBytes: stat.size,
        scopeId,
        ...(workspaceId ? { workspaceId } : {}),
        ...(title ? { title } : {}),
      }),
    });
    const upload = created?.id ? created : created?.value ?? created;
    const uploadId = upload?.id;
    if (!uploadId) throw new Error("Local Core did not return a conversation import session ID.");
    const fileHash = createHash("sha256");
    let position = 0;
    let chunkIndex = 0;
    while (position < stat.size) {
      const size = Math.min(CONVERSATION_CHUNK_BYTES, stat.size - position);
      const buffer = Buffer.allocUnsafe(size);
      const { bytesRead } = await handle.read(buffer, 0, size, position);
      if (bytesRead <= 0) throw new Error(`Unexpected end of file at byte ${position}.`);
      const bytes = buffer.subarray(0, bytesRead);
      fileHash.update(bytes);
      const chunkHash = createHash("sha256").update(bytes).digest("hex");
      await coreRequest(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions/${encodeURIComponent(uploadId)}/chunks/${chunkIndex}`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", "x-content-sha256": chunkHash },
        body: bytes,
        timeoutMs: 180_000,
      });
      position += bytesRead;
      chunkIndex += 1;
    }
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions/${encodeURIComponent(uploadId)}/complete`, {
      method: "POST",
      ...jsonBody({ expectedChunks: chunkIndex, expectedContentHash: fileHash.digest("hex") }),
      timeoutMs: 900_000,
    });
  } finally {
    await handle.close();
  }
}


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
  const provider = String(task?.provider ?? task?.provider ?? "unknown").toLowerCase();
  if (provider !== "codex") {
    throw new Error(`PROVIDER_MISMATCH: run ${runId} task provider is ${provider}, expected codex.`);
  }
  return { taskId, lcosRunId: task?.lcosRunId ?? task?.lcos_run_id ?? runId };
}

