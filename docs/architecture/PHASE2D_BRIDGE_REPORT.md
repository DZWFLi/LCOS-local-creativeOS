# Local Creative OS — 当前架构与 Phase 2D 连接问题报告

> 给架构师审阅用。截止 2026-07-24。

---

## 1. 三句话概括

**Phase 2 做什么**：让 Canvas 前端的数据真正写入 SQLite，而不是 Fixture 假数据或 localStorage。

**当前状态**：后端（Local Core + SQLite）完全可用，31 个后端测试全绿。前端 runtimeBridge 已建成，类型映射已对齐。但浏览器端到端的保存链路今天才刚修通，稳定性和语义细节还需要打磨。

**核心问题**：前端（App.tsx 约 600 行，Codex 在 Phase 1 用设计师习惯写出的 React 原型）和后端（我们用 DDD contracts + SQLite 写的 Node 服务）之间的数据模型不完全一致，bridge 层的类型映射是临时手工堆的，没有系统性契约测试。

---

## 2. 整体架构

```
浏览器 (localhost:5173)
  │
  ├─ App.tsx (React, ~600行)
  │   ├─ CanvasNode / CanvasEdge / Workspace / Camera / Scope ...  ← 前端模型
  │   └─ runtimeBridge.ts (Phase 2D 新建，~280行)
  │       └─ localCoreClient.ts (Phase 1B, ~246行)
  │
  └─ Vite Proxy (/api/local-core/v1 → 127.0.0.1:43121)
      │
      ��
Local Core (localhost:43121, Node 22 原生 http.createServer)
  │
  ├─ server.ts (路由分发, ~270行)
  ├─ SqliteMetadataRepository (~360行)
  │   ├─ save(ProjectGraphSnapshot) — 整图替换，事务写入
  │   ├─ get(projectId) — 整图读取
  │   └─ 单实体 CRUD (upsertWorkspace, upsertArtifact, etc.)
  │
  └─ node:sqlite (DatabaseSync)
      └─ phase2.sqlite (v2 schema, 8 tables)
```

### 数据库表结构 (v2)

```sql
-- Phase 2 Lite 的 5 张核心表
projects (id, name, root_path, created_at, updated_at)
workspaces (id, project_id FK, name, intent, viewport JSON, visible_layers JSON, ...)
artifacts (id, project_id FK, title, kind, local_path, availability, ...)
artifact_views (id, artifact_id FK, workspace_id FK, position JSON, size JSON, display_mode, ...)
relations (id, workspace_id FK, source_artifact_view_id FK, target_artifact_view_id FK, kind, ...)

-- Phase 2 新增 3 张表
artifact_revisions (id, artifact_id FK, content_hash, source, status, ...)  -- 没有 project_id!
notes (id, project_id FK, anchor_scope, body, ...)
checkpoints (id, project_id FK, workspace_id FK, label, snapshot_json, ...)
```

---

## 3. 前端→后端的类型映射（核心摩擦点）

### 两套数据模型对照

| 概念 | 前端 model.ts | 后端 contracts | Bridge 映射 |
|------|-------------|---------------|-------------|
| 画布节点 | `CanvasNode` (id, kind, title, x, y, width, height, displayMode, draft?, current?, disabled?, fileType?, scopeId?, previewUrl?, ...) | `Artifact` + `ArtifactView` 两张表 | 合并/拆分 |
| 连线 | `CanvasEdge` (id, from, to, kind) | `Relation` (sourceArtifactViewId, targetArtifactViewId) | 1:1 |
| 工作区 | `Workspace` (id, label, camera, visibleLayers, focusedNodeIds, contextPolicy: 'selection-only'\|'workspace-related') | `Workspace` (id, name, viewport, focusedNodeIds, visibleLayers) | 需要加 contextPolicy |
| 相机 | `Camera` {x, y, zoom} | `Workspace.viewport` {x, y, zoom} | 1:1 |
| 项目 | `ProjectPackage` (id, label, localPath, pendingCount) | `ProjectCatalogEntry` (id, name, rootPath) | 缺 pendingCount |
| Scope | `CanvasScope` (id, kind, parentScopeId, camera, containerNodeId?) | 无可对应概念 | 桥接时生成 |
| Note | `note` kind 的 CanvasNode (锚在前端 node 上) | `Note` 独立表 (anchor_scope JSON) | 独立映射 |
| Checkpoint | 无可对应概念 | `Checkpoint` (snapshot_json) | 前端无概念 |
| Revision | 无可对应概念 | `ArtifactRevision` (contentHash, status) | 前端无概念 |
| Run | 无可对应概念 | **Phase 5 才做**，已删除 checkpoint_run_ids | 未实现 |

