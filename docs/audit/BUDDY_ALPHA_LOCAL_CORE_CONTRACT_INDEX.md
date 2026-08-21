# BUDDY Alpha Local Core 合同索引

> 审计任务：task_1261468c

> **主控复核修订（2026-07-20）**：本文是 `Draft / proposed contract`，未获批准、未实现。冻结文档只支持领域边界与核心语义；具体实体数量、API 路径、SQL 字段、索引和关系基数均为候选设计，不能作为既成 Schema 或开发事实。
> 审计日期：2026-07-20
> 项目：local-creative-os
> 输出：只读合同索引，不修改 apps/local-core、packages/domain、packages/contracts、Bridge 代码/Schema/运行数据

---

## 1. 冻结来源清单

| # | 来源 | 路径 | 类型 | 冻结版本 |
|---|------|------|------|---------|
| S1 | PRD 冻结决策稿 | `OS项目文档/Local_Creative_OS_PRD_V1.2_UI冻结决策回写版.docx` | 产品宪章 | V1.2 |
| S2 | UI & Interaction Spec 冻结决策稿 | `OS项目文档/Local_Creative_OS_UI_Visual_Interaction_Spec_v0.2_冻结决策稿.docx` | 交互规范 | V0.2 |
| S3 | AGENTS.md | `AGENTS.md` | 工程规则 | 当前 HEAD |
| S4 | README.md | `README.md` | 产品定位与架构 | 当前 HEAD |
| S5 | Bridge Runtime Spine Audit | `docs/audit/BRIDGE_ALPHA_RUNTIME_SPINE_AUDIT_RETURN.md` | 运行时审计 | 2026-07-19 |
| S6 | GUI Coordination ADR | `OS项目文档/01_Current_Core/Local_Creative_OS_GUI_Project_Coordination_ADR.md` | 架构决策 | 当前 |
| S7 | PRD PM Review | `OS项目文档/01_Current_Core/Local_Creative_OS_PRD_V1_PM_Review.md` | 评审文档 | V1.0 |
| S8 | UI Spec PM Review | `OS项目文档/01_Current_Core/Local_Creative_OS_UI_Spec_v0.1_PM_Review.md` | 评审文档 | V0.1 |
| S9 | Development Requirements | `docs/DEVELOPMENT_REQUIREMENTS.md` | 开发需求 | 当前 |
| S10 | Storage/Cache/Performance Budget | `OS项目文档/01_Current_Core/Local_Creative_OS_Storage_Cache_Performance_Budget.md` | 性能预算 | 当前 |
| S11 | README_INDEX | `OS项目文档/README_INDEX.md` | 文档索引 | 当前 |

---

## 2. 核心领域对象清单

### 2.1 最小 Alpha 实体

> 来源：S4 §9【核心领域对象】

| # | 实体 | 来源 | 定义 | 关键属性 |
|---|------|------|------|---------|
| D1 | **Project** | S4 §4.1 | 唯一正式项目身份，对应一个本地根目录 + 一张 Project Canvas + 一套 Project Graph | rootDirectory, canvasId, workspaces[], artifacts[], runs[], checkpoints[] |
| D2 | **Workspace** | S4 §4.2 | Semantic Viewport，不创建独立 Canvas/Graph/真实目录 | viewport, zoom, focusedNodeIds, visibleLayers, layoutPreset, contextPolicy, selectionState, intent(nullable) |
| D3 | **Artifact** | S4 §4.3 | 真实内容身份，不复制实体文件 | artifactId, type(md/pptx/jpg/...), sourcePath, contentHash, revisions[], views[] |
| D4 | **ArtifactView** | S4 §4.3 | Artifact 在某个 Workspace 的视觉引用 | viewId, artifactId, workspaceId, position, size, displayState, lockedRevisionId(nullable) |
| D5 | **ArtifactRevision** | S4 §4.3 | Artifact 的内容变化版本 | revisionId, artifactId, contentHash, parentRevisionId, source(manual/ai/external), runId(nullable), createdAt |
| D6 | **Relation** | S4 §4.1 | 节点间语义关系 | relationId, fromNodeId, toNodeId, type(source/derived/reference/run/decision), workspaceId |
| D7 | **Note** | S4 §4.2 | 文件级或页面级备注 | noteId, targetArtifactId, targetPage(nullable), content, createdAt, updatedAt |
| D8 | **Command** | S4 §5.2 | 用户派发的执行指令 | commandId, instruction, targetArtifactId, contextSnapshotId, skillRef, executor(codex/workbuddy), outputMode |
| D9 | **Conversation** | S4 §4.4 | 执行会话容器 | conversationId, projectId, runs[], createdAt |
| D10 | **Run** | S4 §4.4 | 一次真实执行 | runId, conversationId, commandId, contextSnapshotId, executor, externalThreadId, status, changedFiles[], artifactReturns[], events[] |
| D11 | **ContextSnapshot** | S4 §5.2 | Run 的不可变上下文快照 | snapshotId, sourceRefs[], contentHash, manifestPath, createdAt, redactedFields[] |
| D12 | **SkillRef** | S4 §9 | 技能引用 | skillId, name, version, specification |
| D13 | **Checkpoint** | S4 §4.5 | 项目稳定版本快照 | checkpointId, projectId, workspaceSnapshot, canvasSnapshot, contextSnapshot, changeSet, relatedRunIds[], deliverySnapshot(nullable) |
| D14 | **SourceSnapshot** | S4 §9 | 来源文件快照（飞书等外部源） | snapshotId, sourceType(feishu/notion/local), sourceUrl, contentHash, syncedAt, syncStatus |

