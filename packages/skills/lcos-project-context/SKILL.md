---
name: lcos-project-context
description: Read Local Creative OS Project Truth and ActiveContext, open its visual canvas, and execute a pulled Light Bridge task without bypassing Artifact Return.
---

# LCOS Project Context

Use this skill when a task is bound to a Local Creative OS project.

## 1. Architecture boundary

```
LCOS Canvas / Project Truth  ←→  Local Core (127.0.0.1:43121)
Local Core                   ←→  Light Bridge (127.0.0.1:43122)
Light Bridge                 ←→  Agent (claim / start / submit)

Project MCP: read Project Truth / ActiveContext / ContextManifest / Runs, and
             create / dispatch / recover / finalize Runs plus accept / reject /
             retry Artifact Returns (writes go through Local Core HTTP; the MCP
             proxy never touches SQLite)
Bridge MCP:  task lifecycle (claim / start / get / submit / cancel)
```

**Boundary rules**

- Light Bridge owns task lifecycle (status, provider, result). Never replicate its state machine inside a Project tool or Skill.
- Local Core owns Project Truth (Artifact, Revision, Current pointer). Bridge `task_id` is an external mapping, NOT an LCOS `runId`.
- The stdio LCOS MCP (`tools/lcos-agent/mcp-server.mjs`) is a thin proxy: every bridge tool is one `fetch()` to Light Bridge REST. No queuing, no retry loops, no SQLite access.
- Light Bridge's own `/mcp` endpoint (9 tools including `claim_task` / `start_task` / `submit_result`) is an alternative for agents that prefer direct MCP; the LCOS MCP delegates through the REST API for clarity and auditability.

## 2. Call order for a full execution

### Read phase (all agents)

1. `list_lcos_projects` — only when the project is unknown.
2. `get_lcos_active_context` — read the latest stable Canvas selection and resolved artifacts before interpreting the user's current visual selection.
3. `get_lcos_project` — read identities and relationships; do not infer Project Truth from screenshots alone.
4. `build_lcos_context_manifest` — freeze an immutable ContextManifest from Project Truth **immediately before** creating or executing a Run.

### Execute phase (WorkBuddy / Codex as Agent)

Agent-initiated run:

```text
create_lcos_run(projectId, instruction, outputIntent, targetArtifactId?)
  // outputIntent is REQUIRED: create | revise | analyze
→ dispatch_lcos_run(runId)
→ claim_lcos_task(provider, worker_id)
→ start_lcos_task(task_id, worker_id)
→ execute within outputRoot only
→ submit_lcos_result(task_id, resultEnvelope)
→ get_lcos_run(runId)          // review projection
→ accept_lcos_return / reject_lcos_return / retry_lcos_return
```

### Codex native loop（会话内主动接单）

```text
bind_lcos_project(projectId)          // 会话绑定：doctor + 项目 + ActiveContext 快照
get_lcos_active_context(projectId)    // 读取当前选择 / Target / Context
list_lcos_pending_runs(projectId)     // 本会话每个回合最多检查一次
claim_lcos_run(runId, workerId)       // 原子认领（provider=codex 隔离）
get_lcos_run_context(runId)           // 冻结 Manifest，不是实时 ActiveContext
start_lcos_run(runId, workerId)
heartbeat_lcos_run(runId, workerId)   // 有界续租，不无限轮询
submit_lcos_result / fail_lcos_run
```

主动检查时机：会话首次绑定后、用户每次发言后、完成一个 LCOS Run 后、用户明确要求时。
禁止无限后台轮询；一次 Agent 回合最多检查一次。
Codex 建议增删 Context 只能走 `propose_lcos_context_change`，用户 Accept 后才生效；
Running Run 的冻结 Manifest 不随实时 Selection 变化。

### 收到看门狗派单提示

当用户消息以「LCOS 接单提示」开头时，说明 LCOS 看门狗把一个待办送到了本会话：

1. 从消息中取出 `run <id>` 与项目名；如本会话未绑定该项目，先 `bind_lcos_project`；
2. `claim_lcos_run(runId, workerId)` → `get_lcos_run_context(runId)` → `start_lcos_run`；
3. 按冻结 Manifest 执行（只写 Staging），提交 `submit_lcos_result` 或 `fail_lcos_run`；
4. 结束后简短汇报，不再重复扫描其他待办（一次回合只处理派单这一条）。

Pulled-task flow (no LCOS run creation):

```text
claim_lcos_task(provider, worker_id)
→ inspect TaskEnvelope and RuntimeInputPack
→ get_lcos_task(task_id)   // re-read if needed
→ start_lcos_task(task_id, worker_id)
→ execute within outputRoot only
→ submit_lcos_result(task_id, resultEnvelope)
```

### Bridge only — do NOT call from Local Core

- `claim_lcos_task` — call from MCP, NOT from Local Core HTTP routes
- `start_lcos_task` — call from MCP, NOT from Local Core HTTP routes
- `submit_lcos_result` — call from MCP, NOT from Local Core HTTP routes

These MCP tools are thin `bridgeRequest()` delegates. Do not reimplement any state machine logic (queues, timeouts, dead-letter, worker affinity) in the agent or the MCP proxy.

## 3. OutputIntent

Bridge V1 tasks carry an `output_intent`:

