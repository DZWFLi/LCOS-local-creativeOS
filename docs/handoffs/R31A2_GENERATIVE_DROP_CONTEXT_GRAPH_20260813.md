# LCOS R3.1-A2 Generative Drop + Context Graph Population Handoff

**Date:** 2026-08-13  
**Input package:** `LCOS-FULLSTACK-R3.1A-PROJECT-NODE-FOUNDATION-20260813.zip`  
**Underlying recorded baseline:** `68f7597a59bf052cce0a3df571f3a67e709bb113`  
**Status:** CODE IMPLEMENTED / STATIC GATE PASS / REAL BROWSER ACCEPTANCE PENDING

> 本轮继续只修 R3.1 A 阶段底层。没有进入 Collection 文件夹化、Workspace/Current Scene、Region/Fence、Workflow 右栏、Edge-first、Agent UX 等后半场。

## 1. 冻结产品契约

LCOS 只有一套 Project Nodes。

- Main Canvas、Context Graph、Workflow 是同一套 Project Nodes 的不同 Presentation。
- Surface 不拥有节点。
- 物理 Scope 不决定节点能否出现在 Context / Workflow。
- Drop 的用户语义是“把这个对象拿到那里使用”，不是 Move / Copy / Bind / Reference 选择题。
- 点击底部「上下文」只负责进入一级 Context Graph；点击具体 Context 才进入二级 Signal Track / Mind Map。

## 2. A1.2：Generative Drop

### 2.1 底部能力按钮同时是生成目标

点击：

```text
上下文 → Context Graph
工作流 → Workflow Surface
```

拖入 payload：

```text
Project Node / Rail Entity
→ Drop 到底部「上下文」
→ 当场创建新的 Context
→ payload 成为 exact 初始成员
→ 创建 Context aggregate entity
→ 打开该 Context 的 Signal Track
```

```text
Project Node / Rail Entity
→ Drop 到底部「工作流」
→ 当场创建新的 Workflow
→ payload 成为 exact 初始成员
→ 创建 Workflow aggregate entity
→ 打开该 Workflow
```

不再要求：

```text
先创建空壳 → 再返回主画布 → 再 Drop
```

### 2.2 两条拖拽链统一到同一语义入口

Canvas：右键 Pointer Drop。

Rail：HTML5 `application/x-lcos-project-view` Drop。

两者最终都调用：

```text
directDropToProjectRailView("capability:context" | "capability:workflow", viewIds)
```

底部目标在 Rail HTML5 拖入时增加可见高亮；Canvas 右键 Drop 继续使用现有 `is-direct-drop-target` 高亮和 pointer ghost。

### 2.3 已有 Context / Workflow 仍是 Existing Target

```text
Drop → existing Context
= append exact Context members
```

```text
Drop → existing Workflow
= append exact Workflow members
```

不创建第二个目标，不复制原 View。

## 3. Workflow 从“一个 root Surface”变成可保存实体

旧 R3.1A 仍只有 root Workflow Presentation，因此不能真正“Drop 生成一个新的 Workflow”。

本轮新增：

```text
ScopeKind += workflow
```

新建 Workflow 时：

- 创建 durable Workflow owner shell；
- 创建一个 aggregate Canvas entity node；
- `entityKind = workflow`；
- exact membership 存在 `presentation:workflow:<workflowOwnerId>`；
- Rail 中每个 Workflow 独立出现；
- 双击主画布上的 Workflow aggregate entity 等同进入该 Workflow；
- reload 后 Runtime 根据 backing Scope kind 还原 `entityKind=workflow`。

旧 root Workflow / Workflow Page 继续作为迁移兼容桥，不再是新 Workflow 的唯一模型。

> 注意：本轮仍没有做 Workflow 右侧栏、Workflow Page 去除、operator 节点重构。这里只解决 Workflow 可以靠 Drop 真正诞生并持久化的问题。

## 4. A1.3：Context Graph Population

Context Graph 不再等同于“用户手工加过几个 ID 的空 Presentation”。

Graph resolved membership =

```text
explicit Context Graph members
+ auto project-context nodes
+ all saved Context aggregate entities
```

自动项目上下文节点目前只从 **已经存在的 Project Truth** 中识别：

- Project Brief / Brief
- Stage Outline
- Current Stage / 当前阶段
- Decision / 关键判断 / 关键决策
- Context Package / 上下文包
- saved Context aggregate entity

关键约束：

> 自动投影是 project-wide 的。Brief 即使当前物理 View 在 Collection Scope 内，也仍然可以出现在 Context Graph。Scope 不得把它过滤掉。

同时为了避免 Graph 变成“把全项目所有文件铺一地”，普通低信号文件不会被自动塞入；用户明确 Drop 到 Context Graph 的普通 Project Node 会保留为 explicit member。

本轮不凭空生成不存在的 Project Brief / Stage Outline / Decision 内容。缺失的业务实体属于下一阶段 first-class Entity foundation，而不是用 fixture/fake node 假装存在。