### Bridge 映射逻辑 (runtimeBridge.ts)

**加载 (SQLite → 浏览器)**：
```
ProjectGraphSnapshot → mapGraphToState() → PersistedPrototypeState
  artifactViews[i]  → CanvasNode (合并 artifact.title/kind/availability)
  relations[i]      → CanvasEdge
  workspaces[i]     → Workspace
  workspaces[i]     → CanvasScope (从 workspace 衍生)
  checkpoints[0]    → 恢复 camera
```

**保存 (浏览器 → SQLite)**：
```
PersistedPrototypeState → mapStateToGraph() → ProjectGraphSnapshot
  CanvasNode[i]     → Artifact + ArtifactView (拆分)
  CanvasEdge[i]     → Relation
  Workspace[i]      → Workspace
  CanvasScope[0]    → Checkpoint.canvasSnapshot (camera)
```

### 已知的映射问题

1. **前端节点只有 `layer` 概念（通过 `nodeMeta[kind].layer`），没有 `visibility` 直接字段**。节点可见性通过 Workspace.visibleLayers 过滤。Bridge 恢复后 fix 了默认 layers=['core','process']。

2. **Scope 在前端是独立实体，后端没有对应表**。Bridge 从 Workspace 衍生 Scope，所有 Scope 固定 `kind='root', parentScopeId=null`。

3. **Note 在前端是 `kind='note'` 的 CanvasNode**（锚在某个节点上，渲染为节点画布上的"便签"），在后端是独立的 notes 表（用 JSON anchor_scope 描述锚点）。Bridge 在保存时过滤掉 note 节点，Note 通过单独 API 处理。

4. **前端 Workspace 有 `contextPolicy` 字段，后端没有**。Bridge 硬编码 `'selection-only'`。

5. **前端 `uid` 字段（previewUrl, hover, selection）不进 SQLite**——bridge 里有白名单过滤。但 CanvasEdge 的 `active` 字段和 CanvasNode 的 `draft`/`current` 字段目前仍会写进去。

---

## 4. Phase 2D 过程中遇到的全部问题

按发现顺序：

| # | 现象 | 根因 | 修复 | 属于 |
|---|------|------|------|------|
| 1 | 保存失败 `Only disposable projects accepted` | Local Core 默认 `disposableOnly: true`，拒绝 `project-portasplit`（不带 disposable- 前缀） | 改 `index.ts` 默认 `disposableOnly: false` | **Phase 2 配置遗漏** |
| 2 | 保存失败 `no such column: excluded.snapshot_json` | Schema 从 v2(旧) 改为 v2(新)，旧 SQLite 文件没重建 | 删旧 .sqlite 文件 | **Schema 迁移未落地** |
| 3 | 保存失败 `FOREIGN KEY constraint failed` | `artifact_revisions` 表没有 `project_id` 列，DELETE 语句错误 | 改用子查询 | **代码 bug** |
| 4 | 返回 502 Bad Gateway | 沙箱环境杀掉了后台 node 进程 | 改用长驻后台启动 | **环境问题** |
| 5 | 拖动画布触发保存 | camera 在 save useEffect 的依赖数组中 | 移除 camera/scopes/scopeId 依赖 | **pre-existing，HTTP 后端才暴露** |
| 6 | 创建节点后画布看不到 | Bridge 恢复的 Workspace.visibleLayers 不含 'process' 层；Scope ID 不匹配 | 修复默认值 | **Bridge 映射遗漏** |
| 7 | Chrome passive event 警告 | Canvas 滚轮事件使用了 passive listener，React 尝试 preventDefault | 无害警告，不改 | **pre-existing** |

---

## 5. 当前数据流（修完后）