### 2.2 实体关系图

```
Project 1──* Workspace
Project 1──* Artifact
Project 1──* Checkpoint
Project 1──* Conversation

Artifact 1──* ArtifactView
Artifact 1──* ArtifactRevision
Artifact 1──* Note
Artifact 1──* Relation

Workspace 1──* ArtifactView
Workspace 1──* Relation

Conversation 1──* Run
Command 1──* Run / RunAttempt
Run 1──* ArtifactReturn
Run *──1 immutable ContextSnapshot
Run 1──* RunEvent
```

---

## 3. 合同边界清单

### 3.1 packages/contracts 合同

> 来源：S3 §6【packages/contracts 放边界接口】

| # | 合同 | 来源 | 职责 | 核心方法签名 |
|---|------|------|------|------------|
| C1 | **Repository** | S3 §6 | 数据持久化边界 | getById, query, save, delete, list (泛型) |
| C2 | **Runtime** | S3 §6, S5 §4 | 执行运行时边界 | createRun, getRunStatus, cancelRun, continueRun, submitResult |
| C3 | **Connector** | S3 §6 | 外部服务连接边界 | connect, disconnect, getStatus, sync, getSnapshot |
| C4 | **Preview** | S3 §6 | 文件预览边界 | getThumbnail, getPagePreview, getOriginal, getMetadata |
| C5 | **Context** | S3 §6 | 上下文管理边界 | buildSnapshot, getSources, excludeSource, validateSnapshot |
| C6 | **Version** | S3 §6 | 版本管理边界 | createRevision, getRevisionHistory, compareRevisions, rollback |

### 3.2 Local Core API 合同

> 来源：S3 §8【apps/local-core 负责 Project/Workspace/文件/SQLite/Context/Runtime/Connector/Version/事件/安全】

