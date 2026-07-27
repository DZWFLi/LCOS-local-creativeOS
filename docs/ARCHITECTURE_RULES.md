# Architecture Rules — Local Creative OS

> 机器守的规则。WorkBuddy 和 Codex 必须共同遵守。
> 每条规则对应至少一个 Architecture Test（`tests/architecture/`）。

---

## AR-001 Canvas is projection, never canonical Domain

Canvas 显示模型（CanvasNode, CanvasEdge, Workspace）是 Domain 的投影。
Canvas 不能反向重建 Domain 作为日常保存。

**Enforced by**: ARCH-001, ARCH-002

---

## AR-002 Artifact lifetime is independent from ArtifactView

删除最后一个 ArtifactView 不删除 Artifact。
Artifact 是文件实体，ArtifactView 是它在特定 Scope 的位置/展现。

**Enforced by**: ARCH-002

---

## AR-003 Workspace is a Semantic Viewport, not a Graph owner

Workspace 只持有：scopeId, viewport, focusedNodeIds, visibleLayers, contextPolicy。
Workspace 不持有 artifactViews[], relations[], graph[]。

**Enforced by**: ARCH-003

---

## AR-004 Checkpoint is immutable history

Checkpoint 一旦创建，snapshot_json 永不改变。
Camera/Viewport 从 Workspace.viewport 读取，不从 checkpoint 读取。

**Enforced by**: ARCH-004, ARCH-005

---

## AR-005 Revision lifecycle only changes through Domain Command

acceptRevision / createRevision 是唯一可以改变 revision status 的操作。
普通 Mutation 不能绕过 Domain Command 修改 Revision 生命周期。

**Enforced by**: (Phase 3 实现)

---

## AR-006 Presentation mutations do not advance graphVersion

move_artifact_view, resize_artifact_view, update_workspace_viewport → graphVersion 不变。
upsert_artifact, upsert_relation, upsert_note 等 semantic mutation → graphVersion +1。

**Enforced by**: ARCH-006, ARCH-007

---

## AR-007 Published migrations are immutable

已发布的 migration 文件永不修改。升级前自动 .bak 备份。
Migration 失败不自动删库。

**Enforced by**: ARCH-012

---

## AR-008 Fixture data never writes Runtime Project DB

Fixture/Demo 模式下的修改不能写入正式 SQLite Project 数据。

**Enforced by**: ARCH-011

---

## AR-009 Runtime save uses Mutation API, not mapStateToGraph

日常 runtime 编辑保存走 `saveMutations()` → `stateToOps()` → POST /mutations。
`mapStateToGraph()` 仅用于 Fixture / Import / Recovery / Bootstrap / Test。

**Enforced by**: code search verification

---

## AR-010 Relation is entity-based, not View-based

Relation 是领域实体之间的关系（sourceEntityType/sourceEntityId → targetEntityType/targetEntityId）。
删除 ArtifactView 不删除 Relation。

**Enforced by**: ARCH-009

---

## AR-011 Mutation queue is serialized

同一 Project 的 mutation 串行执行：A 完成前 B 不开始。
旧响应永远不能覆盖新状态。

**Enforced by**: INT-002

---

## AR-012 semanticGraphVersion + 409

semantic mutation → graphVersion +1。
presentation mutation → graphVersion 不变。
stale baseVersion → 409 STALE_GRAPH_VERSION。

**Enforced by**: INT-002

---

## 数据流向（不允许的路径）

```
❌ Canvas State → mapStateToGraph → PUT /graph        // 仅 import/test
❌ Checkpoint → Camera                                  // Camera 来自 Workspace
❌ Generic mutation → change revision status            // 仅 Domain Command
❌ Canvas → 猜测 Artifact 字段                          // 通过 Adapter 映射
```

## 允许的路径

```
✅ UI Action → StateToOps → POST /mutations → SQLite
✅ Workspace.viewport → Camera
✅ Domain Command → Revision lifecycle
✅ Domain Entity → Adapter → CanvasNodeVM
```