```
[浏览器第一次打开]
App mount
  → runtimeBridge.isAvailable()     ← /health
  → runtimeBridge.loadProject()     ← GET /projects/:id/graph
  → mapGraphToState(snapshot)       ← 类型映射
  → setGraph / setWorkspaces / ...
  → bootMode = 'runtime'
  → 状态栏显示 "已保存 · Runtime"

[用户操作节点]
拖拽 / 创建 / 删除
  → React state 更新 (setNodes, setEdges, ...)
  → save useEffect fire (280ms debounce)
  → if bootMode === 'loading': return  ← hydration gate
  → mapStateToGraph(state)
  → bridge.saveProject(snapshot)
  → localCoreClient.saveProjectGraph()  ← PUT /projects/:id/graph
  → Local Core: BEGIN → DELETE ALL → UPSERT ALL → COMMIT
  → 成功: saveStatus = 'saved'
  → 失败: saveStatus = 'unsaved' + console.warn + notice

[浏览器刷新]
  → App mount
  → runtimeBridge 重新加载
  → 从 SQLite 恢复状态
  → 相机/节点位置/Workspace 应原样恢复 ← 这是 Phase 2E 未做的浏览器级验证
```

---

## 6. 开放问题（需要架构师判断）

### 6.1 PUT /graph 是"整图替换"，语义对吗？

当前实现：DELETE ALL child rows → UPSERT ALL。前端漏传一个节点就会丢失。前端已经做了"传全部当前节点"的实现，但没有 PATCH 语义保护。

**建议**：Alpha 先用 PUT。后续需要 PATCH 或加 graphVersion 防止冲突。

### 6.2 Scope 在后端是否有独立价值？

当前：Scope 在前端是实体（CanvasScope: id, kind, parentScopeId, camera）。后端没有 scope 表，Bridge 从 workspace 衍生。

**问题**：后续如果要支持嵌套 Scope、Scope 级权限、Scope 间移动节点，没有后端表会很痛苦。

### 6.3 Note 是独立表还是 CanvasNode 的一类？

前端：note 就是 kind='note' 的节点，和其他节点一样渲染和操作。
后端：notes 是独立表，和 artifacts 平行。

**当前 Bridge 做法**：保存时从 CanvasNode 列表里过滤掉 note（不发 artifacts），note 走单独 API。这导致**浏览器里看到的 note 节点无法通过 PUT /graph 保存**——需要用 POST /notes。

### 6.4 前端 App.tsx 是否已超出单体维护极限？

当前 App.tsx 约 620 行，内部状态约 30+ 个 useState，模型和 state 混在一起。渲染逻辑、数据加载、保存逻辑都在同一个文件。

Phase 2D 的 bridge 层已经向前迈了一步（数据源分离），但真正的状态管理重构还没开始。

### 6.5 disposable guard 是否应该彻底删除？

`SaveProjectGraphInput` 类型里硬编码了 `disposable: true`。这个字段最初是为 Phase 2 测试期设计的防误写机制。现在已经默认关闭了 Repository 层的 guard，但 contracts 层的类型还未清理。

### 6.6 测试覆盖的盲区

- ✅ 后端 unit tests (31 files, 130 tests)
- ✅ API 端到端 (phase2-verify.mjs Node 脚本)
- ❌ 浏览器端到端 (从未验证过 Canvas → SQLite → 重启 → Canvas)
- ❌ Vite Proxy 链路测试
- ❌ bridge 类型映射的 fixture equivalence 测试
- ❌ 并发 save 的 graphVersion 冲突测试

---

## 7. 推荐的下一步

**短期（本周）**：
1. 浏览器级完整验证：Canvas 操作 → 保存 → 关闭 → 重启 → 恢复
2. 清理 contracts 里的 `disposable: true` 类型残留
3. 补充 bridge 映射的 snapshot 测试

**中期（Phase 3 前）**：
4. Scope 后端化（加 scopes 表）
5. Note 保存路径统一（PUT /graph 应包含 notes）
6. graphVersion 乐观锁

**架构层面待决策**：
7. App.tsx 拆分方案（Context + reducer，还是 Zustand，还是保持现状）
8. 前端模型 (model.ts) 和后端模型 (contracts) 是否需要统一为一个 shared package
9. Scope 与 Workspace 的关系是否要在数据库中正式建模
