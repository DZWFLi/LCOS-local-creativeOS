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
let exitCode = 0;

try {
  let result;
  if (group === "doctor") {
    const [core, bridge] = await Promise.all([
      probe(coreRequest("/health")),
      probe(bridgeRequest("/health")),
    ]);
    const capabilities = bridge.ok ? await probe(bridgeRequest("/v1/capabilities")) : null;
    const healthy = core.ok && bridge.ok;
    result = {
      healthy,
      core: core.ok ? { ok: true, ...core.value } : { ok: false, error: core.error },
      bridge: bridge.ok ? { ok: true, ...bridge.value } : { ok: false, error: bridge.error },
      capabilities: capabilities === null ? null : capabilities.ok ? capabilities.value : { error: capabilities.error },
    };
    if (!healthy) exitCode = 1;
  } else if (group === "capabilities") {
    const bridge = await probe(bridgeRequest("/v1/capabilities"));
    const core = await probe(coreRequest("/health"));
    result = {
      coreHealthy: core.ok,
      ...(bridge.ok ? bridge.value : { bridgeError: bridge.error }),
    };
    if (!bridge.ok || !core.ok) exitCode = 1;
  } else if (group === "project" && action === "list") {
    result = await coreRequest("/projects");
  } else if (group === "project" && action === "open") {
    const rootPath = required(positional[0], "project root path");
    const name = required(option("name"), "--name");
    const inspection = await coreRequest("/project-roots/inspect", { method: "POST", ...jsonBody({ rootPath }), timeoutMs: 60_000 });
    if (inspection.requiresConfirmation && !rest.includes("--import-existing") && !rest.includes("--empty")) {
      throw new Error(`Directory contains ${inspection.fileCount} files and ${inspection.directoryCount} folders. Re-run with --import-existing to build Canvas nodes or --empty to register only the root.`);
    }
    result = await coreRequest("/projects", { method: "POST", ...jsonBody({ name, intent: "open", rootPath, importExisting: rest.includes("--import-existing") }), timeoutMs: 120_000 });
  } else if (group === "project" && action === "create") {
    const parentPath = required(positional[0], "parent path");
    const name = required(option("name"), "--name");
    result = await coreRequest("/projects", { method: "POST", ...jsonBody({ name, intent: "create", parentPath, directoryName: option("directory") || name.replace(/\s+/g, "-") }), timeoutMs: 60_000 });
  } else if (group === "project" && action === "show") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/graph`);
  } else if (group === "project" && action === "inspect") {
    const rootPath = required(positional[0], "root path");
    result = await coreRequest("/project-roots/inspect", { method: "POST", ...jsonBody({ rootPath }), timeoutMs: 60_000 });
  } else if (group === "project" && action === "current") {
    const projects = await coreRequest("/projects");
    const explicit = positional[0];
    if (explicit !== undefined) {
      const found = projects.find((item) => item.id === explicit);
      if (found === undefined) throw new Error(`Project not found: ${explicit}`);
      result = found;
    } else if (projects.length === 1) {
      result = projects[0];
    } else if (projects.length === 0) {
      throw new Error("No projects registered. Use lcos project open|create first.");
    } else {
      throw new Error(`Multiple projects registered; pass the project id: ${projects.map((item) => item.id).join(", ")}`);
    }
  } else if (group === "project" && action === "export") {
    const projectId = required(positional[0], "project id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/export-lcosproj`, {
      method: "POST",
      ...jsonBody({ targetPath: required(option("to"), "--to") }),
      timeoutMs: 120_000,
    });
  } else if (group === "project" && action === "export-all") {
    result = await coreRequest("/lcosproj/export-all", {
      method: "POST",
      ...jsonBody({
        targetDir: required(option("to"), "--to"),
        ...(option("ids") ? { projectIds: option("ids").split(",") } : {}),
      }),
      timeoutMs: 300_000,
    });
  } else if (group === "project" && action === "open-file") {
    result = await coreRequest("/lcosproj/open", {
      method: "POST",
      ...jsonBody({
        filePath: required(positional[0], ".lcosproj path"),
        ...(option("root") ? { rootPath: option("root") } : {}),
      }),
      timeoutMs: 120_000,
    });
  } else if (group === "project" && action === "inspect-file") {
    result = await coreRequest(`/lcosproj/inspect?file=${encodeURIComponent(required(positional[0], ".lcosproj path"))}`);
  } else if (group === "workspace" && action === "list") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/workspace-memberships`);
  } else if (group === "workspace" && action === "add") {
    const workspaceId = required(positional[0], "workspace id");
    const viewIds = positional.slice(1);
    if (viewIds.length === 0) throw new Error("workspace add requires at least one view id");
    result = await coreRequest(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
      method: "POST",
      ...jsonBody({ viewIds, ...(option("by") ? { addedBy: option("by") } : {}) }),
    });
  } else if (group === "workspace" && action === "remove") {
    const workspaceId = required(positional[0], "workspace id");
    const viewId = required(positional[1], "view id");
    result = await coreRequest(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(viewId)}`, { method: "DELETE" });
  } else if (group === "workspace" && action === "move") {
    const fromWorkspaceId = required(positional[0], "from workspace id");
    const viewId = required(positional[1], "view id");
    const toWorkspaceId = required(option("to"), "--to (target workspace id)");
    result = await coreRequest(`/workspaces/${encodeURIComponent(fromWorkspaceId)}/members/move`, {
      method: "POST",
      ...jsonBody({ viewId, toWorkspaceId }),
    });
  } else if (group === "run" && action === "propose") {
    const projectId = required(positional[0], "project id");
    const prompt = required(option("prompt"), "--prompt");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/runs/propose`, {
      method: "POST",
      ...jsonBody({
        prompt,
        requestedProvider: option("provider") || "auto",
        contextItems: [],
        editTargets: [],
        resultPolicy: { type: "reply_only" },
      }),
    });
  } else if (group === "providers") {
    result = await coreRequest("/runtime/providers");
  } else if (group === "context" && action === "get") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/active-context`);
  } else if (group === "selection" && action === "get") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/active-context`);
  } else if (group === "context" && action === "search") {
    const projectId = required(positional[0], "project id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/artifacts/search?q=${encodeURIComponent(option("q") || "")}`);
  } else if (group === "target" && action === "set") {
    const projectId = required(positional[0], "project id");
    const artifactId = required(positional[1], "artifact id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`, {
      method: "PUT",
      ...jsonBody({
        scopeId: active.scopeId,
        selectedViewIds: active.selectedViewIds ?? [],
        pinnedContextIds: active.pinnedContextIds ?? [],
        excludedContextIds: active.excludedContextIds ?? [],
        targetArtifactId: artifactId,
        ...(option("revision") ? { targetRevisionId: option("revision") } : {}),
      }),
    });
  } else if (group === "target" && action === "clear") {
    const projectId = required(positional[0], "project id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`, {
      method: "PUT",
      ...jsonBody({
        scopeId: active.scopeId,
        selectedViewIds: active.selectedViewIds ?? [],
        pinnedContextIds: active.pinnedContextIds ?? [],
        excludedContextIds: active.excludedContextIds ?? [],
      }),
    });
  } else if (group === "context" && action === "add") {
    const projectId = required(positional[0], "project id");
    const viewIds = positional.slice(1);
    if (viewIds.length === 0) throw new Error("context add requires at least one view id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`, {
      method: "PUT",
      ...jsonBody({
        scopeId: active.scopeId,
        selectedViewIds: active.selectedViewIds ?? [],
        pinnedContextIds: [...new Set([...(active.pinnedContextIds ?? []), ...viewIds])],
        excludedContextIds: active.excludedContextIds ?? [],
      }),
    });
  } else if (group === "context" && action === "remove") {
    const projectId = required(positional[0], "project id");
    const viewIds = positional.slice(1);
    if (viewIds.length === 0) throw new Error("context remove requires at least one view id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    const removed = new Set(viewIds);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`, {
      method: "PUT",
      ...jsonBody({
        scopeId: active.scopeId,
        selectedViewIds: (active.selectedViewIds ?? []).filter((id) => !removed.has(id)),
        pinnedContextIds: (active.pinnedContextIds ?? []).filter((id) => !removed.has(id)),
        excludedContextIds: active.excludedContextIds ?? [],
      }),
    });
  } else if (group === "artifact" && action === "inspect") {
    result = await coreRequest(`/artifacts/${encodeURIComponent(required(positional[0], "artifact id"))}`);
  } else if (group === "revision" && action === "list") {
    result = await coreRequest(`/artifacts/${encodeURIComponent(required(positional[0], "artifact id"))}/revisions`);
  } else if (group === "revision" && action === "compare") {
    const projectId = required(positional[0], "project id");
    const base = required(positional[1], "base revision id");
    const head = required(positional[2], "head revision id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/revisions/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
  } else if (group === "process" && action === "projection") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/process-projection`);
  } else if (group === "workspace" && action === "save-state") {
    const workspaceId = required(positional[0], "workspace id");
    result = await coreRequest(`/workspaces/${encodeURIComponent(workspaceId)}/states`, {
      method: "POST",
      ...jsonBody({ name: required(option("name"), "--name") }),
    });
  } else if (group === "workspace" && action === "restore-state") {
    const workspaceId = required(positional[0], "workspace id");
    const stateId = required(positional[1], "state id");
    result = await coreRequest(`/workspaces/${encodeURIComponent(workspaceId)}/states/${encodeURIComponent(stateId)}/restore`, { method: "POST", ...jsonBody({}) });
  } else if (group === "session" && action === "summarize") {
    const projectId = required(positional[0], "project id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/session-summaries`, {
      method: "POST",
      ...jsonBody({
        title: option("title") || `Session ${new Date().toISOString().slice(0, 10)}`,
        summary: required(option("summary"), "--summary"),
        ...(option("runs") ? { runIds: option("runs").split(",") } : {}),
        ...(option("handoff") ? { handoffRef: option("handoff") } : {}),
      }),
    });
  } else if (group === "session" && action === "list") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/session-summaries`);
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
  } else if (group === "run" && action === "pending") {
    const projectId = required(positional[0], "project id");
    const reviews = await coreRequest(`/projects/${encodeURIComponent(projectId)}/runs?limit=${encodeURIComponent(option("limit") || "100")}`);
    result = reviews.filter((item) =>
      ["created", "queued", "running"].includes(item.run?.status)
      && item.dispatch?.status === "bound");
  } else if (group === "run" && action === "create") {
    const projectId = required(positional[0], "project id");
    const instruction = required(option("instruction"), "--instruction");
    const outputIntent = required(option("output"), "--output (create|revise|analyze)");
    const payload = {
      instruction,
      ...(option("target") ? { targetArtifactId: option("target") } : {}),
      outputIntent,
      requestedProvider: option("provider") || "workbuddy",
    };
    if (rest.includes("--dry-run")) {
      result = { dryRun: true, projectId, method: "POST", path: `/projects/${encodeURIComponent(projectId)}/runs`, payload };
    } else {
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/runs`, {
        method: "POST",
        ...jsonBody(payload),
        timeoutMs: 60_000,
      });
    }
  } else if (group === "run" && action === "dispatch") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/dispatch`, { method: "POST", ...jsonBody({}), timeoutMs: 60_000 });
  } else if (group === "run" && action === "recover") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/recover`, { method: "POST", ...jsonBody({}), timeoutMs: 60_000 });
  } else if (group === "run" && action === "finalize") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/finalize`, {
      method: "POST",
      ...jsonBody({ decision: option("decision") || "completed", ...(option("comment") ? { comment: option("comment") } : {}) }),
    });
  } else if (group === "run" && action === "show") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/review`);
  } else if (group === "run" && action === "sync") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/sync`, { method: "POST", ...jsonBody({}) });
  } else if (group === "run" && action === "claim") {
    const runId = required(positional[0], "run id");
    const task = await bridgeTaskForRun(runId);
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/claim`, {
      method: "POST",
      ...jsonBody({ provider: "codex", workerId: option("worker") || "local-codex" }),
    });
  } else if (group === "run" && action === "start") {
    const task = await bridgeTaskForRun(required(positional[0], "run id"));
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/running`, {
      method: "POST",
      ...jsonBody({ workerId: option("worker") || "local-codex" }),
    });
  } else if (group === "run" && action === "heartbeat") {
    const task = await bridgeTaskForRun(required(positional[0], "run id"));
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/heartbeat`, {
      method: "POST",
      ...jsonBody({ workerId: option("worker") || "local-codex" }),
    });
  } else if (group === "run" && action === "fail") {
    const runId = required(positional[0], "run id");
    const task = await bridgeTaskForRun(runId);
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(task.taskId)}/result`, {
      method: "POST",
      ...jsonBody({
        contractVersion: "bridge-result-v1",
        taskId: task.taskId,
        lcosRunId: task.lcosRunId ?? runId,
        providerStatus: "failed",
        summary: option("summary") || "Task failed.",
        changedFiles: [],
      }),
    });
  } else if (group === "run" && action === "context") {
    const runId = required(positional[0], "run id");
    const review = await coreRequest(`/runs/${encodeURIComponent(runId)}/review`);
    result = await coreRequest(`/projects/${encodeURIComponent(review.run.projectId)}/context-manifests/v0/${encodeURIComponent(review.run.contextManifestId)}`);
  } else if (group === "context" && action === "watch") {
    const projectId = required(positional[0], "project id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context?afterVersion=${Number(option("after") || 0)}`);
  } else if (group === "context" && action === "propose") {
    const projectId = required(positional[0], "project id");
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`);
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/context-proposals`, {
      method: "POST",
      ...jsonBody({
        baseContextVersion: active.version,
        addViewIds: (option("add") || "").split(",").filter(Boolean),
        removeViewIds: (option("remove") || "").split(",").filter(Boolean),
        ...(option("target") ? { targetViewId: option("target") } : {}),
        reason: required(option("reason"), "--reason"),
      }),
    });
  } else if (group === "context" && action === "accept") {
    const projectId = required(positional[0], "project id");
    const proposalId = required(positional[1], "proposal id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/context-proposals/${encodeURIComponent(proposalId)}/accept`, { method: "POST", ...jsonBody({}) });
  } else if (group === "context" && action === "reject") {
    const projectId = required(positional[0], "project id");
    const proposalId = required(positional[1], "proposal id");
    result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/context-proposals/${encodeURIComponent(proposalId)}/reject`, { method: "POST", ...jsonBody({}) });
  } else if (group === "context" && action === "proposals") {
    result = await coreRequest(`/projects/${encodeURIComponent(required(positional[0], "project id"))}/context-proposals`);
  } else if (group === "run" && action === "cancel") {
    result = await coreRequest(`/runs/${encodeURIComponent(required(positional[0], "run id"))}/cancel`, { method: "POST", ...jsonBody({}) });
  } else if (group === "run" && action === "events") {
    const runId = required(positional[0], "run id");
    const query = option("after") === undefined ? "" : `?after=${encodeURIComponent(option("after"))}`;
    result = await coreRequest(`/runs/${encodeURIComponent(runId)}/events${query}`);
  } else if (group === "run" && action === "accept") {
    const returnId = required(positional[0], "artifact return id");
    result = await coreRequest(`/artifact-returns/${encodeURIComponent(returnId)}/accept`, {
      method: "POST",
      ...jsonBody({ expectedBaseRevisionId: required(option("base-revision"), "--base-revision") }),
    });
  } else if (group === "run" && action === "reject") {
    result = await coreRequest(`/artifact-returns/${encodeURIComponent(required(positional[0], "artifact return id"))}/reject`, { method: "POST", ...jsonBody({}) });
  } else if (group === "run" && action === "retry") {
    result = await coreRequest(`/artifact-returns/${encodeURIComponent(required(positional[0], "artifact return id"))}/retry`, {
      method: "POST",
      ...jsonBody(option("instruction") ? { instruction: option("instruction") } : {}),
    });
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
    } else if ((await lstat(source)).isFile()) {
      const bytes = await readFile(source);
      const form = new FormData();
      form.set("file", new Blob([bytes]), basename(source));
      form.set("importRequestId", importRequestId);
      form.set("scopeId", scopeId);
      form.set("position.x", option("x") || "180");
      form.set("position.y", option("y") || "160");
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/imports`, { method: "POST", body: form, timeoutMs: 60_000 });
    } else {
      const files = await collectDirectory(source);
      const session = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions`, {
        method: "POST",
        ...jsonBody({
          importRequestId,
          rootName: option("name") || fallbackName,
          scopeId,
          x: Number(option("x") || 180),
          y: Number(option("y") || 160),
        }),
      });
      for (const file of files) {
        await coreRequest(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(session.sessionId)}/files?path=${encodeURIComponent(file.path)}`, {
          method: "PUT", headers: { "content-type": "application/octet-stream" }, body: await readFile(file.filePath), timeoutMs: 60_000,
        });
      }
      result = await coreRequest(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(session.sessionId)}/complete`, { method: "POST" });
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
    const envelope = JSON.parse(await readFile(resultPath, "utf8"));
    if (envelope.contractVersion === "bridge-result-v1" && !envelope.summary && envelope.shortSummary) {
      envelope.summary = envelope.shortSummary;
      delete envelope.shortSummary;
    }
    result = await bridgeRequest(`/v1/tasks/${encodeURIComponent(taskId)}/result`, {
      method: "POST",
      ...jsonBody(envelope),
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
  if (exitCode !== 0) process.exitCode = exitCode;
} catch (error) {
  process.stderr.write(`lcos: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function probe(requestPromise) {
  try {
    const value = await requestPromise;
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function bridgeTaskForRun(runId) {
  const response = await bridgeRequest(`/v1/tasks/by-run/${encodeURIComponent(runId)}`);
  const task = response?.task ?? response;
  const taskId = task?.taskId ?? task?.task_id;
  if (!taskId) throw new Error(`TASK_NOT_FOUND: no Bridge Task for run ${runId}.`);
  const provider = String(task?.provider ?? "unknown").toLowerCase();
  if (provider !== "codex") {
    throw new Error(`PROVIDER_MISMATCH: run ${runId} task provider is ${provider}, expected codex.`);
  }
  return { taskId, lcosRunId: task?.lcosRunId ?? task?.lcos_run_id ?? runId };
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
      files.push({
        path: relative(root, full).split(sep).join("/"),
        filePath: full,
      });
    }
  };
  await walk(root);
  return files;
}

