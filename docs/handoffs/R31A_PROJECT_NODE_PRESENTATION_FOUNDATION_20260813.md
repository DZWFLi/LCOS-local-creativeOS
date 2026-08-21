# LCOS R3.1-A Project Node / Presentation Foundation Handoff

**Date:** 2026-08-13  
**Baseline package:** `LCOS-FULLSTACK-20260813-68f7597(1).zip`  
**Baseline HEAD recorded by package:** `68f7597a59bf052cce0a3df571f3a67e709bb113`  
**Status:** IMPLEMENTED IN CODE / FULL NPM + REAL-BROWSER ACCEPTANCE PENDING

> 本轮只修 R3.1 的 A 阶段底层，不推进 Workspace/Current Scene、Region/Fence、Workflow 右栏/逻辑节点、Agent UX 等后续修改。

---

## 1. 冻结后的产品第一性

LCOS 只有一套 Project Truth / Project Node 宇宙。

**Main Canvas、Context Graph、Workflow 是同一批 Project Nodes 的平级空间呈现。**

- Surface 不拥有节点。
- 节点不因为物理位于某个 Scope，就失去在其他 Surface 被使用/呈现的资格。
- 用户不需要理解 `bind / unbind / move / copy / reference / membership`。
- 用户心智只有：**看见一个对象 → 抓住 → 放到另一个视图/对象 → 在那里使用。**
- 工程内部可以使用 Presentation membership / reference，但不得反向塑造用户层级。

冻结句：

> **Surfaces project project objects; they do not own them.**

Scope 本轮保留作为兼容的导航/局部画布位置边界，但 **Scope 不是语义所有权边界**。

---

## 2. Context 严格只有两层

### Level 1 — Context Graph

点击底部「上下文」必须进入项目级 **Context Graph**。

这是一个 Obsidian-like 的项目上下文关系图，本身就是总览，不存在额外 Dashboard / Home / Relation Drill-down 层。

Graph 可以呈现项目级节点和 Context 聚合节点。后续视觉阶段再完整强化：

- Project Brief
- Stage Outline
- 当前项目阶段
- 当前关键判断 / Decision
- 已保存 Context
- 重要上下文包入口
- 其他可被放入 Graph 的 Project Nodes

### Level 2 — Concrete Context

在 Context Graph 上打开一个具体 Context 后，仅有两个视图：

1. `Signal Track`
2. `Mind Map`

二者必须消费 **同一套 exact Context membership**。

不存在第三个用户层 Relation Graph。

---

## 3. Workflow 的 A 阶段定义

Workflow 与 Main Canvas、Context Graph 平级。

Workflow 直接呈现同一套 Project Nodes 的一个行动/流程组织视图。

本轮只修它的 **project-wide exact membership / Drop / projection foundation**，不在本轮重做：

- Workflow 右侧栏
- Workflow Page UI
- operator palette
- condition / parallel / reference 逻辑节点
- Edge-first workflow semantics

这些属于后续 R3.1。

---

## 4. 本轮修掉的根问题

### 4.1 Context / Workflow 不再被当前 Scope 过滤

旧路径：

```text
current scope
→ scopeNodes
→ visibleNodes
→ Context / Workflow resolver
```

导致 Presentation 中明明存在跨 Scope `memberViewIds`，但 GUI 仍然看不见。

现在 Context detail / Context Graph / Workflow 的投影源使用 Project-wide node universe，再以 exact Presentation membership 过滤。

Main Canvas 本身仍可保留 scope-local navigation 行为。

---

### 4.2 Presentation exact membership，包括空集合，都是权威结果

修复 resolver：

- `explicitViewIds !== undefined` 即进入 exact membership 模式。
- `[]` 也是合法且权威的“当前没有成员”。
- 不再因为 exact 为空而回退到 Workspace、历史节点、process node heuristic。
- exact membership 不自动 `includeOneHop`。

因此：

> **Related ≠ Member**

一跳相关内容以后可以做推荐，但不能混进正式成员。

---

### 4.3 Signal Track 不再因为旧 trackSegments 失效而空白

旧 Context 可能保存的是物理 clone View ID；迁移到 Project-wide exact membership 后，旧 `trackSegments` 可全部变成 stale ID。

新增 `ensureTrackSegmentsCoverMembers()`：

- 先保留仍然有效的 segment；
- 所有 exact members 必须至少出现在一个 segment；
- 全部 segment stale 时自动生成 `当前内容`；
- 部分未覆盖时生成 `未编排`。

