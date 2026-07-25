# Local Creative OS — Phase 2.5 Data Spine Cleanup 技术方案

> 架构师审阅用。基于 Phase 2D Bridge 报告的反馈，对数据核心层进行结构性清理。

---

## 1. 一句话概括

**Phase 2.5 做的事情**：把 Phase 2 期间形成的「前端 Canvas 显示模型反向定义后端 Domain」的错位纠正过来。核心纪律——Canvas 是 Project Graph 的投影，不是 Project Graph 本身。

---

## 2. 整体架构

```
┌─────────────────────────────────────────────┐
│  Browser (localhost:5173)                    │
│  ┌───────────────────────────────────────┐  │
│  │ App.tsx (React, 状态持有者)            │  │
│  │  └─ runtimeBridge.ts (Phase 2.5 重写) │  │
│  │      └─ localCoreClient.ts            │  │
│  └───────────────────────────────────────┘  │
│              │ Vite Proxy                    │
│              │ /api/local-core/v1 → 43121   │
└──────────────┼──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Local Core (localhost:43121)                │
│  ┌───────────────────────────────────────┐  │
│  │ server.ts (native http)               │  │
│  │  GET /projects/:id/graph  整图读取    │  │
│  │  PUT /projects/:id/graph  整图替换    │  │
│  │  POST /projects/:id/graph  增量变更   │  │
│  │  + 单实体 CRUD 路由                   │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ SqliteMetadataRepository               │  │
│  │  save()    整图事务写入               │  │
│  │  get()     整图读取                   │  │
│  │  applyMutations() 增量 mutation        │  │
│  │  + 公开单实体 CRUD                     │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ node:sqlite (DatabaseSync, WAL)       │  │
│  │ phase2.sqlite → schema v3, 8 张表      │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

packages/domain    ← 纯类型，不与任何传输/存储耦合
packages/contracts  ← HTTP DTO, Mutation DTO
```

---

## 3. 核心设计决策

### 3.1 三层模型分离

| 层 | 位置 | 职责 | 例子 |
|---|------|------|------|
| **Domain** | `packages/domain` | 业务实体，纯类型 | `Artifact`, `Scope`, `Relation` |
| **Contracts** | `packages/contracts` | HTTP 输入/输出，运行时验证 | `ProjectGraphSnapshot`, `MutationBatch` |
| **ViewModel** | `apps/web/src/model.ts` | 前端显示模型 | `CanvasNode`, `CanvasEdge`, `Workspace` |

**纪律**：Domain 不导入 Contracts。Contracts 不导入任何具体实现。ViewModel 通过 Bridge 适配器与 Contracts 通信。

### 3.2 Canvas 是投影

```
Domain Entity (Artifact + ArtifactView)
    │
    ▼  runtimeBridge.mapGraphToState()
ViewModel (CanvasNode)
    │
    ▼  用户操作
Canvas 修改 ViewModel
    │
    ▼  runtimeBridge.mapStateToGraph()
Domain Entity (PutGraphSnapshot)
    │
    ▼  事务写入
SQLite
```

**不再允许**：CanvasNode → 猜测 Artifact 字段。必须是 Domain → Adapter → CanvasNodeVM。

### 3.3 graphVersion 乐观锁

```
前端保存 → POST /mutations { baseVersion: 17, ops: [...] }
                 ↓
           数据库当前 graphVersion == 17
                 ↓ 是
           事务执行 → version + 1 → 200 OK
                 ↓ 否
           409 STALE_GRAPH_VERSION
```

**当前状态**：graphVersion 已建在 Project 表和 mutation 契约里，但 409 冲突逻辑留到 Phase 3 实现（Alpha 单窗口无竞态）。

### 3.4 Migration 正式化

```
PRAGMA user_version
migration_001 → 空库 → 建 8 表，version = 3
migration_002 → v1 旧库 → VACUUM INTO .bak → 重建
migration_003 → v2 (Phase 2 schema) → DROP 旧 junction 表 → ALTER 加列
```

**规则**：已发布的 migration 永远不修改。升级前自动备份 `.bak`。migration 失败不自动删库。

---

## 4. 数据模型

### 4.1 Domain 实体（8 个核心实体）

```
Project ──┬── Scope (NEW)          ← 正式建模
          ├── Workspace            ← 语义 Viewport
          ├── Artifact             ← 文件实体
          ├── ArtifactView         ← 归属 Scope
          ├── Relation (REWRITTEN) ← entity-based
          ├── ArtifactRevision     ← 内容版本
          ├── Note                 ← 领域实体
          └── Checkpoint (REWRITTEN) ← 纯历史快照
```