| # | API 端点 | 来源 | 方法 | 请求体 | 响应体 |
|---|---------|------|------|-------|-------|
| L1 | `/api/projects` | S3, S4 | GET/POST | `{ rootDirectory, name? }` | `{ projectId, name, rootDirectory }` |
| L2 | `/api/projects/:id/workspaces` | S4 §4.2 | GET/POST | `{ name, intent? }` | `{ workspaceId, name, viewport, ... }` |
| L3 | `/api/projects/:id/artifacts` | S4 §4.3 | GET/POST | `{ sourcePath, type }` | `{ artifactId, contentHash, type }` |
| L4 | `/api/artifacts/:id/views` | S4 §4.3 | POST | `{ workspaceId, position, size }` | `{ viewId, ... }` |
| L5 | `/api/artifacts/:id/revisions` | S4 §4.3 | GET | - | `[{ revisionId, contentHash, source, createdAt }]` |
| L6 | `/api/artifacts/:id/notes` | S4 §4.2 | GET/POST | `{ content, page? }` | `{ noteId, content, createdAt }` |
| L7 | `/api/projects/:id/relations` | S4 §4.1 | GET/POST | `{ from, to, type }` | `{ relationId }` |
| L8 | `/api/projects/:id/commands` | S4 §5.2 | POST | `{ instruction, targetId, contextSnapshotId, executor, outputMode }` | `{ commandId }` |
| L9 | `/api/runs` | S5 §4 | POST | `{ commandId, contextSnapshot }` | `{ runId, bridgeTaskId?, status }` |
| L10 | `/api/runs/:id/status` | S5 §4 | GET | - | `{ runId, status, events[], changedFiles[], artifacts[] }` |
| L11 | `/api/runs/:id/events` | S5 §4 | GET (SSE) | `Last-Event-ID?` | `event: run.{type}\ndata: { eventId, sequence, payload }` |
| L12 | `/api/runs/:id/continue` | S5 §4 | POST | `{ input, choice }` | `{ runId, status: queued }` |
| L13 | `/api/runs/:id/cancel` | S5 §4 | POST | - | `{ runId, status }` |
| L14 | `/api/projects/:id/checkpoints` | S4 §4.5 | GET/POST | `{ workspaceSnapshot?, canvasSnapshot?, changeSet, relatedRunIds[] }` | `{ checkpointId }` |
| L15 | `/api/health` | S3 §12 | GET | - | `{ status, localCoreVersion, bridgeConnected, dbStatus }` |

### 3.3 事件合同

> 来源：S5 §4.2【Event / SSE contract】

| # | 事件类型 | 来源 | 触发条件 | payload |
|---|---------|------|---------|---------|
| E1 | `run.queued` | S5 §4.2 | createRun 成功 | `{ runId, commandId, executor, createdAt }` |
| E2 | `run.started` | S5 §4.2 | executor 确认开始 | `{ runId, externalThreadId, startedAt }` |
| E3 | `run.waiting_input` | S5 §4.2 | 需要用户输入 | `{ runId, question, choices[], deadline? }` |
| E4 | `run.review_ready` | S5 §4.2 | executor 返回结果 | `{ runId, changedFiles[], artifacts[], warnings[] }` |
| E5 | `run.completed` | S5 §4.2 | 用户 Accept | `{ runId, checkpointId?, completedAt }` |
| E6 | `run.failed` | S5 §4.2 | 终端执行失败 | `{ runId, error: { code, message, retryable } }` |
| E7 | `run.cancel_requested` | S5 §4.2 | 请求取消 | `{ runId, requestedAt, reason? }` |
| E8 | `run.cancelled` | S5 §4.2 | executor 确认取消 | `{ runId, cancelledAt }` |
| E9 | `run.retry_queued` | S5 §4.2 | retryRun | `{ runId, attempt, reason, queuedAt }` |

---

## 4. SQLite Schema 草案

> 来源：S3 §10, S4 §7, S10【Storage/Cache/Performance Budget】
> 规则：只存元数据和关系，不存大 BLOB；原始文件默认链接；schemaVersion + migration 必须存在

### 4.1 核心表