因此只要 Context exact membership 有成员，Signal Track 就不能因为旧 segment ID 而变成空白。

Mind Map 与 Signal Track 使用同一 exact membership。

---

### 4.4 Context semantic Drop 不再克隆 View

旧 Context 创建 / Drop 依赖把 ArtifactView 复制进 Context child Scope。

本轮改为：

```text
original Project View
→ Context Presentation.memberViewIds
```

原 View 留在原位置。

一个 View 可以同时被 Main Canvas、Context、Workflow 等 Presentation 使用。

旧 Context 物理 clone 不立即删除，以兼容历史数据；首次缺少 Presentation 时只作为 migration seed，并尝试 canonicalize 回原 Project View identity。

---

### 4.5 Context Graph 获得自己的项目级 membership

这是本轮在用户架构图后补齐的关键点。

底部「上下文」是 **Context Graph 本身**，不是“自动猜一个具体 Context”。

因此：

```text
Drop 到底部「上下文」/ Context Graph
→ 加入项目级 Context Graph Presentation
```

而：

```text
Drop 到某个具体 Context
→ 加入该 Context 的 exact membership
→ Signal Track / Mind Map 共同消费
```

两者不再混为一谈。

---

### 4.6 Workflow 使用项目级 exact membership

Workflow 本轮以 root/project host Presentation 保存 project-wide exact `memberViewIds`。

旧 Workflow Page Workspace membership 只保留兼容，不再决定节点能否渲染。

后续 Workspace/Current Scene + Workflow Page 语义重构时再移除这一兼容桥。

---

### 4.7 Direct Drop 目标语义重新接线

右键仍是唯一跨空间 Direct Drop 手势。

本轮底层目标：

```text
Right Drop → bottom Context capability
= 加入 Context Graph

Right Drop → concrete Context rail/card
= 加入该 Context

Right Drop → Workflow capability / Workflow rail
= 加入 Workflow
```

不弹 `Add / Move / Continue`。

同时 Drop ghost 改为稳定 pointer offset，不再把 ghost 中心压在 pointer 上。

---

### 4.8 Scope container identity 持久化修复

发现 `Scope.container_view_id` 在 Web Runtime serialization 中被写成 `null`，且 Local Core `#upsertScope` conflict update 不更新它。

已修：

- RuntimeBridge 序列化 / diff 保留 `containerNodeId → containerViewId`；
- Local Core upsert 更新 `parent_scope_id / container_view_id / kind / name / updated_at`。

这使 Collection / Context 的 aggregate container Project View identity 能跨 reload 保留下来。

---

## 5. 关键代码变化

### New

- `apps/web/src/state/projectPresentationMembership.ts`
  - project-level exact Presentation membership GET + merge + CAS
  - stale rebase once
  - exact removal
  - re-drop reveal hidden member
  - legacy normalization support

- `apps/web/tests/projectPresentationMembership.test.ts`
- `apps/web/tests/guiR31aProjectNodeFoundation.test.ts`

### Modified foundation files

- `apps/web/src/App.tsx`
- `apps/web/src/state/presentationViewState.ts`
- `apps/web/src/features/surfaces/capabilityViewResolver.ts`
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`
- `apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx`
- `apps/web/src/features/surfaces/ContextFlowSurface.tsx`
- `apps/web/src/features/context/trackSegments.ts`
- `apps/web/src/features/context/contextMerge.ts`
- `apps/web/src/features/shell/SurfaceDock.tsx`
- `apps/web/src/features/shell/WorkspaceRailVNext.tsx`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/local-core/src/metadata-repository.ts`
- `packages/contracts/src/presentations.ts`
- corresponding tests / contract tests

---

## 6. Context 创建规则（A 阶段）

旧 GUI 中「参考与上下文」入口暂时还存在，但底层创建路径已改：

1. 创建一个兼容 Context Scope shell + aggregate Context container node；
2. **不再插入 cloned member Views / Edges**；
3. 原始 Project View IDs 写入 concrete Context exact Presentation；
4. Context aggregate container node 写入 root Context Graph Presentation；
5. 打开 concrete Context detail。

旧 Selection 创建 Modal 的视觉/分类清理不属于本轮 A foundation。

---

## 7. 迁移规则

### Legacy Context

如果具体 Context 没有 persisted Presentation：

- 允许用旧 Context Scope 内物理 clone Views seed 一次；
- 尽可能 canonicalize 到原 Project View；
- 之后 Presentation 成为 exact membership truth。