### 4.2 关键实体变化

#### Scope（新增）

```typescript
interface Scope {
  id: ScopeId
  projectId: ProjectId
  parentScopeId: ScopeId | null     // 嵌套 Scope
  containerViewId: ArtifactViewId | null  // 容器节点
  kind: 'root' | 'collection' | 'context' | 'delivery'
  name: string
}
```

**之前**：Scope 仅在前端存在（CanvasScope），后端无表。

**现在**：scopes 表已在 v3 migration 中建立。Alpha 阶段所有 Scope 都是 `kind='root'`, `parentScopeId=null`（等同于之前的单 Scope 行为）。

#### Relation（重写）

```typescript
// 之前（绑定 View）
interface Relation {
  sourceArtifactViewId: ArtifactViewId
  targetArtifactViewId: ArtifactViewId
  workspaceId: WorkspaceId
}

// 现在（entity-based）
interface Relation {
  sourceEntityType: 'artifact' | 'note' | 'scope'
  sourceEntityId: string
  targetEntityType: 'artifact' | 'note' | 'scope'
  targetEntityId: string
  kind: string
}
```

**语义**：删除 View 不删除业务 Relation。Relation 是领域实体之间的关系。

#### Workspace（语义收窄）

```typescript
// 之前
interface Workspace {
  // ... 隐含拥有 ArtifactView/Relation
}

// 现在
interface Workspace {
  scopeId: ScopeId           // 绑定的 Scope
  viewport: { x, y, zoom }  // 相机位置
  focusedNodeIds: string[]   // 焦点节点
  visibleLayers: string[]    // 可见层
  contextPolicy: 'workspace-related' | 'selection-only'  // 正式字段
}
```

**不再拥有**：ArtifactView、Relation、Project Graph。

#### ArtifactView（归属 Scope）

```typescript
// 之前
interface ArtifactView {
  workspaceId: WorkspaceId
}

// 现在
interface ArtifactView {
  scopeId: ScopeId   // ← 改这里
}
```

#### Project（加 graphVersion）

```typescript
interface Project {
  graphVersion: GraphVersion  // 新增
}
```

#### Checkpoint（纯快照）

```typescript
interface Checkpoint {
  scopeId: ScopeId
  snapshotJson: JsonValue  // 替代之前的 canvasSnapShot + 关联表
  // 删除: artifactRevisionIds[], relatedRunIds[]
}
```

**语义**：Checkpoint 是 immutable 历史快照，不参与 autosave。Camera 持久化在 Workspace.viewport。

---

## 5. 数据库 Schema（v3）

```sql
-- 8 张表，通过 migration_001 创建

projects (
  id TEXT PK, name TEXT, root_path TEXT,
  graph_version INTEGER NOT NULL DEFAULT 1,   -- NEW
  created_at TEXT, updated_at TEXT
)

scopes (                                        -- NEW TABLE
  id TEXT PK,
  project_id TEXT FK → projects(id) CASCADE,
  parent_scope_id TEXT, container_view_id TEXT,
  kind TEXT NOT NULL, name TEXT NOT NULL,
  created_at TEXT, updated_at TEXT
)

workspaces (
  id TEXT PK, project_id TEXT FK → projects(id) CASCADE,
  scope_id TEXT NOT NULL,                       -- NEW
  name TEXT, intent TEXT,
  viewport TEXT NOT NULL,                       -- JSON: {x,y,zoom}
  focused_node_ids TEXT DEFAULT '[]',
  visible_layers TEXT DEFAULT '["core","process"]',
  context_policy TEXT DEFAULT 'selection-only', -- NEW
  updated_at TEXT
)

artifacts (
  id TEXT PK, project_id TEXT FK CASCADE,
  title TEXT, kind TEXT, local_path TEXT,
  availability TEXT, current_revision_id TEXT,
  created_at TEXT, updated_at TEXT
)

artifact_views (
  id TEXT PK, artifact_id TEXT FK → artifacts(id) RESTRICT,
  scope_id TEXT NOT NULL,                       -- CHANGED (was workspace_id)
  revision_id TEXT,
  reference_kind TEXT, position TEXT, size TEXT,  -- JSON
  display_mode TEXT, collapsed INTEGER DEFAULT 0
)

relations (                                     -- REWRITTEN
  id TEXT PK, project_id TEXT FK CASCADE,
  source_entity_type TEXT NOT NULL,             -- NEW (was source_artifact_view_id)
  source_entity_id TEXT NOT NULL,               -- NEW
  target_entity_type TEXT NOT NULL,             -- NEW (was target_artifact_view_id)
  target_entity_id TEXT NOT NULL,               -- NEW
  kind TEXT NOT NULL,
  created_at TEXT, updated_at TEXT
)

artifact_revisions (
  id TEXT PK, artifact_id TEXT FK CASCADE,
  parent_revision_id TEXT, local_path TEXT,
  content_hash TEXT, source TEXT, run_id TEXT,
  status TEXT, created_at TEXT
)
CREATE UNIQUE INDEX idx_revision_current
  ON artifact_revisions(artifact_id) WHERE status = 'current';

notes (
  id TEXT PK, project_id TEXT FK CASCADE,
  anchor_scope TEXT, artifact_id TEXT,
  artifact_view_id TEXT, page_index INTEGER,
  body TEXT, created_at TEXT, updated_at TEXT
)

checkpoints (                                   -- SIMPLIFIED
  id TEXT PK, project_id TEXT FK CASCADE,
  scope_id TEXT NOT NULL,                       -- was workspace_id
  label TEXT DEFAULT '',
  snapshot_json TEXT NOT NULL,                  -- was canvas_snapshot + junction tables
  created_at TEXT
)
-- 删除: checkpoint_revision_ids, checkpoint_run_ids
```

