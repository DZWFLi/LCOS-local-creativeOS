#!/usr/bin/env node
import { open, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { coreRequest, jsonBody } from "./lib/client.mjs";
import { serveStdioMcp } from "./lib/mcp-stdio-runtime.mjs";
import { executorToolDefinitions, executorToolNames, invokeExecutorTool } from "./executor-tools.mjs";

const ROLE = process.env.LCOS_MCP_ROLE === "executor" ? "executor" : "agent";
const SERVER = { name: ROLE === "executor" ? "lcos-executor" : "local-creative-os", version: "0.5.0" };
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2024-11-05"];
const CONVERSATION_CHUNK_BYTES = 4 * 1024 * 1024;
const EXECUTOR_TOOL_NAMES = executorToolNames;
// CLI-first 原则：CLI 能做的（批处理/导入/导出/维护/会话绑定/资源枚举）不进 MCP；
// 这里只保留 Agent 会话原生能力（画布上下文、Run 生命周期、提案、对话检索、资源读取/匹配）。
const ACTIVE_AGENT_TOOL_NAMES = new Set([
  "bind_lcos_project", "list_lcos_projects", "get_lcos_project_summary", "open_lcos_preview",
  "get_lcos_active_context", "watch_lcos_active_context", "select_lcos_views", "focus_lcos_views",
  "create_lcos_relation",
  "propose_lcos_context_change", "accept_lcos_context_proposal", "reject_lcos_context_proposal",
  "list_lcos_context_proposals", "apply_lcos_context_command",
  "create_lcos_run", "validate_lcos_agent_plan", "dispatch_lcos_run", "cancel_lcos_run",
  "get_lcos_run", "get_lcos_run_input_request", "answer_lcos_run_input",
  "accept_lcos_return",
  "get_lcos_latest_import_batch", "get_lcos_import_batch",
  "reject_lcos_return", "retry_lcos_return",
  "lcos_resource_read", "lcos_resource_match", "scan_lcos_obsidian_vault", "import_lcos_obsidian_notes",
  "import_lcos_conversation", "list_lcos_conversations", "get_lcos_conversation",
  "search_lcos_conversations", "read_lcos_conversation_messages", "list_lcos_conversation_sections",
  "read_lcos_conversation_section", "annotate_lcos_conversation_section",
  "pin_lcos_conversation_message", ]);
const DOMAIN_AGENT_DEFAULT = new Set(["project", "canvas", "context", "run", "provider", "resource", "conversation"]);
const REQUESTED_PACKAGES = (process.env.LCOS_MCP_PACKAGES ?? "").split(",").map((item) => item.trim()).filter(Boolean);

/** 工具所属域：project / canvas / context / run / executor / provider / resource / conversation */
export function domainOf(toolName) {
  if (/^(open_lcos|bind_lcos_project|list_lcos_projects|get_lcos_project|get_lcos_project_summary|open_lcos_preview)$/.test(toolName)) return "project"
  if (/^(get_lcos_active_context|watch_lcos_active_context|focus_lcos_views|select_lcos_views|set_lcos_viewport|move_lcos_view|get_lcos_canvas_observation|create_lcos_relation|.*workspace_member)/.test(toolName)) return "canvas"
  if (/^(propose_lcos_context_change|apply_lcos_context_command|accept_lcos_context_proposal|reject_lcos_context_proposal|list_lcos_context_proposals|build_lcos_context_manifest)/.test(toolName)) return "context"
  if (/^(create_lcos_run|propose_lcos_run|validate_lcos_agent_plan|dispatch_lcos_run|cancel_lcos_run|get_lcos_run|list_lcos_runs|list_lcos_pending_runs|get_lcos_run_input_request|answer_lcos_run_input|sync_lcos_run|recover_lcos_run|finalize_lcos_run|accept_lcos_return|reject_lcos_return|retry_lcos_return)/.test(toolName)) return "run"
  if (EXECUTOR_TOOL_NAMES.has(toolName)) return "executor"
  if (/^(get_lcos_provider_session|set_lcos_provider_session|clear_lcos_provider_session|list_lcos_runtime_providers)/.test(toolName)) return "provider"
  if (/^(lcos_resource_|get_lcos_latest_import_batch|get_lcos_import_batch|list_lcos_connectors|scan_lcos_obsidian_vault|import_lcos_obsidian_notes)/.test(toolName)) return "resource"
  if (/^(import_lcos_conversation|import_lcos_manual_conversation|export_lcos_conversation|list_lcos_conversations|get_lcos_conversation|search_lcos_conversations|read_lcos_conversation_messages|list_lcos_conversation_sections|refresh_lcos_conversation_sections|rename_lcos_conversation_section|read_lcos_conversation_section|annotate_lcos_conversation_section|pin_lcos_conversation_message|get_lcos_conversation_semantic_index|build_lcos_conversation_semantic_index)/.test(toolName)) return "conversation"
  return "other"
}

/** 按角色 + 可选包裁剪后的工具名清单（验证用）。 */
export function listToolsForRole(role = "agent", packages = []) {
  if (role === "executor") return [...executorToolNames]
  const wanted = new Set(packages)
  return tools
    .filter((item) => {
      if (!ACTIVE_AGENT_TOOL_NAMES.has(item.name)) return false
      return wanted.size === 0 || wanted.has(domainOf(item.name))
    })
    .map((item) => item.name)
}
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
  tool("bind_lcos_project", "Bind this Codex session to an LCOS Project + optional Workspace and return the current CanvasContextSnapshot.", {
    projectId: { type: "string" },
    workspaceId: { type: "string" },
  }, ["projectId"]),
  tool("list_lcos_projects", "List Local Core projects.", {}),
  tool("get_lcos_project_summary", "Read a compact Project summary (id/name/rootPath/workspaces/views) without the full graph.", { projectId: { type: "string" } }, ["projectId"]),
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
  tool("get_lcos_run_input_request", "Read the current unresolved question for one waiting LCOS Run.", {
    runId: { type: "string" },
  }, ["runId"]),
  tool("answer_lcos_run_input", "Answer a waiting LCOS Run and requeue the same Run for the same preferred provider session.", {
    runId: { type: "string" },
    requestId: { type: "string" },
    text: { type: "string" },
    selectedOptions: { type: "array", items: { type: "string" } },
  }, ["runId", "requestId"]),

  tool("get_lcos_run", "Read one canonical Run review projection.", {
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
  tool("cancel_lcos_run", "Cancel one canonical Run and its bound Bridge task.", {
    runId: { type: "string" },
  }, ["runId"]),
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






  tool("get_lcos_latest_import_batch", "Resolve the latest durable import batch for phrases such as '刚导入这一批'. Returns provenance only; it does not imply Collection membership.", {
    projectId: { type: "string" },
  }, ["projectId"]),
  tool("get_lcos_import_batch", "Read one durable import batch by ID.", {
    projectId: { type: "string" },
    batchId: { type: "string" },
  }, ["projectId", "batchId"]),
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
  tool("list_lcos_conversations", "List imported conversation timelines for one Project.", { projectId: { type: "string" } }, ["projectId"]),
  tool("get_lcos_conversation", "Read one conversation outline, pinned decisions and recent messages.", { projectId: { type: "string" }, conversationId: { type: "string" } }, ["projectId", "conversationId"]),
  tool("search_lcos_conversations", "Search raw conversation messages with FTS5 and optional local semantic index.", { projectId: { type: "string" }, query: { type: "string" }, semantic: { type: "boolean" }, limit: { type: "number" } }, ["projectId", "query"]),
  tool("read_lcos_conversation_messages", "Read a page of raw timeline messages.", { projectId: { type: "string" }, conversationId: { type: "string" }, offset: { type: "number" }, limit: { type: "number" }, pinnedOnly: { type: "boolean" } }, ["projectId", "conversationId"]),
  tool("list_lcos_conversation_sections", "List the zero-token rule-derived sections for one conversation.", { projectId: { type: "string" }, conversationId: { type: "string" } }, ["projectId", "conversationId"]),
  tool("read_lcos_conversation_section", "Read a section and its exact source messages for on-demand annotation.", { projectId: { type: "string" }, conversationId: { type: "string" }, sectionId: { type: "string" } }, ["projectId", "conversationId", "sectionId"]),
  tool("annotate_lcos_conversation_section", "Store a small source-hash-guarded section annotation.", { projectId: { type: "string" }, conversationId: { type: "string" }, sectionId: { type: "string" }, sourceHash: { type: "string" }, title: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, todos: { type: "array", items: { type: "string" } }, involvedFiles: { type: "array", items: { type: "string" } } }, ["projectId", "conversationId", "sectionId", "sourceHash", "title"]),
  tool("pin_lcos_conversation_message", "Promote one raw message to a high-signal Decision node on Canvas.", { projectId: { type: "string" }, conversationId: { type: "string" }, messageId: { type: "string" }, scopeId: { type: "string" }, workspaceId: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, ["projectId", "conversationId", "messageId", "scopeId"]),
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

const visibleTools = tools.filter((item) => {
  if (!ACTIVE_AGENT_TOOL_NAMES.has(item.name)) return false
  return REQUESTED_PACKAGES.length === 0 || REQUESTED_PACKAGES.includes(domainOf(item.name))
})
const exposedTools = ROLE === "executor" ? executorToolDefinitions : visibleTools
const loadedDomains = [...new Set(exposedTools.map((item) => domainOf(item.name)))].sort()

if (process.env.LCOS_MCP_NO_SERVE !== "1") {
  serveStdioMcp({
    serverInfo: SERVER,
    instructions: ROLE === "executor"
      ? "This server is only for provider execution: claim, start, heartbeat, request input, submit, fail or cancel. Project and Canvas operations belong to local-creative-os."
      : `Read the Project + Workspace CanvasContextSnapshot before acting. Generate a structured Agent Plan, let Core validate safety/lifecycle, and never mutate a running Run's frozen ContextManifest. Loaded packages: ${loadedDomains.join(", ")}.`,
    protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
    tools: exposedTools,
    callTool: ROLE === "executor" ? invokeExecutorTool : invokeTool,
  })
}

async function invokeTool(requestedTool, args) {
  let value;
  switch (requestedTool) {
    case "list_lcos_projects":
      value = await coreRequest("/projects");
      break;
    case "get_lcos_project_summary": {
      const projectId = required(args.projectId, "projectId");
      const graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`);
      value = {
        project: { id: String(graph.project?.id ?? ''), name: graph.project?.name ?? '', rootPath: graph.project?.rootPath ?? '' },
        workspaces: (graph.workspaces ?? []).map((ws) => ({ id: String(ws.id) })),
        views: (graph.artifactViews ?? []).map((view) => ({
          id: String(view.id),
          title: view.title ?? '',
          artifactId: String(view.artifactId ?? ''),
          ...(view.revisionId === undefined ? {} : { revisionId: String(view.revisionId) }),
        })),
      };
      break;
    }
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
    case "get_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/review`);
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
    case "cancel_lcos_run":
      value = await coreRequest(`/runs/${encodeURIComponent(required(args.runId, "runId"))}/cancel`, {
        method: "POST",
        ...jsonBody({}),
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
    case "get_lcos_latest_import_batch":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/import-batches/latest`);
      break;
    case "get_lcos_import_batch":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/import-batches/${encodeURIComponent(required(args.batchId, "batchId"))}`);
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
    case "read_lcos_conversation_section":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/${encodeURIComponent(required(args.sectionId, "sectionId"))}/source`);
      break;
    case "annotate_lcos_conversation_section":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/sections/${encodeURIComponent(required(args.sectionId, "sectionId"))}/annotation`, { method: "POST", ...jsonBody({ sourceHash: required(args.sourceHash, "sourceHash"), title: required(args.title, "title"), decisions: args.decisions || [], todos: args.todos || [], involvedFiles: args.involvedFiles || [], annotatedBy: "agent" }) });
      break;
    case "pin_lcos_conversation_message":
      value = await coreRequest(`/projects/${encodeURIComponent(required(args.projectId, "projectId"))}/conversations/${encodeURIComponent(required(args.conversationId, "conversationId"))}/messages/${encodeURIComponent(required(args.messageId, "messageId"))}/pin`, { method: "POST", ...jsonBody({ scopeId: required(args.scopeId, "scopeId"), ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}), ...(args.title ? { title: args.title } : {}), ...(args.summary ? { summary: args.summary } : {}), ...(Number.isFinite(args.x) ? { x: args.x } : {}), ...(Number.isFinite(args.y) ? { y: args.y } : {}) }) });
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