### Legacy Workflow

如果缺少 persisted Workflow Presentation：

- 旧 Workflow Page / Workspace membership 仅作为兼容 seed/bridge；
- 不删除旧数据；
- 渲染资格不再由它决定。

### Existing Context Graph

旧 saved Context 即使尚未进入新的 graph membership，也会以 container Project View 作为 migration-visible Context object 出现在 Graph；新建 Context 会正式加入 graph membership。

---

## 8. 验证结果

### 已完成

#### TypeScript syntax scan

```text
SYNTAX PASS 418 TS/TSX source/test files
```

使用全局 TypeScript `transpileModule` 扫描当前 repo 的 418 个 TS/TSX source/test 文件。

#### Pure contract QA

```text
PURE CONTRACT QA PASS:
project-wide exact Context/Workflow membership
+ exact-empty
+ Signal Track coverage
+ CAS/reveal/remove/migration
```

覆盖：

- 跨 Scope exact projection
- exact empty authority
- Workflow 不 heuristic fallback
- stale Signal segments 补齐 exact members
- exact membership add/load/remove
- hidden re-drop reveal
- metadata cleanup
- legacy clone normalization
- CAS stale rebase

#### Source contract QA

```text
SOURCE CONTRACT QA PASS:
Project-node foundation,
two-level Context,
exact Drop,
no physical Context cloning on semantic paths
```

#### Context Graph foundation QA

```text
CONTEXT GRAPH FOUNDATION QA PASS:
graph/workflow are project-level node projections;
concrete Context remains level 2
```

---

## 9. 尚未完成的验收

### Full npm / Vitest / build

**未完成。原因不是已知代码失败，而是当前容器无法从 npm registry 解析依赖：`EAI_AGAIN`。**

当前 repo 没有 `node_modules`，因此不能诚实声称全量 `vitest` / `npm build` PASS。

### Real browser QA

必须在本地 Runtime 做真人鼠标验收：

1. root / Collection A / Collection B 中各取节点；
2. 任意 Scope 下右键 Drop 到底部 Context；
3. Context Graph 立即出现这些 Project nodes；
4. Drop 到 concrete Context；
5. 进入该 Context，Signal Track 能显示 exact members；
6. 切 Mind Map，同一 exact members 仍存在；
7. Drop 同一批到 Workflow；
8. Workflow 全部显示，不要求先进入源 Scope；
9. 切 Scope / reload 后 membership 不变；
10. 确认没有生成成员 clone View。

在真人 Gate 通过前，本阶段不得写 `COMPLETE`。

---

## 10. 明确留给 R3.1 后续的内容

本轮没有做：

- Workspace = Current Scene 语义合并
- `temporary-workbench` 清理
- Workspace aggregate ProjectNode identity 统一
- Unified Ctrl+Z / ChangeSet Undo
- Region / Fence Scope Pen
- Spatial neighbourhood
- Semantic Edge 视觉与 Workflow Edge-first
- Collection Spatial folder UI
- Workspace 主画布 mat UI
- Workflow 右侧栏重构
- Workflow operator / fake semantic node 清理
- Workflow Page 语义迁移
- Agent 多选 / 自然语言 Intent UX
- Selection toolbar 大改
- Context Graph 最终 Obsidian-like 视觉 / 自由布局持久化

---

## 11. A2 明确欠账：Workspace 作为真正 Project Node

目前 Presentation membership 仍以 `ArtifactView ID` 为主要成员身份。

Collection / Context 已经有 aggregate container ArtifactView，因此可以作为 Project node 被拖入其他 Presentation。

**Workspace 当前没有同等稳定的 generic ArtifactView identity。**

因此不要在本阶段声称 “Collection / Context / Workspace 所有 aggregate object 已经完全统一”。

A2 必须在 Workspace = Current Scene 重构时二选一并冻结：

1. Workspace 获得稳定 ProjectNode identity；或
2. Presentation membership 正式扩展为 generic `ProjectNodeRef`，不再只接受 ArtifactView ID。

不要用临时 fake ArtifactView 再造一层兼容债。

---

## 12. 下一阶段进入条件

只有以下真人 Gate PASS，才进入 Workspace / Region / Workflow 重构：

```text
Main Canvas node
→ Context Graph
→ concrete Context
→ Signal Track / Mind Map
→ Workflow
```

全链使用同一 Project node identity，跨 Scope、reload 后仍成立。

**A 阶段先保证节点宇宙是一套。后续再优化每一张画布长什么样。**