---

## 6. API 设计

### 6.1 GET /projects/:id/graph

启动时聚合读取。返回完整 ProjectGraphSnapshot。

```json
{
  "ok": true,
  "value": {
    "schemaVersion": 3,
    "graphVersion": 1,
    "project": { "id": "...", "graphVersion": 1, ... },
    "scopes": [{ "id": "scope-root", "kind": "root", ... }],
    "workspaces": [{ "scopeId": "scope-root", "contextPolicy": "selection-only", ... }],
    "artifacts": [...],
    "artifactViews": [{ "scopeId": "scope-root", ... }],
    "relations": [{ "sourceEntityType": "artifact", "sourceEntityId": "...", ... }],
    "notes": [],
    "artifactRevisions": [],
    "checkpoints": []
  }
}
```

### 6.2 PUT /projects/:id/graph

整图替换。保留用于 bootstrap、import、recovery、test fixture。

```json
// Request
{ "snapshot": { ...ProjectGraphSnapshot } }

// Response
{ "ok": true, "value": { ...snapshot } }
```

**不再要求 `disposable: true`**。

### 6.3 POST /projects/:id/graph（新增）

增量 mutation。每个 batch 一个事务，全部成功或全部 rollback。

```json
// Request
{
  "baseVersion": 18,
  "ops": [
    { "type": "move_artifact_view", "viewId": "view-123", "x": 420, "y": 188 },
    { "type": "update_workspace_viewport", "workspaceId": "ws-1", "viewport": { "x": 100, "y": 60, "zoom": 0.85 } }
  ]
}

// Response
{ "ok": true, "value": { "appliedOps": 2 } }
```

支持的 op 类型：

| type | 说明 |
|------|------|
| `bootstrap` | 整图初始化 |
| `move_artifact_view` | 移动节点 |
| `resize_artifact_view` | 调整大小 |
| `update_workspace_viewport` | 更新相机 |
| `upsert_workspace` | 创建/更新 Workspace |
| `delete_workspace` | 删除 Workspace |
| `upsert_scope` | 创建/更新 Scope |
| `upsert_artifact` | 创建/更新 Artifact |
| `upsert_artifact_view` | 创建/更新 View |
| `delete_artifact_view` | 删除 View（不删 Artifact） |
| `upsert_relation` | 创建/更新 Relation |
| `delete_relation` | 删除 Relation |
| `upsert_note` | 创建/更新 Note |
| `create_checkpoint` | 创建不可变快照 |
| `upsert_artifact_revision` | 创建/更新 Revision |

### 6.4 单实体 CRUD（保留）