```sql
-- 项目
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_directory TEXT NOT NULL,
    canvas_id TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workspace
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    viewport_x REAL DEFAULT 0,
    viewport_y REAL DEFAULT 0,
    zoom REAL DEFAULT 1.0,
    focused_node_ids TEXT,         -- JSON array
    visible_layers TEXT,           -- JSON array
    layout_preset TEXT,
    context_policy TEXT,
    selection_state TEXT,          -- JSON
    intent TEXT,                   -- nullable
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Artifact（内容身份，不存文件内容）
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,            -- md/pptx/jpg/png/pdf/...
    source_path TEXT NOT NULL,
    name TEXT NOT NULL,
    content_hash TEXT,
    mime_type TEXT,
    metadata TEXT,                 -- JSON: 尺寸/页数/时长等
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ArtifactView（Canvas 视觉引用）
CREATE TABLE artifact_views (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    width REAL,
    height REAL,
    display_state TEXT DEFAULT 'normal',  -- normal/collapsed/highlighted
    locked_revision_id TEXT,              -- nullable
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reference_slot TEXT NOT NULL DEFAULT 'primary',
    UNIQUE(artifact_id, workspace_id, reference_slot) -- 默认 primary；显式额外引用使用独立 slot
);

-- ArtifactRevision
CREATE TABLE artifact_revisions (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    content_hash TEXT NOT NULL,
    parent_revision_id TEXT,
    source TEXT NOT NULL,          -- manual/ai/external
    run_id TEXT,                   -- nullable, 关联 Run
    created_at TEXT NOT NULL
);

-- Relation
CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    type TEXT NOT NULL,            -- source/derived/reference/run/decision
    workspace_id TEXT,
    metadata TEXT,                 -- JSON
    created_at TEXT NOT NULL
);

-- Note
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    target_artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    target_page INTEGER,           -- nullable, PPT/PDF 当前页
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Command
CREATE TABLE commands (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    instruction TEXT NOT NULL,
    target_artifact_id TEXT REFERENCES artifacts(id),
    context_snapshot_id TEXT,
    skill_ref TEXT,                -- JSON
    executor TEXT NOT NULL,        -- codex/workbuddy
    output_mode TEXT NOT NULL,     -- new_revision/new_artifact/modify_in_place
    created_at TEXT NOT NULL
);

-- Conversation
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    created_at TEXT NOT NULL
);

-- Run（核心执行记录）
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id),
    command_id TEXT NOT NULL REFERENCES commands(id),
    context_snapshot_id TEXT NOT NULL,
    executor TEXT NOT NULL,
    external_thread_id TEXT,       -- Codex thread / Buddy task ID
    status TEXT NOT NULL,          -- queued/running/waiting_input/review/completed/failed/cancelled
    attempt INTEGER DEFAULT 1,
    idempotency_key TEXT UNIQUE,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL
);

-- ContextSnapshot（不可变）
CREATE TABLE context_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    manifest_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    source_refs TEXT NOT NULL,     -- JSON: [{ artifactId, path, revisionId }]
    created_at TEXT NOT NULL
);

-- Checkpoint
CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    workspace_snapshot TEXT,       -- JSON
    canvas_snapshot TEXT,          -- JSON
    change_set TEXT,               -- JSON
    related_run_ids TEXT,          -- JSON array
    delivery_snapshot TEXT,        -- nullable JSON
    created_at TEXT NOT NULL
);

-- RunEvent（有序事件流）
CREATE TABLE run_events (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL,
    run_id TEXT NOT NULL REFERENCES runs(id),
    type TEXT NOT NULL,            -- run.queued/run.started/...
    payload TEXT,                  -- JSON
    occurred_at TEXT NOT NULL
);

-- WriteLease（文件写锁）
CREATE TABLE write_leases (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    path TEXT NOT NULL,
    before_hash TEXT,
    acquired_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'  -- active/released/expired
);

-- SkillRef
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    specification TEXT,            -- JSON
    created_at TEXT NOT NULL
);
```

### 4.2 索引

```sql
CREATE INDEX idx_workspaces_project ON workspaces(project_id);
CREATE INDEX idx_artifacts_project ON artifacts(project_id);
CREATE INDEX idx_artifact_views_artifact ON artifact_views(artifact_id);
CREATE INDEX idx_artifact_views_workspace ON artifact_views(workspace_id);
CREATE INDEX idx_artifact_revisions_artifact ON artifact_revisions(artifact_id);
CREATE INDEX idx_relations_project ON relations(project_id);
CREATE INDEX idx_notes_artifact ON notes(target_artifact_id);
CREATE INDEX idx_commands_project ON commands(project_id);
CREATE INDEX idx_runs_conversation ON runs(conversation_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_executor ON runs(executor);
CREATE INDEX idx_run_events_run ON run_events(run_id);
CREATE INDEX idx_run_events_sequence ON run_events(run_id, sequence);
CREATE INDEX idx_write_leases_run ON write_leases(run_id);
CREATE INDEX idx_write_leases_path ON write_leases(path, status);
CREATE INDEX idx_checkpoints_project ON checkpoints(project_id);
```

---

## 5. 状态机合同

### 5.1 Alpha Run 状态机

> 来源：S5 §3.2【Required Alpha Run state machine】