function printHelp() {
  process.stdout.write(`LCOS Agent CLI

Project truth:
  lcos doctor
  lcos capabilities
  lcos project list
  lcos project open <root-path> --name "Project" [--import-existing|--empty]
  lcos project create <parent-path> --name "Project" [--directory folder-name]
  lcos project show <project-id>
  lcos project inspect <root-path>
  lcos project current [project-id]
  lcos project export <project-id> --to <path.lcosproj>
  lcos project export-all --to <目录> [--ids id1,id2]
  lcos project open-file <path.lcosproj> [--root <项目根目录>]
  lcos project inspect-file <path.lcosproj>
  lcos workspace list <project-id>
  lcos workspace add <workspace-id> <view...> [--by user|agent|run|import]
  lcos workspace remove <workspace-id> <view-id>
  lcos workspace move <from-workspace-id> <view-id> --to <to-workspace-id>
  lcos workspace save-state <workspace-id> --name "现场名"
  lcos workspace restore-state <workspace-id> <state-id>
  lcos selection get <project-id>
  lcos context get <project-id>
  lcos context watch <project-id> [--after N]
  lcos context search <project-id> [--q 关键词]
  lcos context add <project-id> <view...>
  lcos context remove <project-id> <view...>
  lcos context propose <project-id> --reason "..." [--add v1,v2] [--remove v3] [--target v4]
  lcos context accept <project-id> <proposal-id>
  lcos context reject <project-id> <proposal-id>
  lcos context proposals <project-id>
  lcos target set <project-id> <artifact-id> [--revision id]
  lcos target clear <project-id>
  lcos artifact inspect <artifact-id>
  lcos revision list <artifact-id>
  lcos revision compare <project-id> <base-revision-id> <head-revision-id>
  lcos process projection <project-id>
  lcos session summarize <project-id> --summary "..." [--title 标题] [--runs a,b] [--handoff ref]
  lcos session list <project-id>
  lcos manifest build <project-id> [--target <artifact-id>] [--output <description>]
  lcos run list <project-id> [--limit 20]
  lcos run pending <project-id> [--limit 100]
  lcos run create <project-id> --instruction "..." [--target artifact-id] [--output create|revise|analyze] [--provider workbuddy|codex] [--dry-run]
  lcos run propose <project-id> --prompt "..."
  lcos run dispatch <run-id>
  lcos run recover <run-id>
  lcos run finalize <run-id> [--decision completed|retrying] [--comment "..."]
  lcos run show <run-id>
  lcos run sync <run-id>
  lcos run cancel <run-id>
  lcos run events <run-id> [--after N]
  lcos run claim <run-id> [--worker local-codex]
  lcos run start <run-id> [--worker local-codex]
  lcos run heartbeat <run-id> [--worker local-codex]
  lcos run fail <run-id> [--summary "..."]
  lcos run context <run-id>
  lcos run accept <artifact-return-id> --base-revision <revision-id>
  lcos run reject <artifact-return-id>
  lcos run retry <artifact-return-id> [--instruction "..."]
  lcos resource list <project-id>
  lcos resource show <project-id> <resource-id>
  lcos resource read <project-id> <resource-id> [--path name] [--offset N] [--limit N] [--format text|raw|json_tree]
  lcos resource reanalyze <project-id> <resource-id>
  lcos resource import <project-id> <path-or-url> [--name rootName]
  lcos resource match <project-id> --instruction "..." [--output create|revise|analyze] [--limit 8]
  lcos open [project-id]
  lcos providers

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