```
GET    /workspaces?projectId=...          — 列 Workspace
POST   /workspaces                        — 创建/更新
GET    /artifacts/:id                     — 读取
POST   /artifacts                         — 创建/更新
GET    /artifact-views?artifactId=...     — 列 View
POST   /artifact-views                    — 创建/更新
DELETE /artifact-views/:id                — 删除
GET    /relations?projectId=...           — 列 Relation
POST   /relations                         — 创建/更新
DELETE /relations/:id                     — 删除
GET    /notes?projectId=...               — 列 Note
POST   /notes                             — 创建/更新
DELETE /notes/:id                         — 删除
GET    /artifact-revisions?artifactId=... — 列 Revision
GET    /checkpoints?projectId=...         — 列 Checkpoint
```

---

## 7. Bridge 映射逻辑

### 加载（SQLite → 浏览器）

```
ProjectGraphSnapshot
    │
    ▼ mapGraphToState()
PersistedPrototypeState
    │
artifactViews[i]    → CanvasNode  (合并 artifact 的 title/kind)
relations[i]         → CanvasEdge  (entityId → from/to)
workspaces[i]        → Workspace   (scopeId, contextPolicy, camera)
scopes[i]            → CanvasScope (id, kind, parentScopeId)
checkpoints[0]       → camera 恢复
```

### 保存（浏览器 → SQLite）

```
PersistedPrototypeState
    │
    ▼ mapStateToGraph()
ProjectGraphSnapshot
    │
CanvasNode[i]        → Artifact + ArtifactView (拆分)
CanvasEdge[i]        → Relation (entity-based)
Workspace[i]         → Workspace (scopeId, contextPolicy)
CanvasScope[i]       → Scope
```

### 已知映射差异

| 概念 | 前端 | 后端 | 处理 |
|------|------|------|------|
| Note | CanvasNode(kind='note') | 独立 notes 表 | Bridge 过滤 note 节点，单独 API |
| Process/Run/Decision 节点 | CanvasNode | 无对应 | Bridge 过滤 |
| uid 字段 (previewUrl, selection) | CanvasNode | 无 | 白名单过滤 |
| Workspace.contextPolicy | 内置 | 正式字段 | Bridge 直通 |
| Scope 嵌套 | 支持 parentScopeId | 表已支持 | Alpha 默认 root |

---

## 8. 三层数据分类

| 类别 | 包含 | 存储位置 | 持久化方 |
|------|------|----------|----------|
| **A. Mutable State** | Workspace, Scope, ArtifactView, Relation, Note | SQLite | Local Core |
| **B. Immutable History** | ArtifactRevision, Checkpoint, RunEvent, ContextSnapshot | SQLite | Local Core |
| **C. Ephemeral UI** | hover, selection, dragging, previewUrl, activeEdge | React state / Zustand | 不持久化 |

**纪律**：C 类永远不会写进 A 类。

---

## 9. 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| packages/domain | ✅ 完成 | 8 实体，Brand 类型，纯类型 |
| packages/contracts | ✅ 完成 | MutationBatch, graphVersion, 移除 disposable |
| Migration 001-003 | ✅ 完成 | .bak 备份，formal PRAGMA |
| Repository | ✅ 完成 | save/get/applyMutations + 单实体 CRUD |
| Server | ✅ 完成 | PUT/GET/POST graph + CRUD 路由 |
| 后端集成测试 | ✅ 通过 | PUT → GET → POST mutation → 验证 |
| runtimeBridge | ✅ 完成 | mapGraphToState/mapStateToGraph 重写 |
| localCoreClient | ✅ 完成 | 移除 disposable:true |
| 前端编译 | ✅ 0 errors | 5 文件适配 |
| 浏览器验证 | ⬜ 待做 | Canvas → save → restart → recover |
| 后端单元测试 | ⬜ 待适配 | 30 文件需更新新类型 |
| graphVersion 409 | ⬜ Phase 3 | 单窗口 Alpha 无需 |
| Zustand Store | ⬜ Phase 3 | 当前仍是 App.tsx useState |
| CanvasNodeVM 正式拆分 | ⬜ 后续 | 类型已在 model.ts，未拆文件 |

---

## 10. 技术约束

- **运行时**: Node.js 22，使用内置 `node:sqlite` (DatabaseSync)
- **HTTP**: 原生 `http.createServer`，不依赖 Express
- **数据库**: SQLite WAL 模式，同步执行（metadata 查询极小，无性能问题）
- **端口**: Local Core 绑定 `127.0.0.1:43121`，仅本地访问
- **CORS**: 不开放；浏览器通过 Vite Proxy 访问
- **Body Limit**: 1 MiB（匹配 ProjectGraphSnapshot 大小）