| Intent   | Meaning                                              |
|----------|------------------------------------------------------|
| `create` | Agent produces a new artifact from scratch           |
| `revise` | Agent modifies an existing artifact (draft output)   |
| `analyze`| Agent produces analysis/report without file changes  |

`output_intent` must be passed explicitly by the Web Run Composer, CLI, or MCP — Local Core rejects Run creation without it (no implicit `revise` default). `revise` requires `targetArtifactId`; `create` may create 1–5 new files under `outputRoot`; `analyze` must return zero changed files. Output is written to `outputRoot` (set by the TaskEnvelope), never overwriting source files directly. The task's `output_policy` further constrains where and how outputs may land.

## 4. changed_files

Every `submit_lcos_result` must include `changed_files` — a structured array:

```json
{
  "changed_files": [
    {
      "path": "absolute path",
      "action": "created | modified",
      "contentHash": "optional sha256"
    }
  ]
}
```

- Paths must be absolute.
- Only the files produced by this Run should appear.
- Source input files MUST NOT be reported as changed.
- Light Bridge validates paths against the task's `outputRoot` and `output_policy`.

## 5. Draft / Pending / Accept / Reject / Retry lifecycle

```
Agent submit → providerStatus: "review"
→ Local Core ingests result
→ creates Pending ArtifactReturn + Draft Revision
→ User Accept → Draft → Current, old Current → Superseded
→ User Reject → Draft preserved as Evidence, ArtifactReturn → rejected
→ User Retry  → new Canonical Run (with retryOfRunId), new RuntimeDispatch
```

- Execution complete ≠ user accepted.
- Accept is the only path to update Current.
- Reject preserves evidence, never updates Current.
- Retry creates a NEW Run (old Run stays finalized).

## 6. Agent Browser

`open_lcos(projectId)` returns:

```
http://127.0.0.1:5173/?agent=1&project=<projectId>
```

- This page shares the SAME Canvas as the main LCOS UI.
- The Agent Context Surface projects Workspace, Selection, and Context version from the MCP.
- No second Canvas or tldraw instance is created.

## 7. Feishu link context

- In-app "Add Link" saves a Feishu URL as a `.link.md` Artifact (URL, title, resource type, purpose, user-authored summary).
- When explicitly selected into Context, it freezes into the ContextManifest.
- LCOS does NOT scrape private Feishu page contents without an authenticated browser/tool.
- Do NOT claim private page contents were read unless an authorized tool actually opened them.

## 8. Safety rules

- **Never modify source files.** All agent output goes to `outputRoot` or staging paths.
- **Never auto-Accept.** The agent returns `providerStatus: "review"`; only the user Accepts.
- **Never write outside outputRoot.** Light Bridge validates paths.
- **One task at a time.** Never claim a second task while one is running.
- **Read ActiveContext before acting.** Selection may have changed since task creation.
- **ContextManifest is immutable per Run.** A selection change after Run creation does not silently alter that Run's manifest.
- **Cancel is honoured.** If `cancel_requested_at` is set, stop execution and report status as `cancelled` (not `review`).
- **Bridge Task is execution truth, not LCOS Artifact Truth.** returned files remain Pending until Local Core processes them.
- **Loopback only.** All MCP tools enforce `127.0.0.1` / `localhost` / `[::1]` in client.mjs.
- **No direct SQLite.** Neither the MCP proxy nor the agent touches SQLite directly.
- **Context proposals are reviewable.** Codex never applies Context/Target changes directly; `accept_lcos_context_proposal` is the only path.
- **No silent context expansion.** Shelf 未显示的对象不得进入本次 Context；建议也必须可见可拒。

## 9. Testing

Each execution should verify:

- `claim_lcos_task` returns a valid TaskEnvelope with `outputRoot`
- `start_lcos_task` flips status to `running`
- `submit_lcos_result` with a valid ResultEnvelope returns `ok: true`
- `get_lcos_task` reflects the latest status
- `cancel_lcos_task` marks the task `cancelled`
- The Light Bridge canary (`npm run bridge -- canary`) passes
- The LCOS MCP smoke (`initialize` + `tools/list`) passes

## 10. Example: full WorkBuddy agent flow

```text
// 1. Claim a pull task
claim_lcos_task("workbuddy", "buddy-local")
→ { task: { task_id: "...", lcos_run_id: "...", status: "assigned", ... } }

// 2. Read context (already in context or via MCP)
get_lcos_active_context("disposable-mvp-sample")
get_lcos_project("disposable-mvp-sample")

// 3. Start execution
start_lcos_task("task_xxx", "buddy-local")
→ { task: { status: "running", ... } }

// 4. Execute — write only inside outputRoot

// 5. Submit result
submit_lcos_result("task_xxx", {
  contractVersion: "bridge-result-v1",
  taskId: "task_xxx",
  lcosRunId: "run-yyy",
  providerStatus: "review",
  summary: "Created revised script with closure sentence added.",
  changedFiles: [
    { path: "E:\\...\\staging\\script-draft.md", action: "created" }
  ],
  warnings: [],
  suggestedNextActions: ["review_draft"]
})
→ { ok: true, task: { status: "running", provider_status: "review", ... } }

// 6. Verify
get_lcos_task("task_xxx")
→ { task: { provider_status: "review", result: { ... }, ... } }
```