## 5. Context 两层继续保持

```text
Level 1: Context Graph
       ↓ click one Context
Level 2: Signal Track | Mind Map
```

Signal Track / Mind Map 继续消费同一份 concrete Context exact membership。

`includeOneHop = false`。

Signal Track 继续用 `ensureTrackSegmentsCoverMembers()` 保证：只要 exact membership 非空，即使 legacy segment ID 全 stale，也必须显示成员。

## 6. 本轮修改文件

相对上一份用户已实测的 R3.1A package：

- `apps/web/src/App.tsx`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/state/canvasScopes.ts`
- `apps/web/src/features/shell/SurfaceDock.tsx`
- `apps/web/src/features/context/contextGraphPopulation.ts` **NEW**
- `packages/domain/src/index.ts`
- `apps/web/tests/contextGraphPopulation.test.ts` **NEW**
- `apps/web/tests/guiR31aProjectNodeFoundation.test.ts`
- `apps/web/tests/guiR3DirectManipulation.test.ts`
- `docs/OPEN_DEBTS.md`
- `FULLSTACK_BUILD_INFO.md`
- 本 Handoff

## 7. 明确未改

以下全部保留到 A2 / 后续 R3.1：

1. Workspace / Current Scene first-class ProjectNode identity。
2. Workspace sidebar item 现在仍会以其 member set 作为旧 drag payload；不能宣称“Workspace entity Drop”已闭环。
3. Collection 仍有 legacy 子画布逻辑；用户已经重新冻结 Collection = Region/Fence 常态化文件夹，此轮没有做视觉/模型迁移。
4. 旧「创建子画布 / 内容集合 / 参考与上下文 / 交付集合」Modal 仍是 legacy UI，Generative Drop 已绕开它，但本轮没有重做 Selection Create UX。
5. Decision 等 legacy `NodeKind` 仍受 Runtime 的旧 persistence heuristic 影响；统一 first-class Entity contract 属 A2。
6. Region/Fence Scope Pen。
7. Semantic Edge visual / workflow edge semantics。
8. Workflow 右侧栏、Workflow Pages、operator palette、假逻辑节点。
9. Arrange regression、多选 Agent、Agent mode/result UX。
10. Unified Ctrl+Z / ChangeSet。

## 8. 本容器验证

### PASS

- TypeScript `transpileModule` syntax scan：**424 TS/TSX files / 0 syntax errors**。
- R31A2 source contract：**9/9 PASS**。
- Context Graph population pure execution QA：**PASS**。
- ZIP integrity：打包后另验。

### 无法诚实宣称 PASS

完整 npm/vitest/build 没有在本容器执行成功：

- repo package 不含 `node_modules`；
- `npm ci --offline --ignore-scripts` 因 `@napi-rs/canvas` 未缓存而失败；
- 普通 `npm ci --ignore-scripts` 在本容器 120 秒超时；
- 因此不得复用 baseline 的 `381/381 + build` 来冒充本补丁验证。

## 9. 用户真机必须只测这 7 条

### G1 Main Canvas → new Context

```text
选 3 个节点
→ 右键按住拖到底部「上下文」
→ 按钮高亮 / ghost 显示“新建上下文”
→ 松开
```

期望：

- 不弹 Modal；
- 左栏出现新的 Context；
- 自动进入 Signal Track；
- 三个节点全部出现。

### G2 Main Canvas → new Workflow

同上，Drop 到底部「工作流」。

期望：

- 不需要先建 Workflow shell/page；
- Rail 出现独立 Workflow；
- Workflow 打开后三项全部出现。

### G3 Rail Collection/Context/Workflow → new Context

从左 Rail 抓一个已有 aggregate item，拖到底部「上下文」。

期望：生成新的 Context，并把 **aggregate entity node** 作为成员，不自动炸开全部孩子。

> Workspace Rail 仍是 A2 debt，本轮不要拿它判此项失败/成功。

### G4 Rail aggregate → new Workflow

同 G3，Drop 到「工作流」。

### G5 Existing target

把 Main Canvas 节点 Drop 到已存在的 Context / Workflow Rail item。

期望：直接 append，不生成新目标。

### G6 Context Graph

点击底部「上下文」。

期望：进入一级 Context Graph；所有 saved Context aggregate 都出现；项目中已存在的 Brief / Stage / Decision 等高信号节点即使物理位于其它 Scope 也应出现。

### G7 Reload

刷新页面后重开刚生成的 Context / Workflow。

期望：

- entity Rail item 仍在；
- exact member 数不变；
- Signal Track / Mind Map / Workflow 不因当前 Scope 改变而丢成员。

## 10. Gate

上述 G1–G7 有任一 Core/GUI 数据闭环失败：

> **继续停留在 R3.1 A，不进入 Workspace / Region / Workflow GUI 等后半场。**

只有 A-stage 的“同一 Project Node、随时呈现、Drop 即意图”真机闭环后，才允许继续下一半。