```
        ┌──────────┐
        │  queued  │◄───────────── retryRun ─────────┐
        └────┬─────┘                                  │
             │ executor acknowledged                  │
        ┌────▼─────┐     question/conflict     ┌──────┴──────┐
        │  running │──────────────────────────►│waiting_input│
        └────┬─────┘                            └──┬──┬──┬───┘
             │                                     │  │  │
    ┌────────┼────────┬────────┐          continueRun │  │ cancel
    │        │        │        │              ┌───────┘  │    │
┌───▼──┐ ┌──▼──┐ ┌───▼───┐ ┌──▼───┐     ┌──▼──┐   ┌───▼──┐ │
│review│ │failed│ │cancel │ │cancel │     │queued│   │cancel│ │
└───┬──┘ └─────┘ │request│ │confrm │     └─────┘   └──────┘ │
    │             └───────┘ └──────┘                          │
    │ user accepts                                            │
┌───▼──────┐                                                 │
│completed │                                                 │
└──────────┘                                                 │
```

### 5.2 非法转换

> 来源：S5 §3.3

- `review → completed` 必须由 OS/用户 Acceptance 驱动，不由 executor 触发
- `waiting_input → running` 不得静默；需要 `continueRun` 载荷和事件
- `running → completed` 非法；executor 只能返回 `review`
- 写锁冲突的 Run 不得进入 `running`；进入 `waiting_input` 或保持 `queued`
- retry 必须创建可审计的 attempt/lineage 记录，不得覆盖前次结果

### 5.3 文件冲突合同

> 来源：S5 §5.1

```
createRun
  → normalize projectRoot + requestedWriteSet
  → acquire write lease per target path
  → record beforeHash
  → execute
  → re-read hash before each write
  → if changed externally: waiting_input (stale)
  → user chooses: new revision / overwrite with recovery / cancel
```

---

## 6. 三阶段可合同化判定

### 阶段说明

- **Prototype（当前原型）**：Make V9 交互原型 + AdFrame 旧仓库
- **Frontend Alpha**：React App Shell + Canvas + Command + Inspector（无 Local Core）
- **Full Alpha**：Local Core + SQLite + Bridge Runtime + 完整闭环

### 6.1 域实体合同化判定

| # | 实体 | Prototype | Frontend Alpha | Full Alpha | 判定依据 |
|---|------|-----------|---------------|------------|---------|
| D1 | Project | Mock fixture | 内存 Store | SQLite 持久化 | S4 §4.1 |
| D2 | Workspace | Viewport 状态 | Zustand + 相机 | Local Core API | S4 §4.2 |
| D3 | Artifact | 静态 fixture | React state | SQLite + 文件引用 | S4 §4.3 |
| D4 | ArtifactView | 内联渲染 | 独立组件 | SQLite + 坐标持久化 | S4 §4.3 |
| D5 | ArtifactRevision | 模拟数据 | 内存数组 | SQLite + contentHash | S4 §4.3 |
| D6 | Relation | 硬编码连线 | React Flow edge | SQLite + 语义类型 | S4 §4.1 |
| D7 | Note | Toast 占位 | 内联编辑 | SQLite + 页级绑定 | S4 §4.2 |
| D8 | Command | App.tsx 内联 | 独立组件 + 渐进披露 | SQLite + ContextSnapshot | S4 §5.2 |
| D9 | Conversation | 不存在 | 内存容器 | SQLite + 1:N Run | S4 §4.4 |
| D10 | Run | 模拟状态 | Bridge task 映射 | Bridge Runtime + 事件流 | S5 §4 |
| D11 | ContextSnapshot | 不存在 | JSON payload | SQLite + contentHash + 不可变 | S5 §4.1 |
| D12 | SkillRef | 固定字符串 | 配置文件 | SQLite + 规范加载 | S3 §6 |
| D13 | Checkpoint | 模拟创建 | 内存快照 | SQLite + Canvas/Workspace 快照 | S4 §4.5 |
| D14 | SourceSnapshot | 不存在 | 不存在 | SQLite + 飞书同步 | S4 §9 |

### 6.2 合同接口合同化判定

| # | 合同 | Prototype | Frontend Alpha | Full Alpha | 判定依据 |
|---|------|-----------|---------------|------------|---------|
| C1 | Repository | Mock 实现 | TypeScript 接口 | SQLite Adapter | S3 §6 |
| C2 | Runtime | 不存在 | Bridge MCP 映射 | Bridge Runtime Spine (Slice 1-4) | S5 §4 |
| C3 | Connector | 不存在 | 不存在 | 飞书 Snapshot Adapter | S3 §6 |
| C4 | Preview | ImageWithFallback | PDF.js/图片预览 | PPT 转换 + 多格式 | S4 §7 |
| C5 | Context | Toast 占位 | Context Lens UI | ContextSnapshot + contentHash | S5 §4.1 |
| C6 | Version | 不存在 | Revision 数组 | SQLite + 回滚 | S4 §4.3 |

### 6.3 不可实现项（Alpha 范围外）

以下在冻结文档中明确标记为 Alpha 不做 or 暂缓，当前不做合同化：

| 项目 | 来源 | 计划阶段 |
|------|------|---------|
| 三视图完整实现（时间/思维导图/自由布局） | S4 §3 | Beta |
| 飞书写回与变化监听 | S4 §3, S7 §4.3 | P1/Phase 4 |
| Notion 集成 | S4 §3 | Phase 4 |
| Buddy 深度集成 | S4 §3 | Phase 4 |
| 跨项目搜索 | S4 §3 | Phase 4 |
| 自动整理本地目录 | S4 §3 | Beta |
| 自动版本建议 | S4 §3 | Beta |
| Figma/Canva 直接执行 | S4 §3 | 不做 |
| 多人协作 | S4 §3 | 不做 |
| Electron/Tauri | S4 §3 | 不做 |
| 插件市场 | S4 §3 | Alpha 不建 |
| 多 Agent 自由编排 | S3 §6 | 不做 |
| 视频逐帧/完整代理/画面级 Diff | S4 §3 | 不做 |
| Delivery Bundle 完整系统 | S4 §3 | Phase 4 |
| 完整 Connector 设置中心 | S7 §4.3 | 暂缓 |

---

## 7. 当前实现差距

| 维度 | 冻结要求 | 当前状态 | 差距 |
|------|---------|---------|------|
| 域类型 | TypeScript Domain Types 冻结 | 无独立 packages/domain | 全部待建 |
| SQLite Schema | 冻结 + schemaVersion + migration | 无实现 | 全部待建 |
| Local Core API | REST/SSE 合同 | 无实现 | 全部待建 |
| Bridge Runtime | waiting_input + 事件流 + 写锁 + 结构化错误 | 现有 task 生命周期，缺 waiting_input/event/lease/error | Slice 1-4 实施 |
| Preview | 图片/MD/PDF.js/PPT 转换 | ImageWithFallback 占位 | 多格式待实现 |
| ContextSnapshot | 不可变 + contentHash | 不存在 | Full Alpha 实现 |
| 安全边界 | 127.0.0.1 loopback | Bridge 接受任意 --host | 待锁定 |
| 凭证管理 | `.gitignore` 已存在；`.env.example` 仅在需要环境变量时建立 | 当前无凭证文件进入 Git | 候选合同需继续保持脱敏与 loopback 约束 |
| 测试基线 | lint/typecheck/unit/build/smoke | lint+build 通过，typecheck/test/smoke 缺 | 待补齐 |

---

## 8. 建议实施顺序

1. **冻结 packages/domain 类型**：从 S4 §9 的 14 个实体出发，TypeScript 类型先行
2. **冻结 packages/contracts 接口**：6 个边界接口（Repository/Runtime/Connector/Preview/Context/Version）
3. **建立 SQLite Schema**：基于第 4 节草案 + migration 策略
4. **Bridge Slice 1+2**：Run identity + 事件流 + waiting_input（依赖 S5 决策）
5. **Local Core API 骨架**：15 个端点，先 stub 后实现
6. **Preview Adapter**：先图片/MD，再 PPT/PDF
7. **安全与凭证**：.gitignore + .env.example + loopback 锁定
8. **测试管线**：lint → typecheck → unit → build → smoke

---

## 9. 结论

Local Creative OS 的领域边界和核心状态语义已由冻结文档限定；本文整理的实体、边界合同、Local Core API、事件和 SQL 均是供评审的候选索引，不是获批 Schema，也不是已实现能力。

当前实现差距集中在三个层面：(1) 域类型与合同接口尚无独立包实现；(2) Bridge 缺少 waiting_input/事件流/写锁/结构化错误四个关键能力；(3) Local Core/SQLite/Preview 全部待建。

三阶段实施范围明确——Prototype 应仅限交互讨论，Frontend Alpha 做 App Shell + Canvas + Command 的纯前端闭环，Full Alpha 才接通 Bridge Runtime + Local Core + SQLite。
